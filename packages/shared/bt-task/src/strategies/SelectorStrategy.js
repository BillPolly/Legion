/**
 * SelectorStrategy - Tries alternatives until one succeeds
 * 
 * Behavior:
 * - Executes children one at a time in order
 * - Succeeds on first child success
 * - Fails only when all children fail
 * - Stops trying alternatives once one succeeds
 * 
 * This is a pure prototypal implementation extending BTTaskStrategy.
 */

import { BTTaskStrategy } from '../core/BTTaskStrategy.js';

/**
 * Selector node strategy
 * Extends BTTaskStrategy to provide alternative execution
 */
export const SelectorStrategy = Object.create(BTTaskStrategy);

/**
 * Execute children as alternatives
 * Starts with the first child
 * 
 * @param {Object} context - Execution context to pass to children
 */
SelectorStrategy.executeChildren = function(context) {
  // Handle empty selector
  if (!this.children || this.children.length === 0) {
    this.completeBTNode({
      status: 'FAILURE',
      error: 'Empty selector - no alternatives to try'
    });
    return;
  }
  
  // Store execution context for passing to children
  this.context = context;
  this.executionContext = context;
  
  // Initialize to first child
  this.currentChildIndex = 0;
  
  // Start executing first alternative
  this.executeNextChild(context);
};

/**
 * Execute the next alternative
 * 
 * @param {Object} context - Execution context
 */
SelectorStrategy.executeNextChild = function(context) {
  const child = this.children[this.currentChildIndex];
  
  if (!child) {
    // No more children - shouldn't happen but handle gracefully
    this.completeBTNode({
      status: 'FAILURE',
      error: 'No more alternatives to try'
    });
    return;
  }
  
  // Send execute message to child
  this.send(child, {
    type: 'execute',
    context: context || this.executionContext
  });
};

/**
 * Handle result from a child node
 * 
 * @param {Object} childTask - The child that reported result
 * @param {Object} message - The result message
 */
SelectorStrategy.handleChildResult = function(childTask, message) {
  // Check child status
  if (message.status === 'SUCCESS') {
    // Success on first alternative that works - complete immediately
    this.completeBTNode({
      status: 'SUCCESS',
      data: message.data,
      message: 'Alternative succeeded',
      succeededAt: this.currentChildIndex,
      succeededChild: childTask.description || childTask.id,
      context: message.context
    });
    return;
  }
  
  if (message.status === 'FAILURE') {
    // Try next alternative
    this.currentChildIndex++;
    
    // Check if we have more children
    if (this.currentChildIndex < this.children.length) {
      // Try next alternative
      this.executeNextChild(message.context || this.executionContext);
    } else {
      // All alternatives failed - complete with failure
      this.completeBTNode({
        status: 'FAILURE',
        error: 'All alternatives failed',
        childrenCount: this.children.length,
        lastError: message.error
      });
    }
  }
  // Ignore other statuses (RUNNING, PENDING) - wait for final result
};

export default SelectorStrategy;