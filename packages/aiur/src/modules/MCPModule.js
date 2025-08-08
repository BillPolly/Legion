/**
 * MCP Module for Aiur
 * 
 * Integrates MCP servers as Legion modules, making their tools
 * available through the standard Legion tool interface.
 */

import { Module } from '@legion/module-loader';
import { 
  MCPServerManager, 
  MCPPackageManager,
  MCPToolProvider,
  MCPServerRegistry
} from '@legion/tools/mcp';
import { EventEmitter } from 'events';

export default class MCPModule extends Module {
  constructor(dependencies = {}) {
    super('MCPModule', dependencies);
    
    this.serverManager = new MCPServerManager();
    this.packageManager = new MCPPackageManager();
    this.toolProvider = new MCPToolProvider(this.serverManager);
    this.serverRegistry = new MCPServerRegistry();
    
    this.activeServers = new Map();
    this.setupEventHandlers();
  }

  static async create(resourceManager) {
    const module = new MCPModule({
      resourceManager
    });
    await module.initialize();
    return module;
  }

  async initialize() {
    this.emit('info', 'Initializing MCP Module...');
    
    // Load server registry
    await this.serverRegistry.initialize();
    
    // Auto-start configured servers
    await this.autoStartServers();
    
    this.emit('info', `MCP Module initialized with ${this.activeServers.size} servers`);
  }

  async autoStartServers() {
    // Check for configured servers in environment or config
    const configuredServers = this.getConfiguredServers();
    
    for (const serverConfig of configuredServers) {
      try {
        await this.startServer(serverConfig);
      } catch (error) {
        this.emit('warning', `Failed to auto-start server ${serverConfig.id}: ${error.message}`);
      }
    }
  }

  getConfiguredServers() {
    // Get from environment or config
    const servers = [];
    
    // Check for filesystem server config
    if (this.dependencies.resourceManager?.get('env.MCP_FILESYSTEM_PATH')) {
      servers.push({
        id: 'filesystem',
        name: 'Filesystem Server',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          this.dependencies.resourceManager.get('env.MCP_FILESYSTEM_PATH')
        ],
        transport: 'stdio'
      });
    }

    // Check for git server config
    if (this.dependencies.resourceManager?.get('env.MCP_GIT_ENABLED') === 'true') {
      servers.push({
        id: 'git',
        name: 'Git Server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-git'],
        transport: 'stdio'
      });
    }

    return servers;
  }

  async startServer(config) {
    this.emit('progress', {
      percentage: 0,
      status: `Starting MCP server: ${config.name}`
    });

    try {
      const serverId = await this.serverManager.startServer(config);
      this.activeServers.set(serverId, config);
      
      this.emit('progress', {
        percentage: 100,
        status: `MCP server started: ${config.name}`
      });

      this.emit('info', `Started MCP server: ${config.name} (${serverId})`);
      return serverId;
    } catch (error) {
      this.emit('error', `Failed to start MCP server ${config.name}: ${error.message}`);
      throw error;
    }
  }

  async stopServer(serverId) {
    if (!this.activeServers.has(serverId)) {
      throw new Error(`Server ${serverId} is not active`);
    }

    await this.serverManager.stopServer(serverId);
    this.activeServers.delete(serverId);
    
    this.emit('info', `Stopped MCP server: ${serverId}`);
  }

  async searchServers(query, options = {}) {
    return await this.packageManager.searchServers(query, options);
  }

  async installServer(serverId, options = {}) {
    this.emit('progress', {
      percentage: 0,
      status: `Installing MCP server: ${serverId}`
    });

    const result = await this.packageManager.installServer(serverId, options);
    
    this.emit('progress', {
      percentage: 100,
      status: `Installed MCP server: ${serverId}`
    });

    return result;
  }

  async getRecommendations(taskDescription, options = {}) {
    return await this.packageManager.getRecommendations(taskDescription, options);
  }

  getTools() {
    // Return all tools from all active MCP servers
    const tools = [];
    
    for (const serverId of this.activeServers.keys()) {
      try {
        const serverTools = this.toolProvider.getToolsForServerSync(serverId);
        tools.push(...serverTools);
      } catch (error) {
        this.emit('warning', `Failed to get tools from server ${serverId}: ${error.message}`);
      }
    }

    // Also return management tools
    tools.push(
      new MCPSearchTool(this),
      new MCPInstallTool(this),
      new MCPStartTool(this),
      new MCPStopTool(this),
      new MCPListTool(this),
      new MCPRecommendTool(this)
    );

    return tools;
  }

  setupEventHandlers() {
    // Forward events from sub-components
    const components = [
      this.serverManager,
      this.packageManager,
      this.toolProvider,
      this.serverRegistry
    ];

    for (const component of components) {
      if (component instanceof EventEmitter) {
        component.on('info', msg => this.emit('info', msg));
        component.on('warning', msg => this.emit('warning', msg));
        component.on('error', msg => this.emit('error', msg));
        component.on('progress', data => this.emit('progress', data));
      }
    }
  }

  async cleanup() {
    // Stop all active servers
    for (const serverId of this.activeServers.keys()) {
      try {
        await this.stopServer(serverId);
      } catch (error) {
        this.emit('warning', `Failed to stop server ${serverId} during cleanup: ${error.message}`);
      }
    }
  }
}

