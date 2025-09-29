/**
 * SerializationEngine - Converts JavaScript objects to triple format
 * 
 * The engine handles:
 * - Simple primitive values
 * - Nested object references
 * - Circular references
 * - Special types (Date, RegExp, Map, Set, etc.)
 * - Arrays of primitives and objects
 */
export class SerializationEngine {
  constructor(identityManager) {
    if (!identityManager) {
      throw new Error('Identity manager is required');
    }
    
    this._identityManager = identityManager;
  }

  /**
   * Serialize an object to triples
   * @param {Object} obj - The object to serialize
   * @returns {Array} Array of triples [subject, predicate, object]
   */
  serialize(obj) {
    // Validate input
    if (obj === null || obj === undefined) {
      throw new Error('Can only serialize objects');
    }

    if (typeof obj !== 'object') {
      throw new Error('Can only serialize objects');
    }

    // Get object ID from identity manager
    const objectId = this._identityManager.getId(obj);
    if (objectId === undefined) {
      throw new Error('Object must be registered with identity manager before serialization');
    }

    const triples = [];
    const visited = new WeakSet();
    
    this._serializeObject(obj, objectId, triples, visited);
    
    return triples;
  }

  /**
   * Internal method to serialize an object's properties
   * @private
   */
  _serializeObject(obj, objectId, triples, visited) {
    // Prevent infinite recursion for circular references
    if (visited.has(obj)) {
      return;
    }
    visited.add(obj);

    // Iterate through all enumerable properties
    for (const [key, value] of Object.entries(obj)) {
      // Skip undefined values and functions
      if (value === undefined || typeof value === 'function') {
        continue;
      }

      // Handle different value types
      const serializedValue = this._serializeValue(value);
      triples.push([objectId, key, serializedValue]);
    }
  }

  /**
   * Serialize a value based on its type
   * @private
   */
  _serializeValue(value) {
    // Handle null
    if (value === null) {
      return null;
    }

    // Handle primitives
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    // Handle dates
    if (value instanceof Date) {
      return {
        _type: 'date',
        _value: value.toISOString()
      };
    }

    // Handle RegExp
    if (value instanceof RegExp) {
      return {
        _type: 'regexp',
        _value: value.toString()
      };
    }

    // Handle Maps
    if (value instanceof Map) {
      return {
        _type: 'map',
        _value: Array.from(value.entries())
      };
    }

    // Handle Sets
    if (value instanceof Set) {
      return {
        _type: 'set',
        _value: Array.from(value)
      };
    }

    // Handle Arrays
    if (Array.isArray(value)) {
      return {
        _type: 'array',
        _value: value.map(item => this._serializeValue(item))
      };
    }

    // Handle object references
    if (typeof value === 'object') {
      // Check if object is registered
      const valueId = this._identityManager.getId(value);
      if (valueId !== undefined) {
        // Return reference to the object
        return { _ref: valueId };
      } else {
        // Unregistered nested object - for MVP, we'll treat it as an inline object
        // In production, this might auto-register or throw an error
        return {
          _type: 'inline',
          _value: value
        };
      }
    }

    // Default case - return as is
    return value;
  }

  /**
   * Serialize multiple objects to triples
   * @param {Array<Object>} objects - Array of objects to serialize
   * @returns {Array} Combined array of all triples
   */
  serializeBatch(objects) {
    if (!Array.isArray(objects)) {
      throw new Error('serializeBatch requires an array');
    }

    const allTriples = [];
    
    for (const obj of objects) {
      const triples = this.serialize(obj);
      allTriples.push(...triples);
    }
    
    return allTriples;
  }

  /**
   * Convert triples to a format suitable for persistence
   * @param {Array} triples - Array of triples
   * @returns {Object} Persistence-ready format
   */
  toStorageFormat(triples) {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      tripleCount: triples.length,
      triples: triples
    };
  }
}