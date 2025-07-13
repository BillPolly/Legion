import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import net from 'net';

import Resource from '../base/Resource.js';
import { RESOURCE_STATUS } from '../base/ResourceStatus.js';
import HealthChecker from './HealthChecker.js';

/**
 * ProcessResource manages the lifecycle of external processes
 * Handles starting, stopping, monitoring, and health checking of processes
 */
class ProcessResource extends Resource {
  constructor(name, config, dependencies = {}) {
    super(name, config, dependencies);
    
    this.childProcess = null;
    this.startTime = null;
    this.restartCount = 0;
    this.healthChecker = null;
    this.logStreams = new Map();
    this.exitHandlers = new Set();
    
    // Validate required config
    this.validateConfig();
    
    // Initialize health checker
    if (config.healthCheck) {
      this.healthChecker = new HealthChecker(this.name, config.healthCheck);
    }
  }

  /**
   * Validate process configuration
   * @private
   */
  validateConfig() {
    if (!this.config.command) {
      throw new Error(`ProcessResource '${this.name}' requires a command`);
    }

    if (typeof this.config.command !== 'string') {
      throw new Error(`ProcessResource '${this.name}' command must be a string`);
    }

    // Validate health check config if present
    if (this.config.healthCheck) {
      const validTypes = ['tcp', 'http', 'process', 'file', 'log'];
      if (!validTypes.includes(this.config.healthCheck.type)) {
        throw new Error(
          `Invalid health check type '${this.config.healthCheck.type}'. ` +
          `Valid types: ${validTypes.join(', ')}`
        );
      }
    }
  }

  /**
   * Initialize the process resource
   */
  async initialize() {
    this.updateStatus(RESOURCE_STATUS.STARTING);
    
    try {
      // Resolve configuration with dependencies
      const resolvedConfig = this.resolveProcessConfig();
      
      // Start the process
      await this.startProcess(resolvedConfig);
      
      // Wait for process to be ready
      if (this.config.readyCheck) {
        await this.waitForReady();
      }
      
      // Start health monitoring
      if (this.healthChecker) {
        this.healthChecker.start(() => this.healthCheck());
      }
      
      this.updateStatus(RESOURCE_STATUS.RUNNING);
      this.startTime = new Date();
      
    } catch (error) {
      this.updateStatus(RESOURCE_STATUS.ERROR);
      throw new Error(`Failed to initialize process '${this.name}': ${error.message}`);
    }
  }

  /**
   * Resolve process configuration with dependency injection
   * @private
   */
  resolveProcessConfig() {
    return {
      command: this.resolveDependencies(this.config.command),
      args: this.config.args ? this.config.args.map(arg => this.resolveDependencies(arg)) : [],
      env: { 
        ...process.env, 
        ...this.resolveDependencies(this.config.env || {}) 
      },
      cwd: this.config.cwd ? this.resolveDependencies(this.config.cwd) : process.cwd(),
      shell: this.config.shell || false
    };
  }

