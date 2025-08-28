/**
 * ErrorHandler - Error handling patterns and utilities
 * 
 * This class provides comprehensive error handling, classification,
 * recovery strategies, and reporting capabilities.
 */

class ErrorHandler {
  constructor(options = {}) {
    this.config = {
      maxErrorHistory: options.maxErrorHistory || 1000,
      enableLogging: options.enableLogging !== false,
      retryAttempts: options.retryAttempts || 3,
      autoCleanup: options.autoCleanup !== false,
      cleanupInterval: options.cleanupInterval || 3600000, // 1 hour
      optimizeStorage: options.optimizeStorage !== false,
      emitEvents: options.emitEvents !== false,
      eventEmitter: options.eventEmitter || null,
      ...options
    };

    this.errorHistory = [];
    this.errorCounts = {
      syntax: 0,
      reference: 0,
      type: 0,
      filesystem: 0,
      network: 0,
      validation: 0,
      generic: 0,
      total: 0
    };

    this.customHandlers = new Map();
    this.transformers = new Map();
    this.circuitBreakers = new Map();

    // Error classification patterns
    this.errorPatterns = {
      syntax: [
        /unexpected token/i,
        /missing.*[;,\)\]\}]/i,
        /unexpected.*[;,\)\]\}]/i,
        /syntaxerror/i
      ],
      reference: [
        /is not defined/i,
        /referenceerror/i,
        /cannot access.*before initialization/i
      ],
      type: [
        /cannot read propert/i,
        /cannot set propert/i,
        /typeerror/i,
        /is not a function/i,
        /undefined.*function/i
      ],
      filesystem: [
        /enoent/i,
        /eacces/i,
        /eisdir/i,
        /enotdir/i,
        /emfile/i,
        /enospc/i
      ],
      network: [
        /enotfound/i,
        /econnrefused/i,
        /etimedout/i,
        /network/i,
        /connection/i
      ],
      validation: [
        /validation.*error/i,
        /invalid.*input/i,
        /schema.*error/i
      ]
    };

    // Start cleanup timer if auto cleanup is enabled
    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Classify error by type and characteristics
   * @param {Error} error - Error to classify
   * @returns {Object} Classification details
   */
  classifyError(error) {
    const errorType = error.constructor.name;
    const errorMessage = error.message.toLowerCase();
    const errorCode = error.code;

    // Direct type classification
    if (error instanceof SyntaxError) {
      return {
        category: 'syntax',
        severity: 'error',
        recoverable: true,
        type: errorType
      };
    }

    if (error instanceof ReferenceError) {
      return {
        category: 'reference',
        severity: 'error',
        recoverable: true,
        type: errorType
      };
    }

    if (error instanceof TypeError) {
      return {
        category: 'type',
        severity: 'error',
        recoverable: true,
        type: errorType
      };
    }

    // Pattern-based classification
    for (const [category, patterns] of Object.entries(this.errorPatterns)) {
      if (patterns.some(pattern => pattern.test(errorMessage) || (errorCode && pattern.test(errorCode)))) {
        return {
          category,
          severity: category === 'validation' ? 'warning' : 'error',
          recoverable: category !== 'generic',
          type: errorType
        };
      }
    }

    // Check for specific error codes
    if (errorCode) {
      const fsCodes = ['ENOENT', 'EACCES', 'EISDIR', 'ENOTDIR', 'EMFILE', 'ENOSPC'];
      const networkCodes = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];

      if (fsCodes.includes(errorCode)) {
        return {
          category: 'filesystem',
          severity: 'error',
          recoverable: true,
          type: errorType
        };
      }

      if (networkCodes.includes(errorCode)) {
        return {
          category: 'network',
          severity: 'error',
          recoverable: true,
          type: errorType
        };
      }

      if (errorCode === 'ENOMEM') {
        return {
          category: 'generic',
          severity: 'critical',
          recoverable: false,
          type: errorType
        };
      }
    }

    // Check for validation errors by type property
    if (error.type === 'ValidationError') {
      return {
        category: 'validation',
        severity: 'warning',
        recoverable: true,
        type: errorType
      };
    }

    // Default classification
    return {
      category: 'generic',
      severity: 'error',
      recoverable: false,
      type: errorType
    };
  }

  /**
   * Record error with context and metadata
   * @param {Error} error - Error to record
   * @param {Object} context - Additional context
   */
  recordError(error, context = {}) {
    const classification = this.classifyError(error);
    const timestamp = Date.now();

    const errorRecord = {
      error,
      classification,
      context: this.config.optimizeStorage ? this._optimizeContext(context) : context,
      timestamp,
      id: this._generateErrorId()
    };

    this.errorHistory.push(errorRecord);
    this._updateErrorCounts(classification.category);

    // Limit history size
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory.shift();
    }

    // Emit event if enabled
    if (this.config.emitEvents && this.config.eventEmitter) {
      this.config.eventEmitter.emit('error', {
        error,
        classification,
        context,
        timestamp
      });
    }

    // Log if enabled
    if (this.config.enableLogging) {
      this._logError(errorRecord);
    }
  }

  /**
   * Handle error with custom handlers
   * @param {Error} error - Error to handle
   * @param {Object} context - Error context
   */
  handleError(error, context = {}) {
    this.recordError(error, context);
    
    const classification = this.classifyError(error);
    const customHandler = this.customHandlers.get(classification.category);
    
    if (customHandler) {
      customHandler(error, classification);
    }
  }

  /**
   * Get error suggestions based on error type
   * @param {Error} error - Error to analyze
   * @returns {Array} Array of suggestion strings
   */
  getSuggestions(error) {
    const classification = this.classifyError(error);
    const suggestions = [];

    switch (classification.category) {
      case 'syntax':
        suggestions.push(
          'Check for missing or extra brackets, parentheses, or braces',
          'Verify proper syntax for the statement or expression',
          'Look for missing semicolons or commas',
          'Check for proper string quote matching'
        );
        if (error.message.includes('token')) {
          suggestions.push('Review the syntax around the unexpected token');
        }
        break;

      case 'reference':
        suggestions.push(
          'Declare the variable before using it',
          'Define the variable in the appropriate scope',
          'Check for typos in variable names',
          'Ensure the variable is in the correct scope',
          'Import or require the module if needed'
        );
        if (error.message.includes('not defined')) {
          const match = error.message.match(/(\w+) is not defined/);
          if (match) {
            suggestions.push(`Consider declaring 'let ${match[1]} = ...' or 'const ${match[1]} = ...'`);
          }
        }
        break;

      case 'type':
        suggestions.push(
          'Check for null or undefined values before accessing properties',
          'Verify that the variable is of the expected type',
          'Add type checking or validation before operations',
          'Use optional chaining (?.) to safely access properties'
        );
        if (error.message.includes('not a function')) {
          suggestions.push('Ensure the variable is actually a function before calling it');
        }
        break;

      case 'filesystem':
        suggestions.push(
          'Check if the file or directory exists',
          'Verify file permissions and access rights',
          'Ensure the correct file path is being used',
          'Create the directory structure if it doesn\'t exist'
        );
        if (error.code === 'ENOENT') {
          suggestions.push('The file or directory does not exist - check the path');
        }
        break;

      case 'network':
        suggestions.push(
          'Check network connectivity',
          'Verify the URL or endpoint is correct',
          'Implement retry logic for temporary failures',
          'Check firewall and proxy settings'
        );
        break;

      case 'validation':
        suggestions.push(
          'Check input data format and structure',
          'Validate required fields are present',
          'Ensure data types match expected schema',
          'Review validation rules and constraints'
        );
        break;

      default:
        suggestions.push(
          'Review the error message for specific details',
          'Check the console for additional error information',
          'Verify the operation being performed is valid',
          'Consider adding error handling around the operation'
        );
    }

    return suggestions;
  }

  /**
   * Get recovery strategies for an error
   * @param {Error} error - Error to analyze
   * @returns {Array} Array of recovery strategy objects
   */
  getRecoveryStrategies(error) {
    const classification = this.classifyError(error);
    const strategies = [];

    if (!classification.recoverable) {
      return [{
        type: 'manual',
        description: 'Manual intervention required',
        priority: 'high'
      }];
    }

    switch (classification.category) {
      case 'network':
      case 'filesystem':
        strategies.push({
          type: 'retry',
          description: 'Retry the operation with exponential backoff',
          priority: 'high',
          config: { maxAttempts: 3, delay: 1000 }
        });
        break;

      case 'syntax':
      case 'reference':
      case 'type':
        strategies.push({
          type: 'fix',
          description: 'Automatically fix common syntax issues',
          priority: 'medium',
          config: { autoFix: true }
        });
        break;

      case 'validation':
        strategies.push({
          type: 'sanitize',
          description: 'Clean and validate input data',
          priority: 'medium',
          config: { strict: false }
        });
        break;
    }

    strategies.push({
      type: 'fallback',
      description: 'Use alternative approach or default values',
      priority: 'low'
    });

    return strategies;
  }

  /**
   * Check if error is recoverable
   * @param {Error} error - Error to check
   * @returns {boolean} Whether error is recoverable
   */
  isRecoverable(error) {
    const classification = this.classifyError(error);
    return classification.recoverable;
  }

  /**
   * Format error for display
   * @param {Error} error - Error to format
   * @returns {Object} Formatted error object
   */
  formatError(error) {
    const classification = this.classifyError(error);
    const suggestions = this.getSuggestions(error);
    const lineInfo = this.extractLineInfo(error.message);
    const fileInfo = this.extractFileInfo(error.message);

    return {
      type: error.constructor.name,
      message: error.message,
      category: classification.category,
      severity: classification.severity,
      recoverable: classification.recoverable,
      suggestions,
      location: { ...lineInfo, ...fileInfo },
      stack: error.stack,
      timestamp: Date.now()
    };
  }

  /**
   * Extract line and column information from error message
   * @param {string} message - Error message
   * @returns {Object} Line and column info
   */
  extractLineInfo(message) {
    const info = {};
    
    const lineMatch = message.match(/line\s+(\d+)/i);
    if (lineMatch) {
      info.line = parseInt(lineMatch[1], 10);
    }

    const columnMatch = message.match(/column\s+(\d+)/i);
    if (columnMatch) {
      info.column = parseInt(columnMatch[1], 10);
    }

    return info;
  }

  /**
   * Extract file path from error message
   * @param {string} message - Error message
   * @returns {Object} File info
   */
  extractFileInfo(message) {
    const info = {};
    
    const fileMatch = message.match(/(?:file|in)\s+([^\s]+\.[a-zA-Z]+)/i);
    if (fileMatch) {
      info.file = fileMatch[1];
    }

    return info;
  }

  /**
   * Analyze stack trace
   * @param {Error} error - Error with stack trace
   * @returns {Object} Stack trace analysis
   */
  analyzeStackTrace(error) {
    if (!error.stack) {
      return { frames: [], origin: null };
    }

    const lines = error.stack.split('\n').slice(1); // Skip error message line
    const frames = [];

    for (const line of lines) {
      const frame = this._parseStackFrame(line);
      if (frame) {
        frames.push(frame);
      }
    }

    return {
      frames,
      origin: frames[0] || null
    };
  }

  /**
   * Get error location from stack trace
   * @param {Error} error - Error object
   * @returns {Object} Error location
   */
  getErrorLocation(error) {
    const analysis = this.analyzeStackTrace(error);
    
    if (analysis.origin) {
      return {
        file: analysis.origin.file,
        line: analysis.origin.line,
        column: analysis.origin.column,
        function: analysis.origin.function
      };
    }

    return {};
  }

  /**
   * Get function context from stack trace
   * @param {Error} error - Error object
   * @returns {Object} Function context
   */
  getFunctionContext(error) {
    const analysis = this.analyzeStackTrace(error);
    
    if (analysis.origin) {
      return {
        function: analysis.origin.function,
        file: analysis.origin.file,
        line: analysis.origin.line
      };
    }

    return {};
  }

  /**
   * Retry operation with configurable strategy
   * @param {Function} operation - Operation to retry
   * @param {Object} options - Retry options
   * @returns {Promise} Operation result
   */
  async retry(operation, options = {}) {
    const config = {
      maxAttempts: options.maxAttempts || this.config.retryAttempts,
      delay: options.delay || 1000,
      backoff: options.backoff || 'linear',
      ...options
    };

    let lastError;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === config.maxAttempts) {
          throw error;
        }

        const delay = this._calculateDelay(config.delay, attempt, config.backoff);
        await this._delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Circuit breaker pattern implementation
   * @param {string} serviceName - Service identifier
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Circuit breaker options
   * @returns {Promise} Operation result
   */
  async withCircuitBreaker(serviceName, operation, options = {}) {
    const config = {
      failureThreshold: options.failureThreshold || 5,
      timeout: options.timeout || 60000,
      ...options
    };

    let circuit = this.circuitBreakers.get(serviceName);
    
    if (!circuit) {
      circuit = {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        successCount: 0
      };
      this.circuitBreakers.set(serviceName, circuit);
    }

    // Check circuit state
    if (circuit.state === 'open') {
      if (Date.now() - circuit.lastFailureTime < config.timeout) {
        throw new Error(`Circuit breaker open for service: ${serviceName}`);
      } else {
        circuit.state = 'half-open';
      }
    }

    try {
      const result = await operation();
      
      // Success - reset or close circuit
      if (circuit.state === 'half-open') {
        circuit.state = 'closed';
        circuit.failureCount = 0;
      }
      circuit.successCount++;
      
      return result;
    } catch (error) {
      circuit.failureCount++;
      circuit.lastFailureTime = Date.now();
      
      if (circuit.failureCount >= config.failureThreshold) {
        circuit.state = 'open';
      }
      
      throw error;
    }
  }

  /**
   * Get circuit breaker state
   * @param {string} serviceName - Service identifier
   * @returns {Object} Circuit state
   */
  getCircuitState(serviceName) {
    return this.circuitBreakers.get(serviceName) || null;
  }

  /**
   * Add custom error handler
   * @param {string} category - Error category
   * @param {Function} handler - Handler function
   */
  addCustomHandler(category, handler) {
    this.customHandlers.set(category, handler);
  }

  /**
   * Add error transformer
   * @param {string} category - Error category
   * @param {Function} transformer - Transformer function
   */
  addTransformer(category, transformer) {
    this.transformers.set(category, transformer);
  }

  /**
   * Transform error using registered transformers
   * @param {Error} error - Error to transform
   * @returns {Error} Transformed error
   */
  transformError(error) {
    const classification = this.classifyError(error);
    const transformer = this.transformers.get(classification.category);
    
    if (transformer) {
      return transformer(error);
    }
    
    return error;
  }

  /**
   * Get error counts by category
   * @returns {Object} Error counts
   */
  getErrorCounts() {
    return { ...this.errorCounts };
  }

  /**
   * Get recent errors
   * @param {number} limit - Number of errors to return
   * @returns {Array} Recent errors
   */
  getRecentErrors(limit = 10) {
    return this.errorHistory.slice(-limit).reverse();
  }

  /**
   * Get errors by category
   * @param {string} category - Error category
   * @returns {Array} Filtered errors
   */
  getErrorsByCategory(category) {
    return this.errorHistory.filter(record => 
      record.classification.category === category
    );
  }

  /**
   * Create error summary
   * @returns {Object} Error summary
   */
  createErrorSummary() {
    const categoryCounts = { ...this.errorCounts };
    delete categoryCounts.total;

    const mostCommon = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }));

    const recommendations = this._generateRecommendations(categoryCounts);

    return {
      totalErrors: this.errorCounts.total,
      categoryCounts,
      mostCommon,
      recommendations,
      timeRange: this._getTimeRange(),
      timestamp: Date.now()
    };
  }

  /**
   * Aggregate errors by pattern
   * @returns {Object} Aggregated error data
   */
  aggregateErrors() {
    const patterns = new Map();

    for (const record of this.errorHistory) {
      const key = `${record.error.constructor.name}:${record.classification.category}`;
      
      if (patterns.has(key)) {
        patterns.get(key).count++;
        patterns.get(key).lastOccurrence = record.timestamp;
      } else {
        patterns.set(key, {
          type: record.error.constructor.name,
          category: record.classification.category,
          count: 1,
          firstOccurrence: record.timestamp,
          lastOccurrence: record.timestamp
        });
      }
    }

    return {
      patterns: Array.from(patterns.values()).sort((a, b) => b.count - a.count),
      totalPatterns: patterns.size,
      timestamp: Date.now()
    };
  }

  /**
   * Generate error report
   * @returns {Object} Comprehensive error report
   */
  generateReport() {
    const summary = this.createErrorSummary();
    const aggregated = this.aggregateErrors();
    const recent = this.getRecentErrors(5);

    return {
      summary: `Found ${summary.totalErrors} errors across ${Object.keys(summary.categoryCounts).length} categories`,
      details: {
        counts: summary.categoryCounts,
        patterns: aggregated.patterns,
        recent: recent.map(r => this.formatError(r.error))
      },
      recommendations: summary.recommendations,
      timestamp: Date.now()
    };
  }

  /**
   * Export error data
   * @returns {Object} Serializable error data
   */
  exportErrorData() {
    return {
      errors: this.errorHistory.map(record => ({
        error: {
          name: record.error.constructor.name,
          message: record.error.message,
          stack: record.error.stack
        },
        classification: record.classification,
        context: record.context,
        timestamp: record.timestamp,
        id: record.id
      })),
      counts: this.errorCounts,
      timestamp: Date.now()
    };
  }

  /**
   * Import error data
   * @param {Object} data - Error data to import
   */
  importErrorData(data) {
    if (data.errors) {
      for (const errorData of data.errors) {
        // Reconstruct error object
        const ErrorClass = global[errorData.error.name] || Error;
        const error = new ErrorClass(errorData.error.message);
        if (errorData.error.stack) {
          error.stack = errorData.error.stack;
        }

        const record = {
          error,
          classification: errorData.classification,
          context: errorData.context,
          timestamp: errorData.timestamp,
          id: errorData.id
        };

        this.errorHistory.push(record);
      }
    }

    if (data.counts) {
      this.errorCounts = { ...this.errorCounts, ...data.counts };
    }
  }

  /**
   * Clean up old errors
   */
  cleanupOldErrors() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    this.errorHistory = this.errorHistory.filter(record => 
      record.timestamp > cutoffTime
    );
  }

  /**
   * Start automatic cleanup timer
   */
  startAutoCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldErrors();
    }, this.config.cleanupInterval);
  }
  
  /**
   * Stop automatic cleanup timer
   */
  stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // Private helper methods

  _updateErrorCounts(category) {
    this.errorCounts[category] = (this.errorCounts[category] || 0) + 1;
    this.errorCounts.total++;
  }

  _generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _optimizeContext(context) {
    if (!context || typeof context !== 'object') {
      return context;
    }

    const optimized = {};
    
    for (const [key, value] of Object.entries(context)) {
      // Keep small, useful data
      if (key === 'metadata' || key === 'source' || key === 'operation') {
        optimized[key] = value;
      }
      // Skip large data arrays
      else if (Array.isArray(value) && value.length > 100) {
        // Don't include large arrays at all
        continue;
      }
      // Keep reasonable sized strings
      else if (typeof value === 'string' && value.length < 1000) {
        optimized[key] = value;
      }
      // Keep primitives
      else if (typeof value !== 'object') {
        optimized[key] = value;
      }
    }

    return optimized;
  }

  _logError(errorRecord) {
    const { error, classification, timestamp } = errorRecord;
    const timeStr = new Date(timestamp).toISOString();
    // Error already recorded in errorLog, no need for console output
  }

  _parseStackFrame(line) {
    const match = line.match(/at\s+(?:([^(]+)\s+\()?([^:]+):(\d+):(\d+)\)?/);
    
    if (match) {
      let functionName = match[1] ? match[1].trim() : '<anonymous>';
      
      // Clean up function names - remove Object. prefix
      if (functionName.startsWith('Object.')) {
        functionName = functionName.substring(7);
      }
      
      return {
        function: functionName,
        file: match[2],
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10)
      };
    }

    return null;
  }

  _calculateDelay(baseDelay, attempt, backoff) {
    switch (backoff) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt);
      case 'linear':
        return baseDelay * attempt;
      default:
        return baseDelay;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _generateRecommendations(categoryCounts) {
    const recommendations = [];

    if (categoryCounts.syntax > 5) {
      recommendations.push('Consider using a linter to catch syntax errors early');
    }

    if (categoryCounts.type > 3) {
      recommendations.push('Add type checking and null/undefined guards');
    }

    if (categoryCounts.network > 2) {
      recommendations.push('Implement retry logic and circuit breakers for network calls');
    }

    if (categoryCounts.filesystem > 2) {
      recommendations.push('Add file existence checks and proper error handling');
    }

    return recommendations;
  }

  _getTimeRange() {
    if (this.errorHistory.length === 0) {
      return null;
    }

    const timestamps = this.errorHistory.map(r => r.timestamp);
    return {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps)
    };
  }
  
  /**
   * Clean up resources and stop timers
   */
  destroy() {
    this.stopAutoCleanup();
    this.errorHistory = [];
    this.customHandlers.clear();
    this.transformers.clear();
    this.circuitBreakers.clear();
  }
}

export { ErrorHandler };