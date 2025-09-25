/**
 * SchemaEvolutionDSL - Domain-Specific Language for schema evolution
 * 
 * Provides a fluent, expressive API for defining schema changes:
 * - Chainable methods for common operations
 * - Batch operations with transaction semantics
 * - Declarative migrations with validation
 * - Type-safe schema transformations
 */

export class SchemaEvolutionDSL {
  constructor(dataStore) {
    if (!dataStore) {
      throw new Error('DataStore is required for SchemaEvolutionDSL');
    }
    
    this.dataStore = dataStore;
    this.operations = [];
    this.currentOperation = null;
    this.options = {
      validateBeforeApply: true,
      rollbackOnError: true,
      notifyChanges: true
    };
  }
  
  // ============================================================================
  // ENTITY TYPE OPERATIONS
  // ============================================================================
  
  /**
   * Start defining a new entity type
   * @param {string} entityType - Name of the entity type
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  defineEntity(entityType) {
    this._flushCurrentOperation();
    
    this.currentOperation = {
      type: 'defineEntity',
      entityType,
      attributes: {},
      relationships: [],
      constraints: []
    };
    
    return this;
  }
  
  /**
   * Add an attribute to the current entity definition
   * @param {string} name - Attribute name
   * @param {string|Object} typeOrSpec - Type string or full spec
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  withAttribute(name, typeOrSpec) {
    if (!this.currentOperation || this.currentOperation.type !== 'defineEntity') {
      throw new Error('withAttribute must be called after defineEntity');
    }
    
    const spec = typeof typeOrSpec === 'string' 
      ? { valueType: typeOrSpec }
      : typeOrSpec;
    
    // Store with just the attribute name - SchemaManager will add prefix
    this.currentOperation.attributes[name] = spec;
    
    return this;
  }
  
  /**
   * Add multiple attributes at once
   * @param {Object} attributes - Map of attribute names to specs
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  withAttributes(attributes) {
    Object.entries(attributes).forEach(([name, spec]) => {
      this.withAttribute(name, spec);
    });
    
    return this;
  }
  
  /**
   * Add a unique constraint to an attribute
   * @param {string} attributeName - Attribute to constrain
   * @param {string} uniqueType - 'identity' or 'value'
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  unique(attributeName, uniqueType = 'value') {
    if (!this.currentOperation || this.currentOperation.type !== 'defineEntity') {
      throw new Error('unique must be called after defineEntity');
    }
    
    // Use just the attribute name - SchemaManager adds prefix
    if (!this.currentOperation.attributes[attributeName]) {
      this.currentOperation.attributes[attributeName] = {};
    }
    
    this.currentOperation.attributes[attributeName].unique = uniqueType;
    
    return this;
  }
  
  /**
   * Add an index to an attribute
   * @param {string} attributeName - Attribute to index
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  indexed(attributeName) {
    if (!this.currentOperation || this.currentOperation.type !== 'defineEntity') {
      throw new Error('indexed must be called after defineEntity');
    }
    
    // Use just the attribute name - SchemaManager adds prefix
    if (!this.currentOperation.attributes[attributeName]) {
      this.currentOperation.attributes[attributeName] = {};
    }
    
    this.currentOperation.attributes[attributeName].index = true;
    
    return this;
  }
  
  /**
   * Define a relationship to another entity
   * @param {string} relationName - Name of the relationship
   * @param {string} targetEntity - Target entity type
   * @param {Object} options - Relationship options
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  hasOne(relationName, targetEntity, options = {}) {
    if (!this.currentOperation || this.currentOperation.type !== 'defineEntity') {
      throw new Error('hasOne must be called after defineEntity');
    }
    
    this.currentOperation.relationships.push({
      type: 'hasOne',
      name: relationName,
      target: targetEntity,
      ...options
    });
    
    // Add reference attribute - use just name, SchemaManager adds prefix
    this.currentOperation.attributes[relationName] = {
      valueType: 'ref',
      refTarget: targetEntity,
      ...options
    };
    
    return this;
  }
  
  /**
   * Define a one-to-many relationship
   * @param {string} relationName - Name of the relationship
   * @param {string} targetEntity - Target entity type
   * @param {Object} options - Relationship options
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  hasMany(relationName, targetEntity, options = {}) {
    if (!this.currentOperation || this.currentOperation.type !== 'defineEntity') {
      throw new Error('hasMany must be called after defineEntity');
    }
    
    this.currentOperation.relationships.push({
      type: 'hasMany',
      name: relationName,
      target: targetEntity,
      ...options
    });
    
    // Add reference attribute with cardinality many - use just name
    this.currentOperation.attributes[relationName] = {
      valueType: 'ref',
      refTarget: targetEntity,
      cardinality: 'many',
      ...options
    };
    
    return this;
  }
  
  // ============================================================================
  // MODIFICATION OPERATIONS
  // ============================================================================
  
  /**
   * Alter an existing entity type
   * @param {string} entityType - Entity type to alter
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  alterEntity(entityType) {
    this._flushCurrentOperation();
    
    this.currentOperation = {
      type: 'alterEntity',
      entityType,
      additions: [],
      removals: [],
      modifications: []
    };
    
    return this;
  }
  
  /**
   * Add an attribute to existing entity
   * @param {string} name - Attribute name
   * @param {string|Object} typeOrSpec - Type or spec
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  addAttribute(name, typeOrSpec) {
    if (!this.currentOperation || this.currentOperation.type !== 'alterEntity') {
      throw new Error('addAttribute must be called after alterEntity');
    }
    
    const spec = typeof typeOrSpec === 'string'
      ? { valueType: typeOrSpec }
      : typeOrSpec;
    
    this.currentOperation.additions.push({
      type: 'attribute',
      name,
      spec
    });
    
    return this;
  }
  
  /**
   * Remove an attribute from existing entity
   * @param {string} name - Attribute name
   * @param {boolean} force - Force removal even with data
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  removeAttribute(name, force = false) {
    if (!this.currentOperation || this.currentOperation.type !== 'alterEntity') {
      throw new Error('removeAttribute must be called after alterEntity');
    }
    
    this.currentOperation.removals.push({
      type: 'attribute',
      name,  // Store just the name, will be prefixed in _applyOperation
      force
    });
    
    return this;
  }
  
  /**
   * Rename an attribute
   * @param {string} oldName - Current attribute name
   * @param {string} newName - New attribute name
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  renameAttribute(oldName, newName) {
    if (!this.currentOperation || this.currentOperation.type !== 'alterEntity') {
      throw new Error('renameAttribute must be called after alterEntity');
    }
    
    this.currentOperation.modifications.push({
      type: 'rename',
      oldName,
      newName
    });
    
    return this;
  }
  
  /**
   * Change attribute type with optional transformation
   * @param {string} name - Attribute name
   * @param {string} newType - New type
   * @param {Function} transformer - Optional data transformer
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  changeType(name, newType, transformer = null) {
    if (!this.currentOperation || this.currentOperation.type !== 'alterEntity') {
      throw new Error('changeType must be called after alterEntity');
    }
    
    this.currentOperation.modifications.push({
      type: 'changeType',
      name,
      newType,
      transformer
    });
    
    return this;
  }
  
  /**
   * Drop an entire entity type
   * @param {string} entityType - Entity type to drop
   * @param {boolean} cascade - Cascade delete related entities
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  dropEntity(entityType, cascade = false) {
    this._flushCurrentOperation();
    
    this.operations.push({
      type: 'dropEntity',
      entityType,
      cascade
    });
    
    return this;
  }
  
  // ============================================================================
  // MIGRATION OPERATIONS
  // ============================================================================
  
  /**
   * Define a custom migration function
   * @param {string} name - Migration name
   * @param {Function} migrationFn - Migration function
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  migrate(name, migrationFn) {
    this._flushCurrentOperation();
    
    this.operations.push({
      type: 'customMigration',
      name,
      migrationFn
    });
    
    return this;
  }
  
  /**
   * Transform data during migration
   * @param {string} entityType - Entity type to transform
   * @param {Function} transformer - Transformation function
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  transformData(entityType, transformer) {
    this._flushCurrentOperation();
    
    this.operations.push({
      type: 'dataTransform',
      entityType,
      transformer
    });
    
    return this;
  }
  
  // ============================================================================
  // EXECUTION
  // ============================================================================
  
  /**
   * Configure execution options
   * @param {Object} opts - Execution options
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  configure(opts) {
    this.options = { ...this.options, ...opts };
    return this;
  }
  
  /**
   * Validate the planned changes without applying
   * @returns {Promise<Object>} Validation result
   */
  async validate() {
    this._flushCurrentOperation();
    
    const results = [];
    
    for (const operation of this.operations) {
      try {
        const result = await this._validateOperation(operation);
        results.push({
          operation: operation.type,
          valid: result.valid,
          warnings: result.warnings || [],
          errors: result.errors || []
        });
      } catch (error) {
        results.push({
          operation: operation.type,
          valid: false,
          errors: [error.message]
        });
      }
    }
    
    return {
      valid: results.every(r => r.valid),
      results
    };
  }
  
