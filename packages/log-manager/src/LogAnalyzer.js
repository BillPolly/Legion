import { EventEmitter } from 'events';

/**
 * Analyzes logs for patterns, errors, and insights
 */
export class LogAnalyzer extends EventEmitter {
  constructor() {
    super();
    this.patterns = new Map();
    this.errorPatterns = this.initializeErrorPatterns();
    this.performanceMetrics = new Map();
  }

  /**
   * Initialize common error patterns
   */
  initializeErrorPatterns() {
    return new Map([
      ['null_reference', /TypeError:.*null|undefined/i],
      ['connection_error', /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i],
      ['memory_error', /out of memory|heap limit|ENOMEM/i],
      ['permission_error', /EACCES|EPERM|Permission denied/i],
      ['syntax_error', /SyntaxError|Unexpected token/i],
      ['module_not_found', /Cannot find module|MODULE_NOT_FOUND/i],
      ['port_in_use', /EADDRINUSE|address already in use/i],
      ['file_not_found', /ENOENT|no such file or directory/i],
      ['timeout', /Timeout|timed out/i],
      ['rate_limit', /rate limit|too many requests|429/i]
    ]);
  }

  /**
   * Analyze logs for patterns
   */
  analyzeLogs(logs, options = {}) {
    const {
      includePatterns = true,
      includeErrors = true,
      includePerformance = true,
      includeTimeline = true
    } = options;

    const analysis = {
      totalLogs: logs.length,
      timeRange: this.getTimeRange(logs),
      logLevels: this.analyzeLogLevels(logs),
      sources: this.analyzeSources(logs)
    };

    if (includePatterns) {
      analysis.patterns = this.findPatterns(logs);
    }

    if (includeErrors) {
      analysis.errors = this.analyzeErrors(logs);
    }

    if (includePerformance) {
      analysis.performance = this.analyzePerformance(logs);
    }

    if (includeTimeline) {
      analysis.timeline = this.createTimeline(logs);
    }

    return analysis;
  }

  /**
   * Get time range of logs
   */
  getTimeRange(logs) {
    if (logs.length === 0) {
      return { start: null, end: null, duration: 0 };
    }

    const timestamps = logs.map(log => log.timestamp);
    const start = new Date(Math.min(...timestamps));
    const end = new Date(Math.max(...timestamps));
    const duration = end - start;

    return {
      start,
      end,
      duration,
      formattedDuration: this.formatDuration(duration)
    };
  }

  /**
   * Analyze log levels distribution
   */
  analyzeLogLevels(logs) {
    const levels = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      trace: 0,
      other: 0
    };

    logs.forEach(log => {
      const level = log.level || 'other';
      if (levels.hasOwnProperty(level)) {
        levels[level]++;
      } else {
        levels.other++;
      }
    });

    // Calculate percentages
    const total = logs.length;
    const percentages = {};
    for (const [level, count] of Object.entries(levels)) {
      percentages[level] = total > 0 ? (count / total) * 100 : 0;
    }

