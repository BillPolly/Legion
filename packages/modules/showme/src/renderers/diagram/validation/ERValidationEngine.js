/**
 * ERValidationEngine - Comprehensive validation for Entity-Relationship diagrams
 * 
 * Features:
 * - Entity validation (naming, attributes, keys)
 * - Relationship validation (cardinality, participation)
 * - Inheritance validation (ISA hierarchies, constraints)
 * - Semantic validation (business rules, consistency)
 * - Real-time validation feedback
 * - Custom validation rules
 * - Validation severity levels (error, warning, info)
 * - Performance optimization for large diagrams
 */

export class ERValidationEngine {
  constructor(config = {}) {
    this.config = {
      // Validation settings
      validateOnChange: config.validateOnChange !== false,
      validateEntities: config.validateEntities !== false,
      validateRelationships: config.validateRelationships !== false,
      validateInheritance: config.validateInheritance !== false,
      validateSemantics: config.validateSemantics !== false,
      
      // Rule configuration
      strictMode: config.strictMode || false, // Enforce strict ER rules
      allowEmptyEntities: config.allowEmptyEntities || false,
      requirePrimaryKeys: config.requirePrimaryKeys !== false,
      requireRelationshipNames: config.requireRelationshipNames || false,
      maxEntityNameLength: config.maxEntityNameLength || 50,
      maxAttributeNameLength: config.maxAttributeNameLength || 50,
      
      // Cardinality rules
      allowManyToMany: config.allowManyToMany !== false,
      allowSelfRelationships: config.allowSelfRelationships !== false,
      allowNullableFK: config.allowNullableFK !== false,
      
      // Inheritance rules
      allowMultipleInheritance: config.allowMultipleInheritance || false,
      requireDisjointness: config.requireDisjointness || false,
      requireCompleteness: config.requireCompleteness || false,
      
      // Performance
      batchValidation: config.batchValidation !== false,
      validationDelay: config.validationDelay || 100,
      cacheResults: config.cacheResults !== false,
      maxCacheSize: config.maxCacheSize || 1000,
      
      // Custom validators
      customValidators: config.customValidators || [],
      
      // Callbacks
      onValidationStart: config.onValidationStart || null,
      onValidationComplete: config.onValidationComplete || null,
      onError: config.onError || null,
      onWarning: config.onWarning || null,
      
      ...config
    };
    
    // Internal state
    this.validationCache = new Map();
    this.validationQueue = [];
    this.isValidating = false;
    this.validationTimeout = null;
    
    // Built-in validators
    this.validators = new Map();
    this.customRules = new Map();
    
    // Statistics
    this.stats = {
      totalValidations: 0,
      cachedValidations: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      avgValidationTime: 0
    };
    
    // Initialize validators
    this._initializeValidators();
  }
  
  /**
   * Initialize built-in validators
   */
  _initializeValidators() {
    // Entity validators
    this.validators.set('entity-naming', this._validateEntityNaming.bind(this));
    this.validators.set('entity-keys', this._validateEntityKeys.bind(this));
    this.validators.set('entity-attributes', this._validateEntityAttributes.bind(this));
    this.validators.set('entity-duplicates', this._validateEntityDuplicates.bind(this));
    
    // Relationship validators
    this.validators.set('relationship-cardinality', this._validateRelationshipCardinality.bind(this));
    this.validators.set('relationship-participation', this._validateRelationshipParticipation.bind(this));
    this.validators.set('relationship-naming', this._validateRelationshipNaming.bind(this));
    this.validators.set('relationship-cycles', this._validateRelationshipCycles.bind(this));
    
    // Inheritance validators
    this.validators.set('inheritance-hierarchy', this._validateInheritanceHierarchy.bind(this));
    this.validators.set('inheritance-constraints', this._validateInheritanceConstraints.bind(this));
    this.validators.set('inheritance-conflicts', this._validateInheritanceConflicts.bind(this));
    
    // Semantic validators
    this.validators.set('semantic-consistency', this._validateSemanticConsistency.bind(this));
    this.validators.set('semantic-business-rules', this._validateBusinessRules.bind(this));
    this.validators.set('semantic-referential-integrity', this._validateReferentialIntegrity.bind(this));
  }
  
