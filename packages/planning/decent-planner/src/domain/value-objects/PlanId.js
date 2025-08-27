/**
 * PlanId Value Object - Immutable unique identifier for plans
 * Following Clean Architecture - pure domain logic with no external dependencies
 */

export class PlanId {
  constructor(value) {
    this.value = this.validate(value);
    Object.freeze(this);
  }

  validate(value) {
    if (value === null || value === undefined) {
      return this.generateId();
    }
    
    const stringValue = String(value).trim();
    if (stringValue.length === 0) {
      throw new Error('PlanId cannot be empty');
    }
    
    return stringValue;
  }

  generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `plan-${timestamp}-${random}`;
  }

  equals(other) {
    if (!(other instanceof PlanId)) {
      return false;
    }
    return this.value === other.value;
  }

  toString() {
    return this.value;
  }

  static generate() {
    return new PlanId(null);
  }

  static from(value) {
    return new PlanId(value);
  }
}