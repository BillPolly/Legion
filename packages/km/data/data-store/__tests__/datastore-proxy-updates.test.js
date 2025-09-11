/**
 * Unit tests for DataStoreProxy update+query functionality
 * Following TDD approach - tests written first, then implementation
 * NO MOCKS - using real DataStore and DataScript
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataStore } from '../src/store.js';
import { DataStoreProxy } from '../src/datastore-proxy.js';

describe('DataStoreProxy Update+Query', () => {
  let dataStore;
  let dataStoreProxy;
  
  beforeEach(() => {
    // Create real DataStore with schema
    const schema = {
      ':user/name': { valueType: 'string' },
      ':user/email': { valueType: 'string', unique: 'identity' },
      ':user/age': { valueType: 'number' },
      ':user/active': { valueType: 'boolean' },
      ':item/name': { valueType: 'string' },
      ':item/category': { valueType: 'string' },
      ':item/price': { valueType: 'number' },
      ':item/order': { valueType: 'ref' },
      ':order/id': { valueType: 'string', unique: 'identity' },
      ':order/status': { valueType: 'string' }
    };
    
    dataStore = new DataStore(schema);
    dataStoreProxy = new DataStoreProxy(dataStore);
  });
  
  describe('_executeUpdate() method', () => {
    it('should execute update with single entity', () => {
      // Test creating a single entity
      const updateSpec = {
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com',
        ':user/age': 30
      };
      
      const result = dataStoreProxy._executeUpdate(updateSpec);
      
      expect(result).toBeDefined();
      expect(result.tempids).toBeDefined();
      expect(result.tempids.size).toBeGreaterThan(0);
      expect(result.dbAfter).toBeDefined();
      
      // Verify entity was created in database
      const db = dataStore.db();
      const query = {
        find: ['?e'],
        where: [['?e', ':user/email', 'alice@example.com']]
      };
      const entities = dataStore.query(query);
      expect(entities.length).toBe(1);
    });
    
    it('should execute update with multiple entities', () => {
      // Test creating multiple entities
      const updateSpec = [
        { ':user/name': 'Bob', ':user/email': 'bob@example.com' },
        { ':user/name': 'Charlie', ':user/email': 'charlie@example.com' },
        { ':user/name': 'Diana', ':user/email': 'diana@example.com' }
      ];
      
      const result = dataStoreProxy._executeUpdate(updateSpec);
      
      expect(result).toBeDefined();
      expect(result.tempids).toBeDefined();
      expect(result.tempids.size).toBe(3); // Three tempids created
      expect(result.dbAfter).toBeDefined();
      
      // Verify all entities were created
      const db = dataStore.db();
      const query = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      };
      const entities = dataStore.query(query);
      expect(entities.length).toBe(3);
    });
    
    it('should execute update with explicit IDs', () => {
      // First create an entity
      const { entityId } = dataStore.createEntity({
        ':user/name': 'Eve',
        ':user/email': 'eve@example.com'
      });
      
      // Update with explicit ID
      const updateSpec = {
        ':db/id': entityId,
        ':user/age': 25,
        ':user/active': true
      };
      
      const result = dataStoreProxy._executeUpdate(updateSpec);
      
      expect(result).toBeDefined();
      expect(result.dbAfter).toBeDefined();
      
      // Verify entity was updated
      const db = dataStore.db();
      const entity = db.entity(entityId);
      expect(entity[':user/age']).toBe(25);
      expect(entity[':user/active']).toBe(true);
      expect(entity[':user/name']).toBe('Eve'); // Original data preserved
    });
    
    it('should handle error cases in _executeUpdate', () => {
      // Test with invalid update spec
      expect(() => {
        dataStoreProxy._executeUpdate('invalid');
      }).toThrow('Update spec must be an object or array');
      
      // Test with null (should return empty result)
      const result = dataStoreProxy._executeUpdate(null);
      expect(result.tempids).toBeDefined();
      expect(result.tempids.size).toBe(0);
    });
  });
  
  describe('_bindTempids() method', () => {
    it('should bind single tempid to query variable', () => {
      // Create a tempids map like what comes from a transaction
      const tempids = new Map();
      tempids.set(-1, 42); // tempid -1 maps to entity 42
      
      const querySpec = {
        find: ['?new-1'],
        where: [
          ['?new-1', ':user/name', '?name'],
          ['?new-1', ':user/email', '?email']
        ]
      };
      
      const boundQuery = dataStoreProxy._bindTempids(querySpec, tempids);
      
      expect(boundQuery.find[0]).toBe(42);
      expect(boundQuery.where[0][0]).toBe(42);
      expect(boundQuery.where[1][0]).toBe(42);
      // Other variables should remain unchanged
      expect(boundQuery.where[0][2]).toBe('?name');
      expect(boundQuery.where[1][2]).toBe('?email');
    });
    
    it('should bind multiple tempids to query variables', () => {
      const tempids = new Map();
      tempids.set(-1, 100);
      tempids.set(-2, 200);
      tempids.set(-3, 300);
      
      const querySpec = {
        find: ['?item'],
        where: [
          ['?new-1', ':order/id', 'ORD-001'],
          ['?new-2', ':item/order', '?new-1'],
          ['?new-3', ':item/order', '?new-1'],
          ['?item', ':item/order', '?new-1']
        ]
      };
      
      const boundQuery = dataStoreProxy._bindTempids(querySpec, tempids);
      
      expect(boundQuery.where[0][0]).toBe(100); // ?new-1 -> 100
      expect(boundQuery.where[1][0]).toBe(200); // ?new-2 -> 200
      expect(boundQuery.where[1][2]).toBe(100); // ?new-1 -> 100
      expect(boundQuery.where[2][0]).toBe(300); // ?new-3 -> 300
      expect(boundQuery.where[2][2]).toBe(100); // ?new-1 -> 100
      expect(boundQuery.where[3][2]).toBe(100); // ?new-1 -> 100
      expect(boundQuery.where[3][0]).toBe('?item'); // ?item unchanged
    });
    
    it('should handle nested query structures', () => {
      const tempids = new Map();
      tempids.set(-1, 777);
      
      const querySpec = {
        find: ['?result'],
        where: [
          ['?new-1', ':user/name', 'Alice'],
          { or: [
            ['?new-1', ':user/active', true],
            ['?new-1', ':user/status', 'premium']
          ]}
        ],
        in: {
          collection: ['?new-1', '?other']
        }
      };
      
      const boundQuery = dataStoreProxy._bindTempids(querySpec, tempids);
      
      expect(boundQuery.where[0][0]).toBe(777);
      expect(boundQuery.where[1].or[0][0]).toBe(777);
      expect(boundQuery.where[1].or[1][0]).toBe(777);
      expect(boundQuery.in.collection[0]).toBe(777);
      expect(boundQuery.in.collection[1]).toBe('?other'); // unchanged
    });
    
    it('should test _replaceVariables helper directly', () => {
      const tempids = new Map();
      tempids.set(-1, 999);
      tempids.set(-2, 888);
      
      const replacer = (variable) => {
        if (typeof variable === 'string' && variable.startsWith('?new-')) {
          const tempidNum = parseInt(variable.substring(5), 10);
          if (!isNaN(tempidNum) && tempids.has(-tempidNum)) {
            return tempids.get(-tempidNum);
          }
        }
        return variable;
      };
      
      // Test with array
      const array = ['?new-1', '?other', '?new-2', '?keep'];
      dataStoreProxy._replaceVariables(array, replacer);
      expect(array).toEqual([999, '?other', 888, '?keep']);
      
      // Test with object
      const obj = {
        find: '?new-1',
        where: ['?new-2', ':attr', '?value'],
        nested: { var: '?new-1' }
      };
      dataStoreProxy._replaceVariables(obj, replacer);
      expect(obj.find).toBe(999);
      expect(obj.where[0]).toBe(888);
      expect(obj.where[2]).toBe('?value');
      expect(obj.nested.var).toBe(999);
    });
  });
});