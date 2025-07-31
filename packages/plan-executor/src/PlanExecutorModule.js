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
import { LegionToolAdapter } from './adapters/LegionToolAdapter.js';
import { PlanExecutionLogger } from './logging/PlanExecutionLogger.js';
import path from 'path';
import { fileURLToPath } from 'url';

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
    
    // Initialize logging components
    this.logManager = null;
    this.planExecutionLogger = null;
    this._initializeLogging();
    
    // Create all tool instances (raw debugging tools)
    this.rawPlanExecutorTool = new PlanExecutorTool(this.executor, this);
    this.rawPlanInspectorTool = new PlanInspectorTool(this.moduleLoader);
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
  
  /**
   * Initialize logging components asynchronously
   * @private
   */
  async _initializeLogging() {
    try {
      // For now, create a simple mock LogManager to test the event logging
      // In a real implementation, this would load the actual LogManager module
      this.logManager = {
        captureLogs: async (options) => {
          // Mock implementation - just log that capture was requested
          console.log(`[LogManager] Capture requested for: ${options.source.id}`);
          return { success: true, sourceId: options.source.id };
        }
      };
      
      // Get workspace LOG_DIR for this execution context
      const workspaceDir = this.resourceManager.has('workspace.workspaceDir') 
        ? this.resourceManager.get('workspace.workspaceDir')
        : null;
        
      // Always use __tests__/tmp/logs/ for consistency
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const packageRoot = path.resolve(__dirname, '..');
      this.defaultLogDir = path.join(packageRoot, '__tests__', 'tmp', 'logs');
      
      // Initialize PlanExecutionLogger (will be fully set up when plan execution starts)
      this.planExecutionLogger = new PlanExecutionLogger(this.logManager, this.defaultLogDir);
      
      // Attach event listeners to PlanExecutor
      this.planExecutionLogger.attachToPlanExecutor(this.executor);
      
    } catch (error) {
      console.warn('Failed to initialize plan execution logging:', error.message);
      // Continue without logging - don't break the module
    }
  }
  
  /**
   * Set up logging for a specific plan execution with workspace LOG_DIR
   */
  async setupPlanLogging(planId) {
    if (!this.planExecutionLogger) {
      return; // Logging not available
    }
    
    try {
      // Initialize the logger with the default log directory
      // Logs go to __tests__/tmp/logs/, NOT inside the plan workspace
      await this.planExecutionLogger.initialize();
      
    } catch (error) {
      console.warn('Failed to setup plan-specific logging:', error.message);
    }
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