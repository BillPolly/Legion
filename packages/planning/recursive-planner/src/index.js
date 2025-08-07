/**
 * Recursive Planning Agent Framework - Main Entry Point
 * 
 * Now uses @legion/unified-planner for all planning functionality
 * while maintaining backward compatibility for existing APIs.
 */

// Import unified planning components
import { 
  PlannerEngine,
  PlanningRequest,
  LLMStrategy,
  TemplateStrategy,
  RuleStrategy,
  createLLMPlanner,
  createMultiStrategyPlanner,
  createTemplatePlanner,
  createRulePlanner
} from '@legion/unified-planner';

// Import validation components
import { BTValidator } from '@legion/bt-validator';

// Import remaining framework components
import { PlanningAgent, AgentConfig } from './core/agents/base/index.js';
import { AtomicTool } from './core/execution/tools/index.js';
import { ArtifactStore } from './core/storage/artifacts/index.js';
import { createPlanningAgent, createLLMProvider } from './factories/AgentFactory.js';
import { createTool } from './factories/ToolFactory.js';
import { IdGenerator } from './foundation/utils/generators/index.js';
import { ValidationUtils, InputValidator } from './foundation/utils/validation/index.js';
import { ConfigManager, config } from './runtime/config/index.js';
import { PlanStep } from './foundation/types/index.js';

/**
 * Main RecursivePlanner class that provides access to all framework components
 */
class RecursivePlanner {
  constructor() {
    // Core classes
    this.PlanningAgent = PlanningAgent;
    this.AgentConfig = AgentConfig;
    this.AtomicTool = AtomicTool;
    this.ArtifactStore = ArtifactStore;
    this.PlanStep = PlanStep;
    
    // Planning strategies (now from unified-planner)
    this.strategies = {
      LLMStrategy,
      TemplateStrategy,
      RuleStrategy,
      // Backward compatibility aliases
      LLMPlanningStrategy: LLMStrategy,
      TemplatePlanningStrategy: TemplateStrategy,
      RuleBasedPlanningStrategy: RuleStrategy
    };
    
    // Factory functions (now from unified-planner + legacy)
    this.factories = {
      createPlanningAgent,
      createTool,
      createLLMProvider,
      // New unified planner factories
      createLLMPlanner,
      createMultiStrategyPlanner, 
      createTemplatePlanner,
      createRulePlanner
    };
    
    // Planning engine (new from unified-planner)
    this.PlannerEngine = PlannerEngine;
    this.PlanningRequest = PlanningRequest;
    this.BTValidator = BTValidator;
    
    // Utilities
    this.utils = {
      IdGenerator,
      ValidationUtils,
      InputValidator
    };
    
    // Configuration
    this.config = {
      ConfigManager,
      config
    };
    
    // Framework metadata
    this.VERSION = '1.0.0';
    this.FRAMEWORK_INFO = {
      name: 'Recursive Planning Agent Framework',
      version: '1.0.0',
      description: 'A modular framework for building intelligent agent systems'
    };
  }

  /**
   * Create a new planning agent with the given configuration
   * @param {Object} config - Agent configuration
   * @returns {PlanningAgent} A new planning agent instance
   */
  createAgent(config) {
    return this.factories.createPlanningAgent(config);
  }

  /**
   * Create a new tool with the given configuration
   * @param {string} name - Tool name
   * @param {string} description - Tool description
   * @param {Function} executor - Tool execution function
   * @param {Object} config - Additional configuration
   * @returns {AtomicTool} A new tool instance
   */
  createTool(name, description, executor, config) {
    return this.factories.createTool(name, description, executor, config);
  }

  /**
   * Create a new LLM-based planner (new unified API)
   * @param {Object} llmClient - LLM client
   * @param {Object} options - Planner options
   * @returns {Object} LLM planner instance
   */
  createLLMPlanner(llmClient, options) {
    return this.factories.createLLMPlanner(llmClient, options);
  }

  /**
   * Create a multi-strategy planner (new unified API)
   * @param {Object} options - Planner options
   * @returns {Object} Multi-strategy planner instance
   */
  createMultiStrategyPlanner(options) {
    return this.factories.createMultiStrategyPlanner(options);
  }

  /**
   * Create a planning request (new unified API)
   * @param {Object} params - Request parameters
   * @returns {PlanningRequest} Planning request instance
   */
  createPlanningRequest(params) {
    return new this.PlanningRequest(params);
  }

  /**
   * Create a BT validator (new unified API)  
   * @param {Object} options - Validator options
   * @returns {BTValidator} BT validator instance
   */
  createBTValidator(options) {
    return new this.BTValidator(options);
  }

  /**
   * Get information about the framework
   * @returns {Object} Framework information
   */
  getInfo() {
    return this.FRAMEWORK_INFO;
  }

  /**
   * Get the framework version
   * @returns {string} Framework version
   */
  getVersion() {
    return this.VERSION;
  }
}

// Re-export unified planner components for direct access
export {
  PlannerEngine,
  PlanningRequest,
  LLMStrategy,
  TemplateStrategy, 
  RuleStrategy,
  createLLMPlanner,
  createMultiStrategyPlanner,
  createTemplatePlanner,
  createRulePlanner
} from '@legion/unified-planner';

export { BTValidator } from '@legion/bt-validator';

// Legacy exports for backward compatibility
export { PlanningAgent, AgentConfig } from './core/agents/base/index.js';
export { AtomicTool } from './core/execution/tools/index.js';
export { ArtifactStore } from './core/storage/artifacts/index.js';
export { PlanStep } from './foundation/types/index.js';

export default RecursivePlanner;