/**
 * Custom Error Classes for Aiur System
 * 
 * Provides specific error types for different failure modes
 * with enhanced context and recovery information
 */

/**
 * Base error class for all Aiur-specific errors
 */
export class AiurError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    this.timestamp = new Date();
    this.severity = details.severity || 'error';
    this.recoverable = details.recoverable !== false;
    this.context = details.context || {};
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON format
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      severity: this.severity,
      recoverable: this.recoverable,
      context: this.context,
      stack: this.stack
    };
  }

  /**
   * Create error with additional context
   */
  withContext(context) {
    return new this.constructor(this.message, {
      ...this.details,
      context: { ...this.context, ...context }
    });
  }
}

/**
 * Validation-related errors
 */
export class ValidationError extends AiurError {
  constructor(message, details = {}) {
    super(message, { ...details, recoverable: false });
  }
}

/**
 * Tool execution errors
 */
export class ExecutionError extends AiurError {
  constructor(message, details = {}) {
    super(message, details);
    this.tool = details.tool;
    this.step = details.step;
    this.parameters = details.parameters;
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends AiurError {
  constructor(message, details = {}) {
    super(message, { ...details, recoverable: true });
    this.endpoint = details.endpoint;
    this.statusCode = details.statusCode;
    this.timeout = details.timeout;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AiurError {
  constructor(message, details = {}) {
    super(message, { ...details, recoverable: false });
    this.setting = details.setting;
    this.expectedType = details.expectedType;
    this.actualValue = details.actualValue;
  }
}

/**
 * Resource exhaustion errors
 */
export class ResourceError extends AiurError {
  constructor(message, details = {}) {
    super(message, details);
    this.resource = details.resource;
    this.limit = details.limit;
    this.current = details.current;
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends AiurError {
  constructor(message, details = {}) {
    super(message, { ...details, recoverable: true });
    this.timeout = details.timeout;
    this.elapsed = details.elapsed;
  }
}

/**
 * Concurrent access errors
 */
export class ConcurrencyError extends AiurError {
  constructor(message, details = {}) {
    super(message, { ...details, recoverable: true });
    this.resource = details.resource;
    this.conflictType = details.conflictType;
  }
}