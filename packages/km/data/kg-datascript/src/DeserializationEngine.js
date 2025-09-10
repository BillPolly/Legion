/**
 * DeserializationEngine - Converts triples back to JavaScript objects
 * 
 * The engine handles:
 * - Simple primitive values
 * - Object reference resolution
 * - Circular reference reconstruction
 * - Special type restoration (Date, RegExp, Map, Set, etc.)
 * - Object graph rebuilding
 */
export class DeserializationEngine {
  constructor(identityManager) {
    if (!identityManager) {
      throw new Error('Identity manager is required');
    }
    
    this._identityManager = identityManager;
  }

  /**
   * Hydrate a single object from its triples
   * @param {Array} triples - Array of triples for this object
   * @param {number} objectId - The object ID to hydrate
   * @returns {Object} The hydrated object
   */
  hydrate(triples, objectId) {
    // Validate triples
    if (!Array.isArray(triples)) {
      throw new Error('Triples must be an array');
    }

    // Filter triples for this specific object
    const objectTriples = triples.filter(triple => {
      if (!Array.isArray(triple) || triple.length !== 3) {
        throw new Error('Each triple must be an array of exactly 3 elements');
      }
      return triple[0] === objectId;
    });

    // Create new object
    const obj = {};
    
    // Process each triple
    for (const [subject, predicate, value] of objectTriples) {
      // Check if value is a reference that can't be resolved
      if (this._isReference(value)) {
        // For single object hydration, we can't resolve references
        // Mark them as unresolved
        obj[predicate] = { _unresolved: value._ref };
      } else {
        obj[predicate] = this._hydrateValue(value);
      }
    }

    // Register the hydrated object
    this._identityManager.registerWithId(obj, objectId);
    
    return obj;
  }

  /**
   * Hydrate an entire object graph from triples
   * @param {Array} triples - Array of all triples
   * @returns {Object} Object containing the graph and metadata
   */
  hydrateGraph(triples) {
    // Validate triples
    if (!Array.isArray(triples)) {
      throw new Error('Triples must be an array');
    }

    // Group triples by object ID
    const triplesByObject = new Map();
    
    for (const triple of triples) {
      if (!Array.isArray(triple) || triple.length !== 3) {
        throw new Error('Each triple must be an array of exactly 3 elements');
      }
      
      const [objectId, predicate, value] = triple;
      
      if (!triplesByObject.has(objectId)) {
        triplesByObject.set(objectId, []);
      }
      
      triplesByObject.get(objectId).push(triple);
    }

    // First pass: Create all objects without references
    const objects = {};
    const pendingReferences = [];
    
    for (const [objectId, objectTriples] of triplesByObject) {
      const obj = {};
      
      for (const [subject, predicate, value] of objectTriples) {
        if (this._isReference(value)) {
          // Store reference for second pass
          pendingReferences.push({ obj, predicate, value });
        } else {
          obj[predicate] = this._hydrateValue(value, pendingReferences, obj, predicate);
        }
      }
      
      // Register and store
      this._identityManager.registerWithId(obj, objectId);
      objects[objectId] = obj;
    }

    // Second pass: Resolve all references
    for (const { obj, predicate, value, isArray } of pendingReferences) {
      if (isArray && value._arrayRef) {
        // Handle array with references
        const resolvedArray = value._arrayRef.map(item => {
          if (this._isReference(item)) {
            const referencedObject = objects[item._ref];
            return referencedObject || { _unresolved: item._ref };
          }
          return item;
        });
        obj[predicate] = resolvedArray;
      } else if (value._ref !== undefined) {
        const referencedObject = objects[value._ref];
        if (referencedObject) {
          obj[predicate] = referencedObject;
        } else {
          // Handle missing reference
          obj[predicate] = { _unresolved: value._ref };
        }
      }
    }

    // Build metadata
    const metadata = {
      objectCount: Object.keys(objects).length,
      tripleCount: triples.length,
      rootIds: Array.from(triplesByObject.keys())
    };

    return {
      objects,
      metadata
    };
  }

  /**
   * Hydrate a value based on its type
   * @private
   */
  _hydrateValue(value, pendingReferences = null, parentObj = null, parentPredicate = null) {
    // Handle null
    if (value === null) {
      return null;
    }

    // Handle primitives
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    // Handle special types
    if (typeof value === 'object' && value._type) {
      switch (value._type) {
        case 'date':
          return new Date(value._value);
          
        case 'regexp':
          try {
            // Parse the regex string (e.g., "/pattern/flags")
            const match = value._value.match(/^\/(.*)\/([gimuy]*)$/);
            if (match) {
              return new RegExp(match[1], match[2]);
            }
          } catch (e) {
            // If parsing fails, return as string
            return value._value;
          }
          return value._value;
          
        case 'map':
          return new Map(value._value);
          
        case 'set':
          return new Set(value._value);
          
        case 'array':
          // Check if array contains any references
          const hasReferences = value._value.some(item => this._isReference(item));
          
          if (hasReferences && pendingReferences && parentObj && parentPredicate) {
            // Store for later resolution
            pendingReferences.push({
              obj: parentObj,
              predicate: parentPredicate,
              value: { _arrayRef: value._value },
              isArray: true
            });
            // Return empty array placeholder that will be replaced
            return [];
          }
          
          // If no references, hydrate normally
          return value._value.map(item => this._hydrateValue(item));
          
        case 'inline':
          // Inline objects (shouldn't normally happen in proper serialization)
          return value._value;
          
        default:
          return value;
      }
    }

    // Handle references (these are resolved in a second pass)
    if (this._isReference(value)) {
      return value;
    }

    return value;
  }

  /**
   * Check if a value is a reference
   * @private
   */
  _isReference(value) {
    return typeof value === 'object' && 
           value !== null && 
           value._ref !== undefined;
  }

  /**
   * Load objects from storage format
   * @param {Object} storageData - Data in storage format
   * @returns {Object} Hydrated graph
   */
  loadFromStorage(storageData) {
    if (!storageData || !storageData.triples) {
      throw new Error('Invalid storage format');
    }

    return this.hydrateGraph(storageData.triples);
  }
}