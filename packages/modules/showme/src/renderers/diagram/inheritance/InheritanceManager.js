/**
 * InheritanceManager - Manages inheritance relationships in Entity-Relationship diagrams
 * 
 * Features:
 * - ISA (Is-A) relationship management
 * - Inheritance hierarchy creation and validation
 * - Superclass/subclass relationships
 * - Category (Union) relationships
 * - Inheritance constraint handling (total/partial, disjoint/overlapping)
 * - Multiple inheritance support
 * - Inheritance tree visualization
 * - Constraint validation and conflict detection
 */

export class InheritanceManager {
  constructor(config = {}) {
    this.config = {
      // Inheritance visualization
      isaSymbolType: config.isaSymbolType || 'triangle', // triangle, diamond, circle
      isaSymbolSize: config.isaSymbolSize || 12,
      categorySymbolType: config.categorySymbolType || 'union', // union, category
      
      // Layout options
      hierarchicalLayout: config.hierarchicalLayout !== false, // Arrange in hierarchy
      verticalSpacing: config.verticalSpacing || 80,
      horizontalSpacing: config.horizontalSpacing || 60,
      
      // Constraint enforcement
      enforceConstraints: config.enforceConstraints !== false,
      allowMultipleInheritance: config.allowMultipleInheritance || false,
      defaultConstraints: config.defaultConstraints || {
        completeness: 'partial', // total, partial
        disjointness: 'disjoint' // disjoint, overlapping
      },
      
      // Visual styling
      style: {
        isaLineColor: config.style?.isaLineColor || '#2E86AB',
        isaLineWidth: config.style?.isaLineWidth || 2,
        categoryLineColor: config.style?.categoryLineColor || '#A23B72',
        categoryLineWidth: config.style?.categoryLineWidth || 2,
        symbolFillColor: config.style?.symbolFillColor || '#FFFFFF',
        symbolStrokeColor: config.style?.symbolStrokeColor || '#2E86AB',
        constraintTextColor: config.style?.constraintTextColor || '#666666',
        constraintTextSize: config.style?.constraintTextSize || 10
      },
      
      // Callbacks
      onHierarchyChange: config.onHierarchyChange || null,
      onConstraintViolation: config.onConstraintViolation || null,
      onInheritanceCreated: config.onInheritanceCreated || null,
      onInheritanceRemoved: config.onInheritanceRemoved || null,
      
      ...config
    };
    
    // Internal state
    this.hierarchies = new Map(); // superEntityId -> hierarchy info
    this.isaRelationships = new Map(); // relationshipId -> ISA relationship
    this.categoryRelationships = new Map(); // categoryId -> category relationship
    this.entityHierarchyMap = new Map(); // entityId -> hierarchyId
    this.inheritanceConstraints = new Map(); // hierarchyId -> constraints
    this.validationRules = new Map();
    
    // Statistics
    this.stats = {
      totalHierarchies: 0,
      totalIsaRelationships: 0,
      totalCategoryRelationships: 0,
      constraintViolations: 0
    };
    
    // Initialize built-in validation rules
    this._initializeValidationRules();
  }
  
