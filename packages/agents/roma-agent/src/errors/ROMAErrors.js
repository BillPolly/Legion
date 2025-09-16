/**
 * ROMAErrors - Custom error classes for ROMA Agent
 * Provides specific error types for different failure scenarios
 */

/**
 * Base class for all ROMA Agent errors
 */
export class ROMAError extends Error {
  constructor(message, code = 'ROMA_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Get user-friendly error description
   */
  getDescription() {
    return this.message;
  }

  /**
   * Check if error is retryable
   */
  isRetryable() {
    return false; // Default: not retryable
  }

  /**
   * Get recommended action
   */
  getRecommendedAction() {
    return 'Review error details and correct the issue';
  }
}

/**
 * Task-related errors
 */
export class TaskError extends ROMAError {
  constructor(message, taskId, code = 'TASK_ERROR', details = {}) {
    super(message, code, { ...details, taskId });
    this.taskId = taskId;
  }

  getDescription() {
    return `Task ${this.taskId}: ${this.message}`;
  }
}

export class TaskValidationError extends TaskError {
  constructor(message, taskId, validationErrors = []) {
    super(message, taskId, 'TASK_VALIDATION_ERROR', { validationErrors });
  }

  getRecommendedAction() {
    return 'Check task structure and fix validation errors';
  }
}

export class TaskExecutionError extends TaskError {
  constructor(message, taskId, originalError = null, attempts = 0) {
    super(message, taskId, 'TASK_EXECUTION_ERROR', { 
      originalError: originalError?.message,
      originalStack: originalError?.stack,
      attempts
    });
    this.originalError = originalError;
    this.attempts = attempts;
  }

  isRetryable() {
    // Retry if not too many attempts and original error is retryable
    return this.attempts < 3 && this.isOriginalErrorRetryable();
  }

  isOriginalErrorRetryable() {
    if (!this.originalError) return true;
    
    const nonRetryablePatterns = [
      /validation/i,
      /invalid.*argument/i,
      /unauthorized/i,
      /forbidden/i,
      /not found/i,
      /bad request/i
    ];
    
    return !nonRetryablePatterns.some(pattern => 
      pattern.test(this.originalError.message || '')
    );
  }

  getRecommendedAction() {
    if (this.isRetryable()) {
      return 'Task will be automatically retried';
    }
    return 'Fix the underlying cause and retry manually';
  }
}

export class TaskTimeoutError extends TaskError {
  constructor(message, taskId, timeout) {
    super(message, taskId, 'TASK_TIMEOUT_ERROR', { timeout });
    this.timeout = timeout;
  }

  isRetryable() {
    return true; // Timeouts are generally retryable
  }

  getRecommendedAction() {
    return 'Consider increasing timeout or optimizing task execution';
  }
}

/**
 * Dependency-related errors
 */
export class DependencyError extends ROMAError {
  constructor(message, code = 'DEPENDENCY_ERROR', details = {}) {
    super(message, code, details);
  }
}

export class CircularDependencyError extends DependencyError {
  constructor(cycles = []) {
    const message = `Circular dependencies detected: ${cycles.map(c => c.join(' -> ')).join(', ')}`;
    super(message, 'CIRCULAR_DEPENDENCY_ERROR', { cycles });
    this.cycles = cycles;
  }

  getRecommendedAction() {
    return 'Break circular dependencies by removing or restructuring task relationships';
  }
}

export class MissingDependencyError extends DependencyError {
  constructor(missing = [], taskId = null) {
    const message = `Missing dependencies: ${missing.join(', ')}${taskId ? ` (task: ${taskId})` : ''}`;
    super(message, 'MISSING_DEPENDENCY_ERROR', { missing, taskId });
    this.missing = missing;
    this.taskId = taskId;
  }

