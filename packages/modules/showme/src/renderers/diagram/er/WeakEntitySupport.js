/**
 * WeakEntitySupport - Support for weak entities in ER diagrams
 * 
 * Features:
 * - Weak entity identification and management
 * - Identifying relationship handling
 * - Partial key management
 * - Strong entity dependency tracking
 * - Cascade operations for weak entities
 * - Weak entity visualization (double rectangle)
 * - Discriminator attribute support
 * - Total participation enforcement
 */

export class WeakEntitySupport {
  constructor(config = {}) {
    this.config = {
      // Visual configuration for weak entities
      style: {
        borderStyle: config.style?.borderStyle || 'double', // double, dashed, dotted
        borderWidth: config.style?.borderWidth || 2,
        borderSpacing: config.style?.borderSpacing || 3,
        borderColor: config.style?.borderColor || '#666666',
        backgroundColor: config.style?.backgroundColor || '#F5F5F5',
        
        // Identifying relationship style
        identifyingLineWidth: config.style?.identifyingLineWidth || 3,
        identifyingLineStyle: config.style?.identifyingLineStyle || 'solid',
        identifyingDiamondFilled: config.style?.identifyingDiamondFilled !== false,
        
        // Partial key visualization
        partialKeyUnderline: config.style?.partialKeyUnderline !== false,
        partialKeyStyle: config.style?.partialKeyStyle || 'dashed',
        partialKeyColor: config.style?.partialKeyColor || '#888888'
      },
      
      // Validation rules
      validation: {
        requireIdentifyingRelationship: config.validation?.requireIdentifyingRelationship !== false,
        requirePartialKey: config.validation?.requirePartialKey !== false,
        requireTotalParticipation: config.validation?.requireTotalParticipation !== false,
        allowMultipleIdentifying: config.validation?.allowMultipleIdentifying || false,
        validateCascadeDelete: config.validation?.validateCascadeDelete !== false
      },
      
      // Behavioral configuration
      behavior: {
        autoCreateIdentifyingRelationship: config.behavior?.autoCreateIdentifyingRelationship || false,
        cascadeDelete: config.behavior?.cascadeDelete !== false,
        cascadeUpdate: config.behavior?.cascadeUpdate !== false,
        maintainReferentialIntegrity: config.behavior?.maintainReferentialIntegrity !== false
      },
      
      ...config
    };
    
    // Internal state
    this.weakEntities = new Map();
    this.identifyingRelationships = new Map();
    this.strongEntityDependencies = new Map();
    this.partialKeys = new Map();
  }
  
  /**
   * Register a weak entity
   */
  registerWeakEntity(entity, strongEntity = null, identifyingRelationship = null) {
    if (!entity || !entity.id) {
      throw new Error('Invalid entity provided');
    }
    
    const weakEntityData = {
      id: entity.id,
      name: entity.name,
      entity: entity,
      strongEntity: strongEntity,
      identifyingRelationship: identifyingRelationship,
      partialKeys: [],
      attributes: entity.attributes || [],
      createdAt: Date.now()
    };
    
    // Validate if required
    if (this.config.validation.requireIdentifyingRelationship && !identifyingRelationship) {
      if (!this.config.behavior.autoCreateIdentifyingRelationship) {
        throw new Error(`Weak entity '${entity.name}' requires an identifying relationship`);
      }
      // Auto-create identifying relationship if configured
      weakEntityData.identifyingRelationship = this._createIdentifyingRelationship(entity, strongEntity);
    }
    
    if (this.config.validation.requirePartialKey) {
      const hasPartialKey = entity.attributes?.some(attr => attr.isPartialKey);
      if (!hasPartialKey) {
        throw new Error(`Weak entity '${entity.name}' requires at least one partial key`);
      }
    }
    
    this.weakEntities.set(entity.id, weakEntityData);
    
    // Track dependency
    if (strongEntity) {
      this._addDependency(strongEntity.id, entity.id);
    }
    
    // Track identifying relationship
    if (identifyingRelationship) {
      this.identifyingRelationships.set(identifyingRelationship.id, {
        weakEntity: entity.id,
        strongEntity: strongEntity?.id,
        relationship: identifyingRelationship
      });
    }
    
    return weakEntityData;
  }
  
