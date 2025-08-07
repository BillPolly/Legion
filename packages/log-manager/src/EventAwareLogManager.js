/**
 * EventAwareLogManager - Extends LogManager to emit events to Universal Event System
 * 
 * Maintains all existing LogManager functionality while forwarding
 * structured log events to Jester's UniversalEventCollector for
 * unified event tracking and semantic search.
 */

import LogManager from './LogManager.js';

export class EventAwareLogManager extends LogManager {
  constructor(config = {}) {
    super(config);
    
    this.eventConfig = {
      enableEventCapture: config.enableEventCapture || true,
      enableCorrelation: config.enableCorrelation || true,
      correlationHeader: config.correlationHeader || 'x-correlation-id',
      serviceNameDefault: config.serviceNameDefault || 'unknown',
      ...config.eventConfig
    };
    
    // Will be injected by external system
    this.eventCollector = null;
    this.correlationTracker = new Map(); // requestId -> correlationId
    
    if (this.eventConfig.enableEventCapture) {
      this.setupEventForwarding();
    }
  }

  /**
   * Inject the UniversalEventCollector
   */
  setEventCollector(eventCollector) {
    this.eventCollector = eventCollector;
    console.log('EventAwareLogManager: Connected to UniversalEventCollector');
  }

  /**
   * Setup event forwarding from existing log capture system
   */
  setupEventForwarding() {
    // Forward all captured logs as structured events
    this.capture.on('log', (logEntry) => {
      // Send to original aggregator (preserve existing functionality)
      this.aggregator.addLog(logEntry);
      this.streamer.processLog(logEntry);
      this.emit('log', logEntry);
      
      // NEW: Also send as structured event to Universal Event System
      if (this.eventCollector) {
        this.forwardLogAsEvent(logEntry);
      }
    });

    // Forward aggregation events
    this.aggregator.on('aggregationComplete', (aggregation) => {
      if (this.eventCollector) {
        this.eventCollector.onRuntimeEvent('log_aggregation_complete', {
          aggregationId: aggregation.id,
          logCount: aggregation.logs.length,
          timeRange: aggregation.timeRange
        });
      }
    });

    // Forward error monitoring alerts
    this.on('error-alert', (alert) => {
      if (this.eventCollector) {
        this.eventCollector.onErrorEvent(new Error(alert.lastError?.message || 'Error threshold exceeded'), {
          source: 'log_monitor',
          threshold: alert.threshold,
          count: alert.count,
          window: alert.window,
          lastError: alert.lastError
        });
      }
    });
  }

  /**
   * Forward log entry as structured event
   */
  forwardLogAsEvent(logEntry) {
    // Enrich log entry with correlation ID if available
    const enrichedEntry = this.enrichWithCorrelation(logEntry);
    
    // Forward to universal event collector
    this.eventCollector.onStructuredLogEvent(enrichedEntry);
  }

  /**
   * Enrich log entry with correlation tracking
   */
  enrichWithCorrelation(logEntry) {
    const enriched = { ...logEntry };
    
    if (!enriched.context) {
      enriched.context = {};
    }

    // Extract correlation ID from various sources
    const correlationId = this.extractCorrelationId(logEntry);
    if (correlationId) {
      enriched.context.correlationId = correlationId;
      
      // Track correlation
      if (logEntry.requestId) {
        this.correlationTracker.set(logEntry.requestId, correlationId);
      }
    }

    // Add service name if missing
    if (!enriched.context.service) {
      enriched.context.service = this.extractServiceName(logEntry);
    }

    // Add structured metadata
    if (!enriched.metadata) {
      enriched.metadata = {};
    }

    // Enhanced metadata extraction
    enriched.metadata = {
      ...enriched.metadata,
      action: this.extractAction(logEntry.message),
      entity: this.extractEntity(logEntry.message),
      errorCode: this.extractErrorCode(logEntry.message),
      httpStatus: this.extractHttpStatus(logEntry.message),
      duration: this.extractDuration(logEntry.message)
    };

    return enriched;
  }

