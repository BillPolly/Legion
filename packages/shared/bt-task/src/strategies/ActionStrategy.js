/**
 * ActionStrategy - Executes tool actions as BT leaf nodes
 * 
 * Behavior:
 * - Looks up tool from toolRegistry in context
 * - Resolves parameters with @ syntax from artifacts
 * - Executes tool and awaits result
 * - Stores result in artifacts if outputVariable configured
 * - Maps tool success/failure to BT status
 * 
 * This is a pure prototypal implementation extending BTTaskStrategy.
 */

import { BTTaskStrategy } from '../core/BTTaskStrategy.js';

/**
 * Action node strategy
 * Extends BTTaskStrategy to provide tool execution
 */
export const ActionStrategy = Object.create(BTTaskStrategy);

/**
 * Execute BT node - in this case, execute a tool action
 * 
 * @param {Object} task - The task being executed (usually 'this')
 * @param {Object} message - The execute message with context
 */
ActionStrategy.executeBTNode = async function(task, message) {
  const context = message.context || this.context;
  
  if (!context) {
    this.completeBTNode({
      status: 'FAILURE',
      error: 'No execution context provided',
      context: {}  // Pass empty context
    });
    return;
  }
  
  try {
    // Check if tool was pre-bound during initialization
    let tool = this.toolInstance;
    
    if (!tool) {
      // Fall back to looking up from context.toolRegistry
      const toolRegistry = context.toolRegistry;
      if (!toolRegistry) {
        this.completeBTNode({
          status: 'FAILURE',
          error: 'No toolRegistry in context and no pre-bound tool',
          context: context
        });
        return;
      }
      
      // Get tool name from config
      const toolName = this.config?.tool;
      if (!toolName) {
        this.completeBTNode({
          status: 'FAILURE',
          error: 'No tool specified in action config',
          context: context
        });
        return;
      }
      
      // Look up tool
      tool = await toolRegistry.getTool(toolName);
      if (!tool) {
        this.completeBTNode({
          status: 'FAILURE',
          error: `Tool '${toolName}' not found in registry`,
          context: context
        });
        return;
      }
    }
    
    // Resolve parameters
    const params = this.config?.params || {};
    const resolvedParams = this.resolveParameters(params, context);
    
    // Execute tool
    const result = await tool.execute(resolvedParams);
    
    // Store result in artifacts if outputVariable configured
    if (this.config?.outputVariable && result.success && result.data !== undefined) {
      // Store in the context that was passed in, not this.context
      if (!context.artifacts) {
        context.artifacts = {};
      }
      context.artifacts[this.config.outputVariable] = {
        name: this.config.outputVariable,
        value: result.data,
        description: `Output from ${this.config.tool}`,
        type: 'tool_output',
        createdAt: new Date()
      };
      this.artifacts.add(this.config.outputVariable);
    }
    
    // Map result to BT status
    if (result.success) {
      this.completeBTNode({
        status: 'SUCCESS',
        data: result.data,
        message: result.message,
        context: context  // Pass updated context back to parent
      });
    } else {
      this.completeBTNode({
        status: 'FAILURE',
        error: result.error || result.message || 'Tool execution failed',
        data: result.data,
        context: context  // Pass context even on failure
      });
    }
    
  } catch (error) {
    // Handle execution errors
    this.completeBTNode({
      status: 'FAILURE',
      error: error.message || String(error),
      context: context  // Pass context even on error
    });
  }
};

export default ActionStrategy;