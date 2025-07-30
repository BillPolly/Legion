/**
 * PlanExecutorModule - Legion module wrapper for plan execution and debugging
 */

import { PlanExecutorTool } from './tools/PlanExecutorTool.js';
import { PlanInspectorTool } from './tools/PlanInspectorTool.js';
import { PlanToMarkdownTool } from './tools/PlanToMarkdownTool.js';
import { ExecutionStatusTool } from './tools/ExecutionStatusTool.js';
import { StepExecutorTool } from './tools/StepExecutorTool.js';
import { DebugExecutorTool } from './tools/DebugExecutorTool.js';
import { PlanExecutor } from './core/PlanExecutor.js';
import { PlanToolRegistry } from './core/PlanToolRegistry.js';
import { ExecutionContext } from './core/ExecutionContext.js';
import { LegionToolAdapter } from './adapters/LegionToolAdapter.js';

// TODO: Temporarily not extending Module for MVP testing
export class PlanExecutorModule {
  static dependencies = ['resourceManager', 'moduleFactory'];
  
  constructor(dependencies) {
    const { resourceManager, moduleFactory } = dependencies;
    this.resourceManager = resourceManager;
    this.moduleFactory = moduleFactory;
    
    // Create plan tool registry
    this.planToolRegistry = new PlanToolRegistry();
    
    // Create executor instance
    this.executor = new PlanExecutor({
      planToolRegistry: this.planToolRegistry
    });
    
    // Create shared execution context (in real implementation this would be a registry/manager)
    this.executionContext = null; // Will be created when needed
    
    // Create all tool instances (raw debugging tools)
    this.rawPlanExecutorTool = new PlanExecutorTool(this.executor);
    this.rawPlanInspectorTool = new PlanInspectorTool();
    this.rawPlanToMarkdownTool = new PlanToMarkdownTool();
    this.rawExecutionStatusTool = new ExecutionStatusTool({ 
      executionContextRegistry: () => this.executionContext 
    });
    this.rawStepExecutorTool = new StepExecutorTool({ 
      executionContextRegistry: () => this.executionContext 
    });
    this.rawDebugExecutorTool = new DebugExecutorTool({ 
      executionContextRegistry: () => this.executionContext 
    });

    // Wrap tools with Legion adapter for compatibility
    this.planExecutorTool = new LegionToolAdapter(this.rawPlanExecutorTool);
    this.planInspectorTool = new LegionToolAdapter(this.rawPlanInspectorTool);
    this.planToMarkdownTool = new LegionToolAdapter(this.rawPlanToMarkdownTool);
    this.executionStatusTool = new LegionToolAdapter(this.rawExecutionStatusTool);
    this.stepExecutorTool = new LegionToolAdapter(this.rawStepExecutorTool);
    this.debugExecutorTool = new LegionToolAdapter(this.rawDebugExecutorTool);
    
    // Set up context registry accessor for debugging tools
    this._setupContextRegistry();
    
    // TODO: Forward events from executor to module listeners (requires EventEmitter)
    // this.executor.on('plan:start', (event) => this.emit('plan:start', event));
    // this.executor.on('plan:complete', (event) => this.emit('plan:complete', event));
    // this.executor.on('step:start', (event) => this.emit('step:start', event));
    // this.executor.on('step:complete', (event) => this.emit('step:complete', event));
    // this.executor.on('step:error', (event) => this.emit('step:error', event));
    // this.executor.on('progress', (event) => this.emit('progress', event));
  }
  
  _setupContextRegistry() {
    // Override the _getExecutionContext method for debugging tools
    const contextGetter = () => {
      // Create context if it doesn't exist
      if (!this.executionContext) {
        // This is a simplified approach - in production this would be managed more sophisticatedly
        this.executionContext = new ExecutionContext({ id: 'temp', steps: [] });
      }
      return this.executionContext;
    };
    
    this.rawExecutionStatusTool._getExecutionContext = contextGetter;
    this.rawStepExecutorTool._getExecutionContext = contextGetter;
    this.rawDebugExecutorTool._getExecutionContext = contextGetter;
  }
  
  getTools() {
    return [
      this.planExecutorTool,      // plan_execute
      this.stepExecutorTool,      // plan_execute_step
      this.debugExecutorTool,     // plan_debug
      this.planInspectorTool,     // plan_inspect
      this.planToMarkdownTool,    // plan_to_markdown
      this.executionStatusTool    // plan_status
    ];
  }
  
  // Helper method to get a specific tool by name
  getTool(toolName) {
    const tools = this.getTools();
    return tools.find(tool => tool.name === toolName);
  }
  
  // Helper method for creating execution context for plan execution
  createExecutionContext(plan) {
    this.executionContext = new ExecutionContext(plan);
    return this.executionContext;
  }
}