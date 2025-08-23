/**
 * Custom error classes for ToolRegistry
 * 
 * Provides specific error types for different failure scenarios
 * to enable better error handling and recovery strategies
 */

/**
 * Base error class for all ToolRegistry errors
 */
export class ToolRegistryError extends Error {
  constructor(message, code = 'TOOL_REGISTRY_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

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
}

/**
 * Error thrown when a module is not found
 */
export class ModuleNotFoundError extends ToolRegistryError {
  constructor(moduleName, details = {}) {
    super(
      `Module '${moduleName}' not found in registry`,
      'MODULE_NOT_FOUND',
      { moduleName, ...details }
    );
  }
}

/**
 * Error thrown when a tool is not found
 */
export class ToolNotFoundError extends ToolRegistryError {
  constructor(toolName, moduleName = null, details = {}) {
    const message = moduleName
      ? `Tool '${toolName}' not found in module '${moduleName}'`
      : `Tool '${toolName}' not found in registry`;
    super(message, 'TOOL_NOT_FOUND', { toolName, moduleName, ...details });
  }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends ToolRegistryError {
  constructor(toolName, originalError, details = {}) {
    super(
      `Tool '${toolName}' execution failed: ${originalError.message}`,
      'TOOL_EXECUTION_FAILED',
      { 
        toolName, 
        originalError: originalError.message,
        originalStack: originalError.stack,
        ...details 
      }
    );
  }
}

/**
 * Error thrown when module loading fails
 */
export class ModuleLoadError extends ToolRegistryError {
  constructor(moduleName, reason, details = {}) {
    super(
      `Failed to load module '${moduleName}': ${reason}`,
      'MODULE_LOAD_FAILED',
      { moduleName, reason, ...details }
    );
  }
}

/**
 * Error thrown when database operations fail
 */
export class DatabaseError extends ToolRegistryError {
  constructor(operation, originalError, details = {}) {
    super(
      `Database operation '${operation}' failed: ${originalError.message}`,
      'DATABASE_ERROR',
      { 
        operation,
        originalError: originalError.message,
        ...details 
      }
    );
  }
}

/**
 * Error thrown when semantic search operations fail
 */
export class SemanticSearchError extends ToolRegistryError {
  constructor(operation, reason, details = {}) {
    super(
      `Semantic search operation '${operation}' failed: ${reason}`,
      'SEMANTIC_SEARCH_ERROR',
      { operation, reason, ...details }
    );
  }
}

/**
 * Error thrown for invalid input/parameters
 */
export class ValidationError extends ToolRegistryError {
  constructor(parameter, expectedType, actualValue, details = {}) {
    const actualType = actualValue === null ? 'null' : typeof actualValue;
    super(
      `Invalid parameter '${parameter}': expected ${expectedType}, got ${actualType}`,
      'VALIDATION_ERROR',
      { parameter, expectedType, actualType, actualValue, ...details }
    );
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends ToolRegistryError {
  constructor(operation, reason, details = {}) {
    super(
      `Cache operation '${operation}' failed: ${reason}`,
      'CACHE_ERROR',
      { operation, reason, ...details }
    );
  }
}

/**
 * Error thrown when concurrency issues occur
 */
export class ConcurrencyError extends ToolRegistryError {
  constructor(operation, reason, details = {}) {
    super(
      `Concurrency issue during '${operation}': ${reason}`,
      'CONCURRENCY_ERROR',
      { operation, reason, ...details }
    );
  }
}

/**
 * Error thrown when initialization fails
 */
export class InitializationError extends ToolRegistryError {
  constructor(component, reason, details = {}) {
    super(
      `Failed to initialize ${component}: ${reason}`,
      'INITIALIZATION_ERROR',
      { component, reason, ...details }
    );
  }
}

/**
 * Error thrown when resource cleanup fails
 */
export class CleanupError extends ToolRegistryError {
  constructor(resource, originalError, details = {}) {
    super(
      `Failed to cleanup ${resource}: ${originalError.message}`,
      'CLEANUP_ERROR',
      { 
        resource,
        originalError: originalError.message,
        ...details 
      }
    );
  }
}