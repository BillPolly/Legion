/**
 * Unified Planning Agent with Internal Orchestration
 * 
 * This agent maintains a consistent external interface (run method) while
 * internally using orchestration for planning + execution + replanning.
 * It can be used as a sub-agent (tool) in higher-level compositions.
 */

import { AgentConfig } from './AgentConfig.js';
import { AgentResult } from '../../../foundation/types/interfaces/interfaces.js';
import { ValidationUtils } from '../../../foundation/utils/validation/ValidationUtils.js';
import { IdGenerator } from '../../../foundation/utils/generators/IdGenerator.js';
import { PlanningError, ToolExecutionError } from '../../../foundation/types/errors/errors.js';

// Import orchestration components
import { AgentOrchestrator } from '../../orchestration/AgentOrchestrator.js';
import { PlanExecutor } from '../../execution/PlanExecutor.js';

// Import planning components
import { PromptBuilder } from '../../execution/planning/prompts/PromptBuilder.js';

/**
 * Unified Planning Agent with orchestration capabilities
 */
export class PlanningAgent {
  constructor(config = {}, planningStrategy = null) {
    // Configuration setup
    this.config = config instanceof AgentConfig ? config : new AgentConfig(config);
    this.agentId = IdGenerator.generateAgentId(this.config.name);
    this.planningStrategy = planningStrategy;
    
    // Internal components (initialized on first use)
    this._orchestrator = null;
    this._planExecutor = null;
    this._promptBuilder = new PromptBuilder();
    
    // Dependencies (injected)
    this.llmProvider = null;
    this.tracer = null;
    this.artifactStore = null;
    
    // State
    this.isInitialized = false;
    
    if (this.config.debugMode) {
      console.log(`[PlanningAgent] Created agent: ${this.config.name} (${this.agentId})`);
      console.log(`[PlanningAgent] Orchestration enabled: ${this.config.orchestration.enabled}`);
    }
  }

  /**
   * Initialize internal orchestration components
   * @private
   */
  _initializeOrchestration() {
    if (this._orchestrator) return;
    
    // Create executor
    this._planExecutor = new PlanExecutor({
      strategy: this.config.orchestration.executionStrategy,
      continueOnFailure: this.config.orchestration.continueOnFailure,
      stepTimeout: this.config.orchestration.stepTimeout,
      debugMode: this.config.debugMode
    });
    
    // Create orchestrator with this agent as the planner
    this._orchestrator = new AgentOrchestrator(this, this._planExecutor, {
      maxReplanAttempts: this.config.orchestration.maxReplanAttempts,
      debugMode: this.config.debugMode,
      resourceConstraints: this.config.resourceConstraints
    });
    
    // Propagate dependencies to orchestrator
    if (this.tracer) {
      this._orchestrator.setDependencies({ tracer: this.tracer });
    }
    
    if (this.config.debugMode) {
      console.log(`[PlanningAgent] Orchestration initialized for ${this.config.name}`);
    }
  }

  /**
   * Main execution method - unified interface for all agent types
   * @param {string} goal - The goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<AgentResult>} Final result
   */
  async run(goal, tools = [], context = {}) {
    ValidationUtils.nonEmptyString(goal, 'goal');
    ValidationUtils.array(tools, 'tools');
    
    if (this.config.debugMode) {
      console.log(`[PlanningAgent] ${this.config.name} starting goal: ${goal}`);
      console.log(`[PlanningAgent] Tools available: ${tools.length}`);
      console.log(`[PlanningAgent] Orchestration: ${this.config.orchestration.enabled ? 'enabled' : 'disabled'}`);
    }

    try {
      if (this.config.orchestration.enabled) {
        // Use orchestration for full planning + execution + replanning
        this._initializeOrchestration();
        return await this._orchestrator.achieve(goal, tools, context);
      } else {
        // Planning-only mode (for sub-agents that only generate plans)
        return await this._planningOnlyMode(goal, tools, context);
      }
    } catch (error) {
      if (this.config.debugMode) {
        console.error(`[PlanningAgent] ${this.config.name} failed:`, error.message);
      }
      
      // Return consistent AgentResult for failures
      const result = new AgentResult(false);
      result.setFailure(error);
      result.message = error.message;
      result.context = { goal, tools: tools.length, error: error.message };
      return result;
    }
  }

