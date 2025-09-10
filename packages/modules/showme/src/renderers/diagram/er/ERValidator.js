/**
 * ERValidator
 * 
 * Validation engine for Entity-Relationship diagram consistency and correctness
 * Enforces ER modeling rules and constraints
 */

export class ERValidator {
  constructor(config = {}) {
    this.config = {
      // Validation strictness
      strictMode: config.strictMode !== false,
      allowUnconnectedEntities: config.allowUnconnectedEntities === true,
      allowMultipleRelationships: config.allowMultipleRelationships !== false,
      
      // Entity validation
      requireEntityNames: config.requireEntityNames !== false,
      allowDuplicateEntityNames: config.allowDuplicateEntityNames === true,
      maxEntitiesPerDiagram: config.maxEntitiesPerDiagram || 100,
      
      // Attribute validation
      requireAttributeNames: config.requireAttributeNames !== false,
      allowCompositeAttributes: config.allowCompositeAttributes !== false,
      allowMultivaluedAttributes: config.allowMultivaluedAttributes !== false,
      allowDerivedAttributes: config.allowDerivedAttributes !== false,
      
      // Relationship validation
      requireRelationshipNames: config.requireRelationshipNames !== false,
      minRelationshipDegree: config.minRelationshipDegree || 2,
      maxRelationshipDegree: config.maxRelationshipDegree || 8,
      allowRecursiveRelationships: config.allowRecursiveRelationships !== false,
      
      // Cardinality validation
      validateCardinalities: config.validateCardinalities !== false,
      allowZeroCardinality: config.allowZeroCardinality !== false,
      requireCardinalityLabels: config.requireCardinalityLabels === true,
      
      // Weak entity validation
      enforceWeakEntityRules: config.enforceWeakEntityRules !== false,
      requireIdentifyingRelationships: config.requireIdentifyingRelationships !== false,
      
      // Inheritance validation
      allowMultipleInheritance: config.allowMultipleInheritance !== false,
      enforceInheritanceConstraints: config.enforceInheritanceConstraints !== false,
      maxInheritanceDepth: config.maxInheritanceDepth || 10,
      
      ...config
    };
    
    this.validationRules = new Map();
    this.customValidators = new Map();
    this.initializeDefaultRules();
  }
  
  /**
   * Initialize default validation rules
   * @private
   */
  initializeDefaultRules() {
    // Entity validation rules
    this.addRule('entity-has-name', this._validateEntityNames.bind(this));
    this.addRule('entity-names-unique', this._validateUniqueEntityNames.bind(this));
    this.addRule('entity-count-limit', this._validateEntityCount.bind(this));
    
    // Attribute validation rules
    this.addRule('attribute-has-name', this._validateAttributeNames.bind(this));
    this.addRule('attribute-types-valid', this._validateAttributeTypes.bind(this));
    this.addRule('key-attributes-valid', this._validateKeyAttributes.bind(this));
    
    // Relationship validation rules
    this.addRule('relationship-has-name', this._validateRelationshipNames.bind(this));
    this.addRule('relationship-degree-valid', this._validateRelationshipDegree.bind(this));
    this.addRule('relationship-connectivity', this._validateRelationshipConnectivity.bind(this));
    
    // Cardinality validation rules
    this.addRule('cardinality-format-valid', this._validateCardinalityFormat.bind(this));
    this.addRule('cardinality-consistency', this._validateCardinalityConsistency.bind(this));
    
    // Weak entity validation rules
    this.addRule('weak-entity-rules', this._validateWeakEntityRules.bind(this));
    this.addRule('identifying-relationships', this._validateIdentifyingRelationships.bind(this));
    
    // Inheritance validation rules
    this.addRule('inheritance-cycles', this._validateInheritanceCycles.bind(this));
    this.addRule('inheritance-constraints', this._validateInheritanceConstraints.bind(this));
    this.addRule('inheritance-depth', this._validateInheritanceDepth.bind(this));
    
    // Structural validation rules
    this.addRule('diagram-connectivity', this._validateDiagramConnectivity.bind(this));
    this.addRule('dangling-elements', this._validateDanglingElements.bind(this));
  }
  
  /**
   * Validate complete ER diagram
   */
  validateDiagram(diagram) {
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      info: [],
      statistics: {}
    };
    
    if (!diagram || typeof diagram !== 'object') {
      results.valid = false;
      results.errors.push('Invalid diagram object');
      return results;
    }
    
    // Extract diagram elements
    const entities = this._extractEntities(diagram);
    const relationships = this._extractRelationships(diagram);
    const attributes = this._extractAttributes(diagram);
    const inheritances = this._extractInheritances(diagram);
    
