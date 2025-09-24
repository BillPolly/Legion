/**
 * StrategyFactory - Utility for creating strategy prototypes with consistent patterns
 * 
 * This factory eliminates the repeated boilerplate code found in all strategy factory functions:
 * - Legacy signature compatibility handling
 * - Context and options normalization  
 * - Base strategy prototype creation
 * - Standard configuration setup
 */

/**
 * Create a strategy prototype with standardized factory signature handling
 * 
 * @param {Function} BaseStrategy - The base strategy class to inherit from (TaskStrategy, EnhancedTaskStrategy, etc.)
 * @param {Object|Function} context - Context object or legacy llmClient
 * @param {Object|Function} options - Options object or legacy toolRegistry
 * @param {Object} strategyConfig - Strategy-specific configuration
 * @returns {Object} Strategy prototype with normalized context and config
 */
export function createStrategy(BaseStrategy, context, options, strategyConfig = {}) {
  // Handle all possible legacy signature variations
  const { actualContext, actualOptions } = normalizeLegacySignature(context, options);
  
  // Create the strategy prototype
  const strategy = Object.create(BaseStrategy);
  
  // Build standard configuration
  const config = createStandardConfig(actualContext, actualOptions, strategyConfig);
  
  // Attach standard properties
  strategy.context = actualContext;
  strategy.config = config;
  strategy.sessionLogger = actualOptions.sessionLogger;
  
  // Store llmClient for TemplatedPrompt/PromptLoader usage
  if (actualContext.llmClient) {
    strategy.llmClient = actualContext.llmClient;
  }
  
  return strategy;
}

/**
 * Normalize all possible legacy factory signatures into consistent context/options
 * This handles all the complex signature detection logic that was duplicated across strategies
 */
function normalizeLegacySignature(context, options) {
  let actualContext = context || {};
  let actualOptions = options || {};
  
  // Handle different argument patterns
  if (arguments.length >= 2) {
    if (arguments.length === 3) {
      // Old signature: (llmClient, toolRegistry, options)
      actualContext = { 
        llmClient: arguments[0], 
        toolRegistry: arguments[1] 
      };
      actualOptions = arguments[2] || {};
    } else if (arguments.length === 2 && arguments[1]) {
      // Need to determine if second arg is toolRegistry or options
      if (hasLegacyToolRegistrySignature(arguments[0], arguments[1])) {
        // Old signature: (llmClient, toolRegistry)
        actualContext = { 
          llmClient: arguments[0], 
          toolRegistry: arguments[1] 
        };
        actualOptions = {};
      } else if (isContextObject(arguments[0])) {
        // New signature: (context, options)
        actualContext = arguments[0];
        actualOptions = arguments[1];
      } else {
        // Mixed: (llmClient, options)
        actualContext = { llmClient: arguments[0] };
        actualOptions = arguments[1];
      }
    } else if (arguments.length === 1) {
      if (isContextObject(arguments[0])) {
        // New signature: (context)
        actualContext = arguments[0];
        actualOptions = {};
      } else {
        // Legacy: (llmClient)
        actualContext = { llmClient: arguments[0] };
        actualOptions = {};
      }
    }
  }
  
  return { actualContext, actualOptions };
}

/**
 * Detect if we have the legacy (llmClient, toolRegistry) signature
 */
function hasLegacyToolRegistrySignature(first, second) {
  // If second arg has toolRegistry-like properties but not context-like properties
  return second && 
         !second.llmClient && 
         !second.toolRegistry && 
         !isOptionsObject(second) &&
         (first && typeof first === 'object' && !isContextObject(first));
}

/**
 * Check if an object looks like a context object
 */
function isContextObject(obj) {
  return obj && 
         typeof obj === 'object' && 
         (obj.llmClient || obj.toolRegistry || obj.workspaceDir);
}

/**
 * Check if an object looks like an options object
 */
function isOptionsObject(obj) {
  return obj && 
         typeof obj === 'object' && 
         (obj.projectRoot || obj.sessionLogger || obj.maxRetries);
}

/**
 * Create standardized configuration object
 * This eliminates the repeated config object creation in every strategy
 */
function createStandardConfig(context, options, strategySpecific = {}) {
  const config = {
    // Standard context
    context: context,
    
    // Common options with defaults
    projectRoot: options.projectRoot || '/tmp/roma-projects',
    maxRetries: options.maxRetries || 3,
    timeout: options.timeout || 30000,
    
    // Tool storage (to be populated by strategy)
    tools: {},
    
    // Strategy-specific overrides
    ...strategySpecific
  };
  
  return config;
}

/**
 * Convenience function for creating strategies that inherit from TaskStrategy
 */
export async function createTaskStrategy(context, options, strategyConfig) {
  const { TaskStrategy } = await import('@legion/tasks');
  return createStrategy(TaskStrategy, context, options, strategyConfig);
}

/**
 * Convenience function for creating strategies that inherit from EnhancedTaskStrategy
 */
export async function createEnhancedTaskStrategy(context, options, strategyConfig) {
  const { EnhancedTaskStrategy } = await import('@legion/tasks');
  return createStrategy(EnhancedTaskStrategy, context, options, strategyConfig);
}