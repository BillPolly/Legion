/**
 * BasePlanner - Abstract base class for all planning implementations
 * 
 * Provides the template method pattern for creating plans and defines
 * the abstract interface that concrete planners must implement.
 */

import { EventEmitter } from 'events';
import { Plan } from '../models/Plan.js';
import { PlanStep } from '../models/PlanStep.js';
import { PlanContext } from '../models/PlanContext.js';

class BasePlanner extends EventEmitter {
  constructor(config = {}) {
    super();

    // Prevent direct instantiation of abstract class
    if (this.constructor === BasePlanner) {
      throw new Error('BasePlanner is an abstract class and cannot be instantiated directly');
    }

    this.config = {
      maxIterations: 3,
      autoRefine: true,
      validateBeforeReturn: true,
      emitEvents: true,
      ...config
    };

    // Track planning metadata
    this.metadata = {
      createdAt: Date.now(),
      planner: this.constructor.name,
      version: '1.0.0'
    };
  }

  /**
   * Template method for creating a plan
   * This method orchestrates the entire planning process
   * 
   * @param {Object} requirements - The requirements to plan for
   * @param {PlanContext} context - Optional planning context
   * @returns {Promise<Plan>} The created plan
   */
  async createPlan(requirements, context = null) {
    // Validate input parameters
    this._validateRequirements(requirements);

    // Create or validate context
    if (!context) {
      context = new PlanContext();
    }

    let iterations = 0;
    let plan = null;
    let validationResult = null;

    try {
      // Step 1: Analyze requirements
      if (this.config.emitEvents) {
        this.emit('analysis:start', { requirements, context });
      }

      const analysis = await this.analyzeRequirements(requirements, context);

      if (this.config.emitEvents) {
        this.emit('analysis:complete', analysis);
      }

      // Step 2: Generate initial plan structure
      if (this.config.emitEvents) {
        this.emit('generation:start', { analysis, context });
      }

      const planStructure = await this.generatePlanStructure(analysis, context);
      plan = this._createPlanFromStructure(requirements, planStructure, context, analysis);

      if (this.config.emitEvents) {
        this.emit('generation:complete', { plan });
      }

      // Step 3: Validation and refinement loop
      do {
        iterations++;

        // Validate the plan
        if (this.config.emitEvents) {
          this.emit('validation:start', { plan, iteration: iterations });
        }

        validationResult = await this.validatePlan(plan, context);

        if (this.config.emitEvents) {
          this.emit('validation:complete', validationResult);
        }

        // If validation failed and auto-refinement is enabled
        if (!validationResult.isValid && this.config.autoRefine) {
          if (iterations >= this.config.maxIterations) {
            throw new Error(`Maximum refinement iterations (${this.config.maxIterations}) exceeded. Last errors: ${validationResult.errors.join(', ')}`);
          }

          if (this.config.emitEvents) {
            this.emit('refinement:start', { plan, validationResult, iteration: iterations });
          }

          plan = await this.refinePlan(plan, validationResult, context);

          if (this.config.emitEvents) {
            this.emit('refinement:complete', { plan, iteration: iterations });
          }
        }
      } while (!validationResult.isValid && this.config.autoRefine && iterations < this.config.maxIterations);

      // Update plan metadata
      plan.metadata = {
        ...plan.metadata,
        ...this.metadata,
        iterations,
        finalValidation: validationResult,
        completedAt: Date.now()
      };

      // Final validation if required
      if (this.config.validateBeforeReturn && !validationResult.isValid) {
        throw new Error(`Plan validation failed: ${validationResult.errors.join(', ')}`);
      }

      if (this.config.emitEvents) {
        this.emit('plan:complete', { plan, iterations, validationResult });
      }

      return plan;

    } catch (error) {
      if (this.config.emitEvents) {
        this.emit('plan:error', { error, requirements, context, iterations });
      }
      throw error;
    }
  }

