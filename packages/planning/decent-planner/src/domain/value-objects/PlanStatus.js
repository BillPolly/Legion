/**
 * PlanStatus Value Object - Immutable representation of plan status
 * Following Clean Architecture - pure domain logic with no external dependencies
 */

export class PlanStatus {
  static DRAFT = 'DRAFT';
  static VALIDATED = 'VALIDATED';
  static READY = 'READY';
  static EXECUTING = 'EXECUTING';
  static COMPLETED = 'COMPLETED';
  static FAILED = 'FAILED';

  constructor(value) {
    this.value = this.validate(value);
    Object.freeze(this);
  }

  validate(value) {
    const upperValue = String(value).toUpperCase();
    const validStatuses = [
      PlanStatus.DRAFT,
      PlanStatus.VALIDATED,
      PlanStatus.READY,
      PlanStatus.EXECUTING,
      PlanStatus.COMPLETED,
      PlanStatus.FAILED
    ];
    
    if (!validStatuses.includes(upperValue)) {
      throw new Error(`Invalid plan status: ${value}. Must be one of: ${validStatuses.join(', ')}`);
    }
    return upperValue;
  }

  isDraft() {
    return this.value === PlanStatus.DRAFT;
  }

  isValidated() {
    return this.value === PlanStatus.VALIDATED;
  }

  isReady() {
    return this.value === PlanStatus.READY;
  }

  isExecuting() {
    return this.value === PlanStatus.EXECUTING;
  }

  isCompleted() {
    return this.value === PlanStatus.COMPLETED;
  }

  isFailed() {
    return this.value === PlanStatus.FAILED;
  }

  isTerminal() {
    return this.isCompleted() || this.isFailed();
  }

  canTransitionTo(newStatus) {
    if (!(newStatus instanceof PlanStatus)) {
      return false;
    }

    if (this.isTerminal()) {
      return false;
    }

    const transitions = {
      [PlanStatus.DRAFT]: [PlanStatus.VALIDATED, PlanStatus.FAILED],
      [PlanStatus.VALIDATED]: [PlanStatus.READY, PlanStatus.FAILED],
      [PlanStatus.READY]: [PlanStatus.EXECUTING, PlanStatus.FAILED],
      [PlanStatus.EXECUTING]: [PlanStatus.COMPLETED, PlanStatus.FAILED]
    };

    const allowedTransitions = transitions[this.value] || [];
    return allowedTransitions.includes(newStatus.value);
  }

  equals(other) {
    if (!(other instanceof PlanStatus)) {
      return false;
    }
    return this.value === other.value;
  }

  toString() {
    return this.value;
  }

  static draft() {
    return new PlanStatus(PlanStatus.DRAFT);
  }

  static validated() {
    return new PlanStatus(PlanStatus.VALIDATED);
  }

  static ready() {
    return new PlanStatus(PlanStatus.READY);
  }

  static executing() {
    return new PlanStatus(PlanStatus.EXECUTING);
  }

  static completed() {
    return new PlanStatus(PlanStatus.COMPLETED);
  }

  static failed() {
    return new PlanStatus(PlanStatus.FAILED);
  }
}