/**
 * McpClientTool - Ported from Gemini CLI mcp-client.ts to Legion patterns
 * Provides MCP (Model Context Protocol) server connection and management
 */

import { Tool } from '@legion/tools-registry';

/**
 * MCP Server Status (ported from Gemini CLI)
 */
export const MCPServerStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting', 
  CONNECTED: 'connected',
  ERROR: 'error'
};

/**
 * Tool for MCP server connections (ported from Gemini CLI's mcp-client.ts)
 */
class McpClientTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.servers = new Map(); // serverId -> connection info
      this.shortName = 'mcp';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      super({
        name: 'mcp_client',
        shortName: 'mcp',
        description: 'Connect to and manage MCP servers (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['connect', 'disconnect', 'list', 'status'],
                description: 'MCP client action to perform'
              },
              server_url: {
                type: 'string', 
                description: 'MCP server URL (required for connect)'
              },
              server_name: {
                type: 'string',
                description: 'Server name/identifier'
              },
              timeout: {
                type: 'number',
                description: 'Connection timeout in milliseconds',
                default: 10000
              }
            },
            required: ['action']
          },
          output: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation succeeded'
              },
              status: {
                type: 'string',
                description: 'Server connection status'
              },
              servers: {
                type: 'array',
                description: 'List of connected servers'
              },
              message: {
                type: 'string',
                description: 'Status message'
              }
            },
            required: ['success']
          }
        }
      });

      this.servers = new Map();
    }
  }

  /**
   * Execute MCP client operations (core logic ported from Gemini CLI)
   * @param {Object} args - MCP operation arguments
   * @returns {Promise<Object>} Operation result
   */
  async _execute(args) {
    try {
      const { action, server_url, server_name, timeout = 10000 } = args;

      switch (action) {
        case 'connect':
          return await this._connectToServer(server_url, server_name, timeout);
          
        case 'disconnect':
          return await this._disconnectFromServer(server_name);
          
        case 'list':
          return this._listServers();
          
        case 'status':
          return this._getServerStatus(server_name);
          
        default:
          throw new Error(`Unknown MCP action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        status: MCPServerStatus.ERROR,
        message: error.message,
        servers: []
      };
    }
  }

  /**
   * Connect to MCP server (simplified implementation)
   * @param {string} serverUrl - Server URL
   * @param {string} serverName - Server identifier
   * @param {number} timeout - Connection timeout
   * @returns {Promise<Object>} Connection result
   */
  async _connectToServer(serverUrl, serverName, timeout) {
    if (!serverUrl) {
      throw new Error('Server URL is required for connection');
    }

    const serverId = serverName || this._generateServerId(serverUrl);
    
    try {
      // For MVP: Simulate MCP connection (full implementation would use @modelcontextprotocol/sdk)
      const connectionInfo = {
        id: serverId,
        url: serverUrl,
        status: MCPServerStatus.CONNECTING,
        connectedAt: new Date().toISOString(),
        tools: [], // Would be populated by real MCP discovery
        prompts: [] // Would be populated by real MCP discovery
      };
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      connectionInfo.status = MCPServerStatus.CONNECTED;
      this.servers.set(serverId, connectionInfo);
      
      return {
        success: true,
        status: MCPServerStatus.CONNECTED,
        message: `Connected to MCP server: ${serverId}`,
        servers: [connectionInfo]
      };
      
    } catch (error) {
      return {
        success: false,
        status: MCPServerStatus.ERROR,
        message: `Failed to connect to ${serverUrl}: ${error.message}`,
        servers: []
      };
    }
  }

  /**
   * Disconnect from MCP server
   * @param {string} serverId - Server to disconnect
   * @returns {Promise<Object>} Disconnect result
   */
  async _disconnectFromServer(serverId) {
    if (!serverId) {
      return {
        success: false,
        message: 'Server name is required for disconnection',
        servers: []
      };
    }

    if (this.servers.has(serverId)) {
      this.servers.delete(serverId);
      return {
        success: true,
        status: MCPServerStatus.DISCONNECTED,
        message: `Disconnected from MCP server: ${serverId}`,
        servers: []
      };
    } else {
      return {
        success: false,
        message: `Server not found: ${serverId}`,
        servers: []
      };
    }
  }

  /**
   * List connected MCP servers
   * @returns {Object} Server list
   */
  _listServers() {
    const serverList = Array.from(this.servers.values());
    
    return {
      success: true,
      status: 'listed',
      message: `Found ${serverList.length} MCP servers`,
      servers: serverList
    };
  }

  /**
   * Get status of specific server
   * @param {string} serverId - Server to check
   * @returns {Object} Status result
   */
  _getServerStatus(serverId) {
    if (!serverId) {
      return this._listServers();
    }

    const server = this.servers.get(serverId);
    if (server) {
      return {
        success: true,
        status: server.status,
        message: `Server ${serverId} is ${server.status}`,
        servers: [server]
      };
    } else {
      return {
        success: false,
        status: MCPServerStatus.DISCONNECTED,
        message: `Server not found: ${serverId}`,
        servers: []
      };
    }
  }

  /**
   * Generate server ID from URL
   * @param {string} url - Server URL
   * @returns {string} Generated ID
   */
  _generateServerId(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname || `server_${Date.now()}`;
    } catch (error) {
      return `server_${Date.now()}`;
    }
  }

  /**
   * Get connected server count
   * @returns {number} Number of connected servers
   */
  getConnectedServerCount() {
    return Array.from(this.servers.values()).filter(
      server => server.status === MCPServerStatus.CONNECTED
    ).length;
  }
}

export default McpClientTool;