/**
 * Test Infrastructure Validation Tests
 */

import { createTestStore, createSampleData, assertions, validators, errorHelpers } from './setup.js';

describe('Test Infrastructure', () => {
  describe('createTestStore', () => {
    test('should create DataStore with default schema', () => {
      const store = createTestStore();
      validators.validateStore(store);
      
      // Verify schema contains expected attributes
      expect(store.schema).toHaveProperty(':user/name');
      expect(store.schema).toHaveProperty(':user/email');
      expect(store.schema).toHaveProperty(':project/name');
    });
    
    test('should merge custom schema with defaults', () => {
      const customSchema = {
        ':custom/field': { valueType: 'string' }
      };
      
      const store = createTestStore(customSchema);
      validators.validateStore(store);
      
      expect(store.schema).toHaveProperty(':user/name'); // Default
      expect(store.schema).toHaveProperty(':custom/field'); // Custom
    });
  });
  
  describe('createSampleData', () => {
    test('should create sample entities in store', () => {
      const store = createTestStore();
      const data = createSampleData(store);
      
      // Validate structure
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('projects');
      expect(data.users).toHaveProperty('alice');
      expect(data.users).toHaveProperty('bob');
      expect(data.users).toHaveProperty('charlie');
      expect(data.projects).toHaveProperty('alpha');
      expect(data.projects).toHaveProperty('beta');
      
      // Validate entity IDs
      assertions.isValidEntityId(data.users.alice);
      assertions.isValidEntityId(data.users.bob);
      assertions.isValidEntityId(data.users.charlie);
      assertions.isValidEntityId(data.projects.alpha);
      assertions.isValidEntityId(data.projects.beta);
    });
    
    test('should create queryable data', () => {
      const store = createTestStore();
      const data = createSampleData(store);
      
      // Test that we can query the data
      const users = store.query({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(users.length).toBe(3);
      
      const alice = store.query({
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      });
      
      expect(alice.length).toBe(1);
      expect(alice[0][0]).toBe(data.users.alice);
    });
  });
  
  describe('assertions helpers', () => {
    test('isValidEntityId should validate entity IDs', () => {
      expect(() => assertions.isValidEntityId(123)).not.toThrow();
      expect(() => assertions.isValidEntityId(-1)).toThrow();
      expect(() => assertions.isValidEntityId(0)).toThrow();
      expect(() => assertions.isValidEntityId('123')).toThrow();
    });
    
    test('isValidQuerySpec should validate query specifications', () => {
      const validQuery = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(() => assertions.isValidQuerySpec(validQuery)).not.toThrow();
      expect(() => assertions.isValidQuerySpec({})).toThrow();
      expect(() => assertions.isValidQuerySpec({ find: [] })).toThrow();
    });
    
    test('hasProxyInterface should validate proxy objects', () => {
      const mockProxy = {
        value: () => {},
        query: () => {},
        subscribe: () => {},
        destroy: () => {}
      };
      
      expect(() => assertions.hasProxyInterface(mockProxy)).not.toThrow();
      expect(() => assertions.hasProxyInterface({})).toThrow();
    });
  });
  
  describe('validators helpers', () => {
    test('validateStore should validate DataStore instances', () => {
      const store = createTestStore();
      expect(() => validators.validateStore(store)).not.toThrow();
      expect(() => validators.validateStore({})).toThrow();
    });
    
    test('validateEntityData should validate entity data objects', () => {
      const entityData = {
        ':user/name': 'Test',
        ':user/email': 'test@example.com'
      };
      
      expect(() => validators.validateEntityData(entityData)).not.toThrow();
      expect(() => validators.validateEntityData(entityData, [':user/name'])).not.toThrow();
      expect(() => validators.validateEntityData(entityData, [':user/missing'])).toThrow();
    });
  });
  
  describe('errorHelpers', () => {
    test('expectValidationError should test error throwing', () => {
      const throwingFn = () => { throw new Error('Test error'); };
      const nonThrowingFn = () => 'success';
      
      expect(() => errorHelpers.expectValidationError(throwingFn)).not.toThrow();
      expect(() => errorHelpers.expectValidationError(nonThrowingFn)).toThrow();
    });
    
    test('expectNoFallback should ensure fail-fast behavior', () => {
      const failingFn = () => { throw new Error('Fail fast'); };
      const fallbackFn = () => 'fallback value';
      
      expect(() => errorHelpers.expectNoFallback(failingFn)).not.toThrow();
      expect(() => errorHelpers.expectNoFallback(fallbackFn)).toThrow();
    });
  });
});