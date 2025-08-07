/**
 * Main recursive planning agent implementation
 */

import { Executable, AgentState, AgentResult, AgentDecision } from '../../../foundation/types/interfaces/interfaces.js';
import { ResourceExhaustedError, PlanningError, ToolExecutionError } from '../../../foundation/types/errors/errors.js';
import { DecisionType, StepStatus } from '../../../foundation/types/enums/enums.js';
import { ValidationUtils } from '../../../foundation/utils/validation/ValidationUtils.js';
import { IdGenerator } from '../../../foundation/utils/generators/IdGenerator.js';
import { ArtifactStore } from '../../storage/artifacts/ArtifactStore.js';
import { NamedArtifactRegistry } from '../../storage/artifacts/NamedArtifactRegistry.js';
import { AgentConfig } from './AgentConfig.js';
import { Planner } from '../../planning/Planner.js';
import { PlanValidator } from '../../planning/validation/PlanValidator.js';
import { SchemaValidator } from '../../planning/validation/SchemaValidator.js';

/**
 * Main PlanningAgent class - core recursive agent
 */
export class PlanningAgent extends Executable {
  constructor(config = {}, plannerOrStrategy = null, errorRecovery = null, resourceConstraints = null) {
    const agentConfig = config instanceof AgentConfig ? config : new AgentConfig(config);
    super(agentConfig.name, agentConfig.description);
    
    this.config = agentConfig;
    
    // Support both Planner and legacy planningStrategy
    if (plannerOrStrategy instanceof Planner) {
      this.planner = plannerOrStrategy;
      this.planningStrategy = null; // Legacy
    } else {
      // Legacy support: create Planner from strategy
      this.planningStrategy = plannerOrStrategy;
      this.planner = this._createPlannerFromStrategy(plannerOrStrategy);
    }
    
    this.errorRecovery = errorRecovery;
    this.resourceConstraints = resourceConstraints;
    this.tracer = null; // Will be injected
    this.llm = null; // Will be injected
    this.agentId = IdGenerator.generateAgentId('planning');
    
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
    this.errorRecovery = dependencies.errorRecovery || this.errorRecovery;
    this.resourceConstraints = dependencies.resourceConstraints || this.resourceConstraints;
  }

  /**
   * Main execution method
   * @param {string} goal - The goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {ExecutionContext} context - Execution context
   * @returns {Promise<AgentResult>} Execution result
   */
  async run(goal, tools = [], context = {}) {
    ValidationUtils.nonEmptyString(goal, 'goal');
    ValidationUtils.array(tools, 'tools');

    const state = this.initializeState(goal, context);
    let span = null;

    try {
      // Start tracing if available
      if (this.tracer) {
        span = this.tracer.startSpan('agent.run', {
          attributes: { 
            agentName: this.config.name, 
            agentId: this.agentId,
            goal: goal.substring(0, 100) // Truncate for tracing
          }
        });
      }

      // Generate initial plan
      await this._generateInitialPlan(state, tools, context, span);

      // Execute plan with reflection loop
      while (!this._isComplete(state)) {
        // Check resource constraints
        if (this.resourceConstraints?.wouldExceedLimits(state)) {
          throw new ResourceExhaustedError('Resource limits exceeded');
        }

        // Execute next step
        await this._executeNextStep(state, tools, span);

        // Reflect and decide next action
        if (this.config.reflectionEnabled) {
          const decision = await this._reflect(state, tools);
          await this._handleDecision(decision, state, tools);
        }
      }

      return this._prepareSuccessResult(state);

    } catch (error) {
      return this._prepareFailureResult(state, error);
    } finally {
      if (span) {
        span.end();
      }
    }
  }

