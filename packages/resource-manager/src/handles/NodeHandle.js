/**
 * NodeHandle - Handle for individual Neo4j nodes
 * 
 * Provides Handle-based interface for node operations with:
 * - Complete CRUD operations (Create, Read, Update, Delete)
 * - Property management with validation
 * - Label operations
 * - Relationship traversal and creation
 * - Caching with TTL
 */

export class NodeHandle {
  constructor(dataSource, nodeId, options = {}) {
    if (!dataSource) {
      throw new Error('DataSource is required for NodeHandle');
    }
    if (!nodeId) {
      throw new Error('Node ID is required for NodeHandle');
    }
    
    this.dataSource = dataSource;
    this.id = nodeId.toString();
    this._type = 'NodeHandle';
    this._cache = null;
    this._cacheTime = null;
    this._cacheTTL = options.cacheTTL || 30000; // 30 seconds default
    this._validator = options.validator || null;
    this._subscriptions = new Map();
    this._subscriptionCounter = 0;
  }

  /**
   * Get node data (properties, labels, etc.)
   */
  get() {
    this._refreshCache();
    if (!this._cache) {
      throw new Error(`Node with ID ${this.id} does not exist`);
    }
    return {
      id: this.id,
      labels: this._cache.labels || [],
      properties: this._cache.properties || {}
    };
  }

  /**
   * Get node properties
   */
  get properties() {
    this._refreshCache();
    return this._cache?.properties || {};
  }

  /**
   * Get node labels
   */
  get labels() {
    this._refreshCache();
    return this._cache?.labels || [];
  }

