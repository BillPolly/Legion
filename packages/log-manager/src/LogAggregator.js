import { EventEmitter } from 'events';

/**
 * Aggregates logs from multiple sources
 */
export class LogAggregator extends EventEmitter {
  constructor() {
    super();
    this.aggregations = new Map();
    this.correlations = new Map();
  }

  /**
   * Create an aggregation group
   */
  createAggregation(aggregationId, options = {}) {
    const {
      sources = [],
      name = aggregationId,
      description = '',
      correlationKey = null,
      bufferSize = 5000
    } = options;

    if (this.aggregations.has(aggregationId)) {
      throw new Error(`Aggregation ${aggregationId} already exists`);
    }

    const aggregation = {
      id: aggregationId,
      name,
      description,
      sources: new Set(sources),
      correlationKey,
      buffer: [],
      bufferSize,
      startTime: new Date(),
      stats: {
        totalLogs: 0,
        errorCount: 0,
        warnCount: 0,
        infoCount: 0
      }
    };

    this.aggregations.set(aggregationId, aggregation);

    return {
      id: aggregationId,
      name,
      sources: Array.from(aggregation.sources),
      status: 'created'
    };
  }

  /**
   * Add sources to an aggregation
   */
  addSources(aggregationId, sources) {
    const aggregation = this.aggregations.get(aggregationId);
    if (!aggregation) {
      throw new Error(`Aggregation ${aggregationId} not found`);
    }

    sources.forEach(source => aggregation.sources.add(source));

    return {
      id: aggregationId,
      sources: Array.from(aggregation.sources),
      status: 'updated'
    };
  }

  /**
   * Remove sources from an aggregation
   */
  removeSources(aggregationId, sources) {
    const aggregation = this.aggregations.get(aggregationId);
    if (!aggregation) {
      throw new Error(`Aggregation ${aggregationId} not found`);
    }

    sources.forEach(source => aggregation.sources.delete(source));

    return {
      id: aggregationId,
      sources: Array.from(aggregation.sources),
      status: 'updated'
    };
  }

  /**
   * Add log to aggregations
   */
  addLog(logEntry) {
    const { sourceId } = logEntry;
    
    // Find all aggregations that include this source
    for (const [aggregationId, aggregation] of this.aggregations) {
      if (aggregation.sources.has(sourceId)) {
        // Add to buffer
        aggregation.buffer.push({
          ...logEntry,
          aggregationId,
          aggregatedAt: new Date()
        });

        // Maintain buffer size
        if (aggregation.buffer.length > aggregation.bufferSize) {
          aggregation.buffer.shift();
        }

        // Update stats
        aggregation.stats.totalLogs++;
        switch (logEntry.level) {
          case 'error':
            aggregation.stats.errorCount++;
            break;
          case 'warn':
            aggregation.stats.warnCount++;
            break;
          case 'info':
            aggregation.stats.infoCount++;
            break;
        }

        // Handle correlation
        if (aggregation.correlationKey && logEntry[aggregation.correlationKey]) {
          this.correlate(aggregationId, logEntry);
        }

        // Emit aggregated log event
        this.emit('aggregated-log', {
          aggregationId,
          logEntry
        });
      }
    }
  }

  /**
   * Correlate logs by key
   */
  correlate(aggregationId, logEntry) {
    const aggregation = this.aggregations.get(aggregationId);
    if (!aggregation || !aggregation.correlationKey) {
      return;
    }

    const correlationValue = logEntry[aggregation.correlationKey];
    const correlationId = `${aggregationId}:${correlationValue}`;

    if (!this.correlations.has(correlationId)) {
      this.correlations.set(correlationId, {
        id: correlationId,
        aggregationId,
        key: aggregation.correlationKey,
        value: correlationValue,
        logs: [],
        firstSeen: new Date(),
        lastSeen: new Date(),
        count: 0
      });
    }

    const correlation = this.correlations.get(correlationId);
    correlation.logs.push(logEntry);
    correlation.lastSeen = new Date();
    correlation.count++;

    // Limit correlation buffer
    if (correlation.logs.length > 1000) {
      correlation.logs.shift();
    }

    this.emit('correlation-update', {
      correlationId,
      logEntry
    });
  }

