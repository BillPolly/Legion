/**
 * DomainError
 * Base class for all domain errors
 */

export class DomainError extends Error {
  constructor(message, code = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.timestamp = new Date();
  }
}

export class ValidationError extends DomainError {
  constructor(message, field = null) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class StateTransitionError extends DomainError {
  constructor(fromState, toState, message = null) {
    const msg = message || `Invalid state transition from ${fromState} to ${toState}`;
    super(msg, 'STATE_TRANSITION_ERROR');
    this.name = 'StateTransitionError';
    this.fromState = fromState;
    this.toState = toState;
  }
}

export class PlanningError extends DomainError {
  constructor(message, phase = null) {
    super(message, 'PLANNING_ERROR');
    this.name = 'PlanningError';
    this.phase = phase;
  }
}

export class ExecutionError extends DomainError {
  constructor(message, nodeId = null) {
    super(message, 'EXECUTION_ERROR');
    this.name = 'ExecutionError';
    this.nodeId = nodeId;
  }
}