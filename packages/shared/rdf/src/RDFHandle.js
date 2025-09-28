/**
 * RDFHandle - Handle implementation for RDF resources
 * 
 * Extends the Handle base class to provide Handle interface over RDF resources.
 * Supports value retrieval, queries, subscriptions, and RDF-specific conveniences.
 * 
 * All operations are synchronous following the Handle pattern.
 * Fail-fast principle applies - operations throw immediately on error.
 */

import { Handle } from '@legion/handle';

export class RDFHandle extends Handle {
  constructor(dataSource, entityId) {
    super(dataSource);
    
    if (!entityId) {
      throw new Error('Entity ID is required');
    }
    
    if (typeof entityId !== 'string') {
      throw new Error('Entity ID must be a string');
    }
    
    this.entityId = entityId;
    this._valueCache = null;
  }
  
  /**
   * Get current entity value from RDF data
   * Returns entity as JavaScript object with properties from RDF triples
   * 
   * @returns {Object|null} Entity object or null if entity doesn't exist
   */
  value() {
    this._validateNotDestroyed();
    
    // Check cache first
    if (this._valueCache !== null) {
      return this._valueCache;
    }
    
    // Query for all triples where this entity is the subject
    const querySpec = {
      find: ['?p', '?o'],
      where: [[this.entityId, '?p', '?o']]
    };
    
    let results;
    try {
      results = this.dataSource.query(querySpec);
    } catch (error) {
      // Propagate DataSource query errors
      throw error;
    }
    
    // Filter out malformed results (missing required fields)
    // Results should have 'p' and 'o' properties (from find: ['?p', '?o'])
    const validResults = results.filter(result => {
      return result && 
             typeof result === 'object' && 
             result.hasOwnProperty('p') && 
             result.hasOwnProperty('o');
    });
    
    // If no valid results, entity doesn't exist
    if (validResults.length === 0) {
      this._valueCache = null;
      return null;
    }
    
    // Group results by property to handle multi-valued properties
    const propertyGroups = new Map();
    
    for (const result of validResults) {
      const property = result.p;
      const value = result.o;
      
      if (!propertyGroups.has(property)) {
        propertyGroups.set(property, []);
      }
      propertyGroups.get(property).push(value);
    }
    
    // Build entity object
    const entity = {};
    
    for (const [property, values] of propertyGroups) {
      if (values.length === 1) {
        // Single-valued property - store as scalar
        entity[property] = values[0];
      } else {
        // Multi-valued property - store as array
        entity[property] = values;
      }
    }
    
    // Cache the result
    this._valueCache = entity;
    
    return entity;
  }
  
  /**
   * Execute query with this RDF entity as context
   * Delegates to DataSource.query()
   * 
   * @param {Object} querySpec - Query specification object
   * @returns {Array} Query results
   */
  query(querySpec) {
    this._validateNotDestroyed();
    this._validateQuerySpec(querySpec);
    
    // Delegate to DataSource for actual query execution
    return this.dataSource.query(querySpec);
  }
  
  /**
   * Subscribe to changes for this RDF entity
   * Delegates to DataSource.subscribe()
   * 
   * @param {Object} querySpec - Query specification object  
   * @param {Function} callback - Callback function for changes
   * @returns {Object} Subscription object with unsubscribe() method
   */
  subscribe(querySpec, callback) {
    this._validateNotDestroyed();
    this._validateQuerySpec(querySpec);
    this._validateCallback(callback);
    
    // Invalidate cache when data changes
    const wrappedCallback = (changes) => {
      this._valueCache = null;
      callback(changes);
    };
    
    return super.subscribe(querySpec, wrappedCallback);
  }
  
  /**
   * Get the URI of this RDF entity
   * 
   * @returns {string} Entity URI
   */
  getURI() {
    this._validateNotDestroyed();
    return this.entityId;
  }
  
  /**
   * Get the type of this RDF entity
   * Looks for rdf:type or type property
   * 
   * @returns {string|null} Entity type or null if not found
   */
  getType() {
    this._validateNotDestroyed();
    
    const entity = this.value();
    if (!entity) {
      return null;
    }
    
    // Check for type property (could be 'type', 'rdf:type', etc.)
    return entity.type || entity['rdf:type'] || null;
  }
  
  /**
   * Get all properties of this RDF entity
   * 
   * @returns {Array} Array of property names
   */
  getProperties() {
    this._validateNotDestroyed();
    
    const entity = this.value();
    if (!entity) {
      return [];
    }
    
    return Object.keys(entity);
  }
  
  /**
   * Follow a link property to create a new RDFHandle for the target entity
   * 
   * @param {string} property - Property name to follow
   * @returns {RDFHandle|Array} RDFHandle for target entity or array of RDFHandles for multi-valued properties
   */
  followLink(property) {
    this._validateNotDestroyed();
    
    if (!property || typeof property !== 'string') {
      throw new Error('Property name must be a string');
    }
    
    const entity = this.value();
    if (!entity || !entity.hasOwnProperty(property)) {
      return null;
    }
    
    const propertyValue = entity[property];
    
    if (Array.isArray(propertyValue)) {
      // Multi-valued property - return array of RDFHandles
      return propertyValue.map(value => {
        if (typeof value === 'string' && this._isURI(value)) {
          return new RDFHandle(this.dataSource, value);
        }
        return value; // Return literal values as-is
      });
    } else {
      // Single-valued property
      if (typeof propertyValue === 'string' && this._isURI(propertyValue)) {
        return new RDFHandle(this.dataSource, propertyValue);
      }
      return propertyValue; // Return literal values as-is
    }
  }
  
  /**
   * Check if a value is a URI that should create a Handle
   * 
   * Only HTTP/HTTPS URLs and CURIE prefixes are treated as URIs for Handle creation.
   * Other URI schemes (mailto:, ftp:, etc.) are treated as literal values.
   * 
   * @private
   */
  _isURI(value) {
    // Check for HTTP/HTTPS URLs - these should create Handles
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return true;
    }
    
    // Check for CURIE format (prefix:localname)
    // Must have a colon but not be a URI scheme (like mailto:, ftp:, etc.)
    // CURIE prefixes are typically short (2-10 characters) before the colon
    if (value.includes(':') && !value.startsWith(':')) {
      const colonIndex = value.indexOf(':');
      const prefix = value.substring(0, colonIndex);
      
      // Exclude common URI schemes that should not create Handles
      const excludedSchemes = ['mailto', 'ftp', 'file', 'tel', 'sms', 'data', 'urn'];
      if (excludedSchemes.includes(prefix.toLowerCase())) {
        return false;
      }
      
      // Consider it a CURIE if prefix looks like a namespace prefix
      // (short, alphanumeric, no special characters except potentially underscore)
      if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(prefix) && prefix.length <= 10) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Clean up resources and invalidate cache
   */
  destroy() {
    this._valueCache = null;
    super.destroy();
  }
  
  /**
   * Override subscribe to invalidate cache on changes
   */
  _invalidateCache() {
    this._valueCache = null;
  }
}