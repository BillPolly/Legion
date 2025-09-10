/**
 * KGClassicOperations - Classic KG API operations for compatibility
 * 
 * This class provides the classic triple-based operations that work
 * with the live object system. It bridges the gap between traditional
 * KG triple operations and the object-oriented DataScript approach.
 */
export class KGClassicOperations {
  constructor(identityManager, serializer) {
    if (!identityManager) {
      throw new Error('ObjectIdentityManager is required');
    }
    if (!serializer) {
      throw new Error('SerializationEngine is required');
    }
    
    this.identityManager = identityManager;
    this.serializer = serializer;
    
    // Internal triple store for classic operations
    // Note: This is for serialization only, not the source of truth
    this._triples = [];
  }

  /**
   * Add a triple for an object
   * @param {Object} subject - The subject object
   * @param {string} predicate - The property name
   * @param {any} value - The value (can be primitive or object reference)
   * @returns {Object} Result with success flag and triple
   */
  addTriple(subject, predicate, value) {
    // Validate subject is registered
    const subjectId = this.identityManager.getId(subject);
    if (!subjectId) {
      throw new Error('Object must be registered before adding triples');
    }

    // Handle object references
    let tripleValue = value;
    if (typeof value === 'object' && value !== null) {
      const valueId = this.identityManager.getId(value);
      if (valueId) {
        // It's a registered object, store as reference
        tripleValue = { _ref: valueId };
      } else if (value instanceof Date) {
        tripleValue = { _type: 'date', _value: value.toISOString() };
      } else if (value instanceof RegExp) {
        tripleValue = { _type: 'regexp', _value: value.toString() };
      } else if (value instanceof Set) {
        tripleValue = { _type: 'set', _value: Array.from(value) };
      } else if (value instanceof Map) {
        tripleValue = { _type: 'map', _value: Array.from(value.entries()) };
      }
      // Otherwise store as is (nested unregistered object)
    }

    const triple = [subjectId, predicate, tripleValue];
    this._triples.push(triple);

    return {
      success: true,
      triple: triple
    };
  }

  /**
   * Remove a triple
   * @param {Object} subject - The subject object
   * @param {string} predicate - The property name
   * @param {any} value - The value to remove
   * @returns {Object} Result with success flag and removed flag
   */
  removeTriple(subject, predicate, value) {
    // Validate subject is registered
    const subjectId = this.identityManager.getId(subject);
    if (!subjectId) {
      throw new Error('Object must be registered before removing triples');
    }

    // Find and remove the triple
    const initialLength = this._triples.length;
    
    // Handle object references for comparison
    let compareValue = value;
    if (typeof value === 'object' && value !== null) {
      const valueId = this.identityManager.getId(value);
      if (valueId) {
        compareValue = { _ref: valueId };
      } else if (value instanceof Date) {
        compareValue = { _type: 'date', _value: value.toISOString() };
      } else if (value instanceof RegExp) {
        compareValue = { _type: 'regexp', _value: value.toString() };
      } else if (value instanceof Set) {
        compareValue = { _type: 'set', _value: Array.from(value) };
      } else if (value instanceof Map) {
        compareValue = { _type: 'map', _value: Array.from(value.entries()) };
      }
    }

    this._triples = this._triples.filter(triple => {
      if (triple[0] !== subjectId || triple[1] !== predicate) {
        return true; // Keep non-matching triples
      }
      
      // Check if values match
      return !this._valuesEqual(triple[2], compareValue);
    });

    const removedCount = initialLength - this._triples.length;

    return {
      success: true,
      removed: removedCount > 0,
      removedCount: removedCount
    };
  }

  /**
   * Query triples by pattern
   * @param {Object} pattern - Query pattern {subject?, predicate?, object?}
   * @returns {Array} Matching triples
   */
  queryPattern(pattern = {}) {
    const results = [];
    
    for (const triple of this._triples) {
      let matches = true;

      // Check subject constraint
      if (pattern.subject !== undefined) {
        const subjectId = this.identityManager.getId(pattern.subject);
        if (triple[0] !== subjectId) {
          matches = false;
        }
      }

      // Check predicate constraint
      if (matches && pattern.predicate !== undefined) {
        if (triple[1] !== pattern.predicate) {
          matches = false;
        }
      }

      // Check object constraint
      if (matches && pattern.object !== undefined) {
        const objectId = this.identityManager.getId(pattern.object);
        if (objectId) {
          // Pattern object is a registered object
          if (!this._valuesEqual(triple[2], { _ref: objectId })) {
            matches = false;
          }
        } else {
          // Pattern object is a primitive value
          if (!this._valuesEqual(triple[2], pattern.object)) {
            matches = false;
          }
        }
      }

      if (matches) {
        results.push(triple);
      }
    }

    return results;
  }

