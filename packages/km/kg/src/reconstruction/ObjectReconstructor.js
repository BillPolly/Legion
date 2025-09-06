/**
 * Reconstructs JavaScript objects from KG triples
 */
export class ObjectReconstructor {
  constructor(kgEngine, namespaceManager) {
    this.kg = kgEngine;
    this.ns = namespaceManager;
    this.objectCache = new Map();
    this.classCache = new Map();
  }

  /**
   * Reconstruct a JavaScript object from its ID
   */
  reconstructObject(objectId) {
    if (this.objectCache.has(objectId)) {
      return this.objectCache.get(objectId);
    }

    // Get object's type
    const typeTriples = this.kg.query(objectId, 'rdf:type', null);
    if (typeTriples.length === 0) {
      return null; // Return null for non-existent objects
    }

    const classId = typeTriples[0][2];
    const ClassDef = this.reconstructClass(classId);

    if (!ClassDef) {
      return null; // Return null if class can't be reconstructed
    }

    // Create instance
    const instance = Object.create(ClassDef.prototype);
    instance.setId(objectId);
    this.objectCache.set(objectId, instance);

    // Set properties
    const propertyTriples = this.kg.query(objectId, null, null)
      .filter(([, p]) => p !== 'rdf:type');

    // Group properties by name to handle arrays
    const propertyGroups = {};
    for (const [, predicate, value] of propertyTriples) {
      const propertyName = this._extractPropertyName(predicate);
      if (propertyName) {
        if (!propertyGroups[propertyName]) {
          propertyGroups[propertyName] = [];
        }
        propertyGroups[propertyName].push(value);
      }
    }

    // Set properties on instance
    for (const [propertyName, values] of Object.entries(propertyGroups)) {
      if (values.length === 1) {
        // Single value
        const value = values[0];
        if (this._isObjectReference(value)) {
          instance[propertyName] = this.reconstructObject(value);
        } else {
          instance[propertyName] = value;
        }
      } else {
        // Multiple values - create array
        instance[propertyName] = values.map(value => {
          if (this._isObjectReference(value)) {
            return this.reconstructObject(value);
          } else {
            return value;
          }
        });
      }
    }

    return instance;
  }

  /**
   * Reconstruct a JavaScript class from KG metadata
   */
  reconstructClass(classId) {
    if (this.classCache.has(classId)) {
      return this.classCache.get(classId);
    }

    // Handle built-in types
    if (classId === 'kg:Object') {
      const ObjectClass = class Object {};
      this.classCache.set(classId, ObjectClass);
      return ObjectClass;
    }

    // Get class name
    const classNameTriples = this.kg.query(classId, 'kg:className', null);
    if (classNameTriples.length === 0) {
      return null; // Return null instead of throwing for missing metadata
    }

    const className = classNameTriples[0][2];

    // Get constructor
    const constructorTriples = this.kg.query(null, 'kg:constructorOf', classId);
    let constructorBody = '';
    if (constructorTriples.length > 0) {
      const constructorId = constructorTriples[0][0];
      const bodyTriples = this.kg.query(constructorId, 'kg:methodBody', null);
      if (bodyTriples.length > 0) {
        constructorBody = bodyTriples[0][2];
      }
    }

    // Create class dynamically
    const ClassDef = {
      [className]: function(...args) {
        if (constructorBody) {
          // Execute constructor body (simplified - in production, use safer evaluation)
          try {
            const constructorFunc = new Function('return ' + constructorBody)();
            constructorFunc.apply(this, args);
          } catch (e) {
            // Fallback: set first argument as name property
            if (args.length > 0) {
              this.name = args[0];
            }
          }
        }
      }
    }[className];

    // Add methods
    const methodTriples = this.kg.query(null, 'kg:methodOf', classId);
    for (const [methodId] of methodTriples) {
      const methodName = this._getMethodName(methodId);
      const methodBody = this._getMethodBody(methodId);
      
      if (methodName && methodBody) {
        try {
          ClassDef.prototype[methodName] = new Function('return ' + methodBody)();
        } catch (e) {
          // Fallback for methods that can't be reconstructed
          ClassDef.prototype[methodName] = function() {
            throw new Error(`Method ${methodName} could not be reconstructed`);
          };
        }
      }
    }

    // Add static methods
    const staticMethodTriples = this.kg.query(null, 'kg:staticMethodOf', classId);
    for (const [methodId] of staticMethodTriples) {
      const methodName = this._getMethodName(methodId);
      const methodBody = this._getMethodBody(methodId);
      
      if (methodName && methodBody) {
        try {
          ClassDef[methodName] = new Function('return ' + methodBody)();
        } catch (e) {
          ClassDef[methodName] = function() {
            throw new Error(`Static method ${methodName} could not be reconstructed`);
          };
        }
      }
    }

    // Set the class ID
    ClassDef.setId = function(id) { this._kgId = id; };
    ClassDef.getId = function() { return this._kgId || classId; };
    ClassDef._kgId = classId;

    this.classCache.set(classId, ClassDef);
    return ClassDef;
  }

  /**
   * Reconstruct a method from KG metadata
   */
  reconstructMethod(methodId) {
    const methodBody = this._getMethodBody(methodId);
    if (!methodBody) {
      throw new Error(`No method body found for ${methodId}`);
    }

    try {
      return new Function('return ' + methodBody)();
    } catch (e) {
      throw new Error(`Failed to reconstruct method ${methodId}: ${e.message}`);
    }
  }

  /**
   * Reconstruct all objects of a given type
   */
  reconstructObjectsOfType(classId) {
    const instanceTriples = this.kg.query(null, 'rdf:type', classId);
    return instanceTriples.map(([objectId]) => this.reconstructObject(objectId));
  }

  /**
   * Clear the object and class caches
   */
  clearCache() {
    this.objectCache.clear();
    this.classCache.clear();
  }

  // Helper methods
  _extractPropertyName(predicate) {
    // Handle kg: namespace predicates directly
    if (predicate.startsWith('kg:')) {
      return predicate.substring(3); // Remove 'kg:' prefix
    }
    
    // Extract property name from predicate ID
    const match = predicate.match(/\.([^._]+)_[a-f0-9]+$/);
    return match ? match[1] : null;
  }

  _getMethodName(methodId) {
    const nameTriples = this.kg.query(methodId, 'kg:methodName', null);
    return nameTriples.length > 0 ? nameTriples[0][2] : null;
  }

  _getMethodBody(methodId) {
    const bodyTriples = this.kg.query(methodId, 'kg:methodBody', null);
    return bodyTriples.length > 0 ? bodyTriples[0][2] : null;
  }

  _isObjectReference(value) {
    // Simple heuristic: if it looks like an object ID, treat as reference
    return typeof value === 'string' && value.includes('_');
  }
}
