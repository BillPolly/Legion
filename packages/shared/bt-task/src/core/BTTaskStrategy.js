/**
 * BTTaskStrategy - Base strategy for all behavior tree nodes
 * 
 * Extends TaskStrategy to provide BT-specific behavior while maintaining
 * all task capabilities (artifacts, message passing, lifecycle).
 * 
 * This is a pure prototypal implementation using Object.create().
 */

import { TaskStrategy } from '@legion/tasks';

/**
 * Base prototype for all behavior tree node strategies
 */
export const BTTaskStrategy = Object.create(TaskStrategy);

/**
 * Handle incoming messages with BT-specific routing
 * 
 * @param {Object} senderTask - The task sending the message
 * @param {Object} message - The message object
 */
BTTaskStrategy.onMessage = function(senderTask, message) {
  // Route BT-specific messages
  if (message.type === 'execute') {
    this.executeBTNode(senderTask, message);
  } else if (message.type === 'child-result') {
    this.handleChildResult(senderTask, message);
  } else {
    // Delegate other messages to parent TaskStrategy
    TaskStrategy.onMessage.call(this, senderTask, message);
  }
};

/**
 * Execute this BT node
 * Default implementation starts the task and executes children
 * Override in specific node strategies for custom behavior
 * 
 * @param {Object} senderTask - The task initiating execution
 * @param {Object} message - The execute message with context
 */
BTTaskStrategy.executeBTNode = function(senderTask, message) {
  // Start this task
  this.start();
  
  // Execute children (specific strategies override this)
  this.executeChildren(message.context);
};

/**
 * Execute child nodes
 * Must be overridden by specific node strategies
 * 
 * @param {Object} context - Execution context
 */
BTTaskStrategy.executeChildren = function(context) {
  // Default: complete immediately with no children
  // Specific strategies (Sequence, Selector, etc.) override this
  this.complete({ status: 'SUCCESS' });
};

/**
 * Handle result from a child node
 * Must be overridden by composite node strategies
 * 
 * @param {Object} childTask - The child task reporting result
 * @param {Object} message - The result message
 */
BTTaskStrategy.handleChildResult = function(childTask, message) {
  // Default: do nothing
  // Composite strategies (Sequence, Selector) override this
};

/**
 * Get BT node status from task status
 * Maps task lifecycle states to BT execution states
 * 
 * @returns {string} BT status (SUCCESS, FAILURE, RUNNING, PENDING)
 */
BTTaskStrategy.getNodeStatus = function() {
  switch(this.status) {
    case 'completed':
      return 'SUCCESS';
    case 'failed':
      return 'FAILURE';
    case 'in-progress':
      return 'RUNNING';
    case 'pending':
    default:
      return 'PENDING';
  }
};

/**
 * Resolve parameters with artifact @ syntax support
 * 
 * @param {Object} params - Parameters that may contain @ references
 * @param {Object} context - Execution context with artifacts
 * @returns {Object} Resolved parameters with artifact values substituted
 */
BTTaskStrategy.resolveParameters = function(params, context) {
  const resolved = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.startsWith('@')) {
      // Resolve artifact reference
      const path = value.substring(1);
      resolved[key] = this.resolveArtifactPath(path, context);
    } else {
      resolved[key] = value;
    }
  }
  
  return resolved;
};

/**
 * Resolve a path into artifacts (supports dot notation)
 * 
 * @param {string} path - Path like "result.success" or "codeTemplate"
 * @param {Object} context - Context containing artifacts
 * @returns {*} The resolved value or undefined
 */
BTTaskStrategy.resolveArtifactPath = function(path, context) {
  if (!context.artifacts) {
    return undefined;
  }
  
  // Split path and traverse
  const parts = path.split('.');
  let current = context.artifacts;
  
  // First part is the artifact name
  const artifactName = parts[0];
  if (artifactName in current) {
    // Get the artifact object
    const artifact = current[artifactName];
    
    // If it's an artifact object with a value property, start with the value
    // Otherwise use the artifact itself
    current = (artifact && typeof artifact === 'object' && 'value' in artifact) 
      ? artifact.value 
      : artifact;
    
    // If there are more parts (like "@artifact.nested.property"), traverse them
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
  
  return undefined;
};

/**
 * Send result to parent as BT node result
 * 
 * @param {Object} result - Result object with status and optional data
 */
BTTaskStrategy.sendNodeResult = function(result) {
  if (this.parent) {
    this.send(this.parent, {
      type: 'child-result',
      status: result.status || this.getNodeStatus(),
      data: result.data || {},
      context: result.context,  // Pass context back to parent
      error: result.error,
      nodeId: this.config?.nodeId,
      nodeType: this.config?.nodeType
    });
  }
};

/**
 * Complete this BT node with a result
 * Sends result to parent and completes the task
 * 
 * @param {Object} result - Result object with status and optional data
 */
BTTaskStrategy.completeBTNode = function(result) {
  // Send result to parent first
  this.sendNodeResult(result);
  
  // Complete the task
  if (result.status === 'SUCCESS') {
    this.complete(result.data);
  } else {
    this.fail(new Error(result.error || 'BT node failed'), result.data || {});
  }
};

export default BTTaskStrategy;