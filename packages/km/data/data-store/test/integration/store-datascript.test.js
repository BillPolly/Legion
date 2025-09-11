import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DataStore } from '../../src/store.js';
import { DB, retractEntity } from 'datascript';

describe('DataStore - DataScript Integration', () => {
  describe('DataScript Connection', () => {
    it('should create underlying DataScript connection', () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      // Should have a connection to DataScript
      assert.ok(store.conn);
      assert.ok(store.db() instanceof DB);
    });

    it('should pass schema to DataScript', () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      const db = store.db();
      
      // Schema should be available in the DataScript database
      assert.deepStrictEqual(db.schema, schema);
    });

    it('should start with empty database', () => {
      const store = new DataStore();
      const db = store.db();
      
      // Should have no datoms initially
      assert.strictEqual(db.datoms(':eavt').length, 0);
    });

    it('should be able to query empty database', () => {
      const store = new DataStore();
      const db = store.db();
      
      // Should be able to run queries on empty database
      const results = store.query({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      });
      
      assert.deepStrictEqual(results, []);
    });

    it('should handle schema with all constraint types', () => {
      const schema = {
        ':user/id': { unique: 'identity' },
        ':user/email': { unique: 'value' },
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/profile': { valueType: 'ref', component: true },
        ':user/age': { valueType: 'number' },
        ':user/tags': { card: 'many' }
      };
      
      const store = new DataStore(schema);
      const db = store.db();
      
      assert.deepStrictEqual(db.schema, schema);
      assert.strictEqual(db.datoms(':eavt').length, 0);
    });
  });

  describe('Database State Management', () => {
    it('should maintain immutable database reference', () => {
      const store = new DataStore();
      const db1 = store.db();
      const db2 = store.db();
      
      // Should return same database instance until transaction
      assert.strictEqual(db1, db2);
    });

    it('should provide access to current database state', () => {
      const store = new DataStore();
      
      // Database should be accessible
      const db = store.db();
      assert.ok(db instanceof DB);
      
      // Should reflect current state
      assert.strictEqual(db.datoms(':eavt').length, 0);
    });
  });

  describe('Proxy Registry Integration', () => {
    it('should maintain proxy registry with real entity operations', async () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      // Create a real entity
      const { dbAfter, tempids } = store.conn.transact([
        { ':db/id': -1, ':user/name': 'Alice', ':user/email': 'alice@example.com' }
      ]);
      
      const realEntityId = tempids.get(-1);
      
      // Create a simple proxy mock for this real entity
      const mockProxy = {
        entityId: realEntityId,
        isValid: () => store.db().entity(realEntityId) !== null
      };
      
      // Register proxy
      store._registerProxy(realEntityId, mockProxy);
      
      // Should retrieve same proxy
      const retrieved = store._getRegisteredProxy(realEntityId);
      assert.strictEqual(retrieved, mockProxy);
      assert.ok(retrieved.isValid()); // Entity exists in database
    });

    it('should handle proxy cleanup when entity deleted', () => {
      const schema = {
        ':user/name': { unique: 'identity' }
      };
      const store = new DataStore(schema);
      
      // Create entity
      const { tempids } = store.conn.transact([
        { ':db/id': -1, ':user/name': 'Bob' }
      ]);
      
      const entityId = tempids.get(-1);
      
      // Register proxy
      const mockProxy = {
        entityId,
        isValid: () => store.db().entity(entityId) !== null
      };
      store._registerProxy(entityId, mockProxy);
      
      // Verify proxy is valid
      assert.ok(store._getRegisteredProxy(entityId).isValid());
      
      // Delete entity using retractEntity
      const newDB = retractEntity(store.db(), entityId);
      
      // Simulate database update (would happen automatically in real system)
      store.conn._db = newDB;
      
      // Now proxy should be invalid
      assert.ok(!store._getRegisteredProxy(entityId).isValid());
      
      // Cleanup should remove it
      store._cleanupProxies();
      assert.strictEqual(store._getRegisteredProxy(entityId), undefined);
    });

    it('should handle concurrent proxy registrations', () => {
      const store = new DataStore();
      
      // Create multiple entities
      const { tempids } = store.conn.transact([
        { ':db/id': -1, ':user/name': 'User1' },
        { ':db/id': -2, ':user/name': 'User2' },
        { ':db/id': -3, ':user/name': 'User3' }
      ]);
      
      const entities = [tempids.get(-1), tempids.get(-2), tempids.get(-3)];
      
      // Register proxies for all entities
      const proxies = entities.map(id => {
        const proxy = {
          entityId: id,
          isValid: () => store.db().entity(id) !== null
        };
        store._registerProxy(id, proxy);
        return proxy;
      });
      
      // All should be retrievable
      entities.forEach((id, index) => {
        assert.strictEqual(store._getRegisteredProxy(id), proxies[index]);
        assert.ok(store._getRegisteredProxy(id).isValid());
      });
    });
  });

  describe('Entity Creation Integration', () => {
    it('should create entity and persist to DataScript database', () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com'
      });
      
      // Entity should exist in database
      const db = store.db();
      const entity = db.entity(result.entityId);
      assert.ok(entity);
      assert.strictEqual(entity[':user/name'], 'Alice');
      assert.strictEqual(entity[':user/email'], 'alice@example.com');
    });

    it('should handle schema validation during creation', () => {
      const schema = {
        ':user/email': { unique: 'value' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create first user
      const user1 = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com'
      });
      
      // Should enforce unique constraint
      try {
        store.createEntity({
          ':user/name': 'Bob',
          ':user/email': 'alice@example.com'  // Same email
        });
        assert.fail('Should have thrown unique constraint error');
      } catch (error) {
        assert.ok(error.message.includes('Unique constraint'));
      }
    });

    it('should handle relationships in entity creation', () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create users first
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      // Create user with friendship
      const charlie = store.createEntity({
        ':user/name': 'Charlie',
        ':user/friends': [alice.entityId, bob.entityId]
      });
      
      // Verify relationships in database
      const db = store.db();
      const charlieEntity = db.entity(charlie.entityId);
      assert.ok(charlieEntity[':user/friends']);
      assert.ok(charlieEntity[':user/friends'].includes(alice.entityId));
      assert.ok(charlieEntity[':user/friends'].includes(bob.entityId));
    });

    it('should handle batch entity creation with transactions', () => {
      const store = new DataStore();
      
      const result = store.createEntities([
        { ':user/name': 'Alice' },
        { ':user/name': 'Bob' },
        { ':user/name': 'Charlie' }
      ]);
      
      // All entities should exist in database
      const db = store.db();
      result.entityIds.forEach((id, index) => {
        const entity = db.entity(id);
        assert.ok(entity);
        assert.strictEqual(entity[':user/name'], ['Alice', 'Bob', 'Charlie'][index]);
      });
      
      // Database should have correct number of datoms
      const datoms = db.datoms(':eavt');
      assert.ok(datoms.length >= 3); // At least 3 name datoms
    });

    it('should update database state after entity creation', () => {
      const store = new DataStore();
      const initialDatomCount = store.db().datoms(':eavt').length;
      
      store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/active': true
      });
      
      const finalDatomCount = store.db().datoms(':eavt').length;
      assert.strictEqual(finalDatomCount, initialDatomCount + 3); // 3 new datoms
    });

    it('should maintain transaction history', () => {
      const store = new DataStore();
      const initialDatomCount = store.db().datoms(':eavt').length;
      
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const finalDatomCount = store.db().datoms(':eavt').length;
      assert.ok(finalDatomCount > initialDatomCount); // New datoms created
      assert.ok(result.entityId); // Entity was created successfully
    });
  });
});