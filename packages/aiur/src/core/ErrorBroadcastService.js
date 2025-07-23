/**
 * ErrorBroadcastService - Centralized error capture and broadcasting system for Aiur
 * 
 * This service captures errors from all components and broadcasts them to connected
 * debug clients via WebSocket. It integrates with the existing error handling
 * infrastructure while adding real-time error visibility.
 */

import { EventEmitter } from 'events';

export class ErrorBroadcastService extends EventEmitter {
  constructor() {
    super();
    
    // Error buffer for new clients
    this.errorBuffer = [];
    this.maxErrorBuffer = 100;
    
    // Error statistics
    this.errorStats = {
      total: 0,
      bySeverity: { critical: 0, error: 0, warning: 0 },
      byType: {},
      bySource: {}
    };
    
    // Recovery strategies
    this.recoveryStrategies = new Map();
    this.setupDefaultRecoveryStrategies();
    
    // Log manager reference (will be set after creation)
    this.logManager = null;
  }

  /**
   * Static factory method following the Async Resource Manager Pattern
   */
  static async create(resourceManager) {
    const service = new ErrorBroadcastService();
    
    // Register with ResourceManager for other components to access
    resourceManager.register('errorBroadcastService', service);
    
    // Set up global error handlers
    service.setupGlobalHandlers();
    
    return service;
  }