  /**
   * Start the child process
   * @private
   */
  async startProcess(config) {
    return new Promise((resolve, reject) => {
      try {
        // Spawn the process
        this.childProcess = spawn(config.command, config.args, {
          cwd: config.cwd,
          env: config.env,
          shell: config.shell,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Set up event handlers
        this.setupProcessHandlers();
        
        // Set up logging if configured
        if (this.config.logging) {
          this.setupLogging();
        }

        // Give the process a moment to start
        setTimeout(() => {
          if (this.childProcess && !this.childProcess.killed) {
            resolve();
          } else {
            reject(new Error('Process failed to start'));
          }
        }, 100);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Set up process event handlers
   * @private
   */
  setupProcessHandlers() {
    if (!this.childProcess) return;

    this.childProcess.on('exit', (code, signal) => {
      this.handleProcessExit(code, signal);
    });

    this.childProcess.on('error', (error) => {
      console.error(`Process '${this.name}' error:`, error);
      this.updateStatus(RESOURCE_STATUS.ERROR);
      this.recordHealthCheck(false, `Process error: ${error.message}`);
    });

    // Handle stdout/stderr
    if (this.childProcess.stdout) {
      this.childProcess.stdout.on('data', (data) => {
        this.handleProcessOutput('stdout', data);
      });
    }

    if (this.childProcess.stderr) {
      this.childProcess.stderr.on('data', (data) => {
        this.handleProcessOutput('stderr', data);
      });
    }
  }

  /**
   * Handle process exit
   * @private
   */
  handleProcessExit(code, signal) {
    const wasRunning = this.status === RESOURCE_STATUS.RUNNING;
    
    this.updateStatus(RESOURCE_STATUS.STOPPED);
    this.childProcess = null;
    
    // Stop health monitoring
    if (this.healthChecker) {
      this.healthChecker.stop();
    }

    // Call exit handlers
    for (const handler of this.exitHandlers) {
      try {
        handler(code, signal);
      } catch (error) {
        console.error(`Error in exit handler for '${this.name}':`, error);
      }
    }

    // Handle unexpected exits
    if (wasRunning && code !== 0 && this.config.autoRestart) {
      this.handleUnexpectedExit(code, signal);
    }
  }

  /**
   * Handle unexpected process exit with restart logic
   * @private
   */
  async handleUnexpectedExit(code, signal) {
    this.restartCount++;
    
    const maxRestarts = this.config.maxRestarts || 5;
    const restartDelay = this.config.restartDelay || 5000;

    console.warn(
      `Process '${this.name}' exited unexpectedly (code: ${code}, signal: ${signal}). ` +
      `Restart attempt ${this.restartCount}/${maxRestarts}`
    );

    if (this.restartCount <= maxRestarts) {
      setTimeout(async () => {
        try {
          await this.initialize();
          console.log(`Process '${this.name}' restarted successfully`);
        } catch (error) {
          console.error(`Failed to restart process '${this.name}':`, error);
        }
      }, restartDelay);
    } else {
      console.error(
        `Process '${this.name}' exceeded maximum restart attempts (${maxRestarts})`
      );
      this.updateStatus(RESOURCE_STATUS.ERROR);
    }
  }

  /**
   * Handle process output
   * @private
   */
  handleProcessOutput(stream, data) {
    const output = data.toString();
    
    // Log to console if configured
    if (this.config.logging?.console) {
      console.log(`[${this.name}:${stream}] ${output.trim()}`);
    }

    // Write to log file if configured
    if (this.logStreams.has(stream)) {
      this.logStreams.get(stream).write(output);
    }

    // Check for ready signals in logs
    if (this.config.readyCheck?.type === 'log') {
      this.checkLogReady(output);
    }
  }

  /**
   * Set up logging streams
   * @private
   */
  async setupLogging() {
    const logging = this.config.logging;
    if (!logging.file) return;

    try {
      // Ensure log directory exists
      const logDir = path.dirname(logging.file);
      await fs.mkdir(logDir, { recursive: true });

      // Create log streams
      const logPath = this.resolveDependencies(logging.file);
      const logStream = (await import('fs')).createWriteStream(logPath, { flags: 'a' });
      
      this.logStreams.set('stdout', logStream);
      this.logStreams.set('stderr', logStream);

    } catch (error) {
      console.warn(`Failed to set up logging for '${this.name}':`, error);
    }
  }

  /**
   * Wait for process to be ready based on readiness check
   * @private
   */
  async waitForReady() {
    const { readyCheck } = this.config;
    const timeout = readyCheck.timeout || 30000;
    const interval = readyCheck.interval || 1000;
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = async () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Process '${this.name}' failed to start within ${timeout}ms`));
          return;
        }

        try {
          const ready = await this.checkReady();
          if (ready) {
            resolve();
          } else {
            setTimeout(check, interval);
          }
        } catch (error) {
          setTimeout(check, interval);
        }
      };

      check();
    });
  }

  /**
   * Check if process is ready
   * @private
   */
  async checkReady() {
    const { readyCheck } = this.config;
    
    switch (readyCheck.type) {
      case 'tcp':
        return this.checkTcpPort(readyCheck.port);
      case 'http':
        return this.checkHttpEndpoint(readyCheck.url);
      case 'file':
        return this.checkFileExists(readyCheck.path);
      case 'process':
        return this.childProcess && !this.childProcess.killed;
      default:
        return true;
    }
  }

  /**
   * Check if TCP port is open
   * @private
   */
  async checkTcpPort(port) {
    const resolvedPort = this.resolveDependencies(port);
    
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(1000);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(resolvedPort, 'localhost');
    });
  }

  /**
   * Check HTTP endpoint
   * @private
   */
  async checkHttpEndpoint(url) {
    const resolvedUrl = this.resolveDependencies(url);
    
    try {
      const response = await fetch(resolvedUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if file exists
   * @private
   */
  async checkFileExists(filePath) {
    const resolvedPath = this.resolveDependencies(filePath);
    
    try {
      await fs.access(resolvedPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check log for ready message
   * @private
   */
  checkLogReady(output) {
    const { readyCheck } = this.config;
    if (readyCheck.message && output.includes(readyCheck.message)) {
      this._logReady = true;
    }
  }

  /**
   * Perform health check
   */
  async healthCheck() {
    if (!this.childProcess || this.status !== RESOURCE_STATUS.RUNNING) {
      this.recordHealthCheck(false, 'Process not running');
      return false;
    }

    if (this.healthChecker) {
      const result = await this.healthChecker.check(this);
      this.recordHealthCheck(result.healthy, result.details);
      return result.healthy;
    }

    // Default health check - just verify process is alive
    const healthy = !this.childProcess.killed;
    this.recordHealthCheck(healthy, healthy ? 'Process alive' : 'Process killed');
    return healthy;
  }

  /**
   * Invoke a method on the process resource
   */
  async invoke(method, args = {}) {
    switch (method) {
      case 'status':
        return this.getDetailedStatus();
      case 'restart':
        return this.restart();
      case 'stop':
        return this.stop();
      case 'logs':
        return this.getLogs(args.lines || 100);
      case 'signal':
        return this.sendSignal(args.signal || 'SIGTERM');
      default:
        throw new Error(`Unknown method '${method}' for ProcessResource '${this.name}'`);
    }
  }

  /**
   * Get detailed status information
   */
  getDetailedStatus() {
    const baseStatus = this.getStatus();
    
    return {
      ...baseStatus,
      pid: this.childProcess?.pid,
      command: this.config.command,
      args: this.config.args,
      startTime: this.startTime,
      restartCount: this.restartCount,
      healthChecker: this.healthChecker ? this.healthChecker.getStatus() : null
    };
  }

  /**
   * Restart the process
   */
  async restart() {
    await this.cleanup();
    await this.initialize();
    this.restartCount++;
    return this.getDetailedStatus();
  }

  /**
   * Stop the process
   */
  async stop() {
    await this.cleanup();
    return { stopped: true };
  }

  /**
   * Get recent log lines
   */
  async getLogs(lines = 100) {
    // This is a simplified implementation
    // In a real system, you might want to read from log files
    return {
      lines: lines,
      note: 'Log retrieval not fully implemented in this demo'
    };
  }

  /**
   * Send signal to process
   */
  sendSignal(signal) {
    if (!this.childProcess || this.childProcess.killed) {
      throw new Error(`Cannot send signal to stopped process '${this.name}'`);
    }

    this.childProcess.kill(signal);
    return { signal, sent: true };
  }

  /**
   * Add exit handler
   */
  onExit(handler) {
    this.exitHandlers.add(handler);
  }

  /**
   * Remove exit handler
   */
  offExit(handler) {
    this.exitHandlers.delete(handler);
  }

  /**
   * Clean up the process resource
   */
  async cleanup() {
    this.updateStatus(RESOURCE_STATUS.STOPPING);
    
    // Stop health monitoring
    if (this.healthChecker) {
      this.healthChecker.stop();
    }

    // Close log streams
    for (const stream of this.logStreams.values()) {
      stream.end();
    }
    this.logStreams.clear();

    // Terminate process if running
    if (this.childProcess && !this.childProcess.killed) {
      await this.terminateProcess();
    }

    this.updateStatus(RESOURCE_STATUS.STOPPED);
    this.childProcess = null;
    this.startTime = null;
  }

  /**
   * Terminate the child process gracefully
   * @private
   */
  async terminateProcess() {
    const gracefulTimeout = this.config.gracefulShutdownTimeout || 10000;
    
    return new Promise((resolve) => {
      // Set up timeout for forceful kill
      const timeout = setTimeout(() => {
        if (this.childProcess && !this.childProcess.killed) {
          console.warn(`Force killing process '${this.name}' after ${gracefulTimeout}ms`);
          this.childProcess.kill('SIGKILL');
        }
        resolve();
      }, gracefulTimeout);

      // Listen for process exit
      const onExit = () => {
        clearTimeout(timeout);
        resolve();
      };

      if (this.childProcess) {
        this.childProcess.once('exit', onExit);
        
        // Send graceful termination signal
        this.childProcess.kill('SIGTERM');
      } else {
        clearTimeout(timeout);
        resolve();
      }
    });
  }
}

export default ProcessResource;