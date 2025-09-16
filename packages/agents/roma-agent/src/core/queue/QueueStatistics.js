/**
 * QueueStatistics - Collects and analyzes queue performance metrics
 * Single responsibility: Statistical analysis and performance monitoring
 */

import { SUCCESS_RATE_PERCENTAGE } from '../constants/SystemConstants.js';

export class QueueStatistics {
  constructor(options = {}) {
    this.retentionTime = options.retentionTime || 24 * 60 * 60 * 1000; // 24 hours
    this.sampleInterval = options.sampleInterval || 60 * 1000; // 1 minute
    
    this.stats = {
      totalAdded: 0,
      totalStarted: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalRetried: 0,
      totalTimeout: 0,
      totalCancelled: 0
    };
    
    this.samples = []; // Time series samples
    this.durations = []; // Task duration history
    this.errors = new Map(); // Error frequency tracking
    
    this.startTime = Date.now();
    this.lastSample = Date.now();
    
    // Start periodic sampling
    if (options.autoSample !== false) {
      this.startSampling();
    }
  }

  /**
   * Record task addition
   * @param {Object} taskInfo - Task information
   */
  recordAdded(taskInfo = {}) {
    this.stats.totalAdded++;
    this.recordSample('added', taskInfo);
  }

  /**
   * Record task start
   * @param {Object} taskInfo - Task information
   */
  recordStarted(taskInfo = {}) {
    this.stats.totalStarted++;
    this.recordSample('started', taskInfo);
  }

  /**
   * Record task completion
   * @param {Object} taskInfo - Task information
   */
  recordCompleted(taskInfo = {}) {
    this.stats.totalCompleted++;
    
    if (taskInfo.duration) {
      this.durations.push({
        duration: taskInfo.duration,
        timestamp: Date.now(),
        taskId: taskInfo.taskId
      });
      
      // Prune old durations
      this.pruneDurations();
    }
    
    this.recordSample('completed', taskInfo);
  }

  /**
   * Record task failure
   * @param {Object} taskInfo - Task information including error
   */
  recordFailed(taskInfo = {}) {
    this.stats.totalFailed++;
    
    // Track error frequency
    if (taskInfo.error) {
      const errorType = this.categorizeError(taskInfo.error);
      const current = this.errors.get(errorType) || 0;
      this.errors.set(errorType, current + 1);
    }
    
    if (taskInfo.isTimeout) {
      this.stats.totalTimeout++;
    }
    
    this.recordSample('failed', taskInfo);
  }

  /**
   * Record retry attempt
   * @param {Object} taskInfo - Task information
   */
  recordRetried(taskInfo = {}) {
    this.stats.totalRetried++;
    this.recordSample('retried', taskInfo);
  }

  /**
   * Record task cancellation
   * @param {Object} taskInfo - Task information
   */
  recordCancelled(taskInfo = {}) {
    this.stats.totalCancelled++;
    this.recordSample('cancelled', taskInfo);
  }

  /**
   * Get current statistics
   * @returns {Object} - Current statistics
   */
  getCurrentStats() {
    const now = Date.now();
    const uptime = now - this.startTime;
    const total = this.stats.totalStarted;
    
    return {
      ...this.stats,
      uptime,
      successRate: total > 0 
        ? (this.stats.totalCompleted / total) * 100 
        : 0,
      failureRate: total > 0 
        ? (this.stats.totalFailed / total) * 100 
        : 0,
      retryRate: this.stats.totalAdded > 0 
        ? (this.stats.totalRetried / this.stats.totalAdded) * 100 
        : 0,
      throughput: this.calculateThroughput(),
      ...this.getDurationStats(),
      ...this.getErrorStats()
    };
  }

  /**
   * Get historical trends
   * @param {Object} options - Query options
   * @returns {Object} - Historical data
   */
  getHistoricalData(options = {}) {
    const limit = options.limit || 60;
    const since = options.since || Date.now() - this.retentionTime;
    
    const filtered = this.samples
      .filter(sample => sample.timestamp >= since)
      .slice(-limit);
    
    return {
      samples: filtered,
      aggregated: this.aggregateSamples(filtered, options.interval || this.sampleInterval),
      summary: this.summarizeSamples(filtered)
    };
  }

  /**
   * Get performance insights
   * @returns {Object} - Performance insights and recommendations
   */
  getInsights() {
    const stats = this.getCurrentStats();
    const insights = [];
    const recommendations = [];
    
    // Success rate analysis
    if (stats.successRate < SUCCESS_RATE_PERCENTAGE) {
      insights.push({
        type: 'warning',
        metric: 'success_rate',
        value: stats.successRate,
        message: `Success rate (${stats.successRate.toFixed(1)}%) is below target (${SUCCESS_RATE_PERCENTAGE}%)`
      });
      recommendations.push('Review failing tasks and consider improving error handling');
    }
    
    // High retry rate
    if (stats.retryRate > 20) {
      insights.push({
        type: 'warning',
        metric: 'retry_rate',
        value: stats.retryRate,
        message: `High retry rate (${stats.retryRate.toFixed(1)}%) indicates unstable operations`
      });
      recommendations.push('Investigate common failure causes and improve task reliability');
    }
    
    // Timeout analysis
    const timeoutRate = stats.totalStarted > 0 
      ? (stats.totalTimeout / stats.totalStarted) * 100 
      : 0;
    
    if (timeoutRate > 10) {
      insights.push({
        type: 'warning',
        metric: 'timeout_rate',
        value: timeoutRate,
        message: `High timeout rate (${timeoutRate.toFixed(1)}%) suggests performance issues`
      });
      recommendations.push('Consider increasing timeout limits or optimizing task execution');
    }
    
    // Duration trends
    if (stats.averageDuration > 30000) { // 30 seconds
      insights.push({
        type: 'info',
        metric: 'duration',
        value: stats.averageDuration,
        message: 'Tasks are taking longer than expected to complete'
      });
      recommendations.push('Profile task execution to identify performance bottlenecks');
    }
    
    return {
      insights,
      recommendations,
      healthScore: this.calculateHealthScore(stats)
    };
  }

