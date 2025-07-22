/**
 * Performance Monitor
 * 
 * Tracks operation metrics, identifies bottlenecks,
 * and provides performance insights
 */

import { EventEmitter } from 'events';

export class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      metricsRetention: options.metricsRetention || 300000, // 5 minutes
      sampleRate: options.sampleRate || 1.0,
      enableGC: options.enableGC !== false,
      enableResourceTracking: options.enableResourceTracking !== false,
      ...options
    };

    // Metrics storage
    this.metrics = new Map(); // operation -> metrics
    this.resourceUsage = {
      memory: { heapUsed: 0, heapTotal: 0, heapUsedPercent: 0 },
      cpu: 0,
      connections: 0
    };
    
    // Baseline tracking for regression detection
    this.baselines = new Map();
    
    // Raw performance data
    this.performanceData = [];
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this._cleanup();
    }, this.options.metricsRetention);
  }

  /**
   * Measure operation performance
   */
  async measureOperation(operationName, operation) {
    // Sample based on configured rate
    if (Math.random() > this.options.sampleRate) {
      return await operation();
    }

    const startTime = Date.now();
    const startMemory = this._getMemoryUsage();
    
    let result, error;
    let success = true;

    try {
      result = await operation();
    } catch (e) {
      error = e;
      success = false;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const endMemory = this._getMemoryUsage();

    // Record metrics
    this._recordMetrics(operationName, {
      duration,
      success,
      startTime,
      endTime,
      memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
      error: error?.message
    });

    if (error) {
      throw error;
    }

    return result;
  }

  /**
   * Get metrics for specific operation
   */
  getMetrics(operationName) {
    const data = this.metrics.get(operationName);
    if (!data || data.measurements.length === 0) {
      return null;
    }

    const measurements = data.measurements;
    const durations = measurements.map(m => m.duration);
    const successes = measurements.filter(m => m.success).length;

    return {
      count: measurements.length,
      successRate: successes / measurements.length,
      averageTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minTime: Math.min(...durations),
      maxTime: Math.max(...durations),
      medianTime: this._calculateMedian(durations),
      p95Time: this._calculatePercentile(durations, 95),
      p99Time: this._calculatePercentile(durations, 99),
      lastUpdated: data.lastUpdated
    };
  }

  /**
   * Identify performance bottlenecks
   */
  identifyBottlenecks(threshold = 100) {
    const bottlenecks = [];
    
    for (const [operation, data] of this.metrics) {
      const metrics = this.getMetrics(operation);
      if (metrics && metrics.averageTime > threshold) {
        bottlenecks.push({
          operation,
          averageTime: metrics.averageTime,
          p95Time: metrics.p95Time,
          count: metrics.count,
          severity: this._calculateSeverity(metrics.averageTime, threshold)
        });
      }
    }

    return bottlenecks.sort((a, b) => b.averageTime - a.averageTime);
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport() {
    const allMetrics = {};
    let totalOperations = 0;
    let totalTime = 0;

    for (const [operation, _] of this.metrics) {
      const metrics = this.getMetrics(operation);
      if (metrics) {
        allMetrics[operation] = metrics;
        totalOperations += metrics.count;
        totalTime += metrics.averageTime * metrics.count;
      }
    }

    const averageResponseTime = totalOperations > 0 ? totalTime / totalOperations : 0;
    const bottlenecks = this.identifyBottlenecks();
    
    return {
      summary: {
        totalOperations,
        averageResponseTime,
        operationsPerSecond: this._calculateOpsPerSecond(),
        bottleneckCount: bottlenecks.length,
        healthScore: this._calculateHealthScore()
      },
      operations: allMetrics,
      bottlenecks,
      resourceUtilization: this.resourceUsage,
      recommendations: this._generateRecommendations(bottlenecks),
      timestamp: new Date()
    };
  }

  /**
   * Track resource usage
   */
  trackResourceUsage(usage) {
    if (usage.memory) {
      this.resourceUsage.memory = {
        ...usage.memory,
        heapUsedPercent: usage.memory.heapTotal > 0 ? 
          (usage.memory.heapUsed / usage.memory.heapTotal) * 100 : 0
      };
    }
    
    if (typeof usage.cpu === 'number') {
      this.resourceUsage.cpu = usage.cpu;
    }
    
    if (typeof usage.connections === 'number') {
      this.resourceUsage.connections = usage.connections;
    }

    this.emit('resource-update', this.resourceUsage);
  }

  /**
   * Get current resource utilization
   */
  getResourceUtilization() {
    return { ...this.resourceUsage };
  }

  /**
   * Record baseline for regression detection
   */
  recordBaseline(operationName) {
    const metrics = this.getMetrics(operationName);
    if (metrics) {
      this.baselines.set(operationName, {
        averageTime: metrics.averageTime,
        p95Time: metrics.p95Time,
        successRate: metrics.successRate,
        recordedAt: new Date()
      });
    }
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(threshold = 1.5) {
    const regressions = [];
    
    for (const [operation, baseline] of this.baselines) {
      const current = this.getMetrics(operation);
      if (current) {
        const regressionFactor = current.averageTime / baseline.averageTime;
        
        if (regressionFactor > threshold) {
          regressions.push({
            operation,
            regressionFactor,
            baselineTime: baseline.averageTime,
            currentTime: current.averageTime,
            degradation: ((current.averageTime - baseline.averageTime) / baseline.averageTime) * 100
          });
        }
      }
    }

    return regressions.sort((a, b) => b.regressionFactor - a.regressionFactor);
  }

  /**
   * Stop monitoring and cleanup
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Record metrics for an operation
   * @private
   */
  _recordMetrics(operationName, measurement) {
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, {
        measurements: [],
        lastUpdated: new Date()
      });
    }

    const data = this.metrics.get(operationName);
    data.measurements.push(measurement);
    data.lastUpdated = new Date();

    // Keep raw data for analysis
    this.performanceData.push({
      operation: operationName,
      timestamp: measurement.startTime,
      ...measurement
    });

    this.emit('measurement-recorded', {
      operation: operationName,
      measurement
    });
  }

  /**
   * Calculate median of array
   * @private
   */
  _calculateMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate percentile
   * @private
   */
  _calculatePercentile(arr, percentile) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate severity of bottleneck
   * @private
   */
  _calculateSeverity(averageTime, threshold) {
    const factor = averageTime / threshold;
    
    if (factor > 3) return 'critical';
    if (factor > 2) return 'high';
    if (factor > 1.5) return 'medium';
    return 'low';
  }

  /**
   * Calculate operations per second
   * @private
   */
  _calculateOpsPerSecond() {
    const now = Date.now();
    const lastMinute = now - 60000;
    
    const recentData = this.performanceData.filter(
      d => d.timestamp > lastMinute
    );
    
    return recentData.length / 60; // ops per second over last minute
  }

  /**
   * Calculate overall health score
   * @private
   */
  _calculateHealthScore() {
    let score = 100;
    const bottlenecks = this.identifyBottlenecks();
    
    // Deduct points for bottlenecks
    bottlenecks.forEach(b => {
      switch (b.severity) {
        case 'critical': score -= 20; break;
        case 'high': score -= 10; break;
        case 'medium': score -= 5; break;
        case 'low': score -= 2; break;
      }
    });
    
    // Consider resource utilization
    if (this.resourceUsage.memory.heapUsedPercent > 90) score -= 15;
    if (this.resourceUsage.memory.heapUsedPercent > 80) score -= 10;
    if (this.resourceUsage.cpu > 90) score -= 10;
    if (this.resourceUsage.cpu > 80) score -= 5;
    
    return Math.max(0, score);
  }

  /**
   * Generate optimization recommendations
   * @private
   */
  _generateRecommendations(bottlenecks) {
    const recommendations = [];
    
    if (bottlenecks.length > 0) {
      recommendations.push({
        type: 'bottleneck-optimization',
        message: `${bottlenecks.length} performance bottlenecks detected`,
        priority: bottlenecks[0].severity,
        actions: ['profile-slow-operations', 'optimize-algorithms', 'add-caching']
      });
    }
    
    if (this.resourceUsage.memory.heapUsedPercent > 80) {
      recommendations.push({
        type: 'memory-optimization',
        message: 'High memory usage detected',
        priority: this.resourceUsage.memory.heapUsedPercent > 90 ? 'critical' : 'high',
        actions: ['analyze-memory-leaks', 'optimize-data-structures', 'implement-gc-tuning']
      });
    }
    
    if (this.resourceUsage.cpu > 80) {
      recommendations.push({
        type: 'cpu-optimization',
        message: 'High CPU usage detected',
        priority: this.resourceUsage.cpu > 90 ? 'critical' : 'high',
        actions: ['optimize-algorithms', 'implement-concurrency', 'profile-cpu-usage']
      });
    }
    
    return recommendations;
  }

  /**
   * Get memory usage
   * @private
   */
  _getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return { heapUsed: 0, heapTotal: 0 };
  }

  /**
   * Cleanup old metrics data
   * @private
   */
  _cleanup() {
    const cutoff = Date.now() - this.options.metricsRetention;
    
    // Clean up performance data
    this.performanceData = this.performanceData.filter(
      d => d.timestamp > cutoff
    );
    
    // Clean up metrics measurements
    for (const [operation, data] of this.metrics) {
      data.measurements = data.measurements.filter(
        m => m.startTime > cutoff
      );
      
      // Remove empty entries
      if (data.measurements.length === 0) {
        this.metrics.delete(operation);
      }
    }
  }
}