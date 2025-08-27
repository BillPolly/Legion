/**
 * TaskStatus Value Object - Immutable representation of task status
 * Following Clean Architecture - pure domain logic with no external dependencies
 */

export class TaskStatus {
  static PENDING = 'PENDING';
  static IN_PROGRESS = 'IN_PROGRESS';
  static COMPLETED = 'COMPLETED';
  static FAILED = 'FAILED';
  static CANCELLED = 'CANCELLED';

  constructor(value) {
    this.value = this.validate(value);
    Object.freeze(this);
  }

  validate(value) {
    const upperValue = String(value).toUpperCase();
    const validStatuses = [
      TaskStatus.PENDING,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      TaskStatus.FAILED,
      TaskStatus.CANCELLED
    ];
    
    if (!validStatuses.includes(upperValue)) {
      throw new Error(`Invalid task status: ${value}. Must be one of: ${validStatuses.join(', ')}`);
    }
    return upperValue;
  }

  isPending() {
    return this.value === TaskStatus.PENDING;
  }

  isInProgress() {
    return this.value === TaskStatus.IN_PROGRESS;
  }

  isCompleted() {
    return this.value === TaskStatus.COMPLETED;
  }

  isFailed() {
    return this.value === TaskStatus.FAILED;
  }

  isCancelled() {
    return this.value === TaskStatus.CANCELLED;
  }

  isTerminal() {
    return this.isCompleted() || this.isFailed() || this.isCancelled();
  }

  canTransitionTo(newStatus) {
    if (!(newStatus instanceof TaskStatus)) {
      return false;
    }

    if (this.isTerminal()) {
      return false;
    }

    if (this.isPending()) {
      return newStatus.isInProgress() || newStatus.isCancelled();
    }

    if (this.isInProgress()) {
      return newStatus.isCompleted() || newStatus.isFailed() || newStatus.isCancelled();
    }

    return false;
  }

  equals(other) {
    if (!(other instanceof TaskStatus)) {
      return false;
    }
    return this.value === other.value;
  }

  toString() {
    return this.value;
  }

  static pending() {
    return new TaskStatus(TaskStatus.PENDING);
  }

  static inProgress() {
    return new TaskStatus(TaskStatus.IN_PROGRESS);
  }

  static completed() {
    return new TaskStatus(TaskStatus.COMPLETED);
  }

  static failed() {
    return new TaskStatus(TaskStatus.FAILED);
  }

  static cancelled() {
    return new TaskStatus(TaskStatus.CANCELLED);
  }
}