  /**
   * Planning-only execution mode
   * @param {string} goal - The goal to achieve
   * @param {Array<Executable>} tools - Available tools  
   * @param {Object} context - Execution context
   * @returns {Promise<AgentResult>} Planning result
   * @private
   */
  async _planningOnlyMode(goal, tools, context) {
    if (this.config.debugMode) {
      console.log(`[PlanningAgent] Running in planning-only mode`);
    }

    const plan = await this.createPlan(goal, tools, context);
    
    const result = new AgentResult(true);
    result.setSuccess({
      message: `Plan created for: ${goal}`,
      plan,
      goal,
      mode: 'planning-only'
    });
    result.message = `Plan created for: ${goal}`;
    result.context = { goal, plan, tools: tools.length, mode: 'planning-only' };
    
    return result;
  }

  /**
   * Create a plan for the given goal
   * @param {string} goal - The goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Planning context
   * @returns {Promise<Array>} Generated plan
   */
  async createPlan(goal, tools = [], context = {}) {
    ValidationUtils.nonEmptyString(goal, 'goal');
    ValidationUtils.array(tools, 'tools');

    if (!this.planningStrategy) {
      throw new PlanningError('No planning strategy configured', goal, tools);
    }

    if (this.config.debugMode) {
      console.log(`[PlanningAgent] Creating plan for: ${goal}`);
    }

    // Generate plan using strategy with original interface
    const plan = await this.planningStrategy.generatePlan(goal, tools, context);

    if (this.config.debugMode) {
      console.log(`[PlanningAgent] Generated plan with ${plan?.length || 0} steps`);
    }

    return plan;
  }

  /**
   * Fix an invalid plan
   * @param {string} goal - Original goal
   * @param {Array} invalidPlan - The invalid plan
   * @param {Array} validationErrors - Validation errors
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Original context
   * @returns {Promise<Array>} Fixed plan
   */
  async fixPlan(goal, invalidPlan, validationErrors, tools = [], context = {}) {
    if (!this.planningStrategy) {
      throw new PlanningError('No planning strategy configured for plan fixing', goal, tools);
    }

    if (this.config.debugMode) {
      console.log(`[PlanningAgent] Fixing plan with ${validationErrors.length} errors`);
    }

    // Use the original strategy interface with fix-specific context
    const fixContext = { 
      ...context, 
      mode: 'fix', 
      invalidPlan, 
      validationErrors,
      validationFeedback: validationErrors.map(e => e.toString()).join('; ')
    };
    
    const fixedPlan = await this.planningStrategy.generatePlan(goal, tools, fixContext);

    if (this.config.debugMode) {
      console.log(`[PlanningAgent] Fixed plan with ${fixedPlan?.length || 0} steps`);
    }

    return fixedPlan;
  }

  /**
   * Replan after execution failure
   * @param {string} goal - Original goal
   * @param {Object} executionResult - Previous execution result
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Original context
   * @returns {Promise<Array>} New plan
   */
  async replan(goal, executionResult, tools = [], context = {}) {
    if (!this.planningStrategy) {
      throw new PlanningError('No planning strategy configured for replanning', goal, tools);
    }

    const replanContext = executionResult.getReplanningContext ? 
      executionResult.getReplanningContext() : 
      { error: 'Execution failed', completedSteps: [], failedSteps: [] };

    if (this.config.debugMode) {
      console.log(`[PlanningAgent] Replanning after failure:`, replanContext);
    }

    // Check if strategy has a replan method
    if (this.planningStrategy.replan) {
      // Use the original strategy replan interface
      const currentPlan = executionResult.completedSteps || [];
      const failedStep = replanContext.failedSteps?.[0] || { error: 'Unknown failure' };
      
      const newPlan = await this.planningStrategy.replan(currentPlan, failedStep, {
        ...context,
        goal,
        tools,
        replanContext
      });
      
      if (this.config.debugMode) {
        console.log(`[PlanningAgent] Generated replan with ${newPlan?.length || 0} steps`);
      }
      
      return newPlan;
    } else {
      // Fallback to regenerating plan with replan context
      const newContext = { 
        ...context, 
        mode: 'replan', 
        executionResult, 
        replanContext 
      };
      
      const newPlan = await this.planningStrategy.generatePlan(goal, tools, newContext);

      if (this.config.debugMode) {
        console.log(`[PlanningAgent] Generated replan with ${newPlan?.length || 0} steps`);
      }

      return newPlan;
    }
  }

