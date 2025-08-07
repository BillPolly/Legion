/**
 * Unit tests for ValidationResultBuilder
 * ES6 JavaScript version
 */

import { ValidationResultBuilder } from '../src-js/types/ValidationResult.js';

describe('ValidationResultBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new ValidationResultBuilder();
  });

  describe('addError', () => {
    it('should add an error with all fields', () => {
      builder.addError('email', 'Invalid email format', 'INVALID_FORMAT');
      const result = builder.build();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_FORMAT'
      });
    });

    it('should support method chaining', () => {
      const result = builder
        .addError('field1', 'message1', 'code1')
        .addError('field2', 'message2', 'code2')
        .build();

      expect(result.errors).toHaveLength(2);
    });

    it('should add multiple errors', () => {
      builder.addError('field1', 'message1', 'code1');
      builder.addError('field2', 'message2', 'code2');
      builder.addError('field3', 'message3', 'code3');
      
      const result = builder.build();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('addFieldRequired', () => {
    it('should add field required error', () => {
      builder.addFieldRequired('username');
      const result = builder.build();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'username',
        message: 'username is required',
        code: 'FIELD_REQUIRED'
      });
    });

    it('should support chaining', () => {
      const result = builder
        .addFieldRequired('field1')
        .addFieldRequired('field2')
        .build();

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('FIELD_REQUIRED');
      expect(result.errors[1].code).toBe('FIELD_REQUIRED');
    });
  });

  describe('addInvalidValue', () => {
    it('should add invalid value error without expected type', () => {
      builder.addInvalidValue('age', 'abc');
      const result = builder.build();

      expect(result.errors[0]).toEqual({
        field: 'age',
        message: "age has invalid value 'abc'",
        code: 'INVALID_VALUE'
      });
    });

    it('should add invalid value error with expected type', () => {
      builder.addInvalidValue('age', 'abc', 'number');
      const result = builder.build();

      expect(result.errors[0]).toEqual({
        field: 'age',
        message: "age has invalid value 'abc', expected number",
        code: 'INVALID_VALUE'
      });
    });

    it('should handle null and undefined values', () => {
      builder.addInvalidValue('field1', null, 'string');
      builder.addInvalidValue('field2', undefined, 'number');
      const result = builder.build();

      expect(result.errors[0].message).toContain('null');
      expect(result.errors[1].message).toContain('undefined');
    });
  });

  describe('addConstraintViolation', () => {
    it('should add constraint violation error', () => {
      builder.addConstraintViolation('password', 'must be at least 8 characters');
      const result = builder.build();

      expect(result.errors[0]).toEqual({
        field: 'password',
        message: 'password violates constraint: must be at least 8 characters',
        code: 'CONSTRAINT_VIOLATION'
      });
    });

    it('should handle multiple constraint violations', () => {
      builder
        .addConstraintViolation('password', 'too short')
        .addConstraintViolation('password', 'no uppercase letters')
        .addConstraintViolation('password', 'no special characters');
      
      const result = builder.build();
      expect(result.errors).toHaveLength(3);
      expect(result.errors.every(e => e.code === 'CONSTRAINT_VIOLATION')).toBe(true);
    });
  });

  describe('build', () => {
    it('should return valid result when no errors', () => {
      const result = builder.build();

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return invalid result when errors exist', () => {
      builder.addError('field', 'message', 'code');
      const result = builder.build();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should create a copy of errors array', () => {
      builder.addError('field', 'message', 'code');
      const result1 = builder.build();
      const result2 = builder.build();

      expect(result1.errors).not.toBe(result2.errors);
      expect(result1.errors).toEqual(result2.errors);
    });
  });

  describe('static methods', () => {
    describe('success', () => {
      it('should create a successful validation result', () => {
        const result = ValidationResultBuilder.success();

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    describe('failure', () => {
      it('should create a failed validation result with errors', () => {
        const errors = [
          { field: 'field1', message: 'message1', code: 'code1' },
          { field: 'field2', message: 'message2', code: 'code2' }
        ];

        const result = ValidationResultBuilder.failure(errors);

        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(errors);
      });

      it('should handle empty error array', () => {
        const result = ValidationResultBuilder.failure([]);

        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual([]);
      });
    });
  });

  describe('complex validation scenarios', () => {
    it('should handle mixed error types', () => {
      const result = builder
        .addFieldRequired('username')
        .addInvalidValue('email', 'not-an-email', 'email format')
        .addConstraintViolation('password', 'too weak')
        .addError('custom', 'custom error', 'CUSTOM_ERROR')
        .build();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.errors.map(e => e.code)).toEqual([
        'FIELD_REQUIRED',
        'INVALID_VALUE',
        'CONSTRAINT_VIOLATION',
        'CUSTOM_ERROR'
      ]);
    });

    it('should handle validation of nested objects', () => {
      builder
        .addFieldRequired('user.profile.name')
        .addInvalidValue('user.profile.age', -5, 'positive number')
        .addConstraintViolation('user.settings.theme', 'must be light or dark');

      const result = builder.build();

      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].field).toBe('user.profile.name');
      expect(result.errors[1].field).toBe('user.profile.age');
      expect(result.errors[2].field).toBe('user.settings.theme');
    });

    it('should accumulate errors across multiple validations', () => {
      // First validation pass
      if (!('username' in {})) {
        builder.addFieldRequired('username');
      }
      
      // Second validation pass
      if (!('email' in {})) {
        builder.addFieldRequired('email');
      }
      
      // Third validation pass
      const password = '123';
      if (password.length < 8) {
        builder.addConstraintViolation('password', 'minimum 8 characters');
      }

      const result = builder.build();
      expect(result.errors).toHaveLength(3);
    });
  });
});