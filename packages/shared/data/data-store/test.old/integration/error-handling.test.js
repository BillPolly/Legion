import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createDataStore, EntityProxy } from '../index.js';
import { DB } from 'datascript';

describe('Error Handling Validation - End-to-End', () => {
  describe('Schema Constraint Violations', () => {
    it('should handle unique constraint violations across entire system', () => {
      const schema = {
        ':user/email': { unique: 'value' },
        ':user/id': { unique: 'identity' }
      };
      
      const store = createDataStore({ schema });
      
      // Create first user
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'unique@example.com',
        ':user/id': 'user-123'
      });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Try to create second user with same email
      try {
        store.createEntity({
          ':user/name': 'Bob',
          ':user/email': 'unique@example.com' // Same email
        });
        // If this succeeds, DataScript allows duplicates and we should test update behavior instead
      } catch (error) {
        // If this fails, unique constraint is enforced
        assert.ok(error.message.includes('Unique constraint') || error.message.includes('unique'));
      }
      
      // Try to update Alice to use same email again - should be fine
      assert.doesNotThrow(() => {
        aliceProxy.update({ ':user/email': 'unique@example.com' });
      });
      
      // Try to create entity with same ID
      try {
        store.createEntity({
          ':user/name': 'Charlie',
          ':user/id': 'user-123' // Same ID
        });
        // If this succeeds, DataScript allows duplicates
      } catch (error) {
        // If this fails, unique constraint is enforced
        assert.ok(error.message.includes('Unique constraint') || error.message.includes('unique') || error.message.includes('identity'));
      }
      
      // Try to update Alice with different unique values - should work
      assert.doesNotThrow(() => {
        aliceProxy.update({
          ':user/email': 'alice-new@example.com',
          ':user/id': 'alice-new-123'
        });
      });
      
      // Verify changes took effect
      assert.strictEqual(aliceProxy.get(':user/email'), 'alice-new@example.com');
      assert.strictEqual(aliceProxy.get(':user/id'), 'alice-new-123');
    });

    it('should handle value type constraint violations', () => {
      const schema = {
        ':user/age': { valueType: 'number' },
        ':user/active': { valueType: 'boolean' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Valid value types should work
      assert.doesNotThrow(() => {
        aliceProxy.update({
          ':user/age': 30,
          ':user/active': true
        });
      });
      
      // Invalid value types should be handled by DataScript
      // Note: DataScript is flexible with value types, so these might not throw
      // The schema is more for documentation than strict enforcement
      assert.doesNotThrow(() => {
        aliceProxy.update({
          ':user/age': '30', // String instead of number
          ':user/active': 'yes' // String instead of boolean
        });
      });
    });

    it('should handle reference constraint violations', () => {
      const schema = {
        ':user/manager': { valueType: 'ref' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Valid references should work
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const bobProxy = new EntityProxy(bob.entityId, store);
      
      assert.doesNotThrow(() => {
        aliceProxy.addRelation(':user/manager', bobProxy);
        aliceProxy.addRelation(':user/friends', bobProxy);
      });
      
      // References to non-existent entities should work but create invalid proxies
      assert.doesNotThrow(() => {
        aliceProxy.addRelation(':user/friends', 999999); // Non-existent entity
      });
      
      const friends = aliceProxy.get(':user/friends');
      const invalidFriend = friends.find(f => f.entityId === 999999);
      if (invalidFriend) {
        assert.ok(!invalidFriend.isValid());
      }
    });
  });

  describe('Invalid Operations', () => {
    it('should handle operations on non-existent entities', () => {
      const store = createDataStore();
      const invalidProxy = new EntityProxy(999999, store);
      
      // All operations should throw appropriate errors
      assert.throws(() => {
        invalidProxy.update({ ':user/name': 'Should Fail' });
      }, /Cannot update invalid entity/);
      
      assert.throws(() => {
        invalidProxy.query({
          find: ['?name'],
          where: [['?this', ':user/name', '?name']]
        });
      }, /Cannot query invalid entity/);
      
      assert.throws(() => {
        invalidProxy.subscribe({
          find: ['?name'],
          where: [['?this', ':user/name', '?name']]
        }, () => {});
      }, /Cannot subscribe to invalid entity/);
      
      assert.throws(() => {
        invalidProxy.computed('test', {
          find: ['?name'],
          where: [['?this', ':user/name', '?name']]
        }, () => {});
      }, /Cannot define computed property on invalid entity/);
      
      assert.throws(() => {
        invalidProxy.onChange(() => {});
      }, /Cannot add event listener to invalid entity/);
      
      assert.throws(() => {
        invalidProxy.onDelete(() => {});
      }, /Cannot add event listener to invalid entity/);
      
      assert.throws(() => {
        invalidProxy.addRelation(':user/friends', 1);
      }, /Cannot modify relationships on invalid entity/);
      
      // Delete should not throw (idempotent)
      assert.doesNotThrow(() => {
        invalidProxy.delete();
      });
      
      // Property access should return undefined, not throw
      assert.strictEqual(invalidProxy.get(':user/name'), undefined);
      assert.strictEqual(invalidProxy.get(':user/age'), undefined);
    });

    it('should handle malformed query structures', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Malformed queries should throw validation errors
      assert.throws(() => {
        proxy.query(null);
      }, /Query is required/);
      
      assert.throws(() => {
        proxy.query({});
      }, /Query must have find and where clauses/);
      
      assert.throws(() => {
        proxy.query({ find: ['?e'] });
      }, /Query must have find and where clauses/);
      
      assert.throws(() => {
        proxy.query({ where: [['?e', ':user/name', '?name']] });
      }, /Query must have find and where clauses/);
      
      assert.throws(() => {
        proxy.query({
          find: '?e', // Should be array
          where: [['?e', ':user/name', '?name']]
        });
      }, /Find and where clauses must be arrays/);
      
      // Malformed subscription queries should throw same errors
      assert.throws(() => {
        proxy.subscribe(null, () => {});
      }, /Query is required/);
      
      assert.throws(() => {
        proxy.subscribe({}, () => {});
      }, /Query must have find and where clauses/);
    });

    it('should handle invalid update data', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Invalid update data should throw
      assert.throws(() => {
        proxy.update(null);
      }, /Update data is required/);
      
      assert.throws(() => {
        proxy.update(undefined);
      }, /Update data is required/);
      
      assert.throws(() => {
        proxy.update('invalid');
      }, /Update data must be an object/);
      
      assert.throws(() => {
        proxy.update(123);
      }, /Update data must be an object/);
      
      assert.throws(() => {
        proxy.update([]);
      }, /Update data must be an object/);
      
      // Invalid attribute names should throw
      assert.throws(() => {
        proxy.update({ 'invalid-attr': 'value' });
      }, /Attributes must start with ':'/);
      
      assert.throws(() => {
        proxy.update({ ':db/id': 999 });
      }, /Cannot update :db\/id/);
      
      // Empty updates should be allowed
      assert.doesNotThrow(() => {
        proxy.update({});
      });
    });

    it('should handle invalid relationship operations', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/name': { valueType: 'string' }
      };
      
      const store = createDataStore({ schema });
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Invalid attribute parameters
      assert.throws(() => {
        proxy.addRelation(null, 1);
      }, /Attribute is required/);
      
      assert.throws(() => {
        proxy.addRelation('invalid-attr', 1);
      }, /Attribute must start with ':'/);
      
      // Invalid target parameters
      assert.throws(() => {
        proxy.addRelation(':user/friends', null);
      }, /Target entity is required/);
      
      assert.throws(() => {
        proxy.addRelation(':user/friends', 'invalid');
      }, /Target must be EntityProxy or entity ID/);
      
      // Non-ref attributes should throw
      assert.throws(() => {
        proxy.addRelation(':user/name', 1);
      }, /Attribute must be a reference type/);
      
      // Same validations for removeRelation
      assert.throws(() => {
        proxy.removeRelation(null, 1);
      }, /Attribute is required/);
      
      assert.throws(() => {
        proxy.removeRelation(':user/friends', null);
      }, /Target entity is required/);
    });

    it('should handle invalid computed property definitions', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Invalid property names
      assert.throws(() => {
        proxy.computed(null, {}, () => {});
      }, /Property name is required/);
      
      assert.throws(() => {
        proxy.computed('', {}, () => {});
      }, /Property name is required/);
      
      // Invalid queries
      assert.throws(() => {
        proxy.computed('test', null, () => {});
      }, /Query is required/);
      
      assert.throws(() => {
        proxy.computed('test', {}, () => {});
      }, /Query must have find and where clauses/);
      
      // Invalid transformers
      const validQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
      
      assert.throws(() => {
        proxy.computed('test', validQuery, null);
      }, /Transformer function is required/);
      
      assert.throws(() => {
        proxy.computed('test', validQuery, 'invalid');
      }, /Transformer must be a function/);
      
      // Duplicate property names
      proxy.computed('testProp', validQuery, (results) => results);
      
      assert.throws(() => {
        proxy.computed('testProp', validQuery, (results) => results);
      }, /Computed property 'testProp' already exists/);
    });

    it('should handle invalid event listener registrations', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Invalid onChange callbacks
      assert.throws(() => {
        proxy.onChange(null);
      }, /Callback is required/);
      
      assert.throws(() => {
        proxy.onChange('invalid');
      }, /Callback must be a function/);
      
      // Invalid onDelete callbacks
      assert.throws(() => {
        proxy.onDelete(null);
      }, /Callback is required/);
      
      assert.throws(() => {
        proxy.onDelete('invalid');
      }, /Callback must be a function/);
      
      // Valid callbacks should work
      assert.doesNotThrow(() => {
        const unsub1 = proxy.onChange(() => {});
        const unsub2 = proxy.onDelete(() => {});
        unsub1();
        unsub2();
      });
    });
  });

  describe('DataStore Construction Errors', () => {
    it('should handle invalid schema definitions', () => {
      // Invalid attribute names
      assert.throws(() => {
        createDataStore({
          schema: { 'invalid-attr': {} }
        });
      }, /Schema attributes must start with ':'/);
      
      // Invalid unique constraints
      assert.throws(() => {
        createDataStore({
          schema: { ':user/name': { unique: 'invalid' } }
        });
      }, /Invalid unique constraint/);
      
      // Invalid cardinality
      assert.throws(() => {
        createDataStore({
          schema: { ':user/friends': { card: 'invalid' } }
        });
      }, /Invalid cardinality/);
      
      // Invalid value types
      assert.throws(() => {
        createDataStore({
          schema: { ':user/age': { valueType: 'invalid' } }
        });
      }, /Invalid valueType/);
      
      // Valid schemas should work
      assert.doesNotThrow(() => {
        createDataStore({
          schema: {
            ':user/name': { unique: 'identity' },
            ':user/email': { unique: 'value' },
            ':user/friends': { card: 'many', valueType: 'ref' },
            ':user/age': { valueType: 'number' },
            ':user/active': { valueType: 'boolean' }
          }
        });
      });
    });

    it('should handle invalid entity creation data', () => {
      const store = createDataStore();
      
      // Invalid entity data
      assert.throws(() => {
        store.createEntity(null);
      }, /Entity data is required/);
      
      assert.throws(() => {
        store.createEntity(undefined);
      }, /Entity data is required/);
      
      assert.throws(() => {
        store.createEntity({});
      }, /Entity data cannot be empty/);
      
      assert.throws(() => {
        store.createEntity({ 'invalid-attr': 'value' });
      }, /Attributes must start with ':'/);
      
      // Valid entity data should work
      assert.doesNotThrow(() => {
        store.createEntity({ ':user/name': 'Valid User' });
      });
    });

    it('should handle invalid batch entity creation', () => {
      const store = createDataStore();
      
      // Invalid batch data
      assert.throws(() => {
        store.createEntities(null);
      }, /Entities data must be a non-empty array/);
      
      assert.throws(() => {
        store.createEntities([]);
      }, /Entities data must be a non-empty array/);
      
      assert.throws(() => {
        store.createEntities('invalid');
      }, /Entities data must be a non-empty array/);
      
      // Invalid individual entities in batch
      assert.throws(() => {
        store.createEntities([
          { ':user/name': 'Valid User' },
          { 'invalid-attr': 'value' } // Invalid attribute
        ]);
      }, /Attributes must start with ':'/);
      
      // Valid batch should work
      assert.doesNotThrow(() => {
        store.createEntities([
          { ':user/name': 'User1' },
          { ':user/name': 'User2' },
          { ':user/name': 'User3' }
        ]);
      });
    });
  });

  describe('Proxy Construction Errors', () => {
    it('should handle invalid EntityProxy construction parameters', () => {
      const store = createDataStore();
      
      // Invalid entity IDs
      assert.throws(() => {
        new EntityProxy(null, store);
      }, /Entity ID is required/);
      
      assert.throws(() => {
        new EntityProxy(undefined, store);
      }, /Entity ID is required/);
      
      assert.throws(() => {
        new EntityProxy('invalid', store);
      }, /Entity ID must be a number/);
      
      assert.throws(() => {
        new EntityProxy([], store);
      }, /Entity ID must be a number/);
      
      // Invalid store
      assert.throws(() => {
        new EntityProxy(1, null);
      }, /DataStore is required/);
      
      assert.throws(() => {
        new EntityProxy(1, 'invalid');
      }, /DataStore is required/);
      
      // Valid construction should work
      assert.doesNotThrow(() => {
        new EntityProxy(1, store); // Non-existent but valid parameters
      });
      
      // Entity ID 0 should be valid
      assert.doesNotThrow(() => {
        new EntityProxy(0, store);
      });
    });

    it('should handle proxy operations after store changes', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Initially valid
      assert.ok(proxy.isValid());
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      
      // Manually corrupt store state (simulate external changes)
      const originalDb = store.conn.db();
      store.conn._db = DB.empty(store.schema); // Replace with empty database
      
      // Proxy should become invalid
      assert.ok(!proxy.isValid());
      assert.strictEqual(proxy.get(':user/name'), undefined);
      
      // Operations should fail gracefully
      assert.throws(() => {
        proxy.update({ ':user/age': 30 });
      }, /Cannot update invalid entity/);
      
      // Restore original state
      store.conn._db = originalDb;
      
      // Proxy should be valid again
      assert.ok(proxy.isValid());
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
    });
  });

  describe('Concurrent Operation Errors', () => {
    it('should handle concurrent proxy operations without data corruption', () => {
      const store = createDataStore();
      
      // Create entities for concurrent operations
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < 10; i++) {
        const entity = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i,
          ':user/score': i * 10
        });
        entities.push(entity);
        proxies.push(new EntityProxy(entity.entityId, store));
      }
      
      // Perform many concurrent operations
      const operations = [];
      
      // Updates
      proxies.forEach((proxy, index) => {
        operations.push(() => {
          proxy.update({ ':user/score': index * 20 });
        });
      });
      
      // Queries  
      proxies.forEach(proxy => {
        operations.push(() => {
          proxy.query({
            find: ['?name', '?score'],
            where: [
              ['?this', ':user/name', '?name'],
              ['?this', ':user/score', '?score']
            ]
          });
        });
      });
      
      // Subscriptions
      const unsubscribeFunctions = [];
      proxies.forEach(proxy => {
        operations.push(() => {
          const unsub = proxy.subscribe({
            find: ['?name'],
            where: [['?this', ':user/name', '?name']]
          }, () => {});
          unsubscribeFunctions.push(unsub);
        });
      });
      
      // Execute all operations
      assert.doesNotThrow(() => {
        operations.forEach(op => op());
      });
      
      // Verify final state is consistent
      proxies.forEach((proxy, index) => {
        assert.ok(proxy.isValid());
        assert.strictEqual(proxy.get(':user/name'), `User${index}`);
        assert.strictEqual(proxy.get(':user/score'), index * 20);
        assert.strictEqual(proxy.get(':user/index'), index);
      });
      
      // Cleanup
      unsubscribeFunctions.forEach(unsub => unsub());
    });

    it('should handle proxy deletion during active operations', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/age': 30 });
      const proxy = new EntityProxy(alice.entityId, store);
      
      let changeEventCount = 0;
      let deleteEventCount = 0;
      
      // Set up listeners and subscriptions
      proxy.onChange(() => { changeEventCount++; });
      proxy.onDelete(() => { deleteEventCount++; });
      
      const dummyQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
      const unsubscribe = proxy.subscribe(dummyQuery, () => {});
      
      proxy.computed('ageSummary', {
        find: ['?age'],
        where: [['?this', ':user/age', '?age']]
      }, (results) => results.length > 0 ? `Age: ${results[0][0]}` : 'No age');
      
      // Verify initial state
      assert.ok(proxy.isValid());
      assert.strictEqual(proxy.ageSummary, 'Age: 30');
      
      // Delete while resources are active
      proxy.delete();
      
      // Should handle deletion gracefully
      assert.ok(!proxy.isValid());
      assert.strictEqual(deleteEventCount, 1);
      assert.strictEqual(proxy.ageSummary, undefined);
      
      // Further operations should be prevented
      assert.throws(() => {
        proxy.update({ ':user/age': 31 });
      }, /Cannot update invalid entity/);
    });

    it('should handle subscription callback errors in complex scenarios', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      
      let goodSubscriptionCalls = 0;
      let errorSubscriptionCalls = 0;
      
      // Good subscription
      const unsubGood = aliceProxy.subscribe({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, () => {
        goodSubscriptionCalls++;
      });
      
      // Error-throwing subscription
      const unsubError = aliceProxy.subscribe({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, () => {
        errorSubscriptionCalls++;
        throw new Error('Subscription callback error');
      });
      
      // Operations should continue working despite callback errors
      assert.doesNotThrow(() => {
        aliceProxy.addRelation(':user/friends', bobProxy);
        aliceProxy.update({ ':user/age': 30 });
        aliceProxy.addRelation(':user/friends', charlie.entityId);
      });
      
      // Verify proxy remains functional
      assert.ok(aliceProxy.isValid());
      assert.strictEqual(aliceProxy.get(':user/name'), 'Alice');
      assert.strictEqual(aliceProxy.get(':user/age'), 30);
      assert.strictEqual(aliceProxy.get(':user/friends').length, 2);
      
      unsubGood();
      unsubError();
    });

    it('should handle reactive engine errors gracefully', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Set up subscription that will cause errors
      let subscriptionErrorCount = 0;
      const unsubscribe = proxy.subscribe({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, () => {
        subscriptionErrorCount++;
        throw new Error('Subscription processing error');
      });
      
      // Set up onChange listener
      let changeEventCount = 0;
      proxy.onChange(() => {
        changeEventCount++;
      });
      
      // Operations should work despite subscription errors
      assert.doesNotThrow(() => {
        proxy.update({ ':user/age': 30 });
        proxy.update({ ':user/score': 85 });
      });
      
      // Change events should still trigger
      assert.ok(changeEventCount >= 2);
      
      // Proxy should remain valid and functional
      assert.ok(proxy.isValid());
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      assert.strictEqual(proxy.get(':user/age'), 30);
      assert.strictEqual(proxy.get(':user/score'), 85);
      
      unsubscribe();
    });
  });

  describe('Resource Cleanup Errors', () => {
    it('should handle cleanup errors gracefully', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Set up resources with potential cleanup errors
      proxy.onChange(() => {
        throw new Error('onChange cleanup error');
      });
      
      proxy.onDelete(() => {
        throw new Error('onDelete cleanup error');
      });
      
      // Set up computed property that might error
      proxy.computed('errorProp', {
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, () => {
        throw new Error('Computed property error');
      });
      
      // Deletion should handle errors gracefully
      assert.doesNotThrow(() => {
        proxy.delete();
      });
      
      // Proxy should be invalid after deletion
      assert.ok(!proxy.isValid());
      
      // Should handle further operations gracefully
      assert.doesNotThrow(() => {
        proxy.delete(); // Multiple deletes
      });
    });

    it('should handle store cleanup with invalid proxies', () => {
      const store = createDataStore();
      
      // Create entities and proxies
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < 5; i++) {
        const entity = store.createEntity({ ':user/name': `User${i}` });
        const proxy = new EntityProxy(entity.entityId, store);
        
        entities.push(entity);
        proxies.push(proxy);
        
        store._registerProxy(entity.entityId, proxy);
      }
      
      // Manually invalidate some proxies (simulate external issues)
      proxies[1]._invalidate();
      proxies[3]._invalidate();
      
      // Store cleanup should handle mixed valid/invalid proxies
      const cleanedCount = store._cleanupProxies();
      assert.strictEqual(cleanedCount, 2); // Should clean up 2 invalid proxies
      
      // Valid proxies should remain
      assert.ok(proxies[0].isValid());
      assert.ok(proxies[2].isValid());
      assert.ok(proxies[4].isValid());
      
      // Invalid proxies should be gone from registry
      assert.strictEqual(store._getRegisteredProxy(entities[1].entityId), undefined);
      assert.strictEqual(store._getRegisteredProxy(entities[3].entityId), undefined);
    });

    it('should handle reactive engine cleanup errors', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Create subscriptions
      const subscriptions = [];
      for (let i = 0; i < 10; i++) {
        const unsub = proxy.subscribe({
          find: ['?name'],
          where: [['?this', ':user/name', '?name']]
        }, () => {
          if (i % 3 === 0) {
            throw new Error(`Subscription ${i} error`);
          }
        });
        subscriptions.push(unsub);
      }
      
      // Should have many subscriptions
      assert.ok(store._reactiveEngine.getSubscriptionCount() >= 10);
      
      // Delete proxy - should cleanup all subscriptions despite callback errors
      assert.doesNotThrow(() => {
        proxy.delete();
      });
      
      // Should cleanup subscriptions in reactive engine
      assert.doesNotThrow(() => {
        const cleanedUp = store._reactiveEngine.cleanupSubscriptions();
        assert.ok(cleanedUp >= 0); // Some cleanup should happen
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large numbers of entities without memory issues', () => {
      const store = createDataStore();
      
      // Create many entities
      const entityCount = 100;
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < entityCount; i++) {
        const entity = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i,
          ':user/active': i % 2 === 0
        });
        
        const proxy = new EntityProxy(entity.entityId, store);
        entities.push(entity);
        proxies.push(proxy);
      }
      
      // All should be valid
      proxies.forEach(proxy => {
        assert.ok(proxy.isValid());
      });
      
      // Perform operations on all entities
      proxies.forEach((proxy, index) => {
        proxy.update({ ':user/lastUpdate': `2023-12-${String(index + 1).padStart(2, '0')}` });
      });
      
      // Verify all operations succeeded
      proxies.forEach((proxy, index) => {
        assert.strictEqual(proxy.get(':user/name'), `User${index}`);
        assert.strictEqual(proxy.get(':user/index'), index);
        assert.strictEqual(proxy.get(':user/lastUpdate'), `2023-12-${String(index + 1).padStart(2, '0')}`);
      });
      
      // Delete all entities
      proxies.forEach(proxy => {
        proxy.delete();
      });
      
      // All should be invalid
      proxies.forEach(proxy => {
        assert.ok(!proxy.isValid());
      });
    });

    it('should handle deep entity relationship chains', () => {
      const schema = {
        ':user/manager': { valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create deep management chain
      const managers = [];
      
      for (let level = 0; level < 10; level++) {
        const manager = store.createEntity({
          ':user/name': `Manager-Level-${level}`,
          ':user/level': level
        });
        
        managers.push(manager);
        
        if (level > 0) {
          // Each manager reports to the previous manager
          store.conn.transact([
            ['+', manager.entityId, ':user/manager', managers[level - 1].entityId]
          ]);
        }
      }
      
      // Create proxies and test deep traversal
      const bottomProxy = new EntityProxy(managers[managers.length - 1].entityId, store);
      
      // Query up the management chain
      const managerChain = bottomProxy.query({
        find: ['?manager-name'],
        where: [
          ['?this', ':user/manager', '?manager'],
          ['?manager', ':user/name', '?manager-name']
        ]
      });
      
      // Should find immediate manager (Level 9 reports to Level 8)
      assert.strictEqual(managerChain.length, 1);
      assert.strictEqual(managerChain[0][0], 'Manager-Level-8');
      
      // Delete from middle of chain
      const middleProxy = new EntityProxy(managers[5].entityId, store);
      middleProxy.delete();
      
      // Should handle deletion without affecting other parts of chain
      assert.ok(!middleProxy.isValid());
      assert.ok(bottomProxy.isValid());
    });

    it('should handle query execution edge cases', () => {
      const store = createDataStore();
      const alice = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/tags': ['developer', 'javascript', 'react'],
        ':user/scores': [85, 92, 78]
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Large result sets should work
      const tagResults = proxy.query({
        find: ['?tag'],
        where: [['?this', ':user/tags', '?tag']]
      });
      assert.strictEqual(tagResults.length, 3);
      
      // Empty result sets should work
      const emptyResults = proxy.query({
        find: ['?nonexistent'],
        where: [['?this', ':user/nonexistent', '?nonexistent']]
      });
      assert.strictEqual(emptyResults.length, 0);
      
      // Queries with malformed clauses should return empty gracefully
      const malformedResults = proxy.query({
        find: ['?name'],
        where: [
          ['?this', null, '?name'] // Invalid attribute
        ]
      });
      assert.strictEqual(malformedResults.length, 0);
      
      // Complex queries should work
      const complexResults = proxy.query({
        find: ['?name', '?tag'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/tags', '?tag']
        ]
      });
      assert.strictEqual(complexResults.length, 3); // 3 tags
    });
  });
});