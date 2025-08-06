/**
 * Plan Executor Tools - Legion tools for plan execution, validation, and debugging
 * 
 * This package provides a comprehensive set of tools for working with plans:
 * - Plan execution with full orchestration
 * - Plan validation and inspection
 * - Step-by-step execution and debugging
 * - Markdown export and formatting
 * - Execution status monitoring
 * 
 * @example
 * ```javascript
 * import { PlanExecutorToolsModule } from '@legion/plan-executor-tools';
 * import { ResourceManager } from '@legion/module-loader';
 * 
 * // Create module using async factory pattern
 * const resourceManager = new ResourceManager();
 * await resourceManager.initialize();
 * const module = await PlanExecutorToolsModule.create(resourceManager);
 * 
 * // Get tools from the module
 * const tools = module.getTools();
 * const planExecutorTool = tools.find(tool => tool.name === 'plan_execute');
 * 
 * const result = await planExecutorTool.execute({
 *   plan: myPlan,
 *   options: { stopOnError: true, retries: 3 }
 * });
 * ```
 */

// Main module export
export { PlanExecutorToolsModule } from './PlanExecutorToolsModule.js';

// Individual tool exports
export { PlanExecutorTool } from './PlanExecutorTool.js';
export { PlanInspectorTool } from './PlanInspectorTool.js';
export { ValidatePlanTool } from './ValidatePlanTool.js';
export { PlanToMarkdownTool } from './PlanToMarkdownTool.js';
export { ExecutionStatusTool } from './ExecutionStatusTool.js';
export { StepExecutorTool } from './StepExecutorTool.js';
export { DebugExecutorTool } from './DebugExecutorTool.js';

// Import for default export
import { PlanExecutorToolsModule as DefaultModule } from './PlanExecutorToolsModule.js';

// Default export is the Legion module
export default DefaultModule;