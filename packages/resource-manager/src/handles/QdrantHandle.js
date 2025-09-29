/**
 * QdrantHandle - Handle implementation for Qdrant vector database
 * 
 * Provides Handle interface for managing vector collections and performing
 * similarity search operations through the Handle/DataSource pattern.
 * 
 * URI Examples:
 * - legion://local/qdrant/collections                    (root - list collections)
 * - legion://local/qdrant/collections/my_vectors         (specific collection)
 * - legion://local/qdrant/collections/my_vectors/points  (points in collection)
 */

export class QdrantHandle {
  constructor(dataSource, parsed) {
    if (!dataSource) {
      throw new Error('DataSource is required for QdrantHandle');
    }
    
    if (!parsed) {
      throw new Error('Parsed URI components are required for QdrantHandle');
    }

    this.dataSource = dataSource;
    this.parsed = parsed;
    this._destroyed = false;
    
    // Parse the path to determine collection context
    this._parsePath(parsed.path);
    
    // Qdrant-specific properties
    this.server = parsed.server;
    this.resourceType = parsed.resourceType;
    
    // Event subscriptions
    this._subscriptions = new Map();
    this._subscriptionId = 0;
    
    // Metadata cache
    this._metadataCache = null;
    
    // Create proxy for transparent property access
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Handle methods and private properties directly
        if (prop in target || prop.startsWith('_') || typeof target[prop] === 'function') {
          return Reflect.get(target, prop, receiver);
        }
        
        // For dynamic properties, return from internal storage
        if (target._dynamicProps && prop in target._dynamicProps) {
          return target._dynamicProps[prop];
        }
        
        return Reflect.get(target, prop, receiver);
      },
      
      set(target, prop, value) {
        // Don't allow setting private properties or methods
        if (prop.startsWith('_') || typeof target[prop] === 'function') {
          return Reflect.set(target, prop, value);
        }
        
        // Allow setting Handle properties
        if (prop in target) {
          return Reflect.set(target, prop, value);
        }
        
        // Store dynamic properties
        if (!target._dynamicProps) {
          target._dynamicProps = {};
        }
        target._dynamicProps[prop] = value;
        return true;
      },
      
