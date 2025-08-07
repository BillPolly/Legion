/**
 * Metamodel Reader Service
 * Reads and caches the metamodel from the database for runtime validation
 */

import { Capability } from '../types/Capability';
import { ICapabilityStorage } from '../storage/ICapabilityStorage';

export interface MetamodelCache {
  entities: Map<string, Capability>;
  attributes: Map<string, AttributeDefinition>;
  hierarchy: Map<string, string[]>; // parent -> children
  loaded: boolean;
  version: number | null;
}

export interface AttributeDefinition {
  name: string;
  type: string;
  cardinality: string;
  dependent: boolean;
  domain: string;
  range: string;
  relationship?: string;
  constraints?: string[];
}

export interface ValidationContext {
  metamodel: MetamodelCache;
  entityType: string;
  attributeName?: string;
}

export class MetamodelReader {
  private cache: MetamodelCache = {
    entities: new Map(),
    attributes: new Map(),
    hierarchy: new Map(),
    loaded: false,
    version: null
  };

  constructor(private storage: ICapabilityStorage) {}

  /**
   * Load metamodel from database into memory cache
   */
  async loadMetamodel(): Promise<void> {
    // Find all metamodel entities (source is in metadata)
    const metamodelEntities = await this.storage.findByAttribute('metadata.source', 'metamodel');
    
    if (metamodelEntities.length === 0) {
      throw new Error('No metamodel found in database. Please load metamodel first.');
    }

    // Clear existing cache
    this.cache.entities.clear();
    this.cache.attributes.clear();
    this.cache.hierarchy.clear();

    // Load entities into cache
    for (const entity of metamodelEntities) {
      this.cache.entities.set(entity._id, entity);
      
      // Build hierarchy map
      if (!this.cache.hierarchy.has(entity.subtypeOf)) {
        this.cache.hierarchy.set(entity.subtypeOf, []);
      }
      if (entity._id !== entity.subtypeOf) { // Avoid Thing -> Thing
        this.cache.hierarchy.get(entity.subtypeOf)!.push(entity._id);
      }

      // Extract attribute definitions - check if this entity IS an attribute definition
      if (entity.subtypeOf === 'attribute') {
        // This entity represents an attribute definition
        // Extract properties from the attributes object (either new key:value format or legacy)
        const domain = entity.attributes.domain || 'unknown';
        const range = entity.attributes.range || 'string';
        const cardinality = entity.attributes.cardinality || '1';
        const dependent = entity.attributes.dependent !== undefined ? entity.attributes.dependent : false;
        
        const key = `${domain}.${entity._id}`;
        this.cache.attributes.set(key, {
          name: entity._id,
          type: entity.attributes.type || 'string',
          cardinality: cardinality,
          dependent: dependent,
          domain: domain,
          range: range,
          relationship: entity.attributes.relationship,
          constraints: (entity as any).constraints || entity.attributes.constraints // Check both locations
        });
      }
      
      // Also handle legacy nested attribute definitions (for backward compatibility)
      if (entity.attributes && typeof entity.attributes === 'object' && !Array.isArray(entity.attributes)) {
        for (const [attrName, attrDef] of Object.entries(entity.attributes)) {
          if (this.isAttributeDefinition(attrDef)) {
            const key = `${entity._id}.${attrName}`;
            this.cache.attributes.set(key, {
              name: attrName,
              type: attrDef.type || 'string',
              cardinality: attrDef.cardinality,
              dependent: attrDef.dependent,
              domain: attrDef.domain,
              range: attrDef.range,
              relationship: attrDef.relationship || attrDef.inverse, // Support both new and legacy
              constraints: attrDef.constraints
            });
          }
        }
      }
    }

    // Get version from Thing entity
    const thing = this.cache.entities.get('thing');
    this.cache.version = thing?.attributes.metadata?.version || null;
    this.cache.loaded = true;

    console.log(`✅ Metamodel loaded into memory: ${metamodelEntities.length} entities, version ${this.cache.version}`);
  }

  /**
   * Check if metamodel is loaded in memory
   */
  isLoaded(): boolean {
    return this.cache.loaded;
  }

  /**
   * Get metamodel version
   */
  getVersion(): number | null {
    return this.cache.version;
  }

  /**
   * Get entity definition by ID
   */
  getEntity(entityId: string): Capability | null {
    return this.cache.entities.get(entityId) || null;
  }

  /**
   * Get all entities
   */
  getAllEntities(): Capability[] {
    return Array.from(this.cache.entities.values());
  }

  /**
   * Get children of an entity
   */
  getChildren(entityId: string): string[] {
    return this.cache.hierarchy.get(entityId) || [];
  }

  /**
   * Get inheritance chain from entity to root
   */
  getInheritanceChain(entityId: string): string[] {
    const chain: string[] = [];
    let current = entityId;
    const visited = new Set<string>();

    while (current && !visited.has(current)) {
      visited.add(current);
      chain.push(current);
      
      const entity = this.cache.entities.get(current);
      if (!entity || entity.subtypeOf === current) break; // Reached root
      
      current = entity.subtypeOf;
    }

    return chain;
  }

  /**
   * Check if entity is a subtype of another entity
   */
  isSubtypeOf(childId: string, parentId: string): boolean {
    const chain = this.getInheritanceChain(childId);
    return chain.includes(parentId);
  }

