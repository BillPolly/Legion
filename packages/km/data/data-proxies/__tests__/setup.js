/**
 * Test Setup and Utilities for Data Proxies
 * Provides common test infrastructure without mocks
 */

import { DataStore } from '../src/index.js';

/**
 * Create a test DataStore with sample schema
 */
export function createTestStore(customSchema = {}) {
  const defaultSchema = {
    ':user/name': { valueType: 'string', unique: 'identity' },
    ':user/email': { valueType: 'string', unique: 'identity' },
    ':user/age': { valueType: 'number' },
    ':user/active': { valueType: 'boolean' },
    ':user/friends': { valueType: 'ref', card: 'many' },
    ':project/name': { valueType: 'string' },
    ':project/owner': { valueType: 'ref' },
    ':project/members': { valueType: 'ref', card: 'many' },
    ':tag/name': { valueType: 'string' }
  };
  
  return new DataStore({ ...defaultSchema, ...customSchema });
}

/**
 * Create sample test data in DataStore
 */
export function createSampleData(store) {
  // Create users
  const user1Result = store.createEntity({
    ':user/name': 'Alice',
    ':user/email': 'alice@example.com',
    ':user/age': 30,
    ':user/active': true
  });
  
  const user2Result = store.createEntity({
    ':user/name': 'Bob',
    ':user/email': 'bob@example.com', 
    ':user/age': 25,
    ':user/active': true
  });
  
  const user3Result = store.createEntity({
    ':user/name': 'Charlie',
    ':user/email': 'charlie@example.com',
    ':user/age': 35,
    ':user/active': false
  });
  
  // Create projects
  const project1Result = store.createEntity({
    ':project/name': 'Project Alpha',
    ':project/owner': user1Result.entityId,
    ':project/members': [user1Result.entityId, user2Result.entityId]
  });
  
  const project2Result = store.createEntity({
    ':project/name': 'Project Beta', 
    ':project/owner': user2Result.entityId,
    ':project/members': [user2Result.entityId, user3Result.entityId]
  });
  
  return {
    users: {
      alice: user1Result.entityId,
      bob: user2Result.entityId,
      charlie: user3Result.entityId
    },
    projects: {
      alpha: project1Result.entityId,
      beta: project2Result.entityId
    }
  };
}

/**
 * Common test assertions
 */
export const assertions = {
  isValidEntityId(entityId) {
    expect(typeof entityId).toBe('number');
    expect(entityId).toBeGreaterThan(0);
  },
  
  isValidQuerySpec(querySpec) {
    expect(querySpec).toBeDefined();
    expect(querySpec.find).toBeDefined();
    expect(Array.isArray(querySpec.find)).toBe(true);
    expect(querySpec.find.length).toBeGreaterThan(0);
    expect(querySpec.where).toBeDefined();
    expect(Array.isArray(querySpec.where)).toBe(true);
  },
  
  hasProxyInterface(proxy) {
    expect(proxy).toBeDefined();
    expect(typeof proxy.value).toBe('function');
    expect(typeof proxy.query).toBe('function'); 
    expect(typeof proxy.subscribe).toBe('function');
    expect(typeof proxy.destroy).toBe('function');
  }
};

/**
 * Test data validation helpers
 */
export const validators = {
  validateStore(store) {
    expect(store).toBeDefined();
    expect(typeof store.db).toBe('function');
    expect(typeof store.query).toBe('function');
    expect(typeof store.createEntity).toBe('function');
  },
  
  validateEntityData(entityData, expectedFields = []) {
    expect(entityData).toBeDefined();
    expect(typeof entityData).toBe('object');
    
    for (const field of expectedFields) {
      expect(entityData).toHaveProperty(field);
    }
  }
};

/**
 * Error testing helpers
 */
export const errorHelpers = {
  expectValidationError(fn, expectedMessage) {
    expect(fn).toThrow();
    if (expectedMessage) {
      expect(fn).toThrow(expectedMessage);
    }
  },
  
  expectNoFallback(fn) {
    // Ensure function fails fast without fallbacks
    expect(fn).toThrow();
  }
};