/**
 * ErrorHandler - Centralized error handling for TreeScribe parsers
 * Provides graceful error recovery and user-friendly messages
 */

export class ParseError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ParseError';
    this.parser = details.parser || 'Unknown';
    this.format = details.format || 'Unknown';
    this.line = details.line || null;
    this.column = details.column || null;
    this.context = details.context || null;
    this.recoverable = details.recoverable !== false;
  }

  /**
   * Get formatted error message for display
   * @returns {string}
   */
  getDisplayMessage() {
    let msg = `${this.format} Parse Error: ${this.message}`;
    
    if (this.line !== null) {
      msg += ` (Line ${this.line}`;
      if (this.column !== null) {
        msg += `, Column ${this.column}`;
      }
      msg += ')';
    }
    
    return msg;
  }

  /**
   * Get detailed error information
   * @returns {Object}
   */
  getDetails() {
    return {
      message: this.message,
      parser: this.parser,
      format: this.format,
      location: {
        line: this.line,
        column: this.column
      },
      context: this.context,
      recoverable: this.recoverable,
      timestamp: new Date().toISOString()
    };
  }
}

export class ErrorHandler {
  constructor(options = {}) {
    this.maxErrors = options.maxErrors || 10;
    this.continueOnError = options.continueOnError !== false;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Handle a parse error
   * @param {Error|ParseError} error - The error to handle
   * @param {Object} context - Additional context
   * @returns {Object} Error recovery information
   */
  handleError(error, context = {}) {
    // Convert to ParseError if needed
    const parseError = error instanceof ParseError ? error : 
      new ParseError(error.message, context);
    
    // Log error
    this.errors.push(parseError);
    
    // Check error limit
    if (this.errors.length >= this.maxErrors) {
      throw new ParseError('Too many parse errors', {
        parser: context.parser,
        format: context.format,
        recoverable: false
      });
    }
    
    // Determine recovery strategy
    if (!this.continueOnError || !parseError.recoverable) {
      throw parseError;
    }
    
    // Return recovery information
    return this._getRecoveryStrategy(parseError);
  }

  /**
   * Add a warning
   * @param {string} message - Warning message
   * @param {Object} details - Warning details
   */
  addWarning(message, details = {}) {
    this.warnings.push({
      message,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get all errors
   * @returns {ParseError[]}
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Get all warnings
   * @returns {Object[]}
   */
  getWarnings() {
    return [...this.warnings];
  }

  /**
   * Check if there are any errors
   * @returns {boolean}
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Get error summary
   * @returns {Object}
   */
  getSummary() {
    return {
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors.map(e => e.getDetails()),
      warnings: this.warnings,
      hasErrors: this.hasErrors(),
      canContinue: this.errors.every(e => e.recoverable)
    };
  }

  /**
   * Clear all errors and warnings
   */
  clear() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Create error node for tree display
   * @param {ParseError} error - The error
   * @param {Object} partialContent - Any partial content recovered
   * @returns {Object} Error node
   */
  createErrorNode(error, partialContent = null) {
    return {
      title: 'Parse Error',
      content: error.getDisplayMessage(),
      contentType: 'error',
      children: partialContent ? [partialContent] : [],
      metadata: {
        error: true,
        errorDetails: error.getDetails(),
        recoverable: error.recoverable
      }
    };
  }

  /**
   * Determine recovery strategy for error
   * @private
   */
  _getRecoveryStrategy(error) {
    const strategies = {
      'SyntaxError': {
        action: 'skip',
        skipLines: 1,
        message: 'Skipping invalid syntax'
      },
      'UnexpectedToken': {
        action: 'skip',
        skipUntil: /^[\s]*$/,
        message: 'Skipping to next valid section'
      },
      'InvalidStructure': {
        action: 'partial',
        usePartial: true,
        message: 'Using partial parse result'
      },
      'MissingRequired': {
        action: 'default',
        defaultValue: {},
        message: 'Using default values'
      }
    };
    
    // Match error type to strategy
    for (const [pattern, strategy] of Object.entries(strategies)) {
      if (error.message.includes(pattern) || error.name.includes(pattern)) {
        return strategy;
      }
    }
    
    // Default strategy
    return {
      action: 'continue',
      message: 'Continuing with best effort'
    };
  }

  /**
   * Validate parser output
   * @param {Object} result - Parser result
   * @param {Object} schema - Expected structure
   * @returns {boolean} Is valid
   */
  validateResult(result, schema = {}) {
    try {
      // Basic structure validation
      if (!result || typeof result !== 'object') {
        this.addWarning('Invalid parser result structure');
        return false;
      }
      
      // Check required fields
      const requiredFields = schema.required || ['title', 'children'];
      for (const field of requiredFields) {
        if (!(field in result)) {
          this.addWarning(`Missing required field: ${field}`);
          return false;
        }
      }
      
      // Validate children array
      if (result.children && !Array.isArray(result.children)) {
        this.addWarning('Children must be an array');
        return false;
      }
      
      // Validate metadata
      if (result.metadata && typeof result.metadata !== 'object') {
        this.addWarning('Metadata must be an object');
        return false;
      }
      
      return true;
      
    } catch (error) {
      this.handleError(error, { 
        parser: 'Validator',
        format: 'result'
      });
      return false;
    }
  }
}

/**
 * Create error boundary for parser operations
 * @param {Function} operation - Parser operation to wrap
 * @param {Object} context - Error context
 * @returns {Function} Wrapped operation
 */
export function withErrorHandling(operation, context = {}) {
  return async (...args) => {
    const errorHandler = new ErrorHandler({
      continueOnError: context.continueOnError !== false
    });
    
    try {
      const result = await operation(...args);
      
      // Validate result
      if (!errorHandler.validateResult(result)) {
        throw new ParseError('Invalid parser result', context);
      }
      
      // Add error summary to metadata if there were recoverable errors
      if (errorHandler.hasErrors()) {
        result.metadata = result.metadata || {};
        result.metadata.parseErrors = errorHandler.getSummary();
      }
      
      return result;
      
    } catch (error) {
      // Try to recover
      try {
        const recovery = errorHandler.handleError(error, context);
        
        // Return error node
        return errorHandler.createErrorNode(
          error instanceof ParseError ? error : 
            new ParseError(error.message, context)
        );
        
      } catch (fatalError) {
        // Unrecoverable error
        throw fatalError;
      }
    }
  };
}