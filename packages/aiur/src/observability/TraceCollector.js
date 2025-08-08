/**
 * TraceCollector - Central service for collecting and managing execution traces
 * 
 * Features:
 * - Hierarchical span management with parent-child relationships
 * - Automatic trace correlation across agent boundaries
 * - Memory-efficient circular buffer for recent traces
 * - Multiple export formats (JSON, readable text, OpenTelemetry)
 * - Performance metrics aggregation
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// Span states
const SpanStatus = {
  UNSET: 'unset',
  OK: 'ok',
  ERROR: 'error'
};

// Span kinds
const SpanKind = {
  INTERNAL: 'internal',
  SERVER: 'server',
  CLIENT: 'client',
  PRODUCER: 'producer',
  CONSUMER: 'consumer'
};

/**
 * Represents a single span in a trace
 */
class Span {
  constructor(options = {}) {
    this.spanId = options.spanId || randomUUID();
    this.traceId = options.traceId || randomUUID();
    this.parentSpanId = options.parentSpanId || null;
    this.name = options.name || 'unknown';
    this.kind = options.kind || SpanKind.INTERNAL;
    this.startTime = Date.now();
    this.endTime = null;
    this.status = SpanStatus.UNSET;
    this.attributes = options.attributes || {};
    this.events = [];
    this.links = [];
    this.resource = options.resource || {};
  }

  /**
   * Add an event to the span
   */
  addEvent(name, attributes = {}) {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
  }

  /**
   * Set span attributes
   */
  setAttributes(attributes) {
    Object.assign(this.attributes, attributes);
  }

  /**
   * Set span status
   */
  setStatus(status, message) {
    this.status = status;
    if (message) {
      this.attributes.statusMessage = message;
    }
  }

  /**
   * End the span
   */
  end(attributes = {}) {
    this.endTime = Date.now();
    this.setAttributes(attributes);
    
    // Auto-set status based on attributes
    if (attributes.error || attributes.exception) {
      this.status = SpanStatus.ERROR;
    } else if (this.status === SpanStatus.UNSET) {
      this.status = SpanStatus.OK;
    }
    
    return this;
  }

  /**
   * Get span duration in milliseconds
   */
  getDuration() {
    if (!this.endTime) return null;
    return this.endTime - this.startTime;
  }

  /**
   * Convert to JSON for export
   */
  toJSON() {
    return {
      spanId: this.spanId,
      traceId: this.traceId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration(),
      status: this.status,
      attributes: this.attributes,
      events: this.events,
      links: this.links,
      resource: this.resource
    };
  }
}

/**
 * Main TraceCollector service
 */
