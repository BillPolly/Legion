/**
 * AgentOrchestrator - Coordinates planning and execution
 */

import { AgentResult } from '../../foundation/types/interfaces/interfaces.js';
import { ResourceExhaustedError, PlanningError } from '../../foundation/types/errors/errors.js';
import { ValidationUtils } from '../../foundation/utils/validation/ValidationUtils.js';
import { IdGenerator } from '../../foundation/utils/generators/IdGenerator.js';
import { ArtifactStore } from '../storage/artifacts/ArtifactStore.js';
import { NamedArtifactRegistry } from '../storage/artifacts/NamedArtifactRegistry.js';
import { PlanExecutor, ExecutionConfig } from '../execution/PlanExecutor.js';

/**
 * Orchestrator configuration
 */
export class OrchestratorConfig {
  constructor(options = {}) {
    this.maxReplanAttempts = options.maxReplanAttempts || 3;
    this.resourceConstraints = options.resourceConstraints || null;
    this.debugMode = options.debugMode || false;
    this.continueOnFailure = options.continueOnFailure || false;
    this.executionStrategy = options.executionStrategy || 'sequential';
    this.stepTimeout = options.stepTimeout || 30000;
  }
}

/**
 * Orchestrates planning and execution for autonomous goal achievement
 */
export class AgentOrchestrator {
  constructor(planningAgent, executor = null, config = {}) {
    ValidationUtils.required(planningAgent, 'planningAgent');
    
    this.planningAgent = planningAgent;
    this.executor = executor || new PlanExecutor(new ExecutionConfig({
      strategy: config.executionStrategy || 'sequential',
      debugMode: config.debugMode || false,
      continueOnFailure: config.continueOnFailure || false,
      stepTimeout: config.stepTimeout || 30000
    }));
    
    this.config = config instanceof OrchestratorConfig ? config : new OrchestratorConfig(config);
    this.orchestratorId = IdGenerator.generateAgentId('orchestrator');
    this.tracer = null; // Will be injected
    this.executionHistory = [];
  }

  /**
   * Set dependencies (for dependency injection)
   * @param {Object} dependencies - Dependencies object
   */
  setDependencies(dependencies = {}) {
    this.tracer = dependencies.tracer || null;
    
    // Propagate dependencies to planning agent
    if (this.planningAgent.setDependencies) {
      this.planningAgent.setDependencies(dependencies);
    }
  }