  /**
   * Initialize agent state
   * @param {string} goal - The goal
   * @param {Object} context - Execution context
   * @returns {AgentState} Initialized state
   */
  initializeState(goal, context) {
    const state = new AgentState(goal, context);
    state.workingMemory = new ArtifactStore({
      maxSize: this.resourceConstraints?.maxMemoryMB * 1024 * 1024 || 50 * 1024 * 1024,
      autoCleanup: true
    });
    
    // Initialize named artifact registry
    state.artifactRegistry = new NamedArtifactRegistry({
      maxArtifacts: 100,
      enableHistory: this.config.debugMode
    });
    
    if (this.config.debugMode) {
      console.log(`[${this.config.name}] Initialized state for goal: ${goal}`);
    }
    
    return state;
  }

  /**
   * Generate initial plan
   * @param {AgentState} state - Current state
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Execution context
   * @param {Object} span - Tracing span
   */
  async _generateInitialPlan(state, tools, context, span) {
    if (span) {
      span.addEvent('planning.start');
    }

    if (!this.planner && !this.planningStrategy) {
      throw new PlanningError('No planner or planning strategy configured', state.goal, tools);
    }

    try {
      // Use Planner if available (preferred), otherwise legacy strategy
      if (this.planner) {
        // Planner handles validation and reprompting internally
        state.plan = await this.planner.createPlan(state.goal, tools, context);
      } else {
        // Legacy path
        state.plan = await this.planningStrategy.generatePlan(state.goal, tools, context);
      }
      
      if (!state.plan || state.plan.length === 0) {
        throw new PlanningError('Planning returned empty plan', state.goal, tools);
      }

      if (this.config.debugMode) {
        console.log(`[${this.config.name}] Generated validated plan with ${state.plan.length} steps`);
      }

      if (span) {
        span.addEvent('planning.complete', { stepCount: state.plan.length });
      }

    } catch (error) {
      if (span) {
        span.recordException(error);
      }
      throw new PlanningError(`Plan generation failed: ${error.message}`, state.goal, tools);
    }
  }

  /**
   * Execute the next step in the plan
   * @param {AgentState} state - Current state
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} span - Parent tracing span
   */
  async _executeNextStep(state, tools, span) {
    const step = this._selectNextStep(state);
    if (!step) return;

    let stepSpan = null;
    if (span && this.tracer) {
      stepSpan = this.tracer.startSpan('agent.step', {
        parent: span,
        attributes: { 
          stepId: step.id, 
          tool: step.tool,
          description: step.description 
        }
      });
    }

    try {
      step.start();
      const result = await this._executeStep(step, tools, state);
      step.complete(result);
      
      this._updateState(state, step, result);
      
      if (stepSpan) {
        stepSpan.setStatus({ code: 'ok' });
      }

      if (this.config.debugMode) {
        console.log(`[${this.config.name}] Completed step: ${step.id}`);
      }

    } catch (error) {
      step.fail(error);
      
      if (stepSpan) {
        stepSpan.recordException(error);
        stepSpan.setStatus({ code: 'error', message: error.message });
      }

      // Try error recovery first
      if (this.errorRecovery) {
        const recovery = await this.errorRecovery.handleError(error, step, state);
        await this._applyRecovery(recovery, state);
      } else if (step.retryCount < this.config.maxRetries) {
        // Simple retry mechanism if no error recovery
        step.status = StepStatus.PENDING;
        step.retryCount++;
        step.error = null;
        
        if (this.config.debugMode) {
          console.log(`[${this.config.name}] Retrying step ${step.id} (attempt ${step.retryCount + 1}/${this.config.maxRetries + 1})`);
        }
      } else {
        throw error;
      }

    } finally {
      if (stepSpan) {
        stepSpan.end();
      }
    }
  }

  /**
   * Select the next step to execute
   * @param {AgentState} state - Current state
   * @returns {PlanStep|null} Next step or null if none available
   */
  _selectNextStep(state) {
    // Find first pending step whose dependencies are satisfied
    for (const step of state.plan) {
      if (step.status === StepStatus.PENDING && this._areDependenciesSatisfied(step, state)) {
        return step;
      }
    }
    return null;
  }

  /**
   * Check if step dependencies are satisfied
   * @param {PlanStep} step - Step to check
   * @param {AgentState} state - Current state
   * @returns {boolean} True if dependencies are satisfied
   */
  _areDependenciesSatisfied(step, state) {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }

