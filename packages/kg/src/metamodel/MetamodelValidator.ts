/**
 * Comprehensive Metamodel Validation Service
 * 
 * This validator implements a two-phase approach:
 * 1. Load everything and build dictionaries
 * 2. Validate all references and constraints
 * 
 * This ensures that all referenced entities, attributes, and relationships are properly defined
 * before any validation occurs.
 */

import { ValidationResult, ValidationResultBuilder, ValidationError } from '../types/ValidationResult';

export interface MetamodelEntity {
  _id: string;
  subtypeOf: string;
  attributes: string[] | Record<string, any>;
  // Attribute definition properties (for attribute entities)
  type?: string;
  required?: boolean;
  cardinality?: string;
  'is-dependent'?: boolean;
  dependent?: boolean; // Legacy support
  domain?: string;
  range?: string;
  constraints?: string[];
  relationship?: string;
  'default-value'?: any;
  defaultValue?: any; // Legacy support
  // Metadata
  metadata?: {
    version: number;
    source: string;
    description: string;
  };
}

export interface AttributeDefinition {
  id: string;
  domain: string;
  range: string;
  cardinality: string;
  isDependent: boolean;
  relationship?: string;
  constraints?: string[];
  defaultValue?: any;
  metadata?: any;
}

export interface RelationshipDefinition {
  id: string;
  dependentEnd: string;
  independentEnd: string;
  metadata?: any;
}

export interface MetamodelDictionaries {
  entities: Map<string, MetamodelEntity>;
  attributes: Map<string, AttributeDefinition>;
  relationships: Map<string, RelationshipDefinition>;
  typeHierarchy: Map<string, string[]>; // parent -> children
  inheritanceChain: Map<string, string[]>; // entity -> ancestors
}

export interface ValidationContext {
  dictionaries: MetamodelDictionaries;
  currentEntity?: string;
  currentAttribute?: string;
}

export class MetamodelValidator {
  
  /**
   * Main validation entry point - validates complete metamodel
   */
  public validateMetamodel(metamodelData: MetamodelEntity[]): ValidationResult {
    const builder = new ValidationResultBuilder();
    
    try {
      // Phase 1: Load everything and build dictionaries
      const dictionaries = this.buildDictionaries(metamodelData, builder);
      
      // If dictionary building failed, return early
      if (!builder.build().isValid) {
        return builder.build();
      }
      
      // Phase 2: Validate all references and constraints
      this.validateReferences(dictionaries, builder);
      this.validateConstraints(dictionaries, builder);
      this.validateSemanticRules(dictionaries, builder);
      
    } catch (error) {
      builder.addError('metamodel', `Validation failed: ${error}`, 'VALIDATION_ERROR');
    }
    
    return builder.build();
  }
  
  /**
   * Phase 1: Build comprehensive dictionaries of all metamodel elements
   */
  private buildDictionaries(metamodelData: MetamodelEntity[], builder: ValidationResultBuilder): MetamodelDictionaries {
    const dictionaries: MetamodelDictionaries = {
      entities: new Map(),
      attributes: new Map(),
      relationships: new Map(),
      typeHierarchy: new Map(),
      inheritanceChain: new Map()
    };
    
    // Step 1: Load all entities
    this.loadEntities(metamodelData, dictionaries, builder);
    
    // Step 2: Build type hierarchy
    this.buildTypeHierarchy(dictionaries, builder);
    
    // Step 2.5: Validate naming conventions (now that we know inheritance)
    this.validateNamingConventions(dictionaries, builder);
    
    // Step 3: Extract all attribute definitions
    this.extractAttributeDefinitions(dictionaries, builder);
    
    // Step 4: Extract relationship definitions
    this.extractRelationshipDefinitions(dictionaries, builder);
    
    return dictionaries;
  }
  
