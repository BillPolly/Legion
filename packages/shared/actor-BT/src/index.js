/**
 * Behavior Tree Framework - Main Entry Point
 * 
 * Exports all BT components for use in other packages
 */

// Core components
export { BehaviorTreeExecutor } from './core/BehaviorTreeExecutor.js';
export { BehaviorTreeExecutor as BTExecutor } from './core/BehaviorTreeExecutor.js';
export { BehaviorTreeNode, NodeStatus } from './core/BehaviorTreeNode.js';
export { MessageBus } from './core/MessageBus.js';

// Node types - export from nodes/index.js to avoid circular dependencies
export { 
  ActionNode,
  SelectorNode,
  SequenceNode,
  RetryNode,
  getBUILT_IN_NODE_TYPES,
  registerBuiltInNodes,
  getNodeClass,
  getAvailableNodeTypes,
  validateNodeClass
} from './nodes/index.js';

// Integration components
export { BehaviorTreeTool } from './integration/BehaviorTreeTool.js';
export { BehaviorTreeLoader } from './integration/BehaviorTreeLoader.js';
export { PlanToBTConverter } from './integration/PlanToBTConverter.js';
export * from './integration/index.js';