    // Calculate statistics
    results.statistics = {
      entityCount: entities.length,
      relationshipCount: relationships.length,
      attributeCount: attributes.length,
      inheritanceCount: inheritances.length
    };
    
    // Run all validation rules
    for (const [ruleName, ruleFunction] of this.validationRules) {
      try {
        const ruleResult = ruleFunction(entities, relationships, attributes, inheritances);
        if (ruleResult.errors) results.errors.push(...ruleResult.errors);
        if (ruleResult.warnings) results.warnings.push(...ruleResult.warnings);
        if (ruleResult.info) results.info.push(...ruleResult.info);
      } catch (error) {
        results.errors.push(`Validation rule '${ruleName}' failed: ${error.message}`);
      }
    }
    
    // Run custom validators
    for (const [name, validator] of this.customValidators) {
      try {
        const customResult = validator(entities, relationships, attributes, inheritances);
        if (customResult.errors) results.errors.push(...customResult.errors);
        if (customResult.warnings) results.warnings.push(...customResult.warnings);
        if (customResult.info) results.info.push(...customResult.info);
      } catch (error) {
        results.warnings.push(`Custom validator '${name}' failed: ${error.message}`);
      }
    }
    
    results.valid = results.errors.length === 0;
    return results;
  }
  
  /**
   * Validate entity names
   * @private
   */
  _validateEntityNames(entities) {
    const errors = [];
    
    if (!this.config.requireEntityNames) return { errors };
    
    for (const entity of entities) {
      if (!entity.name && !entity.label) {
        errors.push(`Entity '${entity.id}' is missing a name`);
      }
    }
    
    return { errors };
  }
  
  /**
   * Validate unique entity names
   * @private
   */
  _validateUniqueEntityNames(entities) {
    const errors = [];
    
    if (this.config.allowDuplicateEntityNames) return { errors };
    
    const names = new Map();
    for (const entity of entities) {
      const name = entity.name || entity.label;
      if (name) {
        if (names.has(name)) {
          errors.push(`Duplicate entity name '${name}' found`);
        }
        names.set(name, entity.id);
      }
    }
    
    return { errors };
  }
  
  /**
   * Validate entity count
   * @private
   */
  _validateEntityCount(entities) {
    const errors = [];
    
    if (entities.length > this.config.maxEntitiesPerDiagram) {
      errors.push(`Too many entities: ${entities.length} (max: ${this.config.maxEntitiesPerDiagram})`);
    }
    
    return { errors };
  }
  
  /**
   * Validate attribute names
   * @private
   */
  _validateAttributeNames(entities, relationships, attributes) {
    const errors = [];
    
    if (!this.config.requireAttributeNames) return { errors };
    
    for (const attr of attributes) {
      if (!attr.name && !attr.label) {
        errors.push(`Attribute '${attr.id}' is missing a name`);
      }
    }
    
    return { errors };
  }
  
  /**
   * Validate attribute types
   * @private
   */
  _validateAttributeTypes(entities, relationships, attributes) {
    const errors = [];
    const warnings = [];
    
    const validTypes = [
      'simple', 'composite', 'multivalued', 'derived', 
      'key', 'partial-key', 'discriminator'
    ];
    
    for (const attr of attributes) {
      if (attr.type && !validTypes.includes(attr.type)) {
        warnings.push(`Unknown attribute type '${attr.type}' for attribute '${attr.name || attr.id}'`);
      }
      
      // Validate composite attributes
      if (attr.type === 'composite') {
        if (!this.config.allowCompositeAttributes) {
          errors.push(`Composite attribute '${attr.name || attr.id}' not allowed`);
        }
        if (!attr.components || attr.components.length === 0) {
          errors.push(`Composite attribute '${attr.name || attr.id}' has no components`);
        }
      }
      
      // Validate multivalued attributes
      if (attr.multivalued || attr.type === 'multivalued') {
        if (!this.config.allowMultivaluedAttributes) {
          errors.push(`Multivalued attribute '${attr.name || attr.id}' not allowed`);
        }
      }
      
      // Validate derived attributes
      if (attr.derived || attr.type === 'derived') {
        if (!this.config.allowDerivedAttributes) {
          errors.push(`Derived attribute '${attr.name || attr.id}' not allowed`);
        }
      }
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate key attributes
   * @private
   */
  _validateKeyAttributes(entities, relationships, attributes) {
    const errors = [];
    const warnings = [];
    
    for (const entity of entities) {
      const entityAttrs = attributes.filter(attr => attr.entityId === entity.id);
      const keyAttrs = entityAttrs.filter(attr => 
        attr.type === 'key' || attr.isKey || attr.primaryKey
      );
      
      if (entity.type !== 'weak-entity') {
        if (keyAttrs.length === 0) {
          warnings.push(`Entity '${entity.name || entity.id}' has no key attributes`);
        }
      } else {
        // Weak entities should have partial keys
        const partialKeys = entityAttrs.filter(attr => 
          attr.type === 'partial-key' || attr.isPartialKey
        );
        if (partialKeys.length === 0) {
          warnings.push(`Weak entity '${entity.name || entity.id}' has no partial key attributes`);
        }
      }
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate relationship names
   * @private
   */
  _validateRelationshipNames(entities, relationships) {
    const errors = [];
    
    if (!this.config.requireRelationshipNames) return { errors };
    
    for (const rel of relationships) {
      if (!rel.name && !rel.label) {
        errors.push(`Relationship '${rel.id}' is missing a name`);
      }
    }
    
    return { errors };
  }
  
  /**
   * Validate relationship degree
   * @private
   */
  _validateRelationshipDegree(entities, relationships) {
    const errors = [];
    const warnings = [];
    
    for (const rel of relationships) {
      const degree = rel.entities ? rel.entities.length : 0;
      
      if (degree < this.config.minRelationshipDegree) {
        errors.push(`Relationship '${rel.name || rel.id}' has degree ${degree} (min: ${this.config.minRelationshipDegree})`);
      }
      
      if (degree > this.config.maxRelationshipDegree) {
        errors.push(`Relationship '${rel.name || rel.id}' has degree ${degree} (max: ${this.config.maxRelationshipDegree})`);
      }
      
      // Check for recursive relationships
      if (degree > 1 && rel.entities) {
        const uniqueEntities = new Set(rel.entities);
        if (uniqueEntities.size < rel.entities.length) {
          if (!this.config.allowRecursiveRelationships) {
            errors.push(`Recursive relationship '${rel.name || rel.id}' not allowed`);
          } else {
            warnings.push(`Relationship '${rel.name || rel.id}' is recursive`);
          }
        }
      }
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate relationship connectivity
   * @private
   */
  _validateRelationshipConnectivity(entities, relationships) {
    const errors = [];
    
    for (const rel of relationships) {
      if (!rel.entities || rel.entities.length === 0) {
        errors.push(`Relationship '${rel.name || rel.id}' is not connected to any entities`);
        continue;
      }
      
      // Check that all referenced entities exist
      for (const entityId of rel.entities) {
        const entity = entities.find(e => e.id === entityId);
        if (!entity) {
          errors.push(`Relationship '${rel.name || rel.id}' references non-existent entity '${entityId}'`);
        }
      }
    }
    
    return { errors };
  }
  
  /**
   * Validate cardinality format
   * @private
   */
  _validateCardinalityFormat(entities, relationships) {
    const errors = [];
    const warnings = [];
    
    if (!this.config.validateCardinalities) return { errors, warnings };
    
    for (const rel of relationships) {
      if (!rel.cardinality && this.config.requireCardinalityLabels) {
        warnings.push(`Relationship '${rel.name || rel.id}' is missing cardinality labels`);
        continue;
      }
      
      if (rel.cardinality) {
        for (const [entityId, cardinality] of Object.entries(rel.cardinality)) {
          if (!this._isValidCardinalityFormat(cardinality)) {
            errors.push(`Invalid cardinality format '${cardinality}' for entity '${entityId}' in relationship '${rel.name || rel.id}'`);
          }
        }
      }
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate cardinality consistency
   * @private
   */
  _validateCardinalityConsistency(entities, relationships) {
    const errors = [];
    
    for (const rel of relationships) {
      if (!rel.cardinality) continue;
      
      for (const [entityId, cardinality] of Object.entries(rel.cardinality)) {
        if (!this.config.allowZeroCardinality && this._hasZeroCardinality(cardinality)) {
          errors.push(`Zero cardinality not allowed for entity '${entityId}' in relationship '${rel.name || rel.id}'`);
        }
      }
    }
    
    return { errors };
  }
  
  /**
   * Validate weak entity rules
   * @private
   */
  _validateWeakEntityRules(entities, relationships) {
    const errors = [];
    const warnings = [];
    
    if (!this.config.enforceWeakEntityRules) return { errors, warnings };
    
    for (const entity of entities) {
      if (entity.type === 'weak-entity') {
        // Check for identifying relationship
        const identifyingRels = relationships.filter(rel => 
          rel.identifying && rel.entities && rel.entities.includes(entity.id)
        );
        
        if (identifyingRels.length === 0) {
          errors.push(`Weak entity '${entity.name || entity.id}' has no identifying relationship`);
        }
        
        // Check for strong entity dependency
        let hasStrongEntityDependency = false;
        for (const rel of identifyingRels) {
          const otherEntities = rel.entities.filter(id => id !== entity.id);
          const strongEntities = otherEntities.filter(id => {
            const ent = entities.find(e => e.id === id);
            return ent && ent.type !== 'weak-entity';
          });
          
          if (strongEntities.length > 0) {
            hasStrongEntityDependency = true;
            break;
          }
        }
        
        if (!hasStrongEntityDependency) {
          errors.push(`Weak entity '${entity.name || entity.id}' is not dependent on any strong entity`);
        }
      }
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate identifying relationships
   * @private
   */
  _validateIdentifyingRelationships(entities, relationships) {
    const errors = [];
    
    if (!this.config.requireIdentifyingRelationships) return { errors };
    
    for (const rel of relationships) {
      if (rel.identifying) {
        // Check that at least one entity is weak
        const hasWeakEntity = rel.entities && rel.entities.some(entityId => {
          const entity = entities.find(e => e.id === entityId);
          return entity && entity.type === 'weak-entity';
        });
        
        if (!hasWeakEntity) {
          errors.push(`Identifying relationship '${rel.name || rel.id}' does not involve any weak entities`);
        }
      }
    }
    
    return { errors };
  }
  
  /**
   * Validate inheritance cycles
   * @private
   */
  _validateInheritanceCycles(entities, relationships, attributes, inheritances) {
    const errors = [];
    
    // Build inheritance graph
    const graph = new Map();
    for (const inh of inheritances) {
      if (!graph.has(inh.parent)) graph.set(inh.parent, []);
      graph.get(inh.parent).push(inh.child);
    }
    
    // Check for cycles using DFS
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (nodeId) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const children = graph.get(nodeId) || [];
      for (const childId of children) {
        if (!visited.has(childId)) {
          if (hasCycle(childId)) return true;
        } else if (recursionStack.has(childId)) {
          return true;
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    for (const entityId of graph.keys()) {
      if (!visited.has(entityId) && hasCycle(entityId)) {
        errors.push(`Circular inheritance detected involving entity '${entityId}'`);
      }
    }
    
    return { errors };
  }
  
  /**
   * Validate inheritance constraints
   * @private
   */
  _validateInheritanceConstraints(entities, relationships, attributes, inheritances) {
    const errors = [];
    
    if (!this.config.enforceInheritanceConstraints) return { errors };
    
    // Group inheritances by parent
    const inheritanceGroups = new Map();
    for (const inh of inheritances) {
      if (!inheritanceGroups.has(inh.parent)) {
        inheritanceGroups.set(inh.parent, []);
      }
      inheritanceGroups.get(inh.parent).push(inh);
    }
    
    for (const [parentId, group] of inheritanceGroups) {
      const parent = entities.find(e => e.id === parentId);
      if (!parent) continue;
      
      // Check for multiple inheritance
      if (group.length > 1 && !this.config.allowMultipleInheritance) {
        errors.push(`Multiple inheritance from entity '${parent.name || parentId}' not allowed`);
      }
      
      // Validate constraint consistency within group
      const constraints = group.map(inh => inh.constraints).filter(c => c);
      if (constraints.length > 1) {
        // All should have same overlapping/disjoint constraint
        const overlappingValues = constraints.map(c => c.overlapping).filter(v => v !== undefined);
        if (overlappingValues.length > 1 && !overlappingValues.every(v => v === overlappingValues[0])) {
          errors.push(`Inconsistent overlapping constraints in inheritance from '${parent.name || parentId}'`);
        }
        
        // All should have same total/partial constraint
        const totalValues = constraints.map(c => c.total).filter(v => v !== undefined);
        if (totalValues.length > 1 && !totalValues.every(v => v === totalValues[0])) {
          errors.push(`Inconsistent completeness constraints in inheritance from '${parent.name || parentId}'`);
        }
      }
    }
    
    return { errors };
  }
  
  /**
   * Validate inheritance depth
   * @private
   */
  _validateInheritanceDepth(entities, relationships, attributes, inheritances) {
    const errors = [];
    
    // Build inheritance graph
    const childToParent = new Map();
    for (const inh of inheritances) {
      childToParent.set(inh.child, inh.parent);
    }
    
    // Calculate depth for each entity
    const calculateDepth = (entityId, visited = new Set()) => {
      if (visited.has(entityId)) return Infinity; // Cycle detected
      
      const parent = childToParent.get(entityId);
      if (!parent) return 0; // Root entity
      
      visited.add(entityId);
      return 1 + calculateDepth(parent, visited);
    };
    
    for (const entityId of childToParent.keys()) {
      const depth = calculateDepth(entityId);
      if (depth > this.config.maxInheritanceDepth) {
        const entity = entities.find(e => e.id === entityId);
        errors.push(`Inheritance depth ${depth} exceeds maximum ${this.config.maxInheritanceDepth} for entity '${entity?.name || entityId}'`);
      }
    }
    
    return { errors };
  }
  
  /**
   * Validate diagram connectivity
   * @private
   */
  _validateDiagramConnectivity(entities, relationships) {
    const errors = [];
    const warnings = [];
    
    if (this.config.allowUnconnectedEntities) return { errors, warnings };
    
    // Find entities not connected to any relationship
    for (const entity of entities) {
      const isConnected = relationships.some(rel => 
        rel.entities && rel.entities.includes(entity.id)
      );
      
      if (!isConnected) {
        warnings.push(`Entity '${entity.name || entity.id}' is not connected to any relationships`);
      }
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate dangling elements
   * @private
   */
  _validateDanglingElements(entities, relationships, attributes) {
    const errors = [];
    
    // Check for attributes not connected to entities
    for (const attr of attributes) {
      if (attr.entityId) {
        const entity = entities.find(e => e.id === attr.entityId);
        if (!entity) {
          errors.push(`Attribute '${attr.name || attr.id}' references non-existent entity '${attr.entityId}'`);
        }
      }
    }
    
    return { errors };
  }
  
  /**
   * Extract entities from diagram
   * @private
   */
  _extractEntities(diagram) {
    if (diagram.entities) return diagram.entities;
    if (diagram.nodes) return diagram.nodes.filter(n => n.type && n.type.includes('entity'));
    return [];
  }
  
  /**
   * Extract relationships from diagram
   * @private
   */
  _extractRelationships(diagram) {
    if (diagram.relationships) return diagram.relationships;
    if (diagram.nodes) return diagram.nodes.filter(n => n.type === 'relationship');
    return [];
  }
  
  /**
   * Extract attributes from diagram
   * @private
   */
  _extractAttributes(diagram) {
    if (diagram.attributes) return diagram.attributes;
    if (diagram.nodes) return diagram.nodes.filter(n => n.type === 'attribute');
    return [];
  }
  
  /**
   * Extract inheritances from diagram
   * @private
   */
  _extractInheritances(diagram) {
    if (diagram.inheritances) return diagram.inheritances;
    if (diagram.edges) return diagram.edges.filter(e => e.type === 'inheritance' || e.type === 'isa');
    return [];
  }
  
  /**
   * Check if cardinality format is valid
   * @private
   */
  _isValidCardinalityFormat(cardinality) {
    if (typeof cardinality === 'number') return cardinality >= 0;
    if (typeof cardinality === 'string') {
      // Check common formats: "1", "N", "0..1", "1..N", "0..*", "1..*", etc.
      const patterns = [
        /^\d+$/,           // Single number
        /^[0-9*N]+$/,      // N, *, etc.
        /^\d+\.\.\d+$/,    // Range like 1..5
        /^\d+\.\.\*$/,     // Range with * like 1..*
        /^\d+\.\.N$/,      // Range with N like 1..N
        /^[01],[1*N∞]$/    // Comma notation like 0,1 or 1,N
      ];
      return patterns.some(pattern => pattern.test(cardinality));
    }
    return false;
  }
  
  /**
   * Check if cardinality has zero values
   * @private
   */
  _hasZeroCardinality(cardinality) {
    if (typeof cardinality === 'number') return cardinality === 0;
    if (typeof cardinality === 'string') {
      return cardinality.includes('0') && !cardinality.match(/[1-9]/);
    }
    return false;
  }
  
  /**
   * Add custom validation rule
   */
  addRule(name, ruleFunction) {
    this.validationRules.set(name, ruleFunction);
  }
  
  /**
   * Remove validation rule
   */
  removeRule(name) {
    return this.validationRules.delete(name);
  }
  
  /**
   * Add custom validator
   */
  addCustomValidator(name, validator) {
    this.customValidators.set(name, validator);
  }
  
  /**
   * Remove custom validator
   */
  removeCustomValidator(name) {
    return this.customValidators.delete(name);
  }
  
  /**
   * Get validation configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Update validation configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get list of available validation rules
   */
  getAvailableRules() {
    return Array.from(this.validationRules.keys());
  }
}

export default ERValidator;