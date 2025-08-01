/**
 * PerformanceMonitor - Performance tracking for TreeScribe parsers
 * Monitors parse times, memory usage, and performance metrics
 */

export class PerformanceMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.metrics = new Map();
    this.thresholds = {
      parseTime: options.parseTimeThreshold || 1000, // 1 second
      nodeCount: options.nodeCountThreshold || 10000,
      memoryDelta: options.memoryThreshold || 50 * 1024 * 1024 // 50MB
    };
  }

  /**
   * Start timing an operation
   * @param {string} operation - Operation name
   * @returns {Object} Timer object
   */
  startTimer(operation) {
    if (!this.enabled) return { stop: () => {} };
    
    const timer = {
      operation,
      startTime: performance.now(),
      startMemory: this._getMemoryUsage(),
      stop: () => this._stopTimer(timer)
    };
    
    return timer;
  }

  /**
   * Record a metric
   * @param {string} name - Metric name
   * @param {*} value - Metric value
   * @param {Object} metadata - Additional metadata
   */
  recordMetric(name, value, metadata = {}) {
    if (!this.enabled) return;
    
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      ...metadata
    };
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name).push(metric);
  }

  /**
   * Get performance summary
   * @returns {Object} Performance summary
   */
  getSummary() {
    const summary = {
      totalOperations: 0,
      averageParseTime: 0,
      maxParseTime: 0,
      totalNodeCount: 0,
      warnings: []
    };
    
    // Calculate parse times
    const parseTimes = this.metrics.get('parseTime') || [];
    if (parseTimes.length > 0) {
      summary.totalOperations = parseTimes.length;
      summary.averageParseTime = parseTimes.reduce((sum, m) => sum + m.value, 0) / parseTimes.length;
      summary.maxParseTime = Math.max(...parseTimes.map(m => m.value));
      
      // Check for slow parses
      const slowParses = parseTimes.filter(m => m.value > this.thresholds.parseTime);
      if (slowParses.length > 0) {
        summary.warnings.push({
          type: 'slow-parse',
          count: slowParses.length,
          threshold: this.thresholds.parseTime,
          details: slowParses.map(m => ({
            format: m.format,
            time: m.value,
            nodeCount: m.nodeCount
          }))
        });
      }
    }
    
    // Calculate node counts
    const nodeCounts = this.metrics.get('nodeCount') || [];
    if (nodeCounts.length > 0) {
      summary.totalNodeCount = nodeCounts.reduce((sum, m) => sum + m.value, 0);
      
      // Check for large documents
      const largeDocs = nodeCounts.filter(m => m.value > this.thresholds.nodeCount);
      if (largeDocs.length > 0) {
        summary.warnings.push({
          type: 'large-document',
          count: largeDocs.length,
          threshold: this.thresholds.nodeCount,
          details: largeDocs.map(m => ({
            format: m.format,
            nodeCount: m.value
          }))
        });
      }
    }
    
    // Memory usage
    const memoryDeltas = this.metrics.get('memoryDelta') || [];
    if (memoryDeltas.length > 0) {
      const largeMemoryUse = memoryDeltas.filter(m => m.value > this.thresholds.memoryDelta);
      if (largeMemoryUse.length > 0) {
        summary.warnings.push({
          type: 'high-memory',
          count: largeMemoryUse.length,
          threshold: this.thresholds.memoryDelta,
          details: largeMemoryUse.map(m => ({
            format: m.format,
            memoryDelta: m.value,
            nodeCount: m.nodeCount
          }))
        });
      }
    }
    
    return summary;
  }

  /**
   * Get metrics for specific operation
   * @param {string} operation - Operation name
   * @returns {Array} Metrics array
   */
  getMetrics(operation) {
    return this.metrics.get(operation) || [];
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics.clear();
  }

  /**
   * Create performance report
   * @param {string} format - Report format
   * @returns {string} Performance report
   */
  generateReport(format = 'text') {
    const summary = this.getSummary();
    
    if (format === 'text') {
      let report = 'TreeScribe Performance Report\n';
      report += '=============================\n\n';
      
      report += `Total Operations: ${summary.totalOperations}\n`;
      report += `Average Parse Time: ${summary.averageParseTime.toFixed(2)}ms\n`;
      report += `Max Parse Time: ${summary.maxParseTime.toFixed(2)}ms\n`;
      report += `Total Nodes Processed: ${summary.totalNodeCount}\n\n`;
      
      if (summary.warnings.length > 0) {
        report += 'Performance Warnings:\n';
        report += '-------------------\n';
        
        for (const warning of summary.warnings) {
          report += `\n${warning.type}: ${warning.count} occurrences\n`;
          report += `Threshold: ${warning.threshold}\n`;
          
          if (warning.details.length <= 3) {
            for (const detail of warning.details) {
              report += `  - ${JSON.stringify(detail)}\n`;
            }
          } else {
            report += `  - ${warning.details.length} items (showing first 3)\n`;
            for (let i = 0; i < 3; i++) {
              report += `    ${JSON.stringify(warning.details[i])}\n`;
            }
          }
        }
      }
      
      return report;
    }
    
    // JSON format
    return JSON.stringify(summary, null, 2);
  }

  /**
   * Monitor a parser operation
   * @param {Function} operation - Operation to monitor
   * @param {Object} context - Operation context
   * @returns {Function} Monitored operation
   */
  monitor(operation, context = {}) {
    if (!this.enabled) return operation;
    
    return async (...args) => {
      const timer = this.startTimer(context.operation || 'parse');
      
      try {
        const result = await operation(...args);
        const metrics = timer.stop();
        
        // Record additional metrics
        if (result && result.metadata) {
          this.recordMetric('nodeCount', result.metadata.nodeCount || 0, {
            format: context.format || result.sourceFormat,
            ...metrics
          });
        }
        
        return result;
        
      } catch (error) {
        timer.stop();
        throw error;
      }
    };
  }

  /**
   * Stop timer and record metrics
   * @private
   */
  _stopTimer(timer) {
    const endTime = performance.now();
    const endMemory = this._getMemoryUsage();
    
    const duration = endTime - timer.startTime;
    const memoryDelta = endMemory - timer.startMemory;
    
    // Record metrics
    this.recordMetric('parseTime', duration, {
      operation: timer.operation,
      memoryDelta
    });
    
    if (memoryDelta > 0) {
      this.recordMetric('memoryDelta', memoryDelta, {
        operation: timer.operation,
        duration
      });
    }
    
    return {
      duration,
      memoryDelta,
      operation: timer.operation
    };
  }

  /**
   * Get current memory usage
   * @private
   */
  _getMemoryUsage() {
    // Use performance.memory if available (Chrome)
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    
    // Fallback for Node.js
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return usage.heapUsed;
    }
    
    // Not available
    return 0;
  }
}

/**
 * Global performance monitor instance
 */
export const globalMonitor = new PerformanceMonitor();

/**
 * Performance decorator for parser methods
 * @param {string} operation - Operation name
 * @returns {Function} Method decorator
 */
export function monitored(operation) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const monitor = this.performanceMonitor || globalMonitor;
      const timer = monitor.startTimer(operation || propertyKey);
      
      try {
        const result = await originalMethod.apply(this, args);
        const metrics = timer.stop();
        
        // Add performance data to result
        if (result && typeof result === 'object') {
          result.performanceMetrics = metrics;
        }
        
        return result;
        
      } catch (error) {
        timer.stop();
        throw error;
      }
    };
    
    return descriptor;
  };
}