  /**
   * Create inheritance hierarchy
   */
  createHierarchy(superEntityId, subEntityIds, options = {}) {
    const hierarchyId = options.hierarchyId || `hierarchy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const hierarchy = {
      id: hierarchyId,
      superEntityId,
      subEntityIds: new Set(subEntityIds),
      type: options.type || 'isa', // isa, category
      name: options.name || `${superEntityId} Hierarchy`,
      constraints: {
        completeness: options.completeness || this.config.defaultConstraints.completeness,
        disjointness: options.disjointness || this.config.defaultConstraints.disjointness
      },
      metadata: options.metadata || {},
      createdAt: Date.now()
    };
    
    // Validate hierarchy
    const validation = this.validateHierarchy(hierarchy);
    if (!validation.isValid) {
      throw new Error(`Invalid hierarchy: ${validation.errors.join(', ')}`);
    }
    
    // Store hierarchy
    this.hierarchies.set(hierarchyId, hierarchy);
    this.inheritanceConstraints.set(hierarchyId, hierarchy.constraints);
    
    // Update entity mappings
    this.entityHierarchyMap.set(superEntityId, hierarchyId);
    for (const subEntityId of subEntityIds) {
      this.entityHierarchyMap.set(subEntityId, hierarchyId);
    }
    
    // Create ISA relationships for each subentity
    for (const subEntityId of subEntityIds) {
      this.createIsaRelationship(superEntityId, subEntityId, {
        hierarchyId,
        constraints: hierarchy.constraints
      });
    }
    
    this.stats.totalHierarchies++;
    
    if (this.config.onHierarchyChange) {
      this.config.onHierarchyChange('create', hierarchy);
    }
    
    if (this.config.onInheritanceCreated) {
      this.config.onInheritanceCreated('hierarchy', hierarchy);
    }
    
    return hierarchy;
  }
  
  /**
   * Create ISA (Is-A) relationship
   */
  createIsaRelationship(superEntityId, subEntityId, options = {}) {
    const relationshipId = options.relationshipId || `isa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const relationship = {
      id: relationshipId,
      type: 'isa',
      superEntityId,
      subEntityId,
      hierarchyId: options.hierarchyId || null,
      constraints: options.constraints || this.config.defaultConstraints,
      attributes: options.attributes || [], // Inherited attributes
      methods: options.methods || [], // Inherited methods (for OO diagrams)
      metadata: options.metadata || {},
      createdAt: Date.now()
    };
    
    // Validate relationship
    if (!this._validateIsaRelationship(relationship)) {
      throw new Error(`Invalid ISA relationship between ${superEntityId} and ${subEntityId}`);
    }
    
    // Store relationship
    this.isaRelationships.set(relationshipId, relationship);
    this.stats.totalIsaRelationships++;
    
    if (this.config.onInheritanceCreated) {
      this.config.onInheritanceCreated('isa', relationship);
    }
    
    return relationship;
  }
  