  /**
   * Create identifying relationship automatically
   */
  _createIdentifyingRelationship(weakEntity, strongEntity) {
    if (!strongEntity) {
      throw new Error('Strong entity required to create identifying relationship');
    }
    
    return {
      id: `identifying_rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `identifies_${weakEntity.name}`,
      type: 'identifying',
      source: strongEntity.id,
      target: weakEntity.id,
      cardinality: {
        source: '1',
        target: '*'
      },
      participation: {
        source: 'partial',
        target: 'total' // Weak entity must totally participate
      },
      isIdentifying: true
    };
  }
  
  /**
   * Add dependency tracking
   */
  _addDependency(strongEntityId, weakEntityId) {
    if (!this.strongEntityDependencies.has(strongEntityId)) {
      this.strongEntityDependencies.set(strongEntityId, new Set());
    }
    this.strongEntityDependencies.get(strongEntityId).add(weakEntityId);
  }
  
  /**
   * Add partial key to weak entity
   */
  addPartialKey(weakEntityId, attribute) {
    const weakEntity = this.weakEntities.get(weakEntityId);
    if (!weakEntity) {
      throw new Error(`Weak entity '${weakEntityId}' not found`);
    }
    
    const partialKey = {
      id: attribute.id || `pk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: attribute.name,
      type: attribute.type || 'TEXT',
      isPartialKey: true,
      isDiscriminator: attribute.isDiscriminator || false,
      constraints: attribute.constraints || []
    };
    
    weakEntity.partialKeys.push(partialKey);
    
    if (!this.partialKeys.has(weakEntityId)) {
      this.partialKeys.set(weakEntityId, []);
    }
    this.partialKeys.get(weakEntityId).push(partialKey);
    
    return partialKey;
  }
  
