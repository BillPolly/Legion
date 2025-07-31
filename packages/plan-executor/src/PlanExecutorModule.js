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
import { ModuleLoader } from '@legion/module-loader';
import { ExecutionContext } from './core/ExecutionContext.js';

export class PlanExecutorModule {
  static dependencies = ['resourceManager', 'moduleFactory'];
  
  /**
   * Create a PlanExecutorModule using the singleton ResourceManager
   * @returns {Promise<PlanExecutorModule>}
   */
  static async create() {
    const { getResourceManager, ModuleFactory } = await import('@legion/module-loader');
    const resourceManager = await getResourceManager();
    const moduleFactory = new ModuleFactory(resourceManager);
    
    return new PlanExecutorModule({ resourceManager, moduleFactory });
  }
  
  constructor(dependencies) {
    const { resourceManager, moduleFactory } = dependencies;
    this.resourceManager = resourceManager;
    this.moduleFactory = moduleFactory;
    
    // Create module loader directly
    this.moduleLoader = new ModuleLoader(resourceManager);
    
    // Create executor instance
    this.executor = new PlanExecutor({
      moduleLoader: this.moduleLoader
    });
    
    // Create shared execution context (in real implementation this would be a registry/manager)
    this.executionContext = null; // Will be created when needed
    
    // Create tool instances - all tools already extend Legion Tool
    this.planExecutorTool = new PlanExecutorTool(this.executor, this);
    this.planInspectorTool = new PlanInspectorTool(this.moduleLoader);
    this.planToMarkdownTool = new PlanToMarkdownTool();
    this.executionStatusTool = new ExecutionStatusTool({ 
      executionContextRegistry: () => this.executionContext 
    });
    this.stepExecutorTool = new StepExecutorTool({ 
      executionContextRegistry: () => this.executionContext 
    });
    this.debugExecutorTool = new DebugExecutorTool({ 
      executionContextRegistry: () => this.executionContext 
    });
    
    // Set up context registry accessor for debugging tools
    this._setupContextRegistry();
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
    
    this.executionStatusTool._getExecutionContext = contextGetter;
    this.stepExecutorTool._getExecutionContext = contextGetter;
    this.debugExecutorTool._getExecutionContext = contextGetter;
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