  /**
   * Achieve a goal through planning and execution with automatic replanning
   * @param {string} goal - The goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<AgentResult>} Final result
   */
  async achieve(goal, tools = [], context = {}) {
    ValidationUtils.nonEmptyString(goal, 'goal');
    ValidationUtils.array(tools, 'tools');

    const orchestrationId = IdGenerator.generateCorrelationId();
    const startTime = Date.now();
    let span = null;
    let lastExecutionResult = null;

    try {
      // Start tracing if available
      if (this.tracer) {
        span = this.tracer.startSpan('orchestrator.achieve', {
          attributes: { 
            orchestratorId: this.orchestratorId,
            orchestrationId,
            goal: goal.substring(0, 100),
            toolCount: tools.length
          }
        });
      }

      // Initialize working state
      const workingMemory = this._initializeWorkingMemory();
      const artifactRegistry = this._initializeArtifactRegistry();
      
      let attempt = 0;
      let currentPlan = null;

      if (this.config.debugMode) {
        console.log(`[AgentOrchestrator] Starting goal achievement: ${goal}`);
      }

      // Plan → Execute → Replan cycle
      while (attempt < this.config.maxReplanAttempts) {
        attempt++;

        try {
          // Check resource constraints
          if (this.config.resourceConstraints?.wouldExceedLimits({ 
            attempt, 
            toolCalls: lastExecutionResult?.metrics?.completedCount || 0 
          })) {
            throw new ResourceExhaustedError('Resource limits exceeded');
          }

          if (span) {
            span.addEvent('orchestrator.attempt', { attempt });
          }

          // Generate/regenerate plan
          let currentPlan;
          try {
            if (attempt === 1) {
              // Initial planning - errors should bubble up immediately
              currentPlan = await this._generateInitialPlan(goal, tools, context, span);
            } else {
              // Replanning after failure - errors should also bubble up immediately
              currentPlan = await this._replan(goal, lastExecutionResult, tools, context, span);
            }
          } catch (planningError) {
            // Planning errors should cause immediate failure regardless of attempt
            throw planningError;
          }

          if (!currentPlan || currentPlan.length === 0) {
            throw new PlanningError(`No plan generated for attempt ${attempt}`, goal, tools);
          }

          // Execute the plan
          let executionResult;
          try {
            executionResult = await this._executePlan(
              currentPlan, 
              tools, 
              artifactRegistry, 
              { ...context, attempt }, 
              span
            );
          } catch (executionError) {
            // Execution errors should cause immediate failure regardless of attempt
            throw executionError;
          }

          // Check if execution completed successfully
          if (executionResult.isComplete()) {
            if (this.config.debugMode) {
              console.log(`[AgentOrchestrator] Goal achieved successfully in ${attempt} attempt(s)`);
            }

            const duration = Math.max(Date.now() - startTime, 1); // Ensure positive duration
            this.executionHistory.push({
              orchestrationId,
              goal,
              attempts: attempt,
              success: true,
              executionResult,
              duration
            });

            return this._prepareSuccessResult(goal, executionResult, attempt);
          }

          // Execution failed (but no exception was thrown), prepare for replanning
          lastExecutionResult = executionResult;

          if (this.config.debugMode) {
            console.log(`[AgentOrchestrator] Execution failed, attempt ${attempt}/${this.config.maxReplanAttempts}`);
            console.log(`  Completed: ${executionResult.completedSteps.length}`);
            console.log(`  Failed: ${executionResult.failedSteps.length}`);
            console.log(`  Last error: ${executionResult.errors[executionResult.errors.length - 1]?.message}`);
          }

          if (span) {
            span.addEvent('orchestrator.execution_failed', {
              attempt,
              completedSteps: executionResult.completedSteps.length,
              failedSteps: executionResult.failedSteps.length
            });
          }

        } catch (error) {
          // This catch block should only handle non-retryable errors
          // (planning errors, execution exceptions, resource errors)
          if (this.config.debugMode) {
            console.error(`[AgentOrchestrator] Non-retryable error in attempt ${attempt}:`, error.message);
          }

          if (span) {
            span.recordException(error);
          }

          // These errors should cause immediate failure
          throw error;
        }
      }

      // All attempts exhausted
      const finalError = new PlanningError(
        `Failed to achieve goal after ${this.config.maxReplanAttempts} attempts`,
        goal,
        tools,
        lastExecutionResult
      );

      const duration = Math.max(Date.now() - startTime, 1); // Ensure positive duration
      this.executionHistory.push({
        orchestrationId,
        goal,
        attempts: this.config.maxReplanAttempts,
        success: false,
        lastExecutionResult,
        finalError,
        duration
      });

      return this._prepareFailureResult(goal, finalError, lastExecutionResult);

    } catch (error) {
      if (span) {
        span.recordException(error);
        span.setStatus({ code: 'error', message: error.message });
      }

      // Track failed orchestrations
      const duration = Math.max(Date.now() - startTime, 1);
      this.executionHistory.push({
        orchestrationId,
        goal,
        attempts: 1, // Error occurred on first attempt
        success: false,
        error,
        duration
      });

      return this._prepareFailureResult(goal, error, lastExecutionResult);

    } finally {
      if (span) {
        span.end();
      }
    }
  }

  /**
   * Generate initial plan
   * @param {string} goal - Goal to achieve
   * @param {Array} tools - Available tools
   * @param {Object} context - Planning context
   * @param {Object} span - Tracing span
   * @returns {Promise<Array>} Generated plan
   */
  async _generateInitialPlan(goal, tools, context, span) {
    if (span) {
      span.addEvent('orchestrator.planning');
    }

    if (this.config.debugMode) {
      console.log(`[AgentOrchestrator] Generating initial plan`);
    }

    return this.planningAgent.createPlan(goal, tools, context);
  }

  /**
   * Replan after execution failure
   * @param {string} goal - Original goal
   * @param {Object} executionResult - Previous execution result
   * @param {Array} tools - Available tools
   * @param {Object} context - Original context
   * @param {Object} span - Tracing span
   * @returns {Promise<Array>} New plan
   */
  async _replan(goal, executionResult, tools, context, span) {
    if (span) {
      span.addEvent('orchestrator.replanning');
    }

    if (this.config.debugMode) {
      console.log(`[AgentOrchestrator] Replanning after execution failure`);
    }

    return this.planningAgent.replan(goal, executionResult, tools, context);
  }

