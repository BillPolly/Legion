/**
 * MongoHandle - Handle implementation for MongoDB resources
 * 
 * Provides Handle interface for accessing and manipulating MongoDB documents,
 * collections, and databases. Supports real-time updates via change streams
 * and provides intuitive document manipulation methods.
 * 
 * URI Examples:
 * - legion://local/mongodb/mydb/users/507f1f77bcf86cd799439011
 * - legion://server/mongodb/tools/collection
 * - legion://prod/mongodb/analytics/events
 */

export class MongoHandle {
  constructor(dataSource, parsed) {
    if (!dataSource) {
      throw new Error('DataSource is required for MongoHandle');
    }
    
    if (!parsed) {
      throw new Error('Parsed URI components are required for MongoHandle');
    }

    this.dataSource = dataSource;
    this.parsed = parsed;
    this._destroyed = false;
    
    // MongoDB-specific properties from path: /database/collection/document?
    const pathParts = parsed.path.split('/').filter(p => p.length > 0);
    this.database = pathParts[0] || 'legion';
    this.collection = pathParts[1] || null;
    this.documentId = pathParts[2] || null;
    this.server = parsed.server;
    this.resourceType = parsed.resourceType;
    
    // Handle type based on path depth
    this.handleType = this._determineHandleType();
    
    // Cached document data
    this._documentData = null;
    this._lastFetch = null;
    this._cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Create proxy for transparent property access
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Handle methods and private properties directly
        if (prop in target || prop.startsWith('_') || typeof target[prop] === 'function') {
          return Reflect.get(target, prop, receiver);
        }
        
        // For document field access, delegate to getField
        if (typeof prop === 'string' && target.handleType === 'document') {
          return target.getField(prop);
        }
        
        return Reflect.get(target, prop, receiver);
      },
      
      set(target, prop, value) {
        // Don't allow setting private properties or methods
        if (prop.startsWith('_') || prop in target) {
          return Reflect.set(target, prop, value);
        }
        
        // For document field setting, delegate to setField
        if (typeof prop === 'string' && target.handleType === 'document') {
          target.setField(prop, value);
          return true;
        }
        
        return Reflect.set(target, prop, value);
      },
      
