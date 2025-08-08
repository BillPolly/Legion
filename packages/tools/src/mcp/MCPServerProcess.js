/**
 * MCPServerProcess - Manages individual MCP server processes
 * 
 * Handles:
 * - Starting/stopping MCP server processes
 * - Communication via stdio
 * - Process monitoring and health checks
 * - Automatic restarts on failure
 * - Resource management (memory, CPU limits)
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export class MCPServerProcess extends EventEmitter {
  constructor(serverConfig, options = {}) {
    super();
    
    this.config = serverConfig;
    this.serverId = serverConfig.serverId;
    this.name = serverConfig.name || this.serverId;
    
    // Process options
    this.options = {
      autoRestart: options.autoRestart !== false,
      maxRestarts: options.maxRestarts || 5,
      restartDelay: options.restartDelay || 1000,
      healthCheckInterval: options.healthCheckInterval || 30000,
      requestTimeout: options.requestTimeout || 30000,
      maxMemory: options.maxMemory || null, // MB
      maxCpu: options.maxCpu || null, // %
      ...options
    };
    
    // State
    this.process = null;
    this.client = null;
    this.transport = null;
    this.status = 'stopped';
    this.restartCount = 0;
    this.lastError = null;
    this.startTime = null;
    this.healthCheckTimer = null;
    this.statistics = {
      startCount: 0,
      crashCount: 0,
      requestCount: 0,
      errorCount: 0,
      lastRequest: null,
      lastError: null
    };
    
    // Tool and resource caches
    this.availableTools = new Map();
    this.availableResources = new Map();
    this.lastToolsUpdate = null;
    this.lastResourcesUpdate = null;
  }

  /**
   * Start the MCP server process
   */
  async start() {
    if (this.status === 'starting' || this.status === 'running') {
      return;
    }
    
    this.emit('info', `Starting MCP server: ${this.name}`);
    this.status = 'starting';
    this.lastError = null;
    
    try {
      // Spawn the process
      await this.spawnProcess();
      
      // Set up MCP client
      await this.setupMCPClient();
      
      // Initialize server capabilities
      await this.initializeCapabilities();
      
      // Start health monitoring
      this.startHealthCheck();
      
      this.status = 'running';
      this.startTime = Date.now();
      this.statistics.startCount++;
      
      this.emit('started', {
        serverId: this.serverId,
        pid: this.process.pid,
        uptime: 0
      });
      
    } catch (error) {
      this.status = 'failed';
      this.lastError = error.message;
      this.statistics.errorCount++;
      
      this.emit('start-failed', {
        serverId: this.serverId,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Stop the MCP server process
   */
  async stop(force = false) {
    if (this.status === 'stopped' || this.status === 'stopping') {
      return;
    }
    
    this.emit('info', `Stopping MCP server: ${this.name}`);
    this.status = 'stopping';
    
    try {
      // Stop health checking
      this.stopHealthCheck();
      
      // Close MCP client
      if (this.client) {
        try {
          await this.client.close();
        } catch (error) {
          this.emit('warning', `Error closing MCP client: ${error.message}`);
        }
        this.client = null;
        this.transport = null;
      }
      
      // Terminate process
      if (this.process) {
        if (force) {
          this.process.kill('SIGKILL');
        } else {
          this.process.kill('SIGTERM');
          
          // Wait for graceful shutdown
          await new Promise((resolve) => {
            const timer = setTimeout(() => {
              if (this.process && !this.process.killed) {
                this.process.kill('SIGKILL');
              }
              resolve();
            }, 5000);
            
            this.process.on('exit', () => {
              clearTimeout(timer);
              resolve();
            });
          });
        }
      }
      
      this.status = 'stopped';
      this.startTime = null;
      
      this.emit('stopped', {
        serverId: this.serverId,
        uptime: this.getUptime()
      });
      
    } catch (error) {
      this.emit('error', `Error stopping server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restart the MCP server process
   */
  async restart() {
    this.emit('info', `Restarting MCP server: ${this.name}`);
    
    await this.stop();
    
    // Wait for restart delay
    if (this.options.restartDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.options.restartDelay));
    }
    
    await this.start();
    this.restartCount++;
    
    this.emit('restarted', {
      serverId: this.serverId,
      restartCount: this.restartCount
    });
  }

  /**
   * Spawn the server process
   */
  async spawnProcess() {
    const { command } = this.config;
    
    if (!command) {
      throw new Error('No command configured for server');
    }
    
    this.emit('debug', `Spawning process: ${command.command} ${command.args.join(' ')}`);
    
    this.process = spawn(command.command, command.args, {
      cwd: command.cwd,
      env: command.env || process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Set up process event handlers
    this.process.on('error', (error) => {
      this.handleProcessError(error);
    });
    
    this.process.on('exit', (code, signal) => {
      this.handleProcessExit(code, signal);
    });
    
    // Monitor memory usage if configured
    if (this.options.maxMemory) {
      this.startMemoryMonitoring();
    }
    
    // Wait for process to be ready
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Process startup timeout'));
      }, 10000);
      
      this.process.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      
      // Assume ready if no immediate errors
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 1000);
    });
  }

  /**
   * Set up MCP client for communication
   */
  async setupMCPClient() {
    this.transport = new StdioClientTransport({
      command: this.config.command.command,
      args: this.config.command.args,
      env: this.config.command.env
    });
    
    this.client = new Client(
      {
        name: `legion-client-${this.serverId}`,
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );
    
    await this.client.connect(this.transport);
    
    this.emit('debug', `MCP client connected to ${this.name}`);
  }

  /**
   * Initialize server capabilities
   */
  async initializeCapabilities() {
    try {
      // Get available tools
      await this.updateToolsList();
      
      // Get available resources
      await this.updateResourcesList();
      
      this.emit('capabilities-loaded', {
        serverId: this.serverId,
        toolCount: this.availableTools.size,
        resourceCount: this.availableResources.size
      });
      
    } catch (error) {
      this.emit('warning', `Could not load server capabilities: ${error.message}`);
    }
  }

  /**
   * Update list of available tools
   */
  async updateToolsList() {
    try {
      const response = await this.client.request(
        { method: 'tools/list' },
        this.options.requestTimeout
      );
      
      this.availableTools.clear();
      if (response.tools) {
        for (const tool of response.tools) {
          this.availableTools.set(tool.name, tool);
        }
      }
      
      this.lastToolsUpdate = Date.now();
      
      this.emit('debug', `Updated tools list: ${this.availableTools.size} tools`);
      
    } catch (error) {
      this.emit('warning', `Failed to update tools list: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update list of available resources
   */
  async updateResourcesList() {
    try {
      const response = await this.client.request(
        { method: 'resources/list' },
        this.options.requestTimeout
      );
      
      this.availableResources.clear();
      if (response.resources) {
        for (const resource of response.resources) {
          this.availableResources.set(resource.uri, resource);
        }
      }
      
      this.lastResourcesUpdate = Date.now();
      
      this.emit('debug', `Updated resources list: ${this.availableResources.size} resources`);
      
    } catch (error) {
      this.emit('warning', `Failed to update resources list: ${error.message}`);
    }
  }

  /**
   * Call a tool on the server
   */
  async callTool(toolName, arguments_) {
    if (this.status !== 'running') {
      throw new Error(`Server ${this.name} is not running`);
    }
    
    if (!this.availableTools.has(toolName)) {
      throw new Error(`Tool ${toolName} not available on server ${this.name}`);
    }
    
    this.statistics.requestCount++;
    this.statistics.lastRequest = Date.now();
    
    try {
      const response = await this.client.request({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: arguments_
        }
      }, this.options.requestTimeout);
      
      this.emit('tool-called', {
        serverId: this.serverId,
        toolName,
        success: true
      });
      
      return response;
      
    } catch (error) {
      this.statistics.errorCount++;
      this.statistics.lastError = Date.now();
      
      this.emit('tool-call-failed', {
        serverId: this.serverId,
        toolName,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Get a resource from the server
   */
  async getResource(resourceUri) {
    if (this.status !== 'running') {
      throw new Error(`Server ${this.name} is not running`);
    }
    
    if (!this.availableResources.has(resourceUri)) {
      throw new Error(`Resource ${resourceUri} not available on server ${this.name}`);
    }
    
    try {
      const response = await this.client.request({
        method: 'resources/read',
        params: { uri: resourceUri }
      }, this.options.requestTimeout);
      
      this.emit('resource-read', {
        serverId: this.serverId,
        resourceUri,
        success: true
      });
      
      return response;
      
    } catch (error) {
      this.statistics.errorCount++;
      
      this.emit('resource-read-failed', {
        serverId: this.serverId,
        resourceUri,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Start health checking
   */
  startHealthCheck() {
    if (this.healthCheckTimer) return;
    
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.options.healthCheckInterval);
  }

  /**
   * Stop health checking
   */
  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    if (this.status !== 'running') return;
    
    try {
      // Simple ping to check if server is responsive
      await this.client.request({ method: 'ping' }, 5000);
      
      this.emit('health-check-passed', {
        serverId: this.serverId,
        uptime: this.getUptime()
      });
      
    } catch (error) {
      this.emit('health-check-failed', {
        serverId: this.serverId,
        error: error.message,
        uptime: this.getUptime()
      });
      
      // Consider restarting if enabled
      if (this.options.autoRestart && this.restartCount < this.options.maxRestarts) {
        this.emit('info', `Health check failed, restarting ${this.name}`);
        await this.restart();
      }
    }
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    const checkMemory = () => {
      if (!this.process || this.status !== 'running') return;
      
      // This is a simplified check - in production you'd want more sophisticated monitoring
      try {
        const memoryUsage = process.memoryUsage();
        const memoryMB = memoryUsage.rss / 1024 / 1024;
        
        if (memoryMB > this.options.maxMemory) {
          this.emit('memory-limit-exceeded', {
            serverId: this.serverId,
            memoryUsage: memoryMB,
            limit: this.options.maxMemory
          });
          
          // Restart server
          this.restart();
        }
      } catch (error) {
        // Ignore monitoring errors
      }
    };
    
    setInterval(checkMemory, 10000); // Check every 10 seconds
  }

  /**
   * Handle process errors
   */
  handleProcessError(error) {
    this.lastError = error.message;
    this.statistics.errorCount++;
    
    this.emit('process-error', {
      serverId: this.serverId,
      error: error.message
    });
    
    if (this.options.autoRestart && this.restartCount < this.options.maxRestarts) {
      this.emit('info', `Process error, restarting ${this.name}`);
      this.restart().catch(restartError => {
        this.emit('error', `Restart failed: ${restartError.message}`);
      });
    }
  }

  /**
   * Handle process exit
   */
  handleProcessExit(code, signal) {
    this.statistics.crashCount++;
    this.status = 'stopped';
    
    this.emit('process-exited', {
      serverId: this.serverId,
      exitCode: code,
      signal,
      uptime: this.getUptime()
    });
    
    if (code !== 0 && this.options.autoRestart && this.restartCount < this.options.maxRestarts) {
      this.emit('info', `Process exited with code ${code}, restarting ${this.name}`);
      setTimeout(() => {
        this.restart().catch(error => {
          this.emit('error', `Restart failed: ${error.message}`);
        });
      }, this.options.restartDelay);
    }
  }

  /**
   * Get server uptime in milliseconds
   */
  getUptime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Get server status information
   */
  getStatus() {
    return {
      serverId: this.serverId,
      name: this.name,
      status: this.status,
      pid: this.process?.pid,
      uptime: this.getUptime(),
      restartCount: this.restartCount,
      lastError: this.lastError,
      statistics: { ...this.statistics },
      capabilities: {
        tools: this.availableTools.size,
        resources: this.availableResources.size,
        lastToolsUpdate: this.lastToolsUpdate,
        lastResourcesUpdate: this.lastResourcesUpdate
      }
    };
  }

  /**
   * Get available tools
   */
  getAvailableTools() {
    return Array.from(this.availableTools.values());
  }

  /**
   * Get available resources
   */
  getAvailableResources() {
    return Array.from(this.availableResources.values());
  }

  /**
   * Check if tool is available
   */
  haseTool(toolName) {
    return this.availableTools.has(toolName);
  }

  /**
   * Check if resource is available
   */
  hasResource(resourceUri) {
    return this.availableResources.has(resourceUri);
  }

  /**
   * Update server configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    this.emit('config-updated', {
      serverId: this.serverId,
      config: this.config
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.stop(true);
    this.removeAllListeners();
  }
}