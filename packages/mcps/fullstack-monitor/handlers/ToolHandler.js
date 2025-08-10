/**
 * ToolHandler - MCP tool handler with Sidewinder support
 */

import { SimplifiedTools } from '../tools/SimplifiedTools.js';

export class ToolHandler {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.tools = new SimplifiedTools(sessionManager);
    this._sidewinderInitialized = false;
  }
  
  /**
   * Initialize Sidewinder server if needed
   */
  async ensureSidewinderInitialized() {
    if (!this._sidewinderInitialized) {
      try {
        await this.sessionManager.initializeSidewinderServer();
        this._sidewinderInitialized = true;
        console.error('[ToolHandler] Sidewinder server initialized');
      } catch (error) {
        console.error('[ToolHandler] Failed to initialize Sidewinder:', error);
      }
    }
  }
  
  /**
   * Get all available tools for MCP tools/list
   */
  getAllTools() {
    return this.tools.getToolDefinitions();
  }
  
  /**
   * Execute a tool
   */
  async executeTool(name, arguments_ = {}) {
    // Initialize Sidewinder on first tool use
    await this.ensureSidewinderInitialized();
    
    try {
      const result = await this.tools.execute(name, arguments_);
      
      // MCP expects content array format
      if (result.content) {
        return result;
      }
      
      // Convert simple string result
      if (typeof result === 'string') {
        return {
          content: [{
            type: 'text',
            text: result
          }]
        };
      }
      
      // Convert object result
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
      
    } catch (error) {
      console.error(`[ToolHandler] Error executing tool ${name}:`, error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      await this.sessionManager.endAllSessions();
      await this.sessionManager.cleanupSidewinder();
    } catch (error) {
      console.error('[ToolHandler] Cleanup error:', error);
    }
  }
}