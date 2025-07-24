/**
 * ServerLauncher - Launches Aiur server as independent process
 * 
 * Handles spawning the server as a detached process that survives
 * even after the stdio stub exits.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ServerLauncher {
  constructor(config = {}) {
    this.config = {
      serverScript: config.serverScript || path.join(__dirname, '..', 'server', 'index.js'),
      nodeExecutable: config.nodeExecutable || process.execPath,
      host: config.host || process.env.AIUR_SERVER_HOST || 'localhost',
      port: config.port || process.env.AIUR_SERVER_PORT || 8080,
      independent: config.independent !== false, // Default to true
      pidFile: config.pidFile || path.join(os.tmpdir(), 'aiur-server.pid'),
      logFile: config.logFile || path.join(os.tmpdir(), 'aiur-server.log'),
      errorLogFile: config.errorLogFile || path.join(os.tmpdir(), 'aiur-server-error.log'),
      startupTimeout: config.startupTimeout || 30000,
      shutdownTimeout: config.shutdownTimeout || 10000
    };
  }

  /**
   * Launch server as independent process
   * @returns {Promise<Object>} Server process information
   */
  async launchIndependent() {
    // Check if server is already running
    const existingPid = await this._getStoredPid();
    if (existingPid && await this._isProcessRunning(existingPid)) {
      throw new Error(`Server already running with PID ${existingPid}`);
    }

    // Prepare server environment
    const serverEnv = {
      ...process.env,
      AIUR_SERVER_HOST: this.config.host,
      AIUR_SERVER_PORT: this.config.port,
      AIUR_PURE_LEGION_MODE: 'true'
    };

    // Prepare spawn options for independent process
    const spawnOptions = {
      env: serverEnv,
      cwd: path.dirname(this.config.serverScript),
      detached: this.config.independent,
      stdio: this.config.independent ? 'ignore' : ['pipe', 'pipe', 'pipe']
    };

    // If not independent, pipe output to log files
    if (!this.config.independent) {
      try {
        await fs.mkdir(path.dirname(this.config.logFile), { recursive: true });
        await fs.mkdir(path.dirname(this.config.errorLogFile), { recursive: true });
      } catch (error) {
        // Ignore mkdir errors
      }
    }

    // Launching server - details available in return value

    // Spawn the server process
    const serverProcess = spawn(this.config.nodeExecutable, [this.config.serverScript], spawnOptions);

    // Handle different modes
    if (this.config.independent) {
      // Independent mode - detach and track PID
      serverProcess.unref();
      
      // Store PID for later management
      await this._storePid(serverProcess.pid);
      
      // Server launched - PID available in return value
      
      return {
        pid: serverProcess.pid,
        independent: true,
        pidFile: this.config.pidFile,
        startedAt: new Date().toISOString(),
        config: this.config
      };
    } else {
      // Child mode - manage process lifecycle
      return await this._manageChildProcess(serverProcess);
    }
  }

  /**
   * Stop server process
   * @param {number} pid - Process ID to stop (optional, will read from PID file)
   * @returns {Promise<boolean>} True if stopped successfully
   */
  async stopServer(pid = null) {
    try {
      const targetPid = pid || await this._getStoredPid();
      
      if (!targetPid) {
        // No server PID found
        return false;
      }

      if (!await this._isProcessRunning(targetPid)) {
        // Server process not running
        await this._cleanupPidFile();
        return false;
      }

      // Stopping server process

      // Try graceful shutdown first
      try {
        process.kill(targetPid, 'SIGTERM');
        
        // Wait for graceful shutdown
        const shutdownSuccess = await this._waitForProcessExit(targetPid, this.config.shutdownTimeout);
        
        if (shutdownSuccess) {
          // Server stopped gracefully
          await this._cleanupPidFile();
          return true;
        }
      } catch (error) {
        // Process might already be dead
        if (error.code === 'ESRCH') {
          // Server process already stopped
          await this._cleanupPidFile();
          return true;
        }
      }

      // Force kill if graceful shutdown failed
      // Graceful shutdown timeout, force killing
      try {
        process.kill(targetPid, 'SIGKILL');
        // Server force killed
        await this._cleanupPidFile();
        return true;
      } catch (error) {
        if (error.code === 'ESRCH') {
          // Server process already stopped
          await this._cleanupPidFile();
          return true;
        }
        throw error;
      }
    } catch (error) {
      // Error stopping server - returning false
      return false;
    }
  }

  /**
   * Get server status
   * @returns {Promise<Object>} Server status information
   */
  async getServerStatus() {
    try {
      const pid = await this._getStoredPid();
      
      if (!pid) {
        return {
          running: false,
          pid: null,
          message: 'No PID file found'
        };
      }

      const isRunning = await this._isProcessRunning(pid);
      
      return {
        running: isRunning,
        pid: isRunning ? pid : null,
        pidFile: this.config.pidFile,
        message: isRunning 
          ? `Server running with PID ${pid}` 
          : `PID ${pid} not running (stale PID file)`
      };
    } catch (error) {
      return {
        running: false,
        pid: null,
        error: error.message
      };
    }
  }

  /**
   * Restart server
   * @returns {Promise<Object>} New server process information
   */
  async restartServer() {
    // Restarting server
    
    // Stop existing server
    await this.stopServer();
    
    // Wait a moment
    await this._sleep(1000);
    
    // Launch new server
    return await this.launchIndependent();
  }

  /**
   * Manage child process (non-independent mode)
   * @param {ChildProcess} serverProcess - The spawned process
   * @returns {Promise<Object>} Process information
   * @private
   */
  async _manageChildProcess(serverProcess) {
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      // Handle process startup
      const startupTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Server startup timeout after ${this.config.startupTimeout}ms`));
        }
      }, this.config.startupTimeout);

      // Handle process exit
      serverProcess.on('exit', (code, signal) => {
        clearTimeout(startupTimer);
        if (!resolved) {
          resolved = true;
          if (code === 0) {
            resolve({
              pid: serverProcess.pid,
              independent: false,
              exitCode: code,
              exitSignal: signal
            });
          } else {
            reject(new Error(`Server exited with code ${code}, signal ${signal}`));
          }
        }
      });

      // Handle process error
      serverProcess.on('error', (error) => {
        clearTimeout(startupTimer);
        if (!resolved) {
          resolved = true;
          reject(new Error(`Server process error: ${error.message}`));
        }
      });

      // Consider the process started successfully after a short delay
      setTimeout(() => {
        if (!resolved && serverProcess.pid) {
          resolved = true;
          clearTimeout(startupTimer);
          resolve({
            pid: serverProcess.pid,
            independent: false,
            process: serverProcess,
            startedAt: new Date().toISOString()
          });
        }
      }, 2000);
    });
  }

  /**
   * Store process PID to file
   * @param {number} pid - Process ID to store
   * @private
   */
  async _storePid(pid) {
    try {
      await fs.mkdir(path.dirname(this.config.pidFile), { recursive: true });
      await fs.writeFile(this.config.pidFile, pid.toString(), 'utf8');
    } catch (error) {
      // Could not store PID - continuing anyway
    }
  }

  /**
   * Get stored process PID from file
   * @returns {Promise<number|null>} Process ID or null
   * @private
   */
  async _getStoredPid() {
    try {
      const pidContent = await fs.readFile(this.config.pidFile, 'utf8');
      const pid = parseInt(pidContent.trim(), 10);
      return isNaN(pid) ? null : pid;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up PID file
   * @private
   */
  async _cleanupPidFile() {
    try {
      await fs.unlink(this.config.pidFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Check if process is running
   * @param {number} pid - Process ID to check
   * @returns {Promise<boolean>} True if process is running
   * @private
   */
  async _isProcessRunning(pid) {
    try {
      // Signal 0 doesn't actually kill the process, just checks if it exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for process to exit
   * @param {number} pid - Process ID to watch
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} True if process exited within timeout
   * @private
   */
  async _waitForProcessExit(pid, timeout) {
    const startTime = Date.now();
    const pollInterval = 100;
    
    while (Date.now() - startTime < timeout) {
      if (!await this._isProcessRunning(pid)) {
        return true;
      }
      await this._sleep(pollInterval);
    }
    
    return false;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Resolves after sleep
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ServerLauncher;