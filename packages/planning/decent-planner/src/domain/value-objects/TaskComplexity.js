/**
 * TaskComplexity Value Object - Immutable representation of task complexity
 * Following Clean Architecture - pure domain logic with no external dependencies
 */

export class TaskComplexity {
  static SIMPLE = 'SIMPLE';
  static COMPLEX = 'COMPLEX';

  constructor(value) {
    this.value = this.validate(value);
    Object.freeze(this);
  }

  validate(value) {
    const upperValue = String(value).toUpperCase();
    if (upperValue !== TaskComplexity.SIMPLE && upperValue !== TaskComplexity.COMPLEX) {
      throw new Error(`Invalid task complexity: ${value}. Must be SIMPLE or COMPLEX`);
    }
    return upperValue;
  }

  isSimple() {
    return this.value === TaskComplexity.SIMPLE;
  }

  isComplex() {
    return this.value === TaskComplexity.COMPLEX;
  }

  equals(other) {
    if (!(other instanceof TaskComplexity)) {
      return false;
    }
    return this.value === other.value;
  }

  toString() {
    return this.value;
  }

  static simple() {
    return new TaskComplexity(TaskComplexity.SIMPLE);
  }

  static complex() {
    return new TaskComplexity(TaskComplexity.COMPLEX);
  }
}