    return step.dependencies.every(depId => {
      const depStep = state.plan.find(s => s.id === depId);
      return depStep && depStep.status === StepStatus.DONE;
    });
  }

  /**
   * Execute a single step
   * @param {PlanStep} step - Step to execute
   * @param {Array<Executable>} tools - Available tools
   * @param {AgentState} state - Current state
   * @returns {Promise<any>} Step result
   */
  async _executeStep(step, tools, state) {
    const tool = tools.find(t => t.name === step.tool);
    if (!tool) {
      throw new ToolExecutionError(`Tool not found: ${step.tool}`, step.tool, step.params);
    }

    // Resolve artifact references in parameters
    const resolvedParams = state.artifactRegistry ? 
      state.artifactRegistry.resolveAll(step.params) : 
      step.params;

    try {
      return await tool.run(resolvedParams);
    } catch (error) {
      throw new ToolExecutionError(
        `Tool execution failed: ${error.message}`,
        step.tool,
        resolvedParams,
        error
      );
    }
  }

  /**
   * Update agent state after step execution
   * @param {AgentState} state - Current state
   * @param {PlanStep} step - Executed step
   * @param {any} result - Step result
   */
  _updateState(state, step, result) {
    // Extract data from standardized format if present
    const actualResult = (result && result.success === true && result.data) ? result.data : result;
    
    state.lastResult = actualResult;
    state.resourceUsage.toolCalls++;
    
    // Save named artifacts if specified
    if (step.saveOutputs && actualResult && typeof actualResult === 'object' && state.artifactRegistry) {
      for (const [outputField, artifactInfo] of Object.entries(step.saveOutputs)) {
        if (actualResult[outputField] !== undefined) {
          // Get the tool metadata to determine type
          const toolMetadata = this._getToolMetadata(step.tool);
          const outputType = toolMetadata?.output?.[outputField] || 'any';
          
          state.artifactRegistry.save(
            artifactInfo.name,
            outputType,
            artifactInfo.description,
            actualResult[outputField],
            step.tool
          );
          
          if (this.config.debugMode) {
            console.log(`[${this.config.name}] Saved artifact: @${artifactInfo.name}`);
          }
        }
      }
    }
    
    // Store result in working memory if it's significant
    if (actualResult && typeof actualResult === 'object') {
      state.workingMemory.store(`step_${step.id}_result`, actualResult, {
        source: step.tool,
        description: `Result from step: ${step.description}`
      });
    }

    // Update step pointer
    const currentIndex = state.plan.findIndex(s => s.id === step.id);
    if (currentIndex >= state.stepPointer) {
      state.stepPointer = currentIndex + 1;
    }
  }

  /**
   * Perform reflection on current state
   * @param {AgentState} state - Current state
   * @param {Array<Executable>} tools - Available tools
   * @returns {Promise<AgentDecision>} Agent decision
   */
  async _reflect(state, tools) {
    if (!this.llm) {
      // Default decision if no LLM available
      return new AgentDecision(DecisionType.PROCEED, {}, 'No LLM available for reflection, proceeding');
    }

    try {
      const prompt = this._buildReflectionPrompt(state, tools);
      const response = await this.llm.complete(prompt);
      return this._parseDecision(response);
    } catch (error) {
      if (this.config.debugMode) {
        console.warn(`[${this.config.name}] Reflection failed: ${error.message}`);
      }
      // Default to proceed on reflection failure
      return new AgentDecision(DecisionType.PROCEED, {}, `Reflection failed: ${error.message}`);
    }
  }

  /**
   * Build reflection prompt for LLM
   * @param {AgentState} state - Current state
   * @param {Array<Executable>} tools - Available tools
   * @returns {string} Reflection prompt
   */
  _buildReflectionPrompt(state, tools) {
    const completedSteps = state.plan.filter(s => s.status === StepStatus.DONE);
    const failedSteps = state.plan.filter(s => s.status === StepStatus.ERROR);
    const remainingSteps = state.plan.filter(s => s.status === StepStatus.PENDING);

    return `
## Goal
${state.goal}

## Plan Progress
Total steps: ${state.plan.length}
Completed: ${completedSteps.length}
Failed: ${failedSteps.length}
Remaining: ${remainingSteps.length}

## Last Step Executed
${state.stepPointer > 0 ? this._summarizeStep(state.plan[state.stepPointer - 1]) : 'None'}

## Named Artifacts
${state.artifactRegistry ? state.artifactRegistry.getContextString() : 'No named artifacts available'}

## Working Memory
${state.workingMemory.listArtifacts().map(a => `- ${a.id}: ${a.description || 'No description'}`).join('\n')}

## Resource Usage
Time elapsed: ${Date.now() - state.startTime}ms
Tool calls: ${state.resourceUsage.toolCalls}

## Available Tools
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

## Failed Steps
${failedSteps.map(s => `- ${s.id}: ${s.error?.message || 'Unknown error'}`).join('\n')}

Based on the current progress, what should I do next? Respond with JSON:
{
  "type": "proceed" | "retry" | "insert_step" | "replan" | "terminate",
  "details": { ... },
  "reasoning": "explanation"
}
    `.trim();
  }

  /**
   * Parse LLM decision response
   * @param {string} response - LLM response
   * @returns {AgentDecision} Parsed decision
   */
  _parseDecision(response) {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return new AgentDecision(parsed.type, parsed.details || {}, parsed.reasoning || '');
    } catch (error) {
      // Default to proceed if parsing fails
      return new AgentDecision(DecisionType.PROCEED, {}, `Failed to parse decision: ${error.message}`);
    }
  }

  /**
   * Handle agent decision
   * @param {AgentDecision} decision - Decision to handle
   * @param {AgentState} state - Current state
   * @param {Array<Executable>} tools - Available tools
   */
  async _handleDecision(decision, state, tools) {
    switch (decision.type) {
      case DecisionType.PROCEED:
        // Continue with normal execution
        break;

      case DecisionType.RETRY:
        // Retry failed steps
        this._retryFailedSteps(state);
        break;

      case DecisionType.INSERT_STEP:
        // Insert new step into plan
        if (decision.details.step) {
          this._insertStep(state, decision.details.step);
        }
        break;

      case DecisionType.REPLAN:
        // Generate new plan
        await this._replan(state, tools, decision.details.scope);
        break;

      case DecisionType.TERMINATE:
        // Force completion
        this._forceCompletion(state, decision.reasoning);
        break;

      default:
        if (this.config.debugMode) {
          console.warn(`[${this.config.name}] Unknown decision type: ${decision.type}`);
        }
    }
  }

  /**
   * Check if execution is complete
   * @param {AgentState} state - Current state
   * @returns {boolean} True if complete
   */
  _isComplete(state) {
    // All steps are either done or skipped
    return state.plan.every(step => 
      step.status === StepStatus.DONE || step.status === StepStatus.SKIPPED
    );
  }

  /**
   * Prepare successful result
   * @param {AgentState} state - Final state
   * @returns {AgentResult} Success result
   */
  _prepareSuccessResult(state) {
    const result = new AgentResult(true);
    
    const finalResult = {
      goal: state.goal,
      completedSteps: state.plan.filter(s => s.status === StepStatus.DONE).length,
      totalSteps: state.plan.length,
      executionTime: Date.now() - state.startTime,
      finalOutput: state.lastResult
    };

    result.setSuccess(
      finalResult,
      state.workingMemory.artifacts,
      state.executionTrace,
      state.resourceUsage
    );

    return result;
  }

  /**
   * Prepare failure result
   * @param {AgentState} state - Current state
   * @param {Error} error - Error that occurred
   * @returns {AgentResult} Failure result
   */
  _prepareFailureResult(state, error) {
    const result = new AgentResult(false);
    
    const partialResult = {
      goal: state.goal,
      completedSteps: state.plan ? state.plan.filter(s => s.status === StepStatus.DONE).length : 0,
      totalSteps: state.plan ? state.plan.length : 0,
      executionTime: Date.now() - state.startTime,
      failurePoint: state.stepPointer,
      artifacts: state.workingMemory ? state.workingMemory.listArtifacts() : []
    };

    result.setFailure(error, partialResult);
    return result;
  }

  /**
   * Summarize a step for display
   * @param {PlanStep} step - Step to summarize
   * @returns {string} Step summary
   */
  _summarizeStep(step) {
    const duration = step.getDuration();
    const durationStr = duration ? ` (${duration}ms)` : '';
    return `${step.id}: ${step.description} [${step.status}]${durationStr}`;
  }

  /**
   * Apply error recovery action
   * @param {Object} recovery - Recovery action
   * @param {AgentState} state - Current state
   */
  async _applyRecovery(recovery, state) {
    // Implementation depends on recovery action details
    // This is a placeholder for the recovery logic
    if (this.config.debugMode) {
      console.log(`[${this.config.name}] Applying recovery: ${recovery.type}`);
    }
  }

  /**
   * Retry failed steps
   * @param {AgentState} state - Current state
   */
  _retryFailedSteps(state) {
    for (const step of state.plan) {
      if (step.status === StepStatus.ERROR && step.retryCount < this.config.maxRetries) {
        step.status = StepStatus.PENDING;
        step.retryCount++;
        step.error = null;
      }
    }
  }

  /**
   * Insert a new step into the plan
   * @param {AgentState} state - Current state
   * @param {Object} stepData - New step data
   */
  _insertStep(state, stepData) {
    // This would insert a new step into the plan
    // Implementation depends on specific requirements
  }

  /**
   * Get tool metadata by name
   * @param {string} toolName - Tool name
   * @returns {Object|null} Tool metadata or null
   */
  _getToolMetadata(toolName) {
    // This is a placeholder - in real implementation, tools should provide metadata
    // For now, return null and let the type default to 'any'
    return null;
  }

  /**
   * Force completion of execution
   * @param {AgentState} state - Current state
   * @param {string} reason - Reason for termination
   */
  _forceCompletion(state, reason) {
    // Mark all remaining steps as skipped
    for (const step of state.plan) {
      if (step.status === StepStatus.PENDING) {
        step.status = StepStatus.SKIPPED;
      }
    }
    
    if (this.config.debugMode) {
      console.log(`[${this.config.name}] Forced completion: ${reason}`);
    }
  }

  /**
   * Replan remaining steps
   * @param {AgentState} state - Current state
   * @param {Array<Executable>} tools - Available tools
   * @param {string} scope - Replanning scope
   */
  async _replan(state, tools, scope = 'remaining') {
    if (this.config.debugMode) {
      console.log(`[${this.config.name}] Replanning with scope: ${scope}`);
    }

    try {
      // Prepare replanning context
      const replanContext = {
        failedSteps: state.plan.filter(s => s.status === StepStatus.ERROR),
        completedSteps: state.plan.filter(s => s.status === StepStatus.DONE),
        currentState: {
          workingMemory: state.workingMemory.listArtifacts(),
          lastResult: state.lastResult,
          resourceUsage: state.resourceUsage
        },
        artifactRegistry: state.artifactRegistry,
        scope
      };

      // Get new validated plan
      let newPlan;
      if (this.planner) {
        newPlan = await this.planner.replan(state.goal, tools, state.context, replanContext);
      } else if (this.planningStrategy && this.planningStrategy.replan) {
        // Legacy path
        const failedStep = replanContext.failedSteps[0] || null;
        newPlan = await this.planningStrategy.replan(state.plan, failedStep, {
          ...state.context,
          goal: state.goal,
          tools
        });
      } else {
        throw new PlanningError('No replanning capability available');
      }

      // Replace plan with new one
      state.plan = newPlan;
      
      if (this.config.debugMode) {
        console.log(`[${this.config.name}] Replanned with ${newPlan.length} steps`);
      }
      
    } catch (error) {
      if (this.config.debugMode) {
        console.error(`[${this.config.name}] Replanning failed: ${error.message}`);
      }
      throw error;
    }
  }
}