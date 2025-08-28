/**
 * TaskManagementModule - Module containing task management tools
 */

import { Module } from '@legion/tools-registry';
import { TaskTool } from './TaskTool.js';
import { TodoWriteTool } from './TodoWriteTool.js';
import { ExitPlanModeTool } from './ExitPlanModeTool.js';

class TaskManagementModule extends Module {
  constructor() {
    super();
    this.name = 'task-management';
    this.description = 'Task planning, tracking, and agent delegation tools';
    this.resourceManager = null;
  }

  /**
   * Create and register all task management tools
   */
  createTools() {
    // Create tool instances
    const taskTool = new TaskTool();
    const todoWriteTool = new TodoWriteTool();
    const exitPlanModeTool = new ExitPlanModeTool();

    // Register tools
    this.registerTool('Task', taskTool);
    this.registerTool('TodoWrite', todoWriteTool);
    this.registerTool('ExitPlanMode', exitPlanModeTool);
  }

  /**
   * Factory method for creating the module
   */
  static async create(resourceManager) {
    const module = new TaskManagementModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Create and register all tools
    this.createTools();
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      tools: this.getTools().map(tool => ({
        name: tool.name,
        description: tool.description
      }))
    };
  }
}

export default TaskManagementModule;
export { TaskManagementModule };