import { LogCapture } from './LogCapture.js';
import { LogAggregator } from './LogAggregator.js';
import { LogAnalyzer } from './LogAnalyzer.js';
import { LogExporter } from './LogExporter.js';
import { LogStreamer } from './LogStreamer.js';
import { EventEmitter } from 'events';

/**
 * Main LogManager class that provides all log management capabilities
 */
export default class LogManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      defaultBufferSize: 1000,
      realtimeStreaming: true,
      ...config
    };
    
    this.capture = new LogCapture();
    this.aggregator = new LogAggregator();
    this.analyzer = new LogAnalyzer();
    this.exporter = new LogExporter();
    this.streamer = new LogStreamer();
    
    this.setupEventHandlers();
  }

  /**
   * Setup internal event handlers
   */
  setupEventHandlers() {
    // Forward log events from capture to aggregator and streamer
    this.capture.on('log', (logEntry) => {
      this.aggregator.addLog(logEntry);
      this.streamer.processLog(logEntry);
      this.emit('log', logEntry);
    });

    // Forward errors
    this.capture.on('error', (error) => this.emit('error', error));
    this.aggregator.on('error', (error) => this.emit('error', error));
  }

  /**
   * Capture logs from various sources
   */
  async captureLogs(options = {}) {
    const {
      source,
      bufferSize = this.config.defaultBufferSize,
      follow = true
    } = options;

    if (!source) {
      throw new Error('Source is required');
    }

    try {
      let result;

      // Handle different source types
      if (source.type === 'stream') {
        result = this.capture.captureStream(source.id, source.stream, {
          type: source.streamType || 'stdout',
          bufferSize
        });
      } else if (source.type === 'file') {
        result = this.capture.captureFile(source.id, source.path, {
          fromBeginning: source.fromBeginning || false,
          follow,
          bufferSize
        });
      } else if (source.type === 'process') {
        result = this.capture.captureProcess(source.id, {
          pid: source.pid,
          stdout: source.stdout,
          stderr: source.stderr
        }, { bufferSize });
      } else {
        throw new Error(`Unsupported source type: ${source.type}`);
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stream logs in real-time
   */
  async streamLogs(options = {}) {
    const {
      streamId = `stream-${Date.now()}`,
      sources = [],
      levels = ['error', 'warn', 'info'],
      filter = null,
      realtime = this.config.realtimeStreaming
    } = options;

    try {
      const result = this.streamer.createStream(streamId, {
        sources,
        levels,
        filter,
        realtime
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search logs with patterns
   */
  async searchLogs(pattern, options = {}) {
    const {
      sources = [],
      timeRange = null,
      limit = 100,
      aggregationId = null
    } = options;

    try {
      let logs;

      // Get logs from aggregation or all sources
      if (aggregationId) {
        const aggResult = this.aggregator.getAggregatedLogs(aggregationId, {
          limit: 10000 // Get more logs for searching
        });
        logs = aggResult.logs;
      } else {
        const allLogs = this.capture.getAllLogs({ limit: 10000 });
        logs = allLogs.logs;

        // Filter by sources if specified
        if (sources.length > 0) {
          logs = logs.filter(log => sources.includes(log.sourceId));
        }
      }

      // Apply time range filter
      if (timeRange) {
        if (timeRange.start) {
          logs = logs.filter(log => log.timestamp >= timeRange.start);
        }
        if (timeRange.end) {
          logs = logs.filter(log => log.timestamp <= timeRange.end);
        }
      }

      // Search for pattern
      const searchResult = this.analyzer.searchPattern(logs, pattern, { limit });

      return {
        success: true,
        ...searchResult
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Filter logs by criteria
   */
  async filterLogs(criteria, options = {}) {
    const {
      sources = [],
      limit = 100,
      offset = 0
    } = options;

    try {
      const allLogs = this.capture.getAllLogs({ limit: 10000 });
      let logs = allLogs.logs;

      // Apply source filter
      if (sources.length > 0) {
        logs = logs.filter(log => sources.includes(log.sourceId));
      }

      // Apply criteria filters
      if (criteria.level) {
        logs = logs.filter(log => log.level === criteria.level);
      }

      if (criteria.startTime) {
        logs = logs.filter(log => log.timestamp >= criteria.startTime);
      }

      if (criteria.endTime) {
        logs = logs.filter(log => log.timestamp <= criteria.endTime);
      }

      if (criteria.contains) {
        const searchLower = criteria.contains.toLowerCase();
        logs = logs.filter(log => log.message.toLowerCase().includes(searchLower));
      }

      // Apply pagination
      const paginatedLogs = logs.slice(offset, offset + limit);

      return {
        success: true,
        logs: paginatedLogs,
        total: logs.length,
        offset,
        limit
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze logs for insights
   */
  async analyzeLogs(options = {}) {
    const {
      sources = [],
      aggregationId = null,
      includePatterns = true,
      includeErrors = true,
      includePerformance = true
    } = options;

    try {
      let logs;

      // Get logs from aggregation or sources
      if (aggregationId) {
        const aggResult = this.aggregator.getAggregatedLogs(aggregationId, {
          limit: 10000
        });
        logs = aggResult.logs;
      } else {
        const allLogs = this.capture.getAllLogs({ limit: 10000 });
        logs = allLogs.logs;

        if (sources.length > 0) {
          logs = logs.filter(log => sources.includes(log.sourceId));
        }
      }

      // Analyze logs
      const analysis = this.analyzer.analyzeLogs(logs, {
        includePatterns,
        includeErrors,
        includePerformance
      });

      return {
        success: true,
        ...analysis
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export logs to file
   */
  async exportLogs(outputPath, options = {}) {
    const {
      format = 'json',
      sources = [],
      aggregationId = null,
      filters = {},
      limit = null
    } = options;

    try {
      let logs;

      // Get logs from aggregation or sources
      if (aggregationId) {
        const aggResult = this.aggregator.getAggregatedLogs(aggregationId, {
          limit: limit || 100000
        });
        logs = aggResult.logs;
      } else {
        const allLogs = this.capture.getAllLogs({ limit: limit || 100000 });
        logs = allLogs.logs;

        if (sources.length > 0) {
          logs = logs.filter(log => sources.includes(log.sourceId));
        }
      }

      // Apply filters
      if (filters.level) {
        logs = logs.filter(log => log.level === filters.level);
      }
      if (filters.startTime) {
        logs = logs.filter(log => log.timestamp >= filters.startTime);
      }
      if (filters.endTime) {
        logs = logs.filter(log => log.timestamp <= filters.endTime);
      }

      // Export logs
      const exportResult = await this.exporter.exportLogs(logs, outputPath, {
        format,
        ...options
      });

      return {
        success: true,
        ...exportResult
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Aggregate logs from multiple sources
   */
  async aggregateLogs(aggregationId, sources, options = {}) {
    const {
      name = aggregationId,
      description = '',
      correlationKey = null,
      bufferSize = 5000
    } = options;

    try {
      const result = this.aggregator.createAggregation(aggregationId, {
        sources,
        name,
        description,
        correlationKey,
        bufferSize
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Monitor errors in real-time
   */
  async monitorErrors(options = {}) {
    const {
      sources = [],
      threshold = 5,
      windowMs = 60000,
      callback = null
    } = options;

    try {
      // Create error-only stream
      const streamResult = await this.streamLogs({
        streamId: `error-monitor-${Date.now()}`,
        sources,
        levels: ['error'],
        realtime: true
      });

      // Set up error monitoring
      let errorCount = 0;
      let windowStart = Date.now();

      const monitorId = `monitor-${Date.now()}`;
      
      this.streamer.subscribe(streamResult.streamId, monitorId, (logEntry) => {
        const now = Date.now();
        
        // Reset window if needed
        if (now - windowStart > windowMs) {
          errorCount = 0;
          windowStart = now;
        }

        errorCount++;

        // Check threshold
        if (errorCount >= threshold) {
          const alert = {
            type: 'error_threshold',
            threshold,
            count: errorCount,
            window: windowMs,
            timestamp: new Date(),
            lastError: logEntry
          };

          this.emit('error-alert', alert);
          
          if (callback) {
            callback(alert);
          }

          // Reset count after alert
          errorCount = 0;
        }
      });

      return {
        success: true,
        streamId: streamResult.streamId,
        monitorId,
        threshold,
        window: windowMs
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop capturing from a source
   */
  async stopCapture(sourceId) {
    try {
      const result = this.capture.stopCapture(sourceId);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get source information
   */
  async getSourceInfo(sourceId) {
    try {
      const info = this.capture.getSourceInfo(sourceId);
      if (!info) {
        throw new Error(`Source ${sourceId} not found`);
      }

      return {
        success: true,
        ...info
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all active sources
   */
  async listSources() {
    try {
      const sources = this.capture.listSources();
      return {
        success: true,
        sources,
        count: sources.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all aggregations
   */
  async listAggregations() {
    try {
      const aggregations = this.aggregator.listAggregations();
      return {
        success: true,
        aggregations,
        count: aggregations.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all streams
   */
  async listStreams() {
    try {
      const streams = this.streamer.listStreams();
      return {
        success: true,
        streams,
        count: streams.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    try {
      const sources = this.capture.listSources();
      const aggregations = this.aggregator.listAggregations();
      const streams = this.streamer.listStreams();

      return {
        success: true,
        sources: sources.length,
        aggregations: aggregations.length,
        streams: streams.length,
        totalLogs: sources.reduce((sum, source) => sum + (source.lineCount || 0), 0)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup all resources
   */
  async cleanup() {
    try {
      this.capture.cleanup();
      this.aggregator.cleanup();
      this.streamer.cleanup();
      this.removeAllListeners();

      return {
        success: true,
        message: 'All resources cleaned up'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}