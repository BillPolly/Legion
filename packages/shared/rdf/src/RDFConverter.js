/**
 * RDFConverter - Bidirectional conversion between Handle entities and RDF triples
 * 
 * Responsibilities:
 * - Convert Handle entities to RDF triples
 * - Convert RDF triples to Handle entities
 * - Preserve types during conversion
 * - Handle cardinality (one/many) correctly
 * - Apply namespace management for compact notation
 */

export class RDFConverter {
  /**
   * Create an RDFConverter
   * @param {NamespaceManager} namespaceManager - Namespace manager for URI expansion/contraction
   */
  constructor(namespaceManager) {
    if (!namespaceManager) {
      throw new Error('RDFConverter requires a NamespaceManager');
    }
    this.namespaceManager = namespaceManager;
  }

  /**
   * Convert a Handle entity to RDF triples
   * 
   * @param {Object} entity - Handle entity object with property/value pairs
   * @param {string} entityId - Full URI for the entity (e.g., 'http://example.org/alice')
   * @returns {Array<[subject, predicate, object]>} - Array of RDF triples
   * 
   * Entity format:
   * {
   *   'namespace/property': value,
   *   'namespace/property': [value1, value2], // Multi-valued
   *   'namespace/ref': 'http://example.org/other' // Entity reference
   * }
   * 
   * Triple format:
   * ['subject-curie', 'predicate-curie', value]
   * 
   * Examples:
   * - ['ex:alice', 'user:name', 'Alice Smith']
   * - ['ex:alice', 'user:age', 30]
   * - ['ex:alice', 'user:hobby', 'reading']
   * - ['ex:alice', 'user:knows', 'ex:bob']
   */
  entityToTriples(entity, entityId) {
    if (!entity || typeof entity !== 'object') {
      throw new Error('Entity must be an object');
    }
    
    if (!entityId || typeof entityId !== 'string') {
      throw new Error('Entity ID must be a non-empty string');
    }

    const triples = [];
    
    // Contract entity ID to CURIE for subject
    const subject = this.namespaceManager.contractUri(entityId);
    
    // Process each property in the entity
    for (const [property, value] of Object.entries(entity)) {
      // Skip internal properties
      if (property === ':db/id') {
        continue;
      }
      
      // Skip null and undefined values
      if (value === null || value === undefined) {
        continue;
      }
      
      // Convert property name to predicate
      const predicate = this._propertyToPredicate(property);
      
      // Handle array values (multi-valued properties)
      if (Array.isArray(value)) {
        // Skip empty arrays
        if (value.length === 0) {
          continue;
        }
        
        // Create a triple for each value
        for (const item of value) {
          const objectValue = this._convertValue(item);
          triples.push([subject, predicate, objectValue]);
        }
      } else {
        // Single-valued property
        const objectValue = this._convertValue(value);
        triples.push([subject, predicate, objectValue]);
      }
    }
    
    return triples;
  }

  /**
   * Convert property name to RDF predicate
   * Handles namespace/property format and converts to CURIE
   * 
   * @param {string} property - Property name (e.g., 'user/name', 'foaf/name')
   * @returns {string} - Predicate as CURIE (e.g., 'user:name', 'foaf:name')
   * @private
   */
  _propertyToPredicate(property) {
    // Check if already a full URI
    if (property.startsWith('http://') || property.startsWith('https://')) {
      // Try to contract to CURIE
      return this.namespaceManager.contractUri(property);
    }
    
    // Handle namespace/property format
    if (property.includes('/')) {
      // Convert slash to colon for CURIE format
      return property.replace('/', ':');
    }
    
    // Return as-is if no namespace separator
    return property;
  }

  /**
   * Convert JavaScript value to RDF-appropriate format
   * Preserves types and handles references
   * 
   * @param {any} value - JavaScript value
   * @returns {string|number|boolean} - RDF object value
   * @private
   */
  _convertValue(value) {
    // Handle different types
    if (typeof value === 'string') {
      // Check if it's a URI reference
      if (value.startsWith('http://') || value.startsWith('https://')) {
        // Contract URI to CURIE for references
        return this.namespaceManager.contractUri(value);
      }
      return value;
    }
    
    if (typeof value === 'number') {
      // Preserve numbers as-is (integers and decimals)
      return value;
    }
    
    if (typeof value === 'boolean') {
      // Preserve booleans as-is
      return value;
    }
    
    if (value instanceof Date) {
      // Convert Date to ISO string
      return value.toISOString();
    }
    
    // For other types, convert to string
    return String(value);
  }

