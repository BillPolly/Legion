/**
 * StrategyRegistry - Central registry for creating, caching, and managing strategies
 * 
 * This registry ensures strategies are created once, fully initialized with prompts and tools,
 * then cached for reuse across multiple task instances. This is the correct pattern since:
 * 
 * 1. Strategies are expensive to initialize (prompts, tools, configurations)
 * 2. Strategies are stateless and can be reused safely
 * 3. Task nodes are cheap to create and use the cached strategy
 * 
 * Benefits:
 * - Strategies initialized once at startup/first use
 * - Fast task node creation (no initialization overhead)
 * - Consistent strategy behavior across all tasks
 * - Easy dependency injection for strategies
 */

import { createStandardStrategy, createTypedStrategy } from './StandardTaskStrategy.js';

/**
 * Global strategy registry singleton
 */
class StrategyRegistry {
  constructor() {
    this.strategies = new Map();
    this.strategyConfigs = new Map();
    this.initialized = false;
  }
  
  /**
   * Register a strategy configuration for later initialization
   * 
   * @param {string} name - Strategy name (e.g., 'simple-node-test')
   * @param {Object} config - Strategy configuration
   */
  register(name, config) {
    this.strategyConfigs.set(name, config);
  }
  
  /**
   * Initialize all registered strategies with proper dependencies
   * This should be called once at application startup
   * 
   * @param {Object} context - Global context (llmClient, toolRegistry, etc.)
   * @param {Object} options - Global options (projectRoot, sessionLogger, etc.)
   */
  async initializeAll(context, options = {}) {
    console.log(`🚀 Initializing ${this.strategyConfigs.size} strategies...`);
    
    const initPromises = [];
    for (const [name, config] of this.strategyConfigs) {
      initPromises.push(this.initializeStrategy(name, context, options));
    }
    
    await Promise.all(initPromises);
    this.initialized = true;
    
    console.log(`✅ All strategies initialized and cached`);
  }
  
  /**
   * Initialize a single strategy and cache it
   * 
   * @param {string} name - Strategy name
   * @param {Object} context - Context for strategy
   * @param {Object} options - Options for strategy
   */
  async initializeStrategy(name, context, options = {}) {
    if (this.strategies.has(name)) {
      return this.strategies.get(name);
    }
    
    const config = this.strategyConfigs.get(name);
    if (!config) {
      throw new Error(`Strategy '${name}' not registered`);
    }
    
    console.log(`  📦 Initializing strategy: ${name}`);
    
    try {
      // Create the strategy factory
      const factory = createTypedStrategy(
        config.strategyType || name,
        config.requiredTools || [],
        config.promptSchemas || {},
        config.additionalConfig || {}
      );
      
      // Create and initialize the strategy instance
      const strategy = await factory(context, options);
      
      // Store additional configuration on strategy
      if (config.doWork) {
        strategy.doWork = config.doWork;
      }
      
      if (config.getPromptPath) {
        strategy.getPromptPath = config.getPromptPath;
      }
      
      if (config.customMethods) {
        Object.assign(strategy, config.customMethods);
      }
      
      // Cache the fully initialized strategy
      this.strategies.set(name, strategy);
      
      console.log(`    ✅ Strategy '${name}' initialized with ${Object.keys(strategy.prompts || {}).length} prompts`);
      
      return strategy;
    } catch (error) {
      console.error(`    ❌ Failed to initialize strategy '${name}': ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get a cached strategy (must be initialized first)
   * 
   * @param {string} name - Strategy name
   * @returns {Object} Initialized strategy instance
   */
  getStrategy(name) {
    if (!this.strategies.has(name)) {
      throw new Error(`Strategy '${name}' not found in registry. Make sure it's registered and initialized.`);
    }
    
    return this.strategies.get(name);
  }
  
  /**
   * Create a task node that uses a cached strategy
   * This is fast since the strategy is already initialized
   * 
   * @param {string} strategyName - Name of cached strategy
   * @param {Object} taskConfig - Task-specific configuration
   * @returns {Object} Task node ready for execution
   */
  createTaskNode(strategyName, taskConfig = {}) {
    const strategy = this.getStrategy(strategyName);
    
    // Create a task node that wraps the strategy
    const taskNode = {
      id: taskConfig.id || `${strategyName}-${Date.now()}`,
      description: taskConfig.description || `Task using ${strategyName} strategy`,
      strategy: strategy,
      metadata: taskConfig.metadata || {},
      
      // Task execution method
      async execute(task) {
        // Initialize strategy for this specific task (fast)
        await strategy.initializeForTask(task);
        
        // Execute the strategy's doWork method in task context
        return await strategy.doWork.call(task);
      },
      
      // Message handler delegates to strategy
      onMessage(senderTask, message) {
        return strategy.onMessage.call(this, senderTask, message);
      }
    };
    
    return taskNode;
  }
  
  /**
   * List all registered strategies
   */
  listStrategies() {
    return {
      registered: Array.from(this.strategyConfigs.keys()),
      initialized: Array.from(this.strategies.keys()),
      total: this.strategyConfigs.size,
      ready: this.strategies.size
    };
  }
  
  /**
   * Check if registry is fully initialized
   */
  isReady() {
    return this.initialized && this.strategies.size === this.strategyConfigs.size;
  }
  
  /**
   * Clear all cached strategies (for testing or reinitialization)
   */
  clear() {
    this.strategies.clear();
    this.initialized = false;
  }
}

// Export singleton instance
export const strategyRegistry = new StrategyRegistry();

/**
 * Convenience function to register a strategy with full configuration
 * 
 * @param {string} name - Strategy name
 * @param {Object} config - Complete strategy configuration
 */
export function registerStrategy(name, config) {
  strategyRegistry.register(name, config);
}

/**
 * Convenience function to register multiple strategies at once
 * 
 * @param {Object} strategies - Map of strategy names to configurations
 */
export function registerStrategies(strategies) {
  for (const [name, config] of Object.entries(strategies)) {
    strategyRegistry.register(name, config);
  }
}

/**
 * Quick helper to create a task using a cached strategy
 * 
 * @param {string} strategyName - Name of strategy to use
 * @param {Object} taskConfig - Task configuration
 * @returns {Object} Ready-to-execute task node
 */
export function createTask(strategyName, taskConfig) {
  return strategyRegistry.createTaskNode(strategyName, taskConfig);
}

/**
 * Initialize all strategies with default context
 * This is typically called once at application startup
 * 
 * @param {Object} context - Global context (llmClient, toolRegistry, etc.)
 * @param {Object} options - Global options
 */
export async function initializeStrategies(context, options = {}) {
  return await strategyRegistry.initializeAll(context, options);
}

export default strategyRegistry;