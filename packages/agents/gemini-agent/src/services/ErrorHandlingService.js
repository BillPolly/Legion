/**
 * ErrorHandlingService - Enhanced error handling ported from Gemini CLI
 * Provides structured error types and classification like Gemini CLI
 */

/**
 * Tool error types (ported from Gemini CLI ToolErrorType)
 */
export const ToolErrorType = {
  EXECUTION_ERROR: 'execution_error',
  VALIDATION_ERROR: 'validation_error', 
  PERMISSION_ERROR: 'permission_error',
  FILE_NOT_FOUND: 'file_not_found',
  NETWORK_ERROR: 'network_error',
  TIMEOUT_ERROR: 'timeout_error',
  UNKNOWN_ERROR: 'unknown_error'
};

/**
 * Structured error format (ported from Gemini CLI StructuredError)
 */
export class StructuredError extends Error {
  constructor(message, errorType = ToolErrorType.UNKNOWN_ERROR, details = {}) {
    super(message);
    this.name = 'StructuredError';
    this.errorType = errorType;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      message: this.message,
      errorType: this.errorType,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Service for enhanced error handling (ported from Gemini CLI patterns)
 */
export class ErrorHandlingService {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.errorHistory = [];
    this.maxErrorHistory = 50;
  }

  /**
   * Classify error type based on error characteristics (ported from Gemini CLI)
   * @param {Error} error - Original error
   * @returns {string} Error type classification
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    // File system errors
    if (message.includes('enoent') || message.includes('not found') || message.includes('cannot find')) {
      return ToolErrorType.FILE_NOT_FOUND;
    }
    
    if (message.includes('eacces') || message.includes('permission') || message.includes('access denied')) {
      return ToolErrorType.PERMISSION_ERROR;
    }
    
    // Network errors
    if (message.includes('fetch failed') || message.includes('network') || message.includes('connection')) {
      return ToolErrorType.NETWORK_ERROR;
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return ToolErrorType.TIMEOUT_ERROR;
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return ToolErrorType.VALIDATION_ERROR;
    }
    
    return ToolErrorType.EXECUTION_ERROR;
  }

  /**
   * Create structured error from raw error (ported from Gemini CLI)
   * @param {Error} error - Raw error
   * @param {string} context - Error context (tool name, operation, etc.)
   * @returns {StructuredError} Structured error
   */
  createStructuredError(error, context = '') {
    const errorType = this.classifyError(error);
    
    const structuredError = new StructuredError(
      error.message,
      errorType,
      {
        context,
        originalError: error.name,
        stack: error.stack?.split('\\n').slice(0, 3) // First 3 lines of stack
      }
    );
    
    // Track error for debugging
    this.recordError(structuredError);
    
    return structuredError;
  }

  /**
   * Get user-friendly error message (ported from Gemini CLI)
   * @param {StructuredError} error - Structured error
   * @returns {string} User-friendly message
   */
  getFriendlyErrorMessage(error) {
    switch (error.errorType) {
      case ToolErrorType.FILE_NOT_FOUND:
        return `File not found. Please check the file path and ensure the file exists.`;
      
      case ToolErrorType.PERMISSION_ERROR:
        return `Permission denied. Please check file permissions and access rights.`;
      
      case ToolErrorType.NETWORK_ERROR:
        return `Network error occurred. Please check your internet connection and try again.`;
      
      case ToolErrorType.TIMEOUT_ERROR:
        return `Operation timed out. The operation took longer than expected to complete.`;
      
      case ToolErrorType.VALIDATION_ERROR:
        return `Invalid input provided. Please check the parameters and try again.`;
      
      default:
        return `An error occurred: ${error.message}`;
    }
  }

  /**
   * Record error for debugging and analysis (ported concept from Gemini CLI)
   * @param {StructuredError} error - Error to record
   */
  recordError(error) {
    this.errorHistory.push({
      timestamp: error.timestamp,
      errorType: error.errorType,
      message: error.message,
      context: error.details.context
    });
    
    // Maintain error history size
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }
  }

  /**
   * Get error statistics for debugging
   * @returns {Object} Error statistics
   */
  getErrorStatistics() {
    const errorCounts = {};
    
    for (const error of this.errorHistory) {
      errorCounts[error.errorType] = (errorCounts[error.errorType] || 0) + 1;
    }
    
    return {
      totalErrors: this.errorHistory.length,
      errorTypes: errorCounts,
      recentErrors: this.errorHistory.slice(-5)
    };
  }

  /**
   * Determine if error should trigger retry (ported from Gemini CLI retry logic)
   * @param {StructuredError} error - Structured error
   * @param {number} attemptCount - Current attempt count
   * @returns {boolean} Whether to retry
   */
  shouldRetry(error, attemptCount = 1) {
    // Don't retry validation or permission errors
    if ([ToolErrorType.VALIDATION_ERROR, ToolErrorType.PERMISSION_ERROR, ToolErrorType.FILE_NOT_FOUND].includes(error.errorType)) {
      return false;
    }
    
    // Retry network and timeout errors up to 3 times
    if ([ToolErrorType.NETWORK_ERROR, ToolErrorType.TIMEOUT_ERROR].includes(error.errorType)) {
      return attemptCount < 3;
    }
    
    // Retry execution errors once
    if (error.errorType === ToolErrorType.EXECUTION_ERROR) {
      return attemptCount < 2;
    }
    
    return false;
  }

  /**
   * Clear error history (for testing)
   */
  clearErrorHistory() {
    this.errorHistory = [];
  }
}

export default ErrorHandlingService;