  getRecommendedAction() {
    return 'Provide required dependencies or update task requirements';
  }
}

export class DependencyResolutionError extends DependencyError {
  constructor(message, resolutionAttempts = 0) {
    super(message, 'DEPENDENCY_RESOLUTION_ERROR', { resolutionAttempts });
    this.resolutionAttempts = resolutionAttempts;
  }

  isRetryable() {
    return this.resolutionAttempts < 2; // Allow limited retries
  }
}

/**
 * Strategy-related errors
 */
export class StrategyError extends ROMAError {
  constructor(message, strategyName = null, code = 'STRATEGY_ERROR', details = {}) {
    super(message, code, { ...details, strategyName });
    this.strategyName = strategyName;
  }

  getDescription() {
    return this.strategyName 
      ? `Strategy ${this.strategyName}: ${this.message}`
      : this.message;
  }
}

export class StrategySelectionError extends StrategyError {
  constructor(message, taskId = null, availableStrategies = []) {
    super(message, null, 'STRATEGY_SELECTION_ERROR', { 
      taskId, 
      availableStrategies 
    });
    this.taskId = taskId;
    this.availableStrategies = availableStrategies;
  }

  getRecommendedAction() {
    return 'Check task requirements or register additional strategies';
  }
}

export class StrategyExecutionError extends StrategyError {
  constructor(message, strategyName, taskId = null, originalError = null) {
    super(message, strategyName, 'STRATEGY_EXECUTION_ERROR', {
      taskId,
      originalError: originalError?.message
    });
    this.taskId = taskId;
    this.originalError = originalError;
  }

  isRetryable() {
    return this.originalError?.isRetryable?.() ?? false;
  }
}

/**
 * Queue-related errors
 */
export class QueueError extends ROMAError {
  constructor(message, code = 'QUEUE_ERROR', details = {}) {
    super(message, code, details);
  }
}

export class QueueCapacityError extends QueueError {
  constructor(capacity, attempted) {
    super(
      `Queue capacity exceeded: ${attempted} requested, ${capacity} available`,
      'QUEUE_CAPACITY_ERROR',
      { capacity, attempted }
    );
    this.capacity = capacity;
    this.attempted = attempted;
  }

  getRecommendedAction() {
    return 'Wait for queue capacity or increase concurrency limit';
  }
}

export class QueueDrainingError extends QueueError {
  constructor() {
    super(
      'Queue is draining, cannot add new tasks',
      'QUEUE_DRAINING_ERROR'
    );
  }

  getRecommendedAction() {
    return 'Wait for queue to finish draining or create a new queue';
  }
}

/**
 * Resource-related errors
 */
export class ResourceError extends ROMAError {
  constructor(message, resourceType = null, code = 'RESOURCE_ERROR', details = {}) {
    super(message, code, { ...details, resourceType });
    this.resourceType = resourceType;
  }
}

export class ResourceConflictError extends ResourceError {
  constructor(resource, conflictingTasks = []) {
    super(
      `Resource conflict detected: ${resource}`,
      resource,
      'RESOURCE_CONFLICT_ERROR',
      { conflictingTasks }
    );
    this.resource = resource;
    this.conflictingTasks = conflictingTasks;
  }

  getRecommendedAction() {
    return 'Serialize conflicting tasks or use different resources';
  }
}

export class ResourceUnavailableError extends ResourceError {
  constructor(resource, resourceType = null) {
    super(
      `Resource unavailable: ${resource}`,
      resourceType,
      'RESOURCE_UNAVAILABLE_ERROR',
      { resource }
    );
    this.resource = resource;
  }

  isRetryable() {
    return true; // Resources might become available later
  }

  getRecommendedAction() {
    return 'Check resource availability or provide alternative resources';
  }
}

/**
 * Configuration and validation errors
 */
export class ConfigurationError extends ROMAError {
  constructor(message, configKey = null, details = {}) {
    super(message, 'CONFIGURATION_ERROR', { ...details, configKey });
    this.configKey = configKey;
  }

