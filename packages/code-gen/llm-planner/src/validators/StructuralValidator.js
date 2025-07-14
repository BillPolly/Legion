/**
 * StructuralValidator - Validates the structural integrity of plans
 * 
 * Ensures all required fields are present, types are correct,
 * and the plan follows the expected schema.
 */

import { PlanAction } from '../models/PlanAction.js';
import { PlanStep } from '../models/PlanStep.js';

class StructuralValidator {
  constructor(config = {}) {
    this.config = {
      strictMode: true,
      allowUnknownFields: false,
      ...config
    };
  }

  /**
   * Validate plan structure
   * 
   * @param {Plan} plan - Plan to validate
   * @returns {Object} Validation result with errors and warnings
   */
  async validate(plan) {
    const result = {
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Validate top-level plan structure
    this._validatePlanStructure(plan, result);

    // Only continue if plan exists
    if (!plan) {
      return result;
    }

    // Validate steps
    if (plan.steps && Array.isArray(plan.steps)) {
      for (const step of plan.steps) {
        this._validateStepStructure(step, result);
      }
    }

    // Validate metadata
    this._validateMetadata(plan, result);

    // Validate context
    this._validateContext(plan, result);

    return result;
  }

  /**
   * Validate top-level plan structure
   * @private
   */
  _validatePlanStructure(plan, result) {
    // Handle null/undefined plan
    if (!plan) {
      result.errors.push({
        type: 'missing_plan',
        message: 'Plan is null or undefined'
      });
      return;
    }

    // Check required fields
    const requiredFields = ['id', 'name', 'steps'];
    for (const field of requiredFields) {
      if (plan[field] === undefined || plan[field] === null) {
        result.errors.push({
          type: 'missing_required_field',
          field,
          message: `Plan is missing required field: ${field}`
        });
      }
    }

    // Additional validation for steps field
    if (plan.steps === null) {
      result.errors.push({
        type: 'invalid_type',
        field: 'steps',
        message: 'Plan steps must be an array'
      });
    } else if (plan.steps !== undefined && !Array.isArray(plan.steps)) {
      result.errors.push({
        type: 'invalid_type',
        field: 'steps',
        message: 'Plan steps must be an array'
      });
    } else if (plan.steps && plan.steps.length === 0) {
      result.errors.push({
        type: 'empty_steps',
        message: 'Plan must contain at least one step'
      });
    }

    // Validate field types
    if (plan.id && typeof plan.id !== 'string') {
      result.errors.push({
        type: 'invalid_type',
        field: 'id',
        message: 'Plan id must be a string'
      });
    }

    if (plan.name && typeof plan.name !== 'string') {
      result.errors.push({
        type: 'invalid_type',
        field: 'name',
        message: 'Plan name must be a string'
      });
    }

    // Validate optional fields if present
    if (plan.version && !this._isValidVersion(plan.version)) {
      result.warnings.push({
        type: 'invalid_version',
        message: `Invalid version format: ${plan.version}`
      });
    }
  }

  /**
   * Validate step structure
   * @private
   */
  _validateStepStructure(step, result) {
    // Handle null/undefined step
    if (!step) {
      result.errors.push({
        type: 'missing_step',
        message: 'Step is null or undefined'
      });
      return;
    }

    // Check required step fields
    const requiredFields = ['id', 'name', 'type', 'actions'];
    for (const field of requiredFields) {
      if (!step[field]) {
        result.errors.push({
          type: 'missing_required_field',
          field,
          stepId: step.id || 'unknown',
          message: `Step is missing required field: ${field}`
        });
      }
    }

    // Validate step type
    if (step.type && !PlanStep.isValidType(step.type)) {
      result.errors.push({
        type: 'invalid_step_type',
        stepId: step.id,
        value: step.type,
        message: `Invalid step type: ${step.type}. Valid types are: ${PlanStep.VALID_TYPES.join(', ')}`
      });
    }

    // Validate dependencies
    if (step.dependencies) {
      if (!Array.isArray(step.dependencies)) {
        result.errors.push({
          type: 'invalid_dependencies',
          stepId: step.id,
          message: 'Step dependencies must be an array'
        });
      } else {
        for (const dep of step.dependencies) {
          if (typeof dep !== 'string') {
            result.errors.push({
              type: 'invalid_dependency',
              stepId: step.id,
              message: 'Dependency IDs must be strings'
            });
          }
        }
      }
    }

    // Validate actions
    if (step.actions && Array.isArray(step.actions)) {
      if (step.actions.length === 0) {
        result.warnings.push({
          type: 'empty_actions',
          stepId: step.id,
          message: `Step ${step.id} has no actions`
        });
      }

      for (const action of step.actions) {
        this._validateActionStructure(action, step.id, result);
      }
    }

    // Validate inputs/outputs if present
    if (step.inputs && (typeof step.inputs !== 'object' || Array.isArray(step.inputs) || step.inputs === null)) {
      result.warnings.push({
        type: 'invalid_inputs',
        stepId: step.id,
        message: 'Step inputs should be an object'
      });
    }

    if (step.outputs && (typeof step.outputs !== 'object' || Array.isArray(step.outputs) || step.outputs === null)) {
      result.warnings.push({
        type: 'invalid_outputs',
        stepId: step.id,
        message: 'Step outputs should be an object'
      });
    }
  }

  /**
   * Validate action structure
   * @private
   */
  _validateActionStructure(action, stepId, result) {
    // Check required action fields
    if (!action.type) {
      result.errors.push({
        type: 'missing_action_type',
        stepId,
        message: 'Action is missing required field: type'
      });
    }

    // Validate action type
    if (action.type && !PlanAction.isValidType(action.type)) {
      result.errors.push({
        type: 'invalid_action_type',
        stepId,
        value: action.type,
        message: `Invalid action type: ${action.type}. Valid types are: ${PlanAction.VALID_TYPES.join(', ')}`
      });
    }

    // Validate action-specific requirements
    if (action.type) {
      this._validateActionTypeSpecificFields(action, stepId, result);
    }

    // Check for description
    if (!action.description && this.config.strictMode) {
      result.suggestions.push({
        type: 'missing_description',
        stepId,
        actionType: action.type,
        message: 'Consider adding a description to the action for clarity'
      });
    }
  }

  /**
   * Validate action type specific fields
   * @private
   */
  _validateActionTypeSpecificFields(action, stepId, result) {
    switch (action.type) {
      case 'create-file':
      case 'update-file':
        if (!action.path) {
          result.errors.push({
            type: 'missing_required_field',
            stepId,
            actionType: action.type,
            field: 'path',
            message: `${action.type} action requires a path field`
          });
        }
        if (action.type === 'create-file' && !action.content) {
          result.errors.push({
            type: 'missing_required_field',
            stepId,
            actionType: action.type,
            field: 'content',
            message: 'create-file action requires content field'
          });
        }
        break;

      case 'create-directory':
      case 'delete-directory':
        if (!action.path) {
          result.errors.push({
            type: 'missing_required_field',
            stepId,
            actionType: action.type,
            field: 'path',
            message: `${action.type} action requires a path field`
          });
        }
        break;

      case 'run-command':
        if (!action.command) {
          result.errors.push({
            type: 'missing_required_field',
            stepId,
            actionType: action.type,
            field: 'command',
            message: 'run-command action requires a command field'
          });
        }
        break;

      case 'install-dependency':
        if (!action.package) {
          result.errors.push({
            type: 'missing_required_field',
            stepId,
            actionType: action.type,
            field: 'package',
            message: 'install-dependency action requires a package field'
          });
        }
        break;
    }
  }

  /**
   * Validate plan metadata
   * @private
   */
  _validateMetadata(plan, result) {
    if (!plan.metadata) {
      if (this.config.strictMode) {
        result.warnings.push({
          type: 'missing_metadata',
          message: 'Plan is missing metadata field'
        });
      }
      return;
    }

    const metadata = plan.metadata;

    // Validate timestamps
    if (metadata.createdAt && !this._isValidTimestamp(metadata.createdAt)) {
      result.warnings.push({
        type: 'invalid_timestamp',
        field: 'metadata.createdAt',
        message: 'Invalid timestamp format for createdAt'
      });
    }

    if (metadata.updatedAt && !this._isValidTimestamp(metadata.updatedAt)) {
      result.warnings.push({
        type: 'invalid_timestamp',
        field: 'metadata.updatedAt',
        message: 'Invalid timestamp format for updatedAt'
      });
    }

    // Validate complexity
    if (metadata.complexity) {
      const validComplexities = ['low', 'medium', 'high'];
      if (!validComplexities.includes(metadata.complexity)) {
        result.warnings.push({
          type: 'invalid_complexity',
          value: metadata.complexity,
          message: `Invalid complexity: ${metadata.complexity}. Valid values are: ${validComplexities.join(', ')}`
        });
      }
    }
  }

  /**
   * Validate plan context
   * @private
   */
  _validateContext(plan, result) {
    if (!plan.context) {
      return; // Context is optional
    }

    const context = plan.context;

    // Validate project type if present
    if (context.projectType) {
      const validTypes = ['frontend', 'backend', 'fullstack'];
      if (!validTypes.includes(context.projectType)) {
        result.warnings.push({
          type: 'invalid_project_type',
          value: context.projectType,
          message: `Unknown project type: ${context.projectType}`
        });
      }
    }

    // Validate technologies (can be object with categories or array)
    if (context.technologies) {
      if (typeof context.technologies === 'object' && !Array.isArray(context.technologies)) {
        // Handle object format (categories)
        for (const [category, techs] of Object.entries(context.technologies)) {
          if (!Array.isArray(techs)) {
            result.errors.push({
              type: 'invalid_technologies',
              category,
              message: `Technologies in category '${category}' must be an array`
            });
          } else {
            for (const tech of techs) {
              if (typeof tech !== 'string') {
                result.errors.push({
                  type: 'invalid_technology',
                  category,
                  message: `Technology names in category '${category}' must be strings`
                });
                break;
              }
            }
          }
        }
      } else if (Array.isArray(context.technologies)) {
        // Handle array format
        for (const tech of context.technologies) {
          if (typeof tech !== 'string') {
            result.errors.push({
              type: 'invalid_technology',
              message: 'Technology names must be strings'
            });
            break;
          }
        }
      } else {
        result.errors.push({
          type: 'invalid_technologies',
          message: 'Context technologies must be an array or object'
        });
      }
    }

    // Validate constraints
    if (context.constraints && !Array.isArray(context.constraints)) {
      result.warnings.push({
        type: 'invalid_constraints',
        message: 'Context constraints should be an array'
      });
    }
  }

  /**
   * Check if version string is valid
   * @private
   */
  _isValidVersion(version) {
    // Simple semver validation
    return /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(version);
  }

  /**
   * Check if timestamp is valid
   * @private
   */
  _isValidTimestamp(timestamp) {
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return !isNaN(date.getTime());
    }
    if (typeof timestamp === 'number') {
      return timestamp > 0;
    }
    return false;
  }
}

export { StructuralValidator };
