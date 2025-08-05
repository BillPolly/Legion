/**
 * PlanExecutorToolsModule - Legion module that provides plan execution tools
 */

import { PlanExecutorTool } from './PlanExecutorTool.js';
import { PlanInspectorTool } from './PlanInspectorTool.js';
import { PlanToMarkdownTool } from './PlanToMarkdownTool.js';
import { ExecutionStatusTool } from './ExecutionStatusTool.js';
import { StepExecutorTool } from './StepExecutorTool.js';
import { DebugExecutorTool } from './DebugExecutorTool.js';
import { PlanExecutor, ExecutionContext } from '@legion/plan-executor';
import { ModuleLoader } from '@legion/module-loader';

export class PlanExecutorToolsModule {
  static dependencies = ['resourceManager', 'moduleFactory'];
  
  /**
   * Create a PlanExecutorToolsModule using the Async Resource Manager pattern
   * @param {ResourceManager} resourceManager
   * @returns {Promise<PlanExecutorToolsModule>}
   */
  static async create(resourceManager) {
    const { ModuleFactory } = await import('@legion/module-loader');
    const moduleFactory = new ModuleFactory(resourceManager);
    
    // Create module instance
    const moduleInstance = new PlanExecutorToolsModule({ resourceManager, moduleFactory });
    
    // Create executor using async factory pattern
    moduleInstance.executor = await PlanExecutor.create(resourceManager);
    
    // Now create tool instances with the executor available
    moduleInstance._createTools();
    
    return moduleInstance;
  }
  
  constructor(dependencies) {
    const { resourceManager, moduleFactory } = dependencies;
    this.resourceManager = resourceManager;
    this.moduleFactory = moduleFactory;
    
    // Create module loader directly
    this.moduleLoader = new ModuleLoader(resourceManager);
    
    // Create executor instance using the async factory pattern
    this.executor = null; // Will be created when needed via async factory
    
    // Create shared execution context (in real implementation this would be a registry/manager)
    this.executionContext = null; // Will be created when needed
    
    // Tool instances will be created after executor is available
    this.planExecutorTool = null;
    this.planInspectorTool = null;
    this.planToMarkdownTool = null;
    this.executionStatusTool = null;
    this.stepExecutorTool = null;
    this.debugExecutorTool = null;
    
  }

  _createTools() {
    // Create tool instances - all tools extend Legion Tool
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