  /**
   * Validate entire ER diagram
   */
  async validateDiagram(diagram, options = {}) {
    const startTime = performance.now();
    
    if (this.config.onValidationStart) {
      this.config.onValidationStart(diagram);
    }
    
    const results = {
      isValid: true,
      errors: [],
      warnings: [],
      infos: [],
      validationTime: 0,
      details: new Map()
    };
    
    try {
      // Check cache if enabled
      if (this.config.cacheResults && !options.forceValidation) {
        const cached = this._getCachedResults(diagram);
        if (cached) {
          this.stats.cachedValidations++;
          return cached;
        }
      }
      
      // Validate entities
      if (this.config.validateEntities) {
        const entityResults = await this._validateEntities(diagram.entities);
        this._mergeResults(results, entityResults);
      }
      
      // Validate relationships
      if (this.config.validateRelationships) {
        const relationshipResults = await this._validateRelationships(diagram.relationships, diagram.entities);
        this._mergeResults(results, relationshipResults);
      }
      
      // Validate inheritance
      if (this.config.validateInheritance) {
        const inheritanceResults = await this._validateInheritances(diagram.inheritances, diagram.entities);
        this._mergeResults(results, inheritanceResults);
      }
      
      // Validate semantics
      if (this.config.validateSemantics) {
        const semanticResults = await this._validateSemantics(diagram);
        this._mergeResults(results, semanticResults);
      }
      
      // Run custom validators
      for (const validator of this.config.customValidators) {
        const customResults = await validator(diagram);
        this._mergeResults(results, customResults);
      }
      
      // Update validity flag
      results.isValid = results.errors.length === 0;
      
      // Calculate validation time
      results.validationTime = performance.now() - startTime;
      
      // Update statistics
      this._updateStatistics(results);
      
      // Cache results if enabled
      if (this.config.cacheResults) {
        this._cacheResults(diagram, results);
      }
      
      if (this.config.onValidationComplete) {
        this.config.onValidationComplete(results);
      }
      
      return results;
      
    } catch (error) {
      console.error('Validation failed:', error);
      if (this.config.onError) {
        this.config.onError(error);
      }
      throw error;
    }
  }
  
  /**
   * Validate a single entity
   */
  async validateEntity(entity, context = null) {
    const results = {
      isValid: true,
      errors: [],
      warnings: [],
      infos: []
    };
    
    // Run entity validators
    await this.validators.get('entity-naming')(entity, results);
    await this.validators.get('entity-keys')(entity, results);
    await this.validators.get('entity-attributes')(entity, results);
    
    // Check against context if provided
    if (context) {
      await this.validators.get('entity-duplicates')(entity, results, context);
    }
    
    results.isValid = results.errors.length === 0;
    return results;
  }
  
  /**
   * Validate a single relationship
   */
  async validateRelationship(relationship, context = null) {
    const results = {
      isValid: true,
      errors: [],
      warnings: [],
      infos: []
    };
    
    // Run relationship validators
    await this.validators.get('relationship-cardinality')(relationship, results);
    await this.validators.get('relationship-participation')(relationship, results);
    await this.validators.get('relationship-naming')(relationship, results);
    
    // Check against context if provided
    if (context) {
      await this.validators.get('relationship-cycles')(relationship, results, context);
    }
    
    results.isValid = results.errors.length === 0;
    return results;
  }
  
  /**
   * Validate entities
   */
  async _validateEntities(entities) {
    const results = {
      errors: [],
      warnings: [],
      infos: []
    };
    
    if (!entities || entities.length === 0) {
      if (this.config.strictMode) {
        results.errors.push({
          type: 'entity',
          severity: 'error',
          message: 'Diagram must contain at least one entity',
          code: 'NO_ENTITIES'
        });
      }
      return results;
    }
    
    // Validate each entity
    for (const entity of entities) {
      const entityResults = await this.validateEntity(entity, { entities });
      results.errors.push(...entityResults.errors);
      results.warnings.push(...entityResults.warnings);
      results.infos.push(...entityResults.infos);
    }
    
    return results;
  }
  
  /**
   * Validate relationships
   */
  async _validateRelationships(relationships, entities) {
    const results = {
      errors: [],
      warnings: [],
      infos: []
    };
    
    if (!relationships || relationships.length === 0) {
      return results;
    }
    
    // Validate each relationship
    for (const relationship of relationships) {
      const relResults = await this.validateRelationship(relationship, { entities, relationships });
      results.errors.push(...relResults.errors);
      results.warnings.push(...relResults.warnings);
      results.infos.push(...relResults.infos);
    }
    
    return results;
  }
  
