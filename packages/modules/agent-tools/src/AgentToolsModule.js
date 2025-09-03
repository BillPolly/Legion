/**
 * AgentToolsModule - UI tools for agent planning
 * 
 * Provides tools that enable agents to plan rich user interactions
 * involving floating windows, notifications, and resource display.
 */

import { DisplayResourceTool } from './tools/DisplayResourceTool.js';
import { NotifyUserTool } from './tools/NotifyUserTool.js';
import { CloseWindowTool } from './tools/CloseWindowTool.js';

export class AgentToolsModule {
  constructor() {
    this.name = 'AgentToolsModule';
    this.description = 'UI tools for agent planning that integrate with transparent resource handle system';
    this.version = '1.0.0';
    
    // Create tool instances
    this.tools = [
      new DisplayResourceTool(),
      new NotifyUserTool(),
      new CloseWindowTool()
    ];
  }
  
  /**
   * Static factory method for module creation
   * @param {Object} config - Module configuration
   * @returns {AgentToolsModule} Module instance
   */
  static async create(config = {}) {
    return new AgentToolsModule();
  }
  
  /**
   * Get tool by name
   * @param {string} toolName - Name of the tool
   * @returns {Object|null} Tool instance or null
   */
  getTool(toolName) {
    return this.tools.find(tool => tool.name === toolName) || null;
  }
  
  /**
   * Get all tool names
   * @returns {Array<string>} Array of tool names
   */
  getToolNames() {
    return this.tools.map(tool => tool.name);
  }
}