  /**
   * Get aggregated logs
   */
  getAggregatedLogs(aggregationId, options = {}) {
    const aggregation = this.aggregations.get(aggregationId);
    if (!aggregation) {
      throw new Error(`Aggregation ${aggregationId} not found`);
    }

    const {
      limit = 100,
      offset = 0,
      level = null,
      startTime = null,
      endTime = null,
      search = null
    } = options;

    let logs = [...aggregation.buffer];

    // Filter by level
    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    // Filter by time range
    if (startTime) {
      logs = logs.filter(log => log.timestamp >= startTime);
    }
    if (endTime) {
      logs = logs.filter(log => log.timestamp <= endTime);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      logs = logs.filter(log => 
        log.message.toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const paginatedLogs = logs.slice(offset, offset + limit);

    return {
      aggregationId,
      logs: paginatedLogs,
      total: logs.length,
      offset,
      limit,
      stats: aggregation.stats
    };
  }

  /**
   * Get correlated logs
   */
  getCorrelatedLogs(correlationId, options = {}) {
    const correlation = this.correlations.get(correlationId);
    if (!correlation) {
      throw new Error(`Correlation ${correlationId} not found`);
    }

    const { limit = 100, offset = 0 } = options;
    const logs = correlation.logs.slice(offset, offset + limit);

    return {
      correlationId,
      aggregationId: correlation.aggregationId,
      key: correlation.key,
      value: correlation.value,
      logs,
      total: correlation.logs.length,
      offset,
      limit,
      firstSeen: correlation.firstSeen,
      lastSeen: correlation.lastSeen,
      count: correlation.count
    };
  }

  /**
   * List correlations for an aggregation
   */
  listCorrelations(aggregationId) {
    const correlations = [];
    
    for (const [id, correlation] of this.correlations) {
      if (correlation.aggregationId === aggregationId) {
        correlations.push({
          id: correlation.id,
          key: correlation.key,
          value: correlation.value,
          count: correlation.count,
          firstSeen: correlation.firstSeen,
          lastSeen: correlation.lastSeen
        });
      }
    }

    return correlations;
  }

  /**
   * Get aggregation statistics
   */
  getAggregationStats(aggregationId) {
    const aggregation = this.aggregations.get(aggregationId);
    if (!aggregation) {
      throw new Error(`Aggregation ${aggregationId} not found`);
    }

    const duration = Date.now() - aggregation.startTime.getTime();
    const logsPerSecond = aggregation.stats.totalLogs / (duration / 1000);

    return {
      id: aggregationId,
      name: aggregation.name,
      sources: Array.from(aggregation.sources),
      startTime: aggregation.startTime,
      duration,
      ...aggregation.stats,
      logsPerSecond,
      errorRate: aggregation.stats.totalLogs > 0 
        ? (aggregation.stats.errorCount / aggregation.stats.totalLogs) * 100
        : 0,
      bufferUtilization: (aggregation.buffer.length / aggregation.bufferSize) * 100
    };
  }

  /**
   * List all aggregations
   */
  listAggregations() {
    const aggregations = [];
    
    for (const [id, aggregation] of this.aggregations) {
      aggregations.push({
        id,
        name: aggregation.name,
        description: aggregation.description,
        sources: Array.from(aggregation.sources),
        stats: this.getAggregationStats(id)
      });
    }

    return aggregations;
  }

  /**
   * Delete an aggregation
   */
  deleteAggregation(aggregationId) {
    const aggregation = this.aggregations.get(aggregationId);
    if (!aggregation) {
      throw new Error(`Aggregation ${aggregationId} not found`);
    }

    // Delete associated correlations
    for (const [id, correlation] of this.correlations) {
      if (correlation.aggregationId === aggregationId) {
        this.correlations.delete(id);
      }
    }

    // Delete aggregation
    this.aggregations.delete(aggregationId);

    return {
      id: aggregationId,
      status: 'deleted'
    };
  }

  /**
   * Clear aggregation buffer
   */
  clearAggregationBuffer(aggregationId) {
    const aggregation = this.aggregations.get(aggregationId);
    if (!aggregation) {
      throw new Error(`Aggregation ${aggregationId} not found`);
    }

    aggregation.buffer.length = 0;
    aggregation.stats = {
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0
    };

    return {
      id: aggregationId,
      status: 'cleared'
    };
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    this.aggregations.clear();
    this.correlations.clear();
    this.removeAllListeners();
  }
}