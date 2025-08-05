/**
 * Plan Executor - Core execution engine for hierarchical plans
 * 
 * This package provides the core plan execution engine that can:
 * - Execute llm-planner generated hierarchical plans
 * - Dynamically load and use Legion tools via ModuleLoader
 * - Maintain execution context and variable scoping
 * - Emit progress events during execution
 * - Handle errors with configurable retry logic
 * 
 * For plan execution tools (validation, debugging, etc.), use @legion/plan-executor-tools
 * 
 * @example
 * ```javascript
 * import { PlanExecutor } from '@legion/plan-executor';
 * import { ResourceManager } from '@legion/module-loader';
 * 
 * // Create using async factory pattern
 * const resourceManager = new ResourceManager();
 * await resourceManager.initialize();
 * const executor = await PlanExecutor.create(resourceManager);
 * 
 * const result = await executor.executePlan(plan, {
 *   stopOnError: false,
 *   retries: 3,
 *   timeout: 30000
 * });
 * ```
 */

// Core execution engine
export { PlanExecutor } from './core/PlanExecutor.js';
export { ExecutionContext } from './core/ExecutionContext.js';

// Logging utilities
export { PlanExecutionLogger } from './logging/PlanExecutionLogger.js';

// Import for default export
import { PlanExecutor as DefaultExport } from './core/PlanExecutor.js';

// Default export is the core executor
export default DefaultExport;