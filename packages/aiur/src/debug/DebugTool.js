/**
 * DebugTool - MCP tool interface for web debug functionality
 * 
 * Provides MCP tools for starting/stopping the web debugging interface
 * and managing debug server lifecycle.
 */

export class DebugTool {
  constructor(webDebugServer, contextManager) {
    this.webDebugServer = webDebugServer;
    this.contextManager = contextManager;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<DebugTool>} Initialized DebugTool instance
   */
  static async create(resourceManager) {
    const webDebugServer = resourceManager.get('webDebugServer');
    const contextManager = resourceManager.get('contextManager');
    
    return new DebugTool(webDebugServer, contextManager);
  }

  /**
   * Get MCP tool definitions for debug functionality
   * @returns {Array} Array of MCP tool definitions
   */
  getToolDefinitions() {
    return [
      {
        name: "web_debug_start",
        description: "Start web debugging interface and open browser",
        inputSchema: {
          type: "object",
          properties: {
            port: {
              type: "number",
              description: "Preferred port (auto-detected if unavailable)",
              minimum: 1024,
              maximum: 65535
            },
            openBrowser: {
              type: "boolean",
              description: "Open browser automatically",
              default: true
            },
            host: {
              type: "string",
              description: "Host to bind to",
              default: "localhost"
            }
          }
        }
      },
      {
        name: "web_debug_stop",
        description: "Stop web debugging interface",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "web_debug_status",
        description: "Get web debugging interface status and information",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ];
  }

  /**
   * Check if a tool name is a debug tool
   * @param {string} toolName - Name of the tool
   * @returns {boolean} True if it's a debug tool
   */
  isDebugTool(toolName) {
    return ['web_debug_start', 'web_debug_stop', 'web_debug_status'].includes(toolName);
  }

  /**
   * Execute a debug tool
   * @param {string} name - Tool name
   * @param {Object} args - Tool arguments (already resolved)
   * @returns {Object} MCP-formatted response
   */
  async executeDebugTool(name, args) {
    try {
      switch (name) {
        case 'web_debug_start':
          return await this._executeWebDebugStart(args);
        case 'web_debug_stop':
          return await this._executeWebDebugStop(args);
        case 'web_debug_status':
          return await this._executeWebDebugStatus(args);
        default:
          throw new Error(`Unknown debug tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }],
        isError: true,
      };
    }
  }

  /**
   * Execute web_debug_start tool
   * @param {Object} args - Tool arguments
   * @returns {Object} MCP-formatted response
   * @private
   */
  async _executeWebDebugStart(args) {
    try {
      const serverInfo = await this.webDebugServer.start({
        port: args.port,
        host: args.host,
        openBrowser: args.openBrowser
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: "Web debug interface started successfully",
            serverInfo,
            url: serverInfo.url,
            port: serverInfo.port,
            instructions: [
              `Debug interface is running at ${serverInfo.url}`,
              "Use the web interface to execute tools, view context, and monitor events",
              "Server information has been saved to context as 'debug_server'"
            ]
          }, null, 2)
        }],
        isError: false,
      };
    } catch (error) {
      throw new Error(`Failed to start web debug interface: ${error.message}`);
    }
  }

  /**
   * Execute web_debug_stop tool
   * @param {Object} args - Tool arguments
   * @returns {Object} MCP-formatted response
   * @private
   */
  async _executeWebDebugStop(args) {
    try {
      await this.webDebugServer.stop();

      // Update context to reflect stopped status
      try {
        await this.contextManager.executeContextTool('context_add', {
          name: 'debug_server',
          data: { 
            status: 'stopped',
            stoppedAt: new Date().toISOString()
          },
          description: 'Web debug interface server information (stopped)'
        });
      } catch (contextError) {
        // Context update is not critical for stop operation
        console.warn('Failed to update debug server context:', contextError.message);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: "Web debug interface stopped successfully"
          }, null, 2)
        }],
        isError: false,
      };
    } catch (error) {
      throw new Error(`Failed to stop web debug interface: ${error.message}`);
    }
  }

  /**
   * Execute web_debug_status tool
   * @param {Object} args - Tool arguments
   * @returns {Object} MCP-formatted response
   * @private
   */
  async _executeWebDebugStatus(args) {
    const serverInfo = this.webDebugServer.getServerInfo();
    
    // Get additional status information
    const statusInfo = {
      ...serverInfo,
      capabilities: [
        'real-time-monitoring',
        'tool-execution',
        'context-management',
        'event-streaming',
        'log-viewing'
      ],
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          status: statusInfo,
          instructions: serverInfo.status === 'running' ? [
            `Access debug interface at ${serverInfo.url}`,
            `${serverInfo.connectedClients} client(s) currently connected`,
            "Use web_debug_stop to stop the interface"
          ] : [
            "Debug interface is not running",
            "Use web_debug_start to start the interface"
          ]
        }, null, 2)
      }],
      isError: false,
    };
  }
}