  /**
   * Extract correlation ID from log entry
   */
  extractCorrelationId(logEntry) {
    // Check context first
    if (logEntry.context?.correlationId) {
      return logEntry.context.correlationId;
    }

    // Check various header formats in the message
    const message = logEntry.message || '';
    
    // Common patterns
    const patterns = [
      /correlation[_-]?id[:\s]+([a-f0-9\-]+)/i,
      /corr[_-]?id[:\s]+([a-f0-9\-]+)/i,
      /trace[_-]?id[:\s]+([a-f0-9\-]+)/i,
      /request[_-]?id[:\s]+([a-f0-9\-]+)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract service name from log entry
   */
  extractServiceName(logEntry) {
    // Check context
    if (logEntry.context?.service) {
      return logEntry.context.service;
    }

    // Extract from source path or ID
    if (logEntry.sourceId) {
      const parts = logEntry.sourceId.split(/[\/\\]/);
      if (parts.length > 1) {
        return parts[parts.length - 2]; // Parent directory name
      }
    }

    return this.eventConfig.serviceNameDefault;
  }

  /**
   * Extract action from log message
   */
  extractAction(message) {
    if (!message) return null;
    
    const lowerMessage = message.toLowerCase();
    
    // Common action patterns
    const actions = [
      { pattern: /creating|created|create/, action: 'create' },
      { pattern: /updating|updated|update/, action: 'update' },
      { pattern: /deleting|deleted|delete/, action: 'delete' },
      { pattern: /authenticating|authenticated|login/, action: 'authenticate' },
      { pattern: /fetching|fetched|fetch|get/, action: 'fetch' },
      { pattern: /sending|sent|send|post/, action: 'send' },
      { pattern: /connecting|connected|connect/, action: 'connect' },
      { pattern: /processing|processed|process/, action: 'process' },
      { pattern: /validating|validated|validate/, action: 'validate' },
      { pattern: /parsing|parsed|parse/, action: 'parse' }
    ];

    for (const { pattern, action } of actions) {
      if (pattern.test(lowerMessage)) {
        return action;
      }
    }

    return null;
  }

  /**
   * Extract entity from log message
   */
  extractEntity(message) {
    if (!message) return null;
    
    const lowerMessage = message.toLowerCase();
    
    // Common entity patterns
    const entities = [
      { pattern: /user|account|profile/, entity: 'user' },
      { pattern: /order|purchase|transaction/, entity: 'order' },
      { pattern: /payment|billing|invoice/, entity: 'payment' },
      { pattern: /product|item|catalog/, entity: 'product' },
      { pattern: /database|db|table/, entity: 'database' },
      { pattern: /api|endpoint|service/, entity: 'api' },
      { pattern: /file|document|attachment/, entity: 'file' },
      { pattern: /session|token|auth/, entity: 'session' },
      { pattern: /email|notification|message/, entity: 'message' },
      { pattern: /configuration|config|setting/, entity: 'config' }
    ];

    for (const { pattern, entity } of entities) {
      if (pattern.test(lowerMessage)) {
        return entity;
      }
    }

    return null;
  }

  /**
   * Extract error code from message
   */
  extractErrorCode(message) {
    if (!message) return null;
    
    // Common error code patterns
    const patterns = [
      /error[_\s]*code[:\s]+([A-Z0-9_]+)/i,
      /\b([A-Z]+_[A-Z_]+_ERROR)\b/,
      /\b(E[A-Z]+)\b/, // ECONNREFUSED, ETIMEDOUT, etc.
      /HTTP[_\s]+([45][0-9]{2})/i, // HTTP error codes
      /status[_\s]*code[:\s]+([45][0-9]{2})/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract HTTP status from message
   */
  extractHttpStatus(message) {
    if (!message) return null;
    
    const statusMatch = message.match(/\b([1-5][0-9]{2})\b/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      if (status >= 100 && status < 600) {
        return status;
      }
    }
    
    return null;
  }

  /**
   * Extract duration from message
   */
  extractDuration(message) {
    if (!message) return null;
    
    const patterns = [
      /(\d+\.?\d*)\s*ms/i,
      /(\d+\.?\d*)\s*milliseconds?/i,
      /(\d+\.?\d*)\s*s(?:ec|econds?)?/i,
      /duration[:\s]+(\d+\.?\d*)/i,
      /took[:\s]+(\d+\.?\d*)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        let duration = parseFloat(match[1]);
        
        // Convert to milliseconds
        if (pattern.source.includes('s(?:ec|econds?)') && !pattern.source.includes('ms')) {
          duration *= 1000;
        }
        
        return duration;
      }
    }
    
    return null;
  }

  /**
   * Enhanced log capture with event-aware context
   */
  async captureLogs(options = {}) {
    // Call parent method to maintain existing functionality
    const result = await super.captureLogs(options);
    
    // Emit runtime event for log capture start
    if (this.eventCollector && result.success) {
      this.eventCollector.onRuntimeEvent('log_capture_start', {
        sourceId: options.source?.id,
        sourceType: options.source?.type,
        bufferSize: options.bufferSize
      });
    }
    
    return result;
  }

  /**
   * Enhanced error monitoring with event correlation
   */
  async monitorErrors(options = {}) {
    // Call parent method
    const result = await super.monitorErrors(options);
    
    // Emit monitoring start event
    if (this.eventCollector && result.success) {
      this.eventCollector.onRuntimeEvent('error_monitoring_start', {
        sources: options.sources,
        threshold: options.threshold,
        window: options.windowMs,
        monitorId: result.monitorId
      });
    }
    
    return result;
  }

  /**
   * Get enhanced statistics including event forwarding
   */
  async getStatistics() {
    const baseStats = await super.getStatistics();
    
    const eventStats = {
      eventCollectorConnected: !!this.eventCollector,
      correlationTracker: this.correlationTracker.size,
      eventCapture: this.eventConfig.enableEventCapture
    };

    if (this.eventCollector) {
      eventStats.eventCollectorStats = this.eventCollector.getStatistics();
    }
    
    return {
      ...baseStats,
      events: eventStats
    };
  }

  /**
   * Enhanced cleanup with event collector
   */
  async cleanup() {
    // Clear correlation tracking
    this.correlationTracker.clear();
    
    // Call parent cleanup
    const result = await super.cleanup();
    
    // Emit cleanup event
    if (this.eventCollector) {
      this.eventCollector.onRuntimeEvent('log_manager_cleanup', {
        timestamp: Date.now()
      });
    }
    
    return result;
  }
}