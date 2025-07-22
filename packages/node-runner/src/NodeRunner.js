import { ProcessManager } from './ProcessManager.js';
import { ServerManager } from './ServerManager.js';
import { PackageManager } from './PackageManager.js';
import { findAvailablePort, waitForPortInUse } from './utils/ports.js';
import { registerCleanupHandler, CleanupContext } from './utils/cleanup.js';
import LogManager from '@legion/log-manager';

/**
 * Main NodeRunner class that provides all Node.js process management capabilities
 */
export default class NodeRunner {
  constructor(config = {}) {
    this.config = {
      autoCleanup: true,
      logBufferSize: 1000,
      ...config
    };
    
    // Use provided LogManager or create a new one
    this.logManager = config.logManager || new LogManager({
      defaultBufferSize: this.config.logBufferSize,
      realtimeStreaming: true
    });
    
    this.processManager = new ProcessManager(this.logManager);
    this.serverManager = new ServerManager(this.processManager);
    this.packageManager = new PackageManager();
    this.cleanupContext = new CleanupContext();
    
    if (this.config.autoCleanup) {
      registerCleanupHandler(() => this.cleanup());
    }
  }

  /**
   * Start a Node.js process
   */
  async startNodeProcess(command, options = {}) {
    try {
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

      const result = await this.processManager.startProcess(processCommand, args, options);
      
      // Add to cleanup context
      if (this.config.autoCleanup) {
        this.cleanupContext.addProcess(result.pid);
      }
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop a process
   */
  async stopProcess(processId, options = {}) {
    try {
      const result = await this.processManager.stopProcess(processId, options);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restart a process
   */
  async restartProcess(processId, options = {}) {
    try {
      const result = await this.processManager.restartProcess(processId, options);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all processes
   */
  async listProcesses() {
    try {
      const processes = this.processManager.listProcesses();
      return {
        success: true,
        processes,
        count: processes.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start a web server
   */
  async startWebServer(command, options = {}) {
    try {
      const result = await this.serverManager.startWebServer(command, options);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start a development server
   */
  async startDevServer(command, options = {}) {
    try {
      const result = await this.serverManager.startDevelopmentServer(command, options);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check server health
   */
  async checkServerHealth(serverId) {
    try {
      const result = await this.serverManager.checkServerHealth(serverId);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Install dependencies
   */
  async installDependencies(options = {}) {
    try {
      const result = await this.packageManager.installDependencies(options);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run NPM script
   */
  async runNpmScript(scriptName, options = {}) {
    try {
      const result = await this.packageManager.runNpmScript(scriptName, options);
      return result; // Already has success field
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Kill process on port
   */
  async killProcessOnPort(port) {
    try {
      const result = await this.processManager.killProcessOnPort(port);
      return result; // Already has success field
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check environment
   */
  async checkEnvironment(options = {}) {
    try {
      const result = await this.packageManager.checkEnvironment(options.cwd);
      
      // Also check for running processes
      const processes = this.processManager.listProcesses();
      const servers = this.serverManager.listServers();
      
      return {
        success: true,
        ...result,
        runningProcesses: processes.length,
        runningServers: servers.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find available port
   */
  async findAvailablePort(preferredPort = 3000) {
    try {
      const port = await findAvailablePort(preferredPort);
      return {
        success: true,
        port,
        preferred: preferredPort === port
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Wait for port to be in use
   */
  async waitForPort(port, options = {}) {
    try {
      await waitForPortInUse(port, options);
      return {
        success: true,
        port,
        message: `Port ${port} is now in use`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get process logs
   */
  async getProcessLogs(processId, options = {}) {
    try {
      const logs = this.processManager.getProcessLogs(processId, options);
      return {
        success: true,
        processId,
        logs,
        count: logs.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop server
   */
  async stopServer(serverId, options = {}) {
    try {
      const result = await this.serverManager.stopServer(serverId, options);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all servers
   */
  async listServers() {
    try {
      const servers = this.serverManager.listServers();
      return {
        success: true,
        servers,
        count: servers.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a command and return output
   */
  async executeCommand(command, options = {}) {
    try {
      const { execa } = await import('execa');
      const { cwd = process.cwd(), timeout = 30000 } = options;
      
      const { stdout, stderr, exitCode } = await execa(command, {
        shell: true,
        cwd,
        timeout,
        reject: false
      });
      
      return {
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup all resources
   */
  async cleanup() {
    try {
      await this.cleanupContext.cleanup();
      await this.serverManager.cleanup();
      await this.processManager.cleanup();
      await this.logManager.cleanup();
      
      return {
        success: true,
        message: 'All resources cleaned up'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}