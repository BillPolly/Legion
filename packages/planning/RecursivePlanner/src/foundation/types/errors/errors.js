/**
 * Custom error classes for the framework
 */

/**
 * Base error class for framework-specific errors
 */
export class FrameworkError extends Error {
  constructor(message, code = null, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when resource limits are exceeded
 */
export class ResourceExhaustedError extends FrameworkError {
  constructor(message, resourceType = null, currentUsage = null, limit = null) {
    super(message, 'RESOURCE_EXHAUSTED', {
      resourceType,
      currentUsage,
      limit
    });
  }
}

/**
 * Thrown when input validation fails
 */
export class ValidationError extends FrameworkError {
  constructor(message, field = null, value = null, errors = []) {
    super(message, 'VALIDATION_ERROR', {
      field,
      value,
      errors
    });
  }
}

/**
 * Thrown when a tool execution fails
 */
export class ToolExecutionError extends FrameworkError {
  constructor(message, toolName = null, input = null, originalError = null) {
    super(message, 'TOOL_EXECUTION_ERROR', {
      toolName,
      input,
      originalError: originalError ? originalError.message : null
    });
    
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * Thrown when planning fails
 */
export class PlanningError extends FrameworkError {
  constructor(message, goal = null, availableTools = [], context = null) {
    super(message, 'PLANNING_ERROR', {
      goal,
      availableTools: availableTools.map(tool => tool.name),
      context
    });
  }
}

/**
 * Thrown when agent goal is outside domain scope
 */
export class DomainMismatchError extends FrameworkError {
  constructor(message, domain = null, goal = null) {
    super(message, 'DOMAIN_MISMATCH', {
      domain,
      goal
    });
  }
}

/**
 * Thrown when security policy is violated
 */
export class SecurityError extends FrameworkError {
  constructor(message, policy = null, violation = null) {
    super(message, 'SECURITY_VIOLATION', {
      policy,
      violation
    });
  }
}

/**
 * Thrown when communication between agents fails
 */
export class CommunicationError extends FrameworkError {
  constructor(message, fromAgent = null, toAgent = null, messageType = null) {
    super(message, 'COMMUNICATION_ERROR', {
      fromAgent,
      toAgent,
      messageType
    });
  }
}

/**
 * Thrown when artifact operations fail
 */
export class ArtifactError extends FrameworkError {
  constructor(message, artifactKey = null, operation = null) {
    super(message, 'ARTIFACT_ERROR', {
      artifactKey,
      operation
    });
    
    // Also expose as direct properties for easier access
    this.artifactKey = artifactKey;
    this.operation = operation;
  }
}

/**
 * Thrown when tracing operations fail
 */
export class TracingError extends FrameworkError {
  constructor(message, spanId = null, operation = null) {
    super(message, 'TRACING_ERROR', {
      spanId,
      operation
    });
  }
}

/**
 * Thrown when configuration is invalid
 */
export class ConfigurationError extends FrameworkError {
  constructor(message, configSection = null, invalidValue = null) {
    super(message, 'CONFIGURATION_ERROR', {
      configSection,
      invalidValue
    });
  }
}