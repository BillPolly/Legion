/**
 * Metamodel Loader Service
 * Loads and validates the core metamodel into the knowledge graph
 */

import { Capability, CreateCapabilityRequest } from '../types/Capability';
import { ICapabilityStorage } from '../storage/ICapabilityStorage';
import { ValidationResult, ValidationResultBuilder } from '../types/ValidationResult';
import { MetamodelValidator, MetamodelEntity } from './MetamodelValidator';

// Re-export MetamodelEntity for external use
export { MetamodelEntity } from './MetamodelValidator';
import * as fs from 'fs';
import * as path from 'path';


export interface MetamodelLoadResult {
  success: boolean;
  loaded: string[];
  errors: string[];
  warnings: string[];
}

export class MetamodelLoader {
  private validator: MetamodelValidator;

  constructor(private storage: ICapabilityStorage) {
    this.validator = new MetamodelValidator();
  }

  /**
   * Load metamodel from JSON file
   */
  async loadFromFile(filePath: string): Promise<MetamodelLoadResult> {
    try {
      const fullPath = path.resolve(filePath);
      const jsonContent = fs.readFileSync(fullPath, 'utf-8');
      const metamodelData: MetamodelEntity[] = JSON.parse(jsonContent);
      
      return await this.loadMetamodel(metamodelData);
    } catch (error) {
      return {
        success: false,
        loaded: [],
        errors: [`Failed to load metamodel file: ${error}`],
        warnings: []
      };
    }
  }

  /**
   * Load metamodel from data array
   */
  async loadMetamodel(metamodelData: MetamodelEntity[]): Promise<MetamodelLoadResult> {
    const result: MetamodelLoadResult = {
      success: true,
      loaded: [],
      errors: [],
      warnings: []
    };

    // Validate metamodel structure first
    const structureValidation = this.validateMetamodelStructure(metamodelData);
    if (!structureValidation.isValid) {
      result.success = false;
      result.errors.push(...structureValidation.errors.map(e => e.message));
      return result;
    }

    // Sort entities by dependency order (Thing first, then its dependencies)
    const sortedEntities = this.sortByDependencyOrder(metamodelData);

    // Load entities in dependency order
    for (const entity of sortedEntities) {
      try {
        await this.loadEntity(entity);
        result.loaded.push(entity._id);
      } catch (error) {
        result.errors.push(`Failed to load ${entity._id}: ${error}`);
        result.success = false;
      }
    }

    // Validate loaded metamodel
    if (result.success) {
      const validationResult = await this.validateLoadedMetamodel(sortedEntities);
      if (!validationResult.isValid) {
        result.warnings.push(...validationResult.errors.map(e => e.message));
      }
    }

    return result;
  }

