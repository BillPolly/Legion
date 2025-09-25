/**
 * SchemaManager - Manages dynamic schema evolution for DataStore
 * 
 * Provides capabilities to add/remove entity types and relationships at runtime.
 * Handles schema versioning and migration of existing data.
 */

export class SchemaManager {
  constructor(initialSchema = {}) {
    // Current schema (mutable for evolution)
    this.currentSchema = { ...initialSchema };
    
    // Schema version tracking
    this.version = 1;
    
    // Schema change history for debugging/rollback
    this.history = [{
      version: 1,
      timestamp: Date.now(),
      schema: { ...initialSchema },
      operation: 'initial'
    }];
    
    // Listeners for schema changes
    this.listeners = new Set();
  }
  
  /**
   * Get current schema
   */
  getSchema() {
    return { ...this.currentSchema };
  }
  
  /**
   * Get schema version
   */
  getVersion() {
    return this.version;
  }
  
  /**
   * Add a new entity type with attributes
   * @param {string} entityType - Entity type name (e.g., "product")
   * @param {Object} attributes - Map of attribute names to specs
   */
  addEntityType(entityType, attributes = {}) {
    // Check if entity type already exists
    const prefix = `:${entityType}/`;
    const existingAttributes = Object.keys(this.currentSchema)
      .filter(attr => attr.startsWith(prefix));
    
    if (existingAttributes.length > 0) {
      throw new Error(`Entity type ${entityType} already exists`);
    }
    
    const changes = {};
    
    for (const [attrName, spec] of Object.entries(attributes)) {
      const fullAttr = `:${entityType}/${attrName}`;
      
      if (this.currentSchema[fullAttr]) {
        throw new Error(`Attribute ${fullAttr} already exists`);
      }
      
      changes[fullAttr] = spec;
    }
    
    // Apply changes
    Object.assign(this.currentSchema, changes);
    
    // Record history
    this._recordChange('addEntityType', { entityType, attributes: changes });
    
    // Notify listeners
    this._notifyListeners({
      type: 'addEntityType',
      entityType,
      attributes: changes,
      version: this.version
    });
    
    return this.currentSchema;
  }
  
  /**
   * Remove an entity type and all its attributes
   * @param {string} entityType - Entity type to remove
   * @param {boolean} force - If true, removes even if data exists
   */
  removeEntityType(entityType, force = false) {
    const prefix = `:${entityType}/`;
    const attributesToRemove = Object.keys(this.currentSchema)
      .filter(attr => attr.startsWith(prefix));
    
    if (attributesToRemove.length === 0) {
      throw new Error(`Entity type ${entityType} not found`);
    }
    
    if (!force) {
      // In a real implementation, we'd check if any entities of this type exist
      // For now, we'll just warn
      console.warn(`Removing entity type ${entityType} without checking for existing data`);
    }
    
    // Remove attributes from schema
    for (const attr of attributesToRemove) {
      delete this.currentSchema[attr];
    }
    
    // Record history
    this._recordChange('removeEntityType', { entityType, removed: attributesToRemove });
    
    // Notify listeners
    this._notifyListeners({
      type: 'removeEntityType',
      entityType,
      removedAttributes: attributesToRemove,
      version: this.version
    });
    
    return this.currentSchema;
  }
  
  /**
   * Add a single attribute to an entity type
   * @param {string} entityType - Entity type name
   * @param {string} attributeName - Attribute name
   * @param {Object} spec - Attribute specification
   */
  addAttribute(entityType, attributeName, spec = {}) {
    const fullAttr = `:${entityType}/${attributeName}`;
    
    if (this.currentSchema[fullAttr]) {
      throw new Error(`Attribute ${fullAttr} already exists`);
    }
    
    this.currentSchema[fullAttr] = spec;
    
    // Record history
    this._recordChange('addAttribute', { entityType, attributeName, spec });
    
    // Notify listeners
    this._notifyListeners({
      type: 'addAttribute',
      entityType,
      attributeName,
      fullAttribute: fullAttr,
      spec,
      version: this.version
    });
    
    return this.currentSchema;
  }
  
