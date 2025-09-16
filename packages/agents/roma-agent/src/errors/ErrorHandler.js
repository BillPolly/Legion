/**
 * ErrorHandler - Provides standardized error handling patterns
 * Single responsibility: Centralized error processing and recovery
 */

import { Logger } from '../utils/Logger.js';
import { 
  ROMAError, 
  ErrorFactory, 
  ErrorUtils,
  TaskError,
  SystemError 
} from './ROMAErrors.js';

export class ErrorHandler {
  constructor(options = {}) {
    this.logger = options.logger || new Logger('ErrorHandler');
    this.enableRetry = options.enableRetry !== false;
    this.maxRetryAttempts = options.maxRetryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.onError = options.onError || null;
    this.onRetry = options.onRetry || null;
    this.context = options.context || {};
  }

  /**
   * Handle error with standardized processing
   * @param {Error} error - Error to handle
   * @param {Object} context - Error context
   * @returns {Object} - Handling result
   */
  handle(error, context = {}) {
    const enrichedContext = { ...this.context, ...context };
    const romaError = this.normalizeError(error, enrichedContext);
    
    // Log the error
    this.logError(romaError, enrichedContext);
    
    // Notify error callback if provided
    if (this.onError) {
      try {
        this.onError(romaError, enrichedContext);
      } catch (callbackError) {
        this.logger.error('Error callback failed', {
          originalError: romaError.message,
          callbackError: callbackError.message
        });
      }
    }
    
    // Determine handling strategy
    const strategy = this.determineStrategy(romaError, enrichedContext);
    
    return {
      error: romaError,
      strategy,
      retryable: romaError.isRetryable(),
      severity: ErrorUtils.getSeverity(romaError),
      recommendation: romaError.getRecommendedAction(),
      context: enrichedContext
    };
  }

  /**
   * Handle async operation with retry logic
   * @param {Function} operation - Async operation to execute
   * @param {Object} context - Execution context
   * @returns {Promise<*>} - Operation result
   */
  async handleWithRetry(operation, context = {}) {
    let lastError = null;
    let attempts = 0;
    
    while (attempts <= this.maxRetryAttempts) {
      try {
        return await operation();
      } catch (error) {
        attempts++;
        lastError = error;
        
        const romaError = this.normalizeError(error, { 
          ...context, 
          attempts,
          maxAttempts: this.maxRetryAttempts
        });
        
        // Log attempt
        this.logger.warn('Operation failed, analyzing for retry', {
          error: romaError.message,
          attempts,
          maxAttempts: this.maxRetryAttempts,
          retryable: romaError.isRetryable()
        });
        
        // Check if should retry
        if (!this.enableRetry || !romaError.isRetryable() || attempts > this.maxRetryAttempts) {
          throw romaError;
        }
        
        // Notify retry callback
        if (this.onRetry) {
          try {
            await this.onRetry(romaError, attempts, this.maxRetryAttempts);
          } catch (callbackError) {
            this.logger.error('Retry callback failed', {
              error: callbackError.message
            });
          }
        }
        
        // Wait before retry
        if (attempts <= this.maxRetryAttempts) {
          const delay = this.calculateRetryDelay(attempts);
          this.logger.debug('Waiting before retry', { delay, attempts });
          await this.sleep(delay);
        }
      }
    }
    
    // All retries exhausted
    throw this.normalizeError(lastError, {
      ...context,
      attempts,
      retriesExhausted: true
    });
  }