      has(target, prop) {
        // Check if it's a QdrantHandle property/method
        if (prop in target) {
          return true;
        }
        
        // Check dynamic properties
        if (target._dynamicProps && prop in target._dynamicProps) {
          return true;
        }
        
        return false;
      }
    });
  }

  /**
   * Parse the URI path to determine collection context
   * @private
   */
  _parsePath(path) {
    if (!path) {
      this.isRoot = true;
      this.collectionName = null;
      return;
    }

    const parts = path.split('/');
    
    // Check if we're at the root collections level
    if (parts[0] === 'collections' && parts.length === 1) {
      this.isRoot = true;
      this.collectionName = null;
    } else if (parts[0] === 'collections' && parts.length >= 2) {
      this.isRoot = false;
      this.collectionName = parts[1];
      this.subResource = parts.slice(2).join('/');
    } else {
      this.isRoot = false;
      this.collectionName = null;
      this.subResource = path;
    }
  }

  /**
   * Create a collection
   */
  async createCollection(config) {
    this._checkDestroyed();
    return await this.dataSource.createCollection(config);
  }

  /**
   * Get collection info for current collection
   */
  async getInfo() {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      throw new Error('Collection name is required for getInfo()');
    }
    
    const info = await this.dataSource.getCollectionInfo(this.collectionName);
    this._metadataCache = info;
    return info;
  }

  /**
   * List all collections (only works from root)
   */
  async listCollections() {
    this._checkDestroyed();
    return await this.dataSource.listCollections();
  }

  /**
   * Delete current collection
   */
  async deleteCollection() {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      throw new Error('Collection name is required for deleteCollection()');
    }
    
    return await this.dataSource.deleteCollection(this.collectionName);
  }

  /**
   * Check if current collection exists
   */
  async exists() {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      return true; // Root always exists
    }
    
    return await this.dataSource.collectionExists(this.collectionName);
  }

  /**
   * Upsert points to current collection
   */
  async upsert(points) {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      throw new Error('Collection name is required for upsert operations');
    }
    
    const result = await this.dataSource.upsertPoints(this.collectionName, points);
    
    // DataSource already notifies subscribers, no need to duplicate
    
    return result;
  }

  /**
   * Search for similar vectors in current collection
   */
  async search(vector, limit = 10) {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      throw new Error('Collection name is required for search operations');
    }
    
    return await this.dataSource.search(this.collectionName, vector, limit);
  }

  /**
   * Search with filters in current collection
   */
  async searchWithFilter(vector, filter, limit = 10) {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      throw new Error('Collection name is required for search operations');
    }
    
    return await this.dataSource.searchWithFilter(this.collectionName, vector, filter, limit);
  }

  /**
   * Get points by IDs from current collection
   */
  async getPoints(ids) {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      throw new Error('Collection name is required for getPoints operations');
    }
    
    return await this.dataSource.getPoints(this.collectionName, ids);
  }

  /**
   * Delete points from current collection
   */
  async deletePoints(ids) {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      throw new Error('Collection name is required for deletePoints operations');
    }
    
    const result = await this.dataSource.deletePoints(this.collectionName, ids);
    
    // DataSource already notifies subscribers, no need to duplicate
    
    return result;
  }

  /**
   * Update point payloads in current collection
   */
  async updatePayloads(updates) {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      throw new Error('Collection name is required for updatePayloads operations');
    }
    
    const result = await this.dataSource.updatePayloads(this.collectionName, updates);
    
    // DataSource already notifies subscribers, no need to duplicate
    
    return result;
  }

  /**
   * Batch upsert points
   */
  async batchUpsert(points) {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      throw new Error('Collection name is required for batch operations');
    }
    
    return await this.dataSource.batchUpsert(this.collectionName, points);
  }

  /**
   * Batch search
   */
  async batchSearch(vectors, limit = 10) {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      throw new Error('Collection name is required for batch search operations');
    }
    
    return await this.dataSource.batchSearch(this.collectionName, vectors, limit);
  }

  /**
   * Execute a query
   */
  async query(querySpec) {
    this._checkDestroyed();
    
    // Add current collection context if not specified
    if (this.collectionName && !querySpec.collection) {
      querySpec.collection = this.collectionName;
    }
    
    return await this.dataSource.query(querySpec);
  }

  /**
   * Get collection metadata
   */
  async getMetadata() {
    this._checkDestroyed();
    
    if (!this.collectionName) {
      return {
        type: 'qdrant',
        isRoot: true,
        server: this.server
      };
    }
    
    // Get fresh metadata
    const info = await this.getInfo();
    
    return {
      collection: this.collectionName,
      vectorsCount: info.vectors_count,
      pointsCount: info.points_count,
      server: this.server,
      type: 'qdrant'
    };
  }

  /**
   * Get schema information
   */
  getSchema() {
    this._checkDestroyed();
    
    return {
      type: 'qdrant',
      operations: [
        'search',
        'upsert',
        'delete',
        'update',
        'createCollection',
        'deleteCollection',
        'listCollections'
      ],
      vectorDimensions: 768,
      supportedDistances: ['Cosine', 'Euclid', 'Dot'],
      features: {
        filtering: true,
        batching: true,
        payloads: true
      }
    };
  }

  /**
   * Subscribe to Handle events
   */
  subscribe(callback, options = {}) {
    this._checkDestroyed();
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    const id = this._subscriptionId++;
    const subscription = {
      callback,
      options,
      id
    };
    
    this._subscriptions.set(id, subscription);
    
    // Also subscribe to DataSource
    const dsSubscription = this.dataSource.subscribe(
      (data) => {
        // Filter by collection if specified
        if (options.collection && data.collection && data.collection !== options.collection) {
          return;
        }
        // Don't call if filtering by different collection
        if (options.collection && this.collectionName && options.collection !== this.collectionName) {
          return;
        }
        // Format event consistently with Handle's own event format
        callback({ 
          event: data.type || 'collection.change', 
          data: data, 
          timestamp: Date.now() 
        });
      },
      options
    );
    
    return {
      unsubscribe: () => {
        this._subscriptions.delete(id);
        dsSubscription.unsubscribe();
      }
    };
  }

  /**
   * Notify subscribers of events
   * @private
   */
  _notifySubscribers(event, data) {
    for (const sub of this._subscriptions.values()) {
      // Filter by event type
      if (sub.options.event && sub.options.event !== event) {
        continue;
      }
      // Filter by collection
      if (sub.options.collection && data.collection && sub.options.collection !== data.collection) {
        continue;
      }
      try {
        sub.callback({ event, data, timestamp: Date.now() });
      } catch (error) {
        console.error('Subscriber callback error:', error);
      }
    }
  }

  /**
   * Validate vector dimensions
   */
  validateVector(vector) {
    if (!vector || !Array.isArray(vector)) {
      return false;
    }
    if (vector.length !== 768) {
      return false;
    }
    return true;
  }

  /**
   * Validate point structure
   */
  validatePoint(point) {
    if (!point || typeof point !== 'object') {
      return false;
    }
    if (!point.id) {
      return false;
    }
    if (!this.validateVector(point.vector)) {
      return false;
    }
    return true;
  }

  /**
   * Validate collection name
   */
  validateCollectionName(name) {
    if (!name || typeof name !== 'string') {
      return false;
    }
    if (name.length === 0) {
      return false;
    }
    return true;
  }

  /**
   * Get URI for this Handle
   */
  toURI() {
    const basePath = 'collections';
    const fullPath = this.collectionName 
      ? `${basePath}/${this.collectionName}${this.subResource ? '/' + this.subResource : ''}`
      : basePath;
    
    return `legion://${this.server}/${this.resourceType}/${fullPath}`;
  }

  /**
   * Create child Handle for sub-resource
   */
  child(subPath) {
    this._checkDestroyed();
    
    const currentPath = this.parsed.path || 'collections';
    const childPath = this.collectionName 
      ? `collections/${this.collectionName}/${subPath}`
      : `${currentPath}/${subPath}`;
    
    const childParsed = {
      ...this.parsed,
      path: childPath
    };
    
    return new QdrantHandle(this.dataSource, childParsed);
  }

  /**
   * Get parent Handle
   */
  parent() {
    this._checkDestroyed();
    
    if (this.isRoot) {
      return null; // Already at root
    }
    
    const parentParsed = {
      ...this.parsed,
      path: 'collections'
    };
    
    return new QdrantHandle(this.dataSource, parentParsed);
  }

  /**
   * Navigate to a different collection
   */
  collection(collectionName) {
    this._checkDestroyed();
    
    const collectionParsed = {
      ...this.parsed,
      path: `collections/${collectionName}`
    };
    
    return new QdrantHandle(this.dataSource, collectionParsed);
  }

  /**
   * Export Handle state
   */
  export(options = {}) {
    this._checkDestroyed();
    
    return {
      uri: this.toURI(),
      server: this.server,
      collectionName: this.collectionName,
      isRoot: this.isRoot,
      metadata: this._metadataCache,
      schema: this.getSchema()
    };
  }

  /**
   * Clone this Handle
   */
  clone() {
    this._checkDestroyed();
    return new QdrantHandle(this.dataSource, { ...this.parsed });
  }

  /**
   * Check if Handle is destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }

  /**
   * Destroy this Handle and cleanup resources
   */
  destroy() {
    if (this._destroyed) return;
    
    // Clear subscriptions
    this._subscriptions.clear();
    
    // Mark as destroyed
    this._destroyed = true;
    this.dataSource = null;
    this.parsed = null;
    this._metadataCache = null;
  }

  /**
   * String representation
   */
  toString() {
    if (this._destroyed) {
      return '[QdrantHandle (destroyed)]';
    }
    
    if (this.collectionName) {
      return `[QdrantHandle: ${this.collectionName}]`;
    }
    
    return '[QdrantHandle: collections]';
  }

  /**
   * JSON representation
   */
  toJSON() {
    if (this._destroyed) {
      return { destroyed: true };
    }
    
    return {
      type: 'QdrantHandle',
      uri: this.toURI(),
      collectionName: this.collectionName,
      server: this.server,
      isRoot: this.isRoot
    };
  }

  /**
   * Check if Handle is destroyed and throw if so
   * @private
   */
  _checkDestroyed() {
    if (this._destroyed) {
      throw new Error('QdrantHandle has been destroyed');
    }
  }
}

export default QdrantHandle;