  /**
   * Abstract method: Analyze requirements to understand what needs to be planned
   * 
   * @param {Object} requirements - The requirements to analyze
   * @param {PlanContext} context - The planning context
   * @returns {Promise<Object>} Analysis result containing project type, features, complexity, etc.
   */
  async analyzeRequirements(requirements, context) {
    throw new Error('analyzeRequirements method must be implemented by concrete planner classes');
  }

  /**
   * Abstract method: Generate the plan structure based on analysis
   * 
   * @param {Object} analysis - The requirements analysis
   * @param {PlanContext} context - The planning context
   * @returns {Promise<Object>} Plan structure with steps and organization
   */
  async generatePlanStructure(analysis, context) {
    throw new Error('generatePlanStructure method must be implemented by concrete planner classes');
  }

  /**
   * Abstract method: Validate the generated plan
   * 
   * @param {Plan} plan - The plan to validate
   * @param {PlanContext} context - The planning context
   * @returns {Promise<Object>} Validation result with isValid, errors, warnings
   */
  async validatePlan(plan, context) {
    throw new Error('validatePlan method must be implemented by concrete planner classes');
  }

  /**
   * Abstract method: Refine the plan based on validation results
   * 
   * @param {Plan} plan - The plan to refine
   * @param {Object} validationResult - The validation result
   * @param {PlanContext} context - The planning context
   * @returns {Promise<Plan>} The refined plan
   */
  async refinePlan(plan, validationResult, context) {
    throw new Error('refinePlan method must be implemented by concrete planner classes');
  }

  /**
   * Helper method to validate requirements input
   * 
   * @private
   * @param {Object} requirements - Requirements to validate
   */
  _validateRequirements(requirements) {
    if (!requirements) {
      throw new Error('Requirements must be provided');
    }

    if (typeof requirements !== 'object') {
      throw new Error('Requirements must be an object');
    }

    if (!requirements.task) {
      throw new Error('Requirements must include a task description');
    }
  }

  /**
   * Helper method to create a Plan instance from generated structure
   * 
   * @private
   * @param {Object} requirements - Original requirements
   * @param {Object} planStructure - Generated plan structure
   * @param {PlanContext} context - Planning context
   * @param {Object} analysis - Requirements analysis
   * @returns {Plan} Plan instance
   */
  _createPlanFromStructure(requirements, planStructure, context, analysis) {
    const plan = new Plan({
      name: requirements.task,
      description: requirements.description || `Plan for: ${requirements.task}`,
      context: context.toJSON(),
      metadata: {
        analysis,
        requirements,
        generatedAt: Date.now(),
        planner: this.constructor.name
      }
    });

    // Add steps from structure
    if (planStructure.steps && Array.isArray(planStructure.steps)) {
      for (const stepData of planStructure.steps) {
        const step = new PlanStep({
          ...stepData,
          dependencies: stepData.dependencies || [],
          actions: stepData.actions || []
        });
        plan.addStep(step);
      }
    }

    // Set execution order if provided
    if (planStructure.executionOrder) {
      plan.updateExecutionOrder(planStructure.executionOrder);
    }

    return plan;
  }

  /**
   * Get planning statistics and metrics
   * 
   * @returns {Object} Planning statistics
   */
  getStatistics() {
    return {
      planner: this.constructor.name,
      config: { ...this.config },
      metadata: { ...this.metadata }
    };
  }

  /**
   * Check if this planner supports a specific project type
   * 
   * @param {string} projectType - The project type to check
   * @returns {boolean} Whether this planner supports the project type
   */
  supportsProjectType(projectType) {
    // Base implementation - concrete planners should override
    return false;
  }

  /**
   * Get the supported project types for this planner
   * 
   * @returns {Array<string>} Array of supported project types
   */
  getSupportedProjectTypes() {
    // Base implementation - concrete planners should override
    return [];
  }

  /**
   * Get the recommended context for this planner
   * 
   * @param {Object} requirements - The requirements
   * @returns {PlanContext} Recommended context
   */
  getRecommendedContext(requirements) {
    // Base implementation - concrete planners can override
    return new PlanContext();
  }
}

export { BasePlanner };