/**
 * Refactored PlanningAgent - focuses only on planning, not execution
 */

import { Executable, AgentState, AgentResult } from '../../../foundation/types/interfaces/interfaces.js';
import { PlanningError } from '../../../foundation/types/errors/errors.js';
import { ValidationUtils } from '../../../foundation/utils/validation/ValidationUtils.js';
import { IdGenerator } from '../../../foundation/utils/generators/IdGenerator.js';
import { NamedArtifactRegistry } from '../../storage/artifacts/NamedArtifactRegistry.js';
import { AgentConfig } from './AgentConfig.js';
import { Planner } from '../../planning/Planner.js';
import { PlanValidator } from '../../planning/validation/PlanValidator.js';
import { SchemaValidator } from '../../planning/validation/SchemaValidator.js';

/**
 * Planning-focused agent - generates and validates plans only
 */
export class PlanningAgent extends Executable {
  constructor(config = {}, plannerOrStrategy = null) {
    const agentConfig = config instanceof AgentConfig ? config : new AgentConfig(config);
    super(agentConfig.name, agentConfig.description);
    
    this.config = agentConfig;
    this.agentId = IdGenerator.generateAgentId('planning');
    
    // Support both Planner and legacy planningStrategy
    if (plannerOrStrategy instanceof Planner) {
      this.planner = plannerOrStrategy;
      this.planningStrategy = null; // Legacy
    } else {
      // Legacy support: create Planner from strategy
      this.planningStrategy = plannerOrStrategy;
      this.planner = this._createPlannerFromStrategy(plannerOrStrategy);
    }
    
    this.tracer = null; // Will be injected
    this.llm = null; // Will be injected
    
    // Validate configuration
    this.config.validate();
  }

  /**
   * Create a Planner from a legacy planning strategy
   * @param {Object} strategy - Planning strategy
   * @returns {Planner} Planner instance
   */
  _createPlannerFromStrategy(strategy) {
    if (!strategy) return null;
    
    // Create validator with schema validator
    const schemaValidator = new SchemaValidator({
      strictTypes: true,
      allowExtraProperties: false,
      debugMode: this.config.debugMode
    });
    
    const validator = new PlanValidator({
      schemaValidator,
      strictMode: true,
      validateArtifacts: true,
      debugMode: this.config.debugMode
    });
    
    // Create planner
    return new Planner(strategy, validator, {
      maxAttempts: 3,
      debugMode: this.config.debugMode
    });
  }

  /**
   * Set dependencies (for dependency injection)
   * @param {Object} dependencies - Dependencies object
   */
  setDependencies(dependencies = {}) {
    this.tracer = dependencies.tracer || null;
    this.llm = dependencies.llm || null;
    this.planningStrategy = dependencies.planningStrategy || this.planningStrategy;
  }

  /**
   * Create a plan for achieving a goal
   * @param {string} goal - The goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Planning context
   * @returns {Promise<Array>} Generated and validated plan
   */
  async createPlan(goal, tools = [], context = {}) {
    ValidationUtils.nonEmptyString(goal, 'goal');
    ValidationUtils.array(tools, 'tools');

    let span = null;

    try {
      // Start tracing if available
      if (this.tracer) {
        span = this.tracer.startSpan('agent.plan', {
          attributes: { 
            agentName: this.config.name, 
            agentId: this.agentId,
            goal: goal.substring(0, 100) // Truncate for tracing
          }
        });
        span.addEvent('planning.start');
      }

      if (!this.planner && !this.planningStrategy) {
        throw new PlanningError('No planner or planning strategy configured', goal, tools);
      }

      if (this.config.debugMode) {
        console.log(`[${this.config.name}] Creating plan for goal: ${goal}`);
      }

      let plan;
      
      // Use Planner if available (preferred), otherwise legacy strategy
      if (this.planner) {
        // Planner handles validation and reprompting internally
        plan = await this.planner.createPlan(goal, tools, context);
      } else {
        // Legacy path
        plan = await this.planningStrategy.generatePlan(goal, tools, context);
      }
      
      if (!plan || plan.length === 0) {
        throw new PlanningError('Planning returned empty plan', goal, tools);
      }

      if (this.config.debugMode) {
        console.log(`[${this.config.name}] Generated validated plan with ${plan.length} steps`);
      }

      if (span) {
        span.addEvent('planning.complete', { stepCount: plan.length });
        span.setStatus({ code: 'ok' });
      }

      return plan;

    } catch (error) {
      if (span) {
        span.recordException(error);
        span.setStatus({ code: 'error', message: error.message });
      }
      throw new PlanningError(`Plan generation failed: ${error.message}`, goal, tools, error);
    } finally {
      if (span) {
        span.end();
      }
    }
  }

