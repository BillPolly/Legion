import { ProcessManager } from './ProcessManager.js';
import detectPort from 'detect-port';
import http from 'http';
import https from 'https';
import { killProcessesOnPort } from './utils/ports.js';

/**
 * Manages web servers and development servers
 */
export class ServerManager {
  constructor(processManager) {
    this.processManager = processManager || new ProcessManager();
    this.servers = new Map();
  }

  /**
   * Find available port
   */
  async findAvailablePort(preferredPort = 3000) {
    try {
      const port = await detectPort(preferredPort);
      return port;
    } catch (error) {
      throw new Error(`Failed to find available port: ${error.message}`);
    }
  }

  /**
   * Start a web server
   */
  async startWebServer(command, options = {}) {
    const {
      port = 3000,
      host = 'localhost',
      healthCheck = true,
      healthCheckPath = '/health',
      healthCheckInterval = 5000,
      healthCheckTimeout = 30000,
      env = {},
      killExisting = false,
      ...processOptions
    } = options;

    // Kill existing processes on the port if requested
    if (killExisting && port !== 0) {
      console.log(`Killing any existing processes on port ${port}...`);
      const killResult = await killProcessesOnPort(port, { 
        force: false, 
        silent: false 
      });
      
      if (killResult.total > 0) {
        console.log(`Killed ${killResult.killed} of ${killResult.total} processes on port ${port}`);
        
        // Wait a moment for port to be fully released
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Determine which port to use
    let availablePort;
    if (killExisting && port !== 0) {
      // If killExisting is true, use the exact port (we just killed anything on it)
      availablePort = port;
    } else if (port === 0) {
      // Port 0 means find any available port
      availablePort = await this.findAvailablePort(3000);
    } else {
      // Check if the requested port is available
      availablePort = await this.findAvailablePort(port);
      if (availablePort !== port) {
        if (options.strictPort) {
          throw new Error(`Port ${port} is already in use`);
        }
        console.warn(`Port ${port} is in use, using ${availablePort} instead`);
      }
    }

    // Parse command if it's a string
    let processCommand, args;
    if (typeof command === 'string') {
      const parts = command.split(' ');
      processCommand = parts[0];
      args = parts.slice(1);
    } else {
      processCommand = command.command || command;
      args = command.args || [];
    }

    // Start the process with PORT env variable
    const result = await this.processManager.startProcess(processCommand, args, {
      ...processOptions,
      env: {
        PORT: availablePort,
        HOST: host,
        ...env
      }
    });

    const serverInfo = {
      ...result,
      type: 'web-server',
      port: availablePort,
      host,
      url: `http://${host}:${availablePort}`,
      healthCheck: {
        enabled: healthCheck,
        path: healthCheckPath,
        interval: healthCheckInterval,
        status: 'pending',
        lastCheck: null
      }
    };

    this.servers.set(result.id, serverInfo);

    // Start health check if enabled
    if (healthCheck) {
      await this.waitForServerReady(result.id, healthCheckTimeout);
      this.startHealthCheck(result.id);
    }

    return serverInfo;
  }

  /**
   * Start a development server with hot reload support
   */
  async startDevelopmentServer(command, options = {}) {
    const {
      framework = 'auto', // auto-detect from package.json
      ...serverOptions
    } = options;

    // Add development-specific environment variables
    const devEnv = {
      NODE_ENV: 'development',
      ...serverOptions.env
    };

    // Detect framework and adjust command if needed
    let finalCommand = command;
    if (framework === 'auto') {
      // This would detect framework from package.json
      // For now, just use the provided command
      finalCommand = command;
    }

    const result = await this.startWebServer(finalCommand, {
      ...serverOptions,
      env: devEnv
    });

    return {
      ...result,
      type: 'development-server',
      framework
    };
  }

  /**
   * Wait for server to be ready
   */
  async waitForServerReady(serverId, timeout = 30000) {
    const serverInfo = this.servers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server ${serverId} not found`);
    }

    const { url, healthCheck } = serverInfo;
    const checkUrl = healthCheck.enabled 
      ? `${url}${healthCheck.path}`
      : url;

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await this.checkHealth(checkUrl);
        serverInfo.healthCheck.status = 'healthy';
        serverInfo.healthCheck.lastCheck = new Date();
        return true;
      } catch (error) {
        // Server not ready yet
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Server did not become ready within ${timeout}ms`);
  }

  /**
   * Check server health
   */
  async checkServerHealth(serverId) {
    const serverInfo = this.servers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server ${serverId} not found`);
    }

    const { url, healthCheck } = serverInfo;
    const checkUrl = healthCheck.enabled 
      ? `${url}${healthCheck.path}`
      : url;

    try {
      const response = await this.checkHealth(checkUrl);
      
      const healthStatus = {
        status: 'healthy',
        statusCode: response.statusCode,
        responseTime: response.responseTime,
        lastCheck: new Date()
      };

      serverInfo.healthCheck = { ...serverInfo.healthCheck, ...healthStatus };
      
      return {
        id: serverId,
        url: serverInfo.url,
        ...healthStatus
      };
    } catch (error) {
      const healthStatus = {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date()
      };

      serverInfo.healthCheck = { ...serverInfo.healthCheck, ...healthStatus };
      
      return {
        id: serverId,
        url: serverInfo.url,
        ...healthStatus
      };
    }
  }

  /**
   * Perform HTTP health check
   */
  async checkHealth(url, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const req = client.get(url, { timeout }, (res) => {
        const responseTime = Date.now() - startTime;
        
        // Consume response data
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              responseTime
            });
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
    });
  }

  /**
   * Start periodic health checks
   */
  startHealthCheck(serverId) {
    const serverInfo = this.servers.get(serverId);
    if (!serverInfo || !serverInfo.healthCheck.enabled) {
      return;
    }

    // Clear existing interval if any
    if (serverInfo.healthCheckInterval) {
      clearInterval(serverInfo.healthCheckInterval);
    }

    // Set up periodic health check
    serverInfo.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkServerHealth(serverId);
      } catch (error) {
        console.error(`Health check failed for ${serverId}:`, error.message);
      }
    }, serverInfo.healthCheck.interval);
  }

  /**
   * Stop health checks
   */
  stopHealthCheck(serverId) {
    const serverInfo = this.servers.get(serverId);
    if (serverInfo && serverInfo.healthCheckInterval) {
      clearInterval(serverInfo.healthCheckInterval);
      delete serverInfo.healthCheckInterval;
    }
  }

  /**
   * Stop a server
   */
  async stopServer(serverId, options = {}) {
    const serverInfo = this.servers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server ${serverId} not found`);
    }

