/**
 * ModuleLoader - Handles dynamic loading of Legion modules for plan execution
 */

export class ModuleLoader {
  constructor(moduleFactory) {
    this.moduleFactory = moduleFactory;
    this.loadedModules = new Map();
    this.toolRegistry = new Map();
  }

  async loadModulesForPlan(plan) {
    // Extract all tool types from the plan
    const requiredTools = this._extractToolsFromPlan(plan);
    
    // For MVP, we'll load all available modules
    // In production, this would be more selective
    await this._loadAllAvailableModules();
    
    // Verify all required tools are available
    const missingTools = [];
    for (const toolName of requiredTools) {
      if (!this.toolRegistry.has(toolName)) {
        missingTools.push(toolName);
      }
    }
    
    if (missingTools.length > 0) {
      throw new Error(`Required tools not found: ${missingTools.join(', ')}`);
    }
  }

  getTool(toolName) {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return tool;
  }

  _extractToolsFromPlan(plan) {
    const tools = new Set();
    
    const extractFromSteps = (steps) => {
      for (const step of steps) {
        if (step.actions) {
          for (const action of step.actions) {
            tools.add(action.type);
          }
        }
        if (step.steps) {
          extractFromSteps(step.steps);
        }
      }
    };
    
    extractFromSteps(plan.steps);
    return Array.from(tools);
  }

  async _loadAllAvailableModules() {
    // For MVP, we'll just simulate loading modules
    // In production, this would dynamically discover and load Legion modules
    
    // Mock some common tools for testing
    this._registerMockTool('file_read', this._createMockTool('file_read'));
    this._registerMockTool('file_write', this._createMockTool('file_write'));
    this._registerMockTool('web_search', this._createMockTool('web_search'));
    this._registerMockTool('api_call', this._createMockTool('api_call'));
  }

  _registerMockTool(name, tool) {
    this.toolRegistry.set(name, tool);
  }

  _createMockTool(name) {
    return {
      name: name,
      description: `Mock tool: ${name}`,
      execute: async (params) => {
        return { success: true, result: `Mock execution of ${name}`, params };
      }
    };
  }
}