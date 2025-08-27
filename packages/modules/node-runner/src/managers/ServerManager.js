/**
 * @fileoverview ServerManager - Manages web server lifecycle and health monitoring
 */

import { EventEmitter } from 'events';
import { generateId } from '../utils/index.js';
import net from 'net';
import http from 'http';

export class ServerManager extends EventEmitter {
  constructor(processManager, logStorage) {
    super();
    this.processManager = processManager;
    this.logStorage = logStorage;
    this.servers = new Map();
    this.usedPorts = new Set();
    
    // Listen for process exit events
    if (this.processManager && this.processManager.on) {
      this.processManager.on('processExit', ({ processId, exitCode }) => {
        this.handleProcessExit(processId, exitCode);
      });
    }
  }

  /**
   * Register a new server
   * @param {string} serverId - Unique server identifier
   * @param {Object} metadata - Server metadata
   */
  registerServer(serverId, metadata) {
    if (this.servers.has(serverId)) {
      throw new Error('Server already registered: ' + serverId);
    }
    
    const server = {
      serverId,
      ...metadata,
      status: 'starting',
      startTime: new Date(),
      statusHistory: [{ status: 'starting', timestamp: new Date() }]
    };
    
    this.servers.set(serverId, server);
    
    if (metadata.port) {
      this.usedPorts.add(metadata.port);
    }
    
    return server;
  }

  /**
   * Unregister a server
   * @param {string} serverId - Server identifier
   */
  unregisterServer(serverId) {
    const server = this.servers.get(serverId);
    if (server) {
      if (server.port) {
        this.usedPorts.delete(server.port);
      }
      this.servers.delete(serverId);
    }
  }

  /**
   * Get server by ID
   * @param {string} serverId - Server identifier
   * @returns {Object|undefined} Server information
   */
  getServer(serverId) {
    return this.servers.get(serverId);
  }

  /**
   * Find available port starting from a base port
   * @param {number} basePort - Starting port number
   * @returns {Promise<number>} Available port
   */
  async findAvailablePort(basePort = 3000) {
    let port = basePort;
    
    while (this.usedPorts.has(port) || !(await this.isPortAvailable(port))) {
      port++;
      if (port > 65535) {
        throw new Error('No available ports');
      }
    }
    
    return port;
  }

