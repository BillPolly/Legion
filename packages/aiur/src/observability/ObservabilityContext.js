/**
 * ObservabilityContext - Lightweight context for tracking execution through the system
 * 
 * Features:
 * - Automatic context propagation through async operations
 * - Integration with TraceCollector and ArtifactRegistry
 * - Performance metrics collection
 * - Resource usage tracking
 */

import { getTraceCollector } from './TraceCollector.js';
import { getArtifactRegistry } from './ArtifactRegistry.js';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage for context propagation
 */
const asyncLocalStorage = new AsyncLocalStorage();

/**
 * ObservabilityContext class
 */
export class ObservabilityContext {
  constructor(options = {}) {
    this.traceId = options.traceId || null;
    this.spanId = options.spanId || null;
    this.parentSpanId = options.parentSpanId || null;
    this.baggage = options.baggage || {};
    this.startTime = Date.now();
    this.metrics = {
      toolExecutions: 0,
      artifactsCreated: 0,
      errorsEncountered: 0,
      memoryUsage: process.memoryUsage()
    };
    
    // References to services
    this.traceCollector = options.traceCollector || getTraceCollector();
    this.artifactRegistry = options.artifactRegistry || getArtifactRegistry();
  }

  /**
   * Create a new context with span
   */
  static create(name, attributes = {}) {
    const traceCollector = getTraceCollector();
    const parent = ObservabilityContext.current();
    
    const span = traceCollector.startSpan({
      name,
      attributes,
      parent: parent ? { traceId: parent.traceId, spanId: parent.spanId } : null
    });
    
    const context = new ObservabilityContext({
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      baggage: parent ? { ...parent.baggage } : {}
    });
    
    context.span = span;
    return context;
  }

  /**
   * Get current context
   */
  static current() {
    return asyncLocalStorage.getStore();
  }

  /**
   * Run function with this context
   */
  async run(fn) {
    return asyncLocalStorage.run(this, fn);
  }

  /**
   * Run function with new child context
   */
  async runWithSpan(name, attributes, fn) {
    if (typeof attributes === 'function') {
      fn = attributes;
      attributes = {};
    }
    
    const childContext = ObservabilityContext.create(name, attributes);
    
    try {
      const result = await asyncLocalStorage.run(childContext, () => fn(childContext));
      childContext.end({ success: true });
      return result;
    } catch (error) {
      childContext.end({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Add event to current span
   */
  addEvent(name, attributes = {}) {
    if (this.span) {
      this.span.addEvent(name, attributes);
    }
  }

  /**
   * Set attributes on current span
   */
  setAttributes(attributes) {
    if (this.span) {
      this.span.setAttributes(attributes);
    }
  }

  /**
   * Record a tool execution
   */
  recordToolExecution(toolName, params, result, duration) {
    this.metrics.toolExecutions++;
    
    this.addEvent('tool:executed', {
      tool: toolName,
      duration,
      success: !result.error,
      hasArtifacts: !!(result.path || result.content || result.generatedCode)
    });
    
    // Auto-detect and register artifacts
    if (result.path || result.content || result.generatedCode) {
      this.registerArtifact({
        toolResult: result,
        createdBy: toolName,
        traceId: this.traceId,
        spanId: this.spanId
      });
    }
  }

  /**
   * Register an artifact
   */
  registerArtifact(options) {
    const artifact = this.artifactRegistry.register({
      ...options,
      traceId: this.traceId,
      spanId: this.spanId
    });
    
    this.metrics.artifactsCreated++;
    
    this.addEvent('artifact:created', {
      artifactId: artifact.id,
      type: artifact.type,
      name: artifact.name,
      size: artifact.size
    });
    
    return artifact;
  }

  /**
   * Record an error
   */
  recordError(error, context = {}) {
    this.metrics.errorsEncountered++;
    
    this.addEvent('error:occurred', {
      message: error.message,
      stack: error.stack,
      ...context
    });
    
    if (this.span) {
      this.span.setStatus('error', error.message);
    }
  }

  /**
   * Set baggage item
   */
  setBaggage(key, value) {
    this.baggage[key] = value;
  }

  /**
   * Get baggage item
   */
  getBaggage(key) {
    return this.baggage[key];
  }

  /**
   * End the context and its span
   */
  end(attributes = {}) {
    // Calculate final metrics
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    const finalMemory = process.memoryUsage();
    
    const memoryDelta = {
      rss: finalMemory.rss - this.metrics.memoryUsage.rss,
      heapUsed: finalMemory.heapUsed - this.metrics.memoryUsage.heapUsed
    };
    
    // Set final attributes
    const finalAttributes = {
      ...attributes,
      duration,
      toolExecutions: this.metrics.toolExecutions,
      artifactsCreated: this.metrics.artifactsCreated,
      errorsEncountered: this.metrics.errorsEncountered,
      memoryDelta: memoryDelta
    };
    
    if (this.span) {
      this.span.end(finalAttributes);
    }
    
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      duration,
      metrics: this.metrics
    };
  }

  /**
   * Create a checkpoint for performance analysis
   */
  checkpoint(name, metadata = {}) {
    const checkpoint = {
      name,
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      ...metadata
    };
    
    this.addEvent('checkpoint', checkpoint);
    
    return checkpoint;
  }

  /**
   * Wrap a function with context
   */
  static wrap(name, fn) {
    return async function wrapped(...args) {
      const context = ObservabilityContext.create(name, {
        function: fn.name || 'anonymous',
        args: args.length
      });
      
      return context.run(async () => {
        try {
          const result = await fn.apply(this, args);
          context.end({ success: true });
          return result;
        } catch (error) {
          context.recordError(error);
          context.end({ success: false });
          throw error;
        }
      });
    };
  }

  /**
   * Get context summary
   */
  getSummary() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      elapsed: Date.now() - this.startTime,
      metrics: this.metrics,
      baggage: this.baggage
    };
  }
}

/**
 * Decorator for automatic context creation
 */
export function traced(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function(...args) {
    const className = target.constructor.name;
    const methodName = propertyKey;
    const spanName = `${className}.${methodName}`;
    
    const context = ObservabilityContext.create(spanName, {
      class: className,
      method: methodName,
      args: args.length
    });
    
    return context.run(async () => {
      try {
        const result = await originalMethod.apply(this, args);
        context.end({ success: true });
        return result;
      } catch (error) {
        context.recordError(error);
        context.end({ success: false });
        throw error;
      }
    });
  };
  
  return descriptor;
}

/**
 * Helper to get or create context
 */
export function getOrCreateContext(name = 'operation') {
  let context = ObservabilityContext.current();
  
  if (!context) {
    context = ObservabilityContext.create(name);
  }
  
  return context;
}

/**
 * Helper to run with context
 */
export async function withContext(name, attributes, fn) {
  if (typeof attributes === 'function') {
    fn = attributes;
    attributes = {};
  }
  
  const context = ObservabilityContext.create(name, attributes);
  
  return context.run(async () => {
    try {
      const result = await fn(context);
      context.end({ success: true });
      return result;
    } catch (error) {
      context.recordError(error);
      context.end({ success: false });
      throw error;
    }
  });
}

// Export singleton getter for consistency
export const getObservabilityContext = () => ObservabilityContext.current();