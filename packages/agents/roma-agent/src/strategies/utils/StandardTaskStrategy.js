/**
 * StandardTaskStrategy - Ultimate base class that eliminates all boilerplate
 * 
 * This class combines EnhancedTaskStrategy with all our abstraction utilities to create
 * a single base class that handles all common patterns found across strategies:
 * 
 * Features Eliminated:
 * - Factory signature handling (uses StrategyFactory)
 * - Message routing and error handling (uses MessageHandlers)
 * - Common helper functions (uses StrategyHelpers)
 * - Configuration setup patterns
 * - Dependency initialization
 * - Child task handling
 * - Artifact management patterns
 * - Parent notification patterns
 * 
 * With this base class, strategy implementations only need to:
 * 1. Define their specific prompt schemas
 * 2. Implement their core work logic in doWork()
 * 3. Optionally override specific handlers
 */

import { EnhancedTaskStrategy } from '@legion/tasks';
import { createStrategy } from './StrategyFactory.js';
import { createOnMessageHandler, createMessageRoutes } from './MessageHandlers.js';
import { 
  getContextFromTask, 
  initializeDependencies, 
  handleChildComplete,
  getTaskContext,
  completeWithArtifacts,
  failWithError,
  notifyParent
} from './StrategyHelpers.js';

/**
 * StandardTaskStrategy - The ultimate abstraction
 * 
 * This creates a base class prototype that strategies can inherit from.
 * All boilerplate is handled automatically.
 */
export const StandardTaskStrategy = Object.create(EnhancedTaskStrategy);

// Construction-time initialization (done once when strategy is created)
StandardTaskStrategy.initializeStrategy = async function(requiredTools = [], promptSchemas = {}) {
  // Store configuration for later use
  this.requiredTools = requiredTools;
  this.promptSchemas = promptSchemas;
  this.prompts = {};
  
  // Pre-load all prompts since strategy is created once and reused
  for (const promptName of Object.keys(promptSchemas)) {
    try {
      await this.loadPrompt(promptName);
    } catch (error) {
      console.warn(`Failed to pre-load prompt ${promptName}: ${error.message}`);
    }
  }
  
  // Setup message routes with standard patterns
  const messageRoutes = createMessageRoutes({
    start: this.doWork?.bind(this),
    work: this.doWork?.bind(this),
    abort: this.onAbort?.bind(this)
  });
  
  // Create the onMessage handler with all standard patterns
  this.onMessage = createOnMessageHandler(messageRoutes, {
    strategyName: this.constructor.name || 'StandardStrategy',
    enableChildHandling: true,
    enableAsyncErrorBoundary: true
  });
  
  return this;
};

// Task-time initialization (done for each task instance)
StandardTaskStrategy.initializeForTask = async function(task) {
  // Initialize dependencies that are task-specific
  const context = getContextFromTask(task);
  
  // Update config with task-specific context
  this.config.llmClient = this.config.llmClient || this.config.context?.llmClient || context.llmClient;
  this.config.toolRegistry = this.config.toolRegistry || this.config.context?.toolRegistry || context.toolRegistry;
  
  if (!this.config.llmClient) {
    throw new Error('LLM client is required');
  }
  
  if (!this.config.toolRegistry) {
    throw new Error('ToolRegistry is required');
  }
  
  // Load required tools for this task (if not already loaded)
  for (const toolName of this.requiredTools || []) {
    if (!this.config.tools[toolName]) {
      try {
        this.config.tools[toolName] = await this.config.toolRegistry.getTool(toolName);
        if (!this.config.tools[toolName]) {
          console.warn(`Tool '${toolName}' not found in registry`);
        }
      } catch (error) {
        console.error(`Failed to load tool '${toolName}': ${error.message}`);
      }
    }
  }
  
  return this;
};

// Provide standard context helpers
StandardTaskStrategy.getContext = function() {
  return getContextFromTask(this);
};

