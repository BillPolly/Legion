/**
 * Error classes for plan validation
 */

/**
 * Base error class for validation errors
 */
export class ValidationError extends Error {
  constructor(message, field = null, value = null, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.errors = errors;
    this.timestamp = Date.now();
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error for invalid plan structure
 */
export class PlanStructureError extends ValidationError {
  constructor(message, stepId = null, details = {}) {
    super(message, 'plan', null, []);
    this.name = 'PlanStructureError';
    this.stepId = stepId;
    this.details = details;
  }
}

/**
 * Error for tool not found
 */
export class ToolNotFoundError extends ValidationError {
  constructor(toolName, availableTools = []) {
    super(`Tool '${toolName}' is not available`, 'tool', toolName);
    this.name = 'ToolNotFoundError';
    this.toolName = toolName;
    this.availableTools = availableTools;
  }
}

/**
 * Error for artifact not found
 */
export class ArtifactNotFoundError extends ValidationError {
  constructor(artifactName, stepId = null, availableArtifacts = []) {
    super(`Artifact '@${artifactName}' has not been created yet`, 'artifact', artifactName);
    this.name = 'ArtifactNotFoundError';
    this.artifactName = artifactName;
    this.stepId = stepId;
    this.availableArtifacts = availableArtifacts;
  }
}

/**
 * Error for circular dependencies
 */
export class CircularDependencyError extends ValidationError {
  constructor(cyclePath, stepId = null) {
    super(`Circular dependency detected: ${cyclePath.join(' -> ')}`, 'dependencies', cyclePath);
    this.name = 'CircularDependencyError';
    this.cyclePath = cyclePath;
    this.stepId = stepId;
  }
}