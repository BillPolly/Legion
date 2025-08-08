/**
 * MCPToolProvider - Legion Module implementation for MCP servers
 * 
 * Implements the Legion Module interface to provide MCP tools as Legion tools.
 * Acts as an adapter between MCP servers and the Legion tool ecosystem.
 */

import { EventEmitter } from 'events';
import { MCPToolProxy } from '../integration/MCPToolProxy.js';

export class MCPToolProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.serverId = options.serverId;
    this.metadata = options.metadata;
    this.serverProcess = options.serverProcess;
    this.toolRegistry = options.toolRegistry; // MCPServerRegistry
    this.config = options.config || {};
    
    // Module information (Legion Module interface)
    this.name = `mcp-${this.serverId}`;
    this.version = this.metadata.version || '1.0.0';
    this.description = this.metadata.description || `MCP server: ${this.serverId}`;
    this.category = this.metadata.category || 'mcp-general';
    this.tags = [...(this.metadata.tags || []), 'mcp', 'provider'];
    
    // Tool proxies cache
    this.toolProxies = new Map(); // toolName -> MCPToolProxy
    this.initialized = false;
    
    // Statistics
    this.statistics = {
      toolsCreated: 0,
      executionsHandled: 0,
      errorsEncountered: 0,
      lastToolAccess: null
    };
  }

  /**
   * Initialize the provider (Legion Module interface)
   */
  async initialize() {
    if (this.initialized) return;
    
    this.emit('info', `Initializing MCP Tool Provider for server ${this.serverId}`);
    
    try {
      // Create tool proxies for all available tools
      await this.createToolProxies();
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      
      this.emit('provider-initialized', {
        serverId: this.serverId,
        toolCount: this.toolProxies.size
      });
      
    } catch (error) {
      this.emit('error', `Failed to initialize MCP Tool Provider: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all tools (Legion Module interface)
   */
  getTools() {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }
    
    return Array.from(this.toolProxies.values());
  }

  /**
   * Get specific tool by name (Legion Module interface)
   */
  getTool(toolName) {
    this.statistics.lastToolAccess = Date.now();
    
    // Handle both direct tool name and prefixed name
    let proxy = this.toolProxies.get(toolName);
    
    if (!proxy) {
      // Try with MCP prefix removed
      const unprefixedName = toolName.startsWith('mcp.') ? 
        toolName.substring(4) : toolName;
      proxy = this.toolProxies.get(unprefixedName);
    }
    
    if (!proxy) {
      // Try with server prefix
      const serverPrefixedName = `${this.serverId}.${toolName}`;
      proxy = this.toolProxies.get(serverPrefixedName);
    }
    
    if (proxy) {
      this.statistics.toolsCreated++;
    }
    
    return proxy || null;
  }

  /**
   * Check if tool exists (Legion Module interface)
   */
  hasTool(toolName) {
    return this.getTool(toolName) !== null;
  }

  /**
   * Get tool names (Legion Module interface)
   */
  getToolNames() {
    return Array.from(this.toolProxies.keys());
  }

  /**
   * Execute tool by name (convenience method)
   */
  async executeTool(toolName, input) {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in MCP provider ${this.serverId}`);
    }
    
    try {
      this.statistics.executionsHandled++;
      const result = await tool.execute(input);
      
      this.emit('tool-executed', {
        serverId: this.serverId,
        toolName,
        success: true
      });
      
      return result;
      
    } catch (error) {
      this.statistics.errorsEncountered++;
      
      this.emit('tool-execution-failed', {
        serverId: this.serverId,
        toolName,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Get module metadata (Legion Module interface)
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      category: this.category,
      tags: this.tags,
      source: 'mcp',
      
      // MCP-specific metadata
      serverId: this.serverId,
      serverMetadata: this.metadata,
      
      // Tool information
      tools: this.getToolsMetadata(),
      
      // Provider statistics
      statistics: this.getStatistics(),
      
      // Health information
      health: this.getHealthStatus()
    };
  }

  /**
   * Get tools metadata for Legion ToolRegistry
   */
  getToolsMetadata() {
    const toolsMetadata = {};
    
    for (const [toolName, proxy] of this.toolProxies) {
      toolsMetadata[toolName] = {
        name: proxy.name,
        description: proxy.description,
        inputSchema: proxy.inputSchema,
        category: proxy.category,
        tags: proxy.tags,
        source: 'mcp',
        serverId: this.serverId,
        available: proxy.isAvailable()
      };
    }
    
    return toolsMetadata;
  }

  /**
   * Create tool proxies for all server tools
   */
  async createToolProxies() {
    if (!this.metadata.tools || this.metadata.tools.length === 0) {
      this.emit('warning', `No tools found for MCP server ${this.serverId}`);
      return;
    }
    
    for (const toolInfo of this.metadata.tools) {
      try {
        const proxy = new MCPToolProxy({
          serverId: this.serverId,
          toolName: toolInfo.name,
          toolInfo,
          serverProcess: this.serverProcess,
          registry: this.toolRegistry,
          
          // Provider-specific options
          timeout: this.config.toolTimeout,
          retryAttempts: this.config.retryAttempts,
          enableEvents: true
        });
        
        // Set up proxy event forwarding
        this.setupProxyEventForwarding(proxy);
        
        // Store proxy with different naming strategies for flexible access
        this.toolProxies.set(toolInfo.name, proxy);
        
        // Also store with MCP prefix if configured
        if (this.config.useToolPrefix) {
          this.toolProxies.set(`mcp.${toolInfo.name}`, proxy);
        }
        
        // Store with server prefix for uniqueness
        this.toolProxies.set(`${this.serverId}.${toolInfo.name}`, proxy);
        
      } catch (error) {
        this.emit('warning', `Failed to create proxy for tool ${toolInfo.name}: ${error.message}`);
      }
    }
    
    this.emit('info', `Created ${this.toolProxies.size} tool proxies for server ${this.serverId}`);
  }

  /**
   * Set up event listeners for server health monitoring
   */
  setupEventListeners() {
    // Monitor server process health
    if (this.serverProcess) {
      this.serverProcess.on('stopped', () => {
        this.emit('server-stopped', { serverId: this.serverId });
        this.handleServerUnavailable();
      });
      
      this.serverProcess.on('started', () => {
        this.emit('server-started', { serverId: this.serverId });
        this.handleServerAvailable();
      });
      
      this.serverProcess.on('restarted', () => {
        this.emit('server-restarted', { serverId: this.serverId });
        this.handleServerRestarted();
      });
    }
  }

  /**
   * Set up event forwarding for tool proxies
   */
  setupProxyEventForwarding(proxy) {
    // Forward execution events
    proxy.on('execution:start', (info) => {
      this.emit('tool-execution-start', {
        providerId: this.name,
        serverId: this.serverId,
        ...info
      });
    });
    
    proxy.on('execution:complete', (info) => {
      this.emit('tool-execution-complete', {
        providerId: this.name,
        serverId: this.serverId,
        ...info
      });
    });
    
    proxy.on('execution:error', (info) => {
      this.emit('tool-execution-error', {
        providerId: this.name,
        serverId: this.serverId,
        ...info
      });
    });
    
    // Forward retry events
    proxy.on('retry-attempt', (info) => {
      this.emit('tool-retry-attempt', {
        providerId: this.name,
        serverId: this.serverId,
        ...info
      });
    });
  }

  /**
   * Handle server becoming unavailable
   */
  handleServerUnavailable() {
    this.emit('warning', `MCP server ${this.serverId} is no longer available`);
    
    // Mark all tools as unavailable but keep proxies for when server returns
    for (const proxy of this.toolProxies.values()) {
      proxy.emit('server-unavailable', { serverId: this.serverId });
    }
  }

  /**
   * Handle server becoming available
   */
  handleServerAvailable() {
    this.emit('info', `MCP server ${this.serverId} is now available`);
    
    // Refresh metadata for all tools
    for (const proxy of this.toolProxies.values()) {
      proxy.refreshMetadata().catch(error => {
        this.emit('warning', `Failed to refresh metadata for ${proxy.toolName}: ${error.message}`);
      });
    }
  }

  /**
   * Handle server restart
   */
  async handleServerRestarted() {
    this.emit('info', `MCP server ${this.serverId} restarted, refreshing tools`);
    
    try {
      // Re-extract metadata from restarted server
      if (this.toolRegistry && this.toolRegistry.metadataExtractor) {
        const newMetadata = await this.toolRegistry.metadataExtractor
          .extractServerMetadata(this.serverProcess);
        
        // Update metadata
        this.metadata = newMetadata;
        
        // Recreate tool proxies if tools changed
        await this.recreateToolProxiesIfNeeded(newMetadata);
      }
    } catch (error) {
      this.emit('error', `Failed to refresh tools after server restart: ${error.message}`);
    }
  }

  /**
   * Recreate tool proxies if server tools changed
   */
  async recreateToolProxiesIfNeeded(newMetadata) {
    const currentToolNames = new Set(Array.from(this.toolProxies.keys()));
    const newToolNames = new Set(newMetadata.tools.map(t => t.name));
    
    // Check if tools changed
    const toolsAdded = [...newToolNames].filter(name => !currentToolNames.has(name));
    const toolsRemoved = [...currentToolNames].filter(name => !newToolNames.has(name));
    
    if (toolsAdded.length > 0 || toolsRemoved.length > 0) {
      this.emit('tools-changed', {
        serverId: this.serverId,
        toolsAdded,
        toolsRemoved
      });
      
      // Remove old proxies
      for (const toolName of toolsRemoved) {
        const proxy = this.toolProxies.get(toolName);
        if (proxy) {
          proxy.cleanup();
          this.toolProxies.delete(toolName);
        }
      }
      
      // Recreate all proxies
      this.toolProxies.clear();
      await this.createToolProxies();
    }
  }

  /**
   * Get provider health status
   */
  getHealthStatus() {
    const serverHealth = this.serverProcess ? {
      status: this.serverProcess.status,
      uptime: this.serverProcess.getUptime(),
      healthy: this.serverProcess.status === 'running'
    } : {
      status: 'unknown',
      uptime: 0,
      healthy: false
    };
    
    return {
      server: serverHealth,
      provider: {
        initialized: this.initialized,
        toolCount: this.toolProxies.size,
        lastAccess: this.statistics.lastToolAccess
      },
      tools: this.getToolsHealth()
    };
  }

  /**
   * Get health status for all tools
   */
  getToolsHealth() {
    const toolsHealth = {};
    
    for (const [toolName, proxy] of this.toolProxies) {
      toolsHealth[toolName] = {
        available: proxy.isAvailable(),
        statistics: proxy.getStatistics()
      };
    }
    
    return toolsHealth;
  }

  /**
   * Get provider statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      toolCount: this.toolProxies.size,
      initialized: this.initialized,
      serverStatus: this.serverProcess?.status || 'unknown'
    };
  }

  /**
   * Search tools by query
   */
  searchTools(query, options = {}) {
    const queryLower = query.toLowerCase();
    const results = [];
    
    for (const [toolName, proxy] of this.toolProxies) {
      let score = 0;
      
      // Name match
      if (proxy.name.toLowerCase().includes(queryLower)) {
        score += 10;
      }
      
      // Description match
      if (proxy.description.toLowerCase().includes(queryLower)) {
        score += 5;
      }
      
      // Tag match
      if (proxy.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
        score += 3;
      }
      
      // Category match
      if (proxy.category.toLowerCase().includes(queryLower)) {
        score += 2;
      }
      
      if (score > 0 || options.includeAll) {
        results.push({
          toolName,
          proxy,
          relevanceScore: score,
          metadata: proxy.getMetadata()
        });
      }
    }
    
    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return results.slice(0, options.limit || 10);
  }

  /**
   * Refresh all tool metadata
   */
  async refreshAllToolMetadata() {
    const refreshPromises = Array.from(this.toolProxies.values()).map(proxy =>
      proxy.refreshMetadata().catch(error => ({
        toolName: proxy.toolName,
        error: error.message
      }))
    );
    
    const results = await Promise.allSettled(refreshPromises);
    
    const failures = results
      .filter(result => result.status === 'rejected' || result.value?.error)
      .map(result => result.value || result.reason);
    
    if (failures.length > 0) {
      this.emit('metadata-refresh-partial', {
        serverId: this.serverId,
        failures
      });
    }
    
    this.emit('metadata-refreshed', {
      serverId: this.serverId,
      toolCount: this.toolProxies.size,
      failures: failures.length
    });
  }

  /**
   * Cleanup provider resources (Legion Module interface)
   */
  async cleanup() {
    this.emit('info', `Cleaning up MCP Tool Provider for server ${this.serverId}`);
    
    // Cleanup all tool proxies
    for (const proxy of this.toolProxies.values()) {
      try {
        proxy.cleanup();
      } catch (error) {
        this.emit('warning', `Error cleaning up proxy: ${error.message}`);
      }
    }
    
    this.toolProxies.clear();
    this.removeAllListeners();
    this.initialized = false;
    
    this.emit('provider-cleaned-up', { serverId: this.serverId });
  }

  /**
   * String representation
   */
  toString() {
    return `MCPToolProvider(${this.serverId}, ${this.toolProxies.size} tools)`;
  }

  /**
   * JSON representation
   */
  toJSON() {
    return {
      type: 'MCPToolProvider',
      name: this.name,
      serverId: this.serverId,
      version: this.version,
      description: this.description,
      category: this.category,
      tags: this.tags,
      initialized: this.initialized,
      toolCount: this.toolProxies.size,
      tools: Array.from(this.toolProxies.keys()),
      statistics: this.getStatistics(),
      health: this.getHealthStatus()
    };
  }
}