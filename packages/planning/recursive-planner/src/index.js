/**
 * Recursive Planning Agent Framework - Main Entry Point
 * 
 * Single clean export of the framework
 */

// Import all components
import { PlanningAgent, AgentConfig } from './core/agents/base/index.js';
import { AtomicTool } from './core/execution/tools/index.js';
import { 
  PlanningStrategy,
  SequentialPlanningStrategy,
  TemplatePlanningStrategy,
  RuleBasedPlanningStrategy,
  LLMPlanningStrategy
} from './core/execution/planning/strategies/index.js';
import { ArtifactStore } from './core/storage/artifacts/index.js';
import { createPlanningAgent, createLLMProvider } from './factories/AgentFactory.js';
import { createTool } from './factories/ToolFactory.js';
import { createTemplatePlanner, createRulePlanner } from './factories/PlannerFactory.js';
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
    
    // Planning strategies
    this.strategies = {
      PlanningStrategy,
      SequentialPlanningStrategy,
      TemplatePlanningStrategy,
      RuleBasedPlanningStrategy,
      LLMPlanningStrategy
    };
    
    // Factory functions
    this.factories = {
      createPlanningAgent,
      createTool,
      createTemplatePlanner,
      createRulePlanner,
      createLLMProvider
    };
    
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

export default RecursivePlanner;