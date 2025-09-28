/**
 * RetryStrategy - Retries failed children up to a maximum number of attempts
 * 
 * Behavior:
 * - Retries child on failure up to maxRetries (default 3)
 * - Configurable delay between retries (default 100ms)
 * - Succeeds immediately when child succeeds
 * - Fails after exceeding max retries
 * - Tracks retry attempt number in context
 * 
 * This is a pure prototypal implementation extending BTTaskStrategy.
 */

import { BTTaskStrategy } from '../core/BTTaskStrategy.js';

/**
 * Retry node strategy
 * Extends BTTaskStrategy to provide retry logic for failed children
 */
export const RetryStrategy = Object.create(BTTaskStrategy);

/**
 * Execute BT node - initiates child execution with retry tracking
 * 
 * @param {Object} task - The task being executed (usually 'this')
 * @param {Object} message - The execute message with context
 */
RetryStrategy.executeBTNode = function(task, message) {
  // Initialize retry state
  this.retryState = {
    currentAttempt: 0,
    maxRetries: this.config?.maxRetries !== undefined ? this.config.maxRetries : 3,  // Default 3 retries
    retryDelay: this.config?.retryDelay !== undefined ? this.config.retryDelay : 100,  // Default 100ms delay
    lastError: null,
    context: message.context || {}
  };
  
  // Start task
  this.start();
  
  // Execute first attempt
  this.executeChildren(message.context);
};

/**
 * Execute children with retry tracking
 * 
 * @param {Object} context - Execution context
 */
RetryStrategy.executeChildren = function(context) {
  // Check if we have children
  if (!this.children || this.children.length === 0) {
    this.completeBTNode({
      status: 'FAILURE',
      error: 'Retry node has no children to execute',
      context: context
    });
    return;
  }
  
  // Get the single child (retry nodes should have exactly one child)
  const child = this.children[0];
  
  // Add retry attempt to context
  const retryContext = {
    ...context,
    retryAttempt: this.retryState.currentAttempt
  };
  
  // Execute child
  this.send(child, {
    type: 'execute',
    context: retryContext
  });
};

/**
 * Handle child result - retry on failure or complete on success
 * 
 * @param {Object} childTask - The child task reporting result
 * @param {Object} message - The result message
 */
RetryStrategy.handleChildResult = function(childTask, message) {
  const context = message.context || this.retryState.context;
  
  if (message.status === 'SUCCESS') {
    // Child succeeded, complete immediately
    this.completeBTNode({
      status: 'SUCCESS',
      data: message.data,
      context: context
    });
  } else if (message.status === 'FAILURE') {
    // Store the error
    this.retryState.lastError = message.error;
    
    // Check if we can retry
    if (this.retryState.currentAttempt < this.retryState.maxRetries) {
      // Increment attempt counter
      this.retryState.currentAttempt++;
      
      // Schedule retry after delay
      setTimeout(() => {
        this.executeChildren(context);
      }, this.retryState.retryDelay);
    } else {
      // Max retries exhausted, fail
      this.completeBTNode({
        status: 'FAILURE',
        error: `Max retries exhausted (${this.retryState.maxRetries} retries)`,
        lastError: this.retryState.lastError,
        totalAttempts: this.retryState.currentAttempt + 1,  // +1 for initial attempt
        context: context
      });
    }
  }
};

export default RetryStrategy;