/**
 * Tests for Validation utilities
 * RED phase: Write failing tests first
 */

import { describe, test, expect } from '@jest/globals';
import { 
  validateParameter, 
  validateConfiguration, 
  validateHandle,
  ValidationError
} from '../../src/utils/Validation.js';

describe('Validation Utilities', () => {
  describe('validateParameter', () => {
    test('should pass validation for valid required parameter', () => {
      expect(() => validateParameter('test', 'value', { required: true, type: 'string' }))
        .not.toThrow();
    });

    test('should throw ValidationError for missing required parameter', () => {
      expect(() => validateParameter('test', undefined, { required: true, type: 'string' }))
        .toThrow(ValidationError);
      expect(() => validateParameter('test', undefined, { required: true, type: 'string' }))
        .toThrow('Required parameter "test" is missing');
    });

    test('should pass validation for missing optional parameter', () => {
      expect(() => validateParameter('test', undefined, { required: false, type: 'string' }))
        .not.toThrow();
    });

    test('should throw ValidationError for wrong type', () => {
      expect(() => validateParameter('test', 123, { required: true, type: 'string' }))
        .toThrow(ValidationError);
      expect(() => validateParameter('test', 123, { required: true, type: 'string' }))
        .toThrow('Parameter "test" must be of type string, got number');
    });

    test('should validate array type correctly', () => {
      expect(() => validateParameter('test', ['a', 'b'], { required: true, type: 'array' }))
        .not.toThrow();
      expect(() => validateParameter('test', 'not array', { required: true, type: 'array' }))
        .toThrow('Parameter "test" must be of type array, got string');
    });

    test('should validate object type correctly', () => {
      expect(() => validateParameter('test', { key: 'value' }, { required: true, type: 'object' }))
        .not.toThrow();
      expect(() => validateParameter('test', 'not object', { required: true, type: 'object' }))
        .toThrow('Parameter "test" must be of type object, got string');
    });
  });

  describe('validateConfiguration', () => {
    test('should validate configuration against schema', () => {
      const config = { 
        name: 'TestModule',
        port: 3000,
        enabled: true
      };
      const schema = {
        name: { required: true, type: 'string' },
        port: { required: true, type: 'number' },
        enabled: { required: false, type: 'boolean' }
      };
      
      expect(() => validateConfiguration(config, schema)).not.toThrow();
    });

    test('should throw ValidationError for invalid configuration', () => {
      const config = { 
        name: 123,  // Wrong type
        // port missing
      };
      const schema = {
        name: { required: true, type: 'string' },
        port: { required: true, type: 'number' }
      };
      
      expect(() => validateConfiguration(config, schema)).toThrow(ValidationError);
    });

    test('should apply default values for missing optional parameters', () => {
      const config = { 
        name: 'TestModule'
      };
      const schema = {
        name: { required: true, type: 'string' },
        port: { required: false, type: 'number', default: 3000 },
        enabled: { required: false, type: 'boolean', default: true }
      };
      
      const result = validateConfiguration(config, schema);
      expect(result).toEqual({
        name: 'TestModule',
        port: 3000,
        enabled: true
      });
    });
  });

  describe('validateHandle', () => {
    test('should pass validation for valid handle', () => {
      const handle = {
        _id: 'handle_123',
        _type: 'test_handle'
      };
      
      expect(() => validateHandle(handle, 'test_handle')).not.toThrow();
    });

    test('should throw ValidationError for invalid handle structure', () => {
      const invalidHandle = { id: 'no_underscore' };
      
      expect(() => validateHandle(invalidHandle, 'test_handle'))
        .toThrow(ValidationError);
      expect(() => validateHandle(invalidHandle, 'test_handle'))
        .toThrow('Invalid handle: missing _id or _type');
    });

    test('should throw ValidationError for wrong handle type', () => {
      const handle = {
        _id: 'handle_123',
        _type: 'wrong_type'
      };
      
      expect(() => validateHandle(handle, 'test_handle'))
        .toThrow(ValidationError);
      expect(() => validateHandle(handle, 'test_handle'))
        .toThrow('Invalid handle type: expected test_handle, got wrong_type');
    });

    test('should accept any type when expectedType is not specified', () => {
      const handle = {
        _id: 'handle_123',
        _type: 'any_type'
      };
      
      expect(() => validateHandle(handle)).not.toThrow();
    });
  });

  describe('ValidationError', () => {
    test('should be instance of Error', () => {
      const error = new ValidationError('Test validation error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
    });
  });
});