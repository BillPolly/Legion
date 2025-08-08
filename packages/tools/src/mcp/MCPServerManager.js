/**
 * MCPServerManager - High-level manager for MCP server lifecycle
 * 
 * Coordinates:
 * - Server process management
 * - Health monitoring
 * - Configuration management
 * - Load balancing across servers
 * - Server discovery and registration
 */

import { EventEmitter } from 'events';
import { MCPServerProcess } from './MCPServerProcess.js';
import { MCPHealthChecker } from './MCPHealthChecker.js';
import { MCPConfigManager } from './MCPConfigManager.js';

export class MCPServerManager extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    
    this.resourceManager = dependencies.resourceManager;
    
    // Initialize components
    this.healthChecker = new MCPHealthChecker({
      ...dependencies.healthChecker
    });
    
    this.configManager = new MCPConfigManager({
      resourceManager: this.resourceManager,
      ...dependencies.configManager
    });
    
    // Configuration
    this.options = {
      autoStart: dependencies.autoStart !== false,
      loadBalancing: dependencies.loadBalancing || false,
      maxConcurrentStarts: dependencies.maxConcurrentStarts || 5,
      startupTimeout: dependencies.startupTimeout || 30000,
      shutdownTimeout: dependencies.shutdownTimeout || 15000,
      ...dependencies
    };
    
    // State
    this.servers = new Map(); // serverId -> MCPServerProcess
    this.serverConfigs = new Map(); // serverId -> config
    this.startupQueue = [];
    self.shutdownQueue = [];
    this.initialized = false;
    
    // Load balancer state
    this.loadBalancer = {
      enabled: this.options.loadBalancing,
      roundRobinIndex: 0,
      serverWeights: new Map(), // serverId -> weight
      requestCounts: new Map() // serverId -> count
    };
    
    // Statistics
    this.statistics = {
      totalServers: 0,
      runningServers: 0,
      failedServers: 0,
      totalRequests: 0,
      totalErrors: 0,
      startTime: null
    };
    
    this.setupEventHandling();
  }

  /**
   * Initialize the server manager
   */
  async initialize() {
    if (this.initialized) return;
    
    this.emit('info', 'Initializing MCP Server Manager');
    
    // Initialize components
    await this.configManager.initialize();
    this.healthChecker.start();
    
    // Load server configurations
    await this.loadServerConfigurations();
    
    // Auto-start servers if enabled
    if (this.options.autoStart) {
      await this.startConfiguredServers();
    }
    
    this.initialized = true;
    this.statistics.startTime = Date.now();
    
    this.emit('initialized', {
      serverCount: this.servers.size,
      runningCount: this.getRunningServerCount()
    });
  }

  /**
   * Load server configurations
   */
  async loadServerConfigurations() {
    const configs = await this.configManager.getAllServerConfigs();
    
    for (const config of configs) {
      this.serverConfigs.set(config.serverId, config);
      
      this.emit('server-config-loaded', {
        serverId: config.serverId,
        name: config.name
      });
    }
    
    this.emit('info', `Loaded ${configs.length} server configurations`);
  }

  /**
   * Start all configured servers
   */
  async startConfiguredServers() {
    const configuredServers = Array.from(this.serverConfigs.values())
      .filter(config => config.enabled !== false);
    
    this.emit('info', `Starting ${configuredServers.length} configured servers`);
    
    // Start servers in batches to avoid overwhelming the system
    const batches = this.chunkArray(configuredServers, this.options.maxConcurrentStarts);
    
    for (const batch of batches) {
      const startPromises = batch.map(config => this.startServer(config.serverId));
      await Promise.allSettled(startPromises);
    }
  }

  /**
   * Start a specific server
   */
  async startServer(serverId, options = {}) {
    const config = this.serverConfigs.get(serverId);
    if (!config) {
      throw new Error(`Server configuration not found: ${serverId}`);
    }
    
    if (this.servers.has(serverId)) {
      const existingServer = this.servers.get(serverId);
      if (existingServer.status === 'running') {
        this.emit('warning', `Server ${serverId} is already running`);
        return existingServer;
      }
    }
    
    this.emit('server-start-requested', { serverId });
    
    try {
      // Create server process
      const serverProcess = new MCPServerProcess(config, {
        autoRestart: config.autoRestart,
        maxRestarts: config.maxRestarts,
        healthCheckInterval: config.healthCheckInterval,
        ...options
      });
      
      // Register with health checker
      this.healthChecker.registerServer(serverProcess);
      
      // Store server process
      this.servers.set(serverId, serverProcess);
      
      // Set up server event listeners
      this.setupServerEventListeners(serverProcess);
      
      // Start the server
      await serverProcess.start();
      
      this.statistics.totalServers++;
      this.updateRunningServerCount();
      
      // Initialize load balancer weight
      if (this.loadBalancer.enabled) {
        this.loadBalancer.serverWeights.set(serverId, config.weight || 1);
        this.loadBalancer.requestCounts.set(serverId, 0);
      }
      
      this.emit('server-started', {
        serverId,
        pid: serverProcess.process?.pid
      });
      
      return serverProcess;
      
    } catch (error) {
      this.statistics.failedServers++;
      
      this.emit('server-start-failed', {
        serverId,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Stop a specific server
   */
  async stopServer(serverId, options = {}) {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }
    
    this.emit('server-stop-requested', { serverId });
    
    try {
      // Unregister from health checker
      this.healthChecker.unregisterServer(serverId);
      
      // Stop the server
      await server.stop(options.force);
      
      // Remove from load balancer
      if (this.loadBalancer.enabled) {
        this.loadBalancer.serverWeights.delete(serverId);
        this.loadBalancer.requestCounts.delete(serverId);
      }
      
      // Remove from active servers
      this.servers.delete(serverId);
      
      this.updateRunningServerCount();
      
      this.emit('server-stopped', { serverId });
      
    } catch (error) {
      this.emit('server-stop-failed', {
        serverId,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Restart a specific server
   */
  async restartServer(serverId, options = {}) {
    this.emit('server-restart-requested', { serverId });
    
    await this.stopServer(serverId, options);
    
    // Wait briefly before restarting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return this.startServer(serverId, options);
  }

  /**
   * Stop all servers
   */
  async stopAllServers(options = {}) {
    const { force = false, timeout = this.options.shutdownTimeout } = options;
    
    this.emit('info', 'Stopping all servers');
    
    const stopPromises = Array.from(this.servers.keys()).map(serverId =>
      this.stopServer(serverId, { force }).catch(error =>
        this.emit('warning', `Failed to stop server ${serverId}: ${error.message}`)
      )
    );
    
    // Wait for all servers to stop or timeout
    await Promise.race([
      Promise.allSettled(stopPromises),
      new Promise(resolve => setTimeout(resolve, timeout))
    ]);
    
    // Force stop any remaining servers
    if (!force && this.servers.size > 0) {
      this.emit('warning', `Force stopping ${this.servers.size} remaining servers`);
      const forceStopPromises = Array.from(this.servers.keys()).map(serverId =>
        this.stopServer(serverId, { force: true }).catch(() => {})
      );
      await Promise.allSettled(forceStopPromises);
    }
    
    this.emit('all-servers-stopped');
  }

  /**
   * Get server by ID
   */
  getServer(serverId) {
    return this.servers.get(serverId);
  }

  /**
   * Get all running servers
   */
  getRunningServers() {
    return Array.from(this.servers.values())
      .filter(server => server.status === 'running');
  }

  /**
   * Get servers that provide a specific tool
   */
  getServersWithTool(toolName) {
    return Array.from(this.servers.values())
      .filter(server => server.haseTool(toolName));
  }

  /**
   * Execute a tool call with load balancing
   */
  async executeToolCall(toolName, arguments_, options = {}) {
    const availableServers = this.getServersWithTool(toolName);
    
    if (availableServers.length === 0) {
      throw new Error(`No servers available for tool: ${toolName}`);
    }
    
    // Select server based on load balancing strategy
    const selectedServer = this.selectServerForRequest(availableServers, options);
    
    try {
      this.statistics.totalRequests++;
      
      // Track request count for load balancing
      if (this.loadBalancer.enabled) {
        const count = this.loadBalancer.requestCounts.get(selectedServer.serverId) || 0;
        this.loadBalancer.requestCounts.set(selectedServer.serverId, count + 1);
      }
      
      const result = await selectedServer.callTool(toolName, arguments_);
      
      this.emit('tool-call-completed', {
        serverId: selectedServer.serverId,
        toolName,
        success: true
      });
      
      return result;
      
    } catch (error) {
      this.statistics.totalErrors++;
      
      this.emit('tool-call-failed', {
        serverId: selectedServer.serverId,
        toolName,
        error: error.message
      });
      
      // Try another server if available and enabled
      if (options.retry !== false && availableServers.length > 1) {
        const otherServers = availableServers.filter(s => s !== selectedServer);
        if (otherServers.length > 0) {
          this.emit('info', `Retrying tool call on different server`);
          return this.executeToolCall(toolName, arguments_, { 
            ...options, 
            retry: false 
          });
        }
      }
      
      throw error;
    }
  }

  /**
   * Select server for a request based on load balancing strategy
   */
  selectServerForRequest(availableServers, options = {}) {
    if (!this.loadBalancer.enabled || availableServers.length === 1) {
      return availableServers[0];
    }
    
    const strategy = options.strategy || 'round_robin';
    
    switch (strategy) {
      case 'round_robin':
        return this.selectServerRoundRobin(availableServers);
      case 'least_requests':
        return this.selectServerLeastRequests(availableServers);
      case 'weighted':
        return this.selectServerWeighted(availableServers);
      case 'random':
        return availableServers[Math.floor(Math.random() * availableServers.length)];
      default:
        return availableServers[0];
    }
  }

  /**
   * Round robin server selection
   */
  selectServerRoundRobin(availableServers) {
    const server = availableServers[this.loadBalancer.roundRobinIndex % availableServers.length];
    this.loadBalancer.roundRobinIndex++;
    return server;
  }

  /**
   * Least requests server selection
   */
  selectServerLeastRequests(availableServers) {
    return availableServers.reduce((least, current) => {
      const leastCount = this.loadBalancer.requestCounts.get(least.serverId) || 0;
      const currentCount = this.loadBalancer.requestCounts.get(current.serverId) || 0;
      return currentCount < leastCount ? current : least;
    });
  }

  /**
   * Weighted server selection
   */
  selectServerWeighted(availableServers) {
    const totalWeight = availableServers.reduce((sum, server) => {
      return sum + (this.loadBalancer.serverWeights.get(server.serverId) || 1);
    }, 0);
    
    let random = Math.random() * totalWeight;
    
    for (const server of availableServers) {
      const weight = this.loadBalancer.serverWeights.get(server.serverId) || 1;
      random -= weight;
      if (random <= 0) {
        return server;
      }
    }
    
    return availableServers[0]; // Fallback
  }

  /**
   * Get all available tools across all servers
   */
  getAllAvailableTools() {
    const toolsMap = new Map();
    
    for (const server of this.servers.values()) {
      if (server.status === 'running') {
        for (const tool of server.getAvailableTools()) {
          if (!toolsMap.has(tool.name)) {
            toolsMap.set(tool.name, {
              ...tool,
              availableOn: []
            });
          }
          toolsMap.get(tool.name).availableOn.push(server.serverId);
        }
      }
    }
    
    return Array.from(toolsMap.values());
  }

  /**
   * Get comprehensive server statistics
   */
  getStatistics() {
    const serverStats = Array.from(this.servers.values()).map(server => server.getStatus());
    
    return {
      global: {
        ...this.statistics,
        uptime: this.statistics.startTime ? Date.now() - this.statistics.startTime : 0,
        runningServers: this.getRunningServerCount()
      },
      servers: serverStats,
      loadBalancer: this.loadBalancer.enabled ? {
        strategy: 'multiple',
        serverWeights: Object.fromEntries(this.loadBalancer.serverWeights),
        requestCounts: Object.fromEntries(this.loadBalancer.requestCounts)
      } : null,
      health: this.healthChecker.getGlobalStatistics()
    };
  }

  /**
   * Set up event handling
   */
  setupEventHandling() {
    // Forward health checker events
    this.healthChecker.on('alert-created', (alert) => {
      this.emit('health-alert', alert);
    });
    
    this.healthChecker.on('remediation-success', (info) => {
      this.emit('auto-remediation', info);
    });
    
    // Forward config manager events
    this.configManager.on('config-changed', async (info) => {
      await this.handleConfigChange(info);
    });
  }

  /**
   * Set up event listeners for a server process
   */
  setupServerEventListeners(serverProcess) {
    const serverId = serverProcess.serverId;
    
    serverProcess.on('started', () => {
      this.updateRunningServerCount();
      this.emit('server-status-changed', { serverId, status: 'running' });
    });
    
    serverProcess.on('stopped', () => {
      this.updateRunningServerCount();
      this.emit('server-status-changed', { serverId, status: 'stopped' });
    });
    
    serverProcess.on('restarted', () => {
      this.emit('server-status-changed', { serverId, status: 'restarted' });
    });
    
    serverProcess.on('process-error', (info) => {
      this.emit('server-error', { serverId, ...info });
    });
  }

  /**
   * Handle configuration changes
   */
  async handleConfigChange(changeInfo) {
    const { serverId, changeType } = changeInfo;
    
    switch (changeType) {
      case 'server-added':
        this.serverConfigs.set(serverId, changeInfo.config);
        if (changeInfo.config.enabled && this.options.autoStart) {
          await this.startServer(serverId);
        }
        break;
        
      case 'server-updated':
        this.serverConfigs.set(serverId, changeInfo.config);
        if (this.servers.has(serverId)) {
          // Restart server to apply new config
          await this.restartServer(serverId);
        }
        break;
        
      case 'server-removed':
        if (this.servers.has(serverId)) {
          await this.stopServer(serverId);
        }
        this.serverConfigs.delete(serverId);
        break;
    }
    
    this.emit('config-change-applied', changeInfo);
  }

  /**
   * Update running server count
   */
  updateRunningServerCount() {
    this.statistics.runningServers = Array.from(this.servers.values())
      .filter(server => server.status === 'running').length;
  }

  /**
   * Get running server count
   */
  getRunningServerCount() {
    return this.statistics.runningServers;
  }

  /**
   * Chunk array into smaller arrays
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Add server configuration
   */
  async addServerConfig(config) {
    await this.configManager.saveServerConfig(config);
    // Config change will be handled by event listener
  }

  /**
   * Update server configuration
   */
  async updateServerConfig(serverId, updates) {
    const config = this.serverConfigs.get(serverId);
    if (!config) {
      throw new Error(`Server configuration not found: ${serverId}`);
    }
    
    const updatedConfig = { ...config, ...updates };
    await this.configManager.saveServerConfig(updatedConfig);
  }

  /**
   * Remove server configuration
   */
  async removeServerConfig(serverId) {
    await this.configManager.deleteServerConfig(serverId);
  }

  /**
   * Shutdown the server manager
   */
  async shutdown() {
    this.emit('info', 'Shutting down MCP Server Manager');
    
    // Stop health checker
    this.healthChecker.stop();
    
    // Stop all servers
    await this.stopAllServers({ force: true });
    
    // Cleanup resources
    this.servers.clear();
    this.serverConfigs.clear();
    
    this.emit('shutdown-complete');
  }
}