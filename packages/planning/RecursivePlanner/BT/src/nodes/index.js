/**
 * Index file for all behavior tree node types
 * Provides easy importing and registration of node classes
 */

// Core node types
export { BehaviorTreeNode, NodeStatus } from '../core/BehaviorTreeNode.js';
export { MessageBus } from '../core/MessageBus.js';
export { BehaviorTreeExecutor } from '../core/BehaviorTreeExecutor.js';

// Control flow nodes
export { SequenceNode } from './SequenceNode.js';
export { SelectorNode } from './SelectorNode.js';
export { ActionNode } from './ActionNode.js';
export { RetryNode } from './RetryNode.js';

// Advanced coordination patterns (to be implemented)
// export { ParallelNode } from './ParallelNode.js';
// export { ConditionNode } from './ConditionNode.js';
// export { LLMDecisionNode } from './LLMDecisionNode.js';

/**
 * Registry of all available node types for easy registration
 */
export const BUILT_IN_NODE_TYPES = [
  { name: 'sequence', class: SequenceNode },
  { name: 'selector', class: SelectorNode },
  { name: 'action', class: ActionNode },
  { name: 'retry', class: RetryNode }
];

/**
 * Register all built-in node types with an executor
 * @param {BehaviorTreeExecutor} executor - Target executor
 */
export function registerBuiltInNodes(executor) {
  for (const { name, class: NodeClass } of BUILT_IN_NODE_TYPES) {
    executor.registerNodeType(name, NodeClass);
  }
}

/**
 * Get node class by type name
 * @param {string} typeName - Node type name
 * @returns {Class|null} Node class or null if not found
 */
export function getNodeClass(typeName) {
  const nodeType = BUILT_IN_NODE_TYPES.find(type => type.name === typeName);
  return nodeType ? nodeType.class : null;
}

/**
 * Get all available node type names
 * @returns {Array<string>} Array of node type names
 */
export function getAvailableNodeTypes() {
  return BUILT_IN_NODE_TYPES.map(type => type.name);
}

/**
 * Validate that a node class implements the required interface
 * @param {Class} NodeClass - Node class to validate
 * @returns {Object} Validation result
 */
export function validateNodeClass(NodeClass) {
  const errors = [];
  const warnings = [];

  // Check required static method
  if (!NodeClass.getTypeName || typeof NodeClass.getTypeName !== 'function') {
    errors.push('Node class must implement static getTypeName() method');
  }

  // Check inheritance
  if (!(NodeClass.prototype instanceof BehaviorTreeNode)) {
    errors.push('Node class must extend BehaviorTreeNode');
  }

  // Check required instance methods
  const requiredMethods = ['executeNode', 'getMetadata'];
  for (const method of requiredMethods) {
    if (!NodeClass.prototype[method]) {
      errors.push(`Node class must implement ${method}() method`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}