  /**
   * Set up global error handlers to catch unhandled errors
   */
  setupGlobalHandlers() {
    // Catch unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.captureError({
        error: reason instanceof Error ? reason : new Error(String(reason)),
        errorType: 'system',
        severity: 'critical',
        source: 'unhandledRejection',
        context: {
          promise: promise.toString(),
          operation: 'async-operation'
        }
      });
    });

    // Catch uncaught exceptions (but don't exit by default)
    process.on('uncaughtException', (error) => {
      this.captureError({
        error,
        errorType: 'system',
        severity: 'critical',
        source: 'uncaughtException',
        context: {
          operation: 'synchronous-operation'
        }
      });
      
      // Critical exception handled by error capture system
    });

    // Handle warnings
    process.on('warning', (warning) => {
      this.captureError({
        error: warning,
        errorType: 'system',
        severity: 'warning',
        source: 'process-warning',
        context: {
          operation: 'system-warning'
        }
      });
    });
  }

  /**
   * Set up default recovery strategies for common error types
   */
  setupDefaultRecoveryStrategies() {
    // Tool execution errors - retry once
    this.recoveryStrategies.set('tool-execution', async (error, context) => {
      if (context.retryCount < 1) {
        return { strategy: 'retry', maxRetries: 1 };
      }
      return { strategy: 'fail' };
    });

    // Module loading errors - skip and continue
    this.recoveryStrategies.set('module-load', async (error, context) => {
      return { strategy: 'skip', fallback: null };
    });

    // Context errors - log and continue
    this.recoveryStrategies.set('context', async (error, context) => {
      return { strategy: 'log-continue' };
    });
  }

  /**
   * Main error capture method - all errors should go through this
   */
  captureError({
    error,
    errorType = 'unknown',
    severity = 'error',
    source = 'unknown',
    context = {},
    recovery = null
  }) {
    // Create standardized error event
    const errorEvent = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'error',
      timestamp: new Date().toISOString(),
      data: {
        errorType,
        severity,
        source,
        error: {
          message: error.message || String(error),
          stack: error.stack || new Error().stack,
          code: error.code || 'UNKNOWN_ERROR',
          name: error.name || 'Error',
          details: this.extractErrorDetails(error)
        },
        context: this.sanitizeContext(context),
        recovery: recovery || { attempted: false }
      }
    };

    // Update statistics
    this.updateErrorStats(errorEvent);

    // Add to buffer
    this.addToBuffer(errorEvent);

    // Emit for listeners (including WebDebugServer)
    this.emit('error-captured', errorEvent);

    // Log based on severity
    this.logError(errorEvent);

    // Attempt recovery if applicable
    if (!recovery || !recovery.attempted) {
      this.attemptRecovery(errorEvent);
    }

    return errorEvent;
  }

  /**
   * Extract additional details from error object
   */
  extractErrorDetails(error) {
    const details = {};
    
    // Get all enumerable properties
    for (const key in error) {
      if (error.hasOwnProperty(key) && key !== 'message' && key !== 'stack') {
        details[key] = error[key];
      }
    }

    // Special handling for different error types
    if (error.response) { // HTTP errors
      details.statusCode = error.response.status;
      details.statusText = error.response.statusText;
      details.responseData = error.response.data;
    }

    if (error.syscall) { // System errors
      details.syscall = error.syscall;
      details.errno = error.errno;
      details.path = error.path;
    }

    return details;
  }

  /**
   * Sanitize context to remove sensitive information
   */
  sanitizeContext(context) {
    const sanitized = { ...context };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const result = Array.isArray(obj) ? [] : {};
      
      for (const key in obj) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          result[key] = sanitizeObject(obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
      
      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Update error statistics
   */
  updateErrorStats(errorEvent) {
    const { errorType, severity, source } = errorEvent.data;
    
    this.errorStats.total++;
    this.errorStats.bySeverity[severity] = (this.errorStats.bySeverity[severity] || 0) + 1;
    this.errorStats.byType[errorType] = (this.errorStats.byType[errorType] || 0) + 1;
    this.errorStats.bySource[source] = (this.errorStats.bySource[source] || 0) + 1;
  }

  /**
   * Add error to buffer for new clients
   */
  addToBuffer(errorEvent) {
    this.errorBuffer.push(errorEvent);
    
    // Maintain buffer size limit
    if (this.errorBuffer.length > this.maxErrorBuffer) {
      this.errorBuffer.shift();
    }
  }

  /**
   * Log error based on severity
   */
  async logError(errorEvent) {
    const { severity, error, source } = errorEvent.data;
    const prefix = `[${severity.toUpperCase()}] [${source}]`;
    
    // Error logging handled by LogManager to avoid MCP interference
    
    // File logging
    if (this.logManager) {
      try {
        await this.logManager.logErrorEvent(errorEvent);
      } catch (logError) {
        // Log write failed - continue without console output
      }
    }
  }

  /**
   * Attempt to recover from error using registered strategies
   */
  async attemptRecovery(errorEvent) {
    const { errorType } = errorEvent.data;
    const strategy = this.recoveryStrategies.get(errorType);
    
    if (!strategy) {
      return;
    }

    try {
      const recoveryPlan = await strategy(errorEvent.data.error, errorEvent.data.context);
      
      if (recoveryPlan.strategy === 'retry') {
        this.emit('recovery-attempt', {
          errorId: errorEvent.id,
          strategy: 'retry',
          context: errorEvent.data.context
        });
      } else if (recoveryPlan.strategy === 'skip') {
        this.emit('recovery-attempt', {
          errorId: errorEvent.id,
          strategy: 'skip',
          fallback: recoveryPlan.fallback
        });
      }
      
      // Update the error event with recovery information
      errorEvent.data.recovery = {
        attempted: true,
        strategy: recoveryPlan.strategy,
        result: 'pending'
      };
      
    } catch (recoveryError) {
      // Recovery strategy failed - error logged to file only
      errorEvent.data.recovery = {
        attempted: true,
        strategy: 'failed',
        result: 'failed',
        error: recoveryError.message
      };
    }
  }

  /**
   * Get error buffer for new clients
   */
  getErrorBuffer() {
    return [...this.errorBuffer];
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return {
      ...this.errorStats,
      bufferSize: this.errorBuffer.length,
      oldestError: this.errorBuffer[0]?.timestamp,
      newestError: this.errorBuffer[this.errorBuffer.length - 1]?.timestamp
    };
  }

  /**
   * Clear error buffer
   */
  clearErrorBuffer() {
    this.errorBuffer = [];
  }

  /**
   * Register custom recovery strategy
   */
  registerRecoveryStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * Convenience method for tool execution errors
   */
  captureToolError(error, toolName, args) {
    return this.captureError({
      error,
      errorType: 'tool-execution',
      severity: 'error',
      source: 'ToolDefinitionProvider',
      context: {
        tool: toolName,
        args,
        operation: 'execute-tool'
      }
    });
  }

  /**
   * Convenience method for module loading errors
   */
  captureModuleError(error, modulePath) {
    return this.captureError({
      error,
      errorType: 'module-load',
      severity: 'error',
      source: 'ModuleLoader',
      context: {
        module: modulePath,
        operation: 'load-module'
      }
    });
  }

  /**
   * Convenience method for context errors
   */
  captureContextError(error, operation, contextData) {
    return this.captureError({
      error,
      errorType: 'context',
      severity: 'error',
      source: 'ContextManager',
      context: {
        operation,
        contextData,
        operation: `context-${operation}`
      }
    });
  }

  /**
   * Set the LogManager instance for file logging
   */
  setLogManager(logManager) {
    this.logManager = logManager;
    // Log to stderr to avoid MCP interference
    process.stderr.write('ErrorBroadcastService: Connected to LogManager for file logging\n');
  }
}