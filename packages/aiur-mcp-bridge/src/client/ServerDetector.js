/**
 * ServerDetector - Detects if Aiur server is running
 * 
 * Provides health check and server detection functionality for automatic
 * server management in the stdio stub.
 */

import http from 'http';

export class ServerDetector {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.AIUR_SERVER_HOST || 'localhost',
      port: config.port || process.env.AIUR_SERVER_PORT || 8080,
      healthPath: config.healthPath || '/health',
      timeout: config.timeout || 5000,
      retryInterval: config.retryInterval || 1000,
      maxRetries: config.maxRetries || 3
    };
  }

  /**
   * Check if the server is running
   * @returns {Promise<Object|null>} Server info if running, null if not
   */
  async isServerRunning() {
    try {
      const serverInfo = await this._healthCheck();
      return serverInfo;
    } catch (error) {
      return null;
    }
  }

  /**
   * Wait for server to be ready with polling
   * @param {number} maxWaitTime - Maximum time to wait in milliseconds
   * @returns {Promise<Object>} Server info when ready
   */
  async waitForServer(maxWaitTime = 30000) {
    const startTime = Date.now();
    const pollInterval = this.config.retryInterval;
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const serverInfo = await this._healthCheck();
        if (serverInfo) {
          return serverInfo;
        }
      } catch (error) {
        // Continue polling
      }
      
      // Wait before next poll
      await this._sleep(pollInterval);
    }
    
    throw new Error(`Server did not become ready within ${maxWaitTime}ms`);
  }

  /**
   * Perform health check with retries
   * @returns {Promise<Object>} Server health information
   * @private
   */
  async _healthCheck() {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const serverInfo = await this._httpHealthCheck();
        
        // Validate response
        if (serverInfo && serverInfo.status === 'healthy') {
          return {
            ...serverInfo,
            host: this.config.host,
            port: this.config.port,
            healthUrl: `http://${this.config.host}:${this.config.port}${this.config.healthPath}`,
            detectedAt: new Date().toISOString()
          };
        } else {
          throw new Error('Server responded but not healthy');
        }
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.maxRetries) {
          await this._sleep(this.config.retryInterval);
        }
      }
    }
    
    throw new Error(`Health check failed after ${this.config.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Perform HTTP health check
   * @returns {Promise<Object>} Parsed health response
   * @private
   */
  async _httpHealthCheck() {
    return new Promise((resolve, reject) => {
      const healthUrl = `http://${this.config.host}:${this.config.port}${this.config.healthPath}`;
      
      const req = http.get(healthUrl, {
        timeout: this.config.timeout
      }, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const healthInfo = JSON.parse(data);
              resolve(healthInfo);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        if (error.code === 'ECONNREFUSED') {
          reject(new Error('Server not running (connection refused)'));
        } else if (error.code === 'ETIMEDOUT') {
          reject(new Error('Server health check timeout'));
        } else {
          reject(new Error(`Health check error: ${error.message}`));
        }
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Health check request timeout'));
      });
    });
  }

  /**
   * Check if a specific port is in use
   * @param {number} port - Port to check
   * @returns {Promise<boolean>} True if port is in use
   */
  async isPortInUse(port = this.config.port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      
      server.listen(port, this.config.host, () => {
        server.close(() => {
          resolve(false); // Port is free
        });
      });
      
      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          resolve(true); // Port is in use
        } else {
          resolve(false); // Other error, assume port is free
        }
      });
    });
  }

  /**
   * Get detailed server connection info
   * @returns {Promise<Object>} Server connection details
   */
  async getServerDetails() {
    try {
      const isRunning = await this.isServerRunning();
      const portInUse = await this.isPortInUse();
      
      return {
        running: !!isRunning,
        serverInfo: isRunning,
        portInUse,
        connectionUrl: `http://${this.config.host}:${this.config.port}`,
        webSocketUrl: `ws://${this.config.host}:${this.config.port}/ws`,
        healthUrl: `http://${this.config.host}:${this.config.port}${this.config.healthPath}`,
        config: this.config
      };
    } catch (error) {
      return {
        running: false,
        error: error.message,
        portInUse: await this.isPortInUse(),
        connectionUrl: `http://${this.config.host}:${this.config.port}`,
        webSocketUrl: `ws://${this.config.host}:${this.config.port}/ws`,
        healthUrl: `http://${this.config.host}:${this.config.port}${this.config.healthPath}`,
        config: this.config
      };
    }
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

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

export default ServerDetector;