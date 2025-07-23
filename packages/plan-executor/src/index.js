/**
 * Plan Executor - Legion module for executing hierarchical plans
 * 
 * This module provides a comprehensive plan execution engine that can:
 * - Execute llm-planner generated hierarchical plans
 * - Dynamically load and use Legion tools
 * - Maintain execution context and variable scoping
 * - Emit progress events during execution
 * - Handle errors with configurable retry logic
 * 
 * @example
 * ```javascript
 * import { PlanExecutorModule } from '@legion/plan-executor';
 * 
 * // Use as Legion module
 * const module = new PlanExecutorModule(resourceManager, moduleFactory);
 * const tool = module.getTools()[0];
 * 
 * const result = await tool.execute({
 *   plan: {
 *     id: 'my-plan',
 *     steps: [
 *       {
 *         id: 'step1',
 *         actions: [
 *           { type: 'file_read', parameters: { path: 'input.txt' } }
 *         ]
 *       }
 *     ]
 *   }
 * });
 * ```
 * 
 * @example
 * ```javascript
 * import { PlanExecutor } from '@legion/plan-executor';
 * 
 * // Use as standalone executor
 * const executor = new PlanExecutor({ moduleFactory, resourceManager });
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
export { ModuleLoader } from './core/ModuleLoader.js';

// Legion interfaces
export { PlanExecutorModule } from './PlanExecutorModule.js';
export { PlanExecutorTool } from './tools/PlanExecutorTool.js';

// Import for default export
import { PlanExecutorModule as DefaultModule } from './PlanExecutorModule.js';

// Default export is the Legion module
export default DefaultModule;