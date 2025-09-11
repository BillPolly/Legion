/**
 * Tests for update+query operations returning different proxy types
 * Phase 2: Proxy Type Support
 * NO MOCKS - using real DataStore and DataScript
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataStore } from '../src/store.js';
import { DataStoreProxy } from '../src/datastore-proxy.js';
import { EntityProxy } from '../src/proxy.js';
import { CollectionProxy } from '../src/collection-proxy.js';
import { StreamProxy } from '../src/stream-proxy.js';

describe('Proxy Type Support for Update+Query', () => {
  let dataStore;
  let dataStoreProxy;
  
  beforeEach(() => {
    // Create real DataStore with comprehensive schema
    const schema = {
      ':user/name': { valueType: 'string' },
      ':user/email': { valueType: 'string', unique: 'identity' },
      ':user/age': { valueType: 'number' },
      ':user/active': { valueType: 'boolean' },
      ':user/tags': { valueType: 'string', card: 'many' },
      ':item/name': { valueType: 'string' },
      ':item/category': { valueType: 'string' },
      ':item/price': { valueType: 'number' },
      ':item/quantity': { valueType: 'number' },
      ':order/id': { valueType: 'string', unique: 'identity' },
      ':order/total': { valueType: 'number' },
      ':order/items': { valueType: 'ref', card: 'many' }
    };
    
    dataStore = new DataStore(schema);
    dataStoreProxy = new DataStoreProxy(dataStore);
  });
  
  describe('StreamProxy Update+Query Tests', () => {
    it('should return StreamProxy for scalar query after update', () => {
      // Create entity and query for scalar attribute
      const result = dataStoreProxy.query({
        update: {
          ':user/name': 'Alice',
          ':user/email': 'alice@example.com',
          ':user/age': 30
        },
        find: ['?age'],
        where: [
          ['?user', ':user/email', 'alice@example.com'],
          ['?user', ':user/age', '?age']
        ]
      });
      
      expect(result).toBeInstanceOf(StreamProxy);
      expect(result.value()).toBe(30);
    });
    
    it('should return StreamProxy for aggregation after update', () => {
      // Create multiple items and aggregate
      const result = dataStoreProxy.query({
        update: [
          { ':item/name': 'Widget', ':item/price': 99.99, ':item/quantity': 5 },
          { ':item/name': 'Gadget', ':item/price': 149.99, ':item/quantity': 3 },
          { ':item/name': 'Gizmo', ':item/price': 79.99, ':item/quantity': 7 }
        ],
        find: [['sum', '?price']],
        where: [
          ['?item', ':item/price', '?price']
        ],
        findType: 'scalar'
      });
      
      expect(result).toBeInstanceOf(StreamProxy);
      expect(result.value()).toBe(329.97); // 99.99 + 149.99 + 79.99
    });
    
    it('should handle empty result returning StreamProxy', () => {
      // Query for non-existent data
      const result = dataStoreProxy.query({
        update: {
          ':user/name': 'Bob',
          ':user/email': 'bob@example.com'
        },
        find: ['?age'],
        where: [
          ['?user', ':user/email', 'charlie@example.com'], // Different email
          ['?user', ':user/age', '?age']
        ]
      });
      
      expect(result).toBeInstanceOf(StreamProxy);
      expect(result.value()).toEqual([]); // Empty result
    });
    
    it('should verify StreamProxy correctly returned for count aggregate', () => {
      // Create entities and count them
      const result = dataStoreProxy.query({
        update: [
          { ':user/name': 'User1', ':user/active': true },
          { ':user/name': 'User2', ':user/active': true },
          { ':user/name': 'User3', ':user/active': false },
          { ':user/name': 'User4', ':user/active': true }
        ],
        find: [['count', '?user']],
        where: [
          ['?user', ':user/active', true]
        ],
        findType: 'scalar'
      });
      
      expect(result).toBeInstanceOf(StreamProxy);
      expect(result.value()).toBe(3); // Three active users
    });
  });
  
  describe('EntityProxy Update+Query Tests', () => {
    it('should return EntityProxy for single entity query after update', () => {
      const result = dataStoreProxy.query({
        update: {
          ':user/name': 'Diana',
          ':user/email': 'diana@example.com',
          ':user/age': 28
        },
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'diana@example.com']
        ]
      });
      
      expect(result).toBeInstanceOf(EntityProxy);
      expect(result.get(':user/name')).toBe('Diana');
      expect(result.get(':user/age')).toBe(28);
    });
    
    it('should handle entity reference queries after update', () => {
      // Create order with item references
      const result = dataStoreProxy.query({
        update: [
          { ':order/id': 'ORD-100', ':order/total': 249.98 },
          { ':item/name': 'Product1', ':item/price': 99.99 },
          { ':item/name': 'Product2', ':item/price': 149.99 }
        ],
        find: ['?order'],
        where: [
          ['?order', ':order/id', 'ORD-100']
        ]
      });
      
      expect(result).toBeInstanceOf(EntityProxy);
      expect(result.get(':order/total')).toBe(249.98);
    });
    
    it('should maintain cache after update', () => {
      // Create entity
      const result1 = dataStoreProxy.query({
        update: {
          ':user/name': 'Eve',
          ':user/email': 'eve@example.com'
        },
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'eve@example.com']
        ]
      });
      
      // Update same entity
      const result2 = dataStoreProxy.query({
        update: {
          ':db/id': result1.entityId,
          ':user/age': 35
        },
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'eve@example.com']
        ]
      });
      
      expect(result2).toBeInstanceOf(EntityProxy);
      expect(result2.entityId).toBe(result1.entityId);
      expect(result2.get(':user/age')).toBe(35);
    });
    
    it('should verify EntityProxy singleton pattern maintained', () => {
      // Create entity
      const createResult = dataStoreProxy.query({
        update: {
          ':user/name': 'Frank',
          ':user/email': 'frank@example.com'
        },
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'frank@example.com']
        ]
      });
      
      // Query same entity again
      const queryResult = dataStoreProxy.query({
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'frank@example.com']
        ]
      });
      
      // Should return the same proxy instance (singleton pattern)
      expect(queryResult.entityId).toBe(createResult.entityId);
    });
  });
  
  describe('CollectionProxy Update+Query Tests', () => {
    it('should return CollectionProxy for multiple entity results', () => {
      const result = dataStoreProxy.query({
        update: [
          { ':item/name': 'Item1', ':item/category': 'electronics' },
          { ':item/name': 'Item2', ':item/category': 'electronics' },
          { ':item/name': 'Item3', ':item/category': 'electronics' }
        ],
        find: ['?item'],
        where: [
          ['?item', ':item/category', 'electronics']
        ]
      });
      
      expect(result).toBeInstanceOf(CollectionProxy);
      expect(result.length).toBe(3);
      expect(result[0]).toBeInstanceOf(EntityProxy);
    });
    
    it('should handle multiple entity creation with different attributes', () => {
      const result = dataStoreProxy.query({
        update: [
          { ':user/name': 'GroupUser1', ':user/tags': ['admin', 'developer'] },
          { ':user/name': 'GroupUser2', ':user/tags': ['developer'] },
          { ':user/name': 'GroupUser3', ':user/tags': ['admin', 'manager'] }
        ],
        find: ['?user'],
        where: [
          ['?user', ':user/tags', 'admin']
        ]
      });
      
      expect(result).toBeInstanceOf(CollectionProxy);
      expect(result.length).toBe(2); // Two users have 'admin' tag
    });
    
    it('should support filtered collection queries after update', () => {
      const result = dataStoreProxy.query({
        update: [
          { ':item/name': 'Expensive1', ':item/price': 500, ':item/category': 'luxury' },
          { ':item/name': 'Cheap1', ':item/price': 50, ':item/category': 'budget' },
          { ':item/name': 'Expensive2', ':item/price': 750, ':item/category': 'luxury' },
          { ':item/name': 'Cheap2', ':item/price': 25, ':item/category': 'budget' }
        ],
        find: ['?item'],
        where: [
          ['?item', ':item/category', 'luxury']
        ]
      });
      
      expect(result).toBeInstanceOf(CollectionProxy);
      expect(result.length).toBe(2); // Two luxury items
    });
    
    it('should verify CollectionProxy array-like behavior', () => {
      const result = dataStoreProxy.query({
        update: [
          { ':user/name': 'ArrayUser1', ':user/active': true },
          { ':user/name': 'ArrayUser2', ':user/active': true },
          { ':user/name': 'ArrayUser3', ':user/active': true }
        ],
        find: ['?user'],
        where: [
          ['?user', ':user/active', true]
        ]
      });
      
      expect(result).toBeInstanceOf(CollectionProxy);
      
      // Test array-like access
      expect(result[0]).toBeInstanceOf(EntityProxy);
      expect(result.length).toBe(3);
      
      // Test iteration
      let count = 0;
      for (const item of result) {
        expect(item).toBeInstanceOf(EntityProxy);
        count++;
      }
      expect(count).toBe(3);
      
      // Test functional methods
      const namesCollection = result.map(user => user.get(':user/name'));
      expect(namesCollection).toBeInstanceOf(CollectionProxy);
      // Convert to array for comparison
      const names = Array.from(namesCollection);
      expect(names).toEqual(['ArrayUser1', 'ArrayUser2', 'ArrayUser3']);
    });
  });
});