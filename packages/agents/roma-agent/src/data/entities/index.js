/**
 * Entity Exports
 * 
 * Central export point for all data entities used in the ROMA agent.
 * These entities provide object-oriented interfaces for working with
 * prompt data and project deliverables.
 */

// Base entity class
export { BaseEntity } from './BaseEntity.js';

// Core prompt entities
export { RequirementsEntity } from './RequirementsEntity.js';
export { ProjectPlanEntity, PlanPhaseEntity, CompositeProjectPlan } from './ProjectPlanEntity.js';
export { EndpointEntity } from './EndpointEntity.js';
export { QualityAssessmentEntity } from './QualityAssessmentEntity.js';
export { ErrorEntity } from './ErrorEntity.js';

// Entity factory functions for easy creation
export class EntityFactory {
  /**
   * Create a requirements entity from prompt input
   */
  static createRequirement(description, projectId, type = 'functional', priority = 'medium') {
    if (type === 'functional') {
      return RequirementsEntity.createFunctional(description, projectId, priority);
    } else if (type === 'constraint') {
      return RequirementsEntity.createConstraint(description, projectId, priority);
    } else {
      return RequirementsEntity.createNonFunctional(description, projectId, priority);
    }
  }

  /**
   * Create a project plan from prompt response
   */
  static createProjectPlan(promptResponse, projectId) {
    return CompositeProjectPlan.fromPromptResponse(promptResponse, projectId);
  }

  /**
   * Create endpoints from server generation prompt
   */
  static createEndpointsFromPrompt(endpointsData, projectId) {
    return endpointsData.map(endpointData => 
      EndpointEntity.fromPromptInput(endpointData, projectId)
    );
  }

  /**
   * Create quality assessment from prompt response
   */
  static createQualityAssessment(promptResponse, codeId, projectId) {
    return QualityAssessmentEntity.fromPromptResponse(promptResponse, codeId, projectId);
  }

  /**
   * Create error from exception
   */
  static createErrorFromException(error, projectId, fileId = null) {
    return ErrorEntity.fromException(error, projectId, fileId);
  }

  /**
   * Create error from analysis result
   */
  static createErrorFromAnalysis(analysisResult, originalError, projectId) {
    return ErrorEntity.fromAnalysis(analysisResult, originalError, projectId);
  }

  /**
   * Create a health check endpoint
   */
  static createHealthCheckEndpoint(projectId) {
    return EndpointEntity.createHealthCheck(projectId);
  }

  /**
   * Create CRUD endpoints for a resource
   */
  static createCRUDEndpoints(resource, projectId, requiresAuth = true) {
    const methods = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LIST'];
    return methods.map(method => 
      EndpointEntity.createCRUDEndpoint(resource, method, projectId, requiresAuth)
    );
  }
}

/**
 * Entity validation helpers
 */
export class EntityValidator {
  /**
   * Validate multiple entities at once
   */
  static validateEntities(entities) {
    const results = {
      valid: true,
      errors: [],
      entities: []
    };

    for (const entity of entities) {
      const isValid = entity.validate();
      results.entities.push({
        entity: entity.toString(),
        valid: isValid,
        errors: entity.getErrors()
      });

      if (!isValid) {
        results.valid = false;
        results.errors.push(...entity.getErrors());
      }
    }

    return results;
  }

  /**
   * Validate entity relationships
   */
  static validateRelationships(entities) {
    const errors = [];
    const entityIds = new Set();
    const references = new Map();

    // Collect all entity IDs and references
    for (const entity of entities) {
      if (entity.id) {
        entityIds.add(entity.id);
      }

      // Collect references based on entity type
      const data = entity.toDataScript();
      for (const [key, value] of Object.entries(data)) {
        if (key.includes('/project') || key.includes('/plan') || key.includes('/file') || 
            key.includes('/code') || key.includes('/requirement')) {
          if (!references.has(key)) {
            references.set(key, []);
          }
          references.get(key).push(value);
        }
      }
    }

    // Validate that all references exist
    for (const [refType, refValues] of references.entries()) {
      for (const refValue of refValues) {
        if (!entityIds.has(refValue)) {
          errors.push(`Missing referenced entity: ${refType} -> ${refValue}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Entity serialization helpers
 */
export class EntitySerializer {
  /**
   * Convert entities to JSON format for storage or transmission
   */
  static toJSON(entities) {
    return entities.map(entity => entity.toJSON());
  }

  /**
   * Convert entities to DataScript format for database storage
   */
  static toDataScript(entities) {
    return entities.map(entity => entity.toDataScript());
  }

  /**
   * Create entities from JSON data
   */
  static fromJSON(jsonArray, entityTypeMap = {}) {
    return jsonArray.map(json => {
      const EntityClass = entityTypeMap[json.entityType];
      if (!EntityClass) {
        throw new Error(`Unknown entity type: ${json.entityType}`);
      }
      return EntityClass.fromJSON(json);
    });
  }

  /**
   * Convert entities to prompt format for LLM consumption
   */
  static toPromptFormat(entities) {
    const result = {};
    
    for (const entity of entities) {
      const type = entity.constructor.getEntityType();
      if (!result[type]) {
        result[type] = [];
      }
      
      if (entity.toPromptFormat) {
        result[type].push(entity.toPromptFormat());
      } else {
        result[type].push(entity.toJSON());
      }
    }
    
    return result;
  }
}

/**
 * Default entity type mapping for deserialization
 */
export const DEFAULT_ENTITY_TYPES = {
  'requirement': RequirementsEntity,
  'plan': ProjectPlanEntity,
  'phase': PlanPhaseEntity,
  'endpoint': EndpointEntity,
  'assessment': QualityAssessmentEntity,
  'error': ErrorEntity
};