  /**
   * Create category (union) relationship
   */
  createCategoryRelationship(categoryEntityId, memberEntityIds, options = {}) {
    const categoryId = options.categoryId || `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const category = {
      id: categoryId,
      type: 'category',
      categoryEntityId,
      memberEntityIds: new Set(memberEntityIds),
      unionType: options.unionType || 'total', // total, partial
      constraints: options.constraints || {},
      metadata: options.metadata || {},
      createdAt: Date.now()
    };
    
    // Validate category
    if (!this._validateCategoryRelationship(category)) {
      throw new Error(`Invalid category relationship for ${categoryEntityId}`);
    }
    
    // Store category
    this.categoryRelationships.set(categoryId, category);
    this.stats.totalCategoryRelationships++;
    
    if (this.config.onInheritanceCreated) {
      this.config.onInheritanceCreated('category', category);
    }
    
    return category;
  }
  
  /**
   * Add subentity to existing hierarchy
   */
  addSubEntity(hierarchyId, subEntityId, options = {}) {
    const hierarchy = this.hierarchies.get(hierarchyId);
    if (!hierarchy) {
      throw new Error(`Hierarchy ${hierarchyId} not found`);
    }
    
    // Check if entity is already in hierarchy
    if (hierarchy.subEntityIds.has(subEntityId)) {
      return false;
    }
    
    // Validate addition
    const tempHierarchy = {
      ...hierarchy,
      subEntityIds: new Set([...hierarchy.subEntityIds, subEntityId])
    };
    
    const validation = this.validateHierarchy(tempHierarchy);
    if (!validation.isValid) {
      throw new Error(`Cannot add subentity: ${validation.errors.join(', ')}`);
    }
    
    // Add subentity
    hierarchy.subEntityIds.add(subEntityId);
    this.entityHierarchyMap.set(subEntityId, hierarchyId);
    
    // Create ISA relationship
    this.createIsaRelationship(hierarchy.superEntityId, subEntityId, {
      hierarchyId,
      constraints: hierarchy.constraints
    });
    
    if (this.config.onHierarchyChange) {
      this.config.onHierarchyChange('addSubEntity', hierarchy, subEntityId);
    }
    
    return true;
  }
  
  /**
   * Remove subentity from hierarchy
   */
  removeSubEntity(hierarchyId, subEntityId) {
    const hierarchy = this.hierarchies.get(hierarchyId);
    if (!hierarchy) {
      throw new Error(`Hierarchy ${hierarchyId} not found`);
    }
    
    if (!hierarchy.subEntityIds.has(subEntityId)) {
      return false;
    }
    
    // Remove from hierarchy
    hierarchy.subEntityIds.delete(subEntityId);
    this.entityHierarchyMap.delete(subEntityId);
    
    // Remove ISA relationship
    this._removeIsaRelationshipByEntities(hierarchy.superEntityId, subEntityId);
    
    // Clear inheritance cache
    this._clearInheritanceCache(subEntityId);
    
    if (this.config.onHierarchyChange) {
      this.config.onHierarchyChange('removeSubEntity', hierarchy, subEntityId);
    }
    
    return true;
  }
  
  /**
   * Get inheritance hierarchy for entity
   */
  getEntityHierarchy(entityId) {
    const hierarchyId = this.entityHierarchyMap.get(entityId);
    if (!hierarchyId) return null;
    
    return this.hierarchies.get(hierarchyId);
  }
  
  /**
   * Get all superclasses for entity (direct and indirect)
   */
  getSuperclasses(entityId, includeIndirect = true) {
    const superclasses = [];
    const visited = new Set();
    
    const findSuperclasses = (currentEntityId) => {
      if (visited.has(currentEntityId)) return; // Prevent cycles
      visited.add(currentEntityId);
      
      // Find direct superclasses
      for (const [relationshipId, relationship] of this.isaRelationships) {
        if (relationship.subEntityId === currentEntityId) {
          const superEntityId = relationship.superEntityId;
          superclasses.push({
            entityId: superEntityId,
            relationshipId: relationshipId,
            direct: currentEntityId === entityId,
            level: this._getInheritanceLevel(entityId, superEntityId)
          });
          
          // Recursively find indirect superclasses
          if (includeIndirect) {
            findSuperclasses(superEntityId);
          }
        }
      }
    };
    
    findSuperclasses(entityId);
    return superclasses;
  }
  
  /**
   * Get all subclasses for entity (direct and indirect)
   */
  getSubclasses(entityId, includeIndirect = true) {
    const subclasses = [];
    const visited = new Set();
    
    const findSubclasses = (currentEntityId) => {
      if (visited.has(currentEntityId)) return; // Prevent cycles
      visited.add(currentEntityId);
      
      // Find direct subclasses
      for (const [relationshipId, relationship] of this.isaRelationships) {
        if (relationship.superEntityId === currentEntityId) {
          const subEntityId = relationship.subEntityId;
          subclasses.push({
            entityId: subEntityId,
            relationshipId: relationshipId,
            direct: currentEntityId === entityId,
            level: this._getInheritanceLevel(subEntityId, entityId)
          });
          
          // Recursively find indirect subclasses
          if (includeIndirect) {
            findSubclasses(subEntityId);
          }
        }
      }
    };
    
    findSubclasses(entityId);
    return subclasses;
  }
  
  /**
   * Check if entity inherits from another entity
   */
  inheritsFrom(subEntityId, superEntityId) {
    const superclasses = this.getSuperclasses(subEntityId, true);
    return superclasses.some(sc => sc.entityId === superEntityId);
  }
  
  /**
   * Get inherited attributes for entity
   */
  getInheritedAttributes(entityId) {
    const inheritedAttributes = new Map();
    const superclasses = this.getSuperclasses(entityId, true);
    
    // Collect attributes from all superclasses
    for (const superclass of superclasses) {
      const relationship = this.isaRelationships.get(superclass.relationshipId);
      if (relationship && relationship.attributes) {
        for (const attr of relationship.attributes) {
          if (!inheritedAttributes.has(attr.name)) {
            inheritedAttributes.set(attr.name, {
              ...attr,
              inheritedFrom: superclass.entityId,
              inheritanceLevel: superclass.level
            });
          }
        }
      }
    }
    
    return Array.from(inheritedAttributes.values());
  }
  
  /**
   * Validate inheritance hierarchy
   */
  validateHierarchy(hierarchy) {
    const errors = [];
    const warnings = [];
    
    // Run all validation rules
    for (const [ruleName, rule] of this.validationRules) {
      try {
        const result = rule(hierarchy, this);
        if (!result.isValid) {
          errors.push(...result.errors);
        }
        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      } catch (error) {
        errors.push(`Validation rule '${ruleName}' failed: ${error.message}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Update inheritance constraints
   */
  updateConstraints(hierarchyId, constraints) {
    const hierarchy = this.hierarchies.get(hierarchyId);
    if (!hierarchy) {
      throw new Error(`Hierarchy ${hierarchyId} not found`);
    }
    
    // Validate new constraints
    const tempHierarchy = {
      ...hierarchy,
      constraints: { ...hierarchy.constraints, ...constraints }
    };
    
    const validation = this.validateHierarchy(tempHierarchy);
    if (!validation.isValid) {
      throw new Error(`Invalid constraints: ${validation.errors.join(', ')}`);
    }
    
    // Update constraints
    hierarchy.constraints = { ...hierarchy.constraints, ...constraints };
    this.inheritanceConstraints.set(hierarchyId, hierarchy.constraints);
    
    // Update related ISA relationships
    for (const [relationshipId, relationship] of this.isaRelationships) {
      if (relationship.hierarchyId === hierarchyId) {
        relationship.constraints = hierarchy.constraints;
      }
    }
    
    if (this.config.onHierarchyChange) {
      this.config.onHierarchyChange('updateConstraints', hierarchy);
    }
  }
  
  /**
   * Remove hierarchy
   */
  removeHierarchy(hierarchyId) {
    const hierarchy = this.hierarchies.get(hierarchyId);
    if (!hierarchy) {
      return false;
    }
    
    // Remove all ISA relationships in hierarchy
    const relationshipsToRemove = [];
    for (const [relationshipId, relationship] of this.isaRelationships) {
      if (relationship.hierarchyId === hierarchyId) {
        relationshipsToRemove.push(relationshipId);
      }
    }
    
    for (const relationshipId of relationshipsToRemove) {
      this.isaRelationships.delete(relationshipId);
      this.stats.totalIsaRelationships--;
    }
    
    // Clear entity mappings
    this.entityHierarchyMap.delete(hierarchy.superEntityId);
    for (const subEntityId of hierarchy.subEntityIds) {
      this.entityHierarchyMap.delete(subEntityId);
    }
    
    // Remove hierarchy
    this.hierarchies.delete(hierarchyId);
    this.inheritanceConstraints.delete(hierarchyId);
    this.stats.totalHierarchies--;
    
    if (this.config.onHierarchyChange) {
      this.config.onHierarchyChange('remove', hierarchy);
    }
    
    if (this.config.onInheritanceRemoved) {
      this.config.onInheritanceRemoved('hierarchy', hierarchy);
    }
    
    return true;
  }
  
  /**
   * Get inheritance statistics
   */
  getStats() {
    const stats = { ...this.stats };
    
    // Calculate additional stats
    stats.averageSubEntitiesPerHierarchy = this.hierarchies.size > 0 
      ? Array.from(this.hierarchies.values()).reduce((sum, h) => sum + h.subEntityIds.size, 0) / this.hierarchies.size
      : 0;
    
    stats.maxInheritanceDepth = this._calculateMaxInheritanceDepth();
    stats.entitiesWithInheritance = this.entityHierarchyMap.size;
    
    return stats;
  }
  
  /**
   * Export inheritance data
   */
  exportInheritanceData() {
    return {
      hierarchies: Array.from(this.hierarchies.entries()).map(([id, hierarchy]) => ({
        id,
        ...hierarchy,
        subEntityIds: Array.from(hierarchy.subEntityIds)
      })),
      isaRelationships: Array.from(this.isaRelationships.entries()),
      categoryRelationships: Array.from(this.categoryRelationships.entries()).map(([id, category]) => ({
        id,
        ...category,
        memberEntityIds: Array.from(category.memberEntityIds)
      })),
      constraints: Array.from(this.inheritanceConstraints.entries()),
      stats: this.getStats(),
      exportedAt: Date.now()
    };
  }
  
  /**
   * Import inheritance data
   */
  importInheritanceData(data, options = {}) {
    const clearExisting = options.clearExisting !== false;
    
    if (clearExisting) {
      this.clearAll();
    }
    
    try {
      // Import hierarchies
      if (data.hierarchies) {
        for (const hierarchyData of data.hierarchies) {
          const hierarchy = {
            ...hierarchyData,
            subEntityIds: new Set(hierarchyData.subEntityIds)
          };
          this.hierarchies.set(hierarchy.id, hierarchy);
          
          // Update entity mappings
          this.entityHierarchyMap.set(hierarchy.superEntityId, hierarchy.id);
          for (const subEntityId of hierarchy.subEntityIds) {
            this.entityHierarchyMap.set(subEntityId, hierarchy.id);
          }
        }
      }
      
      // Import ISA relationships
      if (data.isaRelationships) {
        for (const [id, relationship] of data.isaRelationships) {
          this.isaRelationships.set(id, relationship);
        }
      }
      
      // Import category relationships
      if (data.categoryRelationships) {
        for (const categoryData of data.categoryRelationships) {
          const category = {
            ...categoryData,
            memberEntityIds: new Set(categoryData.memberEntityIds)
          };
          this.categoryRelationships.set(category.id, category);
        }
      }
      
      // Import constraints
      if (data.constraints) {
        for (const [hierarchyId, constraints] of data.constraints) {
          this.inheritanceConstraints.set(hierarchyId, constraints);
        }
      }
      
      // Update stats
      this.stats.totalHierarchies = this.hierarchies.size;
      this.stats.totalIsaRelationships = this.isaRelationships.size;
      this.stats.totalCategoryRelationships = this.categoryRelationships.size;
      
      return true;
      
    } catch (error) {
      console.error('Failed to import inheritance data:', error);
      if (clearExisting) {
        this.clearAll(); // Reset on failure
      }
      throw error;
    }
  }
  
  /**
   * Clear all inheritance data
   */
  clearAll() {
    this.hierarchies.clear();
    this.isaRelationships.clear();
    this.categoryRelationships.clear();
    this.entityHierarchyMap.clear();
    this.inheritanceConstraints.clear();
    
    this.stats = {
      totalHierarchies: 0,
      totalIsaRelationships: 0,
      totalCategoryRelationships: 0,
      constraintViolations: 0
    };
  }
  
  /**
   * Add custom validation rule
   */
  addValidationRule(name, rule) {
    if (typeof rule === 'function') {
      this.validationRules.set(name, rule);
    }
  }
  
  /**
   * Remove validation rule
   */
  removeValidationRule(name) {
    return this.validationRules.delete(name);
  }
  
  // Private helper methods
  
  /**
   * Initialize built-in validation rules
   */
  _initializeValidationRules() {
    // No circular inheritance
    this.addValidationRule('noCircularInheritance', (hierarchy, manager) => {
      const errors = [];
      const visited = new Set();
      
      const checkCircular = (entityId, path = []) => {
        if (path.includes(entityId)) {
          errors.push(`Circular inheritance detected: ${path.join(' -> ')} -> ${entityId}`);
          return;
        }
        
        if (visited.has(entityId)) return;
        visited.add(entityId);
        
        const superclasses = manager.getSuperclasses(entityId, false);
        for (const superclass of superclasses) {
          checkCircular(superclass.entityId, [...path, entityId]);
        }
      };
      
      checkCircular(hierarchy.superEntityId);
      for (const subEntityId of hierarchy.subEntityIds) {
        checkCircular(subEntityId);
      }
      
      return { isValid: errors.length === 0, errors };
    });
    
    // Multiple inheritance check
    this.addValidationRule('multipleInheritanceCheck', (hierarchy, manager) => {
      if (manager.config.allowMultipleInheritance) {
        return { isValid: true, errors: [] };
      }
      
      const errors = [];
      for (const subEntityId of hierarchy.subEntityIds) {
        const superclasses = manager.getSuperclasses(subEntityId, false);
        if (superclasses.length > 1) {
          errors.push(`Multiple inheritance not allowed: ${subEntityId} inherits from multiple entities`);
        }
      }
      
      return { isValid: errors.length === 0, errors };
    });
    
    // Constraint consistency
    this.addValidationRule('constraintConsistency', (hierarchy, manager) => {
      const errors = [];
      const warnings = [];
      
      // Total completeness with partial subentities
      if (hierarchy.constraints.completeness === 'total') {
        // Could add more sophisticated checks here
        warnings.push('Total completeness constraint may require all instances to belong to a subclass');
      }
      
      // Overlapping with unique constraints
      if (hierarchy.constraints.disjointness === 'overlapping') {
        warnings.push('Overlapping inheritance may require additional validation');
      }
      
      return { isValid: errors.length === 0, errors, warnings };
    });
  }
  
  /**
   * Validate ISA relationship
   */
  _validateIsaRelationship(relationship) {
    // Check entities exist (would need entity registry in real implementation)
    if (!relationship.superEntityId || !relationship.subEntityId) {
      return false;
    }
    
    // Check for self-inheritance
    if (relationship.superEntityId === relationship.subEntityId) {
      return false;
    }
    
    // Check for duplicate relationships
    for (const [existingId, existing] of this.isaRelationships) {
      if (existing.superEntityId === relationship.superEntityId &&
          existing.subEntityId === relationship.subEntityId) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Validate category relationship
   */
  _validateCategoryRelationship(category) {
    // Check category entity exists
    if (!category.categoryEntityId) {
      return false;
    }
    
    // Check member entities
    if (!category.memberEntityIds || category.memberEntityIds.size === 0) {
      return false;
    }
    
    // Check for self-reference
    if (category.memberEntityIds.has(category.categoryEntityId)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Remove ISA relationship by entities
   */
  _removeIsaRelationshipByEntities(superEntityId, subEntityId) {
    for (const [relationshipId, relationship] of this.isaRelationships) {
      if (relationship.superEntityId === superEntityId && 
          relationship.subEntityId === subEntityId) {
        this.isaRelationships.delete(relationshipId);
        this.stats.totalIsaRelationships--;
        
        if (this.config.onInheritanceRemoved) {
          this.config.onInheritanceRemoved('isa', relationship);
        }
        break;
      }
    }
  }
  
  /**
   * Clear inheritance cache for entity
   */
  _clearInheritanceCache(entityId) {
    // Could implement caching mechanisms here
    // For now, just a placeholder
  }
  
  /**
   * Get inheritance level between entities
   */
  _getInheritanceLevel(subEntityId, superEntityId) {
    let level = 0;
    const visited = new Set();
    
    const findLevel = (currentEntityId) => {
      if (visited.has(currentEntityId)) return -1; // Cycle detected
      if (currentEntityId === superEntityId) return level;
      
      visited.add(currentEntityId);
      level++;
      
      for (const [relationshipId, relationship] of this.isaRelationships) {
        if (relationship.subEntityId === currentEntityId) {
          const result = findLevel(relationship.superEntityId);
          if (result !== -1) return result;
        }
      }
      
      level--;
      visited.delete(currentEntityId);
      return -1;
    };
    
    return findLevel(subEntityId);
  }
  
  /**
   * Calculate maximum inheritance depth
   */
  _calculateMaxInheritanceDepth() {
    let maxDepth = 0;
    
    for (const [hierarchyId, hierarchy] of this.hierarchies) {
      for (const subEntityId of hierarchy.subEntityIds) {
        const depth = this._getInheritanceDepth(subEntityId);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    
    return maxDepth;
  }
  
  /**
   * Get inheritance depth for entity
   */
  _getInheritanceDepth(entityId, visited = new Set()) {
    if (visited.has(entityId)) return 0; // Prevent cycles
    visited.add(entityId);
    
    let maxDepth = 0;
    const superclasses = this.getSuperclasses(entityId, false);
    
    for (const superclass of superclasses) {
      const depth = 1 + this._getInheritanceDepth(superclass.entityId, visited);
      maxDepth = Math.max(maxDepth, depth);
    }
    
    visited.delete(entityId);
    return maxDepth;
  }
  
  /**
   * Destroy and cleanup
   */
  destroy() {
    this.clearAll();
    this.validationRules.clear();
  }
}

export default InheritanceManager;