/**
 * UniversalEventCollector - Extends EventCollector for all types of events
 * 
 * Handles Jest test events (existing functionality) plus:
 * - Production log events
 * - Runtime events (errors, performance, API calls)
 * - System events
 * 
 * Provides unified event capture for intelligent agent debugging.
 */

import { EventCollector } from './EventCollector.js';
import { generateId } from '../utils/index.js';
import crypto from 'crypto';

export class UniversalEventCollector extends EventCollector {
  constructor(storage = null, config = {}) {
    super(storage);
    
    this.config = {
      enableCorrelation: true,
      enableEmbedding: false, // Will be enabled when semantic search is connected
      bufferSize: 1000,
      flushInterval: 5000,
      ...config
    };
    
    // Event type tracking
    this.eventTypes = new Set(['jest_test', 'production_log', 'runtime_event', 'api_call', 'error_event']);
    this.correlationMap = new Map(); // correlationId -> events
    this.eventBuffer = [];
    
    // Set up periodic buffer flush
    this.setupBufferFlush();
  }

  /**
   * Generate or inherit correlation ID for event tracking
   */
  getCorrelationId(existingId = null) {
    if (existingId) return existingId;
    
    // Try to get from current context (async_hooks could be used here)
    // For now, generate new ID
    return generateId('corr');
  }

  /**
   * Create base event structure
   */
  createBaseEvent(type, data = {}) {
    const event = {
      eventId: generateId('evt'),
      type,
      timestamp: Date.now(),
      correlationId: this.getCorrelationId(data.correlationId),
      source: data.source || 'unknown',
      sessionId: this.currentSession?.id || null,
      context: data.context || {},
      ...data
    };

    // Track correlation
    if (this.config.enableCorrelation) {
      if (!this.correlationMap.has(event.correlationId)) {
        this.correlationMap.set(event.correlationId, []);
      }
      this.correlationMap.get(event.correlationId).push(event);
    }

    return event;
  }

  /**
   * Handle production log events
   */
  onLogEvent(level, message, context = {}) {
    const event = this.createBaseEvent('production_log', {
      level,
      message,
      context,
      service: context.service || 'unknown',
      userId: context.userId,
      requestId: context.requestId,
      correlationId: context.correlationId,
      source: 'production'
    });

    this.emit('log', event);
    this.bufferEvent(event);
    return event;
  }

  /**
   * Handle structured log events with rich context
   */
  onStructuredLogEvent(logEntry) {
    const event = this.createBaseEvent('production_log', {
      level: logEntry.level,
      message: logEntry.message,
      context: logEntry.context || {},
      metadata: logEntry.metadata || {},
      timestamp: new Date(logEntry.timestamp).getTime(),
      correlationId: logEntry.context?.correlationId,
      service: logEntry.context?.service,
      source: 'structured_log'
    });

    this.emit('structuredLog', event);
    this.bufferEvent(event);
    return event;
  }

  /**
   * Handle runtime events (errors, performance, API calls)
   */
  onRuntimeEvent(eventType, data = {}) {
    const event = this.createBaseEvent('runtime_event', {
      eventType,
      data,
      source: 'runtime'
    });

    this.emit('runtime', event);
    this.bufferEvent(event);
    return event;
  }

  /**
   * Handle API call events
   */
  onAPICall(method, url, status, duration, context = {}) {
    const event = this.createBaseEvent('api_call', {
      method,
      url,
      status,
      duration,
      success: status >= 200 && status < 300,
      context,
      correlationId: context.correlationId,
      userId: context.userId,
      source: 'api'
    });

    this.emit('apiCall', event);
    this.bufferEvent(event);
    return event;
  }

  /**
   * Handle error events with rich context
   */
  onErrorEvent(error, context = {}) {
    const event = this.createBaseEvent('error_event', {
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: error.code
      },
      context,
      severity: this.classifyErrorSeverity(error),
      source: context.source || 'error'
    });

