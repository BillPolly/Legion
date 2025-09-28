/**
 * BTExecutor - Manages execution of behavior tree tasks
 * 
 * Responsibilities:
 * - Creates root task from tree configuration
 * - Initializes children recursively
 * - Maps node types to strategies
 * - Binds tools to action nodes
 * - Tracks execution completion
 * 
 * This uses a constructor function pattern instead of pure prototypal
 * to manage instance state better while executing trees.
 */

import { createBTTask } from '../factory/createBTTask.js';
import { SequenceStrategy } from '../strategies/SequenceStrategy.js';
import { SelectorStrategy } from '../strategies/SelectorStrategy.js';
import { ActionStrategy } from '../strategies/ActionStrategy.js';
import { ConditionStrategy } from '../strategies/ConditionStrategy.js';
import { RetryStrategy } from '../strategies/RetryStrategy.js';

/**
 * BTExecutor constructor
 * 
 * @param {Object} toolRegistry - Registry for looking up tools
 */
export function BTExecutor(toolRegistry) {
  this.toolRegistry = toolRegistry;
  this.rootTask = null;
  this.executionTimeout = 30000; // Default 30 second timeout
}

/**
 * Execute a behavior tree from configuration
 * 
 * @param {Object} treeConfig - Tree configuration object
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Execution result with status and context
 */
BTExecutor.prototype.executeTree = async function(treeConfig, context) {
  // Ensure toolRegistry is in context
  if (!context.toolRegistry) {
    context.toolRegistry = this.toolRegistry;
  }
  
  // Create root task from configuration
  this.rootTask = createBTTask(
    treeConfig.name || 'BehaviorTree',
    null,  // no parent
    this.getStrategyForType(treeConfig.type),
    treeConfig
  );
  
  // Initialize children recursively (pass toolRegistry)
  await this.initializeChildren(this.rootTask, treeConfig.children, context);
  
  // Start execution
  this.rootTask.send(this.rootTask, {
    type: 'execute',
    context: context
  });
  
  // Wait for completion with timeout
  return this.waitForCompletion(this.rootTask, context);
};

/**
 * Initialize child tasks recursively
 * 
 * @param {Object} parentTask - Parent task
 * @param {Array} childConfigs - Array of child configurations
 * @param {Object} context - Execution context
 */
BTExecutor.prototype.initializeChildren = async function(parentTask, childConfigs, context) {
  for (const childConfig of childConfigs || []) {
    const childTask = createBTTask(
      childConfig.name || childConfig.type,
      parentTask,
      this.getStrategyForType(childConfig.type),
      childConfig
    );
    
    // Bind tool if action node
    if (childConfig.type === 'action' && childConfig.tool) {
      // Get toolRegistry from context or use instance toolRegistry
      const toolRegistry = context.toolRegistry || this.toolRegistry;
      if (toolRegistry) {
        const tool = await toolRegistry.getTool(childConfig.tool);
        if (tool) {
          // Store tool reference for action execution
          childTask.toolInstance = tool;
        }
        // If tool not found, action will handle error during execution
      }
    }
    
    // Recursively initialize children
    await this.initializeChildren(childTask, childConfig.children, context);
  }
};

/**
 * Wait for tree execution to complete
 * 
 * @param {Object} rootTask - The root task to wait for
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Execution result
 */
BTExecutor.prototype.waitForCompletion = function(rootTask, context) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    
    // Set up completion handler
    const checkCompletion = () => {
      if (rootTask.status === 'completed') {
        clearTimeout(timeoutId);
        resolve({
          status: 'SUCCESS',
          data: rootTask.result,
          context: context
        });
      } else if (rootTask.status === 'failed') {
        clearTimeout(timeoutId);
        // Error could be in rootTask.error or rootTask.result.error
        const errorMessage = rootTask.error?.message || 
                           rootTask.error || 
                           rootTask.result?.error ||
                           'Tree execution failed';
        resolve({
          status: 'FAILURE',
          error: errorMessage,
          data: rootTask.result,
          context: context
        });
      } else {
        // Check again soon
        setTimeout(checkCompletion, 10);
      }
    };
    
    // Set up timeout
    timeoutId = setTimeout(() => {
      resolve({
        status: 'FAILURE',
        error: 'Execution timeout exceeded',
        context: context
      });
    }, this.executionTimeout);
    
    // Start checking
    checkCompletion();
  });
};

/**
 * Get strategy prototype for a node type
 * 
 * @param {string} type - Node type (sequence, selector, action, etc.)
 * @returns {Object} Strategy prototype
 */
BTExecutor.prototype.getStrategyForType = function(type) {
  switch(type) {
    case 'sequence':
      return SequenceStrategy;
    case 'selector':
      return SelectorStrategy;
    case 'action':
      return ActionStrategy;
    case 'condition':
      return ConditionStrategy;
    case 'retry':
      return RetryStrategy;
    default:
      throw new Error(`Unknown node type: ${type}`);
  }
};

/**
 * Register a custom strategy for a node type
 * 
 * @param {string} type - Node type name
 * @param {Object} strategy - Strategy prototype
 */
BTExecutor.prototype.registerStrategy = function(type, strategy) {
  // Store custom strategies in a map
  if (!this.customStrategies) {
    this.customStrategies = new Map();
  }
  this.customStrategies.set(type, strategy);
  
  // Override getStrategyForType to check custom strategies first
  const originalGetStrategy = this.getStrategyForType;
  this.getStrategyForType = function(nodeType) {
    if (this.customStrategies && this.customStrategies.has(nodeType)) {
      return this.customStrategies.get(nodeType);
    }
    return originalGetStrategy.call(this, nodeType);
  };
};

export default BTExecutor;