  /**
   * Execute a plan using the executor
   * @param {Array} plan - Plan to execute
   * @param {Array} tools - Available tools
   * @param {Object} artifactRegistry - Artifact registry
   * @param {Object} context - Execution context
   * @param {Object} span - Tracing span
   * @returns {Promise<Object>} Execution result
   */
  async _executePlan(plan, tools, artifactRegistry, context, span) {
    if (span) {
      span.addEvent('orchestrator.execution', { stepCount: plan.length });
    }

    if (this.config.debugMode) {
      console.log(`[AgentOrchestrator] Executing plan with ${plan.length} steps`);
    }

    return this.executor.execute(plan, tools, artifactRegistry, context);
  }

  /**
   * Initialize working memory
   * @returns {ArtifactStore} Working memory store
   */
  _initializeWorkingMemory() {
    return new ArtifactStore({
      maxSize: this.config.resourceConstraints?.maxMemoryMB * 1024 * 1024 || 50 * 1024 * 1024,
      autoCleanup: true
    });
  }

  /**
   * Initialize artifact registry
   * @returns {NamedArtifactRegistry} Artifact registry
   */
  _initializeArtifactRegistry() {
    return new NamedArtifactRegistry({
      maxArtifacts: 100,
      enableHistory: this.config.debugMode
    });
  }

  /**
   * Prepare success result
   * @param {string} goal - Achieved goal
   * @param {Object} executionResult - Final execution result
   * @param {number} attempts - Number of attempts taken
   * @returns {AgentResult} Success result
   */
  _prepareSuccessResult(goal, executionResult, attempts) {
    const summary = executionResult.getSummary();
    const result = new AgentResult(true);
    
    const resultData = {
      message: `Goal achieved: ${goal}`,
      goal,
      attempts,
      completedSteps: summary.metrics.completedCount,
      totalSteps: summary.metrics.totalSteps,
      executionSummary: summary,
      artifacts: Object.fromEntries(executionResult.artifactRegistry),
      metrics: {
        totalSteps: summary.metrics.totalSteps,
        successRate: summary.successRate,
        executionTime: summary.duration,
        toolCalls: summary.metrics.completedCount
      }
    };
    
    result.setSuccess(
      resultData,
      executionResult.artifactRegistry,
      [],
      resultData.metrics
    );
    
    // Add context for backward compatibility
    result.context = resultData;
    result.message = resultData.message;
    
    return result;
  }

  /**
   * Prepare failure result
   * @param {string} goal - Failed goal
   * @param {Error} error - Final error
   * @param {Object} executionResult - Last execution result
   * @returns {AgentResult} Failure result
   */
  _prepareFailureResult(goal, error, executionResult = null) {
    const result = new AgentResult(false);
    
    const context = {
      goal,
      error: error.message,
      stack: error.stack
    };

    if (executionResult) {
      context.partialResults = {
        completedSteps: executionResult.completedSteps?.length || 0,
        failedSteps: executionResult.failedSteps?.length || 0,
        artifacts: executionResult.artifactRegistry ? 
          Object.fromEntries(executionResult.artifactRegistry) : {}
      };
    }

    result.setFailure(error, context);
    
    // Add backward compatibility properties
    result.message = error.message;
    result.context = context;

    return result;
  }

  /**
   * Get orchestrator statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      orchestratorId: this.orchestratorId,
      totalOrchestrations: this.executionHistory.length,
      successfulOrchestrations: this.executionHistory.filter(h => h.success).length,
      averageAttempts: this.executionHistory.length > 0 ?
        this.executionHistory.reduce((sum, h) => sum + h.attempts, 0) / this.executionHistory.length : 0,
      averageDuration: this.executionHistory.length > 0 ?
        this.executionHistory.reduce((sum, h) => sum + (h.duration || 0), 0) / this.executionHistory.length : 0,
      planningAgent: this.planningAgent.getStats ? this.planningAgent.getStats() : null,
      executor: this.executor.getExecutionStats ? this.executor.getExecutionStats() : null
    };
  }

  /**
   * Clear execution history
   */
  clearHistory() {
    this.executionHistory = [];
  }
}