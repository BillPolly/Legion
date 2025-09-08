import { EventEmitter } from 'events';

/**
 * HealthMonitor - Monitors deployment health with configurable checks
 */
class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.healthChecks = new Map(); // deploymentId -> array of health checks
    this.healthHistory = new Map(); // deploymentId -> array of health results
    this.scheduledChecks = new Map(); // deploymentId -> interval ID
    this.currentStatus = new Map(); // deploymentId -> current status
    
    // Configuration
    this.defaultTimeout = options.timeout || 5000;
    this.defaultInterval = options.interval || 30000;
    this.maxHistorySize = options.maxHistorySize || 100;
  }

  /**
   * Add a health check for a deployment
   */
  addHealthCheck(config) {
    const {
      deploymentId,
      type,
      url,
      name,
      check,
      interval = this.defaultInterval,
      timeout = this.defaultTimeout,
      ...otherConfig
    } = config;

    if (!this.healthChecks.has(deploymentId)) {
      this.healthChecks.set(deploymentId, []);
    }

    const healthCheckConfig = {
      type,
      interval,
      timeout,
      ...otherConfig
    };

    if (type === 'http') {
      healthCheckConfig.url = url;
    } else if (type === 'custom') {
      healthCheckConfig.name = name;
      healthCheckConfig.check = check;
    }

    this.healthChecks.get(deploymentId).push(healthCheckConfig);
  }

  /**
   * Remove a health check by index
   */
  removeHealthCheck(deploymentId, index) {
    const checks = this.healthChecks.get(deploymentId);
    if (checks && index >= 0 && index < checks.length) {
      checks.splice(index, 1);
    }
  }

  /**
   * Remove all health checks for a deployment
   */
  removeAllHealthChecks(deploymentId) {
    this.healthChecks.delete(deploymentId);
    this.healthHistory.delete(deploymentId);
    this.currentStatus.delete(deploymentId);
    this.stopScheduledChecks(deploymentId);
  }

  /**
   * Update health check configuration
   */
  updateHealthCheck(deploymentId, index, updates) {
    const checks = this.healthChecks.get(deploymentId);
    if (checks && index >= 0 && index < checks.length) {
      Object.assign(checks[index], updates);
    }
  }

  /**
   * Get health checks for a deployment
   */
  getHealthChecks(deploymentId) {
    return this.healthChecks.get(deploymentId) || [];
  }

  /**
   * Perform HTTP health check
   */
  async performHttpCheck(config) {
    const { url, timeout = this.defaultTimeout } = config;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let response;
      try {
        response = await fetch(url, {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'User-Agent': 'conan-the-deployer-health-monitor'
          }
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const responseTime = Date.now() - startTime;

      return {
        healthy: response.ok,
        status: response.status,
        statusText: response.statusText,
        responseTime,
        url,
        timestamp: new Date(),
        error: response.ok ? null : response.statusText
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: false,
        status: null,
        responseTime,
        url,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Perform custom health check
   */
  async performCustomCheck(config) {
    const { name, check } = config;
    const startTime = Date.now();

    try {
      const result = await check();
      const responseTime = Date.now() - startTime;

      return {
        healthy: result.healthy,
        name,
        responseTime,
        timestamp: new Date(),
        details: result.details,
        reason: result.reason,
        error: result.healthy ? null : (result.reason || 'Custom check failed')
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        healthy: false,
        name,
        responseTime,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Check health for a specific deployment
   */
  async checkHealth(deploymentId) {
    const checks = this.getHealthChecks(deploymentId);
    
    if (checks.length === 0) {
      return {
        deploymentId,
        overall: 'unknown',
        checks: [],
        timestamp: new Date()
      };
    }

    const checkResults = [];

    for (const checkConfig of checks) {
      let result;

      if (checkConfig.type === 'http') {
        result = await this.performHttpCheck(checkConfig);
        result.type = 'http';
      } else if (checkConfig.type === 'custom') {
        result = await this.performCustomCheck(checkConfig);
        result.type = 'custom';
      }

      checkResults.push(result);
    }

    // Determine overall health
    const allHealthy = checkResults.every(result => result.healthy);
    const overallStatus = allHealthy ? 'healthy' : 'unhealthy';

    const healthResult = {
      deploymentId,
      overall: overallStatus,
      checks: checkResults,
      timestamp: new Date()
    };

    // Store in history
    this.addToHistory(deploymentId, {
      status: overallStatus,
      timestamp: healthResult.timestamp,
      checks: checkResults
    });

    // Emit health change event if status changed
    const previousStatus = this.currentStatus.get(deploymentId) || 'unknown';
    if (previousStatus !== overallStatus) {
      this.currentStatus.set(deploymentId, overallStatus);
      this.emit('health:change', {
        deploymentId,
        previousStatus,
        currentStatus: overallStatus,
        timestamp: healthResult.timestamp
      });
    }

    // Emit health check result
    this.emit('health:check', healthResult);

    return healthResult;
  }

  /**
   * Add health check result to history
   */
  addToHistory(deploymentId, healthResult) {
    if (!this.healthHistory.has(deploymentId)) {
      this.healthHistory.set(deploymentId, []);
    }

    const history = this.healthHistory.get(deploymentId);
    history.push(healthResult);

    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Get health history for a deployment
   */
  getHealthHistory(deploymentId) {
    return this.healthHistory.get(deploymentId) || [];
  }

  /**
   * Start scheduled health checks for a deployment
   */
  startScheduledChecks(deploymentId) {
    if (this.scheduledChecks.has(deploymentId)) {
      this.stopScheduledChecks(deploymentId);
    }

    const checks = this.getHealthChecks(deploymentId);
    if (checks.length === 0) return;

    // Use the shortest interval among all checks
    const interval = Math.min(...checks.map(check => check.interval));

    const intervalId = setInterval(async () => {
      try {
        await this.checkHealth(deploymentId);
      } catch (error) {
        this.emit('health:error', {
          deploymentId,
          error: error.message,
          timestamp: new Date()
        });
      }
    }, interval);

    this.scheduledChecks.set(deploymentId, intervalId);
  }

  /**
   * Stop scheduled health checks for a deployment
   */
  stopScheduledChecks(deploymentId) {
    const intervalId = this.scheduledChecks.get(deploymentId);
    if (intervalId) {
      clearInterval(intervalId);
      this.scheduledChecks.delete(deploymentId);
    }
  }

  /**
   * Stop all scheduled health checks
   */
  stopAllChecks() {
    for (const [deploymentId] of this.scheduledChecks) {
      this.stopScheduledChecks(deploymentId);
    }
  }

  /**
   * Get overall health status across all deployments
   */
  getOverallHealthStatus() {
    const deploymentIds = Array.from(this.currentStatus.keys());
    const totalDeployments = deploymentIds.length;

    if (totalDeployments === 0) {
      return {
        status: 'unknown',
        totalDeployments: 0,
        healthyDeployments: 0,
        unhealthyDeployments: 0,
        unknownDeployments: 0
      };
    }

    let healthyCount = 0;
    let unhealthyCount = 0;
    let unknownCount = 0;

    for (const status of this.currentStatus.values()) {
      switch (status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'unhealthy':
          unhealthyCount++;
          break;
        default:
          unknownCount++;
      }
    }

    const overallStatus = unhealthyCount > 0 ? 'unhealthy' : 
                         healthyCount > 0 ? 'healthy' : 'unknown';

    return {
      status: overallStatus,
      totalDeployments,
      healthyDeployments: healthyCount,
      unhealthyDeployments: unhealthyCount,
      unknownDeployments: unknownCount,
      timestamp: new Date()
    };
  }

  /**
   * Get health summary with deployment details
   */
  getHealthSummary() {
    const deploymentStatuses = {};
    
    for (const [deploymentId, status] of this.currentStatus) {
      const history = this.getHealthHistory(deploymentId);
      const checks = this.getHealthChecks(deploymentId);
      
      deploymentStatuses[deploymentId] = {
        currentStatus: status,
        lastChecked: history.length > 0 ? history[history.length - 1].timestamp : null,
        totalChecks: history.length,
        healthCheckCount: checks.length,
        uptime: this.calculateUptime(deploymentId)
      };
    }

    return {
      totalDeployments: this.currentStatus.size,
      deploymentsWithHistory: this.healthHistory.size,
      deploymentStatuses,
      timestamp: new Date()
    };
  }

  /**
   * Calculate uptime percentage for a deployment
   */
  calculateUptime(deploymentId) {
    const history = this.getHealthHistory(deploymentId);
    if (history.length === 0) return null;

    const healthyChecks = history.filter(h => h.status === 'healthy').length;
    const totalChecks = history.length;
    
    return {
      percentage: (healthyChecks / totalChecks) * 100,
      healthyChecks,
      totalChecks
    };
  }

  /**
   * Get current status for a deployment
   */
  getCurrentStatus(deploymentId) {
    return this.currentStatus.get(deploymentId) || 'unknown';
  }

  /**
   * Force health check for a deployment
   */
  async forceHealthCheck(deploymentId) {
    return this.checkHealth(deploymentId);
  }

  /**
   * Get health check statistics
   */
  getStatistics() {
    const totalDeployments = this.healthChecks.size;
    const activeScheduledChecks = this.scheduledChecks.size;
    const totalHealthChecks = Array.from(this.healthChecks.values())
      .reduce((total, checks) => total + checks.length, 0);
    
    const totalHistoryEntries = Array.from(this.healthHistory.values())
      .reduce((total, history) => total + history.length, 0);

    return {
      totalDeployments,
      activeScheduledChecks,
      totalHealthChecks,
      totalHistoryEntries,
      averageChecksPerDeployment: totalDeployments > 0 ? 
        (totalHealthChecks / totalDeployments).toFixed(2) : 0,
      timestamp: new Date()
    };
  }
}

export default HealthMonitor;