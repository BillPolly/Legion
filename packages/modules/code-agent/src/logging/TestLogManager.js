/**
 * TestLogManager - Comprehensive log capture and management for testing
 * 
 * Provides log capture, streaming, buffering, and correlation capabilities
 * for all testing phases including unit, integration, and browser testing.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

/**
 * LogEntry interface for structured log data
 */
class LogEntry {
  constructor(data) {
    this.id = randomUUID();
    this.timestamp = data.timestamp || Date.now();
    this.level = data.level || 'info';
    this.source = data.source || 'unknown';
    this.message = data.message || '';
    this.correlationId = data.correlationId || randomUUID();
    this.processId = data.processId || null;
    this.metadata = data.metadata || {};
    this.stack = data.stack || null;
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      level: this.level,
      source: this.source,
      message: this.message,
      correlationId: this.correlationId,
      processId: this.processId,
      metadata: this.metadata,
      stack: this.stack
    };
  }

  toString() {
    const date = new Date(this.timestamp).toISOString();
    return `[${date}] [${this.level.toUpperCase()}] [${this.source}] ${this.message}`;
  }
}

/**
 * TestLogManager class for comprehensive log management
 */
class TestLogManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuration with defaults
    this.config = {
      logLevel: 'info',
      bufferSize: 1000,
      enableStreaming: true,
      enableAnalysis: true,
      outputFormat: 'structured',
      captureStdout: true,
      captureStderr: true,
      correlationEnabled: true,
      timeWindowMs: 5000,
      ...config
    };
    
    // Validate configuration
    this.validateConfig();
    
    // State management
    this.isInitialized = false;
    this.logBuffer = [];
    this.logStreams = new Map();
    this.processAttachments = new Map();
    this.correlationMap = new Map();
    
    // Streaming
    this.streamingEnabled = false;
    this.streamingCallback = null;
    
    // Log levels for filtering
    this.logLevels = {
      trace: 0,
      debug: 1,
      info: 2,
      warn: 3,
      error: 4
    };
    
    // Performance metrics
    this.metrics = {
      logsProcessed: 0,
      logsDropped: 0,
      streamingErrors: 0,
      processingTime: 0
    };
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    const validLogLevels = ['trace', 'debug', 'info', 'warn', 'error'];
    const validOutputFormats = ['json', 'text', 'structured'];
    
    if (!validLogLevels.includes(this.config.logLevel)) {
      throw new Error(`Invalid log level: ${this.config.logLevel}`);
    }
    
    if (this.config.bufferSize < 1 || this.config.bufferSize > 100000) {
      throw new Error(`Invalid buffer size: ${this.config.bufferSize}`);
    }
    
    if (!validOutputFormats.includes(this.config.outputFormat)) {
      throw new Error(`Invalid output format: ${this.config.outputFormat}`);
    }
  }

  /**
   * Initialize the log manager
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    this.emit('initializing', { timestamp: Date.now() });

    try {
      // Initialize log buffer
      this.logBuffer = [];
      
      // Initialize stream management
      this.logStreams = new Map();
      this.processAttachments = new Map();
      
      // Set up correlation tracking
      this.correlationMap = new Map();
      
      // Enable streaming if configured
      if (this.config.enableStreaming) {
        this.streamingEnabled = true;
      }
      
      this.isInitialized = true;
      this.emit('initialized', { timestamp: Date.now() });
      
    } catch (error) {
      this.emit('initialization-error', { error: error.message, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Attach to a process for log capture
   */
  async attachToProcess(process) {
    if (!this.isInitialized) {
      throw new Error('TestLogManager not initialized');
    }

    const processId = process.pid;
    const attachment = {
      processId,
      process,
      startTime: Date.now(),
      logCount: 0
    };

    try {
      // Attach to stdout
      if (this.config.captureStdout && process.stdout) {
        process.stdout.on('data', (data) => {
          this.processLogData(data.toString(), {
            source: `process-${processId}`,
            stream: 'stdout',
            processId
          });
        });
      }

      // Attach to stderr
      if (this.config.captureStderr && process.stderr) {
        process.stderr.on('data', (data) => {
          this.processLogData(data.toString(), {
            source: `process-${processId}`,
            stream: 'stderr',
            processId,
            level: 'error'
          });
        });
      }

      // Track attachment
      this.processAttachments.set(processId, attachment);
      
      this.emit('process-attached', { processId, timestamp: Date.now() });
      
      return {
        processId,
        attached: true,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.emit('attachment-error', { processId, error: error.message, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Capture logs from a string source
   */
  async captureLogs(source, logData, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('TestLogManager not initialized');
    }

    try {
      this.processLogData(logData, {
        source,
        ...metadata
      });
      
      return {
        source,
        captured: true,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.emit('capture-error', { source, error: error.message, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Process log data and create log entries
   */
  processLogData(data, metadata = {}) {
    const startTime = Date.now();
    
    try {
      // Split multi-line data
      const lines = data.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const logEntry = this.createLogEntry(line, metadata);
        this.addToBuffer(logEntry);
        
        // Handle streaming
        if (this.streamingEnabled && this.streamingCallback) {
          this.streamLog(logEntry);
        }
        
        // Handle correlation
        if (this.config.correlationEnabled) {
          this.updateCorrelation(logEntry);
        }
      }
      
      this.metrics.logsProcessed += lines.length;
      this.metrics.processingTime += Date.now() - startTime;
      
    } catch (error) {
      this.metrics.streamingErrors++;
      this.emit('processing-error', { error: error.message, timestamp: Date.now() });
      // Don't throw - continue processing other logs
    }
  }

  /**
   * Create a structured log entry
   */
  createLogEntry(message, metadata = {}) {
    // Extract log level from message
    const level = this.extractLogLevel(message);
    
    return new LogEntry({
      timestamp: metadata.timestamp || Date.now(),
      level: metadata.level || level,
      source: metadata.source || 'unknown',
      message: message.trim(),
      correlationId: metadata.correlationId || randomUUID(),
      processId: metadata.processId || null,
      metadata: {
        stream: metadata.stream || 'unknown',
        ...metadata.metadata
      },
      stack: metadata.stack || null
    });
  }

  /**
   * Extract log level from message
   */
  extractLogLevel(message) {
    const upperMessage = message.toUpperCase();
    
    if (upperMessage.includes('ERROR:') || upperMessage.includes('[ERROR]')) {
      return 'error';
    }
    if (upperMessage.includes('WARN:') || upperMessage.includes('[WARN]')) {
      return 'warn';
    }
    if (upperMessage.includes('DEBUG:') || upperMessage.includes('[DEBUG]')) {
      return 'debug';
    }
    if (upperMessage.includes('TRACE:') || upperMessage.includes('[TRACE]')) {
      return 'trace';
    }
    
    return 'info';
  }

  /**
   * Add log entry to buffer
   */
  addToBuffer(logEntry) {
    // Check if log level meets threshold
    if (this.logLevels[logEntry.level] < this.logLevels[this.config.logLevel]) {
      return;
    }

    // Add to buffer
    this.logBuffer.push(logEntry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.config.bufferSize) {
      const dropped = this.logBuffer.shift();
      this.metrics.logsDropped++;
      this.emit('log-dropped', { droppedLog: dropped.id, timestamp: Date.now() });
    }
    
    this.emit('log-added', { logId: logEntry.id, timestamp: Date.now() });
  }

  /**
   * Stream log to callback
   */
  streamLog(logEntry) {
    if (!this.streamingCallback) {
      return;
    }

    try {
      this.streamingCallback(logEntry);
    } catch (error) {
      this.metrics.streamingErrors++;
      this.emit('streaming-error', { error: error.message, timestamp: Date.now() });
    }
  }

  /**
   * Update correlation mapping
   */
  updateCorrelation(logEntry) {
    if (!this.correlationMap.has(logEntry.correlationId)) {
      this.correlationMap.set(logEntry.correlationId, []);
    }
    
    this.correlationMap.get(logEntry.correlationId).push(logEntry.id);
  }

  /**
   * Enable log streaming
   */
  enableStreaming(callback) {
    this.streamingEnabled = true;
    this.streamingCallback = callback;
    this.emit('streaming-enabled', { timestamp: Date.now() });
  }

  /**
   * Disable log streaming
   */
  disableStreaming() {
    this.streamingEnabled = false;
    this.streamingCallback = null;
    this.emit('streaming-disabled', { timestamp: Date.now() });
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level) {
    return this.logBuffer.filter(log => log.level === level);
  }

  /**
   * Get logs by source
   */
  getLogsBySource(source) {
    return this.logBuffer.filter(log => log.source === source);
  }

  /**
   * Get logs by process ID
   */
  async getLogsByProcess(processId) {
    const logs = this.logBuffer.filter(log => log.processId === processId);
    
    return {
      processId,
      logs,
      count: logs.length,
      timestamp: Date.now()
    };
  }

  /**
   * Get logs by correlation ID
   */
  getLogsByCorrelationId(correlationId) {
    return this.logBuffer.filter(log => log.correlationId === correlationId);
  }

  /**
   * Get logs by time range
   */
  getLogsByTimeRange(startTime, endTime) {
    return this.logBuffer.filter(log => 
      log.timestamp >= startTime && log.timestamp <= endTime
    );
  }

  /**
   * Correlate logs by time window
   */
  correlateLogsByTimeWindow(baseTime, windowMs) {
    const startTime = baseTime - windowMs / 2;
    const endTime = baseTime + windowMs / 2;
    
    return this.getLogsByTimeRange(startTime, endTime);
  }

  /**
   * Get all logs
   */
  getAllLogs() {
    return [...this.logBuffer];
  }

  /**
   * Clear log buffer
   */
  clearBuffer() {
    const clearedCount = this.logBuffer.length;
    this.logBuffer = [];
    this.correlationMap.clear();
    
    this.emit('buffer-cleared', { clearedCount, timestamp: Date.now() });
  }

  /**
   * Export logs in different formats
   */
  exportLogs(format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(this.logBuffer.map(log => log.toJSON()), null, 2);
      
      case 'text':
        return this.logBuffer.map(log => log.toString()).join('\n');
      
      case 'structured':
        return this.logBuffer.map(log => {
          return [
            `timestamp: ${new Date(log.timestamp).toISOString()}`,
            `level: ${log.level}`,
            `source: ${log.source}`,
            `message: ${log.message}`,
            `correlationId: ${log.correlationId}`,
            log.processId ? `processId: ${log.processId}` : '',
            '---'
          ].filter(line => line).join('\n');
        }).join('\n');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      bufferSize: this.logBuffer.length,
      processAttachments: this.processAttachments.size,
      correlationMappings: this.correlationMap.size,
      averageProcessingTime: this.metrics.logsProcessed > 0 ? 
        this.metrics.processingTime / this.metrics.logsProcessed : 0
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.emit('cleanup-started', { timestamp: Date.now() });

    try {
      // Disable streaming
      this.disableStreaming();
      
      // Clear buffer
      this.clearBuffer();
      
      // Clean up process attachments
      await this.cleanupProcessAttachments();
      
      // Clean up streams
      await this.cleanupStreams();
      
      // Reset state
      this.isInitialized = false;
      this.processAttachments.clear();
      this.logStreams.clear();
      
      this.emit('cleanup-complete', { timestamp: Date.now() });
      
    } catch (error) {
      this.emit('cleanup-error', { error: error.message, timestamp: Date.now() });
      // Don't throw - best effort cleanup
    }
  }

  /**
   * Clean up process attachments
   */
  async cleanupProcessAttachments() {
    const attachments = Array.from(this.processAttachments.values());
    
    for (const attachment of attachments) {
      try {
        // Remove event listeners if possible
        if (attachment.process && attachment.process.removeAllListeners) {
          attachment.process.removeAllListeners();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Clean up streams
   */
  async cleanupStreams() {
    const streams = Array.from(this.logStreams.values());
    
    for (const stream of streams) {
      try {
        if (stream.destroy) {
          stream.destroy();
        }
        if (stream.close) {
          stream.close();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

export { TestLogManager, LogEntry };