  /**
   * Add multiple triples in batch
   * @param {Array} triplesToAdd - Array of {subject, predicate, object}
   * @returns {Array} Results for each triple
   */
  addTripleBatch(triplesToAdd) {
    const results = [];
    
    for (const tripleSpec of triplesToAdd) {
      try {
        const result = this.addTriple(
          tripleSpec.subject,
          tripleSpec.predicate,
          tripleSpec.object
        );
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Remove multiple triples in batch
   * @param {Array} triplesToRemove - Array of {subject, predicate, object}
   * @returns {Array} Results for each triple
   */
  removeTripleBatch(triplesToRemove) {
    const results = [];
    
    for (const tripleSpec of triplesToRemove) {
      try {
        const result = this.removeTriple(
          tripleSpec.subject,
          tripleSpec.predicate,
          tripleSpec.object
        );
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Convert an object to triples using the serializer
   * @param {Object} obj - The object to serialize
   * @returns {Array} Array of triples
   */
  objectToTriples(obj) {
    // Use the serializer to convert object to triples
    return this.serializer.serialize(obj);
  }

  /**
   * Get all triples
   * @returns {Array} All triples in the store
   */
  getTriples() {
    return [...this._triples]; // Return copy
  }

  /**
   * Clear all triples
   */
  clearTriples() {
    this._triples = [];
  }

  /**
   * Get triple count
   * @returns {number} Number of triples
   */
  getTripleCount() {
    return this._triples.length;
  }

  /**
   * Check if a triple exists
   * @param {Object} subject - The subject object
   * @param {string} predicate - The property name
   * @param {any} value - The value
   * @returns {boolean} True if triple exists
   */
  hasTriple(subject, predicate, value) {
    const subjectId = this.identityManager.getId(subject);
    if (!subjectId) {
      return false;
    }

    // Handle object references for comparison
    let compareValue = value;
    if (typeof value === 'object' && value !== null) {
      const valueId = this.identityManager.getId(value);
      if (valueId) {
        compareValue = { _ref: valueId };
      } else if (value instanceof Date) {
        compareValue = { _type: 'date', _value: value.toISOString() };
      } else if (value instanceof RegExp) {
        compareValue = { _type: 'regexp', _value: value.toString() };
      } else if (value instanceof Set) {
        compareValue = { _type: 'set', _value: Array.from(value) };
      } else if (value instanceof Map) {
        compareValue = { _type: 'map', _value: Array.from(value.entries()) };
      }
    }

    return this._triples.some(triple => {
      return triple[0] === subjectId &&
             triple[1] === predicate &&
             this._valuesEqual(triple[2], compareValue);
    });
  }

  /**
   * Export triples in a portable format
   * @returns {Object} Export data with version and triples
   */
  exportTriples() {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      tripleCount: this._triples.length,
      triples: [...this._triples]
    };
  }

  /**
   * Import triples from exported format
   * @param {Object} data - Exported data
   */
  importTriples(data) {
    if (!data || !data.triples) {
      throw new Error('Invalid import data: missing triples');
    }

    // Clear existing and set new triples
    this._triples = [...data.triples];
  }

  /**
   * Compare two values for equality
   * @private
   */
  _valuesEqual(val1, val2) {
    // Handle primitives
    if (val1 === val2) {
      return true;
    }

    // Handle null/undefined
    if (val1 == null || val2 == null) {
      return val1 === val2;
    }

    // Handle object references
    if (val1._ref !== undefined && val2._ref !== undefined) {
      return val1._ref === val2._ref;
    }

    // Handle special types
    if (val1._type && val2._type) {
      return val1._type === val2._type &&
             JSON.stringify(val1._value) === JSON.stringify(val2._value);
    }

    // Default to JSON comparison for complex objects
    try {
      return JSON.stringify(val1) === JSON.stringify(val2);
    } catch {
      return false;
    }
  }
}