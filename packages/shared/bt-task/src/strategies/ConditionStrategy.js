/**
 * ConditionStrategy - Evaluates conditions and conditionally executes children
 * 
 * Behavior:
 * - Evaluates condition expression (JavaScript expression as string)
 * - Executes children if condition evaluates to true
 * - Skips children if condition evaluates to false
 * - Supports @ syntax for artifact references in conditions
 * - Propagates child results when children are executed
 * 
 * This is a pure prototypal implementation extending BTTaskStrategy.
 */

import { BTTaskStrategy } from '../core/BTTaskStrategy.js';

/**
 * Condition node strategy
 * Extends BTTaskStrategy to provide conditional execution
 */
export const ConditionStrategy = Object.create(BTTaskStrategy);

/**
 * Execute BT node - evaluate condition and conditionally execute children
 * 
 * @param {Object} task - The task being executed (usually 'this')
 * @param {Object} message - The execute message with context
 */
ConditionStrategy.executeBTNode = function(task, message) {
  const context = message.context || this.context;
  
  // Get condition from config
  const condition = this.config?.condition;
  
  if (!condition) {
    this.completeBTNode({
      status: 'FAILURE',
      error: 'No condition specified in config'
    });
    return;
  }
  
  // Store context for later use
  this.context = context;
  this.executionContext = context;
  
  try {
    // Evaluate the condition
    const result = this.evaluateCondition(condition, context);
    
    if (result) {
      // Condition is true - execute children
      this.executeChildrenConditionally(context);
    } else {
      // Condition is false - skip children and complete successfully
      this.completeBTNode({
        status: 'SUCCESS',
        message: 'Condition false - children skipped',
        conditionResult: false
      });
    }
  } catch (error) {
    // Handle evaluation errors
    this.completeBTNode({
      status: 'FAILURE',
      error: `Condition evaluation failed: ${error.message}`,
      condition: condition
    });
  }
};

/**
 * Evaluate a condition expression with artifact resolution
 * 
 * @param {string} condition - The condition expression
 * @param {Object} context - Execution context with artifacts
 * @returns {boolean} Result of condition evaluation
 */
ConditionStrategy.evaluateCondition = function(condition, context) {
  // Replace @ references with actual values
  let processedCondition = condition;
  
  // Find all @ references in the condition
  const artifactRefs = condition.match(/@[\w.]+/g) || [];
  
  for (const ref of artifactRefs) {
    const path = ref.substring(1); // Remove @
    const value = this.resolveArtifactPath(path, context);
    
    // Replace the reference with the actual value
    // Use JSON.stringify to properly format the value for evaluation
    processedCondition = processedCondition.replace(
      ref, 
      JSON.stringify(value)
    );
  }
  
  // Evaluate the processed condition as JavaScript
  // Using Function constructor for safer evaluation than eval
  try {
    const evaluator = new Function('return ' + processedCondition);
    return evaluator();
  } catch (error) {
    throw new Error(`Invalid condition expression: ${processedCondition}`);
  }
};

/**
 * Execute children when condition is true
 * 
 * @param {Object} context - Execution context
 */
ConditionStrategy.executeChildrenConditionally = function(context) {
  // Check if we have children to execute
  if (!this.children || this.children.length === 0) {
    // No children - complete successfully
    this.completeBTNode({
      status: 'SUCCESS',
      message: 'Condition true - no children to execute',
      conditionResult: true
    });
    return;
  }
  
  // We'll execute all children in sequence (like SequenceStrategy)
  this.currentChildIndex = 0;
  this.executeNextChild(context);
};

/**
 * Execute the next child in sequence
 * 
 * @param {Object} context - Execution context
 */
ConditionStrategy.executeNextChild = function(context) {
  const child = this.children[this.currentChildIndex];
  
  if (!child) {
    // No more children - complete successfully
    this.completeBTNode({
      status: 'SUCCESS',
      message: 'All children executed',
      conditionResult: true
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
ConditionStrategy.handleChildResult = function(childTask, message) {
  // Propagate child failure
  if (message.status === 'FAILURE') {
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
        message: 'Condition true - all children completed',
        childrenCount: this.children.length,
        conditionResult: true
      });
    }
  }
  // Ignore other statuses (RUNNING, PENDING) - wait for final result
};

export default ConditionStrategy;