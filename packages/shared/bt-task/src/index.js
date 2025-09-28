/**
 * @legion/bt-task - Behavior Trees as Task Strategies
 * 
 * Main entry point for the bt-task package that unifies behavior trees
 * with the task system by treating BT nodes as task strategies.
 */

// Core components
export { BTTaskStrategy } from './core/BTTaskStrategy.js';
export { BTExecutor } from './core/BTExecutor.js';
export { createBTTask } from './factory/createBTTask.js';

// Node strategies
export { SequenceStrategy } from './strategies/SequenceStrategy.js';
export { SelectorStrategy } from './strategies/SelectorStrategy.js';
export { ActionStrategy } from './strategies/ActionStrategy.js';
export { ConditionStrategy } from './strategies/ConditionStrategy.js';
export { RetryStrategy } from './strategies/RetryStrategy.js';

// Integration
export { BTLoader } from './integration/BTLoader.js';
export { BTTool } from './integration/BTTool.js';