  /**
   * Create a new plan after execution failures
   * @param {string} goal - Original goal
   * @param {Object} executionResult - Result from PlanExecutor
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Original planning context
   * @returns {Promise<Array>} New plan for remaining work
   */
  async replan(goal, executionResult, tools = [], context = {}) {
    ValidationUtils.nonEmptyString(goal, 'goal');
    ValidationUtils.required(executionResult, 'executionResult');
    ValidationUtils.array(tools, 'tools');

    let span = null;

    try {
      // Start tracing if available
      if (this.tracer) {
        span = this.tracer.startSpan('agent.replan', {
          attributes: { 
            agentName: this.config.name, 
            agentId: this.agentId,
            goal: goal.substring(0, 100),
            completedSteps: executionResult.completedSteps?.length || 0,
            failedSteps: executionResult.failedSteps?.length || 0
          }
        });
        span.addEvent('replanning.start');
      }

      if (!this.planner && !this.planningStrategy) {
        throw new PlanningError('No planner or planning strategy configured', goal, tools);
      }

      if (this.config.debugMode) {
        console.log(`[${this.config.name}] Replanning for goal: ${goal}`);
        console.log(`  Completed steps: ${executionResult.completedSteps?.length || 0}`);
        console.log(`  Failed steps: ${executionResult.failedSteps?.length || 0}`);
      }

      // Get replanning context from execution result
      const replanContext = executionResult.getReplanningContext ? 
        executionResult.getReplanningContext() : 
        this._extractReplanContextFromResult(executionResult);

      // Enhanced context for replanning
      const enhancedContext = {
        ...context,
        isReplanning: true,
        originalGoal: goal,
        ...replanContext
      };

      let newPlan;
      
      // Use Planner if available (preferred), otherwise legacy strategy  
      if (this.planner) {
        newPlan = await this.planner.replan(goal, tools, context, replanContext);
      } else {
        // Legacy path - just regenerate with enhanced context
        newPlan = await this.planningStrategy.generatePlan(goal, tools, enhancedContext);
      }
      
      if (!newPlan || newPlan.length === 0) {
        throw new PlanningError('Replanning returned empty plan', goal, tools);
      }

      if (this.config.debugMode) {
        console.log(`[${this.config.name}] Generated new plan with ${newPlan.length} steps`);
      }

      if (span) {
        span.addEvent('replanning.complete', { stepCount: newPlan.length });
        span.setStatus({ code: 'ok' });
      }

      return newPlan;

    } catch (error) {
      if (span) {
        span.recordException(error);
        span.setStatus({ code: 'error', message: error.message });
      }
      throw new PlanningError(`Replanning failed: ${error.message}`, goal, tools, error);
    } finally {
      if (span) {
        span.end();
      }
    }
  }

  /**
   * Validate a plan without generating a new one
   * @param {Array} plan - Plan to validate
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} Validation result
   */
  async validatePlan(plan, tools = [], context = {}) {
    ValidationUtils.array(plan, 'plan');
    ValidationUtils.array(tools, 'tools');

    if (!this.planner) {
      throw new PlanningError('No planner configured for validation');
    }

    return this.planner.validatePlan(plan, tools, context);
  }

  /**
   * Fix an invalid plan
   * @param {string} goal - Original goal
   * @param {Array} invalidPlan - Plan that failed validation
   * @param {Array} validationErrors - Validation errors
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Planning context
   * @returns {Promise<Array>} Fixed plan
   */
  async fixPlan(goal, invalidPlan, validationErrors, tools = [], context = {}) {
    ValidationUtils.nonEmptyString(goal, 'goal');
    ValidationUtils.array(invalidPlan, 'invalidPlan');
    ValidationUtils.array(validationErrors, 'validationErrors');
    ValidationUtils.array(tools, 'tools');

    if (!this.planner) {
      throw new PlanningError('No planner configured for plan fixing');
    }

    if (this.config.debugMode) {
      console.log(`[${this.config.name}] Fixing plan with ${validationErrors.length} errors`);
    }

    return this.planner.fixPlan(goal, invalidPlan, validationErrors, tools, context);
  }

  /**
   * Get agent statistics
   * @returns {Object} Agent statistics
   */
  getStats() {
    return {
      agentId: this.agentId,
      name: this.config.name,
      type: 'planning',
      hasPlanner: !!this.planner,
      hasLegacyStrategy: !!this.planningStrategy,
      config: {
        debugMode: this.config.debugMode,
        maxRetries: this.config.maxRetries,
        reflectionEnabled: this.config.reflectionEnabled
      }
    };
  }

  /**
   * Extract replanning context from execution result (legacy support)
   * @param {Object} executionResult - Execution result
   * @returns {Object} Replanning context
   */
  _extractReplanContextFromResult(executionResult) {
    return {
      completedSteps: executionResult.completedSteps || [],
      failedSteps: executionResult.failedSteps || [],
      remainingSteps: executionResult.skippedSteps || [],
      artifactRegistry: executionResult.artifactRegistry || null,
      currentState: {
        executionTime: executionResult.getDuration ? executionResult.getDuration() : 0,
        successRate: executionResult.getSuccessRate ? executionResult.getSuccessRate() : 0,
        errors: executionResult.errors || []
      }
    };
  }

  /**
   * Legacy compatibility: main run method delegates to orchestrator
   * @param {string} goal - The goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<AgentResult>} Result (throws error suggesting orchestrator)
   */
  async run(goal, tools = [], context = {}) {
    throw new Error(
      'PlanningAgent.run() is deprecated. Use AgentOrchestrator to coordinate planning and execution, ' +
      'or call createPlan() directly for planning-only operations.'
    );
  }
}