  /**
   * Validate inheritances
   */
  async _validateInheritances(inheritances, entities) {
    const results = {
      errors: [],
      warnings: [],
      infos: []
    };
    
    if (!inheritances || inheritances.length === 0) {
      return results;
    }
    
    // Validate hierarchy structure
    await this.validators.get('inheritance-hierarchy')(inheritances, results, entities);
    
    // Validate constraints
    await this.validators.get('inheritance-constraints')(inheritances, results);
    
    // Check for conflicts
    await this.validators.get('inheritance-conflicts')(inheritances, results, entities);
    
    return results;
  }
  
  /**
   * Validate semantics
   */
  async _validateSemantics(diagram) {
    const results = {
      errors: [],
      warnings: [],
      infos: []
    };
    
    // Validate consistency
    await this.validators.get('semantic-consistency')(diagram, results);
    
    // Validate business rules
    await this.validators.get('semantic-business-rules')(diagram, results);
    
    // Validate referential integrity
    await this.validators.get('semantic-referential-integrity')(diagram, results);
    
    return results;
  }
  
  // Individual validator implementations
  
  async _validateEntityNaming(entity, results) {
    // Check entity name
    if (!entity.name || entity.name.trim() === '') {
      results.errors.push({
        type: 'entity',
        entityId: entity.id,
        severity: 'error',
        message: `Entity must have a name`,
        code: 'MISSING_ENTITY_NAME'
      });
    } else if (entity.name.length > this.config.maxEntityNameLength) {
      results.warnings.push({
        type: 'entity',
        entityId: entity.id,
        severity: 'warning',
        message: `Entity name exceeds maximum length of ${this.config.maxEntityNameLength}`,
        code: 'ENTITY_NAME_TOO_LONG'
      });
    }
    
    // Check naming conventions
    if (entity.name && !/^[A-Z][a-zA-Z0-9_]*$/.test(entity.name)) {
      results.warnings.push({
        type: 'entity',
        entityId: entity.id,
        severity: 'warning',
        message: `Entity name should follow PascalCase convention`,
        code: 'ENTITY_NAME_CONVENTION'
      });
    }
  }
  
  async _validateEntityKeys(entity, results) {
    // Check for primary key
    if (this.config.requirePrimaryKeys && !this.config.allowEmptyEntities) {
      const hasPrimaryKey = entity.attributes?.some(attr => attr.isPrimaryKey);
      if (!hasPrimaryKey) {
        results.errors.push({
          type: 'entity',
          entityId: entity.id,
          severity: 'error',
          message: `Entity '${entity.name}' must have at least one primary key`,
          code: 'MISSING_PRIMARY_KEY'
        });
      }
    }
    
    // Check for composite primary keys
    const primaryKeys = entity.attributes?.filter(attr => attr.isPrimaryKey) || [];
    if (primaryKeys.length > 3) {
      results.warnings.push({
        type: 'entity',
        entityId: entity.id,
        severity: 'warning',
        message: `Entity '${entity.name}' has ${primaryKeys.length} primary key attributes, consider simplifying`,
        code: 'COMPLEX_PRIMARY_KEY'
      });
    }
  }
  
  async _validateEntityAttributes(entity, results) {
    if (!entity.attributes || entity.attributes.length === 0) {
      if (!this.config.allowEmptyEntities) {
        results.warnings.push({
          type: 'entity',
          entityId: entity.id,
          severity: 'warning',
          message: `Entity '${entity.name}' has no attributes`,
          code: 'EMPTY_ENTITY'
        });
      }
      return;
    }
    
    // Check attribute names
    const attributeNames = new Set();
    for (const attr of entity.attributes) {
      // Check for duplicates
      if (attributeNames.has(attr.name)) {
        results.errors.push({
          type: 'entity',
          entityId: entity.id,
          severity: 'error',
          message: `Duplicate attribute name '${attr.name}' in entity '${entity.name}'`,
          code: 'DUPLICATE_ATTRIBUTE'
        });
      }
      attributeNames.add(attr.name);
      
      // Check attribute name length
      if (attr.name && attr.name.length > this.config.maxAttributeNameLength) {
        results.warnings.push({
          type: 'entity',
          entityId: entity.id,
          severity: 'warning',
          message: `Attribute name '${attr.name}' exceeds maximum length`,
          code: 'ATTRIBUTE_NAME_TOO_LONG'
        });
      }
      
      // Check for null foreign keys
      if (attr.isForeignKey && !attr.isRequired && !this.config.allowNullableFK) {
        results.warnings.push({
          type: 'entity',
          entityId: entity.id,
          severity: 'warning',
          message: `Foreign key '${attr.name}' is nullable, consider making it required`,
          code: 'NULLABLE_FOREIGN_KEY'
        });
      }
    }
  }
  
