/**
 * RelationshipHandle - Handle for individual Neo4j relationships
 * 
 * Provides Handle-based interface for relationship operations with:
 * - Complete CRUD operations (Create, Read, Update, Delete)
 * - Property management with validation
 * - Node navigation (start/end nodes)
 * - Type management
 * - Caching with TTL
 * - Subscription system for change notifications
 */

export class RelationshipHandle {
  constructor(dataSource, relationshipId, options = {}) {
    if (!dataSource) {
      throw new Error('DataSource is required for RelationshipHandle');
    }
    if (!relationshipId) {
      throw new Error('Relationship ID is required for RelationshipHandle');
    }
    
    this.dataSource = dataSource;
    this.id = relationshipId.toString();
    this._type = 'RelationshipHandle';
    this._cache = null;
    this._cacheTime = null;
    this._cacheTTL = options.cacheTTL || 30000; // 30 seconds default
    this._validator = options.validator || null;
    this._subscriptions = new Map();
    this._subscriptionCounter = 0;
  }

  /**
   * Get relationship data (type, properties, start/end nodes)
   */
  get() {
    this._refreshCache();
    if (!this._cache) {
      throw new Error(`Relationship with ID ${this.id} does not exist`);
    }
    return {
      id: this.id,
      type: this._cache.type,
      properties: this._cache.properties || {},
      start: this._cache.start,
      end: this._cache.end
    };
  }

  /**
   * Get relationship properties
   */
  get properties() {
    this._refreshCache();
    return this._cache?.properties || {};
  }

  /**
   * Get relationship type
   */
  get type() {
    this._refreshCache();
    return this._cache?.type || null;
  }

  /**
   * Get start node ID
   */
  get startNodeId() {
    this._refreshCache();
    return this._cache?.start?.toString();
  }

  /**
   * Get end node ID
   */
  get endNodeId() {
    this._refreshCache();
    return this._cache?.end?.toString();
  }

  /**
   * Get start node handle
   */
  get startNode() {
    const startId = this.startNodeId;
    return startId ? this.dataSource.createNodeHandle(startId) : null;
  }

  /**
   * Get end node handle
   */
  get endNode() {
    const endId = this.endNodeId;
    return endId ? this.dataSource.createNodeHandle(endId) : null;
  }