  getRecommendedAction() {
    return 'Review and correct configuration settings';
  }
}

export class ValidationError extends ROMAError {
  constructor(message, validationErrors = [], details = {}) {
    super(message, 'VALIDATION_ERROR', { ...details, validationErrors });
    this.validationErrors = validationErrors;
  }

  getRecommendedAction() {
    return 'Fix validation errors and retry';
  }
}

/**
 * System and infrastructure errors
 */
export class SystemError extends ROMAError {
  constructor(message, component = null, details = {}) {
    super(message, 'SYSTEM_ERROR', { ...details, component });
    this.component = component;
  }

  isRetryable() {
    return true; // System errors are often transient
  }

  getRecommendedAction() {
    return 'Check system status and retry if issue persists';
  }
}

/**
 * Error factory for creating appropriate error types
 */
export class ErrorFactory {
  /**
   * Create error from generic Error
   */
  static fromError(error, context = {}) {
    if (error instanceof ROMAError) {
      return error; // Already a ROMA error
    }

    const message = error.message || 'Unknown error';
    
    // Analyze error message to determine appropriate type
    if (message.includes('timeout')) {
      return new TaskTimeoutError(
        message, 
        context.taskId, 
        context.timeout
      );
    }
    
    if (message.includes('circular') && message.includes('dependency')) {
      return new CircularDependencyError(context.cycles || []);
    }
    
    if (message.includes('validation')) {
      return new ValidationError(message, context.validationErrors || []);
    }
    
    if (message.includes('strategy')) {
      return new StrategyError(message, context.strategyName);
    }
    
    // Default to generic ROMA error
    return new ROMAError(message, 'UNKNOWN_ERROR', {
      originalError: error.name,
      originalStack: error.stack,
      ...context
    });
  }

  /**
   * Create task error with context
   */
  static createTaskError(message, taskId, originalError = null, attempts = 0) {
    if (originalError && originalError.message?.includes('timeout')) {
      return new TaskTimeoutError(message, taskId, originalError.timeout);
    }
    
    return new TaskExecutionError(message, taskId, originalError, attempts);
  }

  /**
   * Create dependency error with context
   */
  static createDependencyError(type, details = {}) {
    switch (type) {
      case 'circular':
        return new CircularDependencyError(details.cycles);
      case 'missing':
        return new MissingDependencyError(details.missing, details.taskId);
      case 'resolution':
        return new DependencyResolutionError(details.message, details.attempts);
      default:
        return new DependencyError(details.message || 'Dependency error');
    }
  }
}

/**
 * Error utilities
 */
export class ErrorUtils {
  /**
   * Check if error is retryable
   */
  static isRetryable(error) {
    if (error instanceof ROMAError) {
      return error.isRetryable();
    }
    
    // Generic error analysis
    const message = error.message || '';
    const nonRetryablePatterns = [
      /validation/i,
      /invalid.*argument/i,
      /unauthorized/i,
      /forbidden/i,
      /not found/i,
      /bad request/i
    ];
    
    return !nonRetryablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Get error severity level
   */
  static getSeverity(error) {
    if (error instanceof ValidationError || error instanceof ConfigurationError) {
      return 'high';
    }
    if (error instanceof TaskTimeoutError || error instanceof ResourceUnavailableError) {
      return 'medium';
    }
    if (error instanceof SystemError) {
      return 'low';
    }
    return 'medium'; // Default
  }

  /**
   * Format error for logging
   */
  static formatForLog(error, context = {}) {
    const baseInfo = {
      error: error.name || 'Error',
      message: error.message,
      timestamp: new Date().toISOString(),
      ...context
    };

    if (error instanceof ROMAError) {
      return {
        ...baseInfo,
        code: error.code,
        details: error.details,
        retryable: error.isRetryable(),
        recommendation: error.getRecommendedAction()
      };
    }

    return {
      ...baseInfo,
      retryable: ErrorUtils.isRetryable(error),
      severity: ErrorUtils.getSeverity(error)
    };
  }
}