  /**
   * Check if metamodel is already loaded
   */
  async isMetamodelLoaded(): Promise<boolean> {
    try {
      // Try both Thing and thing for backward compatibility
      let thing = await this.storage.get('Thing');
      if (!thing) {
        thing = await this.storage.get('thing');
      }
      return thing !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get metamodel version from loaded data
   */
  async getMetamodelVersion(): Promise<number | null> {
    try {
      // Try both Thing and thing for backward compatibility
      let thing = await this.storage.get('Thing');
      if (!thing) {
        thing = await this.storage.get('thing');
      }
      return thing?.attributes.metadata?.version || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate metamodel structure before loading using comprehensive validator
   */
  private validateMetamodelStructure(metamodelData: MetamodelEntity[]): ValidationResult {
    // Use the comprehensive validator for thorough validation
    return this.validator.validateMetamodel(metamodelData);
  }

  /**
   * Validate individual entity structure
   */
  private validateEntityStructure(entity: MetamodelEntity, builder: ValidationResultBuilder): void {
    // Validate required fields
    if (!entity._id || entity._id.trim() === '') {
      builder.addFieldRequired('_id');
    }

    if (!entity.subtypeOf || entity.subtypeOf.trim() === '') {
      builder.addFieldRequired('subtypeOf');
    }

    if (!entity.attributes) {
      builder.addFieldRequired('attributes');
    }

    // Validate ID format (lowercase start, alphanumeric, kebab-case allowed)
    if (entity._id && !/^[a-z][a-zA-Z0-9-]*$/.test(entity._id)) {
      builder.addError(entity._id, 'Entity ID must start with lowercase letter and contain only alphanumeric characters and hyphens', 'INVALID_ID_FORMAT');
    }

    // Validate attributes structure - accepts array or object
    if (entity.attributes) {
      if (Array.isArray(entity.attributes)) {
        // Array format: strings (references) or objects (specializations)
        for (const attrEntry of entity.attributes) {
          if (typeof attrEntry === 'string') {
            // Simple attribute reference
            if (attrEntry.trim() === '') {
              builder.addError(entity._id, `Empty attribute reference`, 'INVALID_ATTRIBUTE_REFERENCE');
            }
          } else if (typeof attrEntry === 'object' && attrEntry !== null) {
            // Specialization object - validate it has exactly one key-value pair
            const keys = Object.keys(attrEntry);
            if (keys.length !== 1) {
              builder.addError(entity._id, `Specialization object must have exactly one key-value pair: ${JSON.stringify(attrEntry)}`, 'INVALID_SPECIALIZATION_FORMAT');
            }
          } else {
            builder.addError(entity._id, `Invalid attribute entry: ${attrEntry}`, 'INVALID_ATTRIBUTE_ENTRY');
          }
        }
      } else if (typeof entity.attributes === 'object') {
        // Object format: all key-value pairs are constant specializations
        // For attribute entities, validate the attribute definition structure
        if (entity.subtypeOf === 'attribute') {
          this.validateAttributeDefinition(entity._id, entity._id, entity.attributes, builder);
        }
        // For legacy nested attribute definitions, validate each one
        else {
          for (const [attrName, attrDef] of Object.entries(entity.attributes)) {
            if (this.isAttributeDefinition(attrDef)) {
              this.validateAttributeDefinition(entity._id, attrName, attrDef, builder);
            }
          }
        }
      } else {
        builder.addError(entity._id, `Attributes must be an array or object`, 'INVALID_ATTRIBUTES_FORMAT');
      }
    }

    // For attribute entities, also validate any top-level attribute definition properties
    if (entity.subtypeOf === 'attribute') {
      // Check if required fields are present either in attributes object or as top-level properties
      const requiredFields = ['domain', 'range', 'cardinality'];
      for (const field of requiredFields) {
        const hasInAttributes = entity.attributes && typeof entity.attributes === 'object' && field in entity.attributes;
        const hasTopLevel = field in entity;
        if (!hasInAttributes && !hasTopLevel) {
          builder.addError(entity._id, `Attribute entity missing required field: ${field}`, 'MISSING_ATTRIBUTE_FIELD');
        }
      }
      
      // Check for is-dependent field (can be 'is-dependent' or legacy 'dependent')
      const hasIsDependentInAttributes = entity.attributes && typeof entity.attributes === 'object' && ('is-dependent' in entity.attributes || 'dependent' in entity.attributes);
      const hasIsDependentTopLevel = 'is-dependent' in entity || 'dependent' in entity;
      if (!hasIsDependentInAttributes && !hasIsDependentTopLevel) {
        builder.addError(entity._id, `Attribute entity missing required field: is-dependent`, 'MISSING_ATTRIBUTE_FIELD');
      }

      // Validate cardinality format if present
      const cardinality = (entity as any).cardinality || (entity.attributes && typeof entity.attributes === 'object' && !Array.isArray(entity.attributes) ? entity.attributes.cardinality : null);
      if (cardinality && !/^(1|\d+\.\.\d+|\d+\.\.\*|0\.\.\*|0\.\.1)$/.test(cardinality)) {
        builder.addError(entity._id, `Invalid cardinality format: ${cardinality}`, 'INVALID_CARDINALITY');
      }
    }
  }

  /**
   * Check if an object is an attribute definition
   */
  private isAttributeDefinition(obj: any): boolean {
    return obj && 
           typeof obj === 'object' &&
           'cardinality' in obj &&
           ('dependent' in obj || 'is-dependent' in obj) &&
           'domain' in obj &&
           'range' in obj;
  }

  /**
   * Validate attribute definition structure
   */
  private validateAttributeDefinition(entityId: string, attrName: string, attrDef: any, builder: ValidationResultBuilder): void {
    // Only domain, range, cardinality, and dependent are truly required
    // type and required can be inferred/defaulted
    const requiredFields = ['cardinality', 'dependent', 'domain', 'range'];
    
    for (const field of requiredFields) {
      if (!(field in attrDef)) {
        builder.addError(entityId, `Attribute ${attrName} missing required field: ${field}`, 'MISSING_ATTRIBUTE_FIELD');
      }
    }

    // Validate cardinality format
    if (attrDef.cardinality && !/^(1|\d+\.\.\d+|\d+\.\.\*|0\.\.\*|0\.\.1)$/.test(attrDef.cardinality)) {
      builder.addError(entityId, `Invalid cardinality format for ${attrName}: ${attrDef.cardinality}`, 'INVALID_CARDINALITY');
    }

    // Validate dependent field is boolean
    if ('dependent' in attrDef && typeof attrDef.dependent !== 'boolean') {
      builder.addError(entityId, `Attribute ${attrName} dependent field must be boolean`, 'INVALID_DEPENDENT_TYPE');
    }
  }

  /**
   * Check for circular dependencies (except Thing -> Thing)
   */
  private validateNonCircularDependencies(metamodelData: MetamodelEntity[], builder: ValidationResultBuilder): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (entityId: string): boolean => {
      if (entityId === 'thing') return false; // Thing -> Thing is allowed
      
      if (recursionStack.has(entityId)) return true;
      if (visited.has(entityId)) return false;

      visited.add(entityId);
      recursionStack.add(entityId);

      const entity = metamodelData.find(e => e._id === entityId);
      if (entity && entity.subtypeOf !== entityId) {
        if (hasCycle(entity.subtypeOf)) {
          return true;
        }
      }

      recursionStack.delete(entityId);
      return false;
    };

    for (const entity of metamodelData) {
      if (entity._id !== 'thing' && hasCycle(entity._id)) {
        builder.addError(entity._id, 'Circular dependency detected in inheritance chain', 'CIRCULAR_DEPENDENCY');
      }
    }
  }

  /**
   * Sort entities by dependency order (dependencies first)
   */
  private sortByDependencyOrder(metamodelData: MetamodelEntity[]): MetamodelEntity[] {
    const sorted: MetamodelEntity[] = [];
    const visited = new Set<string>();
    const entityMap = new Map(metamodelData.map(e => [e._id, e]));

    const visit = (entityId: string): void => {
      if (visited.has(entityId)) return;
      
      const entity = entityMap.get(entityId);
      if (!entity) return;

      // Visit dependencies first (except self-reference)
      if (entity.subtypeOf !== entityId) {
        visit(entity.subtypeOf);
      }

      visited.add(entityId);
      sorted.push(entity);
    };

    // Start with Thing (self-referential root)
    visit('thing');

    // Visit remaining entities
    for (const entity of metamodelData) {
      visit(entity._id);
    }

    return sorted;
  }

  /**
   * Load a single entity into storage
   */
  private async loadEntity(entity: MetamodelEntity): Promise<void> {
    // Check if entity already exists
    const existing = await this.storage.get(entity._id);
    if (existing) {
      // Update if version is newer
      const existingVersion = existing.attributes.metadata?.version || 0;
      const newVersion = entity.metadata?.version || 1;
      
      if (newVersion > existingVersion) {
        await this.updateEntity(entity);
      }
      return;
    }

    // Create new entity - handle both regular entities and attribute entities
    let attributes: any;
    
    if (Array.isArray(entity.attributes)) {
      // Array format: strings (references) or objects (specializations)
      attributes = {};
      
      // Process each attribute entry
      for (const attrEntry of entity.attributes) {
        if (typeof attrEntry === 'string') {
          // Simple attribute reference - add to numeric array for flat storage
          const index = Object.keys(attributes).filter(k => !isNaN(Number(k))).length;
          attributes[index] = attrEntry;
        } else if (typeof attrEntry === 'object' && attrEntry !== null) {
          // Specialization object - extract key-value pairs
          for (const [key, value] of Object.entries(attrEntry)) {
            attributes[key] = value;
          }
        }
      }
    } else if (typeof entity.attributes === 'object') {
      // Object format: all key-value pairs are constant specializations
      attributes = { ...entity.attributes };
    } else {
      // Fallback for other formats
      attributes = {};
    }
    
    // For attribute entities, include any additional attribute definition properties
    if (entity.subtypeOf === 'attribute') {
      if (entity.type) attributes.type = entity.type;
      if (entity.required !== undefined) attributes.required = entity.required;
      if (entity.cardinality) attributes.cardinality = entity.cardinality;
      if (entity.dependent !== undefined) attributes.dependent = entity.dependent;
      if (entity.domain) attributes.domain = entity.domain;
      if (entity.range) attributes.range = entity.range;
      if (entity.constraints) attributes.constraints = entity.constraints;
    }

    // Handle inline metadata - create independent Metadata instance if needed
    let metadataInstance = null;
    if (entity.metadata) {
      metadataInstance = await this.createMetadataInstance(entity.metadata, entity._id);
    }

    const capabilityData: CreateCapabilityRequest = {
      _id: entity._id,
      subtypeOf: entity.subtypeOf,
      attributes: {
        ...attributes,
        // Don't include metadata directly - it's now handled via independent relationship
        ...(metadataInstance ? {} : {
          metadata: {
            version: 1,
            source: 'metamodel'
          }
        })
      }
    };

    const capability = new Capability(capabilityData);
    await this.storage.create(capability);
  }

  /**
   * Create a Metadata instance for inline metadata values
   * This implements the independent relationship pattern where metadata points to the entity
   */
  private async createMetadataInstance(metadataValue: any, targetEntityId: string): Promise<string> {
    // Generate unique ID for the metadata instance
    const metadataId = `metadata_${targetEntityId}_${Date.now()}`;
    
    // Create the Metadata instance with the inline values
    const metadataCapability: CreateCapabilityRequest = {
      _id: metadataId,
      subtypeOf: 'Metadata',
      attributes: {
        // Extract metadata fields
        name: metadataValue.name || targetEntityId,
        description: metadataValue.description || `Metadata for ${targetEntityId}`,
        version: metadataValue.version || 1,
        source: metadataValue.source || 'metamodel',
        // Set the independent relationship - metadata points to the entity
        metadataOf: targetEntityId,
        // Add system metadata for the metadata instance itself
        metadata: {
          version: 1,
          source: 'metamodel-loader',
          description: `Auto-generated metadata instance for ${targetEntityId}`
        }
      }
    };

    const metadataCapabilityObj = new Capability(metadataCapability);
    await this.storage.create(metadataCapabilityObj);
    
    return metadataId;
  }

  /**
   * Update existing entity
   */
  private async updateEntity(entity: MetamodelEntity): Promise<void> {
    await this.storage.update(entity._id, {
      attributes: {
        ...entity.attributes,
        metadata: entity.metadata
      }
    });
  }

  /**
   * Validate loaded metamodel for consistency
   */
  private async validateLoadedMetamodel(entities: MetamodelEntity[]): Promise<ValidationResult> {
    const builder = new ValidationResultBuilder();

    // Check that all entities were loaded successfully
    for (const entity of entities) {
      const loaded = await this.storage.get(entity._id);
      if (!loaded) {
        builder.addError(entity._id, 'Entity was not loaded successfully', 'LOAD_FAILED');
      } else {
        // Validate inheritance chain
        if (entity.subtypeOf !== entity._id) {
          const parent = await this.storage.get(entity.subtypeOf);
          if (!parent) {
            builder.addError(entity._id, `Parent entity ${entity.subtypeOf} not found`, 'MISSING_PARENT');
          }
        }
      }
    }

    return builder.build();
  }

  /**
   * Clear all metamodel entities (for testing/reset)
   */
  async clearMetamodel(): Promise<void> {
    const metamodelEntities = await this.storage.findByAttribute('source', 'metamodel');
    for (const entity of metamodelEntities) {
      await this.storage.delete(entity.id);
    }
  }
}