  /**
   * Validate weak entity structure
   */
  validateWeakEntity(entityId) {
    const weakEntity = this.weakEntities.get(entityId);
    if (!weakEntity) {
      return {
        valid: false,
        errors: [`Entity '${entityId}' is not registered as a weak entity`]
      };
    }
    
    const errors = [];
    
    // Check for identifying relationship
    if (this.config.validation.requireIdentifyingRelationship) {
      if (!weakEntity.identifyingRelationship) {
        errors.push('Weak entity must have an identifying relationship');
      } else {
        // Validate identifying relationship properties
        const rel = weakEntity.identifyingRelationship;
        if (this.config.validation.requireTotalParticipation) {
          if (rel.participation?.target !== 'total') {
            errors.push('Weak entity must have total participation in identifying relationship');
          }
        }
      }
    }
    
    // Check for partial key
    if (this.config.validation.requirePartialKey) {
      if (!weakEntity.partialKeys || weakEntity.partialKeys.length === 0) {
        errors.push('Weak entity must have at least one partial key');
      }
    }
    
    // Check for strong entity
    if (!weakEntity.strongEntity) {
      errors.push('Weak entity must be associated with a strong entity');
    }
    
    // Validate cascade rules if configured
    if (this.config.validation.validateCascadeDelete) {
      if (!this.config.behavior.cascadeDelete) {
        errors.push('Cascade delete must be enabled for weak entities');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get complete key for weak entity (partial key + strong entity key)
   */
  getCompleteKey(weakEntityId) {
    const weakEntity = this.weakEntities.get(weakEntityId);
    if (!weakEntity) {
      return null;
    }
    
    const completeKey = {
      partialKeys: weakEntity.partialKeys || [],
      strongEntityKey: null,
      combinedKey: []
    };
    
    // Get strong entity's primary key
    if (weakEntity.strongEntity) {
      const strongEntityAttrs = weakEntity.strongEntity.attributes || [];
      const primaryKey = strongEntityAttrs.find(attr => attr.isPrimaryKey);
      if (primaryKey) {
        completeKey.strongEntityKey = primaryKey;
        completeKey.combinedKey.push({
          ...primaryKey,
          fromStrongEntity: true
        });
      }
    }
    
    // Add partial keys
    completeKey.combinedKey.push(...weakEntity.partialKeys);
    
    return completeKey;
  }
  
  /**
   * Check if entity is weak
   */
  isWeakEntity(entityId) {
    return this.weakEntities.has(entityId);
  }
  
  /**
   * Get strong entity for weak entity
   */
  getStrongEntity(weakEntityId) {
    const weakEntity = this.weakEntities.get(weakEntityId);
    return weakEntity?.strongEntity || null;
  }
  
  /**
   * Get all weak entities dependent on a strong entity
   */
  getDependentWeakEntities(strongEntityId) {
    const dependents = this.strongEntityDependencies.get(strongEntityId);
    if (!dependents) {
      return [];
    }
    
    return Array.from(dependents).map(id => this.weakEntities.get(id)).filter(e => e);
  }
  
  /**
   * Handle cascade delete
   */
  cascadeDelete(strongEntityId) {
    if (!this.config.behavior.cascadeDelete) {
      return { deleted: [], skipped: [] };
    }
    
    const dependents = this.getDependentWeakEntities(strongEntityId);
    const deleted = [];
    const skipped = [];
    
    for (const dependent of dependents) {
      // Check if weak entity has other dependencies
      const hasOtherDependencies = this._hasOtherStrongEntities(dependent.id, strongEntityId);
      
      if (!hasOtherDependencies || !this.config.behavior.maintainReferentialIntegrity) {
        // Delete weak entity
        this.weakEntities.delete(dependent.id);
        deleted.push(dependent.id);
        
        // Recursively delete dependent weak entities
        const nestedDeletes = this.cascadeDelete(dependent.id);
        deleted.push(...nestedDeletes.deleted);
      } else {
        skipped.push(dependent.id);
      }
    }
    
    // Clean up dependency tracking
    this.strongEntityDependencies.delete(strongEntityId);
    
    return { deleted, skipped };
  }
  
  /**
   * Check if weak entity has other strong entity dependencies
   */
  _hasOtherStrongEntities(weakEntityId, excludeStrongEntityId) {
    for (const [strongId, dependents] of this.strongEntityDependencies) {
      if (strongId !== excludeStrongEntityId && dependents.has(weakEntityId)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Create visual representation for weak entity
   */
  createWeakEntityVisual(entity, container) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'weak-entity');
    group.setAttribute('data-entity-id', entity.id);
    
    const width = entity.width || 120;
    const height = entity.height || 80;
    const x = entity.x || 0;
    const y = entity.y || 0;
    
    // Create double rectangle for weak entity
    if (this.config.style.borderStyle === 'double') {
      // Outer rectangle
      const outerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      outerRect.setAttribute('x', x);
      outerRect.setAttribute('y', y);
      outerRect.setAttribute('width', width);
      outerRect.setAttribute('height', height);
      outerRect.setAttribute('fill', this.config.style.backgroundColor);
      outerRect.setAttribute('stroke', this.config.style.borderColor);
      outerRect.setAttribute('stroke-width', this.config.style.borderWidth);
      group.appendChild(outerRect);
      
      // Inner rectangle
      const spacing = this.config.style.borderSpacing;
      const innerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      innerRect.setAttribute('x', x + spacing);
      innerRect.setAttribute('y', y + spacing);
      innerRect.setAttribute('width', width - spacing * 2);
      innerRect.setAttribute('height', height - spacing * 2);
      innerRect.setAttribute('fill', 'none');
      innerRect.setAttribute('stroke', this.config.style.borderColor);
      innerRect.setAttribute('stroke-width', this.config.style.borderWidth);
      group.appendChild(innerRect);
    } else {
      // Single rectangle with different style
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', width);
      rect.setAttribute('height', height);
      rect.setAttribute('fill', this.config.style.backgroundColor);
      rect.setAttribute('stroke', this.config.style.borderColor);
      rect.setAttribute('stroke-width', this.config.style.borderWidth);
      
      if (this.config.style.borderStyle === 'dashed') {
        rect.setAttribute('stroke-dasharray', '5,5');
      } else if (this.config.style.borderStyle === 'dotted') {
        rect.setAttribute('stroke-dasharray', '2,2');
      }
      
      group.appendChild(rect);
    }
    
    // Add entity name
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x + width / 2);
    text.setAttribute('y', y + 20);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', '#000000');
    text.textContent = entity.name;
    group.appendChild(text);
    
    // Add partial keys with special styling
    let attrY = y + 40;
    const weakEntityData = this.weakEntities.get(entity.id);
    
    if (weakEntityData) {
      for (const partialKey of weakEntityData.partialKeys) {
        const pkText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        pkText.setAttribute('x', x + width / 2);
        pkText.setAttribute('y', attrY);
        pkText.setAttribute('text-anchor', 'middle');
        pkText.setAttribute('font-size', '12');
        pkText.setAttribute('fill', this.config.style.partialKeyColor);
        
        // Add underline for partial keys
        if (this.config.style.partialKeyUnderline) {
          pkText.setAttribute('text-decoration', 'underline');
          if (this.config.style.partialKeyStyle === 'dashed') {
            pkText.setAttribute('text-decoration-style', 'dashed');
          }
        }
        
        pkText.textContent = partialKey.name;
        group.appendChild(pkText);
        
        attrY += 18;
      }
    }
    
    if (container) {
      container.appendChild(group);
    }
    
    return group;
  }
  
  /**
   * Create identifying relationship visual
   */
  createIdentifyingRelationshipVisual(relationship, container) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'identifying-relationship');
    group.setAttribute('data-relationship-id', relationship.id);
    
    const x = relationship.x || 0;
    const y = relationship.y || 0;
    const size = 30;
    
    // Create double diamond for identifying relationship
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const points = [
      `${x},${y - size}`,
      `${x + size},${y}`,
      `${x},${y + size}`,
      `${x - size},${y}`
    ].join(' ');
    
    diamond.setAttribute('points', points);
    diamond.setAttribute('fill', this.config.style.identifyingDiamondFilled ? 
      this.config.style.borderColor : this.config.style.backgroundColor);
    diamond.setAttribute('stroke', this.config.style.borderColor);
    diamond.setAttribute('stroke-width', this.config.style.identifyingLineWidth);
    group.appendChild(diamond);
    
    // Add inner diamond for double diamond effect
    const innerSize = size - 5;
    const innerDiamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const innerPoints = [
      `${x},${y - innerSize}`,
      `${x + innerSize},${y}`,
      `${x},${y + innerSize}`,
      `${x - innerSize},${y}`
    ].join(' ');
    
    innerDiamond.setAttribute('points', innerPoints);
    innerDiamond.setAttribute('fill', this.config.style.backgroundColor);
    innerDiamond.setAttribute('stroke', this.config.style.borderColor);
    innerDiamond.setAttribute('stroke-width', this.config.style.borderWidth);
    group.appendChild(innerDiamond);
    
    // Add relationship name
    if (relationship.name) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '12');
      text.setAttribute('fill', '#000000');
      text.textContent = relationship.name;
      group.appendChild(text);
    }
    