  /**
   * Convert RDF triples to a Handle entity
   * 
   * @param {Array<[subject, predicate, object]>} triples - Array of RDF triples
   * @param {string} entityId - Full URI or CURIE for the entity to extract
   * @returns {Object} - Handle entity object with property/value pairs
   * 
   * Triple format:
   * ['subject-curie', 'predicate-curie', value]
   * 
   * Entity format:
   * {
   *   'namespace/property': value,
   *   'namespace/property': [value1, value2], // Multi-valued
   *   'namespace/ref': 'http://example.org/other' // Entity reference
   * }
   * 
   * Examples:
   * - ['ex:alice', 'user:name', 'Alice'] → { 'user/name': 'Alice' }
   * - ['ex:alice', 'user:hobby', 'reading'] → { 'user/hobby': ['reading', ...] }
   * - ['ex:alice', 'user:knows', 'ex:bob'] → { 'user/knows': 'http://example.org/bob' }
   */
  triplesToEntity(triples, entityId) {
    if (!Array.isArray(triples)) {
      throw new Error('Triples must be an array');
    }
    
    if (!entityId || typeof entityId !== 'string') {
      throw new Error('Entity ID must be a non-empty string');
    }

    // Normalize entity ID (could be full URI or CURIE)
    const normalizedEntityId = this._normalizeEntityId(entityId);
    
    // Group triples by predicate
    const propertyMap = new Map();
    
    for (const triple of triples) {
      // Skip invalid triples
      if (!Array.isArray(triple) || triple.length < 3) {
        continue;
      }
      
      const [subject, predicate, object] = triple;
      
      // Normalize subject for comparison
      const normalizedSubject = this._normalizeEntityId(subject);
      
      // Only process triples for this entity
      if (normalizedSubject !== normalizedEntityId) {
        continue;
      }
      
      // Convert predicate to property name
      const propertyName = this._predicateToProperty(predicate);
      
      // Convert RDF value to JavaScript value
      const value = this._convertFromRDF(object);
      
      // Group by property name
      if (!propertyMap.has(propertyName)) {
        propertyMap.set(propertyName, []);
      }
      propertyMap.get(propertyName).push(value);
    }
    
    // Build entity object
    const entity = {};
    
    for (const [propertyName, values] of propertyMap.entries()) {
      // Single-valued properties remain as single values
      // Multi-valued properties become arrays
      if (values.length === 1) {
        entity[propertyName] = values[0];
      } else {
        entity[propertyName] = values;
      }
    }
    
    return entity;
  }

  /**
   * Normalize entity ID for comparison
   * Handles both full URIs and CURIEs
   * 
   * @param {string} entityId - Entity ID (full URI or CURIE)
   * @returns {string} - Normalized entity ID
   * @private
   */
  _normalizeEntityId(entityId) {
    // If it's a CURIE, expand it to full URI
    if (entityId.includes(':') && !entityId.startsWith('http://') && !entityId.startsWith('https://')) {
      return this.namespaceManager.expandPrefix(entityId);
    }
    
    // Already a full URI
    return entityId;
  }

  /**
   * Convert RDF predicate to Handle property name
   * Handles CURIE format and converts to namespace/property
   * 
   * @param {string} predicate - Predicate as CURIE or full URI
   * @returns {string} - Property name in namespace/property format
   * @private
   */
  _predicateToProperty(predicate) {
    // If it's a CURIE (prefix:localName), convert to namespace/property
    if (predicate.includes(':') && !predicate.startsWith('http://') && !predicate.startsWith('https://')) {
      // Convert colon to slash for Handle property format
      return predicate.replace(':', '/');
    }
    
    // If it's a full URI, try to contract it first
    if (predicate.startsWith('http://') || predicate.startsWith('https://')) {
      const contracted = this.namespaceManager.contractUri(predicate);
      if (contracted !== predicate && contracted.includes(':')) {
        // Successfully contracted, convert to namespace/property format
        return contracted.replace(':', '/');
      }
      // Couldn't contract, return full URI as property name
      return predicate;
    }
    
    // Return as-is
    return predicate;
  }

  /**
   * Convert RDF value to JavaScript value
   * Handles type reconstruction and reference expansion
   * 
   * @param {any} value - RDF object value
   * @returns {any} - JavaScript value with appropriate type
   * @private
   */
  _convertFromRDF(value) {
    // Preserve primitives as-is
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'string') {
      // Check if it's an ISO date string FIRST (before CURIE check)
      // This prevents date strings with colons from being treated as CURIEs
      if (this._isISODateString(value)) {
        return new Date(value);
      }
      
      // Check if it's a CURIE reference
      if (value.includes(':') && !value.startsWith('http://') && !value.startsWith('https://')) {
        // Could be a CURIE or just a string with colon
        const expanded = this.namespaceManager.expandPrefix(value);
        // If expansion resulted in a URI, it's a reference
        if (expanded !== value && (expanded.startsWith('http://') || expanded.startsWith('https://'))) {
          return expanded;
        }
        // Otherwise, it's just a string value with colon
        return value;
      }
      
      // Regular string value
      return value;
    }
    
    // Return as-is for other types
    return value;
  }

  /**
   * Check if a string is an ISO date string
   * 
   * @param {string} str - String to check
   * @returns {boolean} - True if ISO date string
   * @private
   */
  _isISODateString(str) {
    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ssZ
    // Also validate it's a valid date
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (!isoDatePattern.test(str)) {
      return false;
    }
    
    // Additional validation: try to create Date and check if it's valid
    const date = new Date(str);
    return !isNaN(date.getTime());
  }
}