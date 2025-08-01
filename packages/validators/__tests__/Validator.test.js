/**
 * Tests for Validator classes
 */

import { Validator, StringValidator, NumberValidator } from '../src/index.js';

describe('Validator', () => {
  test('should create a validator instance', () => {
    const validator = new Validator();
    expect(validator).toBeInstanceOf(Validator);
    expect(validator.errors).toEqual([]);
  });

  test('should validate non-null input', () => {
    const validator = new Validator();
    expect(validator.validate('test')).toBe(true);
    expect(validator.isValid()).toBe(true);
  });

  test('should reject null/undefined input', () => {
    const validator = new Validator();
    expect(validator.validate(null)).toBe(false);
    expect(validator.validate(undefined)).toBe(false);
    expect(validator.getErrors()).toContain('Input is required');
  });
});

describe('StringValidator', () => {
  test('should validate string input', () => {
    const validator = new StringValidator();
    expect(validator.validate('hello')).toBe(true);
  });

  test('should reject non-string input', () => {
    const validator = new StringValidator();
    expect(validator.validate(123)).toBe(false);
    expect(validator.getErrors()).toContain('Input must be a string');
  });

  test('should validate minimum length', () => {
    const validator = new StringValidator({ minLength: 5 });
    expect(validator.validate('hello')).toBe(true);
    expect(validator.validate('hi')).toBe(false);
    expect(validator.getErrors()).toContain('Input must be at least 5 characters');
  });

  test('should validate maximum length', () => {
    const validator = new StringValidator({ maxLength: 5 });
    expect(validator.validate('hello')).toBe(true);
    expect(validator.validate('hello world')).toBe(false);
    expect(validator.getErrors()).toContain('Input must not exceed 5 characters');
  });

  test('should validate pattern', () => {
    const validator = new StringValidator({ pattern: /^[a-z]+$/ });
    expect(validator.validate('hello')).toBe(true);
    expect(validator.validate('Hello')).toBe(false);
    expect(validator.getErrors()).toContain('Input does not match required pattern');
  });
});

describe('NumberValidator', () => {
  test('should validate number input', () => {
    const validator = new NumberValidator();
    expect(validator.validate(42)).toBe(true);
    expect(validator.validate('42')).toBe(true);
  });

  test('should reject non-number input', () => {
    const validator = new NumberValidator();
    expect(validator.validate('hello')).toBe(false);
    expect(validator.getErrors()).toContain('Input must be a valid number');
  });

  test('should validate integer requirement', () => {
    const validator = new NumberValidator({ integer: true });
    expect(validator.validate(42)).toBe(true);
    expect(validator.validate(42.5)).toBe(false);
    expect(validator.getErrors()).toContain('Input must be an integer');
  });

  test('should validate minimum value', () => {
    const validator = new NumberValidator({ min: 10 });
    expect(validator.validate(15)).toBe(true);
    expect(validator.validate(5)).toBe(false);
    expect(validator.getErrors()).toContain('Input must be at least 10');
  });

  test('should validate maximum value', () => {
    const validator = new NumberValidator({ max: 100 });
    expect(validator.validate(50)).toBe(true);
    expect(validator.validate(150)).toBe(false);
    expect(validator.getErrors()).toContain('Input must not exceed 100');
  });
});