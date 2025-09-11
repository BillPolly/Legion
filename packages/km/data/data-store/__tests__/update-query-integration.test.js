/**
 * Integration tests for update+query functionality
 * Tests the complete flow of update and query in a single operation
 * NO MOCKS - using real DataStore and DataScript
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataStore } from '../src/store.js';
import { DataStoreProxy } from '../src/datastore-proxy.js';
import { EntityProxy } from '../src/proxy.js';
import { CollectionProxy } from '../src/collection-proxy.js';
import { StreamProxy } from '../src/stream-proxy.js';

describe('Update+Query Integration', () => {
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
      ':item/order': { valueType: 'ref' },
      ':order/id': { valueType: 'string', unique: 'identity' },
      ':order/status': { valueType: 'string' },
      ':order/items': { valueType: 'ref', card: 'many' }
    };
    
    dataStore = new DataStore(schema);
    dataStoreProxy = new DataStoreProxy(dataStore);
  });
  
  describe('Basic Update+Query Operations', () => {
    it('should create single entity and query it', () => {
      const result = dataStoreProxy.query({
        update: {
          ':user/name': 'Alice',
          ':user/email': 'alice@example.com',
          ':user/age': 30,
          ':user/active': true
        },
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'alice@example.com']
        ]
      });
      
      // Should return an EntityProxy
      expect(result).toBeInstanceOf(EntityProxy);
      expect(result.get(':user/name')).toBe('Alice');
      expect(result.get(':user/email')).toBe('alice@example.com');
      expect(result.get(':user/age')).toBe(30);
      expect(result.get(':user/active')).toBe(true);
    });
    
    it('should create multiple entities and query them', () => {
      const result = dataStoreProxy.query({
        update: [
          { ':item/name': 'Widget', ':item/category': 'electronics', ':item/price': 99.99 },
          { ':item/name': 'Gadget', ':item/category': 'electronics', ':item/price': 149.99 },
          { ':item/name': 'Gizmo', ':item/category': 'electronics', ':item/price': 79.99 }
        ],
        find: ['?item'],
        where: [
          ['?item', ':item/category', 'electronics']
        ]
      });
      
      // Should return a CollectionProxy
      expect(result).toBeInstanceOf(CollectionProxy);
      expect(result.length).toBe(3);
      
      // Verify all items are present
      const names = result.map(item => item.get(':item/name'));
      expect(names).toContain('Widget');
      expect(names).toContain('Gadget');
      expect(names).toContain('Gizmo');
    });
    
    it('should update existing entity and query it', () => {
      // First create an entity
      const { entityId } = dataStore.createEntity({
        ':user/name': 'Bob',
        ':user/email': 'bob@example.com',
        ':user/age': 25
      });
      
      // Update and query
      const result = dataStoreProxy.query({
        update: {
          ':db/id': entityId,
          ':user/age': 26,
          ':user/active': true
        },
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'bob@example.com']
        ]
      });
      
      // Should return the updated EntityProxy
      expect(result).toBeInstanceOf(EntityProxy);
      expect(result.get(':user/name')).toBe('Bob'); // Original preserved
      expect(result.get(':user/age')).toBe(26); // Updated
      expect(result.get(':user/active')).toBe(true); // New attribute
    });
    
    it('should verify tests fail without implementation', () => {
      // This test is to ensure our TDD approach - tests should have failed before implementation
      // Now they should pass with the implementation
      expect(typeof dataStoreProxy.query).toBe('function');
      
      // Verify the method accepts update field
      const testQuery = {
        update: { ':user/name': 'Test' },
        find: ['?new-1'],
        where: [['?new-1', ':user/name', 'Test']]
      };
      
      // Should not throw
      expect(() => dataStoreProxy.query(testQuery)).not.toThrow();
    });
    
    it('should modify DataStoreProxy.query() to handle update field', () => {
      // Test that the query method properly handles the update field
      const originalDb = dataStore.db();
      
      // Execute query with update
      const result = dataStoreProxy.query({
        update: { ':user/name': 'Charlie', ':user/email': 'charlie@example.com' },
        find: ['?user'],
        where: [['?user', ':user/email', 'charlie@example.com']]
      });
      
      // Database should have changed
      const newDb = dataStore.db();
      expect(newDb).not.toBe(originalDb);
      
      // Entity should exist in new database
      const checkQuery = {
        find: ['?e'],
        where: [['?e', ':user/email', 'charlie@example.com']]
      };
      const entities = dataStore.query(checkQuery);
      expect(entities.length).toBe(1);
    });
    
    it('should use tempid binding with ?new-1 variable', () => {
      // Test creating multiple entities and referencing them via tempids
      const result = dataStoreProxy.query({
        update: [
          { ':order/id': 'ORD-001', ':order/status': 'pending' },
          { ':item/name': 'Widget', ':item/order': '?new-1', ':item/price': 99.99 }
        ],
        find: ['?item'],
        where: [
          ['?item', ':item/order', '?new-1'],
          ['?new-1', ':order/id', 'ORD-001']
        ]
      });
      
      // Should find the item that references the order
      expect(result).toBeInstanceOf(EntityProxy);
      expect(result.get(':item/name')).toBe('Widget');
      expect(result.get(':item/price')).toBe(99.99);
      
      // Should be able to navigate to the order
      const orderRef = result.get(':item/order');
      expect(orderRef).toBeDefined();
    });
  });
});