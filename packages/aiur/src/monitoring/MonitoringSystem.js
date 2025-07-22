/**
 * Monitoring System
 * 
 * Collects metrics, detects anomalies, manages alerting rules,
 * and provides dashboard data aggregation
 */

import { EventEmitter } from 'events';

export class MonitoringSystem extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      metricsInterval: options.metricsInterval || 60000, // 1 minute
      metricsRetention: options.metricsRetention || 3600000, // 1 hour
      enableHealthChecks: options.enableHealthChecks !== false,
      alerting: {
        enabled: true,
        channels: ['console'],
        ...options.alerting
      },
      ...options
    };

    // Metrics storage
    this.metrics = new Map();
    this.metricHistory = new Map();
    
    // Alerting
    this.alertRules = [];
    this.alertHandlers = [];
    this.recentAlerts = [];
    
    // Anomaly detection
    this.baselines = new Map();
    this.anomalyThresholds = {
      spike: 2.0, // 2x standard deviation
      drop: -2.0,
      trend: 0.05 // 5% change per minute
    };

    // System state
    this.enabled = true;
    this.startTime = Date.now();
    
    // Start periodic tasks
    this.metricsTimer = setInterval(() => {
      this._processMetrics();
    }, this.options.metricsInterval);

    this.cleanupTimer = setInterval(() => {
      this._cleanup();
    }, this.options.metricsRetention);
  }

  /**
   * Record a metric
   */
  recordMetric(name, value, tags = {}) {
    if (!this.enabled) return;

    const timestamp = Date.now();
    const metric = {
      name,
      value,
      tags,
      timestamp
    };

    // Store in current metrics with proper aggregation by tags
    const metricKey = this._getMetricKey(name, tags);
    
    if (!this.metrics.has(metricKey)) {
      this.metrics.set(metricKey, {
        name,
        value: 0,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
        tags: { ...tags }
      });
    }

    const currentMetric = this.metrics.get(metricKey);
    currentMetric.count++;
    currentMetric.sum += value;
    currentMetric.value = value; // Latest value
    currentMetric.min = Math.min(currentMetric.min, value);
    currentMetric.max = Math.max(currentMetric.max, value);
    currentMetric.avg = currentMetric.sum / currentMetric.count;
    currentMetric.lastUpdated = timestamp;
    
    // Also aggregate by name only (sum across all tag combinations)
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        value: 0,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
        tags: {}
      });
    }
    
    const nameOnlyMetric = this.metrics.get(name);
    nameOnlyMetric.count++;
    nameOnlyMetric.sum += value;
    
    // For count-type metrics, use the count; for others, use latest value
    if (name.includes('count') || name.includes('total')) {
      nameOnlyMetric.value = nameOnlyMetric.count;
    } else {
      nameOnlyMetric.value = value; // Latest value for this metric name
    }
    
    nameOnlyMetric.min = Math.min(nameOnlyMetric.min, value);
    nameOnlyMetric.max = Math.max(nameOnlyMetric.max, value);
    nameOnlyMetric.avg = nameOnlyMetric.sum / nameOnlyMetric.count;
    nameOnlyMetric.lastUpdated = timestamp;

    // Store in history
    if (!this.metricHistory.has(name)) {
      this.metricHistory.set(name, []);
    }
    this.metricHistory.get(name).push(metric);

    this.emit('metric-recorded', metric);

    // Check for anomalies and alerts
    this._checkAnomalies(name, value);
    this._checkAlerts();
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const result = {};
    for (const [name, metric] of this.metrics.entries()) {
      result[name] = { ...metric };
    }
    return result;
  }

  /**
   * Get metric history
   */
  getMetricHistory(name, timeRange = null) {
    const history = this.metricHistory.get(name) || [];
    
    if (timeRange) {
      const startTime = Date.now() - timeRange;
      return history.filter(h => h.timestamp > startTime);
    }
    
    return history;
  }

  /**
   * Detect anomalies in metrics
   */
  detectAnomalies(timeWindow = 300000) { // 5 minutes
    const anomalies = [];
    const now = Date.now();

    for (const [name, history] of this.metricHistory.entries()) {
      const recentHistory = history.filter(h => h.timestamp > now - timeWindow);
      
      if (recentHistory.length < 5) continue; // Need enough data

      const values = recentHistory.map(h => h.value);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Check latest value against baseline
      const latestValue = values[values.length - 1];
      const zScore = stdDev > 0 ? (latestValue - mean) / stdDev : 0;

      if (Math.abs(zScore) > Math.abs(this.anomalyThresholds.spike)) {
        const severity = Math.abs(zScore) > 3 ? 'critical' : 'warning';
        
        anomalies.push({
          metric: name,
          type: zScore > 0 ? 'spike' : 'drop',
          value: latestValue,
          baseline: mean,
          zScore,
          severity,
          timestamp: now
        });
      }

      // Check for trends
      if (values.length >= 10) {
        const trend = this._calculateTrend(values.slice(-10));
        if (Math.abs(trend) > this.anomalyThresholds.trend) {
          anomalies.push({
            metric: name,
            type: 'trend',
            trend,
            severity: 'info',
            timestamp: now
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule) {
    const alertRule = {
      id: rule.id || this._generateId(),
      name: rule.name,
      condition: rule.condition,
      severity: rule.severity || 'warning',
      message: rule.message,
      enabled: rule.enabled !== false,
      cooldown: rule.cooldown || 300000, // 5 minutes
      lastTriggered: 0,
      ...rule
    };

    this.alertRules.push(alertRule);
    this.emit('alert-rule-added', alertRule);
    return alertRule.id;
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId) {
    const index = this.alertRules.findIndex(rule => rule.id === ruleId);
    if (index >= 0) {
      const removedRule = this.alertRules.splice(index, 1)[0];
      this.emit('alert-rule-removed', removedRule);
      return true;
    }
    return false;
  }

  /**
   * Get alert rules
   */
  getAlertRules() {
    return [...this.alertRules];
  }

  /**
   * Register alert handler
   */
  onAlert(handler) {
    this.alertHandlers.push(handler);
  }

  /**
   * Trigger alert manually
   */
  triggerAlert(alertData) {
    const alert = {
      id: this._generateId(),
      timestamp: new Date(),
      ...alertData
    };

    this.recentAlerts.push(alert);
    this.emit('alert-triggered', alert);

    // Send to handlers
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (error) {
        this.emit('alert-handler-error', { handler, error, alert });
      }
    }
  }

  /**
   * Get dashboard data
   */
  getDashboardData() {
    const systemHealth = this._calculateSystemHealth();
    const keyMetrics = this._getKeyMetrics();
    const recentAlerts = this.recentAlerts.slice(-10);
    const trends = this._calculateMetricTrends();

    return {
      systemHealth,
      keyMetrics,
      alerts: recentAlerts,
      trends,
      uptime: Date.now() - this.startTime,
      metricsCount: this.metrics.size,
      timestamp: new Date()
    };
  }

  /**
   * Apply configuration
   */
  async applyConfiguration(config) {
    this.enabled = config.enabled !== false;
    
    if (config.metricsInterval) {
      this.options.metricsInterval = config.metricsInterval;
      
      // Restart timer with new interval
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
        this.metricsTimer = setInterval(() => {
          this._processMetrics();
        }, this.options.metricsInterval);
      }
    }

    if (config.alertRules) {
      this.alertRules = [];
      for (const rule of config.alertRules) {
        this.addAlertRule(rule);
      }
    }

    this.emit('configuration-applied', config);
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Stop monitoring system
   */
  async stop() {
    this.enabled = false;
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.emit('monitoring-stopped');
  }

  /**
   * Process metrics and check alerts
   * @private
   */
  _processMetrics() {
    if (!this.enabled) return;

    // Update baselines
    this._updateBaselines();
    
    // Check alerts
    this._checkAlerts();
    
    this.emit('metrics-processed', {
      metricsCount: this.metrics.size,
      timestamp: new Date()
    });
  }

  /**
   * Check anomalies for a specific metric
   * @private
   */
  _checkAnomalies(metricName, value) {
    const history = this.metricHistory.get(metricName) || [];
    if (history.length < 10) return; // Need baseline

    const baseline = this.baselines.get(metricName);
    if (!baseline) return;

    const zScore = baseline.stdDev > 0 ? (value - baseline.mean) / baseline.stdDev : 0;
    
    if (Math.abs(zScore) > Math.abs(this.anomalyThresholds.spike)) {
      this.emit('anomaly-detected', {
        metric: metricName,
        value,
        baseline: baseline.mean,
        zScore,
        type: zScore > 0 ? 'spike' : 'drop'
      });
    }
  }

  /**
   * Check alert rules
   * @private
   */
  _checkAlerts() {
    const currentMetrics = this.getMetrics();
    const now = Date.now();

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;
      
      // Check cooldown
      if (now - rule.lastTriggered < rule.cooldown) continue;

      try {
        if (rule.condition(currentMetrics)) {
          rule.lastTriggered = now;
          
          this.triggerAlert({
            rule: rule.name,
            severity: rule.severity,
            message: rule.message,
            metrics: currentMetrics
          });
        }
      } catch (error) {
        this.emit('alert-rule-error', { rule, error });
      }
    }
  }

  /**
   * Update metric baselines
   * @private
   */
  _updateBaselines() {
    const timeWindow = 600000; // 10 minutes
    const now = Date.now();

    for (const [name, history] of this.metricHistory.entries()) {
      const recentHistory = history.filter(h => h.timestamp > now - timeWindow);
      
      if (recentHistory.length >= 10) {
        const values = recentHistory.map(h => h.value);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        this.baselines.set(name, { mean, stdDev, sampleSize: values.length });
      }
    }
  }

  /**
   * Calculate system health score
   * @private
   */
  _calculateSystemHealth() {
    const recentAlerts = this.recentAlerts.filter(
      alert => Date.now() - alert.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const criticalAlerts = recentAlerts.filter(alert => alert.severity === 'critical').length;
    const warningAlerts = recentAlerts.filter(alert => alert.severity === 'warning').length;

    let score = 100;
    score -= criticalAlerts * 20;
    score -= warningAlerts * 10;

    const status = score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'unhealthy';

    return {
      score: Math.max(0, score),
      status,
      criticalAlerts,
      warningAlerts,
      totalAlerts: recentAlerts.length
    };
  }

  /**
   * Get key metrics for dashboard
   * @private
   */
  _getKeyMetrics() {
    const keyMetrics = [];
    
    for (const [name, metric] of this.metrics.entries()) {
      keyMetrics.push({
        name,
        value: metric.value,
        avg: metric.avg,
        count: metric.count,
        trend: this._getMetricTrend(name)
      });
    }

    return keyMetrics.sort((a, b) => b.count - a.count); // Sort by frequency
  }

  /**
   * Calculate metric trends
   * @private
   */
  _calculateMetricTrends() {
    const trends = {};
    
    for (const [name, history] of this.metricHistory.entries()) {
      const recent = history.slice(-20); // Last 20 data points
      if (recent.length >= 10) {
        const values = recent.map(h => h.value);
        trends[name] = this._calculateTrend(values);
      }
    }

    return trends;
  }

  /**
   * Get trend for specific metric
   * @private
   */
  _getMetricTrend(metricName) {
    const history = this.metricHistory.get(metricName) || [];
    const recent = history.slice(-10);
    
    if (recent.length < 5) return 'stable';
    
    const values = recent.map(h => h.value);
    const trend = this._calculateTrend(values);
    
    if (trend > 0.1) return 'increasing';
    if (trend < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate trend from values array
   * @private
   */
  _calculateTrend(values) {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
    const sumX2 = values.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  /**
   * Cleanup old data
   * @private
   */
  _cleanup() {
    const cutoff = Date.now() - this.options.metricsRetention;

    // Clean up metric history
    for (const [name, history] of this.metricHistory.entries()) {
      const filteredHistory = history.filter(h => h.timestamp > cutoff);
      this.metricHistory.set(name, filteredHistory);
      
      if (filteredHistory.length === 0) {
        this.metricHistory.delete(name);
        this.metrics.delete(name);
      }
    }

    // Clean up recent alerts
    this.recentAlerts = this.recentAlerts.filter(
      alert => Date.now() - alert.timestamp.getTime() < this.options.metricsRetention
    );
  }

  /**
   * Get metric key for storage
   * @private
   */
  _getMetricKey(name, tags) {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${tagString}}`;
  }

  /**
   * Generate unique ID
   * @private
   */
  _generateId() {
    return `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}