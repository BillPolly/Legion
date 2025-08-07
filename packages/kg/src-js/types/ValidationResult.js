/**
 * Validation result types for the Unified Capability Ontology
 * ES6 JavaScript version
 */

export class ValidationResultBuilder {
  constructor() {
    this.errors = [];
  }

  addError(field, message, code) {
    this.errors.push({ field, message, code });
    return this;
  }

  addFieldRequired(field) {
    return this.addError(field, `${field} is required`, 'FIELD_REQUIRED');
  }

  addInvalidValue(field, value, expectedType) {
    const message = expectedType 
      ? `${field} has invalid value '${value}', expected ${expectedType}`
      : `${field} has invalid value '${value}'`;
    return this.addError(field, message, 'INVALID_VALUE');
  }

  addConstraintViolation(field, constraint) {
    return this.addError(field, `${field} violates constraint: ${constraint}`, 'CONSTRAINT_VIOLATION');
  }

  build() {
    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors]
    };
  }

  static success() {
    return {
      isValid: true,
      errors: []
    };
  }

  static failure(errors) {
    return {
      isValid: false,
      errors
    };
  }
}