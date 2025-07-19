/**
 * ServerExecutionManager - Real server execution with health monitoring
 * 
 * Provides comprehensive server management including:
 * - Server startup and shutdown
 * - Health monitoring and checks
 * - Log capture and streaming
 * - Performance monitoring
 * - Graceful shutdown procedures
 * - Resource management
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import http from 'http';
import net from 'net';
import { TestLogManager } from '../logging/TestLogManager.js';

/**
 * ServerExecutionManager class for managing server processes
 */
class ServerExecutionManager extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.nodeRunnerConfig = config.nodeRunner || (config.getNodeRunnerConfig ? config.getNodeRunnerConfig() : {});
    this.logManagerConfig = config.logManager || (config.getLogManagerConfig ? config.getLogManagerConfig() : {});
    this.isInitialized = false;
    this.runningServers = new Map();
    this.healthCheckInterval = null;
    this.performanceInterval = null;
    this.logManager = null;
    
    // Performance tracking
    this.metrics = {
      totalServers: 0,
      serversStarted: 0,
      serversStopped: 0,
      serversCrashed: 0,
      healthChecks: 0,
      totalUptime: 0
    };
  }

  /**
   * Initialize the server execution manager
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    this.emit('initializing', { timestamp: Date.now() });

    try {
      // Initialize log manager
      this.logManager = new TestLogManager(this.logManagerConfig);
      await this.logManager.initialize();
      
      // Start health check interval
      this.healthCheckInterval = setInterval(
        () => this.performHealthChecks(),
        this.nodeRunnerConfig.healthCheckInterval
      );
      
      // Start performance monitoring
      this.performanceInterval = setInterval(
        () => this.collectPerformanceMetrics(),
        5000 // Every 5 seconds
      );
      
      this.isInitialized = true;
      this.emit('initialized', { timestamp: Date.now() });
      
    } catch (error) {
      this.emit('initialization-error', { error: error.message, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Start a server process
   */
  async startServer(serverConfig) {
    if (!this.isInitialized) {
      throw new Error('ServerExecutionManager not initialized');
    }

    // Check process limits
    if (this.runningServers.size >= this.nodeRunnerConfig.maxConcurrentProcesses) {
      throw new Error(`Process limit exceeded: ${this.nodeRunnerConfig.maxConcurrentProcesses}`);
    }

    const serverId = randomUUID();
    const startTime = Date.now();

    this.emit('server-starting', { serverId, config: serverConfig, timestamp: startTime });

    try {
      // Create server process
      const childProcess = spawn(serverConfig.command, serverConfig.args || [], {
        cwd: serverConfig.workingDirectory || process.cwd(),
        env: { ...process.env, ...serverConfig.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Create server info
      const serverInfo = {
        serverId,
        name: serverConfig.name,
        config: serverConfig,
        process: childProcess,
        status: 'starting',
        port: serverConfig.port,
        startTime,
        uptime: 0,
        health: {
          status: 'unknown',
          lastCheck: null,
          checks: 0,
          failures: 0
        },
        logs: [],
        metrics: {
          memoryUsage: 0,
          cpuUsage: 0,
          restarts: 0
        }
      };

      // Store server info
      this.runningServers.set(serverId, serverInfo);

      // Set up process event handlers
      this.setupProcessHandlers(serverInfo);

      // Set up log capture
      if (serverConfig.logCapture?.enabled) {
        await this.setupLogCapture(serverInfo);
      }

      // Update metrics
      this.metrics.totalServers++;
      this.metrics.serversStarted++;

      // Wait a bit for process to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if process is still running
      if (childProcess.killed || childProcess.exitCode !== null) {
        this.runningServers.delete(serverId);
        throw new Error(`Server process failed to start: ${serverConfig.name}`);
      }

      serverInfo.status = 'running';
      this.emit('server-started', { serverId, timestamp: Date.now() });

      return {
        serverId,
        status: 'starting',
        port: serverConfig.port,
        startTime,
        name: serverConfig.name
      };

    } catch (error) {
      this.emit('server-start-failed', { serverId, error: error.message, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Stop a server process
   */
  async stopServer(serverId) {
    const serverInfo = this.runningServers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server not found: ${serverId}`);
    }

    this.emit('server-stopping', { serverId, timestamp: Date.now() });

    try {
      // Perform graceful shutdown
      const shutdownResult = await this.gracefulShutdown(serverId);
      
      // Remove from running servers
      this.runningServers.delete(serverId);
      
      // Update metrics
      this.metrics.serversStopped++;
      this.metrics.totalUptime += Date.now() - serverInfo.startTime;

      this.emit('server-stopped', { serverId, timestamp: Date.now() });

      return {
        serverId,
        status: 'stopped',
        graceful: shutdownResult.graceful,
        uptime: Date.now() - serverInfo.startTime
      };

    } catch (error) {
      this.emit('server-stop-failed', { serverId, error: error.message, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Restart a server process
   */
  async restartServer(serverId) {
    const serverInfo = this.runningServers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server not found: ${serverId}`);
    }

    this.emit('server-restarting', { serverId, timestamp: Date.now() });

    try {
      const config = serverInfo.config;
      
      // Stop the server
      await this.stopServer(serverId);
      
      // Start it again with the same configuration
      const startResult = await this.startServer(config);
      
      // Update server ID to maintain continuity
      const newServerInfo = this.runningServers.get(startResult.serverId);
      if (newServerInfo) {
        newServerInfo.serverId = serverId;
        newServerInfo.metrics.restarts++;
        this.runningServers.set(serverId, newServerInfo);
        this.runningServers.delete(startResult.serverId);
      }

      this.emit('server-restarted', { serverId, timestamp: Date.now() });

      return {
        serverId,
        status: 'starting',
        port: config.port,
        startTime: Date.now(),
        name: config.name
      };

    } catch (error) {
      this.emit('server-restart-failed', { serverId, error: error.message, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Get server status
   */
  async getServerStatus(serverId) {
    const serverInfo = this.runningServers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server not found: ${serverId}`);
    }

    return {
      serverId,
      name: serverInfo.name,
      status: serverInfo.status,
      port: serverInfo.port,
      uptime: Date.now() - serverInfo.startTime,
      health: serverInfo.health,
      metrics: serverInfo.metrics
    };
  }

  /**
   * List all running servers
   */
  listServers() {
    return Array.from(this.runningServers.values()).map(serverInfo => ({
      serverId: serverInfo.serverId,
      name: serverInfo.name,
      status: serverInfo.status,
      port: serverInfo.port,
      uptime: Date.now() - serverInfo.startTime,
      health: serverInfo.health.status
    }));
  }

  /**
   * Get server health status
   */
  async getServerHealth(serverId) {
    const serverInfo = this.runningServers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server not found: ${serverId}`);
    }

    return {
      serverId,
      status: serverInfo.health.status,
      lastCheck: serverInfo.health.lastCheck,
      checks: serverInfo.health.checks,
      failures: serverInfo.health.failures
    };
  }

  /**
   * Get server logs
   */
  async getServerLogs(serverId, options = {}) {
    const serverInfo = this.runningServers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server not found: ${serverId}`);
    }

    // Get logs from log manager
    if (this.logManager) {
      return await this.logManager.getLogsByProcess(serverInfo.process.pid);
    }

    return { logs: serverInfo.logs, processId: serverInfo.process.pid };
  }

  /**
   * Subscribe to server log stream
   */
  subscribeToLogs(serverId, callback) {
    const serverInfo = this.runningServers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server not found: ${serverId}`);
    }

    // Enable streaming for this server
    if (this.logManager) {
      this.logManager.enableStreaming(callback);
    }
  }

  /**
   * Get server performance metrics
   */
  async getServerMetrics(serverId) {
    const serverInfo = this.runningServers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server not found: ${serverId}`);
    }

    return {
      serverId,
      uptime: Date.now() - serverInfo.startTime,
      memoryUsage: serverInfo.metrics.memoryUsage,
      cpuUsage: serverInfo.metrics.cpuUsage,
      restarts: serverInfo.metrics.restarts
    };
  }

  /**
   * Get overall performance statistics
   */
  async getPerformanceStats() {
    const runningServers = Array.from(this.runningServers.values());
    
    return {
      totalServers: this.metrics.totalServers,
      runningServers: runningServers.length,
      serversStarted: this.metrics.serversStarted,
      serversStopped: this.metrics.serversStopped,
      serversCrashed: this.metrics.serversCrashed,
      averageUptime: this.metrics.totalUptime / Math.max(this.metrics.serversStopped, 1),
      totalMemoryUsage: runningServers.reduce((sum, s) => sum + s.metrics.memoryUsage, 0),
      healthChecks: this.metrics.healthChecks
    };
  }

  /**
   * Perform graceful shutdown
   */
  async gracefulShutdown(serverId) {
    const serverInfo = this.runningServers.get(serverId);
    if (!serverInfo) {
      throw new Error(`Server not found: ${serverId}`);
    }

    const childProcess = serverInfo.process;
    
    try {
      // Send SIGTERM for graceful shutdown
      childProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      const shutdownPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          // Force kill if graceful shutdown fails
          childProcess.kill('SIGKILL');
          resolve({ graceful: false });
        }, this.nodeRunnerConfig.shutdownTimeout);
        
        childProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve({ graceful: true });
        });
      });
      
      const result = await shutdownPromise;
      
      return {
        serverId,
        status: 'shutdown',
        graceful: result.graceful,
        timestamp: Date.now()
      };
      
    } catch (error) {
      return {
        serverId,
        status: 'shutdown',
        graceful: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Set up process event handlers
   */
  setupProcessHandlers(serverInfo) {
    const { process: childProcess, serverId } = serverInfo;

    childProcess.on('exit', (code, signal) => {
      serverInfo.status = 'stopped';
      
      if (code !== 0) {
        this.metrics.serversCrashed++;
        this.emit('server-crashed', { 
          serverId, 
          exitCode: code, 
          signal, 
          timestamp: Date.now() 
        });
      }
      
      this.emit('server-exited', { serverId, exitCode: code, signal, timestamp: Date.now() });
    });

    childProcess.on('error', (error) => {
      serverInfo.status = 'error';
      this.emit('server-error', { serverId, error: error.message, timestamp: Date.now() });
    });

    childProcess.stdout.on('data', (data) => {
      const log = {
        timestamp: Date.now(),
        level: 'info',
        source: 'stdout',
        message: data.toString().trim()
      };
      serverInfo.logs.push(log);
      this.emit('server-log', { serverId, log });
    });

    childProcess.stderr.on('data', (data) => {
      const log = {
        timestamp: Date.now(),
        level: 'error',
        source: 'stderr',
        message: data.toString().trim()
      };
      serverInfo.logs.push(log);
      this.emit('server-log', { serverId, log });
    });
  }

  /**
   * Set up log capture
   */
  async setupLogCapture(serverInfo) {
    if (!this.logManager) {
      return;
    }

    try {
      await this.logManager.attachToProcess(serverInfo.process);
    } catch (error) {
      this.emit('log-capture-error', { 
        serverId: serverInfo.serverId, 
        error: error.message, 
        timestamp: Date.now() 
      });
    }
  }

  /**
   * Perform health checks on all servers
   */
  async performHealthChecks() {
    const servers = Array.from(this.runningServers.values());
    
    for (const serverInfo of servers) {
      if (serverInfo.config.healthCheck?.enabled) {
        await this.performHealthCheck(serverInfo);
      }
    }
  }

  /**
   * Perform health check on a specific server
   */
  async performHealthCheck(serverInfo) {
    const { serverId, config } = serverInfo;
    const healthCheck = config.healthCheck;
    
    try {
      const startTime = Date.now();
      
      // Simple TCP connection check if no specific path provided
      if (!healthCheck.path) {
        const result = await this.checkTCPConnection(config.port, healthCheck.timeout || 5000);
        this.updateHealthStatus(serverInfo, result.healthy, startTime);
        return;
      }
      
      // HTTP health check
      const options = {
        hostname: 'localhost',
        port: config.port,
        path: healthCheck.path,
        method: 'GET',
        timeout: healthCheck.timeout || 5000
      };
      
      const healthy = await this.performHTTPHealthCheck(options);
      this.updateHealthStatus(serverInfo, healthy, startTime);
      
    } catch (error) {
      this.updateHealthStatus(serverInfo, false, Date.now());
      this.emit('health-check-failed', { 
        serverId, 
        error: error.message, 
        timestamp: Date.now() 
      });
    }
  }

  /**
   * Check TCP connection
   */
  async checkTCPConnection(port, timeout) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ healthy: false });
      }, timeout);
      
      socket.connect(port, 'localhost', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ healthy: true });
      });
      
      socket.on('error', () => {
        clearTimeout(timer);
        resolve({ healthy: false });
      });
    });
  }

  /**
   * Perform HTTP health check
   */
  async performHTTPHealthCheck(options) {
    return new Promise((resolve) => {
      const req = http.request(options, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });
      
      req.on('error', () => {
        resolve(false);
      });
      
      req.setTimeout(options.timeout, () => {
        req.destroy();
        resolve(false);
      });
      
      req.end();
    });
  }

  /**
   * Update health status
   */
  updateHealthStatus(serverInfo, healthy, checkTime) {
    serverInfo.health.lastCheck = checkTime;
    serverInfo.health.checks++;
    
    if (healthy) {
      serverInfo.health.status = 'healthy';
    } else {
      serverInfo.health.status = 'unhealthy';
      serverInfo.health.failures++;
    }
    
    this.metrics.healthChecks++;
    
    this.emit('health-check-completed', {
      serverId: serverInfo.serverId,
      healthy,
      timestamp: checkTime
    });
  }

  /**
   * Collect performance metrics
   */
  async collectPerformanceMetrics() {
    const servers = Array.from(this.runningServers.values());
    
    for (const serverInfo of servers) {
      if (serverInfo.config.monitoring?.enabled) {
        await this.collectServerMetrics(serverInfo);
      }
    }
  }

  /**
   * Collect metrics for a specific server
   */
  async collectServerMetrics(serverInfo) {
    try {
      const childProcess = serverInfo.process;
      
      // Get process memory usage
      if (childProcess.pid) {
        const memoryUsage = childProcess.memoryUsage?.() || { heapUsed: 0 };
        serverInfo.metrics.memoryUsage = memoryUsage.heapUsed / 1024 / 1024; // MB
      }
      
      // Update uptime
      serverInfo.uptime = Date.now() - serverInfo.startTime;
      
    } catch (error) {
      this.emit('metrics-collection-error', { 
        serverId: serverInfo.serverId, 
        error: error.message, 
        timestamp: Date.now() 
      });
    }
  }

  /**
   * Cleanup all resources
   */
  async cleanup() {
    this.emit('cleanup-started', { timestamp: Date.now() });

    try {
      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      if (this.performanceInterval) {
        clearInterval(this.performanceInterval);
        this.performanceInterval = null;
      }
      
      // Stop all running servers
      const serverIds = Array.from(this.runningServers.keys());
      for (const serverId of serverIds) {
        try {
          await this.stopServer(serverId);
        } catch (error) {
          // Continue cleanup even if individual server stop fails
        }
      }
      
      // Cleanup log manager
      if (this.logManager) {
        await this.logManager.cleanup();
      }
      
      // Clear state
      this.runningServers.clear();
      this.isInitialized = false;
      
      this.emit('cleanup-complete', { timestamp: Date.now() });
      
    } catch (error) {
      this.emit('cleanup-error', { error: error.message, timestamp: Date.now() });
    }
  }
}

export { ServerExecutionManager };