    return {
      counts: levels,
      percentages,
      total
    };
  }

  /**
   * Analyze log sources
   */
  analyzeSources(logs) {
    const sources = new Map();

    logs.forEach(log => {
      const sourceId = log.sourceId || 'unknown';
      if (!sources.has(sourceId)) {
        sources.set(sourceId, {
          count: 0,
          errors: 0,
          warnings: 0,
          firstLog: log.timestamp,
          lastLog: log.timestamp
        });
      }

      const source = sources.get(sourceId);
      source.count++;
      source.lastLog = log.timestamp;

      if (log.level === 'error') source.errors++;
      if (log.level === 'warn') source.warnings++;
    });

    return Array.from(sources.entries()).map(([id, stats]) => ({
      sourceId: id,
      ...stats,
      errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0
    }));
  }

  /**
   * Find patterns in logs
   */
  findPatterns(logs) {
    const patterns = new Map();
    const minOccurrences = 3;

    // Extract common patterns
    logs.forEach(log => {
      // Extract patterns like [Component] or (module)
      const componentMatch = log.message.match(/\[([^\]]+)\]/g);
      const moduleMatch = log.message.match(/\(([^)]+)\)/g);
      
      const extractedPatterns = [
        ...(componentMatch || []),
        ...(moduleMatch || [])
      ];

      extractedPatterns.forEach(pattern => {
        const count = patterns.get(pattern) || 0;
        patterns.set(pattern, count + 1);
      });
    });

    // Filter patterns by minimum occurrences
    const significantPatterns = Array.from(patterns.entries())
      .filter(([, count]) => count >= minOccurrences)
      .sort((a, b) => b[1] - a[1])
      .map(([pattern, count]) => ({
        pattern,
        count,
        percentage: (count / logs.length) * 100
      }));

    return significantPatterns;
  }

  /**
   * Analyze errors in logs
   */
  analyzeErrors(logs) {
    const errors = logs.filter(log => log.level === 'error');
    const errorTypes = new Map();
    const errorsBySource = new Map();

    errors.forEach(log => {
      // Classify error type
      let errorType = 'unknown';
      for (const [type, pattern] of this.errorPatterns) {
        if (pattern.test(log.message)) {
          errorType = type;
          break;
        }
      }

      // Count by type
      const typeCount = errorTypes.get(errorType) || 0;
      errorTypes.set(errorType, typeCount + 1);

      // Count by source
      const sourceId = log.sourceId || 'unknown';
      const sourceCount = errorsBySource.get(sourceId) || 0;
      errorsBySource.set(sourceId, sourceCount + 1);
    });

    // Find error clusters (multiple errors in short time)
    const errorClusters = this.findErrorClusters(errors);

    return {
      total: errors.length,
      rate: logs.length > 0 ? (errors.length / logs.length) * 100 : 0,
      types: Array.from(errorTypes.entries()).map(([type, count]) => ({
        type,
        count,
        percentage: (count / errors.length) * 100
      })),
      bySource: Array.from(errorsBySource.entries()).map(([source, count]) => ({
        source,
        count
      })),
      clusters: errorClusters,
      recentErrors: errors.slice(-10).reverse()
    };
  }

  /**
   * Find error clusters
   */
  findErrorClusters(errors, windowMs = 5000) {
    if (errors.length < 2) return [];

    const clusters = [];
    let currentCluster = [errors[0]];

    for (let i = 1; i < errors.length; i++) {
      const timeDiff = errors[i].timestamp - errors[i - 1].timestamp;
      
      if (timeDiff <= windowMs) {
        currentCluster.push(errors[i]);
      } else {
        if (currentCluster.length >= 3) {
          clusters.push({
            startTime: currentCluster[0].timestamp,
            endTime: currentCluster[currentCluster.length - 1].timestamp,
            count: currentCluster.length,
            duration: currentCluster[currentCluster.length - 1].timestamp - currentCluster[0].timestamp,
            errors: currentCluster
          });
        }
        currentCluster = [errors[i]];
      }
    }

    // Check last cluster
    if (currentCluster.length >= 3) {
      clusters.push({
        startTime: currentCluster[0].timestamp,
        endTime: currentCluster[currentCluster.length - 1].timestamp,
        count: currentCluster.length,
        duration: currentCluster[currentCluster.length - 1].timestamp - currentCluster[0].timestamp,
        errors: currentCluster
      });
    }

    return clusters;
  }

  /**
   * Analyze performance metrics
   */
  analyzePerformance(logs) {
    const metrics = {
      responseTime: [],
      memoryUsage: [],
      cpuUsage: [],
      requestRate: []
    };

    // Extract performance data from logs
    logs.forEach(log => {
      // Look for response time patterns
      const responseTimeMatch = log.message.match(/response time[:\s]+(\d+)ms/i);
      if (responseTimeMatch) {
        metrics.responseTime.push({
          timestamp: log.timestamp,
          value: parseInt(responseTimeMatch[1])
        });
      }

      // Look for memory usage
      const memoryMatch = log.message.match(/memory[:\s]+(\d+(?:\.\d+)?)\s*(MB|GB)/i);
      if (memoryMatch) {
        const value = parseFloat(memoryMatch[1]);
        const unit = memoryMatch[2].toUpperCase();
        metrics.memoryUsage.push({
          timestamp: log.timestamp,
          value: unit === 'GB' ? value * 1024 : value
        });
      }
    });

    // Calculate statistics
    const stats = {};
    for (const [metric, values] of Object.entries(metrics)) {
      if (values.length > 0) {
        const numbers = values.map(v => v.value);
        stats[metric] = {
          count: values.length,
          min: Math.min(...numbers),
          max: Math.max(...numbers),
          avg: numbers.reduce((a, b) => a + b, 0) / numbers.length,
          latest: values[values.length - 1]
        };
      }
    }

    return {
      metrics,
      statistics: stats
    };
  }

  /**
   * Create timeline of events
   */
  createTimeline(logs, options = {}) {
    const { granularity = 'minute', maxBuckets = 100 } = options;

    if (logs.length === 0) return [];

    const timeRange = this.getTimeRange(logs);
    const buckets = this.createTimeBuckets(timeRange, granularity, maxBuckets);

    // Fill buckets with log counts
    logs.forEach(log => {
      const bucketIndex = this.findBucketIndex(log.timestamp, buckets);
      if (bucketIndex >= 0) {
        buckets[bucketIndex].count++;
        if (log.level === 'error') buckets[bucketIndex].errors++;
        if (log.level === 'warn') buckets[bucketIndex].warnings++;
      }
    });

    return buckets;
  }

  /**
   * Create time buckets for timeline
   */
  createTimeBuckets(timeRange, granularity, maxBuckets) {
    const { start, end } = timeRange;
    if (!start || !end) return [];

    const bucketSize = this.getBucketSize(granularity, timeRange.duration);
    const bucketCount = Math.min(
      Math.ceil(timeRange.duration / bucketSize),
      maxBuckets
    );

    const buckets = [];
    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = new Date(start.getTime() + i * bucketSize);
      const bucketEnd = new Date(start.getTime() + (i + 1) * bucketSize);
      
      buckets.push({
        start: bucketStart,
        end: bucketEnd,
        count: 0,
        errors: 0,
        warnings: 0
      });
    }

    return buckets;
  }

  /**
   * Get bucket size based on granularity
   */
  getBucketSize(granularity, totalDuration) {
    const sizes = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000
    };

    return sizes[granularity] || sizes.minute;
  }

  /**
   * Find which bucket a timestamp belongs to
   */
  findBucketIndex(timestamp, buckets) {
    for (let i = 0; i < buckets.length; i++) {
      if (timestamp >= buckets[i].start && timestamp < buckets[i].end) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Search for specific patterns
   */
  searchPattern(logs, pattern, options = {}) {
    const { ignoreCase = true, limit = 100 } = options;
    
    let regex;
    try {
      regex = new RegExp(pattern, ignoreCase ? 'i' : '');
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${error.message}`);
    }

    const matches = [];
    for (const log of logs) {
      if (regex.test(log.message)) {
        matches.push({
          ...log,
          matches: log.message.match(regex)
        });
        
        if (matches.length >= limit) break;
      }
    }

    return {
      pattern,
      matches,
      count: matches.length,
      truncated: matches.length >= limit
    };
  }

  /**
   * Format duration for display
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Add custom pattern
   */
  addCustomPattern(name, pattern) {
    if (typeof pattern === 'string') {
      pattern = new RegExp(pattern, 'i');
    }
    
    this.patterns.set(name, pattern);
    
    return {
      name,
      pattern: pattern.toString()
    };
  }

  /**
   * Remove custom pattern
   */
  removeCustomPattern(name) {
    const existed = this.patterns.delete(name);
    return {
      name,
      removed: existed
    };
  }

  /**
   * List all patterns
   */
  listPatterns() {
    const patterns = [];
    
    // Add error patterns
    for (const [name, pattern] of this.errorPatterns) {
      patterns.push({
        name,
        type: 'error',
        pattern: pattern.toString()
      });
    }
    
    // Add custom patterns
    for (const [name, pattern] of this.patterns) {
      patterns.push({
        name,
        type: 'custom',
        pattern: pattern.toString()
      });
    }
    
    return patterns;
  }
}