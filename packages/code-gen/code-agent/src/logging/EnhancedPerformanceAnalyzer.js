/**
 * EnhancedPerformanceAnalyzer - Advanced performance metrics extraction and analysis
 * 
 * Provides sophisticated performance analysis including:
 * - Multi-dimensional performance metrics
 * - Performance regression detection
 * - Resource utilization analysis
 * - Performance correlation analysis
 * - Predictive performance modeling
 */

import { EventEmitter } from 'events';

/**
 * EnhancedPerformanceAnalyzer class for advanced performance analysis
 */
class EnhancedPerformanceAnalyzer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Performance thresholds
      criticalThreshold: 5000,     // 5 seconds
      warningThreshold: 2000,      // 2 seconds
      targetThreshold: 500,        // 0.5 seconds
      
      // Analysis parameters
      trendAnalysisWindow: 100,    // Number of samples for trend analysis
      regressionThreshold: 0.2,    // 20% performance degradation
      correlationThreshold: 0.7,   // Correlation significance threshold
      
      // Resource monitoring
      memoryThreshold: 500,        // MB
      cpuThreshold: 80,            // Percentage
      diskThreshold: 90,           // Percentage
      
      // Predictive modeling
      enablePredictiveAnalysis: true,
      forecastWindow: 10,          // Number of future points to predict
      
      // Metrics collection
      enableDetailedMetrics: true,
      enableResourceTracking: true,
      enablePerformanceBaseline: true,
      
      ...config
    };
    
    // State management
    this.performanceHistory = [];
    this.performanceBaseline = new Map();
    this.regressionDetected = false;
    this.resourceMetrics = new Map();
    
    // Performance categories
    this.performanceCategories = {
      'database_query': /database.*query|query.*time|db.*duration|sql.*elapsed/i,
      'response_time': /response.*time|duration|elapsed|took.*ms/i,
      'api_call': /api.*time|request.*duration|http.*elapsed/i,
      'file_io': /file.*time|io.*duration|disk.*elapsed/i,
      'memory_usage': /memory.*usage|heap.*size|allocated/i,
      'cpu_usage': /cpu.*usage|processor.*time|execution.*time/i,
      'network_io': /network.*time|bandwidth|transfer.*rate/i,
      'cache_hit': /cache.*hit|cache.*miss|cache.*time/i
    };
    
    // Metrics tracking
    this.metrics = {
      totalMetrics: 0,
      performanceIssues: 0,
      regressionsDetected: 0,
      baselineUpdates: 0,
      predictionAccuracy: 0,
      analysisTime: 0
    };
  }

  /**
   * Perform comprehensive performance analysis
   */
  async analyzePerformance(logs) {
    const startTime = Date.now();
    
    this.emit('performance-analysis-started', { 
      logCount: logs.length, 
      timestamp: startTime 
    });
    
    try {
      // Extract performance metrics
      const rawMetrics = this.extractPerformanceMetrics(logs);
      
      // Analyze performance trends
      const trends = await this.analyzeTrends(rawMetrics);
      
      // Detect regressions
      const regressions = await this.detectRegressions(rawMetrics);
      
      // Analyze resource utilization
      const resourceAnalysis = await this.analyzeResourceUtilization(logs);
      
      // Perform correlation analysis
      const correlations = await this.analyzePerformanceCorrelations(rawMetrics);
      
      // Generate performance insights
      const insights = await this.generatePerformanceInsights(rawMetrics, trends, regressions);
      
      // Update baseline
      await this.updatePerformanceBaseline(rawMetrics);
      
      // Predictive analysis
      const predictions = this.config.enablePredictiveAnalysis 
        ? await this.performPredictiveAnalysis(rawMetrics)
        : null;
      
      const results = {
        metrics: rawMetrics,
        trends,
        regressions,
        resourceAnalysis,
        correlations,
        insights,
        predictions,
        summary: this.generatePerformanceSummary(rawMetrics, trends, regressions)
      };
      
      // Update metrics
      this.updateMetrics(results, startTime);
      
      this.emit('performance-analysis-completed', { 
        results, 
        timestamp: Date.now() 
      });
      
      return results;
      
    } catch (error) {
      this.emit('performance-analysis-failed', { 
        error: error.message, 
        timestamp: Date.now() 
      });
      throw error;
    }
  }

  /**
   * Extract performance metrics from logs
   */
  extractPerformanceMetrics(logs) {
    const metrics = [];
    
    for (const log of logs) {
      const performanceData = this.extractPerformanceData(log);
      
      if (performanceData) {
        const metric = {
          id: log.id,
          timestamp: log.timestamp,
          source: log.source,
          category: this.categorizePerformanceMetric(log.message),
          value: performanceData.value,
          unit: performanceData.unit,
          operation: performanceData.operation,
          severity: this.calculateSeverity(performanceData.value),
          correlationId: log.correlationId,
          metadata: {
            rawMessage: log.message,
            extractedData: performanceData,
            logLevel: log.level
          }
        };
        
        metrics.push(metric);
      }
    }
    
    return metrics.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Extract performance data from log message
   */
  extractPerformanceData(log) {
    const patterns = [
      // Time-based patterns
      /(?:took|duration|elapsed|time)[:=\s]+(\d+(?:\.\d+)?)\s*(ms|milliseconds|s|seconds|m|minutes)/i,
      /(\d+(?:\.\d+)?)\s*(ms|milliseconds|s|seconds|m|minutes).*(?:response|duration|elapsed)/i,
      
      // Memory patterns
      /(?:memory|heap|allocated)[:=\s]+(\d+(?:\.\d+)?)\s*(mb|gb|kb|bytes)/i,
      /(\d+(?:\.\d+)?)\s*(mb|gb|kb|bytes).*(?:memory|heap|allocated)/i,
      
      // CPU patterns
      /(?:cpu|processor)[:=\s]+(\d+(?:\.\d+)?)\s*(%|percent)/i,
      /(\d+(?:\.\d+)?)\s*(%|percent).*(?:cpu|processor)/i,
      
      // Network patterns
      /(?:bandwidth|transfer|rate)[:=\s]+(\d+(?:\.\d+)?)\s*(mbps|kbps|gb\/s|mb\/s)/i,
      /(\d+(?:\.\d+)?)\s*(mbps|kbps|gb\/s|mb\/s).*(?:bandwidth|transfer|rate)/i
    ];
    
    for (const pattern of patterns) {
      const match = log.message.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        
        return {
          value: this.normalizeValue(value, unit),
          unit: this.normalizeUnit(unit),
          operation: this.extractOperationName(log.message),
          extractedFrom: match[0]
        };
      }
    }
    
    return null;
  }

  /**
   * Categorize performance metric
   */
  categorizePerformanceMetric(message) {
    for (const [category, pattern] of Object.entries(this.performanceCategories)) {
      if (pattern.test(message)) {
        return category;
      }
    }
    
    return 'general';
  }

  /**
   * Calculate severity based on performance value
   */
  calculateSeverity(value) {
    if (value >= this.config.criticalThreshold) {
      return 'critical';
    } else if (value >= this.config.warningThreshold) {
      return 'warning';
    } else if (value <= this.config.targetThreshold) {
      return 'excellent';
    } else {
      return 'normal';
    }
  }

  /**
   * Analyze performance trends
   */
  async analyzeTrends(metrics) {
    const trends = {};
    
    // Group metrics by category
    const metricsByCategory = this.groupMetricsByCategory(metrics);
    
    for (const [category, categoryMetrics] of Object.entries(metricsByCategory)) {
      if (categoryMetrics.length < 2) continue;
      
      const trend = await this.calculateTrend(categoryMetrics);
      trends[category] = trend;
    }
    
    return trends;
  }

  /**
   * Calculate trend for a set of metrics
   */
  async calculateTrend(metrics) {
    const values = metrics.map(m => m.value);
    const timestamps = metrics.map(m => m.timestamp);
    
    // Linear regression
    const { slope, intercept, correlation } = this.calculateLinearRegression(
      timestamps, 
      values
    );
    
    // Trend analysis  
    const trendDirection = slope > 0.01 ? 'increasing' : 
                          slope < -0.01 ? 'decreasing' : 'stable';
    
    const trendStrength = Math.abs(correlation);
    
    return {
      direction: trendDirection,
      slope,
      intercept,
      correlation,
      strength: trendStrength,
      confidence: this.calculateTrendConfidence(correlation, metrics.length),
      samples: metrics.length,
      timespan: timestamps[timestamps.length - 1] - timestamps[0],
      averageValue: values.reduce((sum, val) => sum + val, 0) / values.length,
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
      volatility: this.calculateVolatility(values)
    };
  }

  /**
   * Detect performance regressions
   */
  async detectRegressions(metrics) {
    const regressions = [];
    
    // Group metrics by category and source
    const metricsByKey = this.groupMetricsByKey(metrics);
    
    for (const [key, keyMetrics] of Object.entries(metricsByKey)) {
      if (keyMetrics.length < 5) continue; // Need minimum samples
      
      const regression = await this.detectRegression(keyMetrics, key);
      if (regression) {
        regressions.push(regression);
      }
    }
    
    return regressions.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Detect regression in a metric series
   */
  async detectRegression(metrics, key) {
    const recentMetrics = metrics.slice(-10); // Last 10 samples
    const baselineMetrics = metrics.slice(0, -10); // Earlier samples
    
    if (baselineMetrics.length < 3 || recentMetrics.length < 3) {
      return null;
    }
    
    const baselineAverage = baselineMetrics.reduce((sum, m) => sum + m.value, 0) / baselineMetrics.length;
    const recentAverage = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
    
    const regressionRatio = (recentAverage - baselineAverage) / baselineAverage;
    
    if (regressionRatio > this.config.regressionThreshold) {
      return {
        key,
        type: 'performance_regression',
        severity: this.calculateRegressionSeverity(regressionRatio),
        regressionRatio,
        baselineAverage,
        recentAverage,
        degradation: regressionRatio * 100,
        detectedAt: Date.now(),
        affectedMetrics: recentMetrics.map(m => m.id),
        confidence: this.calculateRegressionConfidence(baselineMetrics, recentMetrics)
      };
    }
    
    return null;
  }

  /**
   * Analyze resource utilization
   */
  async analyzeResourceUtilization(logs) {
    const resourceMetrics = {
      memory: [],
      cpu: [],
      disk: [],
      network: []
    };
    
    // Extract resource metrics
    for (const log of logs) {
      const resourceData = this.extractResourceData(log);
      if (resourceData) {
        resourceMetrics[resourceData.type].push({
          timestamp: log.timestamp,
          value: resourceData.value,
          unit: resourceData.unit,
          source: log.source
        });
      }
    }
    
    // Analyze each resource type
    const analysis = {};
    for (const [type, metrics] of Object.entries(resourceMetrics)) {
      if (metrics.length > 0) {
        analysis[type] = await this.analyzeResourceType(metrics, type);
      }
    }
    
    return analysis;
  }

  /**
   * Analyze performance correlations
   */
  async analyzePerformanceCorrelations(metrics) {
    const correlations = [];
    
    // Group metrics by different dimensions
    const categoryGroups = this.groupMetricsByCategory(metrics);
    const sourceGroups = this.groupMetricsBySource(metrics);
    
    // Analyze category correlations
    const categoryCorrelations = await this.analyzeCorrelationsBetweenGroups(
      categoryGroups, 
      'category'
    );
    correlations.push(...categoryCorrelations);
    
    // Analyze source correlations
    const sourceCorrelations = await this.analyzeCorrelationsBetweenGroups(
      sourceGroups, 
      'source'
    );
    correlations.push(...sourceCorrelations);
    
    return correlations.filter(c => c.strength > this.config.correlationThreshold);
  }

  /**
   * Generate performance insights
   */
  async generatePerformanceInsights(metrics, trends, regressions) {
    const insights = [];
    
    // Trend insights
    for (const [category, trend] of Object.entries(trends)) {
      if (trend.direction === 'increasing' && trend.strength > 0.7) {
        insights.push({
          type: 'trend_concern',
          category,
          severity: 'high',
          message: `${category} performance is trending worse (${trend.slope > 0 ? 'increasing' : 'decreasing'} by ${Math.abs(trend.slope).toFixed(2)}ms per operation)`,
          recommendations: this.generateTrendRecommendations(category, trend)
        });
      }
    }
    
    // Regression insights
    for (const regression of regressions) {
      insights.push({
        type: 'regression_detected',
        category: regression.key,
        severity: regression.severity,
        message: `Performance regression detected: ${regression.degradation.toFixed(1)}% degradation`,
        recommendations: this.generateRegressionRecommendations(regression)
      });
    }
    
    // Bottleneck insights
    const bottlenecks = this.identifyBottlenecks(metrics);
    for (const bottleneck of bottlenecks) {
      insights.push({
        type: 'bottleneck_identified',
        category: bottleneck.category,
        severity: bottleneck.severity,
        message: `Performance bottleneck identified in ${bottleneck.source}: ${bottleneck.value}ms`,
        recommendations: this.generateBottleneckRecommendations(bottleneck)
      });
    }
    
    return insights;
  }

  /**
   * Perform predictive analysis
   */
  async performPredictiveAnalysis(metrics) {
    if (!this.config.enablePredictiveAnalysis) {
      return null;
    }
    
    const predictions = {};
    const metricsByCategory = this.groupMetricsByCategory(metrics);
    
    for (const [category, categoryMetrics] of Object.entries(metricsByCategory)) {
      if (categoryMetrics.length < 10) continue; // Need sufficient history
      
      const prediction = await this.predictPerformanceTrend(categoryMetrics);
      predictions[category] = prediction;
    }
    
    return predictions;
  }

  /**
   * Generate performance summary
   */
  generatePerformanceSummary(metrics, trends, regressions) {
    const summary = {
      totalMetrics: metrics.length,
      averagePerformance: metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length,
      performanceDistribution: this.calculatePerformanceDistribution(metrics),
      trendsAnalyzed: Object.keys(trends).length,
      regressionsDetected: regressions.length,
      criticalIssues: metrics.filter(m => m.severity === 'critical').length,
      warningIssues: metrics.filter(m => m.severity === 'warning').length,
      excellentPerformance: metrics.filter(m => m.severity === 'excellent').length
    };
    
    return summary;
  }

  // Helper methods
  normalizeValue(value, unit) {
    // Normalize all time values to milliseconds
    const timeUnits = {
      'ms': 1, 'milliseconds': 1,
      's': 1000, 'seconds': 1000,
      'm': 60000, 'minutes': 60000
    };
    
    if (timeUnits[unit]) {
      return value * timeUnits[unit];
    }
    
    return value;
  }

  normalizeUnit(unit) {
    const unitMap = {
      'ms': 'ms', 'milliseconds': 'ms',
      's': 'ms', 'seconds': 'ms',
      'm': 'ms', 'minutes': 'ms',
      'mb': 'mb', 'gb': 'mb', 'kb': 'mb', 'bytes': 'mb',
      '%': '%', 'percent': '%'
    };
    
    return unitMap[unit] || unit;
  }

  extractOperationName(message) {
    const operationPatterns = [
      /(\w+)\s+(?:took|duration|elapsed)/i,
      /(?:took|duration|elapsed).*?(\w+)/i,
      /(\w+)\s+(?:request|query|operation)/i
    ];
    
    for (const pattern of operationPatterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1].toLowerCase();
      }
    }
    
    return 'unknown';
  }

  groupMetricsByCategory(metrics) {
    const groups = {};
    for (const metric of metrics) {
      if (!groups[metric.category]) {
        groups[metric.category] = [];
      }
      groups[metric.category].push(metric);
    }
    return groups;
  }

  groupMetricsBySource(metrics) {
    const groups = {};
    for (const metric of metrics) {
      if (!groups[metric.source]) {
        groups[metric.source] = [];
      }
      groups[metric.source].push(metric);
    }
    return groups;
  }

  groupMetricsByKey(metrics) {
    const groups = {};
    for (const metric of metrics) {
      const key = `${metric.category}-${metric.source}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric);
    }
    return groups;
  }

  calculateLinearRegression(x, y) {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const correlation = (n * sumXY - sumX * sumY) / 
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return { slope, intercept, correlation };
  }

  calculateVolatility(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  // Placeholder methods for advanced analysis
  calculateTrendConfidence(correlation, sampleSize) {
    return Math.min(Math.abs(correlation) * (sampleSize / 10), 1.0);
  }

  calculateRegressionSeverity(ratio) {
    if (ratio > 0.5) return 'critical';
    if (ratio > 0.3) return 'high';
    if (ratio > 0.2) return 'medium';
    return 'low';
  }

  calculateRegressionConfidence(baseline, recent) {
    return Math.min((baseline.length + recent.length) / 20, 1.0);
  }

  extractResourceData(log) {
    // Placeholder - would extract memory, CPU, disk, network metrics
    return null;
  }

  analyzeResourceType(metrics, type) {
    // Placeholder - would analyze specific resource type
    return {
      average: metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length,
      peak: Math.max(...metrics.map(m => m.value)),
      trend: 'stable'
    };
  }

  analyzeCorrelationsBetweenGroups(groups, dimension) {
    // Placeholder - would analyze correlations between groups
    return [];
  }

  generateTrendRecommendations(category, trend) {
    return [`Monitor ${category} performance closely`, `Consider optimizing ${category} operations`];
  }

  generateRegressionRecommendations(regression) {
    return [`Investigate recent changes in ${regression.key}`, 'Review performance baselines'];
  }

  identifyBottlenecks(metrics) {
    return metrics.filter(m => m.severity === 'critical').map(m => ({
      category: m.category,
      source: m.source,
      value: m.value,
      severity: m.severity
    }));
  }

  generateBottleneckRecommendations(bottleneck) {
    return [`Optimize ${bottleneck.category} in ${bottleneck.source}`, 'Review resource allocation'];
  }

  predictPerformanceTrend(metrics) {
    // Placeholder - would use machine learning for prediction
    return {
      forecast: [],
      confidence: 0.5,
      trend: 'stable'
    };
  }

  calculatePerformanceDistribution(metrics) {
    const excellent = metrics.filter(m => m.severity === 'excellent').length;
    const normal = metrics.filter(m => m.severity === 'normal').length;
    const warning = metrics.filter(m => m.severity === 'warning').length;
    const critical = metrics.filter(m => m.severity === 'critical').length;
    
    return { excellent, normal, warning, critical };
  }

  updatePerformanceBaseline(metrics) {
    // Update baseline with recent metrics
    for (const metric of metrics) {
      const key = `${metric.category}-${metric.source}`;
      if (!this.performanceBaseline.has(key)) {
        this.performanceBaseline.set(key, []);
      }
      
      const baseline = this.performanceBaseline.get(key);
      baseline.push(metric.value);
      
      // Keep only recent values for baseline
      if (baseline.length > 100) {
        baseline.shift();
      }
    }
  }

  updateMetrics(results, startTime) {
    this.metrics.totalMetrics += results.metrics.length;
    this.metrics.performanceIssues += results.metrics.filter(m => 
      m.severity === 'warning' || m.severity === 'critical'
    ).length;
    this.metrics.regressionsDetected += results.regressions.length;
    this.metrics.baselineUpdates += 1;
    const analysisTime = Date.now() - startTime;
    this.metrics.analysisTime += Math.max(1, analysisTime); // Ensure at least 1ms is recorded
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      baselineSize: this.performanceBaseline.size,
      historySize: this.performanceHistory.length,
      resourceMetricsSize: this.resourceMetrics.size
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.performanceHistory = [];
    this.performanceBaseline.clear();
    this.resourceMetrics.clear();
    
    this.emit('cleanup-complete', { timestamp: Date.now() });
  }
}

export { EnhancedPerformanceAnalyzer };