StandardTaskStrategy.getTaskContext = function() {
  return getTaskContext(this);
};

// Provide standard completion helpers
StandardTaskStrategy.completeWithArtifacts = function(artifacts, result) {
  return completeWithArtifacts(this, artifacts, result);
};

StandardTaskStrategy.failWithError = function(error, message) {
  return failWithError(this, error, message);
};

StandardTaskStrategy.notifyParent = function(messageType, data) {
  return notifyParent(this, messageType, data);
};

// Handle child completion with standard pattern
StandardTaskStrategy.handleChildComplete = function(senderTask, result) {
  return handleChildComplete.call(this, senderTask, result, this.config);
};

// Load a prompt during strategy construction (called once)
StandardTaskStrategy.loadPrompt = async function(promptName) {
  if (!this.promptSchemas[promptName]) {
    throw new Error(`Unknown prompt: ${promptName}`);
  }
  
  if (!this.llmClient) {
    throw new Error('LLMClient is required for TemplatedPrompt');
  }
  
  // Use PromptLoader for declarative prompt loading
  const { PromptLoader } = await import('@legion/prompting-manager');
  
  const promptPath = this.getPromptPath ? 
    this.getPromptPath(promptName) : 
    `${this.strategyType}/${promptName.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
  
  this.prompts[promptName] = await PromptLoader.load(promptPath, {
    responseSchema: this.promptSchemas[promptName],
    llmClient: this.llmClient,
    sessionLogger: this.sessionLogger
  });
  
  return this.prompts[promptName];
};

// Get a pre-loaded prompt (used during task execution)
StandardTaskStrategy.getPrompt = function(promptName) {
  if (!this.prompts[promptName]) {
    throw new Error(`Prompt '${promptName}' not loaded. Make sure it was included in promptSchemas during strategy construction.`);
  }
  return this.prompts[promptName];
};

/**
 * Factory function to create StandardTaskStrategy-based strategies
 * 
 * This completely eliminates the factory boilerplate found in every strategy
 * 
 * @param {Object} strategyConfig - Strategy-specific configuration
 * @returns {Function} Factory function that creates the strategy
 */
export function createStandardStrategy(strategyConfig = {}) {
  return async function standardStrategyFactory(context, options) {
    // Use StrategyFactory to handle all signature variations
    const strategy = createStrategy(StandardTaskStrategy, context, options, strategyConfig);
    
    // Set the strategy type for prompt path resolution
    strategy.strategyType = strategyConfig.strategyType || 'standard';
    
    // Perform construction-time initialization (done once)
    await strategy.initializeStrategy(
      strategyConfig.requiredTools || [],
      strategyConfig.promptSchemas || {}
    );
    
    return strategy;
  };
}

/**
 * Convenience factory for strategies that need specific base configurations
 * 
 * @param {string} strategyType - Type identifier for prompt path resolution
 * @param {Array<string>} requiredTools - Tools that must be loaded
 * @param {Object} promptSchemas - Schema definitions for prompts
 * @param {Object} additionalConfig - Additional strategy-specific config
 * @returns {Function} Async factory function
 */
export function createTypedStrategy(strategyType, requiredTools = [], promptSchemas = {}, additionalConfig = {}) {
  const strategyConfig = {
    strategyType,
    requiredTools,
    promptSchemas,
    ...additionalConfig
  };
  
  const factory = createStandardStrategy(strategyConfig);
  
  // Add onMessage method to factory so it can be used directly by tests
  // This maintains backward compatibility with existing test patterns
  factory.onMessage = async function(task, message) {
    // Create strategy instance with task context
    const context = {
      llmClient: task.context?.llmClient || (await import('@legion/resource-manager')).ResourceManager.getInstance().then(rm => rm.get('llmClient')),
      toolRegistry: task.context?.toolRegistry || (await import('@legion/tools-registry')).getToolRegistry()
    };
    
    try {
      const strategyInstance = await factory(context);
      
      // Copy doWork method from factory to instance BEFORE initialization
      if (factory.doWork && typeof factory.doWork === 'function') {
        strategyInstance.doWork = factory.doWork.bind(strategyInstance);
      }
      
      // Re-initialize strategy with doWork now available
      await strategyInstance.initializeStrategy(
        strategyConfig.requiredTools || [],
        strategyConfig.promptSchemas || {}
      );
      
      await strategyInstance.initializeForTask(task);
      
      // Route the message to the instance
      if (strategyInstance.onMessage) {
        return await strategyInstance.onMessage.call(task, task, message);
      } else {
        throw new Error('Strategy instance does not have onMessage method');
      }
    } catch (error) {
      console.error('Error in factory onMessage:', error);
      task.fail(error);
    }
  };
  
  return factory;
}

/**
 * Helper to create strategies with pre-configured message handlers
 * 
 * @param {string} strategyType - Type identifier
 * @param {Object} messageHandlers - Custom message handlers beyond doWork
 * @param {Object} config - Standard configuration
 * @returns {Function} Factory function
 */
export function createMessageBasedStrategy(strategyType, messageHandlers = {}, config = {}) {
  const factory = createTypedStrategy(strategyType, config.requiredTools, config.promptSchemas, config);
  
  // Return enhanced factory that adds custom message handlers
  return function messageBasedStrategyFactory(context, options) {
    const strategy = factory(context, options);
    
    // Override initialize to add custom message handlers
    const originalInitialize = strategy.initialize;
    strategy.initialize = async function(requiredTools, promptSchemas) {
      await originalInitialize.call(this, requiredTools, promptSchemas);
      
      // Merge custom handlers with standard ones
      const messageRoutes = createMessageRoutes({
        start: this.doWork?.bind(this),
        work: this.doWork?.bind(this),
        abort: this.onAbort?.bind(this),
        ...Object.fromEntries(
          Object.entries(messageHandlers).map(([type, handler]) => [
            type, 
            handler.bind(this)
          ])
        )
      });
      
      // Recreate onMessage with enhanced routes
      this.onMessage = createOnMessageHandler(messageRoutes, {
        strategyName: strategyType,
        enableChildHandling: true,
        enableAsyncErrorBoundary: true
      });
      
      return this;
    };
    
    return strategy;
  };
}

/**
 * Ultimate convenience function for simple strategies
 * 
 * This creates a complete strategy with minimal configuration.
 * Perfect for strategies that just need to implement doWork().
 * 
 * @param {string} strategyType - Type identifier
 * @param {Function} doWorkImpl - The core work implementation
 * @param {Object} config - Configuration (requiredTools, promptSchemas, etc.)
 * @returns {Function} Complete factory function
 */
export function createSimpleStrategy(strategyType, doWorkImpl, config = {}) {
  const factory = createTypedStrategy(strategyType, config.requiredTools, config.promptSchemas, config);
  
  return function simpleStrategyFactory(context, options) {
    const strategy = factory(context, options);
    
    // Attach the doWork implementation
    strategy.doWork = doWorkImpl;
    
    return strategy;
  };
}

/**
 * Migration helper for existing strategies
 * 
 * This allows existing strategies to gradually migrate to StandardTaskStrategy
 * without breaking existing functionality.
 */
export function migrateToStandardStrategy(existingFactory, config = {}) {
  return function migratedStrategyFactory(context, options) {
    // Create using StandardTaskStrategy
    const strategy = createStrategy(StandardTaskStrategy, context, options, config);
    
    // Apply the existing factory's logic to override/extend behavior
    const existingStrategy = existingFactory(context, options);
    
    // Copy over any custom methods or properties
    for (const key in existingStrategy) {
      if (key !== 'onMessage' && typeof existingStrategy[key] === 'function') {
        strategy[key] = existingStrategy[key];
      }
    }
    
    return strategy;
  };
}

export default StandardTaskStrategy;