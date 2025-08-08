/**
 * MCPServerRegistry - Integration layer between MCP servers and Legion tool system
 * 
 * Bridges the gap between:
 * - MCP server management (MCPServerManager)
 * - Legion tool discovery (ToolRegistry, SemanticToolDiscovery)
 * - Tool execution (ToolProxy pattern)
 * 
 * Provides automatic discovery and registration of MCP tools as Legion tools.
 */

import { EventEmitter } from 'events';
import { MCPPackageManager } from '../mcp/MCPPackageManager.js';
import { MCPServerManager } from '../mcp/MCPServerManager.js';
import { MCPMetadataExtractor } from './MCPMetadataExtractor.js';

export class MCPServerRegistry extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    
    this.resourceManager = dependencies.resourceManager;
    this.toolRegistry = dependencies.toolRegistry; // Legion ToolRegistry
    this.semanticSearch = dependencies.semanticSearch; // SemanticToolDiscovery
    
    // Initialize MCP components
    this.packageManager = new MCPPackageManager({
      resourceManager: this.resourceManager,
      ...dependencies.packageManager
    });
    
    this.serverManager = new MCPServerManager({
      resourceManager: this.resourceManager,
      ...dependencies.serverManager
    });
    
    this.metadataExtractor = new MCPMetadataExtractor({
      resourceManager: this.resourceManager,
      ...dependencies.metadataExtractor
    });
    
    // Configuration
    this.options = {
      autoDiscoverServers: dependencies.autoDiscoverServers !== false,
      autoInstallPopular: dependencies.autoInstallPopular || false,
      updateInterval: dependencies.updateInterval || 24 * 60 * 60 * 1000, // 24 hours
      enableSemanticIndexing: dependencies.enableSemanticIndexing !== false,
      toolPrefix: dependencies.toolPrefix || 'mcp',
      ...dependencies
    };
    
    // State
    this.registeredProviders = new Map(); // serverId -> ModuleProvider
    self.mcpTools = new Map(); // toolName -> { serverId, toolInfo, proxy }
    this.initialized = false;
    this.discoveryTimer = null;
    
    // Statistics
    this.statistics = {
      serversDiscovered: 0,
      serversInstalled: 0,
      toolsRegistered: 0,
      searchQueries: 0,
      toolExecutions: 0,
      autoInstalls: 0
    };
    
    this.setupEventHandling();
  }

  /**
   * Initialize the MCP server registry
   */
  async initialize() {
    if (this.initialized) return;
    
    this.emit('info', 'Initializing MCP Server Registry');
    
    // Initialize components
    await this.packageManager.initialize();
    await this.serverManager.initialize();
    await this.metadataExtractor.initialize();
    
    // Discover and register existing servers
    if (this.options.autoDiscoverServers) {
      await this.discoverAndRegisterServers();
    }
    
    // Install popular servers if enabled
    if (this.options.autoInstallPopular) {
      await this.installPopularServers();
    }
    
    // Set up periodic discovery
    this.setupPeriodicDiscovery();
    
    this.initialized = true;
    
    this.emit('initialized', {
      serversRegistered: this.registeredProviders.size,
      toolsAvailable: this.mcpTools.size
    });
  }

  /**
   * Discover and register all available MCP servers
   */
  async discoverAndRegisterServers() {
    this.emit('info', 'Discovering MCP servers');
    
    try {
      // Get running servers from server manager
      const runningServers = this.serverManager.getRunningServers();
      
      for (const server of runningServers) {
        await this.registerServer(server);
      }
      
      this.statistics.serversDiscovered += runningServers.length;
      
      this.emit('servers-discovered', {
        count: runningServers.length,
        servers: runningServers.map(s => s.serverId)
      });
      
    } catch (error) {
      this.emit('error', `Server discovery failed: ${error.message}`);
    }
  }

  /**
   * Register a single MCP server with the tool system
   */
  async registerServer(serverProcess) {
    const serverId = serverProcess.serverId;
    
    if (this.registeredProviders.has(serverId)) {
      this.emit('warning', `Server ${serverId} already registered`);
      return;
    }
    
    try {
      // Extract metadata and tools from the server
      const metadata = await this.metadataExtractor.extractServerMetadata(serverProcess);
      
      // Create module provider for this server
      const provider = this.createMCPModuleProvider(serverId, metadata, serverProcess);
      
      // Register with Legion ToolRegistry
      if (this.toolRegistry) {
        await this.toolRegistry.registerProvider(provider);
      }
      
      // Register tools for direct access
      await this.registerServerTools(serverId, metadata.tools, serverProcess);
      
      // Index tools for semantic search
      if (this.options.enableSemanticIndexing && this.semanticSearch) {
        await this.indexServerTools(serverId, metadata.tools);
      }
      
      this.registeredProviders.set(serverId, provider);
      this.statistics.toolsRegistered += metadata.tools.length;
      
      this.emit('server-registered', {
        serverId,
        toolCount: metadata.tools.length,
        metadata
      });
      
      return provider;
      
    } catch (error) {
      this.emit('error', `Failed to register server ${serverId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unregister a server from the tool system
   */
  async unregisterServer(serverId) {
    const provider = this.registeredProviders.get(serverId);
    if (!provider) return;
    
    try {
      // Unregister from ToolRegistry
      if (this.toolRegistry) {
        await this.toolRegistry.unregisterProvider(serverId);
      }
      
      // Remove tools from direct access
      const serverTools = Array.from(this.mcpTools.entries())
        .filter(([_, info]) => info.serverId === serverId);
      
      for (const [toolName] of serverTools) {
        this.mcpTools.delete(toolName);
      }
      
      // Remove from semantic search index
      if (this.semanticSearch && this.semanticSearch.toolIndexer) {
        for (const [toolName] of serverTools) {
          await this.semanticSearch.toolIndexer.removeTool(toolName);
        }
      }
      
      this.registeredProviders.delete(serverId);
      
      this.emit('server-unregistered', {
        serverId,
        toolsRemoved: serverTools.length
      });
      
    } catch (error) {
      this.emit('error', `Failed to unregister server ${serverId}: ${error.message}`);
    }
  }

  /**
   * Create a ModuleProvider for an MCP server
   */
  createMCPModuleProvider(serverId, metadata, serverProcess) {
    return {
      name: serverId,
      definition: {
        create: async (config) => {
          return this.createMCPModuleInstance(serverId, metadata, serverProcess, config);
        },
        getMetadata: () => ({
          name: metadata.name,
          description: metadata.description,
          category: metadata.category,
          version: metadata.version,
          tools: this.createToolsMetadata(metadata.tools),
          source: 'mcp',
          serverId
        })
      },
      config: {},
      lazy: true // Load on-demand
    };
  }

  /**
   * Create MCP module instance
   */
  async createMCPModuleInstance(serverId, metadata, serverProcess, config) {
    const { MCPToolProvider } = await import('../providers/MCPToolProvider.js');
    
    return new MCPToolProvider({
      serverId,
      metadata,
      serverProcess,
      toolRegistry: this,
      config
    });
  }

  /**
   * Create tools metadata for ToolRegistry
   */
  createToolsMetadata(mcpTools) {
    const toolsMetadata = {};
    
    for (const tool of mcpTools) {
      toolsMetadata[tool.name] = {
        name: tool.name,
        description: tool.description,
        schema: tool.inputSchema,
        category: tool.category || 'mcp-tool',
        tags: tool.tags || [],
        source: 'mcp'
      };
    }
    
    return toolsMetadata;
  }

  /**
   * Register individual tools from a server
   */
  async registerServerTools(serverId, tools, serverProcess) {
    const { MCPToolProxy } = await import('./MCPToolProxy.js');
    
    for (const tool of tools) {
      const toolName = this.options.toolPrefix ? 
        `${this.options.toolPrefix}.${tool.name}` : tool.name;
      
      const proxy = new MCPToolProxy({
        serverId,
        toolName: tool.name,
        toolInfo: tool,
        serverProcess,
        registry: this
      });
      
      this.mcpTools.set(toolName, {
        serverId,
        toolInfo: tool,
        proxy
      });
    }
  }

  /**
   * Index tools for semantic search
   */
  async indexServerTools(serverId, tools) {
    if (!this.semanticSearch || !this.semanticSearch.toolIndexer) return;
    
    const toolsToIndex = tools.map(tool => ({
      tool: {
        name: this.options.toolPrefix ? `${this.options.toolPrefix}.${tool.name}` : tool.name,
        description: tool.description,
        category: tool.category || 'mcp-tool',
        tags: [...(tool.tags || []), 'mcp', serverId],
        inputSchema: tool.inputSchema,
        source: 'mcp'
      },
      metadata: {
        serverId,
        category: tool.category || 'mcp-general',
        relatedTools: tools.map(t => t.name).filter(name => name !== tool.name),
        capabilities: this.extractCapabilities(tool)
      }
    }));
    
    await this.semanticSearch.toolIndexer.indexTools(toolsToIndex);
  }

  /**
   * Extract capabilities from MCP tool for better search
   */
  extractCapabilities(tool) {
    const capabilities = [];
    
    // Extract from tool name
    const nameLower = tool.name.toLowerCase();
    if (nameLower.includes('read')) capabilities.push('data reading');
    if (nameLower.includes('write')) capabilities.push('data writing');
    if (nameLower.includes('list')) capabilities.push('listing');
    if (nameLower.includes('search')) capabilities.push('searching');
    if (nameLower.includes('create')) capabilities.push('creation');
    if (nameLower.includes('delete')) capabilities.push('deletion');
    
    // Extract from description
    const descLower = (tool.description || '').toLowerCase();
    if (descLower.includes('file')) capabilities.push('file operations');
    if (descLower.includes('git')) capabilities.push('version control');
    if (descLower.includes('database')) capabilities.push('data storage');
    if (descLower.includes('api')) capabilities.push('API integration');
    
    return capabilities;
  }

  /**
   * Search for MCP tools
   */
  async searchMCPTools(query, options = {}) {
    this.statistics.searchQueries++;
    
    // Use semantic search if available
    if (this.semanticSearch) {
      const results = await this.semanticSearch.findRelevantTools(query, {
        categories: options.categories || ['mcp-filesystem', 'mcp-git', 'mcp-web', 'mcp-database'],
        limit: options.limit || 10,
        ...options
      });
      
      return results;
    }
    
    // Fallback to simple text search
    const queryLower = query.toLowerCase();
    const results = [];
    
    for (const [toolName, toolInfo] of this.mcpTools) {
      const tool = toolInfo.toolInfo;
      let score = 0;
      
      if (tool.name.toLowerCase().includes(queryLower)) score += 10;
      if (tool.description.toLowerCase().includes(queryLower)) score += 5;
      if (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(queryLower))) score += 3;
      
      if (score > 0) {
        results.push({
          name: toolName,
          ...tool,
          serverId: toolInfo.serverId,
          relevanceScore: score,
          available: true
        });
      }
    }
    
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Execute MCP tool
   */
  async executeMCPTool(toolName, arguments_, options = {}) {
    const toolInfo = this.mcpTools.get(toolName);
    if (!toolInfo) {
      // Try to suggest similar tools or auto-install
      return this.handleMissingTool(toolName, arguments_, options);
    }
    
    try {
      this.statistics.toolExecutions++;
      
      const result = await toolInfo.proxy.execute(arguments_);
      
      this.emit('tool-executed', {
        toolName,
        serverId: toolInfo.serverId,
        success: true
      });
      
      return result;
      
    } catch (error) {
      this.emit('tool-execution-failed', {
        toolName,
        serverId: toolInfo.serverId,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Handle missing tool - suggest alternatives or auto-install
   */
  async handleMissingTool(toolName, arguments_, options = {}) {
    // Search for similar tools
    const suggestions = await this.searchMCPTools(toolName, { limit: 3 });
    
    // Check if tool is available for installation
    const availableServers = await this.packageManager.searchServers(toolName, { limit: 5 });
    const installable = availableServers.filter(server => !server.installed);
    
    if (options.autoInstall && installable.length > 0) {
      // Auto-install the first matching server
      const serverToInstall = installable[0];
      
      this.emit('auto-installing', {
        toolName,
        serverId: serverToInstall.id,
        serverName: serverToInstall.name
      });
      
      try {
        await this.packageManager.installServer(serverToInstall.id);
        
        // Wait for server to start and register
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try executing the tool again
        return this.executeMCPTool(toolName, arguments_, { ...options, autoInstall: false });
        
      } catch (error) {
        this.emit('auto-install-failed', {
          toolName,
          serverId: serverToInstall.id,
          error: error.message
        });
      }
    }
    
    // Return suggestions and installation options
    throw new Error(`Tool '${toolName}' not available. Suggestions: ${suggestions.map(s => s.name).join(', ')}. Installable servers: ${installable.map(s => s.name).join(', ')}`);
  }

  /**
   * Install popular MCP servers
   */
  async installPopularServers() {
    try {
      const popular = await this.packageManager.getPopularServers(null, 3);
      const toInstall = popular.filter(server => !server.installed);
      
      this.emit('info', `Installing ${toInstall.length} popular MCP servers`);
      
      for (const server of toInstall) {
        try {
          await this.packageManager.installServer(server.id);
          this.statistics.serversInstalled++;
          this.statistics.autoInstalls++;
        } catch (error) {
          this.emit('warning', `Failed to install popular server ${server.name}: ${error.message}`);
        }
      }
      
    } catch (error) {
      this.emit('error', `Failed to install popular servers: ${error.message}`);
    }
  }

  /**
   * Set up periodic discovery of new servers
   */
  setupPeriodicDiscovery() {
    if (this.options.updateInterval <= 0) return;
    
    this.discoveryTimer = setInterval(async () => {
      try {
        await this.packageManager.updateRegistry();
        await this.discoverAndRegisterServers();
      } catch (error) {
        this.emit('warning', `Periodic discovery failed: ${error.message}`);
      }
    }, this.options.updateInterval);
  }

  /**
   * Set up event handling
   */
  setupEventHandling() {
    // Forward package manager events
    this.packageManager.on('server-installed', async (info) => {
      this.emit('mcp-server-installed', info);
      // Server will be registered when it starts
    });
    
    this.packageManager.on('server-uninstalled', (info) => {
      this.unregisterServer(info.serverId).catch(error => {
        this.emit('warning', `Failed to unregister uninstalled server: ${error.message}`);
      });
    });
    
    // Forward server manager events
    this.serverManager.on('server-started', async (info) => {
      const server = this.serverManager.getServer(info.serverId);
      if (server) {
        await this.registerServer(server);
      }
    });
    
    this.serverManager.on('server-stopped', (info) => {
      this.unregisterServer(info.serverId).catch(error => {
        this.emit('warning', `Failed to unregister stopped server: ${error.message}`);
      });
    });
  }

  /**
   * Get available MCP tools
   */
  getAvailableMCPTools() {
    return Array.from(this.mcpTools.entries()).map(([name, info]) => ({
      name,
      serverId: info.serverId,
      ...info.toolInfo
    }));
  }

  /**
   * Get MCP servers status
   */
  getMCPServersStatus() {
    const servers = [];
    
    for (const [serverId, provider] of this.registeredProviders) {
      const serverProcess = this.serverManager.getServer(serverId);
      const tools = Array.from(this.mcpTools.entries())
        .filter(([_, info]) => info.serverId === serverId)
        .map(([name]) => name);
      
      servers.push({
        serverId,
        status: serverProcess?.status || 'unknown',
        toolCount: tools.length,
        tools,
        uptime: serverProcess?.getUptime() || 0
      });
    }
    
    return servers;
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      registeredServers: this.registeredProviders.size,
      availableTools: this.mcpTools.size,
      runningServers: this.serverManager.getRunningServerCount()
    };
  }

  /**
   * Shutdown the registry
   */
  async shutdown() {
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
    
    // Shutdown components
    await this.serverManager.shutdown();
    await this.packageManager.shutdown();
    
    // Clear state
    this.registeredProviders.clear();
    this.mcpTools.clear();
    
    this.emit('shutdown');
  }
}