    if (container) {
      container.appendChild(group);
    }
    
    return group;
  }
  
  /**
   * Convert weak entity to strong entity
   */
  convertToStrongEntity(weakEntityId) {
    const weakEntity = this.weakEntities.get(weakEntityId);
    if (!weakEntity) {
      throw new Error(`Weak entity '${weakEntityId}' not found`);
    }
    
    // Remove from weak entities
    this.weakEntities.delete(weakEntityId);
    
    // Remove from dependencies
    for (const [strongId, dependents] of this.strongEntityDependencies) {
      dependents.delete(weakEntityId);
    }
    
    // Convert partial keys to primary keys
    const entity = weakEntity.entity;
    if (entity.attributes) {
      for (const attr of entity.attributes) {
        if (attr.isPartialKey) {
          attr.isPartialKey = false;
          attr.isPrimaryKey = true;
        }
      }
    }
    
    // Remove identifying relationship tracking
    for (const [relId, relData] of this.identifyingRelationships) {
      if (relData.weakEntity === weakEntityId) {
        this.identifyingRelationships.delete(relId);
      }
    }
    
    return entity;
  }
  
  /**
   * Get all weak entities
   */
  getAllWeakEntities() {
    return Array.from(this.weakEntities.values());
  }
  
  /**
   * Get all identifying relationships
   */
  getAllIdentifyingRelationships() {
    return Array.from(this.identifyingRelationships.values());
  }
  
  /**
   * Serialize weak entity support data
   */
  serialize() {
    return {
      weakEntities: Array.from(this.weakEntities.entries()),
      identifyingRelationships: Array.from(this.identifyingRelationships.entries()),
      strongEntityDependencies: Array.from(this.strongEntityDependencies.entries()).map(([k, v]) => [k, Array.from(v)]),
      partialKeys: Array.from(this.partialKeys.entries()),
      config: this.config
    };
  }
  
  /**
   * Deserialize weak entity support data
   */
  static deserialize(data) {
    const support = new WeakEntitySupport(data.config);
    
    // Restore weak entities
    for (const [id, entity] of data.weakEntities) {
      support.weakEntities.set(id, entity);
    }
    
    // Restore identifying relationships
    for (const [id, rel] of data.identifyingRelationships) {
      support.identifyingRelationships.set(id, rel);
    }
    
    // Restore dependencies
    for (const [id, deps] of data.strongEntityDependencies) {
      support.strongEntityDependencies.set(id, new Set(deps));
    }
    
    // Restore partial keys
    for (const [id, keys] of data.partialKeys) {
      support.partialKeys.set(id, keys);
    }
    
    return support;
  }
  
  /**
   * Clear all weak entity data
   */
  clear() {
    this.weakEntities.clear();
    this.identifyingRelationships.clear();
    this.strongEntityDependencies.clear();
    this.partialKeys.clear();
  }
}

export default WeakEntitySupport;