  /**
   * Check if node exists
   */
  exists() {
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: 'MATCH (n) WHERE id(n) = $id RETURN count(n) as count',
        params: { id: parseInt(this.id) }
      });
      return result.records[0].count > 0;
    } catch (error) {
      console.warn(`[NodeHandle] Error checking existence for node ${this.id}:`, error.message);
      return false;
    }
  }

  /**
   * Set node properties and data
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
      ? 'MATCH (n) WHERE id(n) = $id SET n += $props RETURN n'
      : 'MATCH (n) WHERE id(n) = $id SET n = $props RETURN n';
    
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: query,
        params: { id: parseInt(this.id), props: updates }
      });
      
      if (result.records.length === 0) {
        throw new Error(`Node with ID ${this.id} does not exist`);
      }
      
      this._invalidateCache();
      this._notifySubscribers('update', { properties: updates });
      return this;
    } catch (error) {
      console.error(`[NodeHandle] Error setting properties for node ${this.id}:`, error.message);
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
    
    const removeStatements = keys.map(key => `n.${key}`).join(', ');
    
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: `MATCH (n) WHERE id(n) = $id REMOVE ${removeStatements} RETURN n`,
        params: { id: parseInt(this.id) }
      });
      
      if (result.records.length === 0) {
        throw new Error(`Node with ID ${this.id} does not exist`);
      }
      
      this._invalidateCache();
      this._notifySubscribers('update', { removedProperties: keys });
      return this;
    } catch (error) {
      console.error(`[NodeHandle] Error removing properties for node ${this.id}:`, error.message);
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
   * Add labels to the node
   */
  addLabels(labels, options = {}) {
    if (!Array.isArray(labels)) {
      labels = [labels];
    }
    
    // Validate label names
    this._validateLabelNames(labels);
    
    const labelStatements = labels.map(label => `n:${label}`).join(', ');
    
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: `MATCH (n) WHERE id(n) = $id SET ${labelStatements} RETURN n`,
        params: { id: parseInt(this.id) }
      });
      
      if (result.records.length === 0) {
        throw new Error(`Node with ID ${this.id} does not exist`);
      }
      
      this._invalidateCache();
      this._notifySubscribers('update', { addedLabels: labels });
      return this;
    } catch (error) {
      console.error(`[NodeHandle] Error adding labels to node ${this.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Add a single label (alias for addLabels)
   */
  addLabel(label, options = {}) {
    return this.addLabels([label], options);
  }

  /**
   * Remove labels from the node
   */
  removeLabels(labels, options = {}) {
    if (!Array.isArray(labels)) {
      labels = [labels];
    }
    
    const labelStatements = labels.map(label => `n:${label}`).join(', ');
    
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: `MATCH (n) WHERE id(n) = $id REMOVE ${labelStatements} RETURN n`,
        params: { id: parseInt(this.id) }
      });
      
      if (result.records.length === 0) {
        throw new Error(`Node with ID ${this.id} does not exist`);
      }
      
      this._invalidateCache();
      this._notifySubscribers('update', { removedLabels: labels });
      return this;
    } catch (error) {
      console.error(`[NodeHandle] Error removing labels from node ${this.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Remove a single label (alias for removeLabels)
   */
  removeLabel(label, options = {}) {
    return this.removeLabels([label], options);
  }

  /**
   * Check if node has a specific label
   */
  hasLabel(label) {
    return this.labels.includes(label);
  }

  /**
   * Check if node has all specified labels
   */
  hasLabels(labels) {
    if (!Array.isArray(labels)) {
      labels = [labels];
    }
    return labels.every(label => this.hasLabel(label));
  }

  /**
   * Get relationships for this node
   */
  relationships(type = null, direction = 'both', options = {}) {
    const { limit = null, properties = null, includeNodes = false } = options;
    
    let pattern;
    switch (direction) {
      case 'incoming':
        pattern = `(n)<-[r${type ? ':' + type : ''}]-(other)`;
        break;
      case 'outgoing':
        pattern = `(n)-[r${type ? ':' + type : ''}]->(other)`;
        break;
      default:
        pattern = `(n)-[r${type ? ':' + type : ''}]-(other)`;
    }
    
    let query = `MATCH ${pattern} WHERE id(n) = $id`;
    const params = { id: parseInt(this.id) };
    
    // Add property filtering
    if (properties) {
      const propConditions = Object.entries(properties)
        .map(([key, value], index) => {
          params[`prop${index}`] = value;
          return `r.${key} = $prop${index}`;
        });
      if (propConditions.length > 0) {
        query += ` AND ${propConditions.join(' AND ')}`;
      }
    }
    
    query += includeNodes 
      ? ' RETURN r, other'
      : ' RETURN r';
    
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
        if (includeNodes) {
          rel._connectedNode = this.dataSource.createNodeHandle(record.other.identity);
        }
        return this.dataSource.createRelationshipHandle ? 
          this.dataSource.createRelationshipHandle(rel.identity) : rel;
      });
    } catch (error) {
      console.error(`[NodeHandle] Error getting relationships for node ${this.id}:`, error.message);
      return [];
    }
  }

  /**
   * Get neighbor nodes (connected nodes)
   */
  neighbors(relationshipType = null, direction = 'both', options = {}) {
    const { limit = null, nodeLabels = null, includeRelationships = false } = options;
    
    let pattern;
    switch (direction) {
      case 'incoming':
        pattern = `(n)<-[${relationshipType ? ':' + relationshipType : ''}]-(neighbor)`;
        break;
      case 'outgoing':
        pattern = `(n)-[${relationshipType ? ':' + relationshipType : ''}]->(neighbor)`;
        break;
      default:
        pattern = `(n)-[${relationshipType ? ':' + relationshipType : ''}]-(neighbor)`;
    }
    
    let query = `MATCH ${pattern} WHERE id(n) = $id`;
    const params = { id: parseInt(this.id) };
    
    // Add node label filtering
    if (nodeLabels) {
      const labels = Array.isArray(nodeLabels) ? nodeLabels : [nodeLabels];
      const labelConditions = labels.map(label => `neighbor:${label}`).join(' AND ');
      query += ` AND ${labelConditions}`;
    }
    
    query += includeRelationships 
      ? ' RETURN neighbor, r'
      : ' RETURN neighbor';
    
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
        const node = this.dataSource.createNodeHandle(record.neighbor.identity);
        if (includeRelationships) {
          node._relationship = record.r;
        }
        return node;
      });
    } catch (error) {
      console.error(`[NodeHandle] Error getting neighbors for node ${this.id}:`, error.message);
      return [];
    }
  }

  /**
   * Create relationship to another node
   */
  relateTo(targetNode, type, properties = {}, options = {}) {
    const { validate = true, returnHandle = false } = options;
    const targetId = (targetNode.id || targetNode).toString();
    
    // Validate relationship type
    if (!type || typeof type !== 'string') {
      throw new Error('Relationship type is required and must be a string');
    }
    
    // Validate properties
    if (validate && this._validator) {
      const validation = this._validator.validateParameters(properties);
      if (validation.errors.length > 0) {
        throw new Error(`Relationship property validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: `
          MATCH (a), (b) 
          WHERE id(a) = $sourceId AND id(b) = $targetId 
          CREATE (a)-[r:${type} $props]->(b) 
          RETURN r
        `,
        params: { 
          sourceId: parseInt(this.id), 
          targetId: parseInt(targetId),
          props: properties 
        }
      });
      
      if (result.records.length === 0) {
        throw new Error(`Could not create relationship between nodes ${this.id} and ${targetId}`);
      }
      
      const relationship = result.records[0].r;
      this._notifySubscribers('relationship_created', { 
        type, 
        targetId, 
        properties,
        relationshipId: relationship.identity?.toString()
      });
      
      return returnHandle && this.dataSource.createRelationshipHandle 
        ? this.dataSource.createRelationshipHandle(relationship.identity)
        : relationship;
    } catch (error) {
      console.error(`[NodeHandle] Error creating relationship for node ${this.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Create relationship to another node (alias for relateTo)
   */
  createRelationshipTo(targetNode, type, properties = {}, options = {}) {
    return this.relateTo(targetNode, type, properties, options);
  }

  /**
   * Delete this node
   */
  delete() {
    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: 'MATCH (n) WHERE id(n) = $id DETACH DELETE n RETURN count(n) as deleted',
        params: { id: parseInt(this.id) }
      });
      
      const deletedCount = result.records[0]?.deleted || 0;
      if (deletedCount === 0) {
        throw new Error(`Node with ID ${this.id} does not exist`);
      }
      
      this._invalidateCache();
      this._notifySubscribers('delete', { nodeId: this.id });
      return true;
    } catch (error) {
      console.error(`[NodeHandle] Error deleting node ${this.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Subscribe to changes on this node
   */
  subscribe(callback, options = {}) {
    const { events = ['update', 'delete', 'relationship_created'] } = options;
    
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
        query: 'MATCH (n) WHERE id(n) = $id RETURN n',
        params: { id: parseInt(this.id) }
      });
      
      if (result.records.length > 0) {
        const node = result.records[0].n;
        this._cache = {
          labels: node.labels,
          properties: node.properties
        };
        this._cacheTime = Date.now();
      } else {
        // Node doesn't exist
        this._cache = null;
        this._cacheTime = null;
      }
    } catch (error) {
      console.warn(`[NodeHandle] Error refreshing cache for node ${this.id}:`, error.message);
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
      labels: this.labels,
      properties: this.properties
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
            nodeId: this.id,
            timestamp: Date.now(),
            data
          });
        } catch (error) {
          console.warn(`[NodeHandle] Error in subscription callback for node ${this.id}:`, error.message);
        }
      }
    }
  }

  /**
   * Validate property names
   */
  _validatePropertyNames(names) {
    const invalidNames = [];
    const reservedWords = ['id', 'identity', 'labels', 'type'];
    
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

  /**
   * Validate label names
   */
  _validateLabelNames(names) {
    const invalidNames = [];
    
    for (const name of names) {
      if (typeof name !== 'string' || name.length === 0) {
        invalidNames.push(`Invalid label name: ${name}`);
        continue;
      }
      
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
        invalidNames.push(`Invalid label name format: ${name}`);
        continue;
      }
    }
    
    if (invalidNames.length > 0) {
      throw new Error(`Invalid label names: ${invalidNames.join(', ')}`);
    }
  }
}