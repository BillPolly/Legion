/**
 * DomainError - Base class for all domain errors
 * Following Clean Architecture - domain-specific error handling
 */

export class DomainError extends Error {
  constructor(message, code = 'DOMAIN_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

export class ValidationError extends DomainError {
  constructor(message, field = null, value = null) {
    super(message, 'VALIDATION_ERROR', { field, value });
  }
}

export class TaskError extends DomainError {
  constructor(message, taskId = null, taskDescription = null) {
    super(message, 'TASK_ERROR', { taskId, taskDescription });
  }
}

export class ComplexityError extends TaskError {
  constructor(message, taskId = null, complexity = null) {
    super(message, taskId);
    this.code = 'COMPLEXITY_ERROR';
    this.details.complexity = complexity;
  }
}

export class DecompositionError extends TaskError {
  constructor(message, taskId = null, depth = null) {
    super(message, taskId);
    this.code = 'DECOMPOSITION_ERROR';
    this.details.depth = depth;
  }
}

export class FeasibilityError extends TaskError {
  constructor(message, taskId = null, reason = null) {
    super(message, taskId);
    this.code = 'FEASIBILITY_ERROR';
    this.details.reason = reason;
  }
}

export class PlanError extends DomainError {
  constructor(message, planId = null, status = null) {
    super(message, 'PLAN_ERROR', { planId, status });
  }
}

export class InvalidStateTransitionError extends PlanError {
  constructor(fromStatus, toStatus, planId = null) {
    super(
      `Invalid state transition from ${fromStatus} to ${toStatus}`,
      planId,
      fromStatus
    );
    this.code = 'INVALID_STATE_TRANSITION';
    this.details.fromStatus = fromStatus;
    this.details.toStatus = toStatus;
  }
}

export class HierarchyError extends DomainError {
  constructor(message, errors = [], warnings = []) {
    super(message, 'HIERARCHY_ERROR', { errors, warnings });
  }
}

export class ToolDiscoveryError extends DomainError {
  constructor(message, taskDescription = null, toolsFound = 0) {
    super(message, 'TOOL_DISCOVERY_ERROR', { taskDescription, toolsFound });
  }
}

export class BehaviorTreeError extends DomainError {
  constructor(message, treeId = null, validationErrors = []) {
    super(message, 'BEHAVIOR_TREE_ERROR', { treeId, validationErrors });
  }
}