/**
 * PerformanceMonitor - Advanced performance monitoring and alerting
 * 
 * Provides:
 * - Real-time performance metrics
 * - Alerting system with thresholds
 * - Historical data tracking
 * - Performance anomaly detection
 * - Automated performance reports
 */

import { EventEmitter } from 'events';
import os from 'os';
import { performance } from 'perf_hooks';

/**
 * Performance metric tracker
 */
class MetricTracker {
  constructor(name, windowSize = 100) {
    this.name = name;
    this.windowSize = windowSize;
    this.values = [];
    this.timestamps = [];
  }

  add(value) {
    const now = Date.now();
    this.values.push(value);
    this.timestamps.push(now);
    
    // Maintain window size
    if (this.values.length > this.windowSize) {
      this.values.shift();
      this.timestamps.shift();
    }
  }

  getStats() {
    if (this.values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...this.values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      recent: this.values[this.values.length - 1]
    };
  }

  getTrend() {
    if (this.values.length < 10) return 'stable';
    
    const recent = this.values.slice(-10);
    const older = this.values.slice(-20, -10);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 20) return 'increasing';
    if (change < -20) return 'decreasing';
    return 'stable';
  }
}

/**
 * Alert configuration
 */
class AlertRule {
  constructor(config) {
    this.name = config.name;
    this.metric = config.metric;
    this.condition = config.condition; // 'gt', 'lt', 'eq'
    this.threshold = config.threshold;
    this.duration = config.duration || 0; // How long condition must be true
    this.severity = config.severity || 'warning';
    this.cooldown = config.cooldown || 300000; // 5 min default
    
    this.triggered = false;
    this.triggerTime = null;
    this.lastAlert = null;
  }

  evaluate(value) {
    let conditionMet = false;
    
    switch (this.condition) {
      case 'gt':
        conditionMet = value > this.threshold;
        break;
      case 'lt':
        conditionMet = value < this.threshold;
        break;
      case 'eq':
        conditionMet = value === this.threshold;
        break;
    }
    
    if (conditionMet) {
      if (!this.triggered) {
        this.triggered = true;
        this.triggerTime = Date.now();
      }
      
      // Check duration requirement
      if (Date.now() - this.triggerTime >= this.duration) {
        // Check cooldown
        if (!this.lastAlert || Date.now() - this.lastAlert > this.cooldown) {
          this.lastAlert = Date.now();
          return {
            shouldAlert: true,
            rule: this.name,
            metric: this.metric,
            value,
            threshold: this.threshold,
            severity: this.severity
          };
        }
      }
    } else {
      this.triggered = false;
      this.triggerTime = null;
    }
    
    return { shouldAlert: false };
  }
}

/**
 * Performance monitoring system
 */
class PerformanceMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      sampleInterval: 1000, // 1 second
      historyDuration: 3600000, // 1 hour
      enableAnomalyDetection: true,
      enableAutoReporting: true,
      reportInterval: 300000, // 5 minutes
      ...config
    };
    
    // Metrics
    this.metrics = new Map();
    this.customMetrics = new Map();
    
    // Alerts
    this.alertRules = [];
    this.activeAlerts = new Map();
    
    // Monitoring state
    this.isMonitoring = false;
    this.intervalId = null;
    this.reportIntervalId = null;
    
    // Performance marks
    this.marks = new Map();
    this.measures = new Map();
    
    // Initialize default metrics
    this.initializeMetrics();
  }

  /**
   * Initialize default metrics
   */
  initializeMetrics() {
    // System metrics
    this.metrics.set('cpu', new MetricTracker('cpu'));
    this.metrics.set('memory', new MetricTracker('memory'));
    this.metrics.set('heapUsed', new MetricTracker('heapUsed'));
    this.metrics.set('heapTotal', new MetricTracker('heapTotal'));
    this.metrics.set('external', new MetricTracker('external'));
    this.metrics.set('eventLoop', new MetricTracker('eventLoop'));
    
    // Process metrics
    this.metrics.set('handles', new MetricTracker('handles'));
    this.metrics.set('requests', new MetricTracker('requests'));
    
    // Default alert rules
    this.addAlertRule({
      name: 'High CPU Usage',
      metric: 'cpu',
      condition: 'gt',
      threshold: 80,
      duration: 60000, // 1 minute
      severity: 'warning'
    });
    
    this.addAlertRule({
      name: 'Critical CPU Usage',
      metric: 'cpu',
      condition: 'gt',
      threshold: 95,
      duration: 30000, // 30 seconds
      severity: 'critical'
    });
    
    this.addAlertRule({
      name: 'High Memory Usage',
      metric: 'memory',
      condition: 'gt',
      threshold: 85,
      duration: 60000,
      severity: 'warning'
    });
    
    this.addAlertRule({
      name: 'Memory Leak Detection',
      metric: 'heapUsed',
      condition: 'gt',
      threshold: 1024 * 1024 * 1024, // 1GB
      duration: 300000, // 5 minutes
      severity: 'critical'
    });
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Start sampling
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.config.sampleInterval);
    
    // Start reporting
    if (this.config.enableAutoReporting) {
      this.reportIntervalId = setInterval(() => {
        this.generateReport();
      }, this.config.reportInterval);
    }
    
    // Initial collection
    this.collectMetrics();
    
    this.emit('started', {
      config: this.config,
      metrics: Array.from(this.metrics.keys())
    });
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.reportIntervalId) {
      clearInterval(this.reportIntervalId);
      this.reportIntervalId = null;
    }
    
    const finalReport = this.generateReport();
    
    this.emit('stopped', {
      report: finalReport
    });
  }

  /**
   * Collect metrics
   */
  async collectMetrics() {
    try {
      // CPU usage
      const cpuUsage = await this.getCPUUsage();
      this.recordMetric('cpu', cpuUsage);
      
      // Memory usage
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      
      this.recordMetric('memory', (usedMem / totalMem) * 100);
      this.recordMetric('heapUsed', memUsage.heapUsed);
      this.recordMetric('heapTotal', memUsage.heapTotal);
      this.recordMetric('external', memUsage.external);
      
      // Event loop lag
      const eventLoopLag = await this.measureEventLoopLag();
      this.recordMetric('eventLoop', eventLoopLag);
      
      // Active handles and requests
      if (process._getActiveHandles) {
        this.recordMetric('handles', process._getActiveHandles().length);
      }
      if (process._getActiveRequests) {
        this.recordMetric('requests', process._getActiveRequests().length);
      }
      
      // Check alerts
      this.checkAlerts();
      
      // Detect anomalies
      if (this.config.enableAnomalyDetection) {
        this.detectAnomalies();
      }
      
    } catch (error) {
      this.emit('error', {
        message: `Metric collection failed: ${error.message}`,
        error: error.message
      });
    }
  }

  /**
   * Get CPU usage
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        const elapsedTime = (endTime - startTime) * 1000; // Convert to microseconds
        
        const userPercent = (endUsage.user / elapsedTime) * 100;
        const systemPercent = (endUsage.system / elapsedTime) * 100;
        
        resolve(userPercent + systemPercent);
      }, 100);
    });
  }

  /**
   * Measure event loop lag
   */
  async measureEventLoopLag() {
    return new Promise((resolve) => {
      const start = performance.now();
      
      setImmediate(() => {
        const lag = performance.now() - start;
        resolve(lag);
      });
    });
  }

  /**
   * Record metric value
   */
  recordMetric(name, value) {
    const metric = this.metrics.get(name) || this.customMetrics.get(name);
    
    if (metric) {
      metric.add(value);
      
      this.emit('metric', {
        name,
        value,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Add custom metric
   */
  addCustomMetric(name, windowSize = 100) {
    if (!this.customMetrics.has(name)) {
      this.customMetrics.set(name, new MetricTracker(name, windowSize));
    }
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(name, value) {
    if (!this.customMetrics.has(name)) {
      this.addCustomMetric(name);
    }
    
    this.recordMetric(name, value);
  }

  /**
   * Add alert rule
   */
  addAlertRule(config) {
    const rule = new AlertRule(config);
    this.alertRules.push(rule);
  }

  /**
   * Check alerts
   */
  checkAlerts() {
    for (const rule of this.alertRules) {
      const metric = this.metrics.get(rule.metric) || this.customMetrics.get(rule.metric);
      
      if (metric) {
        const stats = metric.getStats();
        const result = rule.evaluate(stats.recent);
        
        if (result.shouldAlert) {
          this.triggerAlert(result);
        }
      }
    }
  }

  /**
   * Trigger alert
   */
  triggerAlert(alert) {
    const alertKey = `${alert.metric}-${alert.rule}`;
    
    this.activeAlerts.set(alertKey, {
      ...alert,
      timestamp: Date.now()
    });
    
    this.emit('alert', alert);
    
    // Auto-resolve alerts
    setTimeout(() => {
      if (this.activeAlerts.has(alertKey)) {
        this.activeAlerts.delete(alertKey);
        this.emit('alert:resolved', {
          ...alert,
          resolvedAt: Date.now()
        });
      }
    }, 300000); // 5 minutes
  }

  /**
   * Detect anomalies
   */
  detectAnomalies() {
    for (const [name, metric] of this.metrics) {
      const stats = metric.getStats();
      const trend = metric.getTrend();
      
      // Simple anomaly detection
      if (stats.count > 10) {
        const stdDev = this.calculateStdDev(metric.values);
        const threshold = stats.avg + (3 * stdDev); // 3 sigma
        
        if (stats.recent > threshold) {
          this.emit('anomaly', {
            metric: name,
            value: stats.recent,
            threshold,
            average: stats.avg,
            stdDev
          });
        }
      }
      
      // Trend-based anomalies
      if (trend === 'increasing' && name === 'heapUsed') {
        this.emit('anomaly', {
          metric: name,
          type: 'trend',
          trend: 'increasing',
          message: 'Potential memory leak detected'
        });
      }
    }
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Performance mark
   */
  mark(name) {
    this.marks.set(name, performance.now());
  }

  /**
   * Performance measure
   */
  measure(name, startMark, endMark = null) {
    const start = this.marks.get(startMark);
    if (!start) return null;
    
    const end = endMark ? this.marks.get(endMark) : performance.now();
    const duration = end - start;
    
    if (!this.measures.has(name)) {
      this.measures.set(name, new MetricTracker(name));
    }
    
    this.measures.get(name).add(duration);
    this.recordCustomMetric(`measure_${name}`, duration);
    
    return duration;
  }

  /**
   * Get metric statistics
   */
  getMetricStats(name) {
    const metric = this.metrics.get(name) || this.customMetrics.get(name);
    return metric ? metric.getStats() : null;
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const report = {
      timestamp: Date.now(),
      duration: this.isMonitoring ? Date.now() - this.startTime : 0,
      system: {},
      custom: {},
      measures: {},
      alerts: {
        active: Array.from(this.activeAlerts.values()),
        total: this.activeAlerts.size
      },
      health: this.calculateHealthScore()
    };
    
    // System metrics
    for (const [name, metric] of this.metrics) {
      report.system[name] = {
        ...metric.getStats(),
        trend: metric.getTrend()
      };
    }
    
    // Custom metrics
    for (const [name, metric] of this.customMetrics) {
      report.custom[name] = {
        ...metric.getStats(),
        trend: metric.getTrend()
      };
    }
    
    // Measures
    for (const [name, metric] of this.measures) {
      report.measures[name] = metric.getStats();
    }
    
    this.emit('report', report);
    
    return report;
  }

  /**
   * Calculate health score
   */
  calculateHealthScore() {
    let score = 100;
    
    // Deduct points for active alerts
    score -= this.activeAlerts.size * 10;
    
    // Check resource usage
    const cpu = this.getMetricStats('cpu');
    const memory = this.getMetricStats('memory');
    
    if (cpu && cpu.avg > 70) score -= 10;
    if (cpu && cpu.avg > 80) score -= 10;
    if (memory && memory.avg > 80) score -= 10;
    if (memory && memory.avg > 90) score -= 10;
    
    // Check trends
    const heapTrend = this.metrics.get('heapUsed')?.getTrend();
    if (heapTrend === 'increasing') score -= 15;
    
    return Math.max(0, score);
  }

  /**
   * Export metrics data
   */
  exportMetrics() {
    const data = {
      timestamp: Date.now(),
      metrics: {}
    };
    
    for (const [name, metric] of [...this.metrics, ...this.customMetrics]) {
      data.metrics[name] = {
        values: metric.values,
        timestamps: metric.timestamps
      };
    }
    
    return data;
  }
}

export { PerformanceMonitor };