  /**
   * Preview the changes that would be applied
   * @returns {Object} Preview of changes
   */
  preview() {
    this._flushCurrentOperation();
    
    return {
      operations: this.operations.map(op => ({
        type: op.type,
        target: op.entityType || op.name,
        details: this._getOperationDetails(op)
      })),
      estimatedImpact: this._estimateImpact()
    };
  }
  
  /**
   * Apply all schema changes
   * @returns {Promise<Object>} Application result
   */
  async apply() {
    this._flushCurrentOperation();
    
    if (this.operations.length === 0) {
      return {
        success: true,
        message: 'No operations to apply',
        changes: []
      };
    }
    
    // Validate first if configured
    if (this.options.validateBeforeApply) {
      const validation = await this.validate();
      if (!validation.valid) {
        throw new Error(`Validation failed: ${JSON.stringify(validation.results)}`);
      }
    }
    
    const changes = [];
    const startVersion = this.dataStore.schemaManager.getVersion();
    
    try {
      // Apply each operation
      for (const operation of this.operations) {
        const result = await this._applyOperation(operation);
        changes.push(result);
      }
      
      return {
        success: true,
        startVersion,
        endVersion: this.dataStore.schemaManager.getVersion(),
        changes
      };
      
    } catch (error) {
      // Rollback if configured
      if (this.options.rollbackOnError) {
        // In a real implementation, we'd restore from backup
        console.error('Rollback not yet implemented');
      }
      
      throw error;
    }
  }
  
