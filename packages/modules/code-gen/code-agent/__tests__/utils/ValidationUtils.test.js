/**
 * Tests for ValidationUtils - Input validation and data sanitization
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ValidationUtils } from '../../src/utils/ValidationUtils.js';

describe('ValidationUtils', () => {
  let validator;

  beforeEach(() => {
    validator = new ValidationUtils();
  });

  describe('Constructor', () => {
    test('should create ValidationUtils with default configuration', () => {
      expect(validator).toBeDefined();
      expect(validator.rules).toBeDefined();
      expect(validator.sanitizers).toBeDefined();
    });

    test('should create with custom rules', () => {
      const customRules = {
        'custom-rule': (value) => value !== null
      };

      const customValidator = new ValidationUtils({ customRules });
      expect(customValidator.rules).toEqual(expect.objectContaining(customRules));
    });
  });

  describe('Basic Type Validation', () => {
    test('should validate strings', () => {
      expect(validator.isString('hello')).toBe(true);
      expect(validator.isString('')).toBe(true);
      expect(validator.isString(123)).toBe(false);
      expect(validator.isString(null)).toBe(false);
      expect(validator.isString(undefined)).toBe(false);
    });

    test('should validate numbers', () => {
      expect(validator.isNumber(123)).toBe(true);
      expect(validator.isNumber(0)).toBe(true);
      expect(validator.isNumber(-456)).toBe(true);
      expect(validator.isNumber(3.14)).toBe(true);
      expect(validator.isNumber('123')).toBe(false);
      expect(validator.isNumber(NaN)).toBe(false);
    });

    test('should validate integers', () => {
      expect(validator.isInteger(123)).toBe(true);
      expect(validator.isInteger(0)).toBe(true);
      expect(validator.isInteger(-456)).toBe(true);
      expect(validator.isInteger(3.14)).toBe(false);
      expect(validator.isInteger('123')).toBe(false);
    });

    test('should validate booleans', () => {
      expect(validator.isBoolean(true)).toBe(true);
      expect(validator.isBoolean(false)).toBe(true);
      expect(validator.isBoolean(1)).toBe(false);
      expect(validator.isBoolean('true')).toBe(false);
      expect(validator.isBoolean(null)).toBe(false);
    });

    test('should validate arrays', () => {
      expect(validator.isArray([])).toBe(true);
      expect(validator.isArray([1, 2, 3])).toBe(true);
      expect(validator.isArray('array')).toBe(false);
      expect(validator.isArray({})).toBe(false);
      expect(validator.isArray(null)).toBe(false);
    });

    test('should validate objects', () => {
      expect(validator.isObject({})).toBe(true);
      expect(validator.isObject({ key: 'value' })).toBe(true);
      expect(validator.isObject([])).toBe(false);
      expect(validator.isObject(null)).toBe(false);
      expect(validator.isObject('object')).toBe(false);
    });
  });

  describe('String Validation', () => {
    test('should validate non-empty strings', () => {
      expect(validator.isNonEmptyString('hello')).toBe(true);
      expect(validator.isNonEmptyString('a')).toBe(true);
      expect(validator.isNonEmptyString('')).toBe(false);
      expect(validator.isNonEmptyString('   ')).toBe(false);
      expect(validator.isNonEmptyString(null)).toBe(false);
    });

    test('should validate string length', () => {
      expect(validator.hasValidLength('hello', 1, 10)).toBe(true);
      expect(validator.hasValidLength('hello', 5, 5)).toBe(true);
      expect(validator.hasValidLength('hello', 6, 10)).toBe(false);
      expect(validator.hasValidLength('hello', 1, 4)).toBe(false);
    });

    test('should validate alphanumeric strings', () => {
      expect(validator.isAlphanumeric('hello123')).toBe(true);
      expect(validator.isAlphanumeric('ABC')).toBe(true);
      expect(validator.isAlphanumeric('123')).toBe(true);
      expect(validator.isAlphanumeric('hello-world')).toBe(false);
      expect(validator.isAlphanumeric('hello world')).toBe(false);
      expect(validator.isAlphanumeric('')).toBe(false);
    });

    test('should validate identifiers', () => {
      expect(validator.isValidIdentifier('variableName')).toBe(true);
      expect(validator.isValidIdentifier('_private')).toBe(true);
      expect(validator.isValidIdentifier('$jquery')).toBe(true);
      expect(validator.isValidIdentifier('var123')).toBe(true);
      expect(validator.isValidIdentifier('123var')).toBe(false);
      expect(validator.isValidIdentifier('var-name')).toBe(false);
      expect(validator.isValidIdentifier('var name')).toBe(false);
      expect(validator.isValidIdentifier('')).toBe(false);
    });

    test('should validate email addresses', () => {
      expect(validator.isValidEmail('test@example.com')).toBe(true);
      expect(validator.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(validator.isValidEmail('invalid.email')).toBe(false);
      expect(validator.isValidEmail('@domain.com')).toBe(false);
      expect(validator.isValidEmail('user@')).toBe(false);
      expect(validator.isValidEmail('')).toBe(false);
    });
  });

  describe('File Path Validation', () => {
    test('should validate file paths', () => {
      expect(validator.isValidFilePath('./src/index.js')).toBe(true);
      expect(validator.isValidFilePath('/absolute/path/file.js')).toBe(true);
      expect(validator.isValidFilePath('relative/path/file.js')).toBe(true);
      expect(validator.isValidFilePath('file.js')).toBe(true);
      expect(validator.isValidFilePath('')).toBe(false);
      expect(validator.isValidFilePath(null)).toBe(false);
    });

    test('should validate file extensions', () => {
      expect(validator.hasValidExtension('file.js', ['.js', '.ts'])).toBe(true);
      expect(validator.hasValidExtension('file.ts', ['.js', '.ts'])).toBe(true);
      expect(validator.hasValidExtension('file.py', ['.js', '.ts'])).toBe(false);
      expect(validator.hasValidExtension('file', ['.js', '.ts'])).toBe(false);
    });

    test('should validate directory names', () => {
      expect(validator.isValidDirectoryName('src')).toBe(true);
      expect(validator.isValidDirectoryName('my-folder')).toBe(true);
      expect(validator.isValidDirectoryName('folder_name')).toBe(true);
      expect(validator.isValidDirectoryName('123folder')).toBe(true);
      expect(validator.isValidDirectoryName('folder name')).toBe(false);
      expect(validator.isValidDirectoryName('folder/name')).toBe(false);
      expect(validator.isValidDirectoryName('')).toBe(false);
    });

    test('should validate safe paths', () => {
      expect(validator.isSafePath('./src/index.js')).toBe(true);
      expect(validator.isSafePath('src/index.js')).toBe(true);
      expect(validator.isSafePath('../../../etc/passwd')).toBe(false);
      expect(validator.isSafePath('/etc/passwd')).toBe(false);
      expect(validator.isSafePath('src/../../../sensitive')).toBe(false);
    });
  });

  describe('Project Configuration Validation', () => {
    test('should validate project types', () => {
      expect(validator.isValidProjectType('frontend')).toBe(true);
      expect(validator.isValidProjectType('backend')).toBe(true);
      expect(validator.isValidProjectType('fullstack')).toBe(true);
      expect(validator.isValidProjectType('invalid')).toBe(false);
      expect(validator.isValidProjectType('')).toBe(false);
      expect(validator.isValidProjectType(null)).toBe(false);
    });

    test('should validate project names', () => {
      expect(validator.isValidProjectName('my-project')).toBe(true);
      expect(validator.isValidProjectName('project_name')).toBe(true);
      expect(validator.isValidProjectName('project123')).toBe(true);
      expect(validator.isValidProjectName('project name')).toBe(false);
      expect(validator.isValidProjectName('project/name')).toBe(false);
      expect(validator.isValidProjectName('')).toBe(false);
    });

    test('should validate task configurations', () => {
      const validTask = {
        name: 'generate-component',
        type: 'generate',
        target: 'frontend',
        files: ['component.js', 'component.css']
      };

      const invalidTask = {
        name: '',
        type: 'invalid-type'
      };

      expect(validator.isValidTaskConfig(validTask)).toBe(true);
      expect(validator.isValidTaskConfig(invalidTask)).toBe(false);
      expect(validator.isValidTaskConfig(null)).toBe(false);
    });
  });

  describe('Code Generation Validation', () => {
    test('should validate code templates', () => {
      const validTemplate = {
        name: 'component-template',
        language: 'javascript',
        content: 'const Component = () => {};',
        placeholders: ['{{name}}', '{{props}}']
      };

      const invalidTemplate = {
        name: '',
        language: 'invalid',
        content: null
      };

      expect(validator.isValidCodeTemplate(validTemplate)).toBe(true);
      expect(validator.isValidCodeTemplate(invalidTemplate)).toBe(false);
    });

    test('should validate variable names', () => {
      expect(validator.isValidVariableName('myVariable')).toBe(true);
      expect(validator.isValidVariableName('_private')).toBe(true);
      expect(validator.isValidVariableName('$special')).toBe(true);
      expect(validator.isValidVariableName('var123')).toBe(true);
      expect(validator.isValidVariableName('123var')).toBe(false);
      expect(validator.isValidVariableName('var-name')).toBe(false);
      expect(validator.isValidVariableName('class')).toBe(false); // Reserved word
    });

    test('should validate function names', () => {
      expect(validator.isValidFunctionName('myFunction')).toBe(true);
      expect(validator.isValidFunctionName('handleClick')).toBe(true);
      expect(validator.isValidFunctionName('onClick')).toBe(true);
      expect(validator.isValidFunctionName('123function')).toBe(false);
      expect(validator.isValidFunctionName('function')).toBe(false); // Reserved word
    });

    test('should validate class names', () => {
      expect(validator.isValidClassName('MyClass')).toBe(true);
      expect(validator.isValidClassName('ComponentName')).toBe(true);
      expect(validator.isValidClassName('myclass')).toBe(false); // Should start with uppercase
      expect(validator.isValidClassName('123Class')).toBe(false);
      expect(validator.isValidClassName('Class Name')).toBe(false);
    });
  });

  describe('Data Sanitization', () => {
    test('should sanitize strings', () => {
      expect(validator.sanitizeString('  hello world  ')).toBe('hello world');
      expect(validator.sanitizeString('hello\n\nworld')).toBe('hello world');
      expect(validator.sanitizeString('hello\t\tworld')).toBe('hello world');
    });

    test('should sanitize file paths', () => {
      expect(validator.sanitizeFilePath('./src/../src/index.js')).toBe('src/index.js');
      expect(validator.sanitizeFilePath('src//index.js')).toBe('src/index.js');
      expect(validator.sanitizeFilePath('src\\index.js')).toBe('src/index.js');
    });

    test('should sanitize identifiers', () => {
      expect(validator.sanitizeIdentifier('my-variable-name')).toBe('myVariableName');
      expect(validator.sanitizeIdentifier('my_variable_name')).toBe('myVariableName');
      expect(validator.sanitizeIdentifier('123variable')).toBe('variable123');
      expect(validator.sanitizeIdentifier('class')).toBe('className');
    });

    test('should sanitize HTML', () => {
      expect(validator.sanitizeHtml('<script>alert("xss")</script>')).toBe('');
      expect(validator.sanitizeHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
      expect(validator.sanitizeHtml('Safe text')).toBe('Safe text');
    });
  });

  describe('Complex Validation', () => {
    test('should validate object schemas', () => {
      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'number', min: 0, max: 150 },
        email: { type: 'email', required: true },
        tags: { type: 'array', itemType: 'string' }
      };

      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        tags: ['developer', 'javascript']
      };

      const invalidData = {
        name: '',
        age: -5,
        email: 'invalid-email',
        tags: ['valid', 123] // Mixed types
      };

      expect(validator.validateSchema(validData, schema)).toBe(true);
      expect(validator.validateSchema(invalidData, schema)).toBe(false);
    });

    test('should get validation errors for schemas', () => {
      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'number', min: 0, max: 150 }
      };

      const invalidData = {
        name: '',
        age: -5
      };

      const errors = validator.getSchemaErrors(invalidData, schema);
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.field === 'name')).toBe(true);
      expect(errors.some(error => error.field === 'age')).toBe(true);
    });

    test('should validate nested objects', () => {
      const schema = {
        user: {
          type: 'object',
          schema: {
            name: { type: 'string', required: true },
            contact: {
              type: 'object',
              schema: {
                email: { type: 'email', required: true }
              }
            }
          }
        }
      };

      const validData = {
        user: {
          name: 'John',
          contact: {
            email: 'john@example.com'
          }
        }
      };

      const invalidData = {
        user: {
          name: '',
          contact: {
            email: 'invalid'
          }
        }
      };

      expect(validator.validateSchema(validData, schema)).toBe(true);
      expect(validator.validateSchema(invalidData, schema)).toBe(false);
    });
  });

  describe('Custom Validation Rules', () => {
    test('should add custom validation rules', () => {
      const customRule = (value) => value.startsWith('custom_');
      validator.addRule('custom-prefix', customRule);

      expect(validator.validate('custom_value', 'custom-prefix')).toBe(true);
      expect(validator.validate('invalid_value', 'custom-prefix')).toBe(false);
    });

    test('should combine multiple validation rules', () => {
      const result = validator.validateMultiple('hello123', [
        'string',
        'non-empty',
        'alphanumeric'
      ]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should return validation errors for failed rules', () => {
      const result = validator.validateMultiple('hello world!', [
        'string',
        'non-empty',
        'alphanumeric'
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Caching', () => {
    test('should cache validation results', () => {
      const start1 = performance.now();
      validator.isValidEmail('test@example.com');
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      validator.isValidEmail('test@example.com');
      const time2 = performance.now() - start2;

      // Second call should be faster due to caching
      expect(time2).toBeLessThanOrEqual(time1 + 0.1);
    });

    test('should handle large data sets efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => `item${i}`);
      
      const start = Date.now();
      const result = validator.validateArray(largeArray, 'string');
      const time = Date.now() - start;

      expect(result).toBe(true);
      expect(time).toBeLessThan(100); // Should complete quickly
    });
  });

  describe('Error Handling', () => {
    test('should handle null and undefined values gracefully', () => {
      expect(() => validator.isString(null)).not.toThrow();
      expect(() => validator.isString(undefined)).not.toThrow();
      expect(() => validator.validateSchema(null, {})).not.toThrow();
    });

    test('should handle circular references', () => {
      const circular = { name: 'test' };
      circular.self = circular;

      expect(() => validator.validateSchema(circular, { name: { type: 'string' } })).not.toThrow();
    });

    test('should provide meaningful error messages', () => {
      const errors = validator.getSchemaErrors(
        { age: 'invalid' },
        { age: { type: 'number', required: true } }
      );

      expect(errors[0]).toHaveProperty('message');
      expect(typeof errors[0].message).toBe('string');
      expect(errors[0].message.length).toBeGreaterThan(0);
    });
  });
});