/**
 * MCPHealthChecker - Centralized health monitoring for MCP servers
 * 
 * Provides:
 * - Health status tracking for multiple servers
 * - Performance metrics collection
 * - Alert and notification system
 * - Health history and trends
 * - Automated remediation actions
 */

import { EventEmitter } from 'events';

export class MCPHealthChecker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      checkInterval: options.checkInterval || 30000, // 30 seconds
      historySize: options.historySize || 100, // Keep last 100 checks
      alertThresholds: {
        errorRate: options.errorRate || 0.1, // 10% error rate
        responseTime: options.responseTime || 5000, // 5 second response time
        memoryUsage: options.memoryUsage || 500, // 500MB memory usage
        restartCount: options.restartCount || 5, // 5 restarts per hour
        ...options.alertThresholds
      },
      remediation: {
        autoRestart: options.autoRestart !== false,
        maxAutoRestarts: options.maxAutoRestarts || 3,
        restartCooldown: options.restartCooldown || 300000, // 5 minutes
        ...options.remediation
      },
      ...options
    };
    
    // State
    this.servers = new Map(); // serverId -> ServerHealth
    this.alertHistory = [];
    this.checkTimer = null;
    this.started = false;
    
    // Global statistics
    this.globalStats = {
      totalChecks: 0,
      totalAlerts: 0,
      totalRemediations: 0,
      startTime: null
    };
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.started) return;
    
    this.started = true;
    this.globalStats.startTime = Date.now();
    
    this.checkTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.options.checkInterval);
    
    this.emit('health-monitor-started', {
      interval: this.options.checkInterval,
      serverCount: this.servers.size
    });
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (!this.started) return;
    
    this.started = false;
    
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    
    this.emit('health-monitor-stopped', {
      uptime: Date.now() - this.globalStats.startTime,
      totalChecks: this.globalStats.totalChecks,
      totalAlerts: this.globalStats.totalAlerts
    });
  }

  /**
   * Register a server for health monitoring
   */
  registerServer(serverProcess) {
    const serverId = serverProcess.serverId;
    
    if (this.servers.has(serverId)) {
      this.emit('warning', `Server ${serverId} already registered for health monitoring`);
      return;
    }
    
    const serverHealth = {
      serverId,
      serverProcess,
      status: 'unknown',
      lastCheck: null,
      history: [],
      metrics: {
        uptime: 0,
        requestCount: 0,
        errorCount: 0,
        errorRate: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
        restartCount: 0,
        lastRestart: null
      },
      alerts: {
        active: [],
        history: [],
        lastAlert: null,
        count: 0
      },
      remediation: {
        attempts: 0,
        lastAttempt: null,
        successCount: 0,
        failureCount: 0,
        cooldownUntil: null
      }
    };
    
    this.servers.set(serverId, serverHealth);
    
    // Set up event listeners for the server
    this.setupServerEventListeners(serverProcess, serverHealth);
    
    this.emit('server-registered', {
      serverId,
      totalServers: this.servers.size
    });
  }

  /**
   * Unregister a server from health monitoring
   */
  unregisterServer(serverId) {
    const serverHealth = this.servers.get(serverId);
    if (!serverHealth) return;
    
    // Clear any active alerts
    this.clearActiveAlerts(serverId);
    
    this.servers.delete(serverId);
    
    this.emit('server-unregistered', {
      serverId,
      totalServers: this.servers.size
    });
  }

  /**
   * Set up event listeners for a server process
   */
  setupServerEventListeners(serverProcess, serverHealth) {
    // Track server status changes
    serverProcess.on('started', () => {
      serverHealth.status = 'running';
      serverHealth.metrics.lastRestart = Date.now();
      this.recordEvent(serverHealth, 'started');
    });
    
    serverProcess.on('stopped', () => {
      serverHealth.status = 'stopped';
      this.recordEvent(serverHealth, 'stopped');
    });
    
    serverProcess.on('restarted', () => {
      serverHealth.metrics.restartCount++;
      serverHealth.metrics.lastRestart = Date.now();
      this.recordEvent(serverHealth, 'restarted');
    });
    
    serverProcess.on('tool-called', () => {
      serverHealth.metrics.requestCount++;
    });
    
    serverProcess.on('tool-call-failed', () => {
      serverHealth.metrics.errorCount++;
    });
    
    serverProcess.on('process-error', (info) => {
      this.handleServerError(serverHealth, info);
    });
    
    serverProcess.on('memory-limit-exceeded', (info) => {
      this.createAlert(serverHealth, 'memory', info);
    });
  }

  /**
   * Perform health checks on all registered servers
   */
  async performHealthChecks() {
    if (!this.started || this.servers.size === 0) return;
    
    this.globalStats.totalChecks++;
    
    const checkPromises = Array.from(this.servers.values()).map(serverHealth =>
      this.checkServerHealth(serverHealth)
    );
    
    await Promise.allSettled(checkPromises);
    
    // Analyze global health trends
    this.analyzeGlobalHealth();
    
    this.emit('health-check-completed', {
      serverCount: this.servers.size,
      timestamp: Date.now()
    });
  }

  /**
   * Check health of a specific server
   */
  async checkServerHealth(serverHealth) {
    const { serverId, serverProcess } = serverHealth;
    
    try {
      const startTime = Date.now();
      const status = serverProcess.getStatus();
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      serverHealth.metrics.uptime = status.uptime;
      serverHealth.metrics.requestCount = status.statistics.requestCount;
      serverHealth.metrics.errorCount = status.statistics.errorCount;
      serverHealth.metrics.errorRate = this.calculateErrorRate(serverHealth);
      serverHealth.metrics.avgResponseTime = this.updateAverageResponseTime(
        serverHealth.metrics.avgResponseTime,
        responseTime
      );
      
      // Record health check result
      const healthCheck = {
        timestamp: Date.now(),
        status: status.status,
        uptime: status.uptime,
        responseTime,
        errorRate: serverHealth.metrics.errorRate,
        memoryUsage: this.estimateMemoryUsage(status),
        healthy: this.isHealthy(serverHealth, status)
      };
      
      this.recordHealthCheck(serverHealth, healthCheck);
      
      // Check for alerts
      await this.evaluateAlerts(serverHealth, healthCheck);
      
    } catch (error) {
      this.handleHealthCheckError(serverHealth, error);
    }
  }

  /**
   * Record a health check result
   */
  recordHealthCheck(serverHealth, healthCheck) {
    serverHealth.history.push(healthCheck);
    serverHealth.lastCheck = healthCheck.timestamp;
    
    // Trim history to configured size
    if (serverHealth.history.length > this.options.historySize) {
      serverHealth.history = serverHealth.history.slice(-this.options.historySize);
    }
  }

  /**
   * Record a server event
   */
  recordEvent(serverHealth, eventType, data = {}) {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      ...data
    };
    
    if (!serverHealth.events) {
      serverHealth.events = [];
    }
    
    serverHealth.events.push(event);
    
    // Trim events history
    if (serverHealth.events.length > 50) {
      serverHealth.events = serverHealth.events.slice(-50);
    }
  }

  /**
   * Evaluate if alerts should be created
   */
  async evaluateAlerts(serverHealth, healthCheck) {
    const thresholds = this.options.alertThresholds;
    
    // Error rate alert
    if (healthCheck.errorRate > thresholds.errorRate) {
      this.createAlert(serverHealth, 'error_rate', {
        errorRate: healthCheck.errorRate,
        threshold: thresholds.errorRate
      });
    }
    
    // Response time alert
    if (healthCheck.responseTime > thresholds.responseTime) {
      this.createAlert(serverHealth, 'response_time', {
        responseTime: healthCheck.responseTime,
        threshold: thresholds.responseTime
      });
    }
    
    // Memory usage alert
    if (healthCheck.memoryUsage > thresholds.memoryUsage) {
      this.createAlert(serverHealth, 'memory_usage', {
        memoryUsage: healthCheck.memoryUsage,
        threshold: thresholds.memoryUsage
      });
    }
    
    // Restart count alert (per hour)
    const restartsInLastHour = this.getRestartsInPeriod(serverHealth, 60 * 60 * 1000);
    if (restartsInLastHour > thresholds.restartCount) {
      this.createAlert(serverHealth, 'restart_count', {
        restartCount: restartsInLastHour,
        threshold: thresholds.restartCount,
        period: '1 hour'
      });
    }
    
    // Health status alert
    if (!healthCheck.healthy) {
      this.createAlert(serverHealth, 'unhealthy', {
        status: healthCheck.status,
        uptime: healthCheck.uptime
      });
    }
  }

  /**
   * Create an alert
   */
  createAlert(serverHealth, alertType, data) {
    const alert = {
      id: `${serverHealth.serverId}-${alertType}-${Date.now()}`,
      serverId: serverHealth.serverId,
      type: alertType,
      severity: this.getAlertSeverity(alertType, data),
      message: this.formatAlertMessage(alertType, data),
      data,
      timestamp: Date.now(),
      resolved: false
    };
    
    // Check if similar alert already exists
    const existingAlert = serverHealth.alerts.active.find(a => 
      a.type === alertType && !a.resolved
    );
    
    if (existingAlert) {
      // Update existing alert
      existingAlert.count = (existingAlert.count || 1) + 1;
      existingAlert.lastOccurrence = Date.now();
      existingAlert.data = data;
      return;
    }
    
    // Add new alert
    serverHealth.alerts.active.push(alert);
    serverHealth.alerts.history.push(alert);
    serverHealth.alerts.lastAlert = Date.now();
    serverHealth.alerts.count++;
    
    this.globalStats.totalAlerts++;
    this.alertHistory.push(alert);
    
    this.emit('alert-created', alert);
    
    // Consider remediation
    if (this.shouldAttemptRemediation(serverHealth, alert)) {
      await this.attemptRemediation(serverHealth, alert);
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(serverId, alertId) {
    const serverHealth = this.servers.get(serverId);
    if (!serverHealth) return;
    
    const alert = serverHealth.alerts.active.find(a => a.id === alertId);
    if (!alert) return;
    
    alert.resolved = true;
    alert.resolvedAt = Date.now();
    
    // Remove from active alerts
    serverHealth.alerts.active = serverHealth.alerts.active.filter(a => a.id !== alertId);
    
    this.emit('alert-resolved', alert);
  }

  /**
   * Clear all active alerts for a server
   */
  clearActiveAlerts(serverId) {
    const serverHealth = this.servers.get(serverId);
    if (!serverHealth) return;
    
    for (const alert of serverHealth.alerts.active) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
    }
    
    serverHealth.alerts.active = [];
  }

  /**
   * Attempt automated remediation
   */
  async attemptRemediation(serverHealth, alert) {
    const { serverId } = serverHealth;
    
    // Check cooldown
    if (serverHealth.remediation.cooldownUntil && 
        Date.now() < serverHealth.remediation.cooldownUntil) {
      return;
    }
    
    // Check max attempts
    if (serverHealth.remediation.attempts >= this.options.remediation.maxAutoRestarts) {
      this.emit('remediation-max-attempts', {
        serverId,
        attempts: serverHealth.remediation.attempts
      });
      return;
    }
    
    this.emit('remediation-attempt', {
      serverId,
      alertType: alert.type,
      attempt: serverHealth.remediation.attempts + 1
    });
    
    try {
      // Different remediation strategies based on alert type
      switch (alert.type) {
        case 'unhealthy':
        case 'error_rate':
        case 'response_time':
          await this.restartServer(serverHealth);
          break;
        case 'memory_usage':
          await this.restartServer(serverHealth);
          break;
        default:
          this.emit('remediation-no-strategy', {
            serverId,
            alertType: alert.type
          });
          return;
      }
      
      serverHealth.remediation.attempts++;
      serverHealth.remediation.lastAttempt = Date.now();
      serverHealth.remediation.successCount++;
      
      // Set cooldown
      serverHealth.remediation.cooldownUntil = Date.now() + this.options.remediation.restartCooldown;
      
      this.globalStats.totalRemediations++;
      
      this.emit('remediation-success', {
        serverId,
        alertType: alert.type,
        action: 'restart'
      });
      
    } catch (error) {
      serverHealth.remediation.failureCount++;
      
      this.emit('remediation-failed', {
        serverId,
        alertType: alert.type,
        error: error.message
      });
    }
  }

  /**
   * Restart a server as remediation
   */
  async restartServer(serverHealth) {
    const { serverProcess } = serverHealth;
    
    if (!this.options.remediation.autoRestart) {
      throw new Error('Auto-restart is disabled');
    }
    
    await serverProcess.restart();
  }

  /**
   * Handle server error event
   */
  handleServerError(serverHealth, errorInfo) {
    this.createAlert(serverHealth, 'server_error', errorInfo);
  }

  /**
   * Handle health check error
   */
  handleHealthCheckError(serverHealth, error) {
    this.emit('health-check-error', {
      serverId: serverHealth.serverId,
      error: error.message
    });
    
    // Record failed health check
    const healthCheck = {
      timestamp: Date.now(),
      status: 'unknown',
      uptime: 0,
      responseTime: -1,
      errorRate: 1.0,
      memoryUsage: 0,
      healthy: false,
      error: error.message
    };
    
    this.recordHealthCheck(serverHealth, healthCheck);
  }

  /**
   * Calculate error rate for a server
   */
  calculateErrorRate(serverHealth) {
    const { requestCount, errorCount } = serverHealth.metrics;
    if (requestCount === 0) return 0;
    return errorCount / requestCount;
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(currentAvg, newTime) {
    if (currentAvg === 0) return newTime;
    return (currentAvg * 0.9) + (newTime * 0.1); // Exponential moving average
  }

  /**
   * Estimate memory usage from server status
   */
  estimateMemoryUsage(status) {
    // This is a placeholder - in practice you'd get actual memory stats
    return Math.random() * 100; // Random value for now
  }

  /**
   * Check if server is considered healthy
   */
  isHealthy(serverHealth, status) {
    const thresholds = this.options.alertThresholds;
    
    return (
      status.status === 'running' &&
      serverHealth.metrics.errorRate <= thresholds.errorRate &&
      status.uptime > 5000 // At least 5 seconds uptime
    );
  }

  /**
   * Get restart count in a given time period
   */
  getRestartsInPeriod(serverHealth, periodMs) {
    const cutoff = Date.now() - periodMs;
    
    if (!serverHealth.events) return 0;
    
    return serverHealth.events.filter(event => 
      event.type === 'restarted' && event.timestamp >= cutoff
    ).length;
  }

  /**
   * Determine alert severity
   */
  getAlertSeverity(alertType, data) {
    switch (alertType) {
      case 'server_error':
      case 'unhealthy':
        return 'critical';
      case 'memory_usage':
      case 'restart_count':
        return 'high';
      case 'error_rate':
      case 'response_time':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Format alert message
   */
  formatAlertMessage(alertType, data) {
    switch (alertType) {
      case 'error_rate':
        return `Error rate ${(data.errorRate * 100).toFixed(1)}% exceeds threshold ${(data.threshold * 100).toFixed(1)}%`;
      case 'response_time':
        return `Response time ${data.responseTime}ms exceeds threshold ${data.threshold}ms`;
      case 'memory_usage':
        return `Memory usage ${data.memoryUsage}MB exceeds threshold ${data.threshold}MB`;
      case 'restart_count':
        return `${data.restartCount} restarts in ${data.period} exceeds threshold ${data.threshold}`;
      case 'unhealthy':
        return `Server is unhealthy (status: ${data.status})`;
      case 'server_error':
        return `Server error: ${data.error}`;
      default:
        return `Alert: ${alertType}`;
    }
  }

  /**
   * Check if remediation should be attempted
   */
  shouldAttemptRemediation(serverHealth, alert) {
    if (!this.options.remediation.autoRestart) return false;
    
    // Only remediate for certain alert types
    const remediableAlerts = ['unhealthy', 'error_rate', 'response_time', 'memory_usage'];
    if (!remediableAlerts.includes(alert.type)) return false;
    
    // Check cooldown
    if (serverHealth.remediation.cooldownUntil && 
        Date.now() < serverHealth.remediation.cooldownUntil) {
      return false;
    }
    
    // Check max attempts
    return serverHealth.remediation.attempts < this.options.remediation.maxAutoRestarts;
  }

  /**
   * Analyze global health trends
   */
  analyzeGlobalHealth() {
    const healthyServers = Array.from(this.servers.values()).filter(s => 
      s.history.length > 0 && s.history[s.history.length - 1].healthy
    );
    
    const globalHealth = {
      totalServers: this.servers.size,
      healthyServers: healthyServers.length,
      unhealthyServers: this.servers.size - healthyServers.length,
      overallHealthPercentage: (healthyServers.length / this.servers.size) * 100,
      activeAlerts: this.getTotalActiveAlerts(),
      totalChecks: this.globalStats.totalChecks
    };
    
    this.emit('global-health-update', globalHealth);
  }

  /**
   * Get total number of active alerts across all servers
   */
  getTotalActiveAlerts() {
    return Array.from(this.servers.values())
      .reduce((total, server) => total + server.alerts.active.length, 0);
  }

  /**
   * Get health status for a specific server
   */
  getServerHealth(serverId) {
    return this.servers.get(serverId);
  }

  /**
   * Get health status for all servers
   */
  getAllServerHealth() {
    return Object.fromEntries(this.servers);
  }

  /**
   * Get global health statistics
   */
  getGlobalStatistics() {
    return {
      ...this.globalStats,
      uptime: this.globalStats.startTime ? Date.now() - this.globalStats.startTime : 0,
      serversRegistered: this.servers.size,
      activeAlerts: this.getTotalActiveAlerts(),
      alertHistory: this.alertHistory.length
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stop();
    this.servers.clear();
    this.alertHistory = [];
    this.removeAllListeners();
  }
}