/**
 * TracedToolProxy - Transparent wrapper for automatic tool instrumentation
 * 
 * Features:
 * - Zero-overhead proxy for tool execution
 * - Automatic span creation and timing
 * - Artifact detection and registration
 * - Error tracking and retry monitoring
 * - Performance metrics collection
 */

import { ObservabilityContext } from './ObservabilityContext.js';
import { getArtifactRegistry } from './ArtifactRegistry.js';

/**
 * TracedToolProxy - Wraps tools with automatic tracing
 */
export class TracedToolProxy {
  constructor(tool, options = {}) {
    this.tool = tool;
    this.name = tool.name || 'unknown-tool';
    this.category = options.category || 'general';
    this.autoDetectArtifacts = options.autoDetectArtifacts !== false;
    
    // Metrics
    this.metrics = {
      executions: 0,
      successes: 0,
      failures: 0,
      totalDuration: 0,
      avgDuration: 0,
      lastExecution: null
    };
    
    // Bind methods to preserve context
    this.execute = this.execute.bind(this);
    
    // Proxy all tool properties
    return new Proxy(this, {
      get: (target, prop) => {
        // Use our wrapped execute method
        if (prop === 'execute') {
          return target.execute;
        }
        
        // Expose metrics
        if (prop === 'getMetrics') {
          return () => target.metrics;
        }
        
        // Pass through to original tool
        if (prop in target.tool) {
          const value = target.tool[prop];
          
          // Wrap functions other than execute
          if (typeof value === 'function' && prop !== 'execute') {
            return (...args) => {
              const context = ObservabilityContext.current();
              if (context) {
                context.addEvent(`tool:${prop}`, {
                  tool: target.name,
                  method: prop,
                  args: args.length
                });
              }
              return value.apply(target.tool, args);
            };
          }
          
          return value;
        }
        
        // Default to target property
        return target[prop];
      },
      
      set: (target, prop, value) => {
        if (prop in target.tool) {
          target.tool[prop] = value;
        } else {
          target[prop] = value;
        }
        return true;
      },
      
      has: (target, prop) => {
        return prop in target || prop in target.tool;
      }
    });
  }

  /**
   * Wrapped execute method with tracing
   */
  async execute(params) {
    const startTime = Date.now();
    const context = ObservabilityContext.current() || ObservabilityContext.create(`tool:${this.name}`);
    
    // Create span for tool execution
    const span = context.traceCollector.startSpan({
      name: `tool:${this.name}`,
      attributes: {
        'tool.name': this.name,
        'tool.category': this.category,
        'tool.params': Object.keys(params || {}),
        'tool.execution.count': this.metrics.executions + 1
      },
      parent: context.span ? context.span.getContext() : null
    });
    
    this.metrics.executions++;
    this.metrics.lastExecution = startTime;
    
    let result;
    let error;
    
    try {
      // Add pre-execution event
      span.addEvent('execution:start', {
        hasParams: !!params,
        paramCount: Object.keys(params || {}).length
      });
      
      // Execute the tool
      result = await this.tool.execute(params);
      
      // Track success
      this.metrics.successes++;
      
      // Add success event
      span.addEvent('execution:complete', {
        success: true,
        hasResult: !!result,
        resultKeys: result ? Object.keys(result) : []
      });
      
      // Auto-detect and register artifacts
      if (this.autoDetectArtifacts && result) {
        this.detectAndRegisterArtifacts(result, context, span);
      }
      
      // Set span attributes from result
      span.setAttributes({
        'tool.result.success': result?.success !== false,
        'tool.result.hasArtifacts': !!(result?.path || result?.content || result?.generatedCode),
        'tool.result.size': result?.size || result?.bytesWritten || 0
      });
      
    } catch (err) {
      error = err;
      this.metrics.failures++;
      
      // Record error
      span.addEvent('execution:error', {
        error: err.message,
        stack: err.stack
      });
      
      span.setStatus('error', err.message);
      span.setAttributes({
        'tool.error': err.message,
        'tool.error.type': err.constructor.name
      });
      
      // Record in context
      if (context.recordError) {
        context.recordError(err, {
          tool: this.name,
          params
        });
      }
      
    } finally {
      const duration = Date.now() - startTime;
      
      // Update metrics
      this.metrics.totalDuration += duration;
      this.metrics.avgDuration = Math.round(this.metrics.totalDuration / this.metrics.executions);
      
      // End span
      span.end({
        'tool.duration': duration,
        'tool.metrics.executions': this.metrics.executions,
        'tool.metrics.successRate': this.metrics.executions > 0 ? 
          Math.round((this.metrics.successes / this.metrics.executions) * 100) : 0
      });
      
      // Record in context
      if (context.recordToolExecution) {
        context.recordToolExecution(this.name, params, result || { error: error?.message }, duration);
      }
    }
    
    // Re-throw error if occurred
    if (error) {
      throw error;
    }
    
    return result;
  }

