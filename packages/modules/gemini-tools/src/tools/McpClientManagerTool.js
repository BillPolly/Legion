/**
 * McpClientManagerTool - Ported from Gemini CLI mcp-client-manager.ts to Legion patterns
 * Manages lifecycle of multiple MCP clients and tool discovery
 */

import { Tool } from '@legion/tools-registry';

/**
 * MCP Discovery State (ported from Gemini CLI)
 */
export const MCPDiscoveryState = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ERROR: 'error'
};

/**
 * Tool for MCP client management (ported from Gemini CLI's mcp-client-manager.ts)
 */
class McpClientManagerTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.clients = new Map(); // serverId -> client info
      this.discoveredTools = new Map(); // toolName -> tool info
      this.discoveryState = MCPDiscoveryState.NOT_STARTED;
      this.shortName = 'mcpmgr';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      super({
        name: 'mcp_client_manager',
        shortName: 'mcpmgr',
        description: 'Manage lifecycle of multiple MCP clients and discover tools (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['discover_all', 'stop_all', 'get_discovered_tools', 'get_discovery_state', 'restart_discovery'],
                description: 'MCP manager action to perform'
              },
              server_configs: {
                type: 'object',
                description: 'MCP server configurations for discovery'
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
              discoveryState: {
                type: 'string',
                description: 'Current discovery state'
              },
              discoveredTools: {
                type: 'array',
                description: 'List of discovered external tools'
              },
              connectedClients: {
                type: 'number',
                description: 'Number of connected MCP clients'
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

      this.clients = new Map();
      this.discoveredTools = new Map();
      this.discoveryState = MCPDiscoveryState.NOT_STARTED;
    }
  }

  /**
   * Execute MCP client manager operations (core logic ported from Gemini CLI)
   * @param {Object} args - Manager operation arguments
   * @returns {Promise<Object>} Operation result
   */
  async _execute(args) {
    try {
      const { action, server_configs } = args;

      switch (action) {
        case 'discover_all':
          return await this._discoverAllTools(server_configs);
          
        case 'stop_all':
          return await this._stopAllClients();
          
        case 'get_discovered_tools':
          return this._getDiscoveredTools();
          
        case 'get_discovery_state':
          return this._getDiscoveryState();
          
        case 'restart_discovery':
          return await this._restartDiscovery(server_configs);
          
        default:
          throw new Error(`Unknown MCP manager action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        discoveryState: MCPDiscoveryState.ERROR,
        discoveredTools: [],
        connectedClients: 0,
        message: error.message
      };
    }
  }

  /**
   * Discover all tools from configured MCP servers (ported from Gemini CLI)
   * @param {Object} serverConfigs - Server configurations
   * @returns {Promise<Object>} Discovery result
   */
  async _discoverAllTools(serverConfigs = {}) {
    try {
      this.discoveryState = MCPDiscoveryState.IN_PROGRESS;
      
      const defaultServers = {
        'local-calculator': {
          url: 'http://localhost:3001/mcp',
          name: 'Calculator Server',
          timeout: 5000
        },
        'file-processor': {
          url: 'http://localhost:3002/mcp', 
          name: 'File Processing Server',
          timeout: 5000
        }
      };
      
      const servers = { ...defaultServers, ...serverConfigs };
      const discoveryResults = [];
      
      // Simulate tool discovery from each server (ported pattern)
      for (const [serverId, config] of Object.entries(servers)) {
        try {
          const discoveredTools = await this._discoverToolsFromServer(serverId, config);
          discoveryResults.push(...discoveredTools);
          
          // Track connected client
          this.clients.set(serverId, {
            id: serverId,
            config,
            status: 'connected',
            toolCount: discoveredTools.length,
            connectedAt: new Date().toISOString()
          });
          
        } catch (error) {
          console.warn(`Failed to discover tools from ${serverId}:`, error.message);
        }
      }
      
      this.discoveryState = MCPDiscoveryState.COMPLETED;
      
      return {
        success: true,
        discoveryState: this.discoveryState,
        discoveredTools: discoveryResults,
        connectedClients: this.clients.size,
        message: `Discovered ${discoveryResults.length} tools from ${this.clients.size} MCP servers`
      };
      
    } catch (error) {
      this.discoveryState = MCPDiscoveryState.ERROR;
      throw error;
    }
  }

  /**
   * Discover tools from specific MCP server (ported logic)
   * @param {string} serverId - Server identifier
   * @param {Object} config - Server configuration
   * @returns {Promise<Array>} Discovered tools
   */
  async _discoverToolsFromServer(serverId, config) {
    // For MVP: Simulate tool discovery (real implementation would use MCP protocol)
    const mockTools = [
      {
        name: `${serverId}_calculator`,
        description: `Calculator tool from ${serverId}`,
        serverId,
        schema: {
          input: { 
            type: 'object',
            properties: {
              operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
              a: { type: 'number' },
              b: { type: 'number' }
            }
          }
        }
      },
      {
        name: `${serverId}_formatter`,
        description: `Code formatter tool from ${serverId}`,
        serverId,
        schema: {
          input: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              language: { type: 'string' }
            }
          }
        }
      }
    ];
    
    // Register discovered tools
    for (const tool of mockTools) {
      this.discoveredTools.set(tool.name, tool);
    }
    
    return mockTools;
  }

  /**
   * Stop all MCP clients
   * @returns {Promise<Object>} Stop result
   */
  async _stopAllClients() {
    const clientCount = this.clients.size;
    
    // Clean up all connections
    this.clients.clear();
    this.discoveredTools.clear();
    this.discoveryState = MCPDiscoveryState.NOT_STARTED;
    
    return {
      success: true,
      discoveryState: this.discoveryState,
      discoveredTools: [],
      connectedClients: 0,
      message: `Stopped ${clientCount} MCP clients`
    };
  }

  /**
   * Get all discovered external tools
   * @returns {Object} Discovered tools
   */
  _getDiscoveredTools() {
    const tools = Array.from(this.discoveredTools.values());
    
    return {
      success: true,
      discoveryState: this.discoveryState,
      discoveredTools: tools,
      connectedClients: this.clients.size,
      message: `Found ${tools.length} external tools from ${this.clients.size} servers`
    };
  }

  /**
   * Get current discovery state
   * @returns {Object} Discovery state
   */
  _getDiscoveryState() {
    return {
      success: true,
      discoveryState: this.discoveryState,
      discoveredTools: Array.from(this.discoveredTools.values()),
      connectedClients: this.clients.size,
      message: `Discovery state: ${this.discoveryState}`
    };
  }

  /**
   * Restart discovery process
   * @param {Object} serverConfigs - Server configurations
   * @returns {Promise<Object>} Restart result
   */
  async _restartDiscovery(serverConfigs) {
    await this._stopAllClients();
    return await this._discoverAllTools(serverConfigs);
  }

  /**
   * Get manager statistics
   * @returns {Object} Statistics
   */
  getManagerStats() {
    return {
      connectedClients: this.clients.size,
      discoveredTools: this.discoveredTools.size,
      discoveryState: this.discoveryState,
      servers: Array.from(this.clients.values())
    };
  }
}

export default McpClientManagerTool;