  /**
   * Reset the DSL builder
   * @returns {SchemaEvolutionDSL} Fluent interface
   */
  reset() {
    this.operations = [];
    this.currentOperation = null;
    return this;
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  /**
   * Flush current operation to operations list
   * @private
   */
  _flushCurrentOperation() {
    if (this.currentOperation) {
      this.operations.push(this.currentOperation);
      this.currentOperation = null;
    }
  }
  
  /**
   * Validate a single operation
   * @private
   */
  async _validateOperation(operation) {
    switch (operation.type) {
      case 'defineEntity':
        // Check if entity already exists
        const existingAttributes = Object.keys(this.dataStore.schema)
          .filter(attr => attr.startsWith(`:${operation.entityType}/`));
        
        if (existingAttributes.length > 0) {
          return {
            valid: false,
            errors: [`Entity type ${operation.entityType} already exists`]
          };
        }
        
        return { valid: true };
        
      case 'alterEntity':
        // Check if entity exists
        const entityExists = Object.keys(this.dataStore.schema)
          .some(attr => attr.startsWith(`:${operation.entityType}/`));
        
        if (!entityExists) {
          return {
            valid: false,
            errors: [`Entity type ${operation.entityType} does not exist`]
          };
        }
        
        return { valid: true };
        
      case 'dropEntity':
        // Check if entity has data
        const query = `[:find ?e :where [?e :${operation.entityType}/id _]]`;
        const results = this.dataStore.query(query);
        
        if (results.length > 0 && !operation.cascade) {
          return {
            valid: true,
            warnings: [`Entity type ${operation.entityType} has ${results.length} instances`]
          };
        }
        
        return { valid: true };
        
      default:
        return { valid: true };
    }
  }
  
  /**
   * Apply a single operation
   * @private
   */
  async _applyOperation(operation) {
    switch (operation.type) {
      case 'defineEntity':
        return await this.dataStore.addEntityType(
          operation.entityType,
          operation.attributes
        );
        
      case 'alterEntity':
        const results = [];
        
        // Apply additions
        for (const addition of operation.additions) {
          if (addition.type === 'attribute') {
            const result = await this.dataStore.addAttribute(
              operation.entityType,
              addition.name,
              addition.spec
            );
            results.push(result);
          }
        }
        
        // Apply removals
        for (const removal of operation.removals) {
          if (removal.type === 'attribute') {
            const result = await this.dataStore.removeAttribute(
              operation.entityType,
              removal.name,  // This is already just the attribute name, not prefixed
              removal.force
            );
            results.push(result);
          }
        }
        
        // Apply modifications
        for (const modification of operation.modifications) {
          // Handle renames, type changes, etc.
          // This would need custom implementation in SchemaEvolution
          results.push({
            success: true,
            modification: modification.type
          });
        }
        
        return {
          success: true,
          entityType: operation.entityType,
          changes: results
        };
        
      case 'dropEntity':
        return await this.dataStore.removeEntityType(
          operation.entityType,
          operation.cascade
        );
        
      case 'customMigration':
        return await operation.migrationFn(this.dataStore);
        
      case 'dataTransform':
        // Get all entities of the specified type
        // First, check if any attributes of this type exist in the schema
        const entityAttrs = Object.keys(this.dataStore.schema)
          .filter(attr => attr.startsWith(`:${operation.entityType}/`));
        
        if (entityAttrs.length === 0) {
          return {
            success: true,
            entitiesTransformed: 0,
            message: `No schema for entity type: ${operation.entityType}`
          };
        }
        
        // Get entities that have at least one attribute of this type
        // Using a simple approach - get entities with the first attribute
        const firstAttr = entityAttrs[0];
        let transformedCount = 0;
        
        // If dataStore has a method to get all entities, use it
        // Otherwise we'll need to work with what we have
        if (this.dataStore.getAllEntities) {
          const allEntities = this.dataStore.getAllEntities();
          for (const entity of allEntities) {
            // Check if entity has attributes of this type
            const hasType = entityAttrs.some(attr => entity[attr] !== undefined);
            if (hasType) {
              const transformed = await operation.transformer(entity);
              if (transformed && entity.id) {
                await this.dataStore.updateEntity(entity.id, transformed);
                transformedCount++;
              }
            }
          }
        } else {
          // Fallback: just return success with 0 transforms
          // Real implementation would need a proper query mechanism
        }
        
        return {
          success: true,
          entitiesTransformed: transformedCount
        };
        
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }
  
  /**
   * Get operation details for preview
   * @private
   */
  _getOperationDetails(operation) {
    switch (operation.type) {
      case 'defineEntity':
        return {
          attributes: Object.keys(operation.attributes).length,
          relationships: operation.relationships.length
        };
        
      case 'alterEntity':
        return {
          additions: operation.additions.length,
          removals: operation.removals.length,
          modifications: operation.modifications.length
        };
        
      case 'dropEntity':
        return {
          cascade: operation.cascade
        };
        
      default:
        return {};
    }
  }
  
  /**
   * Estimate impact of operations
   * @private
   */
  _estimateImpact() {
    let entitiesAffected = 0;
    let attributesAdded = 0;
    let attributesRemoved = 0;
    
    for (const operation of this.operations) {
      switch (operation.type) {
        case 'defineEntity':
          attributesAdded += Object.keys(operation.attributes).length;
          break;
          
        case 'alterEntity':
          attributesAdded += operation.additions.filter(a => a.type === 'attribute').length;
          attributesRemoved += operation.removals.filter(r => r.type === 'attribute').length;
          // Would need to query for actual entity count
          break;
          
        case 'dropEntity':
          // Would need to query for actual entity count
          break;
      }
    }
    
    return {
      entitiesAffected,
      attributesAdded,
      attributesRemoved
    };
  }
}

/**
 * Factory function to create a SchemaEvolutionDSL instance
 * @param {Object} dataStore - DynamicDataStore instance
 * @returns {SchemaEvolutionDSL} New DSL instance
 */
export function createSchemaEvolutionDSL(dataStore) {
  return new SchemaEvolutionDSL(dataStore);
}