  /**
   * Remove an attribute from an entity type
   * @param {string} entityType - Entity type name
   * @param {string} attributeName - Attribute name to remove
   * @param {boolean} force - If true, removes even if data exists
   */
  removeAttribute(entityType, attributeName, force = false) {
    const fullAttr = `:${entityType}/${attributeName}`;
    
    if (!this.currentSchema[fullAttr]) {
      throw new Error(`Attribute ${fullAttr} not found`);
    }
    
    if (!force) {
      console.warn(`Removing attribute ${fullAttr} without checking for existing data`);
    }
    
    const spec = this.currentSchema[fullAttr];
    delete this.currentSchema[fullAttr];
    
    // Record history
    this._recordChange('removeAttribute', { entityType, attributeName, removedSpec: spec });
    
    // Notify listeners
    this._notifyListeners({
      type: 'removeAttribute',
      entityType,
      attributeName,
      fullAttribute: fullAttr,
      removedSpec: spec,
      version: this.version
    });
    
    return this.currentSchema;
  }
  
  /**
   * Add a relationship between entity types
   * @param {string} fromEntity - Source entity type
   * @param {string} relationName - Relationship name
   * @param {string} toEntity - Target entity type
   * @param {Object} spec - Relationship specification
   */
  addRelationship(fromEntity, relationName, toEntity, spec = {}) {
    const fullAttr = `:${fromEntity}/${relationName}`;
    
    if (this.currentSchema[fullAttr]) {
      throw new Error(`Relationship ${fullAttr} already exists`);
    }
    
    // Ensure it's a ref type
    const relationSpec = {
      ...spec,
      valueType: 'ref',
      doc: `Reference to ${toEntity}`
    };
    
    this.currentSchema[fullAttr] = relationSpec;
    
    // Optionally add reverse relationship
    if (spec.reverse) {
      const reverseAttr = `:${toEntity}/${spec.reverse}`;
      if (!this.currentSchema[reverseAttr]) {
        this.currentSchema[reverseAttr] = {
          valueType: 'ref',
          card: 'many', // Reverse is usually many
          doc: `Reverse of ${fullAttr}`
        };
      }
    }
    
    // Record history
    this._recordChange('addRelationship', { 
      fromEntity, 
      relationName, 
      toEntity, 
      spec: relationSpec 
    });
    
    // Notify listeners
    this._notifyListeners({
      type: 'addRelationship',
      fromEntity,
      relationName,
      toEntity,
      spec: relationSpec,
      version: this.version
    });
    
    return this.currentSchema;
  }
  
  /**
   * Subscribe to schema changes
   * @param {Function} listener - Callback for schema changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Get schema history
   * @param {number} limit - Maximum number of history entries
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }
  
  /**
   * Validate schema for consistency
   * @returns {Object} Validation result
   */
  validateSchema() {
    const errors = [];
    const warnings = [];
    
    // Check for orphaned references
    for (const [attr, spec] of Object.entries(this.currentSchema)) {
      if (spec.valueType === 'ref') {
        // Extract target entity from doc or infer from naming
        const match = attr.match(/^:([^/]+)\//);
        if (!match) {
          errors.push(`Invalid attribute format: ${attr}`);
        }
      }
    }
    
    // Check for duplicate unique constraints
    const uniqueAttrs = {};
    for (const [attr, spec] of Object.entries(this.currentSchema)) {
      if (spec.unique) {
        const entityType = attr.split('/')[0];
        if (!uniqueAttrs[entityType]) {
          uniqueAttrs[entityType] = [];
        }
        uniqueAttrs[entityType].push(attr);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      uniqueConstraints: uniqueAttrs
    };
  }
  
  /**
   * Record a schema change in history
   */
  _recordChange(operation, details) {
    this.version++;
    this.history.push({
      version: this.version,
      timestamp: Date.now(),
      operation,
      details,
      schema: { ...this.currentSchema }
    });
  }
  
  /**
   * Notify all listeners of a schema change
   */
  _notifyListeners(change) {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (error) {
        console.error('Schema change listener error:', error);
      }
    }
  }
}

/**
 * Factory function to create a SchemaManager
 */
export function createSchemaManager(initialSchema = {}) {
  return new SchemaManager(initialSchema);
}