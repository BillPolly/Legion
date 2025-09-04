/**
 * AgentToolsModule - UI tools for agent planning
 * 
 * Provides tools that enable agents to plan rich user interactions
 * involving floating windows, notifications, and resource display.
 */

import { Module } from '@legion/tools-registry';
import { DisplayResourceTool } from './tools/DisplayResourceTool.js';
import { NotifyUserTool } from './tools/NotifyUserTool.js';
import { CloseWindowTool } from './tools/CloseWindowTool.js';

class AgentToolsModule extends Module {
  constructor() {
    super();
    this.name = 'agent-tools';
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
   * @param {Object} resourceManager - Resource manager instance
   * @returns {Promise<AgentToolsModule>} Module instance
   */
  static async create(resourceManager) {
    const module = new AgentToolsModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    // Module is already initialized in constructor
    // This method is here for compatibility with the interface
  }

  /**
   * Get all tools provided by this module
   * @returns {Array} Array of tool instances
   */
  getTools() {
    return this.tools;
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
  
  /**
   * Test all tools in this module
   * @returns {Promise<Object>} Test results with detailed report
   */
  async testTools() {
    const results = {
      moduleName: this.name,
      totalTools: this.tools.length,
      successful: 0,
      failed: 0,
      results: [],
      summary: ''
    };
    
    console.log(`[${this.name}] Testing ${this.tools.length} tools...`);
    
    // Create mock context for testing
    const mockContext = {
      resourceService: {
        displayResource: async () => ({ windowId: 'test-window', viewerType: 'auto' }),
        showNotification: async () => ({ notificationId: 'test-notification' }),
        closeWindow: async () => ({ closed: true })
      }
    };
    
    const mockResourceHandle = {
      path: '/test/path.js',
      __isResourceHandle: true
    };
    
    for (const tool of this.tools) {
      const testResult = {
        toolName: tool.name,
        success: false,
        error: null,
        duration: 0
      };
      
      try {
        const startTime = Date.now();
        
        // Test tool based on its type
        if (tool.name === 'display_resource') {
          const params = { context: mockContext, resourceHandle: mockResourceHandle };
          await tool._execute(params);
        } else if (tool.name === 'notify_user') {
          const params = { context: mockContext, message: 'Test notification' };
          await tool._execute(params);
        } else if (tool.name === 'close_window') {
          const params = { context: mockContext, windowId: 'test-window' };
          await tool._execute(params);
        }
        
        testResult.duration = Date.now() - startTime;
        testResult.success = true;
        results.successful++;
        console.log(`[${this.name}] ✓ ${tool.name} passed (${testResult.duration}ms)`);
        
      } catch (error) {
        testResult.error = error.message;
        results.failed++;
        console.log(`[${this.name}] ✗ ${tool.name} failed: ${error.message}`);
      }
      
      results.results.push(testResult);
    }
    
    results.summary = `${results.successful}/${results.totalTools} tools passed`;
    console.log(`[${this.name}] Test complete: ${results.summary}`);
    
    return results;
  }
}

export default AgentToolsModule;