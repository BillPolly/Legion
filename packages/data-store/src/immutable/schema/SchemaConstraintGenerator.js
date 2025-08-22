/**
 * SchemaConstraintGenerator - Generates constraints from entity schemas
 * Per implementation plan Phase 4 Step 4.3
 * Provides automatic constraint generation from entity types and schemas
 */

import { EntityType } from './EntityType.js';
import { EntityTypeRegistry } from './EntityTypeRegistry.js';
import { CustomConstraint } from '../constraints/CustomConstraint.js';
import { ConstraintResult } from '../constraints/ConstraintResult.js';
import { ConstraintViolation } from '../constraints/ConstraintViolation.js';

export class SchemaConstraintGenerator {
  constructor(registry = null, options = {}) {
    this.registry = registry;
    this.options = Object.freeze({
      idPrefix: options.idPrefix || 'schema-',
      messages: Object.freeze({
        entityTypeMismatch: 'Wrong entity type: expected {expected}, got {actual}',
        missingAttribute: 'Required attribute {field} is missing',
        ...options.messages
      })
    });
    
    Object.freeze(this);
  }

  /**
   * Generate entity type constraint for a relationship position
   */
  generateEntityConstraint(relationshipType, position, entityType) {
    // Fail fast validation
    if (!relationshipType) {
      throw new Error('Relationship type is required');
    }
    if (!position) {
      throw new Error('Position must be "source" or "target"');
    }
    if (position !== 'source' && position !== 'target') {
      throw new Error('Position must be "source" or "target"');
    }
    if (!entityType) {
      throw new Error('Entity type is required');
    }
    if (!(entityType instanceof EntityType)) {
      throw new Error('Entity type must be an EntityType instance');
    }

    const constraintId = `${this.options.idPrefix}${relationshipType}-${position}-${entityType.name}`;
    const description = `Entity type constraint: ${position} of ${relationshipType} must be ${entityType.name}`;

    return new CustomConstraint(
      constraintId,
      relationshipType,
      description,
      (store, edge) => {
        const entityId = position === 'source' ? edge.src : (edge.dest || edge.dst);
        const metadata = store.getEntityMetadata(entityId);
        
        if (!metadata || metadata.type !== entityType.name) {
          const actual = metadata ? metadata.type : 'unknown';
          const message = this.options.messages.entityTypeMismatch
            .replace('{expected}', entityType.name)
            .replace('{actual}', actual);
          
          return ConstraintResult.failure(constraintId, [
            new ConstraintViolation(
              constraintId,
              message,
              edge,
              {
                position,
                expected: entityType.name,
                actual,
                entityId
              }
            )
          ]);
        }
        
        return ConstraintResult.success(constraintId);
      }
    );
  }

  /**
   * Generate constraints for a relationship with source and/or target types
   */
  generateRelationshipConstraints(relationshipType, schema) {
    const constraints = [];

    if (schema.source) {
      const sourceType = schema.source instanceof EntityType 
        ? schema.source 
        : this.registry?.getType(schema.source);
      
      if (sourceType) {
        constraints.push(this.generateEntityConstraint(relationshipType, 'source', sourceType));
      }
    }

    if (schema.target) {
      const targetType = schema.target instanceof EntityType
        ? schema.target
        : this.registry?.getType(schema.target);
      
      if (targetType) {
        constraints.push(this.generateEntityConstraint(relationshipType, 'target', targetType));
      }
    }

    return constraints;
  }

  /**
   * Generate attribute validation constraint for an entity type
   */
  generateAttributeConstraint(typeName, entityType) {
    const constraintId = `${this.options.idPrefix}${typeName}-attributes`;
    const description = `Attribute validation for ${typeName}`;

    return new CustomConstraint(
      constraintId,
      '*', // Applies to all relationships
      description,
      (store, edge) => {
        const violations = [];

        // Check both source and destination entities
        for (const position of ['source', 'target']) {
          const entityId = position === 'source' ? edge.src : (edge.dest || edge.dst);
          const metadata = store.getEntityMetadata(entityId);

          if (metadata && metadata.type === typeName) {
            const attributes = metadata.attributes || {};
            
            // Validate using EntityType's validation
            const validationResult = entityType.validate(attributes);
            
            if (!validationResult.isValid) {
              for (const error of validationResult.errors) {
                let message = '';
                
                if (error.type === 'missing_required') {
                  message = this.options.messages.missingAttribute
                    .replace('{field}', error.field);
                } else {
                  message = error.message;
                }

                violations.push(new ConstraintViolation(
                  constraintId,
                  message,
                  edge,
                  {
                    entityId,
                    position,
                    field: error.field,
                    errorType: error.type,
                    ...error
                  }
                ));
              }
            }
          }
        }

        if (violations.length > 0) {
          return ConstraintResult.failure(constraintId, violations);
        }

        return ConstraintResult.success(constraintId);
      }
    );
  }

  /**
   * Generate all constraints from a complete schema
   */
  generateAllConstraints(relationshipSchema) {
    const constraints = [];

    // Generate relationship constraints
    for (const [relationshipType, schema] of Object.entries(relationshipSchema)) {
      const relationConstraints = this.generateRelationshipConstraints(relationshipType, schema);
      constraints.push(...relationConstraints);
    }

    // Generate attribute constraints for all registered types
    if (this.registry) {
      for (const type of this.registry.getAllTypes()) {
        constraints.push(this.generateAttributeConstraint(type.name, type));
      }
    }

    return constraints;
  }

  /**
   * Generate constraints from registry types only
   */
  generateFromRegistry() {
    if (!this.registry) {
      return [];
    }

    const constraints = [];

    // Generate attribute constraints for each type
    for (const type of this.registry.getAllTypes()) {
      constraints.push(this.generateAttributeConstraint(type.name, type));
    }

    return constraints;
  }
}