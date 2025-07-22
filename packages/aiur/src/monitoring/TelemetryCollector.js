/**
 * Telemetry Collector
 * 
 * Collects system telemetry, traces operations, batches data for transmission,
 * supports custom dimensions and sampling, and exports in multiple formats
 */

import { EventEmitter } from 'events';
import os from 'os';

export class TelemetryCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      batchSize: options.batchSize || 100,
      flushInterval: options.flushInterval || 30000, // 30 seconds
      enableMetrics: options.enableMetrics !== false,
      enableTracing: options.enableTracing !== false,
      samplingRate: options.samplingRate || 1.0, // Sample 100% by default
      maxBufferSize: options.maxBufferSize || 10000,
      ...options
    };

    // Data storage
    this.events = [];
    this.traces = new Map();
    this.completedTraces = [];
    this.systemMetrics = [];
    
    // Configuration
    this.dimensions = {};
    this.started = false;
    
    // Batch processing
    this.batchHandlers = [];
    this.flushTimer = null;
    
    // System monitoring
    this.systemMonitorTimer = null;
  }

  /**
   * Start telemetry collection
   */
  async start() {
    if (this.started) return;

    this.started = true;
    this.startTime = Date.now();

    // Start batch processing
    this._startBatchProcessing();
    
    // Start system monitoring if enabled
    if (this.options.enableMetrics) {
      this._startSystemMonitoring();
    }

    this.emit('telemetry-started');
  }

  /**
   * Stop telemetry collection
   */
  async stop() {
    if (!this.started) return;

    this.started = false;

    // Stop timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.systemMonitorTimer) {
      clearInterval(this.systemMonitorTimer);
      this.systemMonitorTimer = null;
    }

    // Flush remaining data
    await this._flush();

    this.emit('telemetry-stopped');
  }

  /**
   * Record a telemetry event
   */
  recordEvent(name, data = {}, options = {}) {
    // Auto-start if not started
    if (!this.started) {
      this.start();
    }
    
    if (!this._shouldSample()) {
      return;
    }

    const event = {
      id: this._generateId(),
      name,
      data,
      timestamp: new Date(),
      dimensions: { ...this.dimensions, ...options.dimensions },
      tags: options.tags || {},
      severity: options.severity || 'info'
    };

    this.events.push(event);
    this.emit('event-recorded', event);

    // Check if buffer is getting too large or at batch size
    if (this.events.length >= this.options.maxBufferSize || 
        this.events.length >= this.options.batchSize) {
      this._flush();
    }
  }

  /**
   * Start a distributed trace
   */
  startTrace(operationName, parentTraceId = null) {
    const traceId = this._generateTraceId();
    
    const trace = {
      id: traceId,
      operationName,
      parentTraceId,
      startTime: Date.now(),
      spans: [],
      status: 'active',
      dimensions: { ...this.dimensions }
    };

    this.traces.set(traceId, trace);
    this.emit('trace-started', trace);
    
    return traceId;
  }

  /**
   * Add a span to a trace
   */
  addSpan(traceId, spanName, data = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const span = {
      id: this._generateId(),
      name: spanName,
      startTime: data.startTime || Date.now(),
      data,
      tags: data.tags || {},
      duration: data.duration || 0
    };

    trace.spans.push(span);
    this.emit('span-added', { traceId, span });
    
    return span.id;
  }

  /**
   * Finish a trace
   */
  finishTrace(traceId, status = 'completed') {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    trace.endTime = Date.now();
    trace.totalDuration = trace.endTime - trace.startTime;
    trace.status = status;
    
    // If spans have durations, use the sum of span durations as minimum total duration
    const spanDurationSum = trace.spans.reduce((sum, span) => sum + (span.duration || 0), 0);
    if (spanDurationSum > trace.totalDuration) {
      trace.totalDuration = spanDurationSum;
    }

    // Move to completed traces
    this.traces.delete(traceId);
    this.completedTraces.push(trace);

    this.emit('trace-finished', trace);
    
    // Keep completed traces bounded
    if (this.completedTraces.length > 1000) {
      this.completedTraces.shift();
    }

    return trace;
  }

  /**
   * Get telemetry snapshot
   */
  getTelemetrySnapshot() {
    const systemInfo = this._getSystemInfo();
    const processInfo = this._getProcessInfo();
    
    return {
      system: systemInfo,
      process: processInfo,
      telemetry: {
        eventsCount: this.events.length,
        activeTraces: this.traces.size,
        completedTraces: this.completedTraces.length,
        uptime: this.started ? Date.now() - this.startTime : 0
      },
      dimensions: { ...this.dimensions },
      timestamp: new Date()
    };
  }

  /**
   * Add global dimensions to all telemetry data
   */
  addDimensions(dimensions) {
    this.dimensions = { ...this.dimensions, ...dimensions };
    this.emit('dimensions-added', dimensions);
  }

  /**
   * Remove dimensions
   */
  removeDimensions(keys) {
    for (const key of keys) {
      delete this.dimensions[key];
    }
    this.emit('dimensions-removed', keys);
  }

  /**
   * Register batch handler
   */
  onBatch(handler) {
    this.batchHandlers.push(handler);
  }

  /**
   * Get unsent events
   */
  getUnsentEvents() {
    return [...this.events];
  }

  /**
   * Get traces
   */
  getTraces(includeActive = false) {
    const traces = [...this.completedTraces];
    
    if (includeActive) {
      traces.push(...Array.from(this.traces.values()));
    }
    
    return traces;
  }

  /**
   * Export telemetry data in specified format
   */
  async export(format = 'json') {
    const data = {
      events: this.events,
      traces: this.completedTraces,
      systemMetrics: this.systemMetrics,
      snapshot: this.getTelemetrySnapshot()
    };

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data.events, null, 2);
        
      case 'csv':
        return this._exportToCsv(data.events);
        
      case 'metrics':
        return this._exportMetrics(data);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Clear all collected data
   */
  clear() {
    this.events = [];
    this.completedTraces = [];
    this.systemMetrics = [];
    this.traces.clear();
    
    this.emit('data-cleared');
  }

  /**
   * Start batch processing
   * @private
   */
  _startBatchProcessing() {
    this.flushTimer = setInterval(() => {
      this._flush();
    }, this.options.flushInterval);
  }

  /**
   * Start system monitoring
   * @private
   */
  _startSystemMonitoring() {
    // Don't auto-collect in test environment
    if (process.env.NODE_ENV === 'test' || this.options.disableAutoMetrics) {
      return;
    }
    
    // Initial collection
    this._collectSystemMetrics();
    
    // Periodic collection
    this.systemMonitorTimer = setInterval(() => {
      this._collectSystemMetrics();
    }, 60000); // Every minute
  }

  /**
   * Collect system metrics
   * @private
   */
  _collectSystemMetrics() {
    try {
      const memInfo = process.memoryUsage();
      const cpuInfo = os.loadavg();
      
      const metrics = {
        timestamp: Date.now(),
        memory: {
          heapUsed: memInfo.heapUsed,
          heapTotal: memInfo.heapTotal,
          rss: memInfo.rss,
          external: memInfo.external
        },
        cpu: {
          load1: cpuInfo[0],
          load5: cpuInfo[1],
          load15: cpuInfo[2]
        },
        system: {
          uptime: os.uptime(),
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version
        }
      };

      this.systemMetrics.push(metrics);
      
      // Keep only recent metrics
      if (this.systemMetrics.length > 1440) { // 24 hours at 1-minute intervals
        this.systemMetrics.shift();
      }

      // Also record as events
      this.recordEvent('system.metrics', metrics);
      
    } catch (error) {
      this.emit('system-metrics-error', error);
    }
  }

  /**
   * Flush batches to handlers
   * @private
   */
  async _flush() {
    if (this.events.length === 0) return;

    const batch = {
      id: this._generateId(),
      events: this.events.splice(0, this.options.batchSize),
      timestamp: new Date(),
      dimensions: { ...this.dimensions }
    };

    // Send to all batch handlers
    for (const handler of this.batchHandlers) {
      try {
        await handler(batch);
      } catch (error) {
        this.emit('batch-handler-error', { handler, error, batch });
      }
    }

    this.emit('batch-flushed', batch);
  }

  /**
   * Check if event should be sampled
   * @private
   */
  _shouldSample() {
    return Math.random() <= this.options.samplingRate;
  }

  /**
   * Get system information
   * @private
   */
  _getSystemInfo() {
    const memInfo = process.memoryUsage();
    
    return {
      memory: {
        heapUsed: Math.round(memInfo.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memInfo.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memInfo.rss / 1024 / 1024), // MB
        external: Math.round(memInfo.external / 1024 / 1024) // MB
      },
      cpu: os.loadavg()[0], // 1-minute load average
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      freemem: Math.round(os.freemem() / 1024 / 1024), // MB
      totalmem: Math.round(os.totalmem() / 1024 / 1024) // MB
    };
  }

  /**
   * Get process information
   * @private
   */
  _getProcessInfo() {
    return {
      pid: process.pid,
      version: process.version,
      uptime: process.uptime(),
      argv: process.argv,
      cwd: process.cwd(),
      execPath: process.execPath
    };
  }

  /**
   * Export events to CSV format
   * @private
   */
  _exportToCsv(events) {
    if (events.length === 0) return '';

    const headers = ['timestamp', 'name', 'severity'];
    const rows = [headers.join(',')];

    for (const event of events) {
      const row = [
        event.timestamp.toISOString(),
        `"${event.name}"`,
        event.severity
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Export metrics format
   * @private
   */
  _exportMetrics(data) {
    const metrics = [];
    
    // Count events by name
    const eventCounts = {};
    for (const event of data.events) {
      eventCounts[event.name] = (eventCounts[event.name] || 0) + 1;
    }

    for (const [name, count] of Object.entries(eventCounts)) {
      metrics.push(`telemetry_events_total{name="${name}"} ${count}`);
    }

    // Add trace metrics
    metrics.push(`telemetry_traces_completed_total ${data.traces.length}`);

    // Add system metrics if available
    const latestSystemMetric = data.systemMetrics[data.systemMetrics.length - 1];
    if (latestSystemMetric) {
      metrics.push(`system_memory_heap_used_bytes ${latestSystemMetric.memory.heapUsed}`);
      metrics.push(`system_memory_heap_total_bytes ${latestSystemMetric.memory.heapTotal}`);
      metrics.push(`system_cpu_load_1m ${latestSystemMetric.cpu.load1}`);
    }

    return metrics.join('\n');
  }

  /**
   * Generate unique ID
   * @private
   */
  _generateId() {
    return `tel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID
   * @private
   */
  _generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }
}