  async _validateEntityDuplicates(entity, results, context) {
    const entities = context.entities;
    const duplicates = entities.filter(e => e.id !== entity.id && e.name === entity.name);
    
    if (duplicates.length > 0) {
      results.errors.push({
        type: 'entity',
        entityId: entity.id,
        severity: 'error',
        message: `Duplicate entity name '${entity.name}'`,
        code: 'DUPLICATE_ENTITY_NAME'
      });
    }
  }
  
  async _validateRelationshipCardinality(relationship, results) {
    const validCardinalities = ['1', '0..1', '1..*', '0..*', '*', 'n', 'm'];
    
    // Check source cardinality
    if (!validCardinalities.includes(relationship.cardinality?.source)) {
      results.errors.push({
        type: 'relationship',
        relationshipId: relationship.id,
        severity: 'error',
        message: `Invalid source cardinality '${relationship.cardinality?.source}'`,
        code: 'INVALID_SOURCE_CARDINALITY'
      });
    }
    
    // Check target cardinality
    if (!validCardinalities.includes(relationship.cardinality?.target)) {
      results.errors.push({
        type: 'relationship',
        relationshipId: relationship.id,
        severity: 'error',
        message: `Invalid target cardinality '${relationship.cardinality?.target}'`,
        code: 'INVALID_TARGET_CARDINALITY'
      });
    }
    
    // Check for many-to-many
    if (!this.config.allowManyToMany) {
      const sourceMany = ['*', 'n', '1..*', '0..*'].includes(relationship.cardinality?.source);
      const targetMany = ['*', 'm', '1..*', '0..*'].includes(relationship.cardinality?.target);
      
      if (sourceMany && targetMany) {
        results.warnings.push({
          type: 'relationship',
          relationshipId: relationship.id,
          severity: 'warning',
          message: `Many-to-many relationship detected, consider using an associative entity`,
          code: 'MANY_TO_MANY_RELATIONSHIP'
        });
      }
    }
  }
  
  async _validateRelationshipParticipation(relationship, results) {
    const validParticipations = ['total', 'partial'];
    
    if (relationship.participationType && !validParticipations.includes(relationship.participationType)) {
      results.errors.push({
        type: 'relationship',
        relationshipId: relationship.id,
        severity: 'error',
        message: `Invalid participation type '${relationship.participationType}'`,
        code: 'INVALID_PARTICIPATION_TYPE'
      });
    }
  }
  
  async _validateRelationshipNaming(relationship, results) {
    if (this.config.requireRelationshipNames && !relationship.name) {
      results.errors.push({
        type: 'relationship',
        relationshipId: relationship.id,
        severity: 'error',
        message: `Relationship must have a name`,
        code: 'MISSING_RELATIONSHIP_NAME'
      });
    }
    
    // Check self-relationships
    if (!this.config.allowSelfRelationships && relationship.source === relationship.target) {
      results.warnings.push({
        type: 'relationship',
        relationshipId: relationship.id,
        severity: 'warning',
        message: `Self-relationship detected on entity`,
        code: 'SELF_RELATIONSHIP'
      });
    }
  }
  
  async _validateRelationshipCycles(relationship, results, context) {
    // Simple cycle detection
    const visited = new Set();
    const detectCycle = (entityId, path = []) => {
      if (path.includes(entityId)) {
        return true;
      }
      
      if (visited.has(entityId)) {
        return false;
      }
      
      visited.add(entityId);
      const newPath = [...path, entityId];
      
      // Find relationships from this entity
      const outgoing = context.relationships.filter(r => r.source === entityId);
      for (const rel of outgoing) {
        if (detectCycle(rel.target, newPath)) {
          return true;
        }
      }
      
      return false;
    };
    
    if (detectCycle(relationship.source)) {
      results.warnings.push({
        type: 'relationship',
        relationshipId: relationship.id,
        severity: 'warning',
        message: `Potential cycle detected in relationships`,
        code: 'RELATIONSHIP_CYCLE'
      });
    }
  }
  
