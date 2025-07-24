/**
 * ServerManager - High-level server management
 * 
 * Combines ServerDetector and ServerLauncher to provide seamless
 * server management for the stdio stub.
 */

import { ServerDetector } from './ServerDetector.js';
import { ServerLauncher } from './ServerLauncher.js';

export class ServerManager {
  constructor(config = {}) {
    this.config = {
      autoLaunch: config.autoLaunch !== false, // Default to true
      maxStartupTime: config.maxStartupTime || 30000,
      launchTimeout: config.launchTimeout || 10000,
      healthCheckRetries: config.healthCheckRetries || 5,
      independent: config.independent !== false, // Default to true
      verbose: config.verbose !== false, // Default to true
      ...config
    };

    // Create detector and launcher with shared config
    this.detector = new ServerDetector({
      host: this.config.host,
      port: this.config.port,
      timeout: this.config.healthCheckTimeout || 5000,
      maxRetries: this.config.healthCheckRetries
    });

    this.launcher = new ServerLauncher({
      host: this.config.host,
      port: this.config.port,
      independent: this.config.independent,
      startupTimeout: this.config.maxStartupTime
    });
  }

  /**
   * Ensure server is running - detect or launch as needed
   * @returns {Promise<Object>} Server information
   */
  async ensureServerRunning() {
    try {
      // Step 1: Check if server is already running
      // Verbose logging removed - interferes with MCP protocol
      
      const existingServer = await this.detector.isServerRunning();
      
      if (existingServer) {
        // Server info available in return value
        
        return {
          status: 'existing',
          serverInfo: existingServer,
          launched: false,
          connectionUrl: `ws://${existingServer.host}:${existingServer.port}/ws`
        };
      }

      // Step 2: Launch server if not running and auto-launch is enabled
      if (!this.config.autoLaunch) {
        throw new Error(
          `Server not found at http://${this.config.host || 'localhost'}:${this.config.port || 8080} ` +
          'and auto-launch is disabled. Please start the server manually.'
        );
      }

      // Server not found, will launch automatically

      // Step 3: Launch the server
      const launchResult = await this.launcher.launchIndependent();
      
      // Server launched - details available in return value

      // Step 4: Wait for server to be ready
      // Waiting for server to be ready
      
      const readyServer = await this.detector.waitForServer(this.config.maxStartupTime);
      
      // Server ready - details available in return value

      return {
        status: 'launched',
        serverInfo: readyServer,
        launchInfo: launchResult,
        launched: true,
        connectionUrl: `ws://${readyServer.host}:${readyServer.port}/ws`
      };

    } catch (error) {
      // Error will be thrown to caller
      throw new Error(`Failed to ensure server is running: ${error.message}`);
    }
  }

  /**
   * Get comprehensive server status
   * @returns {Promise<Object>} Detailed server status
   */
  async getServerStatus() {
    try {
      const [serverDetails, launcherStatus] = await Promise.all([
        this.detector.getServerDetails(),
        this.launcher.getServerStatus()
      ]);

      return {
        detector: serverDetails,
        launcher: launcherStatus,
        summary: {
          running: serverDetails.running,
          healthy: serverDetails.running && serverDetails.serverInfo?.status === 'healthy',
          managed: launcherStatus.running,
          pid: launcherStatus.pid,
          connectionUrl: serverDetails.webSocketUrl,
          healthUrl: serverDetails.healthUrl
        }
      };
    } catch (error) {
      return {
        error: error.message,
        summary: {
          running: false,
          healthy: false,
          managed: false
        }
      };
    }
  }

  /**
   * Stop managed server
   * @returns {Promise<boolean>} True if stopped successfully
   */
  async stopServer() {
    // Stopping server

    try {
      const stopped = await this.launcher.stopServer();
      
      // Stop result available in return value
      
      return stopped;
    } catch (error) {
      // Error handled, returning false
      return false;
    }
  }

  /**
   * Restart managed server
   * @returns {Promise<Object>} New server information
   */
  async restartServer() {
    // Restarting server

    try {
      // Stop existing server
      await this.launcher.stopServer();
      
      // Wait a moment for cleanup
      await this._sleep(1000);
      
      // Ensure server is running (will launch new one)
      const result = await this.ensureServerRunning();
      
      // Server restarted - details available in return value
      
      return result;
    } catch (error) {
      // Error will be thrown to caller
      throw error;
    }
  }

  /**
   * Wait for server to be ready with enhanced feedback
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Server info when ready
   */
  async waitForServerReady(timeout = this.config.maxStartupTime) {
    // Waiting for server to be ready

    try {
      const serverInfo = await this.detector.waitForServer(timeout);
      
      // Server ready - details available in return value
      
      return serverInfo;
    } catch (error) {
      // Error will be thrown to caller
      throw error;
    }
  }

  /**
   * Validate server configuration and environment
   * @returns {Promise<Object>} Validation results
   */
  async validateEnvironment() {
    const validation = {
      valid: true,
      issues: [],
      warnings: [],
      config: this.config
    };

    try {
      // Check if port is available (when not running)
      const serverRunning = await this.detector.isServerRunning();
      const portInUse = await this.detector.isPortInUse();
      
      if (!serverRunning && portInUse) {
        validation.valid = false;
        validation.issues.push(`Port ${this.config.port || 8080} is in use by another process`);
      }

      // Check server script exists
      try {
        await import(this.launcher.config.serverScript);
      } catch (error) {
        validation.valid = false;
        validation.issues.push(`Server script not found: ${this.launcher.config.serverScript}`);
      }

      // Check node executable
      if (!this.launcher.config.nodeExecutable) {
        validation.warnings.push('Node executable path not explicitly set');
      }

      // Check permissions for PID file directory
      try {
        const pidDir = require('path').dirname(this.launcher.config.pidFile);
        await require('fs/promises').access(pidDir, require('fs').constants.W_OK);
      } catch (error) {
        validation.warnings.push(`PID file directory may not be writable: ${error.message}`);
      }

    } catch (error) {
      validation.valid = false;
      validation.issues.push(`Environment validation error: ${error.message}`);
    }

    return validation;
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update child components
    this.detector.updateConfig({
      host: this.config.host,
      port: this.config.port,
      timeout: this.config.healthCheckTimeout,
      maxRetries: this.config.healthCheckRetries
    });

    // Recreate launcher with new config
    this.launcher = new ServerLauncher({
      host: this.config.host,
      port: this.config.port,
      independent: this.config.independent,
      startupTimeout: this.config.maxStartupTime
    });
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

export default ServerManager;