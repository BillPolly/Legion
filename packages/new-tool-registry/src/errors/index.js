/**
 * Custom error classes for new-tool-registry
 * 
 * Specific errors for better debugging and error handling
 * No fallbacks - these errors should be thrown and handled properly
 */

/**
 * Base error class for all tool registry errors
 */
export class ToolRegistryError extends Error {
  constructor(message, code = 'TOOL_REGISTRY_ERROR') {
    super(message);
    this.name = 'ToolRegistryError';
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error thrown when module loading fails
 */
export class ModuleLoadError extends ToolRegistryError {
  constructor(message, modulePath, originalError) {
    super(message, 'MODULE_LOAD_ERROR');
    this.name = 'ModuleLoadError';
    this.modulePath = modulePath;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when module validation fails
 */
export class ModuleValidationError extends ToolRegistryError {
  constructor(message, moduleName, validationErrors = []) {
    super(message, 'MODULE_VALIDATION_ERROR');
    this.name = 'ModuleValidationError';
    this.moduleName = moduleName;
    this.validationErrors = validationErrors;
  }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends ToolRegistryError {
  constructor(message, toolName, parameters, originalError) {
    super(message, 'TOOL_EXECUTION_ERROR');
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.parameters = parameters;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when tool validation fails
 */
export class ToolValidationError extends ToolRegistryError {
  constructor(message, toolName, validationErrors = []) {
    super(message, 'TOOL_VALIDATION_ERROR');
    this.name = 'ToolValidationError';
    this.toolName = toolName;
    this.validationErrors = validationErrors;
  }
}

/**
 * Error thrown when database operations fail
 */
export class DatabaseError extends ToolRegistryError {
  constructor(message, operation, collection, originalError) {
    super(message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    this.operation = operation;
    this.collection = collection;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when module discovery fails
 */
export class DiscoveryError extends ToolRegistryError {
  constructor(message, searchPath, originalError) {
    super(message, 'DISCOVERY_ERROR');
    this.name = 'DiscoveryError';
    this.searchPath = searchPath;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when resource initialization fails
 */
export class ResourceInitializationError extends ToolRegistryError {
  constructor(message, resourceType, originalError) {
    super(message, 'RESOURCE_INITIALIZATION_ERROR');
    this.name = 'ResourceInitializationError';
    this.resourceType = resourceType;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when semantic search operations fail
 */
export class SemanticSearchError extends ToolRegistryError {
  constructor(message, operation, originalError) {
    super(message, 'SEMANTIC_SEARCH_ERROR');
    this.name = 'SemanticSearchError';
    this.operation = operation;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when LLM operations fail
 */
export class LLMError extends ToolRegistryError {
  constructor(message, operation, originalError) {
    super(message, 'LLM_ERROR');
    this.name = 'LLMError';
    this.operation = operation;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when embedding generation fails
 */
export class EmbeddingError extends ToolRegistryError {
  constructor(message, text, originalError) {
    super(message, 'EMBEDDING_ERROR');
    this.name = 'EmbeddingError';
    this.text = text ? text.substring(0, 100) : undefined; // Truncate for logging
    this.originalError = originalError;
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends ToolRegistryError {
  constructor(message, configKey, expectedValue) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
    this.configKey = configKey;
    this.expectedValue = expectedValue;
  }
}

/**
 * Error thrown when a required dependency is missing
 */
export class DependencyError extends ToolRegistryError {
  constructor(message, dependencyName, requiredBy) {
    super(message, 'DEPENDENCY_ERROR');
    this.name = 'DependencyError';
    this.dependencyName = dependencyName;
    this.requiredBy = requiredBy;
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends ToolRegistryError {
  constructor(message, operation, key, originalError) {
    super(message, 'CACHE_ERROR');
    this.name = 'CacheError';
    this.operation = operation;
    this.key = key;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when parameter validation fails
 */
export class ParameterValidationError extends ToolRegistryError {
  constructor(message, parameterName, expectedType, actualType) {
    super(message, 'PARAMETER_VALIDATION_ERROR');
    this.name = 'ParameterValidationError';
    this.parameterName = parameterName;
    this.expectedType = expectedType;
    this.actualType = actualType;
  }
}

/**
 * Error thrown when database operation fails
 */
export class DatabaseOperationError extends ToolRegistryError {
  constructor(message, operation, params = {}, originalError = null) {
    super(message, 'DATABASE_OPERATION_ERROR');
    this.name = 'DatabaseOperationError';
    this.operation = operation;
    this.params = params;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when module is not found
 */
export class ModuleNotFoundError extends ToolRegistryError {
  constructor(message, moduleName, location = 'unknown') {
    super(message, 'MODULE_NOT_FOUND');
    this.name = 'ModuleNotFoundError';
    this.moduleName = moduleName;
    this.location = location;
  }
}

/**
 * Error thrown when tool is not found
 */
export class ToolNotFoundError extends ToolRegistryError {
  constructor(toolName, location = 'unknown') {
    super(`Tool not found: ${toolName}`, 'TOOL_NOT_FOUND');
    this.name = 'ToolNotFoundError';
    this.toolName = toolName;
    this.location = location;
  }
}

/**
 * Error thrown when tool loading fails
 */
export class ToolLoadError extends ToolRegistryError {
  constructor(message, toolName, originalError = null) {
    super(message, 'TOOL_LOAD_ERROR');
    this.name = 'ToolLoadError';
    this.toolName = toolName;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends ToolRegistryError {
  constructor(message, validationType, errors = []) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.validationType = validationType;
    this.errors = errors;
  }
}

/**
 * Error thrown when text search operations fail
 */
export class TextSearchError extends ToolRegistryError {
  constructor(message, code = 'TEXT_SEARCH_ERROR', details = {}) {
    super(message, code);
    this.name = 'TextSearchError';
    this.details = details;
  }
}

/**
 * Error thrown when perspective operations fail
 */
export class PerspectiveError extends ToolRegistryError {
  constructor(message, code = 'PERSPECTIVE_ERROR', details = {}) {
    super(message, code);
    this.name = 'PerspectiveError';
    this.details = details;
  }
}

/**
 * Error thrown when vector store operations fail
 */
export class VectorStoreError extends ToolRegistryError {
  constructor(message, code = 'VECTOR_STORE_ERROR', details = {}) {
    super(message, code);
    this.name = 'VectorStoreError';
    this.details = details;
  }
}