  async _validateInheritanceHierarchy(inheritances, results, entities) {
    for (const inheritance of inheritances) {
      // Check if parent exists
      const parent = entities.find(e => e.id === inheritance.parentId);
      if (!parent) {
        results.errors.push({
          type: 'inheritance',
          inheritanceId: inheritance.id,
          severity: 'error',
          message: `Parent entity not found for inheritance`,
          code: 'MISSING_PARENT_ENTITY'
        });
      }
      
      // Check if children exist
      for (const childId of inheritance.childIds || []) {
        const child = entities.find(e => e.id === childId);
        if (!child) {
          results.errors.push({
            type: 'inheritance',
            inheritanceId: inheritance.id,
            severity: 'error',
            message: `Child entity '${childId}' not found for inheritance`,
            code: 'MISSING_CHILD_ENTITY'
          });
        }
      }
      
      // Check for multiple inheritance
      if (!this.config.allowMultipleInheritance) {
        const childInheritances = inheritances.filter(i => 
          i.id !== inheritance.id && 
          i.childIds?.some(id => inheritance.childIds?.includes(id))
        );
        
        if (childInheritances.length > 0) {
          results.errors.push({
            type: 'inheritance',
            inheritanceId: inheritance.id,
            severity: 'error',
            message: `Multiple inheritance detected`,
            code: 'MULTIPLE_INHERITANCE'
          });
        }
      }
    }
  }
  
  async _validateInheritanceConstraints(inheritances, results) {
    for (const inheritance of inheritances) {
      // Check disjointness constraint
      if (this.config.requireDisjointness && !inheritance.disjointness) {
        results.warnings.push({
          type: 'inheritance',
          inheritanceId: inheritance.id,
          severity: 'warning',
          message: `Inheritance should specify disjointness constraint`,
          code: 'MISSING_DISJOINTNESS'
        });
      }
      
      // Check completeness constraint
      if (this.config.requireCompleteness && !inheritance.completeness) {
        results.warnings.push({
          type: 'inheritance',
          inheritanceId: inheritance.id,
          severity: 'warning',
          message: `Inheritance should specify completeness constraint`,
          code: 'MISSING_COMPLETENESS'
        });
      }
    }
  }
  
  async _validateInheritanceConflicts(inheritances, results, entities) {
    // Check for attribute conflicts in inheritance hierarchy
    for (const inheritance of inheritances) {
      const parent = entities.find(e => e.id === inheritance.parentId);
      if (!parent) continue;
      
      const parentAttributes = new Set(parent.attributes?.map(a => a.name) || []);
      
      for (const childId of inheritance.childIds || []) {
        const child = entities.find(e => e.id === childId);
        if (!child) continue;
        
        for (const attr of child.attributes || []) {
          if (parentAttributes.has(attr.name)) {
            results.warnings.push({
              type: 'inheritance',
              inheritanceId: inheritance.id,
              severity: 'warning',
              message: `Attribute '${attr.name}' in child '${child.name}' shadows parent attribute`,
              code: 'ATTRIBUTE_SHADOWING'
            });
          }
        }
      }
    }
  }
  
  async _validateSemanticConsistency(diagram, results) {
    // Check for orphaned entities
    const referencedEntities = new Set();
    
    for (const rel of diagram.relationships || []) {
      referencedEntities.add(rel.source);
      referencedEntities.add(rel.target);
    }
    
    for (const inheritance of diagram.inheritances || []) {
      referencedEntities.add(inheritance.parentId);
      for (const childId of inheritance.childIds || []) {
        referencedEntities.add(childId);
      }
    }
    
    for (const entity of diagram.entities || []) {
      if (!referencedEntities.has(entity.id)) {
        results.infos.push({
          type: 'semantic',
          entityId: entity.id,
          severity: 'info',
          message: `Entity '${entity.name}' is not connected to any other entity`,
          code: 'ORPHANED_ENTITY'
        });
      }
    }
  }
  
