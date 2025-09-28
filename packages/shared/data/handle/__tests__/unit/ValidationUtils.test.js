/**
 * ValidationUtils.test.js - Unit tests for ValidationUtils
 * 
 * Tests all validation utilities to ensure proper error handling and validation logic.
 */

import { 
  ValidationUtils,
  validateDataScriptEntityId,
  validateDataScriptQuery,
  validateDataScriptUpdateData,
  validateDataScriptAttributeName,
  validateStandardDataSourceInterface
} from '../../src/ValidationUtils.js';
import { createMockFunction } from '../testUtils.js';

describe('ValidationUtils', () => {
  
  describe('validateQuerySpec', () => {
    test('should reject null/undefined query specs', () => {
      expect(() => ValidationUtils.validateQuerySpec(null)).toThrow('Query specification is required');
      expect(() => ValidationUtils.validateQuerySpec(undefined)).toThrow('Query specification is required');
    });

    test('should reject non-object query specs', () => {
      expect(() => ValidationUtils.validateQuerySpec('string')).toThrow('Query specification must be an object');
      expect(() => ValidationUtils.validateQuerySpec(123)).toThrow('Query specification must be an object');
    });

    test('should reject empty query specs', () => {
      expect(() => ValidationUtils.validateQuerySpec({})).toThrow('Query must have find, where, query, or select clause');
    });

    test('should accept valid DataScript query specs', () => {
      expect(() => ValidationUtils.validateQuerySpec({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      })).not.toThrow();
    });

    test('should accept SQL-like query specs', () => {
      expect(() => ValidationUtils.validateQuerySpec({
        select: ['name', 'email'],
        from: 'users'
      })).not.toThrow();
      
      expect(() => ValidationUtils.validateQuerySpec({
        select: '*',
        from: 'users'
      })).not.toThrow();
    });

    test('should accept generic query specs', () => {
      expect(() => ValidationUtils.validateQuerySpec({
        query: 'SELECT * FROM users'
      })).not.toThrow();
      
      expect(() => ValidationUtils.validateQuerySpec({
        query: { collection: 'users', filter: { active: true } }
      })).not.toThrow();
    });

    test('should validate DataScript structure details', () => {
      expect(() => ValidationUtils.validateQuerySpec({
        find: [],
        where: [['?e', ':user/name', '?name']]
      })).toThrow('Query must have find clause');

      expect(() => ValidationUtils.validateQuerySpec({
        find: ['?e']
      })).toThrow('Query must have where clause');

      expect(() => ValidationUtils.validateQuerySpec({
        find: ['?e'],
        where: 'not-array'
      })).toThrow('Where clause must be an array');
    });

    test('should validate select clause types', () => {
      expect(() => ValidationUtils.validateQuerySpec({
        select: 123
      })).toThrow('Select clause must be string or array');
      
      expect(() => ValidationUtils.validateQuerySpec({
        select: {}
      })).toThrow('Select clause must be string or array');
    });

    test('should validate query clause types', () => {
      expect(() => ValidationUtils.validateQuerySpec({
        query: 123
      })).toThrow('Query clause must be string or object');
      
      expect(() => ValidationUtils.validateQuerySpec({
        query: []
      })).toThrow('Query clause must be string or object');
    });

    test('should use custom context in error messages', () => {
      expect(() => ValidationUtils.validateQuerySpec(null, 'Custom query')).toThrow('Custom query specification is required');
      expect(() => ValidationUtils.validateQuerySpec({}, 'Custom query')).toThrow('Custom query must have find, where, query, or select clause');
    });
  });

  describe('validateCallback', () => {
    test('should reject null/undefined callbacks', () => {
      expect(() => ValidationUtils.validateCallback(null)).toThrow('Callback function is required');
      expect(() => ValidationUtils.validateCallback(undefined)).toThrow('Callback function is required');
    });

    test('should reject non-function callbacks', () => {
      expect(() => ValidationUtils.validateCallback('string')).toThrow('Callback function is required');
      expect(() => ValidationUtils.validateCallback(123)).toThrow('Callback function is required');
      expect(() => ValidationUtils.validateCallback({})).toThrow('Callback function is required');
    });

    test('should accept valid functions', () => {
      expect(() => ValidationUtils.validateCallback(() => {})).not.toThrow();
      expect(() => ValidationUtils.validateCallback(function() {})).not.toThrow();
      expect(() => ValidationUtils.validateCallback(createMockFunction())).not.toThrow();
    });

    test('should use custom context in error messages', () => {
      expect(() => ValidationUtils.validateCallback(null, 'Custom callback')).toThrow('Custom callback function is required');
    });
  });

  describe('validateEntityId', () => {
    test('should reject null/undefined by default', () => {
      expect(() => ValidationUtils.validateEntityId(null)).toThrow('Entity ID is required');
      expect(() => ValidationUtils.validateEntityId(undefined)).toThrow('Entity ID is required');
    });

    test('should allow null when configured', () => {
      expect(() => ValidationUtils.validateEntityId(null, 'Entity ID', { allowNull: true })).not.toThrow();
    });

    test('should validate numbers by default', () => {
      expect(() => ValidationUtils.validateEntityId(123)).not.toThrow();
      expect(() => ValidationUtils.validateEntityId(0, 'Entity ID', { requirePositive: false })).not.toThrow();
    });

    test('should reject negative numbers by default', () => {
      expect(() => ValidationUtils.validateEntityId(-1)).toThrow('Entity ID must be positive');
      expect(() => ValidationUtils.validateEntityId(0)).toThrow('Entity ID must be positive');
    });

    test('should reject strings by default', () => {
      expect(() => ValidationUtils.validateEntityId('abc')).toThrow('Entity ID cannot be a string');
    });

    test('should allow strings when configured', () => {
      expect(() => ValidationUtils.validateEntityId('abc', 'Entity ID', { allowStrings: true })).not.toThrow();
    });

    test('should reject empty strings even when strings allowed', () => {
      expect(() => ValidationUtils.validateEntityId('', 'Entity ID', { allowStrings: true })).toThrow('Entity ID cannot be empty string');
      expect(() => ValidationUtils.validateEntityId('   ', 'Entity ID', { allowStrings: true })).toThrow('Entity ID cannot be empty string');
    });

    test('should reject invalid numbers', () => {
      expect(() => ValidationUtils.validateEntityId(NaN)).toThrow('Entity ID must be a valid number');
      expect(() => ValidationUtils.validateEntityId(Infinity)).toThrow('Entity ID must be a valid number');
    });

    test('should reject objects by default', () => {
      expect(() => ValidationUtils.validateEntityId({})).toThrow('Entity ID cannot be an object');
    });

    test('should use custom context in error messages', () => {
      expect(() => ValidationUtils.validateEntityId(null, 'Custom ID')).toThrow('Custom ID is required');
    });
  });

  describe('validateUpdateData', () => {
    test('should reject null/undefined update data', () => {
      expect(() => ValidationUtils.validateUpdateData(null)).toThrow('Update data is required');
      expect(() => ValidationUtils.validateUpdateData(undefined)).toThrow('Update data is required');
    });

    test('should reject non-object update data', () => {
      expect(() => ValidationUtils.validateUpdateData('string')).toThrow('Update data must be an object');
      expect(() => ValidationUtils.validateUpdateData(123)).toThrow('Update data must be an object');
    });

    test('should reject empty objects by default', () => {
      expect(() => ValidationUtils.validateUpdateData({})).toThrow('Update data cannot be empty');
    });

    test('should allow empty objects when configured', () => {
      expect(() => ValidationUtils.validateUpdateData({}, 'Update data', { allowEmptyObject: true })).not.toThrow();
    });

    test('should validate DataScript format when required', () => {
      expect(() => ValidationUtils.validateUpdateData(
        { name: 'test' }, 
        'Update data', 
        { requireDataScriptFormat: true }
      )).toThrow('Attributes must start with \':\'. Found: name');
      
      expect(() => ValidationUtils.validateUpdateData(
        { ':user/name': 'test' }, 
        'Update data', 
        { requireDataScriptFormat: true }
      )).not.toThrow();
    });

    test('should validate required attributes', () => {
      expect(() => ValidationUtils.validateUpdateData(
        { ':user/name': 'test' },
        'Update data',
        { requiredAttributes: [':user/email'] }
      )).toThrow('Update data must include required attribute: :user/email');
      
      expect(() => ValidationUtils.validateUpdateData(
        { ':user/name': 'test', ':user/email': 'test@example.com' },
        'Update data',
        { requiredAttributes: [':user/email'] }
      )).not.toThrow();
    });

    test('should validate forbidden attributes', () => {
      expect(() => ValidationUtils.validateUpdateData(
        { ':user/name': 'test', ':user/id': 123 },
        'Update data',
        { forbiddenAttributes: [':user/id'] }
      )).toThrow('Update data cannot include forbidden attribute: :user/id');
    });

    test('should use custom context in error messages', () => {
      expect(() => ValidationUtils.validateUpdateData(null, 'Custom data')).toThrow('Custom data is required');
    });
  });

  describe('validateAttributeName', () => {
    test('should reject null/undefined by default', () => {
      expect(() => ValidationUtils.validateAttributeName(null)).toThrow('Attribute name is required');
      expect(() => ValidationUtils.validateAttributeName(undefined)).toThrow('Attribute name is required');
    });

    test('should allow empty strings when configured', () => {
      expect(() => ValidationUtils.validateAttributeName('', 'Attribute name', { allowEmptyString: true })).not.toThrow();
    });

    test('should reject non-strings', () => {
      expect(() => ValidationUtils.validateAttributeName(123)).toThrow('Attribute name must be a string');
      expect(() => ValidationUtils.validateAttributeName({})).toThrow('Attribute name must be a string');
    });

    test('should reject empty strings by default', () => {
      expect(() => ValidationUtils.validateAttributeName('')).toThrow('Attribute name cannot be empty');
    });

    test('should validate DataScript format when required', () => {
      expect(() => ValidationUtils.validateAttributeName('name', 'Attribute name', { requireDataScriptFormat: true })).toThrow('Attribute name must start with \':\'');
      expect(() => ValidationUtils.validateAttributeName(':user/name', 'Attribute name', { requireDataScriptFormat: true })).not.toThrow();
    });

    test('should validate max length', () => {
      expect(() => ValidationUtils.validateAttributeName('toolongname', 'Attribute name', { maxLength: 5 })).toThrow('Attribute name cannot exceed 5 characters');
      expect(() => ValidationUtils.validateAttributeName('ok', 'Attribute name', { maxLength: 5 })).not.toThrow();
    });

    test('should validate allowed characters', () => {
      const alphaOnly = /^[a-zA-Z]+$/;
      expect(() => ValidationUtils.validateAttributeName('name123', 'Attribute name', { allowedCharacters: alphaOnly })).toThrow('Attribute name contains invalid characters');
      expect(() => ValidationUtils.validateAttributeName('name', 'Attribute name', { allowedCharacters: alphaOnly })).not.toThrow();
    });
  });

  describe('validateDataSourceInterface', () => {
    test('should reject null/undefined DataSource', () => {
      expect(() => ValidationUtils.validateDataSourceInterface(null)).toThrow('DataSource must be a non-null object');
      expect(() => ValidationUtils.validateDataSourceInterface(undefined)).toThrow('DataSource must be a non-null object');
    });

    test('should reject non-object DataSource', () => {
      expect(() => ValidationUtils.validateDataSourceInterface('string')).toThrow('DataSource must be a non-null object');
    });

    test('should validate required methods', () => {
      expect(() => ValidationUtils.validateDataSourceInterface({})).toThrow('DataSource must implement query() method');
      
      expect(() => ValidationUtils.validateDataSourceInterface({
        query: 'not-function'
      })).toThrow('DataSource must implement query() method');
      
      expect(() => ValidationUtils.validateDataSourceInterface({
        query: createMockFunction()
      })).toThrow('DataSource must implement subscribe() method');
    });

    test('should accept valid DataSource', () => {
      const validDS = {
        query: createMockFunction(),
        subscribe: createMockFunction()
      };
      
      expect(() => ValidationUtils.validateDataSourceInterface(validDS)).not.toThrow();
    });

    test('should validate custom required methods', () => {
      const ds = {
        query: createMockFunction(),
        subscribe: createMockFunction()
      };
      
      expect(() => ValidationUtils.validateDataSourceInterface(
        ds, 'DataSource', ['query', 'subscribe', 'update']
      )).toThrow('DataSource must implement update() method');
    });
  });

  describe('validateArray', () => {
    test('should reject non-arrays', () => {
      expect(() => ValidationUtils.validateArray('string')).toThrow('Array must be an array');
      expect(() => ValidationUtils.validateArray({})).toThrow('Array must be an array');
    });

    test('should validate min length', () => {
      expect(() => ValidationUtils.validateArray([], 'Array', { minLength: 1 })).toThrow('Array must have at least 1 elements');
      expect(() => ValidationUtils.validateArray([1], 'Array', { minLength: 1 })).not.toThrow();
    });

    test('should validate max length', () => {
      expect(() => ValidationUtils.validateArray([1, 2, 3], 'Array', { maxLength: 2 })).toThrow('Array cannot have more than 2 elements');
      expect(() => ValidationUtils.validateArray([1, 2], 'Array', { maxLength: 2 })).not.toThrow();
    });

    test('should reject empty arrays when configured', () => {
      expect(() => ValidationUtils.validateArray([], 'Array', { allowEmpty: false })).toThrow('Array cannot be empty');
    });

    test('should validate elements with custom validator', () => {
      const numberValidator = (element, context) => {
        if (typeof element !== 'number') {
          throw new Error(`${context} must be number`);
        }
      };
      
      expect(() => ValidationUtils.validateArray(
        [1, 'string', 3], 
        'Numbers', 
        { elementValidator: numberValidator }
      )).toThrow('Numbers[1]: Numbers[1] must be number');
      
      expect(() => ValidationUtils.validateArray(
        [1, 2, 3], 
        'Numbers', 
        { elementValidator: numberValidator }
      )).not.toThrow();
    });
  });

  describe('validateBulkOperation', () => {
    test('should validate items parameter', () => {
      expect(() => ValidationUtils.validateBulkOperation('not-array', createMockFunction())).toThrow('Bulk operation items must be an array');
      expect(() => ValidationUtils.validateBulkOperation({}, createMockFunction())).toThrow('Bulk operation items must be an array');
    });

    test('should validate operation function', () => {
      expect(() => ValidationUtils.validateBulkOperation([], null)).toThrow('Bulk operation operation function is required');
      expect(() => ValidationUtils.validateBulkOperation([], 'not-function')).toThrow('Bulk operation operation function is required');
    });

    test('should reject empty arrays', () => {
      expect(() => ValidationUtils.validateBulkOperation([], createMockFunction())).toThrow('Bulk operation items array cannot be empty');
    });

    test('should accept valid parameters', () => {
      expect(() => ValidationUtils.validateBulkOperation([1, 2, 3], createMockFunction())).not.toThrow();
    });
  });

  describe('validateOptions', () => {
    test('should handle null/undefined options', () => {
      expect(() => ValidationUtils.validateOptions(null, {})).not.toThrow();
      expect(() => ValidationUtils.validateOptions(undefined, {})).not.toThrow();
    });

    test('should reject non-object options', () => {
      expect(() => ValidationUtils.validateOptions('string', {})).toThrow('Options must be an object');
    });

    test('should validate required options', () => {
      const schema = {
        name: { required: true, type: 'string' }
      };
      
      expect(() => ValidationUtils.validateOptions({}, schema)).toThrow('Options.name is required');
      expect(() => ValidationUtils.validateOptions({ name: 'test' }, schema)).not.toThrow();
    });

    test('should validate option types', () => {
      const schema = {
        count: { type: 'number' },
        items: { type: 'array' },
        config: { type: 'object' }
      };
      
      expect(() => ValidationUtils.validateOptions(
        { count: 'string' }, schema
      )).toThrow('Options.count must be number, got string');
      
      expect(() => ValidationUtils.validateOptions(
        { items: 'string' }, schema
      )).toThrow('Options.items must be array, got string');
      
      expect(() => ValidationUtils.validateOptions(
        { config: 'string' }, schema
      )).toThrow('Options.config must be object, got string');
    });

    test('should validate number ranges', () => {
      const schema = {
        count: { type: 'number', min: 1, max: 10 }
      };
      
      expect(() => ValidationUtils.validateOptions(
        { count: 0 }, schema
      )).toThrow('Options.count must be at least 1');
      
      expect(() => ValidationUtils.validateOptions(
        { count: 11 }, schema
      )).toThrow('Options.count cannot exceed 10');
      
      expect(() => ValidationUtils.validateOptions(
        { count: 5 }, schema
      )).not.toThrow();
    });

    test('should validate enums', () => {
      const schema = {
        mode: { enum: ['dev', 'prod', 'test'] }
      };
      
      expect(() => ValidationUtils.validateOptions(
        { mode: 'invalid' }, schema
      )).toThrow('Options.mode must be one of: dev, prod, test');
      
      expect(() => ValidationUtils.validateOptions(
        { mode: 'dev' }, schema
      )).not.toThrow();
    });
  });
});