  /**
   * Get attribute definition for an entity
   */
  getAttributeDefinition(entityId: string, attributeName: string): AttributeDefinition | null {
    // Check direct definition first
    const directKey = `${entityId}.${attributeName}`;
    const direct = this.cache.attributes.get(directKey);
    if (direct) return direct;

    // Check for specialized attributes (e.g., moneyValue for money.value, durationValue for duration.value)
    if (attributeName === 'value') {
      if (entityId === 'money') {
        const moneyValue = this.cache.attributes.get('money.moneyValue');
        if (moneyValue) {
          // Return a modified version with the correct name
          return {
            ...moneyValue,
            name: 'value'
          };
        }
      }
      if (entityId === 'duration') {
        const durationValue = this.cache.attributes.get('duration.durationValue');
        if (durationValue) {
          // Return a modified version with the correct name
          return {
            ...durationValue,
            name: 'value'
          };
        }
      }
    }

    // Check inheritance chain
    const chain = this.getInheritanceChain(entityId);
    for (const ancestorId of chain) {
      const key = `${ancestorId}.${attributeName}`;
      const inherited = this.cache.attributes.get(key);
      if (inherited) return inherited;
    }

    return null;
  }

  /**
   * Get all valid attributes for an entity (including inherited)
   */
  getValidAttributes(entityId: string): Map<string, AttributeDefinition> {
    const attributes = new Map<string, AttributeDefinition>();
    
    // Get inheritance chain (most specific first)
    const chain = this.getInheritanceChain(entityId).reverse();
    
    // Collect attributes from inheritance chain (later definitions override earlier ones)
    for (const ancestorId of chain) {
      for (const [key, attrDef] of this.cache.attributes) {
        if (key.startsWith(`${ancestorId}.`)) {
          attributes.set(attrDef.name, attrDef);
        }
      }
    }

    return attributes;
  }

  /**
   * Validate that an entity conforms to its metamodel definition
   */
  validateEntity(entity: Capability): ValidationResult {
    if (!this.cache.loaded) {
      throw new Error('Metamodel not loaded. Call loadMetamodel() first.');
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if entity type exists in metamodel
    const entityType = this.findEntityType(entity);
    if (!entityType) {
      errors.push(`Entity type not found in metamodel for: ${entity._id}`);
      return { isValid: false, errors, warnings };
    }

    // Get valid attributes for this entity type
    const validAttributes = this.getValidAttributes(entityType);

    // Validate each attribute in the entity
    for (const [attrName, attrValue] of Object.entries(entity.attributes)) {
      const attrDef = validAttributes.get(attrName);
      
      if (!attrDef) {
        warnings.push(`Unknown attribute '${attrName}' for entity type '${entityType}'`);
        continue;
      }

      // Validate attribute value
      const attrValidation = this.validateAttributeValue(attrName, attrValue, attrDef);
      if (!attrValidation.isValid) {
        errors.push(...attrValidation.errors);
      }
    }

    // Note: No required attribute validation since all attributes are optional due to specialization/inheritance

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Find the most specific entity type for a capability
   */
  private findEntityType(entity: Capability): string | null {
    // For now, use the subtypeOf as the entity type
    // In a more sophisticated system, we might infer this differently
    return entity.subtypeOf;
  }

  /**
   * Validate an attribute value against its definition
   */
  private validateAttributeValue(attrName: string, value: any, definition: AttributeDefinition): ValidationResult {
    const errors: string[] = [];

    // Type validation
    if (!this.validateType(value, definition.type)) {
      errors.push(`Attribute '${attrName}' has invalid type. Expected: ${definition.type}`);
    }

    // Cardinality validation
    if (!this.validateCardinality(value, definition.cardinality)) {
      errors.push(`Attribute '${attrName}' violates cardinality constraint: ${definition.cardinality}`);
    }

    // Constraint validation
    if (definition.constraints) {
      for (const constraint of definition.constraints) {
        if (!this.validateConstraint(value, constraint)) {
          errors.push(`Attribute '${attrName}' violates constraint: ${constraint}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Check if an object is an attribute definition
   */
  private isAttributeDefinition(obj: any): boolean {
    return obj && 
           typeof obj === 'object' &&
           'cardinality' in obj &&
           'dependent' in obj &&
           'domain' in obj &&
           'range' in obj;
  }

  /**
   * Validate type
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'date': return value instanceof Date || typeof value === 'string';
      case 'array': return Array.isArray(value);
      case 'object': return typeof value === 'object' && value !== null;
      case 'any': return true;
      default: return true; // For custom types, assume valid
    }
  }

  /**
   * Validate cardinality
   */
  private validateCardinality(value: any, cardinality: string): boolean {
    if (cardinality === '1') {
      return value !== null && value !== undefined;
    }
    if (cardinality === '0..1') {
      return true; // Optional
    }
    if (cardinality === '0..*') {
      return true; // Any number including zero
    }
    if (cardinality === '1..*') {
      return Array.isArray(value) ? value.length > 0 : (value !== null && value !== undefined);
    }
    return true; // For other cardinalities, assume valid
  }

  /**
   * Validate constraint
   */
  private validateConstraint(value: any, constraint: string): boolean {
    switch (constraint) {
      case 'non-empty':
        return typeof value === 'string' ? value.trim().length > 0 : true;
      case 'positive':
        return typeof value === 'number' ? value > 0 : true;
      case 'non-negative':
        return typeof value === 'number' ? value >= 0 : true;
      case 'unique':
        return true; // Would need global context to validate
      default:
        return true; // For unknown constraints, assume valid
    }
  }

  /**
   * Get metamodel statistics
   */
  getStats(): {
    totalEntities: number;
    totalAttributes: number;
    maxDepth: number;
    version: number | null;
  } {
    const maxDepth = Math.max(...Array.from(this.cache.entities.keys())
      .map(id => this.getInheritanceChain(id).length));

    return {
      totalEntities: this.cache.entities.size,
      totalAttributes: this.cache.attributes.size,
      maxDepth,
      version: this.cache.version
    };
  }
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
