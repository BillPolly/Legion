/**
 * Planner - Abstraction for plan generation with validation and reprompting
 * 
 * Separates planning logic from execution, handles validation feedback,
 * and manages reprompting when plans fail validation.
 */

import { PlanningError } from '../../foundation/types/errors/errors.js';
import { ValidationUtils } from '../../foundation/utils/validation/ValidationUtils.js';
import { PromptBuilder } from '../execution/planning/prompts/PromptBuilder.js';

/**
 * Planner class that coordinates planning, validation, and reprompting
 */
export class Planner {
  constructor(strategy, validator, options = {}) {
    ValidationUtils.required(strategy, 'strategy');
    ValidationUtils.required(validator, 'validator');
    
    this.strategy = strategy;
    this.validator = validator;
    this.maxAttempts = options.maxAttempts || 3;
    this.debugMode = options.debugMode || false;
    this.promptBuilder = new PromptBuilder({
      debugMode: options.debugMode || false
    });
  }

  /**
   * Create a validated plan for the given goal
   * @param {string} goal - The goal to achieve
   * @param {Array} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<Array>} Validated plan
   */
  async createPlan(goal, tools, context = {}) {
    let attempts = 0;
    let lastValidation = null;
    let validationHistory = [];

    while (attempts < this.maxAttempts) {
      attempts++;
      
      if (this.debugMode) {
        console.log(`[Planner] Attempt ${attempts}/${this.maxAttempts} for goal: ${goal.substring(0, 50)}...`);
      }

      try {
        // Generate plan with error feedback if this is a retry
        const planContext = {
          ...context,
          validationErrors: lastValidation?.errors || [],
          validationHistory,
          attemptNumber: attempts
        };

        const plan = await this.strategy.generatePlan(goal, tools, planContext);

        // Validate the plan
        const validation = await this.validator.validate(plan, tools, context);

        if (validation.valid) {
          if (this.debugMode) {
            console.log(`[Planner] Plan validated successfully with ${plan.length} steps`);
          }
          return plan;
        }

        // Plan failed validation
        lastValidation = validation;
        validationHistory.push({
          attempt: attempts,
          errors: validation.errors,
          timestamp: Date.now()
        });

        if (this.debugMode) {
          console.log(`[Planner] Validation failed with ${validation.errors.length} errors:`);
          validation.errors.slice(0, 3).forEach(err => {
            console.log(`  - ${err.type}: ${err.message}`);
          });
        }

        // If we have more attempts, continue to retry
        if (attempts < this.maxAttempts) {
          if (this.debugMode) {
            console.log(`[Planner] Retrying with validation feedback...`);
          }
        }

      } catch (error) {
        // Strategy or validator threw an error
        if (this.debugMode) {
          console.error(`[Planner] Error during planning: ${error.message}`);
        }
        
        // Add to validation history for context
        validationHistory.push({
          attempt: attempts,
          error: error.message,
          timestamp: Date.now()
        });

        // If this was our last attempt, throw
        if (attempts >= this.maxAttempts) {
          throw new PlanningError(
            `Failed to create plan after ${attempts} attempts: ${error.message}`,
            goal,
            tools,
            validationHistory
          );
        }
      }
    }

    // All attempts exhausted
    const errorSummary = this.summarizeErrors(validationHistory);
    throw new PlanningError(
      `Failed to create valid plan after ${this.maxAttempts} attempts. ${errorSummary}`,
      goal,
      tools,
      validationHistory
    );
  }

  /**
   * Create a plan for replanning scenario
   * @param {string} goal - Original goal
   * @param {Array} tools - Available tools
   * @param {Object} context - Current execution context
   * @param {Object} replanContext - Additional replanning context
   * @returns {Promise<Array>} New validated plan
   */
  async replan(goal, tools, context, replanContext = {}) {
    const enhancedContext = {
      ...context,
      isReplanning: true,
      failedSteps: replanContext.failedSteps || [],
      completedSteps: replanContext.completedSteps || [],
      currentState: replanContext.currentState || {},
      artifactRegistry: replanContext.artifactRegistry || null
    };

    if (this.debugMode) {
      console.log(`[Planner] Replanning for goal: ${goal.substring(0, 50)}...`);
      console.log(`  Completed steps: ${enhancedContext.completedSteps.length}`);
      console.log(`  Failed steps: ${enhancedContext.failedSteps.length}`);
    }

    return this.createPlan(goal, tools, enhancedContext);
  }

  /**
   * Validate an existing plan without generating a new one
   * @param {Array} plan - Plan to validate
   * @param {Array} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Validation result
   */
  async validatePlan(plan, tools, context = {}) {
    return this.validator.validate(plan, tools, context);
  }

  /**
   * Summarize validation errors for error message
   * @param {Array} validationHistory - History of validation attempts
   * @returns {string} Error summary
   */
  summarizeErrors(validationHistory) {
    if (!validationHistory || validationHistory.length === 0) {
      return 'No validation history available.';
    }

    const lastAttempt = validationHistory[validationHistory.length - 1];
    
    if (lastAttempt.error) {
      return `Last error: ${lastAttempt.error}`;
    }

    if (lastAttempt.errors && lastAttempt.errors.length > 0) {
      const errorTypes = {};
      lastAttempt.errors.forEach(err => {
        errorTypes[err.type] = (errorTypes[err.type] || 0) + 1;
      });

      const summary = Object.entries(errorTypes)
        .map(([type, count]) => `${type}(${count})`)
        .join(', ');

      return `Validation errors: ${summary}`;
    }

    return 'Unknown validation failure.';
  }

  /**
   * Fix an invalid plan based on validation errors
   * @param {string} goal - Original goal
   * @param {Array} invalidPlan - The plan that failed validation
   * @param {Array} validationErrors - Validation errors from PlanValidator
   * @param {Array} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<Array>} Fixed and validated plan
   */
  async fixPlan(goal, invalidPlan, validationErrors, tools, context = {}) {
    if (this.debugMode) {
      console.log(`[Planner] Fixing invalid plan with ${validationErrors.length} errors`);
    }

    // Create context with the invalid plan and errors
    const fixContext = {
      ...context,
      isFixing: true,
      invalidPlan,
      validationErrors,
      fixPrompt: this.promptBuilder.buildFixPrompt(goal, invalidPlan, validationErrors, tools, context)
    };

    // Use strategy to generate fixed plan
    const fixedPlan = await this.strategy.generatePlan(goal, tools, fixContext);

    // Validate the fixed plan
    const validation = await this.validator.validate(fixedPlan, tools, context);

    if (!validation.valid) {
      throw new PlanningError(
        `Failed to fix plan. New errors: ${validation.errors.map(e => e.message).join(', ')}`,
        goal,
        tools,
        validation.errors
      );
    }

    if (this.debugMode) {
      console.log(`[Planner] Successfully fixed plan with ${fixedPlan.length} steps`);
    }

    return fixedPlan;
  }


  /**
   * Set debug mode
   * @param {boolean} enabled - Enable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Get the underlying strategy
   * @returns {Object} Planning strategy
   */
  getStrategy() {
    return this.strategy;
  }

  /**
   * Get the underlying validator
   * @returns {Object} Plan validator
   */
  getValidator() {
    return this.validator;
  }
}