  /**
   * Wrap function with error handling
   * @param {Function} fn - Function to wrap
   * @param {Object} context - Execution context
   * @returns {Function} - Wrapped function
   */
  wrapFunction(fn, context = {}) {
    const self = this;
    
    return async function wrappedFunction(...args) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        const handlingResult = self.handle(error, {
          ...context,
          functionName: fn.name,
          arguments: args.length
        });
        
        throw handlingResult.error;
      }
    };
  }

  /**
   * Create error boundary for operations
   * @param {Function} operation - Operation to protect
   * @param {Object} options - Boundary options
   * @returns {Function} - Protected operation
   */
  createErrorBoundary(operation, options = {}) {
    const boundary = {
      fallback: options.fallback || null,
      onError: options.onError || null,
      context: options.context || {}
    };
    
    return async (...args) => {
      try {
        return await operation(...args);
      } catch (error) {
        const handlingResult = this.handle(error, {
          ...boundary.context,
          boundary: true
        });
        
        // Call boundary error handler
        if (boundary.onError) {
          try {
            await boundary.onError(handlingResult.error);
          } catch (boundaryError) {
            this.logger.error('Error boundary callback failed', {
              originalError: handlingResult.error.message,
              boundaryError: boundaryError.message
            });
          }
        }
        
        // Use fallback if provided
        if (boundary.fallback) {
          if (typeof boundary.fallback === 'function') {
            return await boundary.fallback(handlingResult.error, ...args);
          }
          return boundary.fallback;
        }
        
        throw handlingResult.error;
      }
    };
  }

  /**
   * Normalize error to ROMA error type
   * @private
   */
  normalizeError(error, context = {}) {
    if (error instanceof ROMAError) {
      // Update context if needed
      if (Object.keys(context).length > 0) {
        error.details = { ...error.details, ...context };
      }
      return error;
    }
    
    return ErrorFactory.fromError(error, context);
  }

  /**
   * Determine handling strategy
   * @private
   */
  determineStrategy(error, context = {}) {
    if (!error.isRetryable()) {
      return 'fail_fast';
    }
    
    if (error instanceof TaskError && context.taskId) {
      return 'retry_task';
    }
    
    if (error instanceof SystemError) {
      return 'retry_with_backoff';
    }
    
    return 'retry_immediate';
  }

  /**
   * Log error with appropriate level
   * @private
   */
  logError(error, context = {}) {
    const logData = ErrorUtils.formatForLog(error, context);
    const severity = ErrorUtils.getSeverity(error);
    
    switch (severity) {
      case 'high':
        this.logger.error('High severity error', logData);
        break;
      case 'medium':
        this.logger.warn('Medium severity error', logData);
        break;
      case 'low':
        this.logger.info('Low severity error', logData);
        break;
      default:
        this.logger.warn('Error occurred', logData);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   * @private
   */
  calculateRetryDelay(attempt) {
    const baseDelay = this.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    
    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Sleep utility
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update context
   */
  setContext(newContext) {
    this.context = { ...this.context, ...newContext };
  }

  /**
   * Clear context
   */
  clearContext() {
    this.context = {};
  }

  /**
   * Get current context
   */
  getContext() {
    return { ...this.context };
  }
}

/**
 * Global error handler instance
 */
let globalErrorHandler = null;

export class GlobalErrorHandler {
  /**
   * Initialize global error handler
   */
  static initialize(options = {}) {
    globalErrorHandler = new ErrorHandler(options);
    
    // Set up global error listeners
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', (error) => {
        globalErrorHandler.handle(error, { 
          type: 'uncaught_exception',
          fatal: true 
        });
      });
      
      process.on('unhandledRejection', (reason, promise) => {
        globalErrorHandler.handle(reason, { 
          type: 'unhandled_rejection',
          promise: promise.constructor.name 
        });
      });
    }
    
    return globalErrorHandler;
  }

  /**
   * Get global error handler instance
   */
  static getInstance() {
    if (!globalErrorHandler) {
      throw new Error('Global error handler not initialized. Call GlobalErrorHandler.initialize() first.');
    }
    return globalErrorHandler;
  }

  /**
   * Handle error using global handler
   */
  static handle(error, context = {}) {
    return GlobalErrorHandler.getInstance().handle(error, context);
  }

  /**
   * Wrap function with global error handling
   */
  static wrap(fn, context = {}) {
    return GlobalErrorHandler.getInstance().wrapFunction(fn, context);
  }
}

/**
 * Error handling decorators
 */
export function handleErrors(context = {}) {
  return function decorator(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args) {
      const errorHandler = new ErrorHandler({ 
        context: { 
          ...context, 
          className: target.constructor.name,
          methodName: propertyKey 
        } 
      });
      
      return errorHandler.wrapFunction(originalMethod.bind(this), context)(...args);
    };
    
    return descriptor;
  };
}

export function retryOnError(options = {}) {
  return function decorator(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args) {
      const errorHandler = new ErrorHandler({
        ...options,
        context: { 
          className: target.constructor.name,
          methodName: propertyKey,
          ...options.context 
        }
      });
      
      return errorHandler.handleWithRetry(() => originalMethod.apply(this, args));
    };
    
    return descriptor;
  };
}