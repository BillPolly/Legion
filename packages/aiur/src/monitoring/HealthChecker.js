/**
 * Health Checker
 * 
 * Manages health checks for system components, handles dependencies,
 * timeouts, retries, and provides health trends and history
 */

import { EventEmitter } from 'events';

export class HealthChecker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      checkInterval: options.checkInterval || 30000, // 30 seconds
      timeout: options.timeout || 5000, // 5 seconds
      retryAttempts: options.retryAttempts || 2,
      retryDelay: options.retryDelay || 1000,
      historySize: options.historySize || 100,
      ...options
    };

    // Health checks registry
    this.checks = new Map();
    this.checkHistory = new Map();
    this.lastResults = new Map();

    // Change listeners
    this.changeListeners = [];

    // Periodic health checking
    this.intervalTimer = null;
    if (this.options.checkInterval > 0) {
      this._startPeriodicChecks();
    }
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFunction, options = {}) {
    const check = {
      name,
      function: checkFunction,
      timeout: options.timeout || this.options.timeout,
      retryAttempts: options.retryAttempts ?? this.options.retryAttempts,
      retryDelay: options.retryDelay || this.options.retryDelay,
      dependsOn: options.dependsOn || [],
      enabled: options.enabled !== false,
      tags: options.tags || {},
      ...options
    };

    this.checks.set(name, check);
    this.checkHistory.set(name, []);
    
    this.emit('check-registered', { name, check });
    
    return name;
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name) {
    if (this.checks.has(name)) {
      const check = this.checks.get(name);
      this.checks.delete(name);
      this.checkHistory.delete(name);
      this.lastResults.delete(name);
      
      this.emit('check-unregistered', { name, check });
      return true;
    }
    return false;
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(options = {}) {
    const startTime = Date.now();
    const results = {};
    const executionOrder = [];
    const errors = [];

    try {
      // Resolve execution order based on dependencies
      const orderedChecks = this._resolveDependencies();
      
      // Execute checks in dependency order
      for (const checkName of orderedChecks) {
        if (!this.checks.has(checkName)) continue;
        
        const check = this.checks.get(checkName);
        if (!check.enabled) continue;

        executionOrder.push(checkName);
        
        try {
          const result = await this._runSingleCheck(checkName, check);
          results[checkName] = result;
          
          // Record in history
          this._recordCheckResult(checkName, result);
          
          // Check if this affects dependent checks
          if (result.status !== 'healthy') {
            this._notifyDependentChecks(checkName, result);
          }
          
        } catch (error) {
          const errorResult = {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date(),
            duration: 0
          };
          
          results[checkName] = errorResult;
          this._recordCheckResult(checkName, errorResult);
          errors.push({ check: checkName, error });
        }
      }

      // Calculate overall health
      const overallHealth = this._calculateOverallHealth(results);
      
      const healthReport = {
        overall: overallHealth,
        checks: results,
        executionOrder,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        errors: errors.length > 0 ? errors : undefined
      };

      this.emit('health-checks-completed', healthReport);
      return healthReport;
      
    } catch (error) {
      const errorReport = {
        overall: 'error',
        error: error.message,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
      
      this.emit('health-checks-error', errorReport);
      throw error;
    }
  }

  /**
   * Run a specific health check
   */
  async runCheck(checkName) {
    const check = this.checks.get(checkName);
    if (!check) {
      throw new Error(`Health check '${checkName}' not found`);
    }

    const result = await this._runSingleCheck(checkName, check);
    this._recordCheckResult(checkName, result);
    
    this.emit('check-completed', { name: checkName, result });
    return result;
  }

  /**
   * Get health trends for a specific check
   */
  getHealthTrends(checkName, timeWindow = 3600000) { // 1 hour default
    const history = this.checkHistory.get(checkName) || [];
    const cutoff = Date.now() - timeWindow;
    const recentHistory = history.filter(h => h.timestamp.getTime() > cutoff);
    
    if (recentHistory.length === 0) {
      return null;
    }

    const successfulChecks = recentHistory.filter(h => h.status === 'healthy').length;
    const totalChecks = recentHistory.length;
    const successRate = successfulChecks / totalChecks;
    
    const averageResponseTime = recentHistory
      .filter(h => h.duration !== undefined)
      .reduce((sum, h) => sum + h.duration, 0) / recentHistory.length;

    const recentStatus = recentHistory[recentHistory.length - 1]?.status || 'unknown';
    
    return {
      checks: totalChecks,
      successRate,
      averageResponseTime,
      recentStatus,
      timeWindow,
      firstCheck: recentHistory[0].timestamp,
      lastCheck: recentHistory[recentHistory.length - 1].timestamp
    };
  }

  /**
   * Get current health status summary
   */
  getHealthSummary() {
    const summary = {
      totalChecks: this.checks.size,
      enabledChecks: 0,
      healthyChecks: 0,
      unhealthyChecks: 0,
      unknownChecks: 0
    };

    for (const [name, check] of this.checks.entries()) {
      if (check.enabled) {
        summary.enabledChecks++;
        
        const lastResult = this.lastResults.get(name);
        if (lastResult) {
          if (lastResult.status === 'healthy') {
            summary.healthyChecks++;
          } else if (lastResult.status === 'unhealthy') {
            summary.unhealthyChecks++;
          }
        } else {
          summary.unknownChecks++;
        }
      }
    }

    return summary;
  }

  /**
   * Register health change listener
   */
  onHealthChange(listener) {
    this.changeListeners.push(listener);
  }

  /**
   * Enable or disable periodic health checks
   */
  setPeriodicChecks(enabled) {
    if (enabled) {
      this._startPeriodicChecks();
    } else {
      this._stopPeriodicChecks();
    }
  }

  /**
   * Stop health checker and cleanup
   */
  stop() {
    this._stopPeriodicChecks();
    this.emit('health-checker-stopped');
  }

  /**
   * Run a single health check with timeout and retry logic
   * @private
   */
  async _runSingleCheck(checkName, check) {
    const startTime = Date.now();
    let lastError;
    
    for (let attempt = 0; attempt <= check.retryAttempts; attempt++) {
      try {
        // Run check with timeout
        const result = await this._runWithTimeout(
          check.function, 
          check.timeout
        );
        
        const duration = Date.now() - startTime;
        
        // Ensure result has required fields
        const normalizedResult = {
          status: result.status || 'healthy',
          details: result.details || {},
          timestamp: new Date(),
          duration,
          attempt: attempt + 1,
          ...result
        };

        // Notify change listeners
        this._notifyHealthChange(checkName, normalizedResult);
        
        return normalizedResult;
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on the last attempt
        if (attempt < check.retryAttempts) {
          await new Promise(resolve => 
            setTimeout(resolve, check.retryDelay)
          );
        }
      }
    }

    // All attempts failed
    const duration = Date.now() - startTime;
    const errorResult = {
      status: 'unhealthy',
      error: lastError.message,
      timestamp: new Date(),
      duration,
      attempts: check.retryAttempts + 1
    };

    this._notifyHealthChange(checkName, errorResult);
    return errorResult;
  }

  /**
   * Run function with timeout
   * @private
   */
  async _runWithTimeout(fn, timeout) {
    return new Promise(async (resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeout}ms`));
      }, timeout);

      try {
        const result = await fn();
        clearTimeout(timeoutHandle);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  /**
   * Resolve check execution order based on dependencies
   * @private
   */
  _resolveDependencies() {
    const resolved = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (checkName) => {
      if (visited.has(checkName)) return;
      if (visiting.has(checkName)) {
        throw new Error(`Circular dependency detected involving ${checkName}`);
      }

      const check = this.checks.get(checkName);
      if (!check) return;

      visiting.add(checkName);

      // Visit dependencies first
      for (const dependency of check.dependsOn) {
        visit(dependency);
      }

      visiting.delete(checkName);
      visited.add(checkName);
      resolved.push(checkName);
    };

    // Visit all checks
    for (const checkName of this.checks.keys()) {
      visit(checkName);
    }

    return resolved;
  }

  /**
   * Calculate overall health from individual check results
   * @private
   */
  _calculateOverallHealth(results) {
    const statuses = Object.values(results).map(r => r.status);
    
    if (statuses.length === 0) return 'unknown';
    
    const unhealthyCount = statuses.filter(s => s === 'unhealthy').length;
    const healthyCount = statuses.filter(s => s === 'healthy').length;
    
    if (unhealthyCount > 0) {
      return unhealthyCount === statuses.length ? 'unhealthy' : 'degraded';
    }
    
    return healthyCount === statuses.length ? 'healthy' : 'degraded';
  }

  /**
   * Record check result in history
   * @private
   */
  _recordCheckResult(checkName, result) {
    const history = this.checkHistory.get(checkName) || [];
    history.push(result);
    
    // Keep only recent history
    if (history.length > this.options.historySize) {
      history.shift();
    }
    
    this.checkHistory.set(checkName, history);
    this.lastResults.set(checkName, result);
  }

  /**
   * Notify health change listeners
   * @private
   */
  _notifyHealthChange(checkName, result) {
    for (const listener of this.changeListeners) {
      try {
        listener(checkName, result);
      } catch (error) {
        this.emit('change-listener-error', { 
          listener, 
          error, 
          checkName, 
          result 
        });
      }
    }
  }

  /**
   * Notify dependent checks when a check fails
   * @private
   */
  _notifyDependentChecks(failedCheck, result) {
    for (const [checkName, check] of this.checks.entries()) {
      if (check.dependsOn.includes(failedCheck)) {
        this.emit('dependency-failure', {
          dependentCheck: checkName,
          failedDependency: failedCheck,
          failureResult: result
        });
      }
    }
  }

  /**
   * Start periodic health checks
   * @private
   */
  _startPeriodicChecks() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    this.intervalTimer = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        this.emit('periodic-check-error', error);
      }
    }, this.options.checkInterval);
  }

  /**
   * Stop periodic health checks
   * @private
   */
  _stopPeriodicChecks() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}