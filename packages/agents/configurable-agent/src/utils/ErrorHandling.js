/**
 * Error handling utilities for configurable agents
 * Provides specialized error classes for different failure scenarios
 */

/**
 * Base error class for all agent-related errors
 */
export class AgentError extends Error {
  constructor(message, code = 'AGENT_ERROR', context = {}) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error for configuration-related issues
 */
export class ConfigurationError extends AgentError {
  constructor(message, validationErrors = [], context = {}) {
    super(message, 'CONFIG_ERROR', {
      ...context,
      validationErrors
    });
    this.name = 'ConfigurationError';
  }
}

/**
 * Error for capability/tool-related issues
 */
export class CapabilityError extends AgentError {
  constructor(message, module, tool, details = {}) {
    super(message, 'CAPABILITY_ERROR', {
      module,
      tool,
      details
    });
    this.name = 'CapabilityError';
  }
}

/**
 * Error for state management issues
 */
export class StateError extends AgentError {
  constructor(message, stateKey, details = {}) {
    super(message, 'STATE_ERROR', {
      stateKey,
      details
    });
    this.name = 'StateError';
  }
}

/**
 * Error for knowledge graph operations
 */
export class KnowledgeGraphError extends AgentError {
  constructor(message, operation, details = {}) {
    super(message, 'KG_ERROR', {
      operation,
      details
    });
    this.name = 'KnowledgeGraphError';
  }
}

/**
 * Error for behavior tree execution
 */
export class BehaviorTreeError extends AgentError {
  constructor(message, nodeId, nodeType, details = {}) {
    super(message, 'BT_ERROR', {
      nodeId,
      nodeType,
      details
    });
    this.name = 'BehaviorTreeError';
  }
}

/**
 * Error for LLM-related issues
 */
export class LLMError extends AgentError {
  constructor(message, provider, model, details = {}) {
    super(message, 'LLM_ERROR', {
      provider,
      model,
      details
    });
    this.name = 'LLMError';
  }
}

/**
 * Factory function to create agent errors with type codes
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} context - Additional context
 * @returns {AgentError} Agent error instance
 */
export function createAgentError(code, message, context = {}) {
  switch (code) {
    case 'INITIALIZATION_ERROR':
    case 'VALIDATION_ERROR':
      return new ConfigurationError(message, context.validationErrors, context);
    
    case 'CAPABILITY_ERROR':
    case 'TOOL_ERROR':
      return new CapabilityError(message, context.module, context.tool, context.details);
    
    case 'STATE_ERROR':
      return new StateError(message, context.stateKey, context.details);
    
    case 'KG_ERROR':
      return new KnowledgeGraphError(message, context.operation, context.details);
    
    case 'BT_ERROR':
      return new BehaviorTreeError(message, context.nodeId, context.nodeType, context.details);
    
    case 'LLM_ERROR':
      return new LLMError(message, context.provider, context.model, context.details);
    
    default:
      return new AgentError(message, code, context);
  }
}

/**
 * Factory function to create appropriate error type
 * @param {string} type - Error type
 * @param {string} message - Error message
 * @param {Object} context - Additional context
 * @returns {AgentError} Appropriate error instance
 */
export function createError(type, message, context = {}) {
  switch (type.toLowerCase()) {
    case 'configuration':
    case 'config':
      return new ConfigurationError(message, context.validationErrors, context);
    
    case 'capability':
    case 'tool':
      return new CapabilityError(message, context.module, context.tool, context.details);
    
    case 'state':
      return new StateError(message, context.stateKey, context.details);
    
    case 'knowledge':
    case 'kg':
      return new KnowledgeGraphError(message, context.operation, context.details);
    
    case 'behaviortree':
    case 'bt':
      return new BehaviorTreeError(message, context.nodeId, context.nodeType, context.details);
    
    case 'llm':
      return new LLMError(message, context.provider, context.model, context.details);
    
    default:
      return new AgentError(message, 'AGENT_ERROR', context);
  }
}

/**
 * Check if an error is an AgentError or its subclass
 * @param {*} error - Value to check
 * @returns {boolean} True if AgentError
 */
export function isAgentError(error) {
  return error instanceof AgentError;
}

/**
 * Format error message with context for logging
 * @param {Error|*} error - Error to format
 * @param {boolean} includeStack - Whether to include stack trace
 * @returns {string} Formatted error message
 */
export function formatErrorMessage(error, includeStack = false) {
  if (!error) {
    return 'Unknown error';
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (!(error instanceof Error)) {
    if (error.message) {
      return String(error.message);
    }
    return JSON.stringify(error);
  }
  
  let message = `[${error.name || 'Error'}]`;
  
  if (isAgentError(error)) {
    message += ` ${error.code}:`;
  }
  
  message += ` ${error.message}`;
  
  if (isAgentError(error) && error.context) {
    const contextEntries = Object.entries(error.context)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      });
    
    if (contextEntries.length > 0) {
      message += ` | Context: ${contextEntries.join(', ')}`;
    }
  }
  
  if (includeStack && error.stack) {
    message += `\nStack: ${error.stack}`;
  }
  
  return message;
}

/**
 * Wrap an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} errorType - Error type to use for failures
 * @param {Object} errorContext - Additional error context
 * @returns {Function} Wrapped function
 */
export function wrapAsync(fn, errorType = 'agent', errorContext = {}) {
  return async function wrapped(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      if (isAgentError(error)) {
        throw error;
      }
      
      throw createError(errorType, error.message || 'Operation failed', {
        ...errorContext,
        originalError: error
      });
    }
  };
}

/**
 * Create a retry wrapper for async operations
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Function} Function with retry logic
 */
export function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    backoffMs = 1000,
    exponential = true,
    shouldRetry = (error) => true
  } = options;
  
  return async function retryWrapper(...args) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries || !shouldRetry(error)) {
          throw error;
        }
        
        const delay = exponential 
          ? backoffMs * Math.pow(2, attempt - 1)
          : backoffMs;
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  };
}