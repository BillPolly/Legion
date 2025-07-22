/**
 * Comprehensive Error Handling System for Cerebrate Chrome Extension
 * Provides centralized error handling, categorization, recovery, and monitoring
 */
export class ErrorHandler {
  
  constructor(options = {}) {
    this.config = this.validateAndNormalizeConfig(options);
    this.logger = options.logger || console;
    this.errorBoundary = null;
    this.circuitBreakers = new Map();
    
    // Error tracking
    this.errorMetrics = {
      totalErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: {},
      errorsByComponent: {},
      recentErrors: []
    };
    
    // Error pattern detection
    this.errorPatterns = new Map();
    this.patternWindow = 300000; // 5 minutes
    
    // Initialize error categories and handlers
    this.initializeErrorCategories();
  }

  /**
   * Validate and normalize configuration
   * @private
   */
  validateAndNormalizeConfig(options) {
    const defaults = {
      maxRetries: 3,
      retryDelay: 100,
      circuitBreakerThreshold: 5,
      enableTelemetry: true,
      enableRecovery: true,
      logLevel: 'error'
    };

    const config = { ...defaults, ...options };

    // Validation
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
      throw new Error('Invalid configuration: maxRetries must be >= 0');
    }
    
    if (typeof config.retryDelay !== 'number' || config.retryDelay < 0) {
      throw new Error('Invalid configuration: retryDelay must be a number');
    }

