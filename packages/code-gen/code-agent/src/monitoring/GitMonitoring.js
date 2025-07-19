/**
 * GitMonitoring - Comprehensive monitoring and observability for Git operations
 * 
 * Provides metrics collection, performance monitoring, health checks,
 * and operational observability for the Git integration system.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import os from 'os';

class GitMonitoring extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableMetrics: config.enableMetrics !== false,
      enablePerformanceTracking: config.enablePerformanceTracking !== false,
      enableHealthChecks: config.enableHealthChecks !== false,
      enableResourceMonitoring: config.enableResourceMonitoring !== false,
      metricsRetentionPeriod: config.metricsRetentionPeriod || 3600000, // 1 hour
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      performanceThresholds: {
        commitTimeMs: config.commitTimeMs || 5000,
        pushTimeMs: config.pushTimeMs || 30000,
        branchTimeMs: config.branchTimeMs || 2000,
        ...config.performanceThresholds
      },
      alertThresholds: {
        errorRate: config.errorRate || 0.1, // 10%
        avgResponseTime: config.avgResponseTime || 2000, // 2 seconds
        memoryUsageMB: config.memoryUsageMB || 500,
        ...config.alertThresholds
      },
      ...config
    };
    
    // Metrics storage
    this.metrics = {
      operations: new Map(), // operation name -> metrics
      performance: [],
      errors: [],
      system: [],
      health: []
    };
    
    // Active operation tracking
    this.activeOperations = new Map();
    
    // Health check components
    this.healthChecks = new Map();
    
    // Monitoring intervals
    this.healthCheckInterval = null;
    this.metricsCleanupInterval = null;
    
    this.initialized = false;
  }
  
  /**
   * Initialize monitoring
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    // Register default health checks
    this.registerDefaultHealthChecks();
    
    // Start health check monitoring
    if (this.config.enableHealthChecks) {
      this.startHealthChecking();
    }
    
    // Start metrics cleanup
    this.startMetricsCleanup();
    
    this.initialized = true;
    
    this.emit('monitoring-initialized', {
      config: this.config,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Start tracking an operation
   */
  startOperation(operationId, operationType, metadata = {}) {
    if (!this.config.enablePerformanceTracking) {
      return null;
    }
    
    const operation = {
      id: operationId,
      type: operationType,
      startTime: performance.now(),
      startTimestamp: new Date(),
      metadata,
      memoryStart: process.memoryUsage(),
      cpuStart: process.cpuUsage()
    };
    
    this.activeOperations.set(operationId, operation);
    
    this.emit('operation-started', {
      operationId,
      operationType,
      metadata,
      timestamp: operation.startTimestamp.toISOString()
    });
    
    return operation;
  }
  
  /**
   * End tracking an operation
   */
  endOperation(operationId, result = {}) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return null;
    }
    
    const endTime = performance.now();
    const endTimestamp = new Date();
    const duration = endTime - operation.startTime;
    
    const memoryEnd = process.memoryUsage();
    const cpuEnd = process.cpuUsage(operation.cpuStart);
    
    const operationMetrics = {
      id: operation.id,
      type: operation.type,
      duration,
      startTimestamp: operation.startTimestamp,
      endTimestamp,
      success: result.success !== false,
      error: result.error,
      metadata: operation.metadata,
      resources: {
        memoryDelta: {
          rss: memoryEnd.rss - operation.memoryStart.rss,
          heapUsed: memoryEnd.heapUsed - operation.memoryStart.heapUsed,
          heapTotal: memoryEnd.heapTotal - operation.memoryStart.heapTotal
        },
        cpuTime: {
          user: cpuEnd.user,
          system: cpuEnd.system
        }
      }
    };
    
    // Store performance metrics
    this.metrics.performance.push(operationMetrics);
    
    // Update operation-specific metrics
    this.updateOperationMetrics(operation.type, operationMetrics);
    
    // Check performance thresholds
    this.checkPerformanceThresholds(operationMetrics);
    
    // Remove from active operations
    this.activeOperations.delete(operationId);
    
    this.emit('operation-completed', {
      operationId: operation.id,
      operationType: operation.type,
      duration,
      success: operationMetrics.success,
      timestamp: endTimestamp.toISOString()
    });
    
    return operationMetrics;
  }
  
  /**
   * Record an error
   */
  recordError(error, context = {}) {
    const errorMetric = {
      type: error.name || 'Error',
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    };
    
    this.metrics.errors.push(errorMetric);
    
    this.emit('error-recorded', {
      errorType: errorMetric.type,
      context,
      timestamp: errorMetric.timestamp.toISOString()
    });
    
    // Check error rate thresholds
    this.checkErrorRateThresholds();
  }
  
  /**
   * Update operation-specific metrics
   */
  updateOperationMetrics(operationType, operationMetrics) {
    if (!this.metrics.operations.has(operationType)) {
      this.metrics.operations.set(operationType, {
        count: 0,
        successCount: 0,
        errorCount: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        avgDuration: 0,
        recentOperations: []
      });
    }
    
    const opMetrics = this.metrics.operations.get(operationType);
    
    opMetrics.count++;
    opMetrics.totalDuration += operationMetrics.duration;
    opMetrics.avgDuration = opMetrics.totalDuration / opMetrics.count;
    opMetrics.minDuration = Math.min(opMetrics.minDuration, operationMetrics.duration);
    opMetrics.maxDuration = Math.max(opMetrics.maxDuration, operationMetrics.duration);
    
    if (operationMetrics.success) {
      opMetrics.successCount++;
    } else {
      opMetrics.errorCount++;
    }
    
    // Store recent operations (last 10)
    opMetrics.recentOperations.push({
      duration: operationMetrics.duration,
      success: operationMetrics.success,
      timestamp: operationMetrics.endTimestamp
    });
    
    if (opMetrics.recentOperations.length > 10) {
      opMetrics.recentOperations.shift();
    }
  }
  
  /**
   * Check performance thresholds
   */
  checkPerformanceThresholds(operationMetrics) {
    const { type, duration } = operationMetrics;
    const threshold = this.config.performanceThresholds[`${type}TimeMs`];
    
    if (threshold && duration > threshold) {
      this.emit('performance-threshold-exceeded', {
        operationType: type,
        duration,
        threshold,
        operationId: operationMetrics.id,
        timestamp: operationMetrics.endTimestamp.toISOString()
      });
    }
  }
  
  /**
   * Check error rate thresholds
   */
  checkErrorRateThresholds() {
    const recentErrors = this.getRecentErrors(300000); // Last 5 minutes
    const recentOperations = this.getRecentOperations(300000);
    
    if (recentOperations.length === 0) return;
    
    const errorRate = recentErrors.length / recentOperations.length;
    
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.emit('error-rate-threshold-exceeded', {
        errorRate,
        threshold: this.config.alertThresholds.errorRate,
        recentErrors: recentErrors.length,
        recentOperations: recentOperations.length,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Register default health checks
   */
  registerDefaultHealthChecks() {
    this.registerHealthCheck('memory-usage', this.checkMemoryUsage.bind(this));
    this.registerHealthCheck('git-operations', this.checkGitOperationsHealth.bind(this));
    this.registerHealthCheck('error-rate', this.checkErrorRate.bind(this));
    this.registerHealthCheck('response-time', this.checkResponseTime.bind(this));
    this.registerHealthCheck('active-operations', this.checkActiveOperations.bind(this));
  }
  
  /**
   * Register a health check
   */
  registerHealthCheck(name, checkFunction) {
    this.healthChecks.set(name, checkFunction);
  }
  
  /**
   * Start health check monitoring
   */
  startHealthChecking() {
    if (this.healthCheckInterval) {
      return;
    }
    
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
    
    console.log('🏥 Git monitoring health checks started');
  }
  
  /**
   * Perform all health checks
   */
  async performHealthChecks() {
    const healthReport = {
      overall: 'healthy',
      checks: {},
      timestamp: new Date()
    };
    
    for (const [name, checkFunction] of this.healthChecks) {
      try {
        const result = await checkFunction();
        healthReport.checks[name] = result;
        
        if (result.status !== 'healthy') {
          healthReport.overall = result.status === 'critical' ? 'critical' : 'warning';
        }
      } catch (error) {
        healthReport.checks[name] = {
          status: 'error',
          message: `Health check failed: ${error.message}`,
          timestamp: new Date()
        };
        healthReport.overall = 'critical';
      }
    }
    
    this.metrics.health.push(healthReport);
    
    if (healthReport.overall !== 'healthy') {
      this.emit('health-check-alert', {
        overall: healthReport.overall,
        checks: healthReport.checks,
        timestamp: healthReport.timestamp.toISOString()
      });
    }
    
    return healthReport;
  }
  
  /**
   * Health check implementations
   */
  async checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.rss / 1024 / 1024;
    const threshold = this.config.alertThresholds.memoryUsageMB;
    
    return {
      status: memUsageMB > threshold ? 'warning' : 'healthy',
      message: `Memory usage: ${Math.round(memUsageMB)}MB`,
      value: memUsageMB,
      threshold,
      timestamp: new Date()
    };
  }
  
  async checkGitOperationsHealth() {
    const recentOps = this.getRecentOperations(300000); // Last 5 minutes
    
    if (recentOps.length === 0) {
      return {
        status: 'healthy',
        message: 'No recent Git operations',
        timestamp: new Date()
      };
    }
    
    const successfulOps = recentOps.filter(op => op.success).length;
    const successRate = successfulOps / recentOps.length;
    
    return {
      status: successRate < 0.8 ? 'warning' : 'healthy',
      message: `Git operations success rate: ${Math.round(successRate * 100)}%`,
      value: successRate,
      recentOperations: recentOps.length,
      timestamp: new Date()
    };
  }
  
  async checkErrorRate() {
    const recentErrors = this.getRecentErrors(300000);
    const recentOps = this.getRecentOperations(300000);
    
    if (recentOps.length === 0) {
      return {
        status: 'healthy',
        message: 'No recent operations',
        timestamp: new Date()
      };
    }
    
    const errorRate = recentErrors.length / recentOps.length;
    const threshold = this.config.alertThresholds.errorRate;
    
    return {
      status: errorRate > threshold ? 'warning' : 'healthy',
      message: `Error rate: ${Math.round(errorRate * 100)}%`,
      value: errorRate,
      threshold,
      timestamp: new Date()
    };
  }
  
  async checkResponseTime() {
    const recentOps = this.getRecentOperations(300000);
    
    if (recentOps.length === 0) {
      return {
        status: 'healthy',
        message: 'No recent operations',
        timestamp: new Date()
      };
    }
    
    const avgResponseTime = recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length;
    const threshold = this.config.alertThresholds.avgResponseTime;
    
    return {
      status: avgResponseTime > threshold ? 'warning' : 'healthy',
      message: `Average response time: ${Math.round(avgResponseTime)}ms`,
      value: avgResponseTime,
      threshold,
      timestamp: new Date()
    };
  }
  
  async checkActiveOperations() {
    const activeCount = this.activeOperations.size;
    const longRunningOps = Array.from(this.activeOperations.values())
      .filter(op => performance.now() - op.startTime > 30000); // 30 seconds
    
    return {
      status: longRunningOps.length > 0 ? 'warning' : 'healthy',
      message: `Active operations: ${activeCount}, Long-running: ${longRunningOps.length}`,
      activeOperations: activeCount,
      longRunningOperations: longRunningOps.length,
      timestamp: new Date()
    };
  }
  
  /**
   * Get recent operations
   */
  getRecentOperations(timeWindowMs) {
    const cutoff = Date.now() - timeWindowMs;
    return this.metrics.performance.filter(op => 
      op.endTimestamp.getTime() > cutoff
    );
  }
  
  /**
   * Get recent errors
   */
  getRecentErrors(timeWindowMs) {
    const cutoff = Date.now() - timeWindowMs;
    return this.metrics.errors.filter(err => 
      err.timestamp.getTime() > cutoff
    );
  }
  
  /**
   * Get comprehensive metrics
   */
  getMetrics() {
    const now = new Date();
    
    return {
      timestamp: now.toISOString(),
      operations: Object.fromEntries(
        Array.from(this.metrics.operations.entries()).map(([type, metrics]) => [
          type,
          {
            ...metrics,
            successRate: metrics.count > 0 ? metrics.successCount / metrics.count : 0,
            errorRate: metrics.count > 0 ? metrics.errorCount / metrics.count : 0
          }
        ])
      ),
      performance: {
        totalOperations: this.metrics.performance.length,
        recentOperations: this.getRecentOperations(3600000).length, // Last hour
        avgResponseTime: this.calculateAverageResponseTime(),
        operationsByType: this.getOperationCountsByType()
      },
      errors: {
        totalErrors: this.metrics.errors.length,
        recentErrors: this.getRecentErrors(3600000).length,
        errorsByType: this.getErrorCountsByType(),
        errorRate: this.calculateErrorRate()
      },
      system: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime(),
        activeOperations: this.activeOperations.size
      },
      health: {
        lastCheck: this.metrics.health.length > 0 
          ? this.metrics.health[this.metrics.health.length - 1] 
          : null,
        checksEnabled: this.config.enableHealthChecks,
        registeredChecks: Array.from(this.healthChecks.keys())
      }
    };
  }
  
  /**
   * Get performance summary
   */
  getPerformanceSummary(timeWindowMs = 3600000) {
    const recentOps = this.getRecentOperations(timeWindowMs);
    
    if (recentOps.length === 0) {
      return {
        period: timeWindowMs,
        operationCount: 0,
        message: 'No operations in the specified time period'
      };
    }
    
    const avgDuration = recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length;
    const minDuration = Math.min(...recentOps.map(op => op.duration));
    const maxDuration = Math.max(...recentOps.map(op => op.duration));
    const successfulOps = recentOps.filter(op => op.success).length;
    
    return {
      period: timeWindowMs,
      operationCount: recentOps.length,
      successRate: successfulOps / recentOps.length,
      avgDuration: Math.round(avgDuration),
      minDuration: Math.round(minDuration),
      maxDuration: Math.round(maxDuration),
      operationTypes: this.getOperationTypeBreakdown(recentOps)
    };
  }
  
  /**
   * Calculate metrics
   */
  calculateAverageResponseTime() {
    const recentOps = this.getRecentOperations(3600000);
    if (recentOps.length === 0) return 0;
    
    return recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length;
  }
  
  calculateErrorRate() {
    const recentOps = this.getRecentOperations(3600000);
    const recentErrors = this.getRecentErrors(3600000);
    
    if (recentOps.length === 0) return 0;
    return recentErrors.length / recentOps.length;
  }
  
  getOperationCountsByType() {
    const counts = {};
    for (const [type, metrics] of this.metrics.operations) {
      counts[type] = metrics.count;
    }
    return counts;
  }
  
  getErrorCountsByType() {
    const counts = {};
    for (const error of this.metrics.errors) {
      counts[error.type] = (counts[error.type] || 0) + 1;
    }
    return counts;
  }
  
  getOperationTypeBreakdown(operations) {
    const breakdown = {};
    for (const op of operations) {
      breakdown[op.type] = (breakdown[op.type] || 0) + 1;
    }
    return breakdown;
  }
  
  /**
   * Start metrics cleanup
   */
  startMetricsCleanup() {
    this.metricsCleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.config.metricsRetentionPeriod / 4); // Cleanup every quarter of retention period
  }
  
  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.config.metricsRetentionPeriod;
    
    // Clean up performance metrics
    const initialPerfCount = this.metrics.performance.length;
    this.metrics.performance = this.metrics.performance.filter(metric => 
      metric.endTimestamp.getTime() > cutoff
    );
    
    // Clean up error metrics
    const initialErrorCount = this.metrics.errors.length;
    this.metrics.errors = this.metrics.errors.filter(error => 
      error.timestamp.getTime() > cutoff
    );
    
    // Clean up health metrics
    const initialHealthCount = this.metrics.health.length;
    this.metrics.health = this.metrics.health.filter(health => 
      health.timestamp.getTime() > cutoff
    );
    
    const cleaned = {
      performance: initialPerfCount - this.metrics.performance.length,
      errors: initialErrorCount - this.metrics.errors.length,
      health: initialHealthCount - this.metrics.health.length
    };
    
    if (cleaned.performance > 0 || cleaned.errors > 0 || cleaned.health > 0) {
      console.log(`🧹 Cleaned up old metrics: ${cleaned.performance} performance, ${cleaned.errors} errors, ${cleaned.health} health`);
    }
  }
  
  /**
   * Generate monitoring report
   */
  generateReport(options = {}) {
    const timeWindow = options.timeWindow || 3600000; // 1 hour default
    const includeLongRunning = options.includeLongRunning !== false;
    
    const report = {
      generatedAt: new Date().toISOString(),
      timeWindow,
      metrics: this.getMetrics(),
      performance: this.getPerformanceSummary(timeWindow),
      healthStatus: this.metrics.health.length > 0 
        ? this.metrics.health[this.metrics.health.length - 1] 
        : { overall: 'unknown', message: 'No health checks performed' }
    };
    
    if (includeLongRunning && this.activeOperations.size > 0) {
      report.activeOperations = Array.from(this.activeOperations.values()).map(op => ({
        id: op.id,
        type: op.type,
        duration: performance.now() - op.startTime,
        startTime: op.startTimestamp.toISOString(),
        metadata: op.metadata
      }));
    }
    
    return report;
  }
  
  /**
   * Cleanup monitoring
   */
  async cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval);
      this.metricsCleanupInterval = null;
    }
    
    this.removeAllListeners();
    
    console.log('🧹 Git monitoring cleanup completed');
  }
}

export default GitMonitoring;