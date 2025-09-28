/**
 * Compatibility layer for migration from actor-BT to bt-task
 * 
 * Provides class-based wrappers that match actor-BT's interface
 * while using bt-task's strategy-based implementation underneath
 */

// Core compatibility classes
export { BehaviorTreeExecutor, MessageBus } from './BehaviorTreeExecutor.js';
export { BehaviorTreeNode } from './BehaviorTreeNode.js';
export { NodeStatus, taskStatusToNodeStatus, nodeStatusToTaskStatus } from './NodeStatus.js';

// Node type classes for compatibility
export { ActionNode } from './nodes/ActionNode.js';
export { SequenceNode } from './nodes/SequenceNode.js';
export { SelectorNode } from './nodes/SelectorNode.js';
export { ConditionNode } from './nodes/ConditionNode.js';
export { RetryNode } from './nodes/RetryNode.js';

// Helper functions for node registration (compatibility with actor-BT)
export function registerBuiltInNodes(executor) {
  // This function is provided for compatibility but the executor
  // already registers built-in nodes in its constructor
  return executor.getAvailableNodeTypes();
}

export function getNodeClass(type) {
  const nodeClasses = {
    'action': ActionNode,
    'sequence': SequenceNode,
    'selector': SelectorNode,
    'condition': ConditionNode,
    'retry': RetryNode
  };
  return nodeClasses[type];
}

export function getAvailableNodeTypes() {
  return ['action', 'sequence', 'selector', 'condition', 'retry'];
}

export function validateNodeClass(NodeClass) {
  return NodeClass && 
         typeof NodeClass === 'function' && 
         NodeClass.prototype instanceof BehaviorTreeNode;
}