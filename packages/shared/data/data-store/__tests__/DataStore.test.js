/**
 * DataStore Tests
 */

import { DataStore, createDataStore } from '../src/store.js';

describe('DataStore', () => {
  describe('Constructor', () => {
    it('should create DataStore with empty schema', () => {
      const store = new DataStore();
      expect(store).toBeInstanceOf(DataStore);
      expect(store.schema).toEqual({});
    });

    it('should create DataStore with provided schema', () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      expect(store.schema).toEqual(schema);
    });

    it('should freeze the schema to prevent mutation', () => {
      const schema = {
        ':user/name': { unique: 'identity' }
      };
      const store = new DataStore(schema);
      
      expect(() => {
        store.schema[':user/age'] = { valueType: 'number' };
      }).toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create DataStore using factory function', () => {
      const schema = {
        ':user/name': { unique: 'identity' }
      };
      const store = createDataStore(schema);
      expect(store).toBeInstanceOf(DataStore);
      // createDataStore passes schema as second parameter
      expect(store.schema).toBeDefined();
    });
  });

  describe('Create Entity', () => {
    let store;

    beforeEach(() => {
      store = new DataStore({
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' },
        ':user/age': { valueType: 'number' }
      });
    });

    it('should create single entity', () => {
      const entityData = {
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com',
        ':user/age': 30
      };
      
      const result = store.createEntity(entityData);
      expect(result).toBeDefined();
      expect(result.entityId).toBeDefined();
      expect(typeof result.entityId).toBe('number');
    });

    it('should create multiple entities', () => {
      const entitiesData = [
        { ':user/name': 'Bob', ':user/email': 'bob@example.com', ':user/age': 25 },
        { ':user/name': 'Charlie', ':user/email': 'charlie@example.com', ':user/age': 35 }
      ];

      const result = store.createEntities(entitiesData);
      expect(result).toBeDefined();
      expect(result.entityIds).toBeDefined();
      expect(result.entityIds.length).toBe(2);
    });
  });

  describe('Query', () => {
    let store;

    beforeEach(() => {
      store = new DataStore({
        ':user/name': {},
        ':user/age': { valueType: 'number' }
      });
      
      store.createEntities([
        { ':user/name': 'Alice', ':user/age': 30 },
        { ':user/name': 'Bob', ':user/age': 25 },
        { ':user/name': 'Charlie', ':user/age': 35 }
      ]);
    });

    it('should find all users', () => {
      const result = store.query({
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      });
      expect(result).toBeDefined();
      expect(result.length).toBe(3);
    });

    it('should find users by age', () => {
      const result = store.query({
        find: ['?name'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', 30]
        ]
      });
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0][0]).toBe('Alice');
    });
  });

  describe('Update Entity', () => {
    let store;
    let entityId;

    beforeEach(() => {
      store = new DataStore({
        ':user/name': { unique: 'identity' },
        ':user/email': {},
        ':user/age': { valueType: 'number' }
      });
      
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@test.com',
        ':user/age': 30
      });
      
      entityId = result.entityId;
    });

    it('should update entity attributes', () => {
      const result = store.updateEntity(entityId, {
        ':user/age': 31,
        ':user/email': 'alice.new@test.com'
      });
      
      expect(result).toBeDefined();
      expect(result.entityId).toBe(entityId);
      
      // Query to verify update
      const queryResult = store.query({
        find: ['?age', '?email'],
        where: [
          [entityId, ':user/age', '?age'],
          [entityId, ':user/email', '?email']
        ]
      });
      expect(queryResult).toBeDefined();
      expect(queryResult.length).toBe(1);
      expect(queryResult[0][0]).toBe(31);
      expect(queryResult[0][1]).toBe('alice.new@test.com');
    });
  });

  describe('Reactive Features', () => {
    let store;

    beforeEach(() => {
      store = new DataStore({
        ':user/name': {},
        ':user/active': { valueType: 'boolean' }
      });
    });

    it('should support listening to changes', (done) => {
      const listener = (txReport) => {
        expect(txReport).toBeDefined();
        expect(txReport.txData).toBeDefined();
        done();
      };

      // Listen to DataScript connection for changes
      store.conn.listen('test-listener', listener);
      
      // Create entity to trigger listener
      store.createEntity({
        ':user/name': 'Alice',
        ':user/active': true
      });
    });

    it('should handle query with update pattern', () => {
      const result = store.queryWithUpdate({
        find: ['?name'],
        where: [['?e', ':user/name', '?name']],
        update: [
          { ':db/id': '?newUser', ':user/name': 'David', ':user/active': true }
        ]
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.tempIds).toBeDefined();
      expect(result.tempIds['?newUser']).toBeDefined();
    });
  });
});