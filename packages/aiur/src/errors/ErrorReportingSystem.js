/**
 * Error Reporting System
 * 
 * Provides error formatting, statistics, health monitoring,
 * and integration with external reporting systems
 */

import { EventEmitter } from 'events';
import { AiurError } from './AiurErrors.js';

export class ErrorReportingSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableTelemetry: options.enableTelemetry !== false,
      reportingThreshold: options.reportingThreshold || 'warning',
      maxErrorHistory: options.maxErrorHistory || 1000,
      healthCheckInterval: options.healthCheckInterval || 60000,
      alertThresholds: {
        errorRate: 0.1, // 10% error rate
        criticalErrors: 5, // 5 critical errors per minute
        ...options.alertThresholds
      },
      ...options
    };

    // Error tracking
    this.errorHistory = [];
    this.errorStatistics = {
      total: 0,
      byType: {},
      byHour: {},
      recentErrors: []
    };

    // Alerting
    this.alertHandlers = [];
    this.externalReporters = [];
    this.metricHandlers = [];

    // Health monitoring
    this.healthStatus = 'healthy';
    this.lastHealthCheck = null;
    this.healthCheckTimer = null;
    
    if (this.options.healthCheckInterval) {
      this._startHealthMonitoring();
    }
  }

  /**
   * Format error for reporting
   */
  formatErrorReport(error) {
    const timestamp = new Date();
    const severity = this._determineSeverity(error);
    
    const report = {
      id: this._generateErrorId(),
      type: this._classifyError(error),
      message: error.message,
      timestamp,
      severity,
      details: this._extractErrorDetails(error),
      stack: error.stack,
      context: error.context || {},
      tags: this._generateTags(error)
    };

    // Add system context
    report.systemContext = {
      memory: this._getMemoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform
    };

    return report;
  }

  /**
   * Record error occurrence
   */
  recordError(error) {
    const report = this.formatErrorReport(error);
    
    // Add to history
    this.errorHistory.push(report);
    if (this.errorHistory.length > this.options.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.options.maxErrorHistory);
    }

    // Update statistics
    this._updateStatistics(report);

    // Emit metrics
    this._emitMetrics(report);

    this.emit('error-recorded', report);
    
    return report;
  }

  /**
   * Report error with potential alerting
   */
  async reportError(error) {
    const report = this.recordError(error);
    
    // Check if we should send alerts
    if (this._shouldAlert(report)) {
      await this._sendAlert(report);
    }

    // Send to external reporters
    if (this.externalReporters.length > 0) {
      const formatted = this.formatErrorReport(error);
      await Promise.all(
        this.externalReporters.map(reporter => 
          this._safeReporterCall(reporter, { 
            error, 
            formatted, 
            severity: formatted.severity 
          })
        )
      );
    }

    return report;
  }

  /**
   * Get error statistics
   */
  getErrorStatistics() {
    const stats = { ...this.errorStatistics };
    
    // Calculate most common error types
    const typeEntries = Object.entries(stats.byType)
      .sort(([,a], [,b]) => b - a);
    
    stats.mostCommon = typeEntries.map(([type, count]) => ({ type, count }));
    
    // Calculate error rate (errors per minute)
    const recentErrors = this.errorHistory.filter(
      e => Date.now() - e.timestamp.getTime() < 60000
    );
    stats.errorRate = recentErrors.length;
    
    return stats;
  }

  /**
   * Generate health report
   */
  async generateHealthReport() {
    const stats = this.getErrorStatistics();
    const criticalErrors = this.errorHistory.filter(
      e => e.severity === 'critical' && 
           Date.now() - e.timestamp.getTime() < 60000
    ).length;

    // Determine overall health status
    let status = 'healthy';
    const recommendations = [];

    if (stats.errorRate > this.options.alertThresholds.errorRate * 60) {
      status = 'unhealthy';
      recommendations.push('High error rate detected - investigate recent failures');
    } else if (criticalErrors > 0) {
      status = 'degraded';
      recommendations.push('Critical errors present - review system stability');
    } else if (stats.errorRate > this.options.alertThresholds.errorRate * 30) {
      status = 'degraded';
      recommendations.push('Elevated error rate - monitor closely');
    }

    // Add specific recommendations based on error patterns
    if (stats.byType.network > stats.total * 0.5) {
      recommendations.push('High network error rate - check connectivity and timeouts');
    }

    if (stats.byType.validation > stats.total * 0.3) {
      recommendations.push('Many validation errors - review input data quality');
    }

    this.healthStatus = status;
    this.lastHealthCheck = new Date();

    return {
      status,
      errorRate: stats.errorRate,
      totalErrors: stats.total,
      criticalErrors,
      recommendations,
      timestamp: this.lastHealthCheck,
      uptime: process.uptime(),
      details: {
        errorsByType: stats.byType,
        recentTrend: this._calculateErrorTrend()
      }
    };
  }

  /**
   * Add alert handler
   */
  onAlert(handler) {
    this.alertHandlers.push(handler);
  }

  /**
   * Add external reporter
   */
  addExternalReporter(reporter) {
    this.externalReporters.push(reporter);
  }

  /**
   * Add metric handler
   */
  onMetric(handler) {
    this.metricHandlers.push(handler);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 10) {
    return this.errorHistory
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Search errors by criteria
   */
  searchErrors(criteria = {}) {
    let results = [...this.errorHistory];

    if (criteria.type) {
      results = results.filter(e => e.type === criteria.type);
    }

    if (criteria.severity) {
      results = results.filter(e => e.severity === criteria.severity);
    }

    if (criteria.timeRange) {
      const { start, end } = criteria.timeRange;
      results = results.filter(e => 
        e.timestamp >= start && e.timestamp <= end
      );
    }

    if (criteria.message) {
      const query = criteria.message.toLowerCase();
      results = results.filter(e => 
        e.message.toLowerCase().includes(query)
      );
    }

    return results;
  }

  /**
   * Generate error ID
   */
  _generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Classify error type
   */
  _classifyError(error) {
    if (error instanceof AiurError) {
      return error.constructor.name.replace('Error', '').toLowerCase();
    }

    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('execution') || message.includes('runtime')) {
      return 'execution';
    }
    
    return 'unknown';
  }

  /**
   * Determine error severity
   */
  _determineSeverity(error) {
    if (error instanceof AiurError && error.severity) {
      return error.severity;
    }

    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return 'critical';
    }
    if (message.includes('warning') || message.includes('warn')) {
      return 'warning';
    }
    
    return 'error';
  }

  /**
   * Extract error details
   */
  _extractErrorDetails(error) {
    if (error instanceof AiurError) {
      return error.details || {};
    }

    return {
      name: error.name,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall
    };
  }

  /**
   * Generate error tags
   */
  _generateTags(error) {
    const tags = [];
    
    if (error.context) {
      if (error.context.tool) tags.push(`tool:${error.context.tool}`);
      if (error.context.operation) tags.push(`op:${error.context.operation}`);
    }

    const type = this._classifyError(error);
    tags.push(`type:${type}`);
    
    return tags;
  }

  /**
   * Get memory usage
   */
  _getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(usage.rss / 1024 / 1024) // MB
      };
    }
    return {};
  }

  /**
   * Update error statistics
   */
  _updateStatistics(report) {
    this.errorStatistics.total++;
    
    // By type
    if (!this.errorStatistics.byType[report.type]) {
      this.errorStatistics.byType[report.type] = 0;
    }
    this.errorStatistics.byType[report.type]++;

    // By hour
    const hour = new Date(report.timestamp).getHours();
    if (!this.errorStatistics.byHour[hour]) {
      this.errorStatistics.byHour[hour] = 0;
    }
    this.errorStatistics.byHour[hour]++;

    // Recent errors (last 10)
    this.errorStatistics.recentErrors.push({
      id: report.id,
      type: report.type,
      message: report.message,
      timestamp: report.timestamp
    });
    
    if (this.errorStatistics.recentErrors.length > 10) {
      this.errorStatistics.recentErrors = this.errorStatistics.recentErrors.slice(-10);
    }
  }

  /**
   * Emit metrics
   */
  _emitMetrics(report) {
    const metrics = [
      {
        name: 'error.count',
        value: 1,
        tags: { type: report.type, severity: report.severity }
      },
      {
        name: 'error.rate',
        value: this.getErrorStatistics().errorRate,
        tags: {}
      }
    ];

    for (const metric of metrics) {
      for (const handler of this.metricHandlers) {
        try {
          handler(metric);
        } catch (error) {
          // Don't let metric handler errors crash the system
          // Metric handler error - continue without console output
        }
      }
    }
  }

  /**
   * Check if we should send alert
   */
  _shouldAlert(report) {
    if (report.severity === 'critical') {
      return true;
    }

    const stats = this.getErrorStatistics();
    if (stats.errorRate > this.options.alertThresholds.errorRate * 60) {
      return true;
    }

    return false;
  }

  /**
   * Send alert
   */
  async _sendAlert(report) {
    const alert = {
      level: report.severity,
      error: report,
      timestamp: new Date()
    };

    for (const handler of this.alertHandlers) {
      try {
        await handler(alert);
      } catch (error) {
        // Alert handler error - continue without console output
      }
    }
  }

  /**
   * Safe reporter call
   */
  async _safeReporterCall(reporter, data) {
    try {
      await reporter(data);
    } catch (error) {
      // External reporter error - continue without console output
    }
  }

  /**
   * Calculate error trend
   */
  _calculateErrorTrend() {
    const now = Date.now();
    const thirtyMinutesAgo = now - 30 * 60 * 1000;
    const sixtyMinutesAgo = now - 60 * 60 * 1000;

    const recent = this.errorHistory.filter(e => e.timestamp.getTime() > thirtyMinutesAgo).length;
    const older = this.errorHistory.filter(e => 
      e.timestamp.getTime() > sixtyMinutesAgo && 
      e.timestamp.getTime() <= thirtyMinutesAgo
    ).length;

    if (older === 0) return 'stable';
    
    const ratio = recent / older;
    if (ratio > 1.5) return 'increasing';
    if (ratio < 0.5) return 'decreasing';
    return 'stable';
  }

  /**
   * Start health monitoring
   */
  _startHealthMonitoring() {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.generateHealthReport();
        this.emit('health-check', {
          status: this.healthStatus,
          timestamp: this.lastHealthCheck
        });
      } catch (error) {
        // Health check error - continue without console output
      }
    }, this.options.healthCheckInterval);
  }

  /**
   * Stop health monitoring (cleanup)
   */
  destroy() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}