  /**
   * Calculate throughput (tasks per second)
   * @private
   */
  calculateThroughput() {
    const recentSamples = this.samples.slice(-60); // Last hour
    if (recentSamples.length < 2) return 0;
    
    const timespan = recentSamples[recentSamples.length - 1].timestamp - recentSamples[0].timestamp;
    if (timespan === 0) return 0;
    
    const completedInPeriod = recentSamples.filter(s => s.event === 'completed').length;
    return (completedInPeriod / timespan) * 1000; // Convert to per second
  }

  /**
   * Get duration statistics
   * @private
   */
  getDurationStats() {
    if (this.durations.length === 0) {
      return {
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        medianDuration: 0,
        p95Duration: 0
      };
    }
    
    const recent = this.durations.slice(-1000); // Last 1000 tasks
    const durations = recent.map(d => d.duration).sort((a, b) => a - b);
    
    return {
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      medianDuration: durations[Math.floor(durations.length / 2)],
      p95Duration: durations[Math.floor(durations.length * 0.95)]
    };
  }

  /**
   * Get error statistics
   * @private
   */
  getErrorStats() {
    const errorTypes = Array.from(this.errors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    return {
      errorTypes,
      uniqueErrors: this.errors.size,
      mostCommonError: errorTypes[0] || null
    };
  }

  /**
   * Record a sample
   * @private
   */
  recordSample(event, data = {}) {
    this.samples.push({
      timestamp: Date.now(),
      event,
      ...data
    });
    
    // Prune old samples
    this.pruneSamples();
  }

  /**
   * Categorize error for tracking
   * @private
   */
  categorizeError(error) {
    const message = (error.message || error).toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('connection')) return 'network';
    if (message.includes('validation')) return 'validation';
    if (message.includes('permission') || message.includes('auth')) return 'authorization';
    if (message.includes('not found')) return 'not_found';
    if (message.includes('rate limit')) return 'rate_limit';
    
    return 'unknown';
  }

  /**
   * Calculate health score (0-100)
   * @private
   */
  calculateHealthScore(stats) {
    let score = 100;
    
    // Penalize low success rate
    if (stats.successRate < SUCCESS_RATE_PERCENTAGE) {
      score -= (SUCCESS_RATE_PERCENTAGE - stats.successRate);
    }
    
    // Penalize high retry rate
    if (stats.retryRate > 10) {
      score -= Math.min(stats.retryRate - 10, 20);
    }
    
    // Penalize timeouts
    const timeoutRate = stats.totalStarted > 0 
      ? (stats.totalTimeout / stats.totalStarted) * 100 
      : 0;
    if (timeoutRate > 5) {
      score -= Math.min(timeoutRate - 5, 15);
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Aggregate samples by time interval
   * @private
   */
  aggregateSamples(samples, interval) {
    const buckets = new Map();
    
    for (const sample of samples) {
      const bucketTime = Math.floor(sample.timestamp / interval) * interval;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, { timestamp: bucketTime, events: {} });
      }
      
      const bucket = buckets.get(bucketTime);
      bucket.events[sample.event] = (bucket.events[sample.event] || 0) + 1;
    }
    
    return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Summarize samples
   * @private
   */
  summarizeSamples(samples) {
    const summary = {};
    for (const sample of samples) {
      summary[sample.event] = (summary[sample.event] || 0) + 1;
    }
    return summary;
  }

  /**
   * Start periodic sampling
   * @private
   */
  startSampling() {
    this.sampleTimer = setInterval(() => {
      // Record periodic statistics
      this.recordSample('sample', {
        ...this.stats,
        timestamp: Date.now()
      });
    }, this.sampleInterval);
  }

  /**
   * Prune old samples
   * @private
   */
  pruneSamples() {
    const cutoff = Date.now() - this.retentionTime;
    this.samples = this.samples.filter(s => s.timestamp > cutoff);
  }

  /**
   * Prune old duration records
   * @private
   */
  pruneDurations() {
    const cutoff = Date.now() - this.retentionTime;
    this.durations = this.durations.filter(d => d.timestamp > cutoff);
  }

  /**
   * Reset statistics
   * @param {Object} options - Reset options
   */
  reset(options = {}) {
    if (options.counters !== false) {
      this.stats = {
        totalAdded: 0,
        totalStarted: 0,
        totalCompleted: 0,
        totalFailed: 0,
        totalRetried: 0,
        totalTimeout: 0,
        totalCancelled: 0
      };
    }
    
    if (options.history !== false) {
      this.samples = [];
      this.durations = [];
    }
    
    if (options.errors !== false) {
      this.errors.clear();
    }
    
    if (options.resetStartTime !== false) {
      this.startTime = Date.now();
    }
  }

  /**
   * Cleanup and stop sampling
   */
  cleanup() {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
  }
}