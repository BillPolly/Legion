import { Constraint } from './Constraint.js';

/**
 * Range Constraint for numeric values
 */
export class RangeConstraint extends Constraint {
  constructor(field, minValue = null, maxValue = null) {
    super('kg:RangeConstraint');
    
    // Handle both old and new constructor signatures
    if (arguments.length === 2) {
      // Old signature: constructor(minValue, maxValue)
      this.minValue = field;
      this.maxValue = minValue;
    } else {
      // New signature: constructor(field, minValue, maxValue)
      this.field = field;
      this.minValue = minValue;
      this.maxValue = maxValue;
    }
    
    // Validate range values
    if (this.minValue !== null && (typeof this.minValue !== 'number' || isNaN(this.minValue))) {
      throw new Error('Range values must be numbers');
    }
    if (this.maxValue !== null && (typeof this.maxValue !== 'number' || isNaN(this.maxValue))) {
      throw new Error('Range values must be numbers');
    }
    
    // Note: We allow min > max for testing edge cases - it will just result in no valid values
    // This is useful for testing constraint composition and edge case handling
  }

  evaluate(value) {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) return false;
    if (this.minValue !== null && value < this.minValue) return false;
    if (this.maxValue !== null && value > this.maxValue) return false;
    return true;
  }

  getErrorMessage(value) {
    if (this.minValue !== null && this.maxValue !== null) {
      return `Value ${value} is outside the allowed range [${this.minValue}, ${this.maxValue}]`;
    } else if (this.minValue !== null) {
      return `Value ${value} is below the minimum range value ${this.minValue}`;
    } else if (this.maxValue !== null) {
      return `Value ${value} is above the maximum range value ${this.maxValue}`;
    }
    return `Value ${value} violates range constraint`;
  }

  toTriples() {
    const triples = super.toTriples();
    const id = this.getId();
    
    if (this.minValue !== null) {
      triples.push([id, 'kg:minValue', this.minValue]);
    }
    if (this.maxValue !== null) {
      triples.push([id, 'kg:maxValue', this.maxValue]);
    }
    
    return triples;
  }
}

export default RangeConstraint;