// Management Tools

class MCPSearchTool {
  constructor(mcpModule) {
    this.mcpModule = mcpModule;
    this.name = 'mcp_search_servers';
    this.description = 'Search for available MCP servers';
    this.inputSchema = {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for MCP servers'
        },
        category: {
          type: 'string',
          description: 'Optional category filter'
        }
      },
      required: ['query']
    };
  }

  async execute(args) {
    const results = await this.mcpModule.searchServers(args.query, {
      category: args.category
    });
    
    return {
      success: true,
      servers: results.servers,
      totalCount: results.servers.length
    };
  }
}

class MCPInstallTool {
  constructor(mcpModule) {
    this.mcpModule = mcpModule;
    this.name = 'mcp_install_server';
    this.description = 'Install an MCP server from registry';
    this.inputSchema = {
      type: 'object',
      properties: {
        serverId: {
          type: 'string',
          description: 'ID of the server to install'
        },
        global: {
          type: 'boolean',
          description: 'Install globally (default: false)'
        }
      },
      required: ['serverId']
    };
  }

  async execute(args) {
    const result = await this.mcpModule.installServer(args.serverId, {
      global: args.global || false
    });
    
    return {
      success: result.success,
      message: result.message,
      installedPath: result.installedPath
    };
  }
}

class MCPStartTool {
  constructor(mcpModule) {
    this.mcpModule = mcpModule;
    this.name = 'mcp_start_server';
    this.description = 'Start an MCP server';
    this.inputSchema = {
      type: 'object',
      properties: {
        serverId: {
          type: 'string',
          description: 'ID of the server'
        },
        command: {
          type: 'string',
          description: 'Command to start the server'
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arguments for the command'
        }
      },
      required: ['serverId', 'command']
    };
  }

  async execute(args) {
    const config = {
      id: args.serverId,
      name: args.serverId,
      command: args.command,
      args: args.args || [],
      transport: 'stdio'
    };

    const serverId = await this.mcpModule.startServer(config);
    
    return {
      success: true,
      serverId,
      status: 'running'
    };
  }
}

class MCPStopTool {
  constructor(mcpModule) {
    this.mcpModule = mcpModule;
    this.name = 'mcp_stop_server';
    this.description = 'Stop a running MCP server';
    this.inputSchema = {
      type: 'object',
      properties: {
        serverId: {
          type: 'string',
          description: 'ID of the server to stop'
        }
      },
      required: ['serverId']
    };
  }

  async execute(args) {
    await this.mcpModule.stopServer(args.serverId);
    
    return {
      success: true,
      serverId: args.serverId,
      status: 'stopped'
    };
  }
}

class MCPListTool {
  constructor(mcpModule) {
    this.mcpModule = mcpModule;
    this.name = 'mcp_list_servers';
    this.description = 'List active MCP servers and their tools';
    this.inputSchema = {
      type: 'object',
      properties: {
        includeTools: {
          type: 'boolean',
          description: 'Include tool listings (default: false)'
        }
      }
    };
  }

  async execute(args) {
    const servers = [];
    
    for (const [serverId, config] of this.mcpModule.activeServers) {
      const serverInfo = {
        id: serverId,
        name: config.name,
        status: this.mcpModule.serverManager.getServerStatus(serverId)
      };

      if (args.includeTools) {
        try {
          serverInfo.tools = await this.mcpModule.serverManager.listTools(serverId);
        } catch (error) {
          serverInfo.tools = [];
          serverInfo.toolsError = error.message;
        }
      }

      servers.push(serverInfo);
    }
    
    return {
      success: true,
      servers,
      activeCount: servers.length
    };
  }
}

class MCPRecommendTool {
  constructor(mcpModule) {
    this.mcpModule = mcpModule;
    this.name = 'mcp_recommend_servers';
    this.description = 'Get MCP server recommendations for a task';
    this.inputSchema = {
      type: 'object',
      properties: {
        taskDescription: {
          type: 'string',
          description: 'Description of the task you want to accomplish'
        }
      },
      required: ['taskDescription']
    };
  }

  async execute(args) {
    const recommendations = await this.mcpModule.getRecommendations(args.taskDescription);
    
    return {
      success: true,
      recommendations: recommendations.servers,
      suggestions: recommendations.suggestions || []
    };
  }
}