  /**
   * Detect and register artifacts from tool result
   */
  detectAndRegisterArtifacts(result, context, span) {
    const artifactRegistry = getArtifactRegistry();
    const artifacts = [];
    
    // Detect file artifacts
    if (result.path || result.filePath || result.file) {
      artifacts.push({
        type: 'file',
        path: result.path || result.filePath || result.file,
        content: result.content,
        size: result.size || result.bytesWritten
      });
    }
    
    // Detect generated code
    if (result.generatedCode || result.code) {
      artifacts.push({
        type: 'code',
        content: result.generatedCode || result.code,
        name: result.fileName || `${this.name}-generated`,
        metadata: {
          language: result.language || 'javascript'
        }
      });
    }
    
    // Detect data artifacts
    if (result.data || result.output) {
      artifacts.push({
        type: 'data',
        content: result.data || result.output,
        name: `${this.name}-output`,
        metadata: {
          format: result.format || 'json'
        }
      });
    }
    
    // Detect test results
    if (result.testResults || result.coverage) {
      artifacts.push({
        type: 'report',
        subtype: 'test-results',
        content: result.testResults || result.coverage,
        name: `${this.name}-test-results`,
        metadata: {
          passed: result.passed,
          failed: result.failed,
          coverage: result.coveragePercent
        }
      });
    }
    
    // Detect API responses
    if (result.response || result.apiResponse) {
      artifacts.push({
        type: 'api_response',
        content: result.response || result.apiResponse,
        name: `${this.name}-response`,
        metadata: {
          statusCode: result.statusCode,
          headers: result.headers,
          url: result.url
        }
      });
    }
    
    // Register all detected artifacts
    for (const artifactData of artifacts) {
      const artifact = artifactRegistry.register({
        ...artifactData,
        createdBy: this.name,
        traceId: span.traceId,
        spanId: span.spanId,
        metadata: {
          ...artifactData.metadata,
          tool: this.name,
          category: this.category
        }
      });
      
      // Add artifact event to span
      span.addEvent('artifact:registered', {
        artifactId: artifact.id,
        type: artifact.type,
        name: artifact.name,
        size: artifact.size
      });
    }
    
    return artifacts;
  }

  /**
   * Get tool metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.executions > 0 ? 
        (this.metrics.successes / this.metrics.executions) : 0,
      failureRate: this.metrics.executions > 0 ? 
        (this.metrics.failures / this.metrics.executions) : 0
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      executions: 0,
      successes: 0,
      failures: 0,
      totalDuration: 0,
      avgDuration: 0,
      lastExecution: null
    };
  }

  /**
   * Create a traced tool from an existing tool
   */
  static create(tool, options = {}) {
    // If already traced, return as-is
    if (tool instanceof TracedToolProxy) {
      return tool;
    }
    
    // If tool doesn't have execute method, return as-is
    if (!tool.execute || typeof tool.execute !== 'function') {
      return tool;
    }
    
    return new TracedToolProxy(tool, options);
  }

  /**
   * Wrap multiple tools
   */
  static wrapTools(tools, options = {}) {
    return tools.map(tool => TracedToolProxy.create(tool, options));
  }

  /**
   * Check if a tool is already traced
   */
  static isTraced(tool) {
    return tool instanceof TracedToolProxy;
  }
}

/**
 * Helper function to create traced tool
 */
export function traceT(tool, options = {}) {
  return TracedToolProxy.create(tool, options);
}

/**
 * Decorator for tool classes
 */
export function TracedTool(options = {}) {
  return function(target) {
    const originalExecute = target.prototype.execute;
    
    if (!originalExecute) {
      console.warn(`TracedTool decorator: ${target.name} does not have an execute method`);
      return target;
    }
    
    // Replace execute method with traced version
    target.prototype.execute = async function(params) {
      const proxy = new TracedToolProxy(this, {
        ...options,
        category: options.category || target.name
      });
      
      return proxy.execute(params);
    };
    
    // Add getMetrics method
    if (!target.prototype.getMetrics) {
      target.prototype.getMetrics = function() {
        return this._metrics || {};
      };
    }
    
    return target;
  };
}