  async _validateBusinessRules(diagram, results) {
    // Check for common business rule violations
    
    // Check for entities that should have timestamps
    const timestampEntities = ['User', 'Order', 'Transaction', 'Log', 'Audit'];
    for (const entity of diagram.entities || []) {
      if (timestampEntities.some(name => entity.name?.includes(name))) {
        const hasTimestamp = entity.attributes?.some(attr => 
          attr.name?.toLowerCase().includes('created') || 
          attr.name?.toLowerCase().includes('updated')
        );
        
        if (!hasTimestamp) {
          results.infos.push({
            type: 'semantic',
            entityId: entity.id,
            severity: 'info',
            message: `Entity '${entity.name}' might benefit from timestamp attributes`,
            code: 'MISSING_TIMESTAMPS'
          });
        }
      }
    }
  }
  
  async _validateReferentialIntegrity(diagram, results) {
    // Check foreign key references
    for (const entity of diagram.entities || []) {
      for (const attr of entity.attributes || []) {
        if (attr.isForeignKey && attr.referencedEntity) {
          const referencedEntity = diagram.entities.find(e => e.id === attr.referencedEntity);
          
          if (!referencedEntity) {
            results.errors.push({
              type: 'semantic',
              entityId: entity.id,
              severity: 'error',
              message: `Foreign key '${attr.name}' references non-existent entity`,
              code: 'INVALID_FK_REFERENCE'
            });
          } else if (attr.referencedAttribute) {
            const referencedAttr = referencedEntity.attributes?.find(a => a.id === attr.referencedAttribute);
            if (!referencedAttr) {
              results.errors.push({
                type: 'semantic',
                entityId: entity.id,
                severity: 'error',
                message: `Foreign key '${attr.name}' references non-existent attribute`,
                code: 'INVALID_FK_ATTRIBUTE'
              });
            }
          }
        }
      }
    }
  }
  
  /**
   * Add custom validation rule
   */
  addValidationRule(name, rule) {
    if (typeof rule !== 'function') {
      throw new Error('Validation rule must be a function');
    }
    
    this.customRules.set(name, rule);
  }
  
  /**
   * Remove custom validation rule
   */
  removeValidationRule(name) {
    return this.customRules.delete(name);
  }
  
  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
  }
  
  /**
   * Get cached results
   */
  _getCachedResults(diagram) {
    const cacheKey = this._generateCacheKey(diagram);
    return this.validationCache.get(cacheKey);
  }
  
  /**
   * Cache validation results
   */
  _cacheResults(diagram, results) {
    if (this.validationCache.size >= this.config.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.validationCache.keys().next().value;
      this.validationCache.delete(firstKey);
    }
    
    const cacheKey = this._generateCacheKey(diagram);
    this.validationCache.set(cacheKey, {
      ...results,
      cachedAt: Date.now()
    });
  }
  
  /**
   * Generate cache key for diagram
   */
  _generateCacheKey(diagram) {
    // Simple hash based on entity and relationship counts and IDs
    const entityKey = diagram.entities?.map(e => e.id).sort().join(',') || '';
    const relKey = diagram.relationships?.map(r => r.id).sort().join(',') || '';
    const inhKey = diagram.inheritances?.map(i => i.id).sort().join(',') || '';
    
    return `${entityKey}|${relKey}|${inhKey}`;
  }
  
  /**
   * Merge validation results
   */
  _mergeResults(target, source) {
    target.errors.push(...source.errors);
    target.warnings.push(...source.warnings);
    target.infos.push(...source.infos);
  }
  
  /**
   * Update statistics
   */
  _updateStatistics(results) {
    this.stats.totalValidations++;
    this.stats.errors += results.errors.length;
    this.stats.warnings += results.warnings.length;
    this.stats.infos += results.infos.length;
    
    // Update average validation time
    const currentAvg = this.stats.avgValidationTime;
    const newAvg = (currentAvg * (this.stats.totalValidations - 1) + results.validationTime) / this.stats.totalValidations;
    this.stats.avgValidationTime = newAvg;
  }
  
  /**
   * Get validation statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.validationCache.size,
      customRules: this.customRules.size
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalValidations: 0,
      cachedValidations: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      avgValidationTime: 0
    };
  }
  
  /**
   * Destroy and cleanup
   */
  destroy() {
    this.clearCache();
    this.validators.clear();
    this.customRules.clear();
    
    if (this.validationTimeout) {
      clearTimeout(this.validationTimeout);
      this.validationTimeout = null;
    }
    
    this.validationQueue = [];
    this.isValidating = false;
  }
}

export default ERValidationEngine;