  /**
   * Validate a plan
   * @param {Array} plan - Plan to validate
   * @param {Array<Executable>} tools - Available tools
   * @returns {Array} Validation errors (empty if valid)
   */
  validatePlan(plan, tools = []) {
    const errors = [];
    
    if (!Array.isArray(plan)) {
      errors.push('Plan must be an array');
      return errors;
    }
    
    if (plan.length === 0) {
      errors.push('Plan cannot be empty');
      return errors;
    }

    const toolNames = new Set(tools.map(tool => tool.name || tool));
    
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      
      if (!step || typeof step !== 'object') {
        errors.push(`Step ${i + 1}: Must be an object`);
        continue;
      }
      
      if (!step.tool) {
        errors.push(`Step ${i + 1}: Missing 'tool' field`);
      } else if (!toolNames.has(step.tool)) {
        errors.push(`Step ${i + 1}: Tool '${step.tool}' not available`);
      }
      
      if (!step.description) {
        errors.push(`Step ${i + 1}: Missing 'description' field`);
      }
    }
    
    return errors;
  }

  /**
   * Set dependencies for the agent
   * @param {Object} dependencies - Dependencies to inject
   */
  setDependencies(dependencies = {}) {
    if (dependencies.llmProvider) {
      this.llmProvider = dependencies.llmProvider;
      if (this.planningStrategy && this.planningStrategy.setLLMProvider) {
        this.planningStrategy.setLLMProvider(dependencies.llmProvider);
      }
    }
    
    if (dependencies.tracer) {
      this.tracer = dependencies.tracer;
      // Propagate to orchestrator if it exists
      if (this._orchestrator) {
        this._orchestrator.setDependencies({ tracer: dependencies.tracer });
      }
    }
    
    if (dependencies.artifactStore) {
      this.artifactStore = dependencies.artifactStore;
    }

    if (this.config.debugMode) {
      console.log(`[PlanningAgent] Dependencies set:`, Object.keys(dependencies));
    }
  }

  /**
   * Get agent configuration
   * @returns {AgentConfig} Current configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get agent ID
   * @returns {string} Agent identifier
   */
  getId() {
    return this.agentId;
  }

  /**
   * Get agent metadata for tool composition
   * @returns {Object} Metadata
   */
  getMetadata() {
    return {
      name: this.config.name,
      description: this.config.description,
      type: 'planning-agent',
      capabilities: {
        planning: true,
        execution: this.config.orchestration.enabled,
        replanning: this.config.orchestration.enabled,
        composition: true // Can be used as a tool
      },
      interface: {
        method: 'run',
        parameters: ['goal', 'tools', 'context'],
        returns: 'AgentResult'
      }
    };
  }

  /**
   * Check if agent can be used as an executable tool
   * @returns {boolean} True if agent can be used as a tool
   */
  isExecutable() {
    return true;
  }

  /**
   * Execute method for tool compatibility
   * Delegates to run method for consistent interface
   * @param {Object} input - Tool input with goal, tools, context
   * @returns {Promise<any>} Execution result
   */
  async execute(input) {
    const { goal, tools = [], context = {} } = input || {};
    
    if (!goal) {
      throw new Error('Agent execution requires a goal parameter');
    }
    
    const result = await this.run(goal, tools, context);
    
    // Return simplified result for tool usage
    if (result.success) {
      return result.result || result.context;
    } else {
      throw new Error(result.message || result.error?.message || 'Agent execution failed');
    }
  }
}