/**
 * Legion Validators - Input validation utilities
 * 
 * This package provides comprehensive validation utilities
 * for the Legion framework.
 */

export class Validator {
  constructor(rules = {}) {
    this.rules = rules;
    this.errors = [];
  }

  // Placeholder validation method
  validate(input) {
    this.errors = [];
    
    if (typeof input === 'undefined' || input === null) {
      this.errors.push('Input is required');
      return false;
    }

    return true;
  }

  getErrors() {
    return this.errors;
  }

  isValid() {
    return this.errors.length === 0;
  }
}

export class StringValidator extends Validator {
  constructor(options = {}) {
    super();
    this.minLength = options.minLength || 0;
    this.maxLength = options.maxLength || Infinity;
    this.pattern = options.pattern;
  }

  validate(input) {
    super.validate(input);

    if (typeof input !== 'string') {
      this.errors.push('Input must be a string');
      return false;
    }

    if (input.length < this.minLength) {
      this.errors.push(`Input must be at least ${this.minLength} characters`);
    }

    if (input.length > this.maxLength) {
      this.errors.push(`Input must not exceed ${this.maxLength} characters`);
    }

    if (this.pattern && !this.pattern.test(input)) {
      this.errors.push('Input does not match required pattern');
    }

    return this.isValid();
  }
}

export class NumberValidator extends Validator {
  constructor(options = {}) {
    super();
    this.min = options.min;
    this.max = options.max;
    this.integer = options.integer || false;
  }

  validate(input) {
    super.validate(input);

    const num = Number(input);
    if (isNaN(num)) {
      this.errors.push('Input must be a valid number');
      return false;
    }

    if (this.integer && !Number.isInteger(num)) {
      this.errors.push('Input must be an integer');
    }

    if (this.min !== undefined && num < this.min) {
      this.errors.push(`Input must be at least ${this.min}`);
    }

    if (this.max !== undefined && num > this.max) {
      this.errors.push(`Input must not exceed ${this.max}`);
    }

    return this.isValid();
  }
}

export default {
  Validator,
  StringValidator,
  NumberValidator
};