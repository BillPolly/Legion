import net from 'net';

/**
 * Health checker for monitoring resource health
 * Supports multiple health check types: TCP, HTTP, process, file, custom
 */
class HealthChecker {
  constructor(resourceName, config) {
    this.resourceName = resourceName;
    this.config = {
      type: 'process',
      interval: 30000,
      timeout: 5000,
      retries: 3,
      ...config
    };
    
    this.intervalId = null;
    this.isRunning = false;
    this.consecutiveFailures = 0;
    this.lastCheck = null;
    this.checkHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Start health monitoring
   * @param {Function} customCheckFunction - Optional custom health check function
   */
  start(customCheckFunction = null) {
    if (this.isRunning) {
      console.warn(`Health checker for '${this.resourceName}' is already running`);
      return;
    }

    this.isRunning = true;
    this.customCheckFunction = customCheckFunction;
    
    // Perform initial check
    this.performCheck();
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.performCheck();
    }, this.config.interval);
    
    console.log(`Health checker started for '${this.resourceName}' (${this.config.type}, ${this.config.interval}ms)`);
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log(`Health checker stopped for '${this.resourceName}'`);
  }

  /**
   * Perform a health check
   * @private
   */
  async performCheck() {
    const startTime = Date.now();
    let result = { healthy: false, details: 'Unknown error' };

    try {
      if (this.customCheckFunction) {
        // Use custom check function if provided
        const customResult = await this.customCheckFunction();
        result = {
          healthy: !!customResult,
          details: typeof customResult === 'object' ? customResult.details : 'Custom check'
        };
      } else {
        // Use built-in check based on type
        result = await this.performBuiltinCheck();
      }
    } catch (error) {
      result = {
        healthy: false,
        details: `Health check error: ${error.message}`
      };
    }

    const duration = Date.now() - startTime;
    
    // Update statistics
    if (result.healthy) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
    }

    // Record check result
    this.lastCheck = {
      timestamp: new Date(),
      healthy: result.healthy,
      details: result.details,
      duration,
      consecutiveFailures: this.consecutiveFailures
    };

    // Add to history
    this.checkHistory.push(this.lastCheck);
    if (this.checkHistory.length > this.maxHistorySize) {
      this.checkHistory.shift();
    }

    // Log failures
    if (!result.healthy) {
      console.warn(
        `Health check failed for '${this.resourceName}' ` +
        `(${this.consecutiveFailures} consecutive failures): ${result.details}`
      );
    }
  }

  /**
   * Perform built-in health check based on type
   * @private
   */
  async performBuiltinCheck() {
    switch (this.config.type) {
      case 'tcp':
        return this.checkTcp();
      case 'http':
        return this.checkHttp();
      case 'process':
        return this.checkProcess();
      case 'file':
        return this.checkFile();
      default:
        throw new Error(`Unknown health check type: ${this.config.type}`);
    }
  }

  /**
   * Check TCP port connectivity
   * @private
   */
  async checkTcp() {
    const { port, host = 'localhost' } = this.config;
    
    if (!port) {
      throw new Error('TCP health check requires port configuration');
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;
      
      socket.setTimeout(this.config.timeout);
      
      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({ healthy: true, details: `TCP port ${port} is open` });
        }
      });
      
      socket.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({ healthy: false, details: `TCP port ${port} timeout` });
        }
      });
      
      socket.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          resolve({ healthy: false, details: `TCP error: ${error.message}` });
        }
      });
      
      socket.connect(port, host);
    });
  }

  /**
   * Check HTTP endpoint
   * @private
   */
  async checkHttp() {
    const { url, method = 'GET', expectedStatus = 200 } = this.config;
    
    if (!url) {
      throw new Error('HTTP health check requires url configuration');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          'User-Agent': `jsenvoy-health-checker/${this.resourceName}`
        }
      });

      clearTimeout(timeoutId);

      const healthy = response.status === expectedStatus;
      return {
        healthy,
        details: `HTTP ${response.status} (expected ${expectedStatus})`
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        return { healthy: false, details: 'HTTP request timeout' };
      }
      return { healthy: false, details: `HTTP error: ${error.message}` };
    }
  }

  /**
   * Check process status (placeholder - requires process reference)
   * @private
   */
  async checkProcess() {
    // This would typically check if a process is running
    // The actual implementation depends on having access to the process
    return { healthy: true, details: 'Process check not implemented' };
  }

  /**
   * Check file existence
   * @private
   */
  async checkFile() {
    const { path } = this.config;
    
    if (!path) {
      throw new Error('File health check requires path configuration');
    }

    try {
      const fs = await import('fs/promises');
      await fs.access(path);
      return { healthy: true, details: `File ${path} exists` };
    } catch (error) {
      return { healthy: false, details: `File ${path} not accessible: ${error.message}` };
    }
  }

  /**
   * Perform a single health check (for external use)
   * @param {*} context - Optional context for custom checks
   * @returns {Promise<{healthy: boolean, details: string}>}
   */
  async check(context = null) {
    try {
      if (this.customCheckFunction) {
        const result = await this.customCheckFunction(context);
        return {
          healthy: !!result,
          details: typeof result === 'object' ? result.details || 'Custom check passed' : 'Custom check'
        };
      } else {
        return await this.performBuiltinCheck();
      }
    } catch (error) {
      return {
        healthy: false,
        details: `Health check error: ${error.message}`
      };
    }
  }

  /**
   * Get health check status and statistics
   */
  getStatus() {
    const recentChecks = this.checkHistory.slice(-10);
    const healthyChecks = recentChecks.filter(check => check.healthy).length;
    const healthRate = recentChecks.length > 0 ? (healthyChecks / recentChecks.length) * 100 : 0;

    return {
      isRunning: this.isRunning,
      config: this.config,
      lastCheck: this.lastCheck,
      consecutiveFailures: this.consecutiveFailures,
      statistics: {
        totalChecks: this.checkHistory.length,
        recentHealthRate: Math.round(healthRate),
        averageDuration: this.calculateAverageDuration()
      }
    };
  }

  /**
   * Calculate average check duration
   * @private
   */
  calculateAverageDuration() {
    if (this.checkHistory.length === 0) return 0;
    
    const totalDuration = this.checkHistory.reduce((sum, check) => sum + check.duration, 0);
    return Math.round(totalDuration / this.checkHistory.length);
  }

  /**
   * Get recent health check history
   * @param {number} limit - Number of recent checks to return
   */
  getHistory(limit = 10) {
    return this.checkHistory.slice(-limit);
  }

  /**
   * Check if resource is currently healthy
   */
  isHealthy() {
    return this.lastCheck ? this.lastCheck.healthy : null;
  }

  /**
   * Get consecutive failure count
   */
  getConsecutiveFailures() {
    return this.consecutiveFailures;
  }

  /**
   * Check if health checker is experiencing persistent failures
   * @param {number} threshold - Failure threshold (default: 3)
   */
  hasPersistentFailures(threshold = 3) {
    return this.consecutiveFailures >= threshold;
  }

  /**
   * Reset health check state
   */
  reset() {
    this.consecutiveFailures = 0;
    this.lastCheck = null;
    this.checkHistory = [];
  }

  /**
   * Update health check configuration
   * @param {Object} newConfig - New configuration (partial)
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Restart if interval changed
    if (newConfig.interval && this.isRunning) {
      this.stop();
      this.start(this.customCheckFunction);
    }
  }

  /**
   * Create a health checker from configuration
   * @param {string} resourceName - Name of the resource
   * @param {Object} config - Health check configuration
   * @returns {HealthChecker} New health checker instance
   */
  static create(resourceName, config) {
    return new HealthChecker(resourceName, config);
  }

  /**
   * Create multiple health checkers
   * @param {Object} configs - Map of resource names to configurations
   * @returns {Map<string, HealthChecker>} Map of health checkers
   */
  static createMultiple(configs) {
    const checkers = new Map();
    
    for (const [resourceName, config] of Object.entries(configs)) {
      checkers.set(resourceName, new HealthChecker(resourceName, config));
    }
    
    return checkers;
  }
}

export default HealthChecker;