// Test convenience functions
describe('Convenience Validation Functions', () => {
  
  describe('validateDataScriptEntityId', () => {
    test('should validate positive numbers only', () => {
      expect(() => validateDataScriptEntityId(123)).not.toThrow();
      expect(() => validateDataScriptEntityId(-1)).toThrow('Entity ID must be positive');
      expect(() => validateDataScriptEntityId('string')).toThrow('Entity ID cannot be a string');
      expect(() => validateDataScriptEntityId(null)).toThrow('Entity ID is required');
    });
  });

  describe('validateDataScriptQuery', () => {
    test('should validate DataScript format strictly', () => {
      expect(() => validateDataScriptQuery({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      })).not.toThrow();
      
      expect(() => validateDataScriptQuery({
        find: ['?e']
      })).toThrow('DataScript Query specification must have both find and where clauses');
    });
  });

  describe('validateDataScriptUpdateData', () => {
    test('should require DataScript attribute format', () => {
      expect(() => validateDataScriptUpdateData({
        ':user/name': 'test'
      })).not.toThrow();
      
      expect(() => validateDataScriptUpdateData({
        name: 'test'
      })).toThrow('Attributes must start with \':\'. Found: name');
    });
  });

  describe('validateDataScriptAttributeName', () => {
    test('should require DataScript format', () => {
      expect(() => validateDataScriptAttributeName(':user/name')).not.toThrow();
      expect(() => validateDataScriptAttributeName('name')).toThrow('Attribute name must start with \':\'');
    });
  });

  describe('validateStandardDataSourceInterface', () => {
    test('should validate standard interface', () => {
      const validDS = {
        query: createMockFunction(),
        subscribe: createMockFunction(),
        getSchema: createMockFunction(),
        queryBuilder: createMockFunction()
      };
      
      expect(() => validateStandardDataSourceInterface(validDS)).not.toThrow();
      
      const invalidDS = {
        query: createMockFunction(),
        subscribe: createMockFunction()
        // missing getSchema and queryBuilder
      };
      
      expect(() => validateStandardDataSourceInterface(invalidDS)).toThrow('DataSource must implement getSchema() method');
    });
  });
});