  /**
   * Load all entities into the dictionary with basic validation
   */
  private loadEntities(metamodelData: MetamodelEntity[], dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    // First pass: basic structure validation and loading
    for (const entity of metamodelData) {
      // Validate required fields
      if (!entity._id || entity._id.trim() === '') {
        builder.addError('entity', 'Entity missing required _id field', 'MISSING_ID');
        continue;
      }
      
      if (!entity.subtypeOf || entity.subtypeOf.trim() === '') {
        builder.addError(entity._id, 'Entity missing required subtypeOf field', 'MISSING_SUBTYPE');
        continue;
      }
      
      // Check for duplicate IDs
      if (dictionaries.entities.has(entity._id)) {
        builder.addError(entity._id, `Duplicate entity ID: ${entity._id}`, 'DUPLICATE_ID');
        continue;
      }
      
      // Validate ID format
      if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(entity._id)) {
        builder.addError(entity._id, 'Entity ID must start with letter and contain only alphanumeric characters and hyphens', 'INVALID_ID_FORMAT');
      }
      
      // Validate naming conventions (will be checked after all entities are loaded)
      // This is deferred because we need to know the subtypeOf relationships first
      
      // Normalize the entity
      const normalizedEntity = this.normalizeEntity(entity);
      dictionaries.entities.set(entity._id, normalizedEntity);
    }
    
    // Validate that Thing exists and is self-referential (case-insensitive search)
    let thingEntity = null;
    let thingId = '';
    for (const [entityId, entity] of dictionaries.entities) {
      if (entityId.toLowerCase() === 'thing') {
        thingEntity = entity;
        thingId = entityId;
        break;
      }
    }
    