  /**
   * Check if a port is available
   * @param {number} port - Port to check
   * @returns {Promise<boolean>} True if available
   */
  async isPortAvailable(port) {
    if (this.usedPorts.has(port)) {
      return false;
    }
    
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', () => {
        resolve(false);
      });
      
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      
      server.listen(port);
    });
  }

  /**
   * Check if a port is in use (opposite of available)
   * @param {number} port - Port to check
   * @returns {Promise<boolean>} True if in use
   */
  async isPortInUse(port) {
    return !(await this.isPortAvailable(port));
  }

  /**
   * Allocate a port for a server
   * @param {string} serverId - Server identifier
   * @param {number} requestedPort - Requested port
   * @returns {Promise<number>} Allocated port
   */
  async allocatePort(serverId, requestedPort = 3000) {
    if (requestedPort < 1 || requestedPort > 65535) {
      throw new Error('Invalid port number');
    }
    
    const port = await this.findAvailablePort(requestedPort);
    this.usedPorts.add(port);
    
    return port;
  }

  /**
   * Start a web server process
   * @param {Object} options - Server options
   * @returns {Promise<Object>} Server information
   */
  async startWebServer(options) {
    const {
      projectPath,
      command,
      port: requestedPort,
      env = {},
      healthEndpoint = '/health',
      timeout = 30000
    } = options;
    
    try {
      // Allocate port
      const port = requestedPort || await this.findAvailablePort(3000);
      const serverId = generateId('server');
      
      // Register server before starting
      this.registerServer(serverId, {
        port,
        projectPath,
        command,
        healthEndpoint
      });
      
      // Start process with PORT environment variable
      const processOptions = {
        projectPath,
        command,
        env: {
          ...env,
          PORT: String(port)
        }
      };
      
      const { processId } = await this.processManager.startProcess(processOptions);
      
      // Update server with process ID
      const server = this.servers.get(serverId);
      server.processId = processId;
      
      // Emit server started event
      this.emit('serverStarted', {
        serverId,
        port,
        processId,
        projectPath
      });
      
      return {
        serverId,
        port,
        processId,
        projectPath
      };
      
    } catch (error) {
      // Cleanup on failure
      if (this.usedPorts.has(options.port)) {
        this.usedPorts.delete(options.port);
      }
      
      this.emit('error', {
        message: `Failed to start server: ${error.message}`,
        error
      });
      
      throw error;
    }
  }

  /**
   * Wait for server to be ready
   * @param {string} serverId - Server identifier
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} True if server is ready
   */
  async waitForServerReady(serverId, timeout = 30000) {
    const server = this.servers.get(serverId);
    if (!server) {
      return false;
    }
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Check if server status is running
      if (server.status === 'running') {
        return true;
      }
      
      // Check if process has exited
      if (server.processId) {
        const processInfo = this.processManager.getProcessInfo(server.processId);
        if (processInfo && processInfo.status === 'exited') {
          return false;
        }
      }
      
      // Check if port is in use (server is listening)
      if (server.port && await this.isPortInUse(server.port)) {
        this.updateServerStatus(serverId, 'running');
        return true;
      }
      
      // Wait a bit before next check
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
  }

  /**
   * Update server status
   * @param {string} serverId - Server identifier
   * @param {string} status - New status
   */
  updateServerStatus(serverId, status) {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }
    
    const oldStatus = server.status;
    server.status = status;
    server.statusHistory.push({
      status,
      timestamp: new Date()
    });
    
    this.emit('serverStatusChanged', {
      serverId,
      oldStatus,
      newStatus: status
    });
  }

  /**
   * Check server health
   * @param {string} serverId - Server identifier
   * @returns {Promise<Object>} Health check result
   */
  async checkServerHealth(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      return {
        status: 'unknown',
        error: 'Server not found'
      };
    }
    
    try {
      const result = await this.performHealthCheck(
        server.port,
        server.healthEndpoint || '/health'
      );
      
      const health = {
        status: 'healthy',
        lastCheck: new Date(),
        response: result
      };
      
      server.healthCheck = health;
      return health;
      
    } catch (error) {
      const health = {
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error.message
      };
      
      server.healthCheck = health;
      return health;
    }
  }

  /**
   * Perform HTTP health check
   * @param {number} port - Server port
   * @param {string} endpoint - Health endpoint path
   * @returns {Promise<Object>} Health check response
   */
  async performHealthCheck(port, endpoint = '/health') {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port,
        path: endpoint,
        method: 'GET',
        timeout: 5000
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ status: 'ok', statusCode: res.statusCode, data });
          } else {
            reject(new Error(`Health check failed with status ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Health check timeout'));
      });
      
      req.end();
    });
  }

  /**
   * Stop a server
   * @param {string} serverId - Server identifier
   * @returns {Promise<Object>} Stop result
   */
  async stopServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      return {
        success: false,
        error: 'Server not found'
      };
    }
    
    try {
      if (server.processId) {
        await this.processManager.kill(server.processId);
      }
      
      this.unregisterServer(serverId);
      
      this.emit('serverStopped', {
        serverId,
        port: server.port
      });
      
      return {
        success: true,
        serverId,
        port: server.port
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle process exit event
   * @param {string} processId - Process identifier
   * @param {number} exitCode - Exit code
   */
  handleProcessExit(processId, exitCode) {
    // Find server by process ID
    for (const [serverId, server] of this.servers) {
      if (server.processId === processId) {
        this.unregisterServer(serverId);
        
        this.emit('serverExited', {
          serverId,
          processId,
          exitCode
        });
        
        break;
      }
    }
  }

  /**
   * Get all running servers
   * @returns {Array} List of running servers
   */
  getRunningServers() {
    const running = [];
    
    for (const server of this.servers.values()) {
      if (server.status === 'running') {
        running.push(server);
      }
    }
    
    return running;
  }

  /**
   * Find server by port
   * @param {number} port - Port number
   * @returns {Object|undefined} Server information
   */
  findServerByPort(port) {
    for (const server of this.servers.values()) {
      if (server.port === port) {
        return server;
      }
    }
    
    return undefined;
  }

  /**
   * Find server by process ID
   * @param {string} processId - Process identifier
   * @returns {Object|undefined} Server information
   */
  findServerByProcessId(processId) {
    for (const server of this.servers.values()) {
      if (server.processId === processId) {
        return server;
      }
    }
    
    return undefined;
  }

  /**
   * Get server statistics
   * @returns {Object} Server statistics
   */
  getStatistics() {
    const stats = {
      total: this.servers.size,
      running: 0,
      starting: 0,
      unhealthy: 0,
      stopped: 0
    };
    
    for (const server of this.servers.values()) {
      switch (server.status) {
        case 'running':
          stats.running++;
          break;
        case 'starting':
          stats.starting++;
          break;
        case 'unhealthy':
          stats.unhealthy++;
          break;
        case 'stopped':
          stats.stopped++;
          break;
      }
    }
    
    return stats;
  }
}