export class TraceCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuration
    this.maxTraces = config.maxTraces || 1000;
    this.maxSpansPerTrace = config.maxSpansPerTrace || 10000;
    this.flushInterval = config.flushInterval || 5000;
    this.enabled = config.enabled !== false;
    
    // Storage
    this.traces = new Map(); // traceId -> Map of spans
    this.activeSpans = new Map(); // spanId -> span
    this.completedTraces = []; // Circular buffer of completed traces
    
    // Metrics
    this.metrics = {
      totalSpans: 0,
      totalTraces: 0,
      errorSpans: 0,
      droppedSpans: 0,
      avgSpanDuration: 0
    };
    
    // Context storage for async operations
    this.contextStorage = new Map();
    
    // Start periodic flush
    if (this.flushInterval > 0) {
      this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
    }
    
    // Singleton instance
    if (!TraceCollector.instance) {
      TraceCollector.instance = this;
    }
    return TraceCollector.instance;
  }

  /**
   * Get singleton instance
   */
  static getInstance(config = {}) {
    if (!TraceCollector.instance) {
      TraceCollector.instance = new TraceCollector(config);
    }
    return TraceCollector.instance;
  }

  /**
   * Start a new span
   */
  startSpan(options = {}) {
    if (!this.enabled) {
      return { end: () => {}, addEvent: () => {}, setAttributes: () => {} };
    }
    
    // Extract parent context
    const parentContext = options.parent || this.getCurrentContext();
    const traceId = parentContext?.traceId || options.traceId || randomUUID();
    const parentSpanId = parentContext?.spanId || options.parentSpanId;
    
    // Create span
    const span = new Span({
      ...options,
      traceId,
      parentSpanId,
      resource: {
        service: options.service || 'legion',
        version: options.version || '1.0.0',
        ...options.resource
      }
    });
    
    // Store span
    this.activeSpans.set(span.spanId, span);
    
    // Add to trace
    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, new Map());
      this.metrics.totalTraces++;
    }
    this.traces.get(traceId).set(span.spanId, span);
    
    this.metrics.totalSpans++;
    
    // Emit event
    this.emit('span:start', span);
    
    // Return wrapped span with auto-end on error
    return this.wrapSpan(span);
  }

  /**
   * Wrap span with auto-end functionality
   */
  wrapSpan(span) {
    const collector = this;
    
    return {
      ...span,
      end(attributes = {}) {
        span.end(attributes);
        collector.endSpan(span);
        return span;
      },
      addEvent(name, attributes) {
        span.addEvent(name, attributes);
        return this;
      },
      setAttributes(attributes) {
        span.setAttributes(attributes);
        return this;
      },
      setStatus(status, message) {
        span.setStatus(status, message);
        return this;
      },
      // Context for child spans
      getContext() {
        return {
          traceId: span.traceId,
          spanId: span.spanId
        };
      }
    };
  }

  /**
   * End a span
   */
  endSpan(span) {
    if (!this.enabled) return;
    
    // Remove from active spans
    this.activeSpans.delete(span.spanId);
    
    // Update metrics
    if (span.status === SpanStatus.ERROR) {
      this.metrics.errorSpans++;
    }
    
    const duration = span.getDuration();
    if (duration) {
      this.metrics.avgSpanDuration = 
        (this.metrics.avgSpanDuration * (this.metrics.totalSpans - 1) + duration) / 
        this.metrics.totalSpans;
    }
    
    // Emit event
    this.emit('span:end', span);
    
    // Check if trace is complete
    this.checkTraceCompletion(span.traceId);
  }

  /**
   * Check if a trace is complete (no active spans)
   */
  checkTraceCompletion(traceId) {
    const traceSpans = this.traces.get(traceId);
    if (!traceSpans) return;
    
    const hasActiveSpans = Array.from(traceSpans.values()).some(
      span => !span.endTime
    );
    
    if (!hasActiveSpans) {
      // Trace is complete
      const trace = this.buildTrace(traceId);
      this.completedTraces.push(trace);
      
      // Maintain circular buffer
      if (this.completedTraces.length > this.maxTraces) {
        this.completedTraces.shift();
      }
      
      // Clean up
      this.traces.delete(traceId);
      
      // Emit event
      this.emit('trace:complete', trace);
    }
  }

  /**
   * Build a complete trace from spans
   */
  buildTrace(traceId) {
    const spans = this.traces.get(traceId);
    if (!spans) return null;
    
    const spanArray = Array.from(spans.values());
    const rootSpan = spanArray.find(s => !s.parentSpanId) || spanArray[0];
    
    return {
      traceId,
      rootSpan: rootSpan?.name,
      startTime: Math.min(...spanArray.map(s => s.startTime)),
      endTime: Math.max(...spanArray.filter(s => s.endTime).map(s => s.endTime)),
      duration: null, // Will be calculated
      spanCount: spanArray.length,
      errorCount: spanArray.filter(s => s.status === SpanStatus.ERROR).length,
      spans: spanArray.map(s => s.toJSON())
    };
  }

  /**
   * Record an event (for backward compatibility)
   */
  recordEvent(options = {}) {
    const currentSpan = this.getCurrentSpan();
    if (currentSpan) {
      currentSpan.addEvent(options.type || 'event', options.data || {});
    } else {
      // Create a single-event span
      const span = this.startSpan({
        name: options.type || 'event',
        attributes: options.data || {}
      });
      span.end();
    }
  }

  /**
   * Get current span from context
   */
  getCurrentSpan() {
    // In a real implementation, this would use AsyncLocalStorage
    // For now, return the most recent active span
    const spans = Array.from(this.activeSpans.values());
    return spans[spans.length - 1] || null;
  }

  /**
   * Get current context
   */
  getCurrentContext() {
    const span = this.getCurrentSpan();
    if (!span) return null;
    
    return {
      traceId: span.traceId,
      spanId: span.spanId
    };
  }

  /**
   * Set context for async operations
   */
  setContext(key, context) {
    this.contextStorage.set(key, context);
  }

  /**
   * Get context for async operations
   */
  getContext(key) {
    return this.contextStorage.get(key);
  }

  /**
   * Clear context
   */
  clearContext(key) {
    this.contextStorage.delete(key);
  }

  /**
   * Get all completed traces
   */
  getCompletedTraces(limit = 100) {
    return this.completedTraces.slice(-limit);
  }

  /**
   * Get active traces
   */
  getActiveTraces() {
    return Array.from(this.traces.entries()).map(([traceId, spans]) => {
      const spanArray = Array.from(spans.values());
      return {
        traceId,
        spanCount: spanArray.length,
        activeSpanCount: spanArray.filter(s => !s.endTime).length,
        startTime: Math.min(...spanArray.map(s => s.startTime)),
        spans: spanArray.map(s => s.toJSON())
      };
    });
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeSpans: this.activeSpans.size,
      activeTraces: this.traces.size,
      completedTraces: this.completedTraces.length
    };
  }

  /**
   * Export traces in various formats
   */
  export(format = 'json', options = {}) {
    const traces = options.includeActive ? 
      [...this.getCompletedTraces(options.limit), ...this.getActiveTraces()] :
      this.getCompletedTraces(options.limit);
    
    switch (format) {
      case 'json':
        return JSON.stringify(traces, null, 2);
      
      case 'readable':
        return this.formatReadable(traces);
      
      case 'opentelemetry':
        return this.formatOpenTelemetry(traces);
      
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  /**
   * Format traces as human-readable text
   */
  formatReadable(traces) {
    let output = '';
    
    for (const trace of traces) {
      output += `\n${'='.repeat(80)}\n`;
      output += `Trace: ${trace.traceId}\n`;
      output += `Root: ${trace.rootSpan || 'unknown'}\n`;
      output += `Duration: ${trace.duration || 'ongoing'}ms\n`;
      output += `Spans: ${trace.spanCount} (${trace.errorCount} errors)\n`;
      output += `${'─'.repeat(80)}\n`;
      
      // Build span tree
      const spanMap = new Map(trace.spans.map(s => [s.spanId, s]));
      const rootSpans = trace.spans.filter(s => !s.parentSpanId);
      
      const formatSpan = (span, indent = 0) => {
        const prefix = '  '.repeat(indent) + (indent > 0 ? '└─ ' : '');
        const duration = span.duration ? `${span.duration}ms` : 'ongoing';
        const status = span.status === SpanStatus.ERROR ? ' ❌' : 
                       span.status === SpanStatus.OK ? ' ✓' : '';
        
        output += `${prefix}${span.name} (${duration})${status}\n`;
        
        // Add attributes if present
        if (Object.keys(span.attributes).length > 0) {
          const attrPrefix = '  '.repeat(indent + 1);
          for (const [key, value] of Object.entries(span.attributes)) {
            output += `${attrPrefix}• ${key}: ${JSON.stringify(value)}\n`;
          }
        }
        
        // Add events if present
        if (span.events.length > 0) {
          const eventPrefix = '  '.repeat(indent + 1);
          for (const event of span.events) {
            output += `${eventPrefix}⚡ ${event.name}\n`;
          }
        }
        
        // Format child spans
        const children = trace.spans.filter(s => s.parentSpanId === span.spanId);
        for (const child of children) {
          formatSpan(child, indent + 1);
        }
      };
      
      for (const rootSpan of rootSpans) {
        formatSpan(rootSpan);
      }
    }
    
    return output;
  }

  /**
   * Format traces as OpenTelemetry format
   */
  formatOpenTelemetry(traces) {
    // Simplified OpenTelemetry format
    return {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'legion' } },
            { key: 'service.version', value: { stringValue: '1.0.0' } }
          ]
        },
        scopeSpans: [{
          scope: { name: 'legion.tracer', version: '1.0.0' },
          spans: traces.flatMap(t => t.spans.map(s => ({
            traceId: s.traceId,
            spanId: s.spanId,
            parentSpanId: s.parentSpanId,
            name: s.name,
            kind: s.kind,
            startTimeUnixNano: s.startTime * 1000000,
            endTimeUnixNano: s.endTime ? s.endTime * 1000000 : undefined,
            attributes: Object.entries(s.attributes).map(([k, v]) => ({
              key: k,
              value: { stringValue: String(v) }
            })),
            events: s.events.map(e => ({
              name: e.name,
              timeUnixNano: e.timestamp * 1000000,
              attributes: Object.entries(e.attributes).map(([k, v]) => ({
                key: k,
                value: { stringValue: String(v) }
              }))
            })),
            status: {
              code: s.status === SpanStatus.ERROR ? 2 : 
                    s.status === SpanStatus.OK ? 1 : 0
            }
          })))
        }]
      }]
    };
  }

  /**
   * Flush pending traces
   */
  flush() {
    // Check for stale active spans (> 5 minutes)
    const staleTime = Date.now() - 300000;
    for (const [spanId, span] of this.activeSpans) {
      if (span.startTime < staleTime) {
        span.setStatus(SpanStatus.ERROR, 'Span timeout');
        span.end({ error: 'Automatic timeout after 5 minutes' });
        this.endSpan(span);
        this.metrics.droppedSpans++;
      }
    }
  }

  /**
   * Clear all traces
   */
  clear() {
    this.traces.clear();
    this.activeSpans.clear();
    this.completedTraces = [];
    this.contextStorage.clear();
    this.metrics = {
      totalSpans: 0,
      totalTraces: 0,
      errorSpans: 0,
      droppedSpans: 0,
      avgSpanDuration: 0
    };
  }

  /**
   * Shutdown the collector
   */
  shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
    this.removeAllListeners();
  }
}

// Export singleton instance getter
export const getTraceCollector = TraceCollector.getInstance;