    this.emit('error', event);
    this.bufferEvent(event);
    return event;
  }

  /**
   * Handle console output with proper timing and test context
   */
  onConsoleOutput(type, args, testContext = null) {
    const event = this.createBaseEvent('console_output', {
      consoleType: type, // log, error, warn, info, debug
      message: args.join(' '),
      args: args,
      testContext: testContext ? {
        testName: testContext.testName,
        testPath: testContext.testPath,
        testStatus: testContext.status
      } : null,
      source: 'console'
    });

    this.emit('console', event);
    this.bufferEvent(event);
    return event;
  }

  /**
   * Enhanced test event handling with console capture
   */
  onTestStart(test) {
    // Call parent method
    const testEvent = super.onTestStart(test);
    
    // Create unified event
    const event = this.createBaseEvent('jest_test', {
      testName: test.name,
      testPath: test.path,
      status: 'running',
      phase: 'start',
      source: 'jest'
    });

    this.emit('testEvent', event);
    this.bufferEvent(event);
    return { testEvent, unifiedEvent: event };
  }

  /**
   * Enhanced test end handling
   */
  onTestEnd(test, results) {
    // Call parent method
    const testEvent = super.onTestEnd(test, results);
    
    // Create unified event with results
    const event = this.createBaseEvent('jest_test', {
      testName: test.name,
      testPath: test.path,
      status: results.status,
      phase: 'end',
      duration: results.duration,
      error: results.failureDetails?.[0]?.message,
      assertions: results.numPassingAsserts + results.numFailingAsserts,
      source: 'jest'
    });

    this.emit('testEvent', event);
    this.bufferEvent(event);
    return { testEvent, unifiedEvent: event };
  }

  /**
   * Buffer events for batch processing
   */
  bufferEvent(event) {
    this.eventBuffer.push(event);
    
    if (this.eventBuffer.length >= this.config.bufferSize) {
      this.flushBuffer();
    }
  }

  /**
   * Flush buffered events
   */
  flushBuffer() {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    this.emit('eventsBatch', {
      events,
      count: events.length,
      timestamp: Date.now()
    });

    // Store in database if storage is available
    if (this.storage) {
      this.storage.storeBatch(events);
    }
  }

  /**
   * Set up periodic buffer flush
   */
  setupBufferFlush() {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushInterval);

    // Allow process to exit
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /**
   * Get events by correlation ID
   */
  getCorrelatedEvents(correlationId) {
    return this.correlationMap.get(correlationId) || [];
  }

  /**
   * Get events by type within time range
   */
  getEventsByType(type, startTime, endTime) {
    const events = [];
    for (const eventList of this.correlationMap.values()) {
      for (const event of eventList) {
        if (event.type === type && 
            event.timestamp >= startTime && 
            event.timestamp <= endTime) {
          events.push(event);
        }
      }
    }
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Classify error severity for intelligent routing
   */
  classifyErrorSeverity(error) {
    const message = error.message?.toLowerCase() || '';
    const name = error.name?.toLowerCase() || '';

    if (name.includes('syntax') || message.includes('syntax')) {
      return 'high';
    }
    if (message.includes('timeout') || message.includes('connection')) {
      return 'medium';
    }
    if (message.includes('deprecated') || message.includes('warning')) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Enhanced cleanup with buffer flush
   */
  cleanup() {
    // Flush any remaining events
    this.flushBuffer();
    
    // Clear timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Clear correlation tracking
    this.correlationMap.clear();
    this.eventBuffer = [];
    
    // Call parent cleanup
    this.removeAllListeners();
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const correlationCount = this.correlationMap.size;
    let totalEvents = 0;
    const typeDistribution = {};

    for (const events of this.correlationMap.values()) {
      totalEvents += events.length;
      for (const event of events) {
        typeDistribution[event.type] = (typeDistribution[event.type] || 0) + 1;
      }
    }

    return {
      totalEvents,
      correlationCount,
      bufferedEvents: this.eventBuffer.length,
      typeDistribution,
      activeSession: this.currentSession?.id || null
    };
  }
}