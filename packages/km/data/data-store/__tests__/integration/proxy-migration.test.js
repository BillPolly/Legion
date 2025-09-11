/**
 * Proxy Migration Tests
 * Phase 5, Step 5.2: Migration of Existing Tests
 * 
 * Demonstrates how to migrate from legacy DataStore direct usage
 * to the new unified proxy architecture.
 * 
 * These tests show before/after patterns for common data access scenarios.
 */

import { DataStore } from '../../src/store.js';
import { DataStoreProxy } from '../../src/datastore-proxy.js';
import { StreamProxy } from '../../src/stream-proxy.js';
import { EntityProxy } from '../../src/proxy.js';
import { CollectionProxy } from '../../src/collection-proxy.js';

describe('Proxy Migration Tests', () => {
  let store;
  let proxy;
  let userId;
  let managerId;
  let postId;
  
  beforeEach(() => {
    // Create DataStore with schema
    store = new DataStore({
      ':user/name': { valueType: 'string', unique: 'identity' },
      ':user/email': { valueType: 'string', unique: 'identity' },
      ':user/age': { valueType: 'number' },
      ':user/manager': { valueType: 'ref' },
      ':user/roles': { valueType: 'string', card: 'many' },
      ':post/title': { valueType: 'string' },
      ':post/content': { valueType: 'string' },
      ':post/author': { valueType: 'ref' },
      ':post/tags': { valueType: 'string', card: 'many' }
    });
    
    // Create proxy wrapper
    proxy = new DataStoreProxy(store);
    
    // Create test data
    const userResult = store.createEntity({
      ':user/name': 'Alice',
      ':user/email': 'alice@example.com',
      ':user/age': 28,
      ':user/roles': ['admin', 'user']
    });
    userId = userResult.entityId;
    
    const managerResult = store.createEntity({
      ':user/name': 'Bob Manager',
      ':user/email': 'bob@example.com',
      ':user/age': 35,
      ':user/roles': ['manager']
    });
    managerId = managerResult.entityId;
    
    const postResult = store.createEntity({
      ':post/title': 'Test Post',
      ':post/content': 'This is a test post',
      ':post/author': userId,
      ':post/tags': ['test', 'migration']
    });
    postId = postResult.entityId;
  });
  
  describe('Scalar Value Queries', () => {
    test('BEFORE: Legacy DataStore scalar query', () => {
      // Old way: Direct DataStore usage
      const query = {
        find: ['?name'],
        where: [
          [userId, ':user/name', '?name']
        ]
      };
      
      const results = store.query(query);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0][0]).toBe('Alice');
      
      // Need to manually extract value from nested arrays
      const userName = results[0][0];
      expect(userName).toBe('Alice');
    });
    
    test('AFTER: Proxy architecture scalar query', () => {
      // New way: Proxy returns StreamProxy for scalar queries
      const query = {
        find: ['?name'],
        where: [
          [userId, ':user/name', '?name']
        ]
      };
      
      const result = proxy.query(query);
      expect(result).toBeInstanceOf(StreamProxy);
      
      // Clean access via value() method
      const userName = result.value();
      expect(userName).toBe('Alice');
    });
  });
  
  describe('Entity Access Patterns', () => {
    test('BEFORE: Legacy entity property access', () => {
      // Old way: Multiple queries to get entity properties
      const nameQuery = {
        find: ['?name'],
        where: [[userId, ':user/name', '?name']]
      };
      
      const ageQuery = {
        find: ['?age'],
        where: [[userId, ':user/age', '?age']]
      };
      
      const emailQuery = {
        find: ['?email'],
        where: [[userId, ':user/email', '?email']]
      };
      
      const nameResult = store.query(nameQuery);
      const ageResult = store.query(ageQuery);
      const emailResult = store.query(emailQuery);
      
      // Manual extraction from results arrays
      const name = nameResult[0][0];
      const age = ageResult[0][0];
      const email = emailResult[0][0];
      
      expect(name).toBe('Alice');
      expect(age).toBe(28);
      expect(email).toBe('alice@example.com');
    });
    
    test('AFTER: Proxy architecture entity access', () => {
      // New way: Get EntityProxy and access properties directly
      const entity = proxy.getProxy(userId);
      expect(entity).toBeInstanceOf(EntityProxy);
      
      // Clean property access
      expect(entity.get(':user/name')).toBe('Alice');
      expect(entity.get(':user/age')).toBe(28);
      expect(entity.get(':user/email')).toBe('alice@example.com');
    });
  });
  
  describe('Entity Query Results', () => {
    test('BEFORE: Legacy entity queries', () => {
      // Old way: Entity queries return arrays of entity IDs
      const query = {
        find: ['?user'],
        where: [
          ['?user', ':user/name', 'Alice']
        ]
      };
      
      const results = store.query(query);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      expect(typeof results[0][0]).toBe('number');
      
      // Need to manually create entity wrapper
      const entityId = results[0][0];
      // Then make additional queries to get properties...
    });
    
    test('AFTER: Proxy architecture entity queries', () => {
      // New way: Entity queries return EntityProxy directly
      const query = {
        find: ['?user'],
        where: [
          ['?user', ':user/name', 'Alice']
        ]
      };
      
      const result = proxy.query(query);
      expect(result).toBeInstanceOf(EntityProxy);
      
      // Direct property access on EntityProxy
      expect(result.get(':user/name')).toBe('Alice');
    });
  });
  
  describe('Collection Processing', () => {
    test('BEFORE: Legacy multi-value attribute handling', () => {
      // Old way: Multi-value attributes return multiple rows
      const query = {
        find: ['?role'],
        where: [
          [userId, ':user/roles', '?role']
        ]
      };
      
      const results = store.query(query);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2); // Two roles
      
      // Manual collection from multiple rows
      const roles = results.map(row => row[0]);
      expect(roles).toContain('admin');
      expect(roles).toContain('user');
    });
    
    test('AFTER: Proxy architecture collection handling', () => {
      // New way: Multi-value attributes return CollectionProxy
      const query = {
        find: ['?role'],
        where: [
          [userId, ':user/roles', '?role']
        ]
      };
      
      const result = proxy.query(query);
      expect(result).toBeInstanceOf(CollectionProxy);
      
      // Clean collection access - CollectionProxy.value() returns the raw array structure
      const roles = result.value();
      expect(Array.isArray(roles)).toBe(true);
      expect(roles).toEqual([['admin'], ['user']]);
      
      // Or use collection properties
      expect(result.length).toBe(2);
    });
  });
  
  describe('Aggregate Queries', () => {
    test('BEFORE: Legacy aggregate queries', () => {
      // Old way: Aggregates need specific constraints and findType for scalar results
      const query = {
        find: [['count', '?user']],
        where: [
          ['?user', ':user/name', '?name'] // Use variable instead of wildcard
        ],
        findType: 'scalar' // Need to specify scalar for direct value
      };
      
      const result = store.query(query);
      // DataStore returns scalar directly when findType is 'scalar'
      expect(typeof result).toBe('number');
      expect(result).toBe(2);
    });
    
    test('AFTER: Proxy architecture aggregate queries', () => {
      // New way: Proxy handles aggregate findType automatically and returns StreamProxy
      const query = {
        find: [['count', '?user']],
        where: [
          ['?user', ':user/name', '?name'] // Use variable instead of wildcard
        ]
        // No need to specify findType - proxy handles it automatically
      };
      
      const result = proxy.query(query);
      expect(result).toBeInstanceOf(StreamProxy);
      
      // Clean value access with reactive capabilities
      const count = result.value();
      expect(count).toBe(2);
      
      // Can subscribe to changes
      let notified = false;
      result.subscribe((newCount) => {
        notified = true;
      });
    });
  });
  
  describe('Reference Traversal', () => {
    test('BEFORE: Legacy reference queries', () => {
      // Old way: Multiple queries to traverse references
      
      // First get the post
      const postQuery = {
        find: ['?post'],
        where: [
          ['?post', ':post/title', 'Test Post']
        ]
      };
      const postResults = store.query(postQuery);
      const foundPostId = postResults[0][0];
      
      // Then get the author reference
      const authorQuery = {
        find: ['?author'],
        where: [
          [foundPostId, ':post/author', '?author']
        ]
      };
      const authorResults = store.query(authorQuery);
      const authorId = authorResults[0][0];
      
      // Then get author name
      const nameQuery = {
        find: ['?name'],
        where: [
          [authorId, ':user/name', '?name']
        ]
      };
      const nameResults = store.query(nameQuery);
      const authorName = nameResults[0][0];
      
      expect(authorName).toBe('Alice');
    });
    
    test('AFTER: Proxy architecture reference traversal', () => {
      // New way: Clean traversal through proxies
      const post = proxy.getProxy(postId);
      expect(post).toBeInstanceOf(EntityProxy);
      
      // Get author reference (returns EntityProxy)
      const author = post.get(':post/author');
      expect(author).toBeInstanceOf(EntityProxy);
      
      // Get author name
      const authorName = author.get(':user/name');
      expect(authorName).toBe('Alice');
      
      // Or chain it all together
      const name = proxy.getProxy(postId).get(':post/author').get(':user/name');
      expect(name).toBe('Alice');
    });
  });
  
  describe('Error Handling', () => {
    test('BEFORE: Legacy error handling', () => {
      // Old way: Manual checking of empty results
      const query = {
        find: ['?name'],
        where: [
          [999, ':user/name', '?name'] // Non-existent entity
        ]
      };
      
      const results = store.query(query);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
      
      // Manual handling of empty results
      const name = results.length > 0 ? results[0][0] : null;
      expect(name).toBeNull();
    });
    
    test('AFTER: Proxy architecture error handling', () => {
      // New way: Proxies handle empty results gracefully
      const query = {
        find: ['?name'],
        where: [
          [999, ':user/name', '?name'] // Non-existent entity
        ]
      };
      
      const result = proxy.query(query);
      expect(result).toBeInstanceOf(StreamProxy);
      
      // Empty results return empty array, not null
      const name = result.value();
      expect(name).toEqual([]);
      
      // Non-existent entity proxies handle gracefully
      const entity = proxy.getProxy(999);
      expect(entity).toBeInstanceOf(EntityProxy);
      expect(entity.get(':user/name')).toBeUndefined();
    });
  });
});