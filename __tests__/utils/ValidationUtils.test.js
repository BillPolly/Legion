import { describe, it, expect, beforeEach } from '@jest/globals';
import { ValidationUtils } from '../../src/utils/ValidationUtils.js';

describe('ValidationUtils', () => {
  let validationUtils;

  beforeEach(() => {
    validationUtils = new ValidationUtils();
  });

  describe('validateRequired', () => {
    it('should not throw when all required fields are present', () => {
      const data = { name: 'test', age: 25 };
      const required = ['name', 'age'];
      
      expect(() => validationUtils.validateRequired(data, required)).not.toThrow();
    });

    it('should throw for missing required fields', () => {
      const data = { name: 'test' };
      const required = ['name', 'age', 'email'];
      
      expect(() => validationUtils.validateRequired(data, required))
        .toThrow('Missing required parameters: age, email');
    });

    it('should throw for empty data', () => {
      const data = {};
      const required = ['field1', 'field2'];
      
      expect(() => validationUtils.validateRequired(data, required))
        .toThrow('Missing required parameters: field1, field2');
    });

    it('should not throw for no required fields', () => {
      const data = { anything: 'value' };
      const required = [];
      
      expect(() => validationUtils.validateRequired(data, required)).not.toThrow();
    });

    it('should check key existence not value', () => {
      const data = { name: '', age: null, zero: 0 };
      const required = ['name', 'age', 'zero'];
      
      expect(() => validationUtils.validateRequired(data, required)).not.toThrow();
    });
  });

  describe('validateTypes', () => {
    it('should validate correct types', () => {
      const args = { name: 'test', count: 5, enabled: true };
      const schema = {
        properties: {
          name: { type: 'string' },
          count: { type: 'number' },
          enabled: { type: 'boolean' }
        }
      };
      
      const result = validationUtils.validateTypes(args, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect type mismatches', () => {
      const args = { name: 123, count: 'five' };
      const schema = {
        properties: {
          name: { type: 'string' },
          count: { type: 'number' }
        }
      };
      
      const result = validationUtils.validateTypes(args, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should validate enum values', () => {
      const args = { size: 'medium' };
      const schema = {
        properties: {
          size: { type: 'string', enum: ['small', 'medium', 'large'] }
        }
      };
      
      const result = validationUtils.validateTypes(args, schema);
      expect(result.valid).toBe(true);
    });

    it('should fail invalid enum values', () => {
      const args = { size: 'xlarge' };
      const schema = {
        properties: {
          size: { type: 'string', enum: ['small', 'medium', 'large'] }
        }
      };
      
      const result = validationUtils.validateTypes(args, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be one of');
    });

    it('should validate number ranges', () => {
      const args = { age: 25 };
      const schema = {
        properties: {
          age: { type: 'number', minimum: 0, maximum: 120 }
        }
      };
      
      const result = validationUtils.validateTypes(args, schema);
      expect(result.valid).toBe(true);
    });

    it('should fail numbers outside range', () => {
      const args = { age: -5 };
      const schema = {
        properties: {
          age: { type: 'number', minimum: 0 }
        }
      };
      
      const result = validationUtils.validateTypes(args, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be >= 0');
    });

    it('should validate string patterns', () => {
      const args = { email: 'test@example.com' };
      const schema = {
        properties: {
          email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' }
        }
      };
      
      const result = validationUtils.validateTypes(args, schema);
      expect(result.valid).toBe(true);
    });

    it('should fail invalid patterns', () => {
      const args = { email: 'invalid-email' };
      const schema = {
        properties: {
          email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' }
        }
      };
      
      const result = validationUtils.validateTypes(args, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must match pattern');
    });

    it('should handle empty schema', () => {
      const result = validationUtils.validateTypes({ any: 'value' }, {});
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect array type', () => {
      const args = { items: [1, 2, 3] };
      const schema = {
        properties: {
          items: { type: 'array' }
        }
      };
      
      const result = validationUtils.validateTypes(args, schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('convertType', () => {
    it('should convert to number', () => {
      expect(validationUtils.convertType('123', 'number')).toBe(123);
      expect(validationUtils.convertType('12.5', 'number')).toBe(12.5);
    });

    it('should convert to boolean', () => {
      expect(validationUtils.convertType('true', 'boolean')).toBe(true);
      expect(validationUtils.convertType('false', 'boolean')).toBe(false);
      expect(validationUtils.convertType('1', 'boolean')).toBe(true);
      expect(validationUtils.convertType('0', 'boolean')).toBe(false);
    });

    it('should parse JSON for object type', () => {
      const result = validationUtils.convertType('{"key": "value"}', 'object');
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse JSON for array type', () => {
      const result = validationUtils.convertType('[1, 2, 3]', 'array');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return value unchanged for unknown type', () => {
      expect(validationUtils.convertType('value', 'unknown')).toBe('value');
    });
  });

  describe('toNumber', () => {
    it('should convert string to number', () => {
      expect(validationUtils.toNumber('42')).toBe(42);
      expect(validationUtils.toNumber('-3.14')).toBe(-3.14);
    });

    it('should return number unchanged', () => {
      expect(validationUtils.toNumber(42)).toBe(42);
    });

    it('should throw for invalid number', () => {
      expect(() => validationUtils.toNumber('abc')).toThrow('Cannot convert');
    });
  });

  describe('toBoolean', () => {
    it('should convert string values', () => {
      expect(validationUtils.toBoolean('true')).toBe(true);
      expect(validationUtils.toBoolean('TRUE')).toBe(true);
      expect(validationUtils.toBoolean('yes')).toBe(true);
      expect(validationUtils.toBoolean('on')).toBe(true);
      expect(validationUtils.toBoolean('1')).toBe(true);
      
      expect(validationUtils.toBoolean('false')).toBe(false);
      expect(validationUtils.toBoolean('FALSE')).toBe(false);
      expect(validationUtils.toBoolean('no')).toBe(false);
      expect(validationUtils.toBoolean('off')).toBe(false);
      expect(validationUtils.toBoolean('0')).toBe(false);
    });

    it('should return boolean unchanged', () => {
      expect(validationUtils.toBoolean(true)).toBe(true);
      expect(validationUtils.toBoolean(false)).toBe(false);
    });

    it('should use Boolean() for other values', () => {
      expect(validationUtils.toBoolean('other')).toBe(true);
      expect(validationUtils.toBoolean('')).toBe(false);
    });
  });

  describe('toArray', () => {
    it('should return array unchanged', () => {
      expect(validationUtils.toArray([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should parse JSON array', () => {
      expect(validationUtils.toArray('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('should split comma-separated string', () => {
      expect(validationUtils.toArray('a, b, c')).toEqual(['a', 'b', 'c']);
    });

    it('should wrap non-array values', () => {
      expect(validationUtils.toArray(42)).toEqual([42]);
      expect(validationUtils.toArray('single')).toEqual(['single']);
    });
  });

  describe('toObject', () => {
    it('should return object unchanged', () => {
      const obj = { key: 'value' };
      expect(validationUtils.toObject(obj)).toBe(obj);
    });

    it('should parse JSON object', () => {
      expect(validationUtils.toObject('{"key": "value"}')).toEqual({ key: 'value' });
    });

    it('should throw for invalid JSON', () => {
      expect(() => validationUtils.toObject('invalid')).toThrow('Cannot parse');
    });

    it('should wrap non-object values', () => {
      expect(validationUtils.toObject(42)).toEqual({ value: 42 });
    });

    it('should handle null', () => {
      expect(validationUtils.toObject(null)).toEqual({ value: null });
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(validationUtils.isValidEmail('user@example.com')).toBe(true);
      expect(validationUtils.isValidEmail('test.user@domain.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validationUtils.isValidEmail('invalid')).toBe(false);
      expect(validationUtils.isValidEmail('@example.com')).toBe(false);
      expect(validationUtils.isValidEmail('user@')).toBe(false);
      expect(validationUtils.isValidEmail('user @example.com')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(validationUtils.isValidUrl('https://example.com')).toBe(true);
      expect(validationUtils.isValidUrl('http://localhost:3000')).toBe(true);
      expect(validationUtils.isValidUrl('ftp://files.com/path')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validationUtils.isValidUrl('not a url')).toBe(false);
      expect(validationUtils.isValidUrl('example.com')).toBe(false);
      expect(validationUtils.isValidUrl('')).toBe(false);
    });
  });

  describe('isValidPath', () => {
    it('should validate normal paths', () => {
      expect(validationUtils.isValidPath('/home/user/file.txt')).toBe(true);
      expect(validationUtils.isValidPath('C:\\Users\\file.txt')).toBe(true);
      expect(validationUtils.isValidPath('./relative/path')).toBe(true);
    });

    it('should reject invalid paths', () => {
      expect(validationUtils.isValidPath('')).toBe(false);
      expect(validationUtils.isValidPath('path\0with\0nulls')).toBe(false);
      expect(validationUtils.isValidPath(null)).toBe(false);
      expect(validationUtils.isValidPath(123)).toBe(false);
    });
  });
});