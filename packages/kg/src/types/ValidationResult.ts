/**
 * Validation result types for the Unified Capability Ontology
 */

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export class ValidationResultBuilder {
  private errors: ValidationError[] = [];

  public addError(field: string, message: string, code: string): this {
    this.errors.push({ field, message, code });
    return this;
  }

  public addFieldRequired(field: string): this {
    return this.addError(field, `${field} is required`, 'FIELD_REQUIRED');
  }

  public addInvalidValue(field: string, value: any, expectedType?: string): this {
    const message = expectedType 
      ? `${field} has invalid value '${value}', expected ${expectedType}`
      : `${field} has invalid value '${value}'`;
    return this.addError(field, message, 'INVALID_VALUE');
  }

  public addConstraintViolation(field: string, constraint: string): this {
    return this.addError(field, `${field} violates constraint: ${constraint}`, 'CONSTRAINT_VIOLATION');
  }

  public build(): ValidationResult {
    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors]
    };
  }

  public static success(): ValidationResult {
    return {
      isValid: true,
      errors: []
    };
  }

  public static failure(errors: ValidationError[]): ValidationResult {
    return {
      isValid: false,
      errors
    };
  }
}