    // Stop health checks
    this.stopHealthCheck(serverId);

    // Stop the process
    const result = await this.processManager.stopProcess(serverId, options);

    // Remove from servers map
    this.servers.delete(serverId);

    return result;
  }

  /**
   * Restart a server
   */
  async restartServer(serverId, newOptions = {}) {
    const serverInfo = this.servers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server ${serverId} not found`);
    }

    // Stop health checks
    this.stopHealthCheck(serverId);

    // Get original configuration
    const { port, host, healthCheck, ...originalOptions } = serverInfo;
    const mergedOptions = {
      port,
      host,
      healthCheck: healthCheck.enabled,
      healthCheckPath: healthCheck.path,
      healthCheckInterval: healthCheck.interval,
      ...originalOptions,
      ...newOptions
    };

    // Restart the process
    const result = await this.processManager.restartProcess(serverId, mergedOptions);

    // Update server info
    serverInfo.startTime = result.startTime;
    serverInfo.pid = result.pid;
    serverInfo.status = result.status;

    // Restart health checks if enabled
    if (healthCheck.enabled) {
      await this.waitForServerReady(serverId);
      this.startHealthCheck(serverId);
    }

    return serverInfo;
  }

  /**
   * Get server information
   */
  getServer(serverId) {
    const serverInfo = this.servers.get(serverId);
    if (!serverInfo) {
      return null;
    }

    const processInfo = this.processManager.getProcess(serverId);
    return {
      ...serverInfo,
      ...processInfo
    };
  }

  /**
   * List all servers
   */
  listServers() {
    const servers = [];
    
    for (const [id, serverInfo] of this.servers) {
      const processInfo = this.processManager.getProcess(id);
      servers.push({
        ...serverInfo,
        ...processInfo
      });
    }

    return servers;
  }

  /**
   * Create a proxy server
   */
  async createProxyServer(targetUrl, options = {}) {
    const {
      port = 3000,
      host = 'localhost',
      changeOrigin = true,
      ...serverOptions
    } = options;

    // This would create a proxy using http-proxy or similar
    // For now, return a placeholder
    return {
      type: 'proxy',
      targetUrl,
      port,
      host,
      url: `http://${host}:${port}`,
      message: 'Proxy server creation not yet implemented'
    };
  }

  /**
   * Cleanup all servers
   */
  async cleanup() {
    // Stop all health checks
    for (const serverId of this.servers.keys()) {
      this.stopHealthCheck(serverId);
    }

    // Clean up processes
    await this.processManager.cleanup();

    // Clear servers map
    this.servers.clear();
  }
}