      has(target, prop) {
        // Check if it's a MongoHandle property/method
        if (prop in target) {
          return true;
        }
        
        // For documents, check if field exists
        if (target.handleType === 'document') {
          return target.hasField(prop);
        }
        
        return false;
      }
    });
  }

  /**
   * Get document field value (for document handles)
   * @param {string} field - Field name (optional, returns full document if not provided)
   * @returns {*} Field value or full document
   */
  getField(field = null) {
    this._checkDestroyed();
    
    if (this.handleType !== 'document') {
      throw new Error('getField() only available for document handles');
    }
    
    // Return cached data if available and recent
    if (this._documentData && this._isDataCacheValid()) {
      return field ? this._documentData[field] : this._documentData;
    }
    
    // For real-time access, we need async - provide sync access to cached data only
    // Direct users to use getFieldAsync() for fresh data
    if (!this._documentData) {
      throw new Error('No cached document data - use getFieldAsync() for fresh data');
    }
    
    return field ? this._documentData[field] : this._documentData;
  }

  /**
   * Get document field value asynchronously (always fresh)
   * @param {string} field - Field name (optional, returns full document if not provided)
   * @returns {Promise<*>} Field value or full document
   */
  async getFieldAsync(field = null) {
    this._checkDestroyed();
    
    if (this.handleType !== 'document') {
      throw new Error('getFieldAsync() only available for document handles');
    }
    
    if (!this.documentId) {
      throw new Error('Document ID is required for field access');
    }
    
    try {
      // Fetch fresh document data
      const results = await this.dataSource.queryAsync({
        findOne: { _id: this._parseObjectId(this.documentId) }
      });
      
      if (results.length === 0) {
        throw new Error(`Document not found: ${this.documentId}`);
      }
      
      // Update cache
      this._documentData = results[0].data;
      this._lastFetch = Date.now();
      
      return field ? this._documentData[field] : this._documentData;
      
    } catch (error) {
      throw new Error(`Failed to get document field: ${error.message}`);
    }
  }

  /**
   * Set document field value
   * @param {string} field - Field name (or object if setting multiple fields)
   * @param {*} value - Field value (optional if field is object)
   * @returns {Promise<Object>} Update result
   */
  async setField(field, value = undefined) {
    this._checkDestroyed();
    
    if (this.handleType !== 'document') {
      throw new Error('setField() only available for document handles');
    }
    
    if (!this.documentId) {
      throw new Error('Document ID is required for field updates');
    }
    
    let updateFields;
    
    if (typeof field === 'object' && value === undefined) {
      // setField({ field1: value1, field2: value2 })
      updateFields = field;
    } else {
      // setField('field', value)
      updateFields = { [field]: value };
    }
    
    try {
      const result = await this.dataSource.updateAsync({
        updateOne: {
          filter: { _id: this._parseObjectId(this.documentId) },
          update: { $set: updateFields }
        }
      });
      
      // Update local cache
      if (this._documentData) {
        Object.assign(this._documentData, updateFields);
        this._lastFetch = Date.now();
      }
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to set document field: ${error.message}`);
    }
  }

  /**
   * Check if document field exists
   * @param {string} field - Field name
   * @returns {boolean} True if field exists
   */
  hasField(field) {
    this._checkDestroyed();
    
    if (this.handleType !== 'document') {
      return false;
    }
    
    if (!this._documentData || !this._isDataCacheValid()) {
      // Can't determine field existence without data
      return false;
    }
    
    return field in this._documentData;
  }

  /**
   * Query collection or database
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Array>} Query results
   */
  async query(querySpec) {
    this._checkDestroyed();
    
    if (this.handleType === 'document') {
      throw new Error('query() not available for document handles - use collection or database handles');
    }
    
    return await this.dataSource.queryAsync(querySpec);
  }

  /**
   * Find documents in collection
   * @param {Object} filter - MongoDB filter object
   * @param {Object} options - Query options (limit, sort, etc.)
   * @returns {Promise<Array>} Array of document handles
   */
  async find(filter = {}, options = {}) {
    this._checkDestroyed();
    
    if (this.handleType !== 'collection') {
      throw new Error('find() only available for collection handles');
    }
    
    const querySpec = { find: filter, ...options };
    const results = await this.dataSource.queryAsync(querySpec);
    
    // Convert results to document handles
    return results.map(result => this._createDocumentHandle(result));
  }

  /**
   * Find one document in collection
   * @param {Object} filter - MongoDB filter object
   * @returns {Promise<MongoHandle|null>} Document handle or null
   */
  async findOne(filter = {}) {
    this._checkDestroyed();
    
    if (this.handleType !== 'collection') {
      throw new Error('findOne() only available for collection handles');
    }
    
    const results = await this.dataSource.queryAsync({ findOne: filter });
    
    if (results.length === 0) {
      return null;
    }
    
    return this._createDocumentHandle(results[0]);
  }

  /**
   * Insert document into collection
   * @param {Object} document - Document to insert
   * @returns {Promise<MongoHandle>} Handle for inserted document
   */
  async insertOne(document) {
    this._checkDestroyed();
    
    if (this.handleType !== 'collection') {
      throw new Error('insertOne() only available for collection handles');
    }
    
    const result = await this.dataSource.updateAsync({
      insertOne: document
    });
    
    if (result.success && result.changes.length > 0) {
      const insertedId = result.changes[0].insertedId;
      return this._createDocumentHandle({
        _id: insertedId,
        data: { _id: insertedId, ...document },
        collection: this.collection,
        database: this.database
      });
    }
    
    throw new Error('Document insertion failed');
  }

  /**
   * Update document (for document handles)
   * @param {Object} update - MongoDB update specification
   * @returns {Promise<Object>} Update result
   */
  async update(update) {
    this._checkDestroyed();
    
    if (this.handleType !== 'document') {
      throw new Error('update() only available for document handles');
    }
    
    if (!this.documentId) {
      throw new Error('Document ID is required for updates');
    }
    
    const result = await this.dataSource.updateAsync({
      updateOne: {
        filter: { _id: this._parseObjectId(this.documentId) },
        update: update
      }
    });
    
    // Invalidate cache
    this._documentData = null;
    this._lastFetch = null;
    
    return result;
  }

  /**
   * Delete document (for document handles)
   * @returns {Promise<Object>} Delete result
   */
  async delete() {
    this._checkDestroyed();
    
    if (this.handleType !== 'document') {
      throw new Error('delete() only available for document handles');
    }
    
    if (!this.documentId) {
      throw new Error('Document ID is required for deletion');
    }
    
    const result = await this.dataSource.updateAsync({
      deleteOne: { _id: this._parseObjectId(this.documentId) }
    });
    
    // Mark as destroyed since document no longer exists
    this._destroyed = true;
    
    return result;
  }

  /**
   * Get collection information (for collection handles)
   * @returns {Promise<Object>} Collection stats and info
   */
  async getCollectionInfo() {
    this._checkDestroyed();
    
    if (this.handleType !== 'collection') {
      throw new Error('getCollectionInfo() only available for collection handles');
    }
    
    // Get collection stats via aggregation
    const stats = await this.dataSource.queryAsync({
      aggregate: [{ $collStats: { storageStats: {} } }]
    });
    
    return stats.length > 0 ? stats[0].data : {};
  }

  /**
   * Subscribe to changes
   * @param {Function} callback - Change notification callback
   * @param {Object} options - Subscription options
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(callback, options = {}) {
    this._checkDestroyed();
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    let querySpec;
    
    if (this.handleType === 'document') {
      // Watch specific document
      querySpec = {
        find: { _id: this._parseObjectId(this.documentId) },
        operations: options.operations || ['update', 'delete', 'replace']
      };
    } else if (this.handleType === 'collection') {
      // Watch collection
      querySpec = {
        operations: options.operations || ['insert', 'update', 'delete', 'replace']
      };
      if (options.filter) {
        querySpec.find = options.filter;
      }
    } else {
      throw new Error('Subscriptions only available for document and collection handles');
    }
      
    return this.dataSource.subscribe(querySpec, callback);
  }

  /**
   * Get Handle metadata
   * @returns {Object} Handle metadata
   */
  getMetadata() {
    this._checkDestroyed();
    
    const baseMetadata = this.dataSource.getMetadata();
    
    return {
      ...baseMetadata,
      handleType: this.handleType,
      database: this.database,
      collection: this.collection,
      documentId: this.documentId,
      hasCachedData: !!this._documentData,
      cacheAge: this._lastFetch ? Date.now() - this._lastFetch : null
    };
  }

  /**
   * Get Handle schema
   * @returns {Object} Handle schema
   */
  getSchema() {
    this._checkDestroyed();
    return this.dataSource.getSchema();
  }

  /**
   * Create query builder
   * @returns {Object} MongoDB query builder
   */
  query() {
    this._checkDestroyed();
    return this.dataSource.queryBuilder(this);
  }

  /**
   * Get URI for this MongoDB resource
   * @returns {string} Legion URI
   */
  toURI() {
    const pathParts = [this.database];
    if (this.collection) pathParts.push(this.collection);
    if (this.documentId) pathParts.push(this.documentId);
    
    return `legion://${this.server}/${this.resourceType}/${pathParts.join('/')}`;
  }

  /**
   * Create child Handle for nested resource
   * @param {string} childPath - Child resource path
   * @returns {MongoHandle} Child MongoDB Handle
   */
  child(childPath) {
    this._checkDestroyed();
    
    const currentPath = [this.database];
    if (this.collection) currentPath.push(this.collection);
    if (this.documentId) currentPath.push(this.documentId);
    
    const fullChildPath = [...currentPath, childPath].join('/');
    
    const childParsed = {
      ...this.parsed,
      path: fullChildPath
    };
    
    return new MongoHandle(this.dataSource, childParsed);
  }

  /**
   * Get parent Handle (if applicable)
   * @returns {MongoHandle|null} Parent Handle or null if at root
   */
  parent() {
    this._checkDestroyed();
    
    if (this.handleType === 'database') {
      return null; // Database is root level
    }
    
    if (this.handleType === 'document') {
      // Parent is collection
      const parentPath = `${this.database}/${this.collection}`;
      const parentParsed = {
        ...this.parsed,
        path: parentPath
      };
      return new MongoHandle(this.dataSource, parentParsed);
    }
    
    if (this.handleType === 'collection') {
      // Parent is database
      const parentParsed = {
        ...this.parsed,
        path: this.database
      };
      return new MongoHandle(this.dataSource, parentParsed);
    }
    
    return null;
  }

  /**
   * Clone this Handle
   * @returns {MongoHandle} Cloned Handle
   */
  clone() {
    this._checkDestroyed();
    return new MongoHandle(this.dataSource, { ...this.parsed });
  }

  /**
   * Check if Handle is destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }

  /**
   * Destroy this Handle and cleanup resources
   */
  destroy() {
    if (this._destroyed) return;
    
    // Cleanup cached data
    this._documentData = null;
    this._lastFetch = null;
    
    this._destroyed = true;
    this.dataSource = null;
    this.parsed = null;
  }

  /**
   * String representation
   * @returns {string} String representation
   */
  toString() {
    if (this._destroyed) {
      return '[MongoHandle (destroyed)]';
    }
    
    return `[MongoHandle (${this.handleType}): ${this.toURI()}]`;
  }

  /**
   * JSON representation
   * @returns {Object} JSON-serializable object
   */
  toJSON() {
    if (this._destroyed) {
      return { destroyed: true };
    }
    
    return {
      type: 'MongoHandle',
      handleType: this.handleType,
      uri: this.toURI(),
      database: this.database,
      collection: this.collection,
      documentId: this.documentId,
      server: this.server,
      hasCachedData: !!this._documentData
    };
  }

  // Private helper methods

  /**
   * Determine handle type from path structure
   * @returns {string} Handle type (database, collection, document)
   * @private
   */
  _determineHandleType() {
    if (this.documentId) return 'document';
    if (this.collection) return 'collection';
    return 'database';
  }

  /**
   * Check if cached data is still valid
   * @returns {boolean} True if cache is valid
   * @private
   */
  _isDataCacheValid() {
    if (!this._lastFetch) return false;
    return (Date.now() - this._lastFetch) < this._cacheTimeout;
  }

  /**
   * Parse string ID to ObjectId if needed
   * @param {string|Object} id - Document ID
   * @returns {Object} ObjectId or original value
   * @private
   */
  _parseObjectId(id) {
    // If it's already an ObjectId, return as-is
    if (id && typeof id === 'object' && id.constructor.name === 'ObjectId') {
      return id;
    }
    
    // Try to create ObjectId from string
    if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
      try {
        // Dynamically import ObjectId to avoid circular dependencies
        import('mongodb').then(({ ObjectId }) => {
          return new ObjectId(id);
        });
      } catch (error) {
        // If ObjectId creation fails, return as string
        return id;
      }
    }
    
    return id;
  }

  /**
   * Create document handle from query result
   * @param {Object} result - Query result
   * @returns {MongoHandle} Document handle
   * @private
   */
  _createDocumentHandle(result) {
    const documentPath = `${result.database}/${result.collection}/${result._id}`;
    const documentParsed = {
      ...this.parsed,
      path: documentPath
    };
    
    const handle = new MongoHandle(this.dataSource, documentParsed);
    
    // Pre-populate with data
    handle._documentData = result.data;
    handle._lastFetch = Date.now();
    
    return handle;
  }

  /**
   * Check if Handle is destroyed and throw if so
   * @private
   */
  _checkDestroyed() {
    if (this._destroyed) {
      throw new Error('MongoHandle has been destroyed');
    }
  }
}

export default MongoHandle;