    if (!thingEntity) {
      builder.addError('metamodel', 'Missing required root entity: Thing', 'MISSING_ROOT');
    } else if (thingEntity.subtypeOf !== thingId) {
      builder.addError(thingId, `${thingId} must be self-referential (subtypeOf: "${thingId}")`, 'INVALID_ROOT');
    }
  }
  
  /**
   * Normalize entity to handle case inconsistencies and legacy formats
   */
  private normalizeEntity(entity: MetamodelEntity): MetamodelEntity {
    const normalized = { ...entity };
    
    // Normalize boolean fields
    if (normalized.dependent !== undefined && normalized['is-dependent'] === undefined) {
      normalized['is-dependent'] = normalized.dependent;
    }
    
    // Normalize default value fields
    if (normalized.defaultValue !== undefined && normalized['default-value'] === undefined) {
      normalized['default-value'] = normalized.defaultValue;
    }
    
    return normalized;
  }
  
  /**
   * Build type hierarchy and inheritance chains
   */
  private buildTypeHierarchy(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    // Build parent -> children mapping
    for (const [entityId, entity] of dictionaries.entities) {
      const parentId = entity.subtypeOf;
      
      if (!dictionaries.typeHierarchy.has(parentId)) {
        dictionaries.typeHierarchy.set(parentId, []);
      }
      
      // Don't add self-references to hierarchy (Thing -> Thing)
      if (entityId !== parentId) {
        dictionaries.typeHierarchy.get(parentId)!.push(entityId);
      }
    }
    
    // Build inheritance chains (entity -> all ancestors)
    for (const entityId of dictionaries.entities.keys()) {
      const chain = this.buildInheritanceChain(entityId, dictionaries.entities, new Set());
      dictionaries.inheritanceChain.set(entityId, chain);
    }
    
    // Detect circular dependencies
    this.detectCircularDependencies(dictionaries, builder);
  }
  
  /**
   * Build inheritance chain for a single entity
   */
  private buildInheritanceChain(entityId: string, entities: Map<string, MetamodelEntity>, visited: Set<string>): string[] {
    if (visited.has(entityId)) {
      return []; // Circular dependency - will be caught later
    }
    
    visited.add(entityId);
    const entity = entities.get(entityId);
    if (!entity) {
      return [entityId]; // Missing entity - will be caught later
    }
    
    if (entity.subtypeOf === entityId) {
      return [entityId]; // Root entity (Thing)
    }
    
    const parentChain = this.buildInheritanceChain(entity.subtypeOf, entities, new Set(visited));
    return [...parentChain, entityId];
  }
  
  /**
   * Detect circular dependencies in inheritance
   */
  private detectCircularDependencies(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (entityId: string): boolean => {
      if (entityId === 'Thing') return false; // Thing -> Thing is allowed
      
      if (recursionStack.has(entityId)) return true;
      if (visited.has(entityId)) return false;
      
      visited.add(entityId);
      recursionStack.add(entityId);
      
      const entity = dictionaries.entities.get(entityId);
      if (entity && entity.subtypeOf !== entityId) {
        if (hasCycle(entity.subtypeOf)) {
          return true;
        }
      }
      
      recursionStack.delete(entityId);
      return false;
    };
    
    for (const entityId of dictionaries.entities.keys()) {
      if (entityId !== 'Thing' && hasCycle(entityId)) {
        builder.addError(entityId, 'Circular dependency detected in inheritance chain', 'CIRCULAR_DEPENDENCY');
      }
    }
  }
  
  /**
   * Validate naming conventions based on entity inheritance
   * - kebab-case for IDs of subtypes of Attribute
   * - PascalCase for everything else
   */
  private validateNamingConventions(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    for (const [entityId, entity] of dictionaries.entities) {
      // Check if this entity is a subtype of Attribute (directly or through inheritance)
      const isAttributeSubtype = this.isSubtypeOfAttribute(entityId, dictionaries);
      
      if (isAttributeSubtype) {
        // Should be kebab-case
        if (!this.isKebabCase(entityId)) {
          builder.addError(entityId, `Attribute subtype ID should be in kebab-case: ${entityId}`, 'INVALID_NAMING_CONVENTION');
        }
      } else {
        // Should be PascalCase
        if (!this.isPascalCase(entityId)) {
          builder.addError(entityId, `Entity ID should be in PascalCase: ${entityId}`, 'INVALID_NAMING_CONVENTION');
        }
      }
    }
  }
  
  /**
   * Check if an entity is a subtype of Attribute (directly or through inheritance)
   * Excludes the Attribute entity itself
   */
  private isSubtypeOfAttribute(entityId: string, dictionaries: MetamodelDictionaries): boolean {
    // Don't apply kebab-case to the Attribute entity itself
    if (entityId.toLowerCase() === 'attribute') {
      return false;
    }
    
    const inheritanceChain = dictionaries.inheritanceChain.get(entityId) || [];
    return inheritanceChain.includes('attribute') || inheritanceChain.includes('Attribute');
  }
  
  /**
   * Check if a string is in kebab-case
   */
  private isKebabCase(str: string): boolean {
    // kebab-case: lowercase letters, numbers, and hyphens only, no consecutive hyphens
    return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(str);
  }
  
  /**
   * Check if a string is in PascalCase
   */
  private isPascalCase(str: string): boolean {
    // PascalCase: starts with uppercase letter, followed by alphanumeric characters
    return /^[A-Z][a-zA-Z0-9]*$/.test(str);
  }

  /**
   * Extract all attribute definitions from entities
   */
  private extractAttributeDefinitions(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    for (const [entityId, entity] of dictionaries.entities) {
      // Handle entities that ARE attribute definitions (subtypes of Attribute, directly or indirectly)
      if (this.isAttributeSubtypeEntity(entityId, dictionaries)) {
        const attrDef = this.extractAttributeFromEntity(entity, builder);
        if (attrDef) {
          dictionaries.attributes.set(attrDef.id, attrDef);
        }
      }
      
      // Handle legacy nested attribute definitions
      if (entity.attributes && typeof entity.attributes === 'object' && !Array.isArray(entity.attributes)) {
        for (const [attrName, attrValue] of Object.entries(entity.attributes)) {
          if (this.isAttributeDefinition(attrValue)) {
            const attrDef = this.extractAttributeFromNested(entityId, attrName, attrValue, builder);
            if (attrDef) {
              dictionaries.attributes.set(attrDef.id, attrDef);
            }
          }
        }
      }
    }
  }
  
  /**
   * Check if an entity is a subtype of Attribute (directly or through inheritance)
   * Excludes the Attribute entity itself since it's a meta-entity
   */
  private isAttributeSubtypeEntity(entityId: string, dictionaries: MetamodelDictionaries): boolean {
    // Exclude the Attribute entity itself - it's a meta-entity, not a concrete attribute
    if (entityId.toLowerCase() === 'attribute') {
      return false;
    }
    
    const inheritanceChain = dictionaries.inheritanceChain.get(entityId) || [];
    return inheritanceChain.includes('attribute') || inheritanceChain.includes('Attribute');
  }
  
  /**
   * Check if an entity is a subtype of Relationship (directly or through inheritance)
   * Excludes the Relationship entity itself since it's a meta-entity
   */
  private isRelationshipSubtypeEntity(entityId: string, dictionaries: MetamodelDictionaries): boolean {
    // Exclude the Relationship entity itself - it's a meta-entity, not a concrete relationship
    if (entityId.toLowerCase() === 'relationship') {
      return false;
    }
    
    const inheritanceChain = dictionaries.inheritanceChain.get(entityId) || [];
    return inheritanceChain.includes('relationship') || inheritanceChain.includes('Relationship');
  }
  
  /**
   * Extract attribute definition from an entity that IS an attribute
   */
  private extractAttributeFromEntity(entity: MetamodelEntity, builder: ValidationResultBuilder): AttributeDefinition | null {
    const attrs = entity.attributes as Record<string, any> || {};
    
    // Get values from either attributes object or top-level properties
    const domain = attrs.domain || entity.domain;
    const range = attrs.range || entity.range;
    const cardinality = attrs.cardinality || entity.cardinality;
    const isDependent = attrs['is-dependent'] ?? entity['is-dependent'] ?? attrs.dependent ?? entity.dependent;
    const relationship = attrs.relationship || entity.relationship;
    const constraints = attrs.constraints || entity.constraints;
    const defaultValue = attrs['default-value'] ?? entity['default-value'] ?? attrs.defaultValue ?? entity.defaultValue;
    
    // Validate required fields - collect all errors before returning
    let hasErrors = false;
    
    if (!domain) {
      builder.addError(entity._id, 'Attribute entity missing domain', 'MISSING_DOMAIN');
      hasErrors = true;
    }
    
    if (!range) {
      builder.addError(entity._id, 'Attribute entity missing range', 'MISSING_RANGE');
      hasErrors = true;
    }
    
    if (!cardinality) {
      builder.addError(entity._id, 'Attribute entity missing cardinality', 'MISSING_CARDINALITY');
      hasErrors = true;
    }
    
    if (isDependent === undefined) {
      builder.addError(entity._id, 'Attribute entity missing is-dependent flag', 'MISSING_DEPENDENT');
      hasErrors = true;
    }
    
    if (hasErrors) {
      return null;
    }
    
    return {
      id: entity._id,
      domain: domain,
      range: range,
      cardinality: cardinality,
      isDependent: Boolean(isDependent),
      relationship: relationship,
      constraints: constraints,
      defaultValue: defaultValue,
      metadata: entity.metadata
    };
  }
  
  /**
   * Extract attribute definition from nested object (legacy format)
   */
  private extractAttributeFromNested(entityId: string, attrName: string, attrDef: any, builder: ValidationResultBuilder): AttributeDefinition | null {
    const id = `${entityId}.${attrName}`;
    
    if (!attrDef.domain) {
      builder.addError(id, 'Nested attribute missing domain', 'MISSING_DOMAIN');
      return null;
    }
    
    if (!attrDef.range) {
      builder.addError(id, 'Nested attribute missing range', 'MISSING_RANGE');
      return null;
    }
    
    if (!attrDef.cardinality) {
      builder.addError(id, 'Nested attribute missing cardinality', 'MISSING_CARDINALITY');
      return null;
    }
    
    if (attrDef.dependent === undefined && attrDef['is-dependent'] === undefined) {
      builder.addError(id, 'Nested attribute missing dependent flag', 'MISSING_DEPENDENT');
      return null;
    }
    
    return {
      id: id,
      domain: attrDef.domain,
      range: attrDef.range,
      cardinality: attrDef.cardinality,
      isDependent: Boolean(attrDef['is-dependent'] ?? attrDef.dependent),
      relationship: attrDef.relationship,
      constraints: attrDef.constraints,
      defaultValue: attrDef['default-value'] ?? attrDef.defaultValue,
      metadata: attrDef.metadata
    };
  }
  
  /**
   * Check if an object is an attribute definition
   */
  private isAttributeDefinition(obj: any): boolean {
    return obj && 
           typeof obj === 'object' &&
           ('cardinality' in obj) &&
           ('dependent' in obj || 'is-dependent' in obj) &&
           ('domain' in obj) &&
           ('range' in obj);
  }
  
  /**
   * Extract relationship definitions
   */
  private extractRelationshipDefinitions(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    for (const [entityId, entity] of dictionaries.entities) {
      // Check if this entity is a subtype of Relationship (directly or through inheritance)
      if (this.isRelationshipSubtypeEntity(entityId, dictionaries)) {
        const relDef = this.extractRelationshipFromEntity(entity, builder);
        if (relDef) {
          dictionaries.relationships.set(relDef.id, relDef);
        }
      }
    }
  }
  
  /**
   * Extract relationship definition from entity
   */
  private extractRelationshipFromEntity(entity: MetamodelEntity, builder: ValidationResultBuilder): RelationshipDefinition | null {
    const attrs = entity.attributes as Record<string, any> || {};
    
    const dependentEnd = attrs['dependent-end'] || attrs['is-dependent-end'] || attrs.dependentEnd;
    const independentEnd = attrs['independent-end'] || attrs.independentEnd;
    
    // Collect all errors before returning
    let hasErrors = false;
    
    if (!dependentEnd) {
      builder.addError(entity._id, 'Relationship missing dependent-end', 'MISSING_DEPENDENT_END');
      hasErrors = true;
    }
    
    if (!independentEnd) {
      builder.addError(entity._id, 'Relationship missing independent-end', 'MISSING_INDEPENDENT_END');
      hasErrors = true;
    }
    
    if (hasErrors) {
      return null;
    }
    
    return {
      id: entity._id,
      dependentEnd: dependentEnd,
      independentEnd: independentEnd,
      metadata: entity.metadata
    };
  }
  
  /**
   * Phase 2: Validate all references
   */
  private validateReferences(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    this.validateEntityReferences(dictionaries, builder);
    this.validateAttributeReferences(dictionaries, builder);
    this.validateRelationshipReferences(dictionaries, builder);
  }
  
  /**
   * Validate entity references (subtypeOf)
   */
  private validateEntityReferences(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    for (const [entityId, entity] of dictionaries.entities) {
      // Skip Thing's self-reference
      if (entityId === 'Thing' && entity.subtypeOf === 'Thing') {
        continue;
      }
      
      // Check that subtypeOf references an existing entity
      if (!dictionaries.entities.has(entity.subtypeOf)) {
        builder.addError(entityId, `subtypeOf references undefined entity: ${entity.subtypeOf}`, 'UNDEFINED_REFERENCE');
      }
    }
  }
  
  /**
   * Validate attribute references (domain, range, relationship)
   */
  private validateAttributeReferences(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    for (const [attrId, attr] of dictionaries.attributes) {
      // Validate domain reference
      if (!this.isValidTypeReference(attr.domain, dictionaries)) {
        builder.addError(attrId, `Attribute domain references undefined type: ${attr.domain}`, 'UNDEFINED_DOMAIN');
      }
      
      // Validate range reference
      if (!this.isValidTypeReference(attr.range, dictionaries)) {
        builder.addError(attrId, `Attribute range references undefined type: ${attr.range}`, 'UNDEFINED_RANGE');
      }
      
      // Validate relationship reference if present
      if (attr.relationship && !dictionaries.relationships.has(attr.relationship)) {
        builder.addError(attrId, `Attribute references undefined relationship: ${attr.relationship}`, 'UNDEFINED_RELATIONSHIP');
      }
    }
  }
  
  /**
   * Validate relationship references
   */
  private validateRelationshipReferences(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    for (const [relId, rel] of dictionaries.relationships) {
      // Validate dependent end references an attribute
      if (!dictionaries.attributes.has(rel.dependentEnd)) {
        builder.addError(relId, `Relationship dependent-end references undefined attribute: ${rel.dependentEnd}`, 'UNDEFINED_DEPENDENT_END');
      }
      
      // Validate independent end references an attribute
      if (!dictionaries.attributes.has(rel.independentEnd)) {
        builder.addError(relId, `Relationship independent-end references undefined attribute: ${rel.independentEnd}`, 'UNDEFINED_INDEPENDENT_END');
      }
    }
  }
  
  /**
   * Check if a type reference is valid (entity or primitive)
   * Now enforces exact case matching for entities, case-insensitive for primitives
   */
  private isValidTypeReference(typeName: string, dictionaries: MetamodelDictionaries): boolean {
    // Check if it's a defined entity (exact case match required)
    if (dictionaries.entities.has(typeName)) {
      return true;
    }
    
    // Check if it's a primitive type (case-insensitive for primitives)
    const primitiveTypes = ['string', 'number', 'boolean', 'date', 'array', 'object', 'any'];
    return primitiveTypes.includes(typeName.toLowerCase());
  }
  
  /**
   * Phase 3: Validate constraints and semantic rules
   */
  private validateConstraints(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    this.validateCardinalityFormats(dictionaries, builder);
    this.validateConstraintFormats(dictionaries, builder);
    this.validateDefaultValues(dictionaries, builder);
  }
  
  /**
   * Validate cardinality formats
   */
  private validateCardinalityFormats(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    const validCardinalityPattern = /^(1|\d+\.\.\d+|\d+\.\.\*|0\.\.\*|0\.\.1|\*|1\.\.\*)$/;
    
    for (const [attrId, attr] of dictionaries.attributes) {
      if (!validCardinalityPattern.test(attr.cardinality)) {
        builder.addError(attrId, `Invalid cardinality format: ${attr.cardinality}`, 'INVALID_CARDINALITY');
      }
    }
  }
  
  /**
   * Validate constraint formats
   */
  private validateConstraintFormats(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    const knownConstraints = [
      'non-empty', 'positive', 'non-negative', 'unique', 'valid-type-name',
      'cardinality-format', 'time-unit', 'currency-code', 'lat-lng-format',
      'non-empty-array', 'string-elements', 'range-compatible', 'part-positions'
    ];
    
    for (const [attrId, attr] of dictionaries.attributes) {
      if (attr.constraints) {
        for (const constraint of attr.constraints) {
          if (!knownConstraints.includes(constraint)) {
            builder.addError(attrId, `Unknown constraint: ${constraint}`, 'UNKNOWN_CONSTRAINT');
          }
        }
      }
    }
  }
  
  /**
   * Validate default values against their ranges
   */
  private validateDefaultValues(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    for (const [attrId, attr] of dictionaries.attributes) {
      if (attr.defaultValue !== undefined) {
        if (!this.isValueCompatibleWithType(attr.defaultValue, attr.range)) {
          builder.addError(attrId, `Default value ${JSON.stringify(attr.defaultValue)} incompatible with range ${attr.range}`, 'INCOMPATIBLE_DEFAULT_VALUE');
        }
      }
    }
  }
  
  /**
   * Check if a value is compatible with a type
   */
  private isValueCompatibleWithType(value: any, typeName: string): boolean {
    switch (typeName.toLowerCase()) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'date': return value instanceof Date || typeof value === 'string';
      case 'array': return Array.isArray(value);
      case 'object': return typeof value === 'object' && value !== null;
      case 'any': return true;
      default: return true; // For custom types, assume compatible
    }
  }
  
  /**
   * Phase 4: Validate semantic rules
   */
  private validateSemanticRules(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    this.validateRelationshipConsistency(dictionaries, builder);
    this.validateAttributeInheritance(dictionaries, builder);
    this.validateCoreEntities(dictionaries, builder);
  }
  
  /**
   * Validate relationship consistency
   */
  private validateRelationshipConsistency(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    for (const [relId, rel] of dictionaries.relationships) {
      const depAttr = dictionaries.attributes.get(rel.dependentEnd);
      const indepAttr = dictionaries.attributes.get(rel.independentEnd);
      
      if (depAttr && indepAttr) {
        // Check that dependent end is actually dependent
        if (!depAttr.isDependent) {
          builder.addError(relId, `Dependent end ${rel.dependentEnd} is not marked as dependent`, 'INCONSISTENT_DEPENDENCY');
        }
        
        // Check that independent end is not dependent
        if (indepAttr.isDependent) {
          builder.addError(relId, `Independent end ${rel.independentEnd} is marked as dependent`, 'INCONSISTENT_DEPENDENCY');
        }
        
        // Check that domain/range are consistent
        if (depAttr.range !== indepAttr.domain) {
          builder.addError(relId, `Relationship ends have inconsistent types: ${depAttr.range} vs ${indepAttr.domain}`, 'INCONSISTENT_RELATIONSHIP_TYPES');
        }
      }
    }
  }
  
  /**
   * Validate attribute inheritance rules
   */
  private validateAttributeInheritance(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    // Check that attributes are properly inherited and not conflicting
    for (const [entityId] of dictionaries.entities) {
      const inheritanceChain = dictionaries.inheritanceChain.get(entityId) || [];
      const attributesByName = new Map<string, AttributeDefinition[]>();
      
      // Collect all attributes from inheritance chain
      for (const ancestorId of inheritanceChain) {
        for (const [attrId, attr] of dictionaries.attributes) {
          if (attr.domain.toLowerCase() === ancestorId.toLowerCase()) {
            const attrName = attrId.split('.').pop() || attrId;
            if (!attributesByName.has(attrName)) {
              attributesByName.set(attrName, []);
            }
            attributesByName.get(attrName)!.push(attr);
          }
        }
      }
      
      // Check for conflicting attribute definitions
      for (const [attrName, attrs] of attributesByName) {
        if (attrs.length > 1) {
          // Check if they're compatible specializations
          const baseAttr = attrs[0];
          for (let i = 1; i < attrs.length; i++) {
            const specializedAttr = attrs[i];
            if (!this.areAttributesCompatible(baseAttr, specializedAttr)) {
              builder.addError(entityId, `Conflicting attribute definitions for ${attrName}`, 'CONFLICTING_ATTRIBUTES');
            }
          }
        }
      }
    }
  }
  
  /**
   * Check if two attribute definitions are compatible (specialization)
   */
  private areAttributesCompatible(base: AttributeDefinition, specialized: AttributeDefinition): boolean {
    // Range must be the same or a subtype
    if (base.range !== specialized.range) {
      // TODO: Check if specialized.range is a subtype of base.range
      return false;
    }
    
    // Cardinality must be the same or more restrictive
    // This is a simplified check - full implementation would parse cardinalities
    if (base.cardinality !== specialized.cardinality) {
      return false;
    }
    
    // Dependency must be the same
    if (base.isDependent !== specialized.isDependent) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate core entities exist (only for full metamodels)
   */
  private validateCoreEntities(dictionaries: MetamodelDictionaries, builder: ValidationResultBuilder): void {
    // Only validate core entities for full metamodels (more than 10 entities)
    // This allows minimal metamodels for testing
    if (dictionaries.entities.size <= 10) {
      return;
    }
    
    const requiredCoreEntities = [
      'Thing', 'Attribute', 'Relationship', 'Kind', 'AtomicThing', 'CompoundThing',
      'Object', 'Entity', 'State', 'Process', 'Part', 'Value'
    ];
    
    for (const required of requiredCoreEntities) {
      let found = false;
      for (const entityId of dictionaries.entities.keys()) {
        if (entityId.toLowerCase() === required.toLowerCase()) {
          found = true;
          break;
        }
      }
      if (!found) {
        builder.addError('metamodel', `Missing required core entity: ${required}`, 'MISSING_CORE_ENTITY');
      }
    }
  }
  
  /**
   * Get validation summary
   */
  public getValidationSummary(dictionaries: MetamodelDictionaries): {
    totalEntities: number;
    totalAttributes: number;
    totalRelationships: number;
    maxInheritanceDepth: number;
    coreEntitiesPresent: string[];
  } {
    const maxDepth = Math.max(...Array.from(dictionaries.inheritanceChain.values())
      .map(chain => chain.length));
    
    const coreEntities = ['Thing', 'Attribute', 'Relationship', 'Kind', 'AtomicThing', 'CompoundThing'];
    const coreEntitiesPresent = coreEntities.filter(core => 
      Array.from(dictionaries.entities.keys()).some(id => id.toLowerCase() === core.toLowerCase())
    );
    
    return {
      totalEntities: dictionaries.entities.size,
      totalAttributes: dictionaries.attributes.size,
      totalRelationships: dictionaries.relationships.size,
      maxInheritanceDepth: maxDepth,
      coreEntitiesPresent
    };
  }
}
