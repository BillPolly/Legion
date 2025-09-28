/**
 * SequenceStrategy - Executes children in sequential order
 * 
 * Behavior:
 * - Executes children one at a time in order
 * - Fails immediately if any child fails (fail-fast)
 * - Succeeds only when all children succeed
 * - Passes context through to each child
 * 
 * This is a pure prototypal implementation extending BTTaskStrategy.
 */

import { BTTaskStrategy } from '../core/BTTaskStrategy.js';

/**
 * Sequence node strategy
 * Extends BTTaskStrategy to provide sequential execution
 */
export const SequenceStrategy = Object.create(BTTaskStrategy);

/**
 * Execute children sequentially
 * Starts with the first child
 * 
 * @param {Object} context - Execution context to pass to children
 */
SequenceStrategy.executeChildren = function(context) {
  // Handle empty sequence
  if (!this.children || this.children.length === 0) {
    this.completeBTNode({
      status: 'SUCCESS',
      message: 'Empty sequence completed'
    });
    return;
  }
  
  // Use the execution context as the task's context
  // This ensures artifacts created by children are accessible on this task
  this.context = context;
  this.executionContext = context;
  
  // Initialize to first child
  this.currentChildIndex = 0;
  
  // Start executing first child
  this.executeNextChild(context);
};

/**
 * Execute the next child in the sequence
 * 
 * @param {Object} context - Execution context
 */
SequenceStrategy.executeNextChild = function(context) {
  const child = this.children[this.currentChildIndex];
  
  if (!child) {
    // No more children - shouldn't happen but handle gracefully
    this.completeBTNode({
      status: 'SUCCESS',
      message: 'All children executed'
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
SequenceStrategy.handleChildResult = function(childTask, message) {
  // Check child status
  if (message.status === 'FAILURE') {
    // Fail-fast: stop and fail immediately
    this.completeBTNode({
      status: 'FAILURE',
      error: message.error || 'Child node failed',
      failedAt: this.currentChildIndex,
      failedChild: childTask.description || childTask.id
    });
    return;
  }
  
  if (message.status === 'SUCCESS') {
    // Move to next child
    this.currentChildIndex++;
    
    // Check if we have more children
    if (this.currentChildIndex < this.children.length) {
      // Execute next child
      this.executeNextChild(message.context || this.executionContext);
    } else {
      // All children succeeded - complete with success
      this.completeBTNode({
        status: 'SUCCESS',
        message: 'All children completed successfully',
        childrenCount: this.children.length
      });
    }
  }
  // Ignore other statuses (RUNNING, PENDING) - wait for final result
};

export default SequenceStrategy;