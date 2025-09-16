/**
 * ROMA Agent - Main exports
 * Modern hierarchical task execution agent with improved architecture
 */

// Main agent class
export { ROMAAgent } from './ROMAAgent.js';

// Core components
export { DependencyResolver } from './core/DependencyResolver.js';
export { ExecutionContext } from './core/ExecutionContext.js';
export { TaskExecutionLog } from './core/TaskExecutionLog.js';
export { TaskProgressStream } from './core/TaskProgressStream.js';
export { TaskQueue } from './core/TaskQueue.js';

// Execution strategies
export { ExecutionStrategy } from './core/strategies/ExecutionStrategy.js';
export { AtomicExecutionStrategy } from './core/strategies/AtomicExecutionStrategy.js';
export { ParallelExecutionStrategy } from './core/strategies/ParallelExecutionStrategy.js';
export { SequentialExecutionStrategy } from './core/strategies/SequentialExecutionStrategy.js';
export { RecursiveExecutionStrategy } from './core/strategies/RecursiveExecutionStrategy.js';
export { ExecutionStrategyResolver } from './core/strategies/ExecutionStrategyResolver.js';

// Default export is the main agent
export default ROMAAgent;