  /**
   * Check if relationship exists
   */
  exists() {
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: 'MATCH ()-[r]-() WHERE id(r) = $id RETURN count(r) as count',
        params: { id: parseInt(this.id) }
      });
      return result.records[0].count > 0;
    } catch (error) {
      console.warn(`[RelationshipHandle] Error checking existence for relationship ${this.id}:`, error.message);
      return false;
    }
  }

  /**
   * Set relationship properties
   */
  set(updates, options = {}) {
    const { validate = true, merge = true } = options;
    
    // Validate updates if validator is available
    if (validate && this._validator) {
      const validation = this._validator.validateParameters(updates);
      if (validation.errors.length > 0) {
        throw new Error(`Property validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    // Validate property names
    this._validatePropertyNames(Object.keys(updates));
    
    const query = merge 
      ? 'MATCH ()-[r]-() WHERE id(r) = $id SET r += $props RETURN r'
      : 'MATCH ()-[r]-() WHERE id(r) = $id SET r = $props RETURN r';
    
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: query,
        params: { id: parseInt(this.id), props: updates }
      });
      
      if (result.records.length === 0) {
        throw new Error(`Relationship with ID ${this.id} does not exist`);
      }
      
      this._invalidateCache();
      this._notifySubscribers('update', { properties: updates });
      return this;
    } catch (error) {
      console.error(`[RelationshipHandle] Error setting properties for relationship ${this.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Set a single property
   */
  setProperty(key, value, options = {}) {
    return this.set({ [key]: value }, options);
  }

  /**
   * Set multiple properties (alias for set with merge=true)
   */
  setProperties(properties, options = {}) {
    return this.set(properties, { ...options, merge: true });
  }

  /**
   * Get a single property value
   */
  getProperty(key) {
    return this.properties[key];
  }

  /**
   * Remove properties
   */
  removeProperties(keys, options = {}) {
    if (!Array.isArray(keys)) {
      keys = [keys];
    }
    
    const removeStatements = keys.map(key => `r.${key}`).join(', ');
    
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: `MATCH ()-[r]-() WHERE id(r) = $id REMOVE ${removeStatements} RETURN r`,
        params: { id: parseInt(this.id) }
      });
      
      if (result.records.length === 0) {
        throw new Error(`Relationship with ID ${this.id} does not exist`);
      }
      
      this._invalidateCache();
      this._notifySubscribers('update', { removedProperties: keys });
      return this;
    } catch (error) {
      console.error(`[RelationshipHandle] Error removing properties for relationship ${this.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Remove a single property (alias for removeProperties)
   */
  removeProperty(key, options = {}) {
    return this.removeProperties([key], options);
  }

  /**
   * Get the other node in the relationship (given one node)
   */
  getOtherNode(nodeId, options = {}) {
    const { returnHandle = true } = options;
    
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: `
          MATCH (a)-[r]-(b) 
          WHERE id(r) = $relId AND (id(a) = $nodeId OR id(b) = $nodeId)
          WITH CASE 
            WHEN id(a) = $nodeId THEN b 
            ELSE a 
          END as otherNode
          RETURN otherNode
        `,
        params: { 
          relId: parseInt(this.id), 
          nodeId: parseInt(nodeId) 
        }
      });
      
      if (result.records.length === 0) {
        throw new Error(`No connected node found for relationship ${this.id} and node ${nodeId}`);
      }
      
      const otherNode = result.records[0].otherNode;
      return returnHandle 
        ? this.dataSource.createNodeHandle(otherNode.identity)
        : otherNode;
    } catch (error) {
      console.error(`[RelationshipHandle] Error getting other node for relationship ${this.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Check direction relative to a node
   */
  getDirection(nodeId) {
    this._refreshCache();
    if (!this._cache) {
      throw new Error(`Relationship with ID ${this.id} does not exist`);
    }
    
    const nodeIdStr = nodeId.toString();
    if (this._cache.start.toString() === nodeIdStr) {
      return 'outgoing';
    } else if (this._cache.end.toString() === nodeIdStr) {
      return 'incoming';
    } else {
      throw new Error(`Node ${nodeId} is not connected to relationship ${this.id}`);
    }
  }

  /**
   * Check if relationship connects two specific nodes
   */
  connects(nodeId1, nodeId2) {
    this._refreshCache();
    if (!this._cache) {
      return false;
    }
    
    const node1Str = nodeId1.toString();
    const node2Str = nodeId2.toString();
    const startStr = this._cache.start.toString();
    const endStr = this._cache.end.toString();
    
    return (startStr === node1Str && endStr === node2Str) ||
           (startStr === node2Str && endStr === node1Str);
  }

  /**
   * Check if relationship starts from a specific node
   */
  startsFrom(nodeId) {
    this._refreshCache();
    return this._cache?.start?.toString() === nodeId.toString();
  }

  /**
   * Check if relationship ends at a specific node
   */
  endsAt(nodeId) {
    this._refreshCache();
    return this._cache?.end?.toString() === nodeId.toString();
  }

  /**
   * Check if relationship involves a specific node (either start or end)
   */
  involves(nodeId) {
    return this.startsFrom(nodeId) || this.endsAt(nodeId);
  }

  /**
   * Reverse the relationship (create new relationship in opposite direction)
   */
  reverse(options = {}) {
    const { copyProperties = true, deleteOriginal = false } = options;
    
    this._refreshCache();
    if (!this._cache) {
      throw new Error(`Relationship with ID ${this.id} does not exist`);
    }
    
    const properties = copyProperties ? this._cache.properties : {};
    
    try {
      // Create reversed relationship
      const result = this.dataSource.query({
        type: 'cypher',
        query: `
          MATCH (a)-[r]->(b) 
          WHERE id(r) = $id 
          CREATE (b)-[newR:${this._cache.type} $props]->(a) 
          RETURN newR
        `,
        params: { 
          id: parseInt(this.id), 
          props: properties 
        }
      });
      
      if (result.records.length === 0) {
        throw new Error(`Failed to create reversed relationship for ${this.id}`);
      }
      
      const newRelationship = result.records[0].newR;
      
      // Delete original if requested
      if (deleteOriginal) {
        this.delete();
      }
      
      this._notifySubscribers('relationship_reversed', { 
        originalId: this.id,
        newId: newRelationship.identity?.toString(),
        deleteOriginal
      });
      
      return this.dataSource.createRelationshipHandle 
        ? this.dataSource.createRelationshipHandle(newRelationship.identity)
        : newRelationship;
    } catch (error) {
      console.error(`[RelationshipHandle] Error reversing relationship ${this.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Get parallel relationships (same start/end nodes, different types)
   */
  getParallelRelationships(options = {}) {
    const { includeThis = false, types = null, limit = null } = options;
    
    this._refreshCache();
    if (!this._cache) {
      throw new Error(`Relationship with ID ${this.id} does not exist`);
    }
    
    let query = `
      MATCH (a)-[r]->(b) 
      WHERE id(a) = $startId AND id(b) = $endId
    `;
    
    const params = {
      startId: parseInt(this._cache.start),
      endId: parseInt(this._cache.end)
    };
    
    if (!includeThis) {
      query += ` AND id(r) <> $thisId`;
      params.thisId = parseInt(this.id);
    }
    
    if (types) {
      const typeList = Array.isArray(types) ? types : [types];
      const typeConditions = typeList.map(type => `type(r) = '${type}'`).join(' OR ');
      query += ` AND (${typeConditions})`;
    }
    
    query += ` RETURN r`;
    
    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }
    
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: query,
        params: params
      });
      
      return result.records.map(record => {
        const rel = record.r;
        return this.dataSource.createRelationshipHandle 
          ? this.dataSource.createRelationshipHandle(rel.identity)
          : rel;
      });
    } catch (error) {
      console.error(`[RelationshipHandle] Error getting parallel relationships for ${this.id}:`, error.message);
      return [];
    }
  }

  /**
   * Delete this relationship
   */
  delete() {
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: 'MATCH ()-[r]-() WHERE id(r) = $id DELETE r RETURN count(r) as deleted',
        params: { id: parseInt(this.id) }
      });
      
      const deletedCount = result.records[0]?.deleted || 0;
      if (deletedCount === 0) {
        throw new Error(`Relationship with ID ${this.id} does not exist`);
      }
      
      this._invalidateCache();
      this._notifySubscribers('delete', { relationshipId: this.id });
      return true;
    } catch (error) {
      console.error(`[RelationshipHandle] Error deleting relationship ${this.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Subscribe to changes on this relationship
   */
  subscribe(callback, options = {}) {
    const { events = ['update', 'delete', 'relationship_reversed'] } = options;
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    const subscriptionId = ++this._subscriptionCounter;
    this._subscriptions.set(subscriptionId, { callback, events, options });
    
    // Return unsubscribe function
    return () => {
      this._subscriptions.delete(subscriptionId);
    };
  }

  /**
   * Refresh cached data
   */
  _refreshCache() {
    // Check if cache is valid and not expired
    if (this._cache && this._cacheTime && (Date.now() - this._cacheTime < this._cacheTTL)) {
      return this._cache;
    }
    
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: 'MATCH ()-[r]-() WHERE id(r) = $id RETURN r, startNode(r) as start, endNode(r) as end',
        params: { id: parseInt(this.id) }
      });
      
      if (result.records.length > 0) {
        const record = result.records[0];
        const relationship = record.r;
        this._cache = {
          type: relationship.type,
          properties: relationship.properties,
          start: record.start.identity,
          end: record.end.identity
        };
        this._cacheTime = Date.now();
      } else {
        // Relationship doesn't exist
        this._cache = null;
        this._cacheTime = null;
      }
    } catch (error) {
      console.warn(`[RelationshipHandle] Error refreshing cache for relationship ${this.id}:`, error.message);
      // Keep existing cache if refresh fails
    }
    
    return this._cache;
  }

  /**
   * Convert to plain object
   */
  toObject() {
    this._refreshCache();
    return {
      id: this.id,
      type: this.type,
      properties: this.properties,
      startNodeId: this.startNodeId,
      endNodeId: this.endNodeId
    };
  }

  /**
   * Invalidate cache
   */
  _invalidateCache() {
    this._cache = null;
    this._cacheTime = null;
  }

  /**
   * Notify subscribers of changes
   */
  _notifySubscribers(eventType, data = {}) {
    for (const [subscriptionId, subscription] of this._subscriptions) {
      const { callback, events } = subscription;
      
      if (events.includes(eventType)) {
        try {
          callback({
            type: eventType,
            relationshipId: this.id,
            timestamp: Date.now(),
            data
          });
        } catch (error) {
          console.warn(`[RelationshipHandle] Error in subscription callback for relationship ${this.id}:`, error.message);
        }
      }
    }
  }

  /**
   * Validate property names
   */
  _validatePropertyNames(names) {
    const invalidNames = [];
    const reservedWords = ['id', 'identity', 'type', 'start', 'end'];
    
    for (const name of names) {
      if (typeof name !== 'string' || name.length === 0) {
        invalidNames.push(`Invalid property name: ${name}`);
        continue;
      }
      
      if (reservedWords.includes(name.toLowerCase())) {
        invalidNames.push(`Reserved property name: ${name}`);
        continue;
      }
      
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
        invalidNames.push(`Invalid property name format: ${name}`);
        continue;
      }
    }
    
    if (invalidNames.length > 0) {
      throw new Error(`Invalid property names: ${invalidNames.join(', ')}`);
    }
  }
}