    return config;
  }

  /**
   * Initialize error categories and their handling rules
   * @private
   */
  initializeErrorCategories() {
    this.errorCategories = {
      websocket: {
        CONNECTION_FAILED: {
          category: 'connection',
          type: 'websocket_connection_failed',
          severity: 'high',
          recoverable: true,
          retryable: true,
          userMessage: 'Connection lost. Attempting to reconnect...'
        },
        CONNECTION_REFUSED: {
          category: 'connection',
          type: 'websocket_connection_refused',
          severity: 'high',
          recoverable: true,
          retryable: true,
          userMessage: 'Unable to connect to server. Please check your connection.'
        },
        TIMEOUT: {
          category: 'connection',
          type: 'timeout',
          severity: 'medium',
          recoverable: true,
          retryable: true,
          userMessage: 'Connection timeout. Retrying...'
        }
      },
      
      agent: {
        EXECUTION_TIMEOUT: {
          category: 'execution',
          type: 'agent_timeout',
          severity: 'medium',
          recoverable: true,
          retryable: true,
          userMessage: 'Command timed out. Please try again.'
        },
        SERVICE_UNAVAILABLE: {
          category: 'execution',
          type: 'agent_unavailable',
          severity: 'high',
          recoverable: true,
          retryable: false,
          userMessage: 'Service temporarily unavailable. Using offline mode.'
        }
      },
      
      command: {
        VALIDATION_ERROR: {
          category: 'validation',
          type: 'invalid_parameters',
          severity: 'low',
          recoverable: false,
          retryable: false,
          userMessage: 'Invalid command parameters. Please check your input.'
        }
      },
      
      system: {
        SYSTEM_FAILURE: {
          category: 'system',
          type: 'critical_failure',
          severity: 'critical',
          recoverable: false,
          retryable: false,
          userMessage: 'A critical system error occurred. Please refresh the page.'
        }
      }
    };
  }

  /**
   * Categorize error based on context and error properties
   * @param {Error} error - The error to categorize
   * @param {string} component - Component where error occurred
   * @returns {Object} - Categorized error information
   */
  categorizeError(error, component = 'unknown') {
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const categoryMap = this.errorCategories[component];
    
    if (categoryMap && categoryMap[errorCode]) {
      const category = categoryMap[errorCode];
      return {
        ...category,
        technicalMessage: error.message,
        errorCode
      };
    }
    
    // Default categorization for unknown errors
    return {
      category: 'unknown',
      type: 'unknown_error',
      severity: 'medium',
      recoverable: false,
      retryable: false,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: error.message,
      errorCode
    };
  }

  /**
   * Handle error with full processing pipeline
   * @param {Error} error - The error to handle
   * @param {Object} context - Context information
   * @returns {Promise<Object>} - Handling result
   */
  async handleError(error, context = {}) {
    try {
      // Categorize the error
      const categorized = this.categorizeError(error, context.component);
      
      // Update metrics
      this.updateErrorMetrics(error, categorized, context);
      
      // Log the error
      this.logError(error, categorized, context);
      
      // Determine recovery action
      const recoveryAction = this.determineRecoveryAction(categorized, context);
      
      // Generate user notification
      const userNotification = this.generateUserNotification(categorized, context);
      
      // Call error boundary if set
      if (this.errorBoundary) {
        this.errorBoundary({
          error,
          context,
          categorized
        });
      }
      
      // Implement graceful degradation if needed
      const fallbackEnabled = context.fallbackMode && recoveryAction === 'graceful_degradation';
      
      return {
        handled: true,
        categorized,
        recoveryAction,
        shouldRetry: categorized.retryable,
        userNotification,
        fallbackEnabled
      };
      
    } catch (handlingError) {
      this.logger.error('Error in error handler:', handlingError);
      return {
        handled: false,
        error: handlingError.message
      };
    }
  }

  /**
   * Determine appropriate recovery action
   * @private
   */
  determineRecoveryAction(categorized, context) {
    if (categorized.recoverable) {
      if (categorized.retryable) {
        return 'retry';
      } else if (context.fallbackMode) {
        return 'graceful_degradation';
      }
      return 'user_action_required';
    }
    return 'no_recovery';
  }

  /**
   * Generate user notification
   * @private
   */
  generateUserNotification(categorized, context) {
    const actions = [];
    
    if (categorized.retryable) {
      actions.push({
        label: 'Retry',
        action: 'retry'
      });
    }
    
    return {
      type: 'error',
      title: this.getNotificationTitle(categorized.category),
      message: categorized.userMessage,
      actions,
      duration: this.getNotificationDuration(categorized.severity)
    };
  }

  /**
   * Get notification title based on category
   * @private
   */
  getNotificationTitle(category) {
    const titles = {
      connection: 'Connection Error',
      execution: 'Execution Error',
      validation: 'Validation Error',
      system: 'System Error',
      unknown: 'Error'
    };
    return titles[category] || 'Error';
  }

  /**
   * Get notification duration based on severity
   * @private
   */
  getNotificationDuration(severity) {
    const durations = {
      critical: 0, // Persistent
      high: 10000,
      medium: 5000,
      low: 3000
    };
    return durations[severity] || 5000;
  }

  /**
   * Update error metrics
   * @private
   */
  updateErrorMetrics(error, categorized, context) {
    this.errorMetrics.totalErrors++;
    
    // By category
    this.errorMetrics.errorsByCategory[categorized.category] = 
      (this.errorMetrics.errorsByCategory[categorized.category] || 0) + 1;
    
    // By severity
    this.errorMetrics.errorsBySeverity[categorized.severity] = 
      (this.errorMetrics.errorsBySeverity[categorized.severity] || 0) + 1;
    
    // By component
    const component = context.component || 'unknown';
    this.errorMetrics.errorsByComponent[component] = 
      (this.errorMetrics.errorsByComponent[component] || 0) + 1;
    
    // Recent errors (keep last 100)
    this.errorMetrics.recentErrors.unshift({
      message: error.message,
      category: categorized.category,
      severity: categorized.severity,
      component,
      timestamp: Date.now()
    });
    
    if (this.errorMetrics.recentErrors.length > 100) {
      this.errorMetrics.recentErrors = this.errorMetrics.recentErrors.slice(0, 100);
    }
    
    // Pattern detection
    this.updateErrorPatterns(error, categorized, context);
  }

  /**
   * Update error patterns for detection
   * @private
   */
  updateErrorPatterns(error, categorized, context) {
    const patternKey = `${context.component}_${categorized.type}`;
    const now = Date.now();
    
    if (!this.errorPatterns.has(patternKey)) {
      this.errorPatterns.set(patternKey, []);
    }
    
    const pattern = this.errorPatterns.get(patternKey);
    pattern.push(now);
    
    // Clean old entries (outside pattern window)
    const cutoff = now - this.patternWindow;
    this.errorPatterns.set(patternKey, pattern.filter(timestamp => timestamp > cutoff));
  }

  /**
   * Log error with appropriate level and context
   * @private
   */
  logError(error, categorized, context) {
    const logEntry = {
      error: error.message,
      context: this.sanitizeContext(context),
      category: categorized.category,
      severity: categorized.severity,
      timestamp: Date.now(),
      stack: error.stack
    };
    
    const message = `Error in ${context.component || 'unknown'}: ${error.message}`;
    
    switch (categorized.severity) {
      case 'critical':
        this.logger.error(message, logEntry);
        break;
      case 'high':
        this.logger.error(message, logEntry);
        break;
      case 'medium':
        this.logger.error(message, logEntry);
        break;
      case 'low':
        this.logger.info(message, logEntry);
        break;
      default:
        this.logger.error(message, logEntry);
    }
  }

  /**
   * Sanitize context to remove sensitive data
   * @private
   */
  sanitizeContext(context) {
    const sensitiveKeys = ['password', 'apikey', 'token', 'secret', 'key'];
    const sanitized = { ...context };
    
    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        } else if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          obj[key] = '[REDACTED]';
        }
      }
    };
    
    sanitize(sanitized);
    return sanitized;
  }

  /**
   * Execute operation with retry logic
   * @param {Function} operation - Operation to retry
   * @param {Object} options - Retry options
   * @returns {Promise} - Operation result
   */
  async withRetry(operation, options = {}) {
    const {
      maxRetries = this.config.maxRetries,
      baseDelay = this.config.retryDelay,
      exponentialBackoff = true
    } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay
        const delay = exponentialBackoff 
          ? baseDelay * Math.pow(2, attempt)
          : baseDelay;
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Execute operation with circuit breaker pattern
   * @param {Function} operation - Operation to execute
   * @param {string} serviceId - Service identifier
   * @returns {Promise} - Operation result or circuit breaker response
   */
  async withCircuitBreaker(operation, serviceId) {
    const breaker = this.getCircuitBreaker(serviceId);
    
    if (breaker.isOpen()) {
      return { circuitOpen: true, message: 'Service circuit breaker is open' };
    }
    
    try {
      const result = await operation();
      breaker.recordSuccess();
      return result;
    } catch (error) {
      breaker.recordFailure();
      throw error;
    }
  }

  /**
   * Get or create circuit breaker for service
   * @private
   */
  getCircuitBreaker(serviceId) {
    if (!this.circuitBreakers.has(serviceId)) {
      this.circuitBreakers.set(serviceId, new CircuitBreaker(this.config.circuitBreakerThreshold));
    }
    return this.circuitBreakers.get(serviceId);
  }

  /**
   * Sleep utility
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error metrics
   * @returns {Object} - Error metrics
   */
  getErrorMetrics() {
    return { ...this.errorMetrics };
  }

  /**
   * Analyze error patterns
   * @returns {Array} - Detected patterns
   */
  analyzeErrorPatterns() {
    const patterns = [];
    const now = Date.now();
    const cutoff = now - this.patternWindow;
    
    for (const [patternKey, timestamps] of this.errorPatterns.entries()) {
      const recentTimestamps = timestamps.filter(ts => ts > cutoff);
      
      if (recentTimestamps.length >= 3) {
        const [component, type] = patternKey.split('_');
        patterns.push({
          pattern: `repeated_${component}_${type}`,
          count: recentTimestamps.length,
          recommendation: `Consider investigating ${component} ${type} issues`
        });
      }
    }
    
    return patterns;
  }

  /**
   * Generate comprehensive error report
   * @returns {Object} - Error report
   */
  generateErrorReport() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    const recentErrors = this.errorMetrics.recentErrors
      .filter(error => error.timestamp > (now - oneHour));
    
    return {
      summary: {
        totalErrors: this.errorMetrics.totalErrors,
        timeRange: {
          start: now - oneHour,
          end: now
        },
        topErrors: this.getTopErrors(recentErrors)
      },
      details: {
        byCategory: this.errorMetrics.errorsByCategory,
        bySeverity: this.errorMetrics.errorsBySeverity,
        byComponent: this.errorMetrics.errorsByComponent
      },
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Get top errors by frequency
   * @private
   */
  getTopErrors(errors) {
    const errorCounts = {};
    
    errors.forEach(error => {
      const key = `${error.component}_${error.message}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    return Object.entries(errorCounts)
      .map(([key, count]) => ({ error: key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Generate recommendations based on error patterns
   * @private
   */
  generateRecommendations() {
    const recommendations = [];
    const patterns = this.analyzeErrorPatterns();
    
    patterns.forEach(pattern => {
      recommendations.push({
        type: 'pattern',
        priority: 'medium',
        message: pattern.recommendation
      });
    });
    
    return recommendations;
  }

  /**
   * Set error boundary handler
   * @param {Function} handler - Error boundary handler
   */
  setErrorBoundary(handler) {
    this.errorBoundary = handler;
  }

  /**
   * Create middleware for specific component
   * @param {string} component - Component name
   * @returns {Function} - Middleware function
   */
  createMiddleware(component) {
    return (error, context = {}) => {
      return this.handleError(error, { ...context, component });
    };
  }
}

/**
 * Simple Circuit Breaker implementation
 */
class CircuitBreaker {
  constructor(threshold = 5) {
    this.threshold = threshold;
    this.failures = 0;
    this.successes = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = 0;
    this.timeout = 60000; // 1 minute
  }

  isOpen() {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failures = 0;
    this.successes++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  recordFailure() {
    this.failures++;
    this.successes = 0;
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}