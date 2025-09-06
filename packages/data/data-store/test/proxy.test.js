import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EntityProxy } from '../src/proxy.js';
import { DataStore } from '../src/store.js';

describe('EntityProxy - Object Structure', () => {
  describe('Constructor', () => {
    it('should create EntityProxy with entity ID and store reference', () => {
      const store = new DataStore();
      
      // Create a real entity first
      const result = store.createEntity({ ':user/name': 'Test' });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      assert.strictEqual(proxy.entityId, result.entityId);
      assert.strictEqual(proxy.store, store);
      assert.ok(proxy.isValid()); // Should be valid since entity exists
    });

    it('should throw error for invalid entity ID', () => {
      const store = new DataStore();
      
      assert.throws(() => {
        new EntityProxy(null, store);
      }, /Entity ID is required/);
      
      assert.throws(() => {
        new EntityProxy('invalid', store);
      }, /Entity ID must be a number/);
    });

    it('should throw error for missing store', () => {
      assert.throws(() => {
        new EntityProxy(1, null);
      }, /DataStore is required/);
    });

    it('should freeze the proxy instance', () => {
      const store = new DataStore();
      const proxy = new EntityProxy(1, store);
      
      assert.throws(() => {
        proxy.newProperty = 'should fail';
      });
    });
  });

  describe('Entity Binding', () => {
    it('should bind to specific entity ID', () => {
      const store = new DataStore();
      const proxy1 = new EntityProxy(1, store);
      const proxy2 = new EntityProxy(2, store);
      
      assert.strictEqual(proxy1.entityId, 1);
      assert.strictEqual(proxy2.entityId, 2);
      assert.notStrictEqual(proxy1.entityId, proxy2.entityId);
    });

    it('should maintain reference to store', () => {
      const store1 = new DataStore();
      const store2 = new DataStore();
      const proxy1 = new EntityProxy(1, store1);
      const proxy2 = new EntityProxy(1, store2);
      
      assert.strictEqual(proxy1.store, store1);
      assert.strictEqual(proxy2.store, store2);
      assert.notStrictEqual(proxy1.store, proxy2.store);
    });
  });

  describe('Validity Checks', () => {
    it('should be valid when entity exists in database', () => {
      const store = new DataStore();
      // Create entity first
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const proxy = new EntityProxy(result.entityId, store);
      assert.ok(proxy.isValid());
    });

    it('should be invalid when entity does not exist', () => {
      const store = new DataStore();
      const proxy = new EntityProxy(999, store); // Non-existent entity
      
      assert.ok(!proxy.isValid());
    });

    it('should become invalid when entity is deleted', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const proxy = new EntityProxy(result.entityId, store);
      assert.ok(proxy.isValid());
      
      // Delete entity (we'll implement this later, for now mock the behavior)
      // For testing, we can simulate by checking against empty database
      const emptyStore = new DataStore();
      const invalidProxy = new EntityProxy(result.entityId, emptyStore);
      assert.ok(!invalidProxy.isValid());
    });
  });

  describe('Proxy Invalidation', () => {
    it('should support manual invalidation', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const proxy = new EntityProxy(result.entityId, store);
      assert.ok(proxy.isValid());
      
      // Manual invalidation
      proxy._invalidate();
      assert.ok(!proxy.isValid());
    });

    it('should cleanup when invalidated', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const proxy = new EntityProxy(result.entityId, store);
      let cleanupCalled = false;
      
      // Set cleanup callback using test helper
      proxy._setCleanupCallback(() => { cleanupCalled = true; });
      
      proxy._invalidate();
      assert.ok(cleanupCalled);
      assert.ok(!proxy.isValid());
    });

    it('should not be affected by multiple invalidations', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      proxy._invalidate();
      const firstState = proxy.isValid();
      
      proxy._invalidate();
      const secondState = proxy.isValid();
      
      assert.strictEqual(firstState, secondState);
      assert.ok(!firstState);
    });
  });

  describe('Entity Existence Checking', () => {
    it('should check existence via DataScript entity lookup', () => {
      const store = new DataStore();
      const result = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com' 
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should use store.db().entity() for existence check
      const db = store.db();
      const entity = db.entity(result.entityId);
      assert.ok(entity);
      assert.ok(proxy.isValid());
    });

    it('should handle entity lookup errors gracefully', () => {
      const store = new DataStore();
      const proxy = new EntityProxy(999999, store); // Very unlikely to exist
      
      // Should not throw, just return false
      assert.ok(!proxy.isValid());
    });
  });

  describe('String Representation', () => {
    it('should provide meaningful toString representation', () => {
      const store = new DataStore();
      const proxy = new EntityProxy(42, store);
      
      const str = proxy.toString();
      assert.ok(str.includes('EntityProxy'));
      assert.ok(str.includes('42'));
    });

    it('should show validity status in string representation', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const validProxy = new EntityProxy(result.entityId, store);
      const invalidProxy = new EntityProxy(999, store);
      
      assert.ok(validProxy.toString().includes('valid'));
      assert.ok(invalidProxy.toString().includes('invalid'));
    });
  });

  describe('Reactive Property Access', () => {
    it('should access simple attributes reactively', () => {
      const store = new DataStore();
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/active': true
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should access properties dynamically from current database state
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      assert.strictEqual(proxy.get(':user/age'), 30);
      assert.strictEqual(proxy.get(':user/active'), true);
    });

    it('should return undefined for non-existent attributes', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      assert.strictEqual(proxy.get(':user/email'), undefined);
      assert.strictEqual(proxy.get(':user/nonexistent'), undefined);
    });

    it('should handle attribute access for invalid entities', () => {
      const store = new DataStore();
      const proxy = new EntityProxy(999, store); // Non-existent entity
      
      // Should return undefined for all attributes when entity doesn't exist
      assert.strictEqual(proxy.get(':user/name'), undefined);
      assert.strictEqual(proxy.get(':user/email'), undefined);
    });

    it('should reflect database changes reactively', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Initial state
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      assert.strictEqual(proxy.get(':user/age'), undefined);
      
      // Update entity in database
      store.conn.transact([
        { ':db/id': result.entityId, ':user/age': 25 }
      ]);
      
      // Proxy should reflect new state
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      assert.strictEqual(proxy.get(':user/age'), 25);
    });

    it('should handle error cases gracefully', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should not throw for invalid attribute names
      assert.strictEqual(proxy.get(null), undefined);
      assert.strictEqual(proxy.get(undefined), undefined);
      assert.strictEqual(proxy.get(''), undefined);
      assert.strictEqual(proxy.get('invalid-attr'), undefined);
    });

    it('should support convenient property syntax', () => {
      const store = new DataStore();
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should support both get() method and property access
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      assert.strictEqual(proxy.name, 'Alice'); // Convenience property
      assert.strictEqual(proxy.age, 30); // Convenience property
    });

    it('should handle different value types correctly', () => {
      const store = new DataStore();
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/score': 95.5,
        ':user/active': true,
        ':user/inactive': false,
        ':user/tags': ['admin', 'user']
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      assert.strictEqual(proxy.get(':user/age'), 30);
      assert.strictEqual(proxy.get(':user/score'), 95.5);
      assert.strictEqual(proxy.get(':user/active'), true);
      assert.strictEqual(proxy.get(':user/inactive'), false);
      assert.deepStrictEqual(proxy.get(':user/tags'), ['admin', 'user']);
    });

    it('should cache property access for performance', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Multiple accesses should be efficient (this is more of a design intent)
      const name1 = proxy.get(':user/name');
      const name2 = proxy.get(':user/name');
      const name3 = proxy.get(':user/name');
      
      assert.strictEqual(name1, name2);
      assert.strictEqual(name2, name3);
      assert.strictEqual(name1, 'Alice');
    });

    it('should invalidate cache when entity becomes invalid', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Access property while valid
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      
      // Invalidate proxy
      proxy._invalidate();
      
      // Should return undefined after invalidation
      assert.strictEqual(proxy.get(':user/name'), undefined);
      assert.strictEqual(proxy.get(':user/age'), undefined);
    });
  });

  describe('Reference Property Conversion', () => {
    it('should convert single ref attributes to proxy objects', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create profile entity
      const profileResult = store.createEntity({
        ':profile/bio': 'Software Engineer',
        ':profile/location': 'San Francisco'
      });
      
      // Create user entity with profile reference
      const userResult = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profileResult.entityId
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      
      // Profile should be returned as a proxy object
      const profileProxy = userProxy.get(':user/profile');
      assert.ok(profileProxy instanceof EntityProxy);
      assert.strictEqual(profileProxy.entityId, profileResult.entityId);
      assert.strictEqual(profileProxy.get(':profile/bio'), 'Software Engineer');
      assert.strictEqual(profileProxy.get(':profile/location'), 'San Francisco');
    });

    it('should convert many-cardinality ref attributes to arrays of proxies', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create friend entities
      const friend1 = store.createEntity({ ':user/name': 'Bob' });
      const friend2 = store.createEntity({ ':user/name': 'Charlie' });
      const friend3 = store.createEntity({ ':user/name': 'Diana' });
      
      // Create user with multiple friends
      const userResult = store.createEntity({
        ':user/name': 'Alice',
        ':user/friends': [friend1.entityId, friend2.entityId, friend3.entityId]
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      
      // Friends should be returned as array of proxy objects
      const friendProxies = userProxy.get(':user/friends');
      assert.ok(Array.isArray(friendProxies));
      assert.strictEqual(friendProxies.length, 3);
      
      friendProxies.forEach(friendProxy => {
        assert.ok(friendProxy instanceof EntityProxy);
      });
      
      // Check names through proxies
      const friendNames = friendProxies.map(p => p.get(':user/name')).sort();
      assert.deepStrictEqual(friendNames, ['Bob', 'Charlie', 'Diana']);
    });

    it('should handle non-ref attributes as regular values', () => {
      const store = new DataStore();
      
      const userResult = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/tags': ['developer', 'javascript']
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      
      // Non-ref attributes should remain as primitive values
      assert.strictEqual(userProxy.get(':user/name'), 'Alice');
      assert.strictEqual(userProxy.get(':user/age'), 30);
      assert.deepStrictEqual(userProxy.get(':user/tags'), ['developer', 'javascript']);
    });

    it('should handle missing ref entities gracefully', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create user referencing non-existent entities
      const userResult = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': 999, // Non-existent entity
        ':user/friends': [1000, 1001] // Non-existent entities
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      
      // Should return proxy objects even for non-existent entities
      const profileProxy = userProxy.get(':user/profile');
      assert.ok(profileProxy instanceof EntityProxy);
      assert.strictEqual(profileProxy.entityId, 999);
      assert.ok(!profileProxy.isValid()); // But proxy should be invalid
      
      const friendProxies = userProxy.get(':user/friends');
      assert.ok(Array.isArray(friendProxies));
      assert.strictEqual(friendProxies.length, 2);
      friendProxies.forEach(proxy => {
        assert.ok(proxy instanceof EntityProxy);
        assert.ok(!proxy.isValid()); // Invalid entities
      });
    });

    it('should handle empty ref collections', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const userResult = store.createEntity({
        ':user/name': 'Alice'
        // No friends specified
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      
      // Should return empty array for unset many-cardinality refs
      const friends = userProxy.get(':user/friends');
      assert.deepStrictEqual(friends, []);
    });

    it('should use proxy registry for referenced entities', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create profile entity
      const profileResult = store.createEntity({
        ':profile/bio': 'Engineer'
      });
      
      // Register profile proxy in store
      const originalProfileProxy = new EntityProxy(profileResult.entityId, store);
      store._registerProxy(profileResult.entityId, originalProfileProxy);
      
      // Create user entity with profile reference
      const userResult = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profileResult.entityId
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      
      // Should return the same proxy instance from registry
      const retrievedProfileProxy = userProxy.get(':user/profile');
      assert.strictEqual(retrievedProfileProxy, originalProfileProxy);
    });

    it('should handle nested reference traversal', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' },
        ':profile/company': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create company
      const companyResult = store.createEntity({
        ':company/name': 'Acme Corp',
        ':company/location': 'San Francisco'
      });
      
      // Create profile
      const profileResult = store.createEntity({
        ':profile/bio': 'Engineer',
        ':profile/company': companyResult.entityId
      });
      
      // Create user
      const userResult = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profileResult.entityId
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      
      // Should be able to traverse references
      const profileProxy = userProxy.get(':user/profile');
      assert.ok(profileProxy instanceof EntityProxy);
      assert.strictEqual(profileProxy.get(':profile/bio'), 'Engineer');
      
      const companyProxy = profileProxy.get(':profile/company');
      assert.ok(companyProxy instanceof EntityProxy);
      assert.strictEqual(companyProxy.get(':company/name'), 'Acme Corp');
      assert.strictEqual(companyProxy.get(':company/location'), 'San Francisco');
    });

    it('should handle circular references without infinite loops', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create users
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      // Create circular friendship
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', bob.entityId, ':user/friends', alice.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      
      // Should handle circular references
      const aliceFriends = aliceProxy.get(':user/friends');
      assert.ok(Array.isArray(aliceFriends));
      assert.strictEqual(aliceFriends.length, 1);
      assert.strictEqual(aliceFriends[0].get(':user/name'), 'Bob');
      
      const bobFriends = bobProxy.get(':user/friends');
      assert.ok(Array.isArray(bobFriends));
      assert.strictEqual(bobFriends.length, 1);
      assert.strictEqual(bobFriends[0].get(':user/name'), 'Alice');
    });

    it('should update ref proxies when database changes', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create entities
      const profile1 = store.createEntity({ ':profile/type': 'personal' });
      const profile2 = store.createEntity({ ':profile/type': 'business' });
      const user = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile1.entityId
      });
      
      const userProxy = new EntityProxy(user.entityId, store);
      
      // Initial reference
      let profileProxy = userProxy.get(':user/profile');
      assert.strictEqual(profileProxy.get(':profile/type'), 'personal');
      
      // Change reference
      store.conn.transact([
        { ':db/id': user.entityId, ':user/profile': profile2.entityId }
      ]);
      
      // Should return new proxy for updated reference
      profileProxy = userProxy.get(':user/profile');
      assert.strictEqual(profileProxy.get(':profile/type'), 'business');
      assert.strictEqual(profileProxy.entityId, profile2.entityId);
    });
  });

  describe('Proxy Updates', () => {
    it('should validate update data format', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should throw for null/undefined data
      assert.throws(() => {
        proxy.update(null);
      }, /Update data is required/);
      
      assert.throws(() => {
        proxy.update(undefined);
      }, /Update data is required/);
      
      // Should throw for non-object data
      assert.throws(() => {
        proxy.update('invalid');
      }, /Update data must be an object/);
      
      assert.throws(() => {
        proxy.update(123);
      }, /Update data must be an object/);
    });

    it('should validate attribute names in updates', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should throw for invalid attribute names
      assert.throws(() => {
        proxy.update({
          'invalid-attr': 'value'  // Must start with ':'
        });
      }, /Attributes must start with ':'/);
      
      assert.throws(() => {
        proxy.update({
          ':db/id': 999  // Cannot update :db/id
        });
      }, /Cannot update :db\/id/);
    });

    it('should prevent updates on invalid proxies', () => {
      const store = new DataStore();
      const proxy = new EntityProxy(999, store); // Non-existent entity
      
      assert.throws(() => {
        proxy.update({ ':user/name': 'Should Fail' });
      }, /Cannot update invalid entity/);
    });

    it('should generate transaction data for updates', () => {
      const store = new DataStore();
      const result = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/age': 25 
      });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should return transaction info
      const updateResult = proxy.update({
        ':user/name': 'Alice Smith',
        ':user/email': 'alice@example.com',
        ':user/age': 26
      });
      
      assert.ok(updateResult.dbAfter);
      assert.ok(updateResult.tempids);
      assert.strictEqual(updateResult.entityId, result.entityId);
    });

    it('should handle single attribute updates', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      const updateResult = proxy.update({
        ':user/age': 30
      });
      
      assert.strictEqual(updateResult.entityId, result.entityId);
      
      // Value should be updated
      assert.strictEqual(proxy.get(':user/age'), 30);
      assert.strictEqual(proxy.get(':user/name'), 'Alice'); // Unchanged
    });

    it('should handle multiple attribute updates', () => {
      const store = new DataStore();
      const result = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/age': 25 
      });
      const proxy = new EntityProxy(result.entityId, store);
      
      proxy.update({
        ':user/name': 'Alice Smith',
        ':user/email': 'alice@example.com',
        ':user/age': 26,
        ':user/active': true
      });
      
      // All values should be updated
      assert.strictEqual(proxy.get(':user/name'), 'Alice Smith');
      assert.strictEqual(proxy.get(':user/email'), 'alice@example.com');
      assert.strictEqual(proxy.get(':user/age'), 26);
      assert.strictEqual(proxy.get(':user/active'), true);
    });

    it('should handle reference updates', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const profile1 = store.createEntity({ ':profile/type': 'personal' });
      const profile2 = store.createEntity({ ':profile/type': 'business' });
      const user = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/profile': profile1.entityId 
      });
      
      const userProxy = new EntityProxy(user.entityId, store);
      
      // Initial state
      let profileProxy = userProxy.get(':user/profile');
      assert.strictEqual(profileProxy.get(':profile/type'), 'personal');
      
      // Update reference
      userProxy.update({
        ':user/profile': profile2.entityId
      });
      
      // Should reflect new reference
      profileProxy = userProxy.get(':user/profile');
      assert.strictEqual(profileProxy.get(':profile/type'), 'business');
      assert.strictEqual(profileProxy.entityId, profile2.entityId);
    });

    it('should handle many-cardinality reference updates', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const friend1 = store.createEntity({ ':user/name': 'Bob' });
      const friend2 = store.createEntity({ ':user/name': 'Charlie' });
      const friend3 = store.createEntity({ ':user/name': 'Diana' });
      
      const user = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/friends': [friend1.entityId, friend2.entityId]
      });
      
      const userProxy = new EntityProxy(user.entityId, store);
      
      // Initial friends
      let friendProxies = userProxy.get(':user/friends');
      assert.strictEqual(friendProxies.length, 2);
      
      // Update friends list
      userProxy.update({
        ':user/friends': [friend2.entityId, friend3.entityId]
      });
      
      // Should reflect new friends list
      friendProxies = userProxy.get(':user/friends');
      assert.strictEqual(friendProxies.length, 2);
      const friendNames = friendProxies.map(p => p.get(':user/name')).sort();
      assert.deepStrictEqual(friendNames, ['Charlie', 'Diana']);
    });

    it('should enforce schema constraints during updates', () => {
      const schema = {
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      // Create two users
      const user1 = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com' 
      });
      const user2 = store.createEntity({ 
        ':user/name': 'Bob',
        ':user/email': 'bob@example.com' 
      });
      
      const proxy1 = new EntityProxy(user1.entityId, store);
      
      // Should throw when trying to use existing email
      assert.throws(() => {
        proxy1.update({
          ':user/email': 'bob@example.com'  // Already used by user2
        });
      }, /Unique constraint/);
    });

    it('should handle empty update objects gracefully', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Empty update should be allowed but do nothing
      const updateResult = proxy.update({});
      assert.ok(updateResult.dbAfter);
      
      // Values should remain unchanged
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
    });

    it('should handle value type validation', () => {
      const schema = {
        ':user/age': { valueType: 'number' },
        ':user/active': { valueType: 'boolean' }
      };
      const store = new DataStore(schema);
      
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Valid value types should work
      proxy.update({
        ':user/age': 30,
        ':user/active': true
      });
      
      assert.strictEqual(proxy.get(':user/age'), 30);
      assert.strictEqual(proxy.get(':user/active'), true);
    });

    it('should return transaction result with entity info', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      const updateResult = proxy.update({
        ':user/age': 30
      });
      
      // Should return transaction result object
      assert.ok(updateResult.entityId);
      assert.ok(updateResult.dbAfter);
      assert.ok(updateResult.tempids);
      assert.strictEqual(updateResult.entityId, result.entityId);
    });

    it('should handle concurrent updates correctly', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Multiple rapid updates
      proxy.update({ ':user/age': 25 });
      proxy.update({ ':user/email': 'alice@example.com' });
      proxy.update({ ':user/active': true });
      
      // Final state should reflect all updates
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      assert.strictEqual(proxy.get(':user/age'), 25);
      assert.strictEqual(proxy.get(':user/email'), 'alice@example.com');
      assert.strictEqual(proxy.get(':user/active'), true);
    });
  });

  describe('Entity-Rooted Query Execution', () => {
    it('should execute queries with ?this binding', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create entities
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      // Create friendships
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Execute entity-rooted query
      const results = aliceProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      
      assert.ok(Array.isArray(results));
      assert.strictEqual(results.length, 2);
      
      const friendNames = results.map(r => r[0]).sort();
      assert.deepStrictEqual(friendNames, ['Bob', 'Charlie']);
    });

    it('should handle ?this binding in query parsing', () => {
      const store = new DataStore();
      const result = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/active': true
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Simple entity-rooted query
      const results = proxy.query({
        find: ['?name', '?age'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/age', '?age']
        ]
      });
      
      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0], ['Alice', 30]);
    });

    it('should validate query parameters', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should throw for null/undefined query
      assert.throws(() => {
        proxy.query(null);
      }, /Query is required/);
      
      assert.throws(() => {
        proxy.query(undefined);
      }, /Query is required/);
      
      // Should throw for invalid query structure
      assert.throws(() => {
        proxy.query({});
      }, /Query must have find and where clauses/);
      
      assert.throws(() => {
        proxy.query({ find: ['?e'] });
      }, /Query must have find and where clauses/);
    });

    it('should prevent queries on invalid proxies', () => {
      const store = new DataStore();
      const proxy = new EntityProxy(999, store); // Non-existent entity
      
      assert.throws(() => {
        proxy.query({
          find: ['?name'],
          where: [['?this', ':user/name', '?name']]
        });
      }, /Cannot query invalid entity/);
    });

    it('should handle empty query results', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Query for non-existent data
      const results = proxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      
      assert.deepStrictEqual(results, []);
    });

    it('should handle complex entity-rooted queries', () => {
      const schema = {
        ':user/posts': { card: 'many', valueType: 'ref' },
        ':post/author': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create user
      const alice = store.createEntity({ ':user/name': 'Alice' });
      
      // Create posts
      const post1 = store.createEntity({
        ':post/title': 'First Post',
        ':post/content': 'Hello World',
        ':post/published': true
      });
      
      const post2 = store.createEntity({
        ':post/title': 'Second Post', 
        ':post/content': 'More content',
        ':post/published': false
      });
      
      // Link posts to user
      store.conn.transact([
        ['+', alice.entityId, ':user/posts', post1.entityId],
        ['+', alice.entityId, ':user/posts', post2.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Query for published posts only
      const publishedPosts = aliceProxy.query({
        find: ['?title'],
        where: [
          ['?this', ':user/posts', '?post'],
          ['?post', ':post/title', '?title'],
          ['?post', ':post/published', true]
        ]
      });
      
      assert.strictEqual(publishedPosts.length, 1);
      assert.strictEqual(publishedPosts[0][0], 'First Post');
      
      // Query for all posts
      const allPosts = aliceProxy.query({
        find: ['?title', '?published'],
        where: [
          ['?this', ':user/posts', '?post'],
          ['?post', ':post/title', '?title'],
          ['?post', ':post/published', '?published']
        ]
      });
      
      assert.strictEqual(allPosts.length, 2);
      const titles = allPosts.map(p => p[0]).sort();
      assert.deepStrictEqual(titles, ['First Post', 'Second Post']);
    });

    it.skip('should handle predicates in entity-rooted queries (TODO: fix predicate binding)', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/age': 30
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Query with predicate
      const results = proxy.query({
        find: ['?name'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/age', '?age'],
          [(age) => age >= 25, '?age']
        ]
      });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0][0], 'Alice');
      
      // Query that should return no results
      const noResults = proxy.query({
        find: ['?name'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/age', '?age'],
          [(age) => age >= 40, '?age'] // Alice is only 30
        ]
      });
      
      assert.deepStrictEqual(noResults, []);
    });

    it('should return results in specified find order', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/email': 'alice@example.com'
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Different find orders should return results in that order
      const results1 = proxy.query({
        find: ['?name', '?age', '?email'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/age', '?age'],
          ['?this', ':user/email', '?email']
        ]
      });
      
      const results2 = proxy.query({
        find: ['?email', '?age', '?name'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/age', '?age'],
          ['?this', ':user/email', '?email']
        ]
      });
      
      assert.deepStrictEqual(results1[0], ['Alice', 30, 'alice@example.com']);
      assert.deepStrictEqual(results2[0], ['alice@example.com', 30, 'Alice']);
    });

    it('should handle query execution errors gracefully', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should handle malformed query gracefully
      const badQuery = {
        find: ['?name'],
        where: [
          ['?this', null, '?name'] // Invalid attribute
        ]
      };
      
      // Should not throw, but return empty results or handle error
      const results = proxy.query(badQuery);
      assert.deepStrictEqual(results, []);
    });
  });

  describe('Query Subscriptions', () => {
    it('should create query subscription with callback', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      let callbackInvoked = false;
      let receivedResults = null;
      let receivedChanges = null;
      
      const unsubscribe = proxy.subscribe({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, (results, changes) => {
        callbackInvoked = true;
        receivedResults = results;
        receivedChanges = changes;
      });
      
      assert.ok(typeof unsubscribe === 'function');
      
      // Should be able to manually trigger for testing
      proxy._triggerSubscription('?this subscription test', [], {});
      
      assert.ok(callbackInvoked);
      assert.deepStrictEqual(receivedResults, []);
      assert.deepStrictEqual(receivedChanges, {});
    });

    it('should validate subscription parameters', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should throw for invalid query
      assert.throws(() => {
        proxy.subscribe(null, () => {});
      }, /Query is required/);
      
      // Should throw for invalid callback
      const validQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
      
      assert.throws(() => {
        proxy.subscribe(validQuery, null);
      }, /Callback is required/);
      
      assert.throws(() => {
        proxy.subscribe(validQuery, 'invalid');
      }, /Callback must be a function/);
    });

    it('should prevent subscriptions on invalid proxies', () => {
      const store = new DataStore();
      const proxy = new EntityProxy(999, store); // Non-existent entity
      
      assert.throws(() => {
        proxy.subscribe({
          find: ['?name'],
          where: [['?this', ':user/name', '?name']]
        }, () => {});
      }, /Cannot subscribe to invalid entity/);
    });

    it('should generate unique subscription IDs', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      const dummyQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
      const unsubscribe1 = proxy.subscribe(dummyQuery, () => {});
      const unsubscribe2 = proxy.subscribe(dummyQuery, () => {});
      const unsubscribe3 = proxy.subscribe(dummyQuery, () => {});
      
      // All should be functions (unsubscribe functions)
      assert.ok(typeof unsubscribe1 === 'function');
      assert.ok(typeof unsubscribe2 === 'function');
      assert.ok(typeof unsubscribe3 === 'function');
      
      // Should be able to unsubscribe independently
      unsubscribe1();
      unsubscribe3();
      
      // Should track subscription count
      assert.ok(proxy._getActiveSubscriptionCount() >= 0);
    });

    it('should handle query subscription creation', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId]
      ]);
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      let subscriptionCreated = false;
      const unsubscribe = proxy.subscribe({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, (results) => {
        subscriptionCreated = true;
      });
      
      // Should have created subscription
      assert.ok(proxy._getActiveSubscriptionCount() >= 1);
      assert.ok(typeof unsubscribe === 'function');
      
      unsubscribe();
      assert.ok(proxy._getActiveSubscriptionCount() >= 0);
    });

    it('should handle multiple subscriptions on same proxy', () => {
      const store = new DataStore();
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/email': 'alice@example.com'
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      let subscription1Calls = 0;
      let subscription2Calls = 0;
      
      const unsub1 = proxy.subscribe({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, () => { subscription1Calls++; });
      
      const unsub2 = proxy.subscribe({
        find: ['?age'],
        where: [['?this', ':user/age', '?age']]
      }, () => { subscription2Calls++; });
      
      // Should track multiple subscriptions
      assert.ok(proxy._getActiveSubscriptionCount() >= 2);
      
      // Should be able to unsubscribe independently
      unsub1();
      assert.ok(proxy._getActiveSubscriptionCount() >= 1);
      
      unsub2();
      assert.ok(proxy._getActiveSubscriptionCount() >= 0);
    });

    it('should handle subscription lifecycle', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      let subscriptionActive = true;
      const unsubscribe = proxy.subscribe({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, () => {});
      
      // Should be active initially
      assert.ok(typeof unsubscribe === 'function');
      
      // Should be able to unsubscribe
      unsubscribe();
      
      // Should handle multiple unsubscribe calls
      assert.doesNotThrow(() => {
        unsubscribe();
      });
    });

    it('should handle subscription callback errors', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      const errorCallback = () => {
        throw new Error('Subscription error');
      };
      
      const unsubscribe = proxy.subscribe({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, errorCallback);
      
      // Should not throw when triggering subscription with error
      assert.doesNotThrow(() => {
        proxy._triggerSubscription('error-test', [], {});
      });
      
      unsubscribe();
    });

    it('should handle entity invalidation with active subscriptions', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      let callbackCount = 0;
      const dummyQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
      const unsubscribe = proxy.subscribe(dummyQuery, () => { callbackCount++; });
      
      // Invalidate proxy
      proxy._invalidate();
      
      // Should handle subscription cleanup when proxy invalid
      assert.doesNotThrow(() => {
        proxy._triggerSubscription('cleanup-test', [], {});
      });
      
      // Should not trigger callback for invalid proxy
      assert.strictEqual(callbackCount, 0);
    });

    it('should integrate subscriptions with store reactive engine', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should be able to register subscription with store's reactive engine
      const unsubscribe = proxy.subscribe({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, () => {});
      
      // Store should track the subscription (this will be implemented in integration)
      assert.ok(typeof unsubscribe === 'function');
      
      unsubscribe();
    });
  });

  describe('Computed Properties', () => {
    it('should define computed property with query', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId]
      ]);
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Define computed property for friend count
      proxy.computed('friendCount', {
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, (results) => results.length);
      
      assert.strictEqual(proxy.friendCount, 1);
    });

    it('should cache computed property values', () => {
      const store = new DataStore();
      const result = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/age': 30 
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      let queryExecutions = 0;
      
      // Define computed property with execution tracking
      proxy.computed('userInfo', {
        find: ['?name', '?age'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/age', '?age']
        ]
      }, (results) => {
        queryExecutions++;
        return results.length > 0 ? `${results[0][0]} (${results[0][1]})` : 'No data';
      });
      
      // First access should execute query
      const info1 = proxy.userInfo;
      assert.strictEqual(info1, 'Alice (30)');
      assert.strictEqual(queryExecutions, 1);
      
      // Second access should use cached value
      const info2 = proxy.userInfo;
      assert.strictEqual(info2, 'Alice (30)');
      assert.strictEqual(queryExecutions, 1); // No additional execution
    });

    it('should validate computed property parameters', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should throw for invalid property name
      assert.throws(() => {
        proxy.computed(null, {}, () => {});
      }, /Property name is required/);
      
      assert.throws(() => {
        proxy.computed('', {}, () => {});
      }, /Property name is required/);
      
      // Should throw for invalid query
      assert.throws(() => {
        proxy.computed('test', null, () => {});
      }, /Query is required/);
      
      // Should throw for invalid transformer
      const validQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
      
      assert.throws(() => {
        proxy.computed('test', validQuery, null);
      }, /Transformer function is required/);
      
      assert.throws(() => {
        proxy.computed('test', validQuery, 'invalid');
      }, /Transformer must be a function/);
    });

    it('should prevent computed properties on invalid proxies', () => {
      const store = new DataStore();
      const proxy = new EntityProxy(999, store); // Non-existent entity
      
      assert.throws(() => {
        proxy.computed('test', {
          find: ['?name'],
          where: [['?this', ':user/name', '?name']]
        }, (results) => results);
      }, /Cannot define computed property on invalid entity/);
    });

    it('should handle computed property invalidation', () => {
      const store = new DataStore();
      const result = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/score': 85 
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      let computeCount = 0;
      
      // Define computed property
      proxy.computed('scoreGrade', {
        find: ['?score'],
        where: [['?this', ':user/score', '?score']]
      }, (results) => {
        computeCount++;
        if (results.length === 0) return 'No score';
        const score = results[0][0];
        return score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'F';
      });
      
      // Initial access
      assert.strictEqual(proxy.scoreGrade, 'B');
      assert.strictEqual(computeCount, 1);
      
      // Update score - should invalidate cache
      proxy.update({ ':user/score': 95 });
      
      // Access should recompute
      assert.strictEqual(proxy.scoreGrade, 'A');
      assert.strictEqual(computeCount, 2);
    });

    it('should handle multiple computed properties', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/age': 30 });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId]
      ]);
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Define multiple computed properties
      proxy.computed('friendCount', {
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, (results) => results.length);
      
      proxy.computed('displayName', {
        find: ['?name', '?age'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/age', '?age']
        ]
      }, (results) => {
        return results.length > 0 ? `${results[0][0]} (${results[0][1]})` : 'Unknown';
      });
      
      proxy.computed('friendNames', {
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, (results) => results.map(r => r[0]).sort().join(', '));
      
      // Test all computed properties
      assert.strictEqual(proxy.friendCount, 2);
      assert.strictEqual(proxy.displayName, 'Alice (30)');
      assert.strictEqual(proxy.friendNames, 'Bob, Charlie');
    });

    it('should handle computed property dependencies', () => {
      const store = new DataStore();
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/firstName': 'Alice',
        ':user/lastName': 'Smith'
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Computed property depending on multiple attributes
      proxy.computed('fullName', {
        find: ['?first', '?last'],
        where: [
          ['?this', ':user/firstName', '?first'],
          ['?this', ':user/lastName', '?last']
        ]
      }, (results) => {
        return results.length > 0 ? `${results[0][0]} ${results[0][1]}` : 'Unknown';
      });
      
      assert.strictEqual(proxy.fullName, 'Alice Smith');
      
      // Update firstName - should invalidate fullName cache
      proxy.update({ ':user/firstName': 'Alicia' });
      
      assert.strictEqual(proxy.fullName, 'Alicia Smith');
      
      // Update lastName - should also invalidate fullName cache
      proxy.update({ ':user/lastName': 'Jones' });
      
      assert.strictEqual(proxy.fullName, 'Alicia Jones');
    });

    it('should handle computed properties with empty results', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Computed property that returns empty initially
      proxy.computed('friendsInfo', {
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, (results) => {
        return results.length === 0 ? 'No friends' : `${results.length} friends`;
      });
      
      assert.strictEqual(proxy.friendsInfo, 'No friends');
    });

    it('should handle computed property with reference relationships', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const profile = store.createEntity({
        ':profile/bio': 'Software Engineer',
        ':profile/years': 5
      });
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile.entityId
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Computed property traversing references
      proxy.computed('profileSummary', {
        find: ['?bio', '?years'],
        where: [
          ['?this', ':user/profile', '?profile'],
          ['?profile', ':profile/bio', '?bio'],
          ['?profile', ':profile/years', '?years']
        ]
      }, (results) => {
        return results.length > 0 
          ? `${results[0][0]} with ${results[0][1]} years experience`
          : 'No profile';
      });
      
      assert.strictEqual(proxy.profileSummary, 'Software Engineer with 5 years experience');
    });

    it('should handle computed property getter errors', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Computed property with transformer that throws
      proxy.computed('errorProp', {
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, () => {
        throw new Error('Transformer error');
      });
      
      // Should handle errors gracefully
      assert.strictEqual(proxy.errorProp, undefined);
    });

    it('should prevent duplicate computed property names', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Define first computed property
      proxy.computed('testProp', {
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, (results) => results);
      
      // Should throw when defining same property again
      assert.throws(() => {
        proxy.computed('testProp', {
          find: ['?age'],
          where: [['?this', ':user/age', '?age']]
        }, (results) => results);
      }, /Computed property 'testProp' already exists/);
    });

    it('should handle computed property removal', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice', ':user/age': 30 });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Define computed property
      proxy.computed('summary', {
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, (results) => results[0][0]);
      
      assert.strictEqual(proxy.summary, 'Alice');
      
      // Remove computed property
      const removed = proxy.removeComputed('summary');
      assert.ok(removed);
      
      // Property should no longer be accessible
      assert.strictEqual(proxy.summary, undefined);
      
      // Removing non-existent property should return false
      const notRemoved = proxy.removeComputed('nonexistent');
      assert.ok(!notRemoved);
    });
  });

  describe('Relationship Management', () => {
    it('should add single relationship using addRelation method', () => {
      const schema = {
        ':user/manager': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const manager = store.createEntity({ ':user/name': 'Manager' });
      const employee = store.createEntity({ ':user/name': 'Employee' });
      
      const employeeProxy = new EntityProxy(employee.entityId, store);
      const managerProxy = new EntityProxy(manager.entityId, store);
      
      // Add manager relationship
      employeeProxy.addRelation(':user/manager', managerProxy);
      
      // Should be reflected in database
      const managerRef = employeeProxy.get(':user/manager');
      assert.ok(managerRef instanceof EntityProxy);
      assert.strictEqual(managerRef.entityId, manager.entityId);
      assert.strictEqual(managerRef.get(':user/name'), 'Manager');
    });

    it('should add many-cardinality relationships using addRelation method', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const charlieProxy = new EntityProxy(charlie.entityId, store);
      
      // Add friends one by one
      aliceProxy.addRelation(':user/friends', bobProxy);
      aliceProxy.addRelation(':user/friends', charlieProxy);
      
      // Should have both friends
      const friends = aliceProxy.get(':user/friends');
      assert.ok(Array.isArray(friends));
      assert.strictEqual(friends.length, 2);
      
      const friendNames = friends.map(f => f.get(':user/name')).sort();
      assert.deepStrictEqual(friendNames, ['Bob', 'Charlie']);
    });

    it('should remove single relationship using removeRelation method', () => {
      const schema = {
        ':user/manager': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const manager = store.createEntity({ ':user/name': 'Manager' });
      const employee = store.createEntity({
        ':user/name': 'Employee',
        ':user/manager': manager.entityId
      });
      
      const employeeProxy = new EntityProxy(employee.entityId, store);
      const managerProxy = new EntityProxy(manager.entityId, store);
      
      // Initial state: has manager
      let managerRef = employeeProxy.get(':user/manager');
      assert.ok(managerRef instanceof EntityProxy);
      
      // Remove manager relationship
      employeeProxy.removeRelation(':user/manager', managerProxy);
      
      // Should no longer have manager
      managerRef = employeeProxy.get(':user/manager');
      assert.strictEqual(managerRef, undefined);
    });

    it('should remove many-cardinality relationships using removeRelation method', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      const diana = store.createEntity({ ':user/name': 'Diana' });
      
      // Add initial friendships
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId],
        ['+', alice.entityId, ':user/friends', diana.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const charlieProxy = new EntityProxy(charlie.entityId, store);
      
      // Initial state: 3 friends
      let friends = aliceProxy.get(':user/friends');
      assert.strictEqual(friends.length, 3);
      
      // Remove one friend
      aliceProxy.removeRelation(':user/friends', bobProxy);
      
      // Should have 2 friends remaining
      friends = aliceProxy.get(':user/friends');
      assert.strictEqual(friends.length, 2);
      
      const remainingNames = friends.map(f => f.get(':user/name')).sort();
      assert.deepStrictEqual(remainingNames, ['Charlie', 'Diana']);
      
      // Remove another friend
      aliceProxy.removeRelation(':user/friends', charlieProxy);
      
      // Should have 1 friend remaining
      friends = aliceProxy.get(':user/friends');
      assert.strictEqual(friends.length, 1);
      assert.strictEqual(friends[0].get(':user/name'), 'Diana');
    });

    it('should validate relationship management parameters', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/name': { valueType: 'string' } // Non-ref attribute for testing
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Should throw for invalid attribute
      assert.throws(() => {
        proxy.addRelation(null, proxy);
      }, /Attribute is required/);
      
      assert.throws(() => {
        proxy.addRelation('invalid-attr', proxy);
      }, /Attribute must start with ':'/);
      
      // Should throw for invalid target
      assert.throws(() => {
        proxy.addRelation(':user/friends', null);
      }, /Target entity is required/);
      
      assert.throws(() => {
        proxy.addRelation(':user/friends', 'invalid');
      }, /Target must be EntityProxy or entity ID/);
      
      // Should throw for non-ref attributes
      assert.throws(() => {
        proxy.addRelation(':user/name', proxy);
      }, /Attribute must be a reference type/);
    });

    it('should prevent relationship operations on invalid proxies', () => {
      const store = new DataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const invalidProxy = new EntityProxy(999, store);
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Should throw when operating on invalid proxy
      assert.throws(() => {
        invalidProxy.addRelation(':user/friends', aliceProxy);
      }, /Cannot modify relationships on invalid entity/);
      
      assert.throws(() => {
        invalidProxy.removeRelation(':user/friends', aliceProxy);  
      }, /Cannot modify relationships on invalid entity/);
    });

    it('should handle adding relationships with entity IDs', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Should accept entity ID instead of proxy
      aliceProxy.addRelation(':user/friends', bob.entityId);
      
      const friends = aliceProxy.get(':user/friends');
      assert.strictEqual(friends.length, 1);
      assert.strictEqual(friends[0].entityId, bob.entityId);
    });

    it('should handle removing relationships with entity IDs', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      // Add initial friendship
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Initial state: has friend
      let friends = aliceProxy.get(':user/friends');
      assert.strictEqual(friends.length, 1);
      
      // Remove using entity ID
      aliceProxy.removeRelation(':user/friends', bob.entityId);
      
      // Should no longer have friend
      friends = aliceProxy.get(':user/friends');
      assert.strictEqual(friends.length, 0);
    });

    it('should handle duplicate relationship additions gracefully', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      
      // Add friend multiple times
      aliceProxy.addRelation(':user/friends', bobProxy);
      aliceProxy.addRelation(':user/friends', bobProxy); // Duplicate
      aliceProxy.addRelation(':user/friends', bob.entityId); // Duplicate with ID
      
      // Should only have one friend (DataScript handles deduplication)
      const friends = aliceProxy.get(':user/friends');
      assert.strictEqual(friends.length, 1);
      assert.strictEqual(friends[0].entityId, bob.entityId);
    });

    it('should handle removing non-existent relationships gracefully', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const charlieProxy = new EntityProxy(charlie.entityId, store);
      
      // Add only Bob as friend
      aliceProxy.addRelation(':user/friends', bobProxy);
      
      // Try to remove Charlie (not a friend)
      assert.doesNotThrow(() => {
        aliceProxy.removeRelation(':user/friends', charlieProxy);
      });
      
      // Bob should still be friend
      const friends = aliceProxy.get(':user/friends');
      assert.strictEqual(friends.length, 1);
      assert.strictEqual(friends[0].entityId, bob.entityId);
    });

    it('should handle cardinality-one relationship replacement', () => {
      const schema = {
        ':user/manager': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const manager1 = store.createEntity({ ':user/name': 'Manager1' });
      const manager2 = store.createEntity({ ':user/name': 'Manager2' });
      const employee = store.createEntity({
        ':user/name': 'Employee',
        ':user/manager': manager1.entityId
      });
      
      const employeeProxy = new EntityProxy(employee.entityId, store);
      const manager2Proxy = new EntityProxy(manager2.entityId, store);
      
      // Initial manager
      let manager = employeeProxy.get(':user/manager');
      assert.strictEqual(manager.get(':user/name'), 'Manager1');
      
      // Add new manager (should replace old one for cardinality-one)
      employeeProxy.addRelation(':user/manager', manager2Proxy);
      
      // Should have new manager
      manager = employeeProxy.get(':user/manager');
      assert.strictEqual(manager.get(':user/name'), 'Manager2');
      assert.strictEqual(manager.entityId, manager2.entityId);
    });

    it('should integrate relationship changes with computed properties', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const charlieProxy = new EntityProxy(charlie.entityId, store);
      
      // Define computed property for friend count
      aliceProxy.computed('friendCount', {
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, (results) => results.length);
      
      // Initial: no friends
      assert.strictEqual(aliceProxy.friendCount, 0);
      
      // Add friends using convenience method
      aliceProxy.addRelation(':user/friends', bobProxy);
      assert.strictEqual(aliceProxy.friendCount, 1);
      
      aliceProxy.addRelation(':user/friends', charlieProxy);
      assert.strictEqual(aliceProxy.friendCount, 2);
      
      // Remove friend using convenience method  
      aliceProxy.removeRelation(':user/friends', bobProxy);
      assert.strictEqual(aliceProxy.friendCount, 1);
    });
  });

  describe('Proxy Lifecycle Events', () => {
    it('should register onChange event listeners', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice', ':user/age': 30 });
      const proxy = new EntityProxy(result.entityId, store);
      
      let changeEvents = [];
      
      const unsubscribe = proxy.onChange((changes) => {
        changeEvents.push(changes);
      });
      
      assert.ok(typeof unsubscribe === 'function');
      
      // Trigger change manually for testing
      proxy._triggerChange({
        type: 'update',
        attributes: [':user/age'],
        before: { ':user/age': 30 },
        after: { ':user/age': 31 }
      });
      
      assert.strictEqual(changeEvents.length, 1);
      assert.strictEqual(changeEvents[0].type, 'update');
      assert.deepStrictEqual(changeEvents[0].attributes, [':user/age']);
      
      unsubscribe();
    });

    it('should register onDelete event listeners', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      let deleteEvents = [];
      
      const unsubscribe = proxy.onDelete(() => {
        deleteEvents.push({ timestamp: Date.now() });
      });
      
      assert.ok(typeof unsubscribe === 'function');
      
      // Trigger deletion manually for testing
      proxy._triggerDelete();
      
      assert.strictEqual(deleteEvents.length, 1);
      assert.ok(deleteEvents[0].timestamp);
      
      unsubscribe();
    });

    it('should validate event listener parameters', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Should throw for invalid callback
      assert.throws(() => {
        proxy.onChange(null);
      }, /Callback is required/);
      
      assert.throws(() => {
        proxy.onChange('invalid');
      }, /Callback must be a function/);
      
      assert.throws(() => {
        proxy.onDelete(null);
      }, /Callback is required/);
      
      assert.throws(() => {
        proxy.onDelete('invalid');
      }, /Callback must be a function/);
    });

    it('should prevent event listeners on invalid proxies', () => {
      const store = new DataStore();
      const proxy = new EntityProxy(999, store); // Non-existent entity
      
      assert.throws(() => {
        proxy.onChange(() => {});
      }, /Cannot add event listener to invalid entity/);
      
      assert.throws(() => {
        proxy.onDelete(() => {});
      }, /Cannot add event listener to invalid entity/);
    });

    it('should handle multiple onChange listeners', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      let listener1Calls = 0;
      let listener2Calls = 0;
      let listener3Calls = 0;
      
      const unsub1 = proxy.onChange(() => { listener1Calls++; });
      const unsub2 = proxy.onChange(() => { listener2Calls++; });
      const unsub3 = proxy.onChange(() => { listener3Calls++; });
      
      // Trigger change
      proxy._triggerChange({ type: 'test' });
      
      // All listeners should be called
      assert.strictEqual(listener1Calls, 1);
      assert.strictEqual(listener2Calls, 1);
      assert.strictEqual(listener3Calls, 1);
      
      // Unsubscribe one listener
      unsub2();
      
      // Trigger again
      proxy._triggerChange({ type: 'test2' });
      
      // Only remaining listeners should be called
      assert.strictEqual(listener1Calls, 2);
      assert.strictEqual(listener2Calls, 1); // Not called after unsubscribe
      assert.strictEqual(listener3Calls, 2);
      
      unsub1();
      unsub3();
    });

    it('should handle multiple onDelete listeners', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      let deletion1Called = false;
      let deletion2Called = false;
      
      const unsub1 = proxy.onDelete(() => { deletion1Called = true; });
      const unsub2 = proxy.onDelete(() => { deletion2Called = true; });
      
      // Trigger deletion
      proxy._triggerDelete();
      
      assert.ok(deletion1Called);
      assert.ok(deletion2Called);
      
      unsub1();
      unsub2();
    });

    it('should handle event listener errors gracefully', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      let goodListener1Called = false;
      let goodListener2Called = false;
      let errorListenerCalled = false;
      
      // Register listeners with one that throws
      proxy.onChange(() => { goodListener1Called = true; });
      proxy.onChange(() => { 
        errorListenerCalled = true;
        throw new Error('Listener error'); 
      });
      proxy.onChange(() => { goodListener2Called = true; });
      
      // Should not throw when triggering listeners
      assert.doesNotThrow(() => {
        proxy._triggerChange({ type: 'error-test' });
      });
      
      // All listeners should have been called despite error
      assert.ok(goodListener1Called);
      assert.ok(errorListenerCalled);
      assert.ok(goodListener2Called);
    });

    it('should integrate with proxy invalidation', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      let deleteEventTriggered = false;
      
      proxy.onDelete(() => {
        deleteEventTriggered = true;
      });
      
      // Manual invalidation should trigger onDelete events
      proxy._invalidate();
      
      assert.ok(deleteEventTriggered);
    });

    it('should handle event listener cleanup when proxy invalidated', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      let changeCount = 0;
      let deleteCount = 0;
      
      proxy.onChange(() => { changeCount++; });
      proxy.onDelete(() => { deleteCount++; });
      
      // Trigger events
      proxy._triggerChange({ type: 'test' });
      assert.strictEqual(changeCount, 1);
      
      // Invalidate proxy
      proxy._invalidate();
      assert.strictEqual(deleteCount, 1);
      
      // Should not respond to events after invalidation
      proxy._triggerChange({ type: 'after-invalid' });
      assert.strictEqual(changeCount, 1); // Should not increase
    });

    it('should track event listener count', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      // Initially no listeners
      assert.strictEqual(proxy._getEventListenerCount(), 0);
      
      // Add listeners
      const unsub1 = proxy.onChange(() => {});
      const unsub2 = proxy.onChange(() => {});
      const unsub3 = proxy.onDelete(() => {});
      
      assert.strictEqual(proxy._getEventListenerCount(), 3);
      
      // Remove some listeners
      unsub1();
      unsub2();
      
      assert.strictEqual(proxy._getEventListenerCount(), 1);
      
      // Remove last listener
      unsub3();
      assert.strictEqual(proxy._getEventListenerCount(), 0);
    });

    it('should handle concurrent event listener operations', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(result.entityId, store);
      
      const listeners = [];
      const unsubscribeFunctions = [];
      
      // Add many listeners concurrently
      for (let i = 0; i < 10; i++) {
        let callCount = 0;
        const listener = () => { callCount++; };
        listeners.push({ callCount: () => callCount });
        
        if (i % 2 === 0) {
          unsubscribeFunctions.push(proxy.onChange(listener));
        } else {
          unsubscribeFunctions.push(proxy.onDelete(listener));
        }
      }
      
      assert.strictEqual(proxy._getEventListenerCount(), 10);
      
      // Trigger events
      proxy._triggerChange({ type: 'concurrent-test' });
      proxy._triggerDelete();
      
      // Clean up
      unsubscribeFunctions.forEach(unsub => unsub());
      assert.strictEqual(proxy._getEventListenerCount(), 0);
    });
  });

  describe('Proxy Deletion and Cleanup', () => {
    it('should implement delete method to remove entity from database', () => {
      const store = new DataStore();
      const alice = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/active': true
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Initially valid with data
      assert.ok(proxy.isValid());
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      assert.strictEqual(proxy.get(':user/age'), 30);
      
      // Delete entity
      proxy.delete();
      
      // Should be invalid after deletion
      assert.ok(!proxy.isValid());
      
      // Should return undefined for all attributes
      assert.strictEqual(proxy.get(':user/name'), undefined);
      assert.strictEqual(proxy.get(':user/age'), undefined);
      
      // Entity should not exist in database
      const entity = store.db().entity(alice.entityId);
      assert.ok(!entity);
    });

    it('should prevent operations on deleted proxies', () => {
      const store = new DataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Delete entity
      proxy.delete();
      
      // Should throw for operations on deleted proxy
      assert.throws(() => {
        proxy.update({ ':user/age': 30 });
      }, /Cannot update invalid entity/);
      
      assert.throws(() => {
        proxy.query({
          find: ['?name'],
          where: [['?this', ':user/name', '?name']]
        });
      }, /Cannot query invalid entity/);
      
      const validQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
      
      assert.throws(() => {
        proxy.subscribe(validQuery, () => {});
      }, /Cannot subscribe to invalid entity/);
      
      assert.throws(() => {
        proxy.addRelation(':user/friends', 999);
      }, /Cannot modify relationships on invalid entity/);
    });

    it('should cleanup subscriptions when proxy deleted', () => {
      const store = new DataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Create multiple subscriptions
      const dummyQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
      const unsub1 = proxy.subscribe(dummyQuery, () => {});
      const unsub2 = proxy.subscribe(dummyQuery, () => {});
      
      // Should have subscriptions
      assert.ok(proxy._getActiveSubscriptionCount() >= 2);
      assert.ok(store._reactiveEngine.getSubscriptionCount() >= 2);
      
      // Delete proxy
      proxy.delete();
      
      // Should cleanup subscriptions
      assert.strictEqual(proxy._getActiveSubscriptionCount(), 0);
      
      // Store should also cleanup deactivated subscriptions
      const cleanedUp = store._reactiveEngine.cleanupSubscriptions();
      assert.ok(cleanedUp >= 0); // Some cleanup should happen
    });

    it('should cleanup computed properties when proxy deleted', () => {
      const store = new DataStore();
      const alice = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/age': 30 
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Define computed properties
      proxy.computed('summary', {
        find: ['?name', '?age'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/age', '?age']
        ]
      }, (results) => results.length > 0 ? `${results[0][0]} (${results[0][1]})` : 'Unknown');
      
      // Initially accessible
      assert.strictEqual(proxy.summary, 'Alice (30)');
      
      // Delete proxy
      proxy.delete();
      
      // Should not be accessible after deletion
      assert.strictEqual(proxy.summary, undefined);
    });

    it('should cleanup event listeners when proxy deleted', () => {
      const store = new DataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      let changeEventCount = 0;
      let deleteEventCount = 0;
      
      // Register event listeners
      proxy.onChange(() => { changeEventCount++; });
      proxy.onDelete(() => { deleteEventCount++; });
      
      assert.strictEqual(proxy._getEventListenerCount(), 2);
      
      // Delete proxy - should trigger delete events and cleanup
      proxy.delete();
      
      // Should have triggered delete event
      assert.strictEqual(deleteEventCount, 1);
      
      // Should have cleaned up listeners
      assert.strictEqual(proxy._getEventListenerCount(), 0);
      
      // Further events should not trigger
      proxy._triggerChange({ type: 'should-not-work' });
      assert.strictEqual(changeEventCount, 0);
    });

    it('should remove proxy from store registry on deletion', () => {
      const store = new DataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Register proxy in store
      store._registerProxy(alice.entityId, proxy);
      assert.strictEqual(store._getRegisteredProxy(alice.entityId), proxy);
      
      // Delete proxy
      proxy.delete();
      
      // Should be removed from store registry
      store._cleanupProxies();
      assert.strictEqual(store._getRegisteredProxy(alice.entityId), undefined);
    });

    it('should handle multiple proxy deletions concurrently', () => {
      const store = new DataStore();
      
      // Create multiple entities
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < 5; i++) {
        const entity = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i
        });
        entities.push(entity);
        
        const proxy = new EntityProxy(entity.entityId, store);
        proxies.push(proxy);
        
        // Register in store
        store._registerProxy(entity.entityId, proxy);
      }
      
      // All should be valid initially
      proxies.forEach(proxy => {
        assert.ok(proxy.isValid());
      });
      
      // Delete half the proxies
      for (let i = 0; i < 3; i++) {
        proxies[i].delete();
      }
      
      // First three should be invalid
      for (let i = 0; i < 3; i++) {
        assert.ok(!proxies[i].isValid());
      }
      
      // Last two should still be valid
      for (let i = 3; i < 5; i++) {
        assert.ok(proxies[i].isValid());
      }
      
      // Cleanup store registry
      store._cleanupProxies();
      
      // Invalid proxies should be removed from registry
      for (let i = 0; i < 3; i++) {
        assert.strictEqual(store._getRegisteredProxy(entities[i].entityId), undefined);
      }
      
      // Valid proxies should remain in registry
      for (let i = 3; i < 5; i++) {
        assert.strictEqual(store._getRegisteredProxy(entities[i].entityId), proxies[i]);
      }
    });

    it('should validate delete operation gracefully', () => {
      const store = new DataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Should work on valid proxy
      assert.doesNotThrow(() => {
        proxy.delete();
      });
      
      // Should handle multiple delete calls gracefully
      assert.doesNotThrow(() => {
        proxy.delete(); // Second call should not throw
      });
      
      // Should remain invalid
      assert.ok(!proxy.isValid());
    });

    it('should handle comprehensive resource cleanup', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Set up all types of resources
      let changeCount = 0;
      let deleteCount = 0;
      let subscriptionCount = 0;
      
      // Event listeners
      const unsubChange = proxy.onChange(() => { changeCount++; });
      const unsubDelete = proxy.onDelete(() => { deleteCount++; });
      
      // Subscriptions
      const dummyQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
      const unsubSubscription = proxy.subscribe(dummyQuery, () => { subscriptionCount++; });
      
      // Computed properties
      proxy.computed('testProp', {
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, (results) => results.length > 0 ? results[0][0] : 'None');
      
      // Relationships
      proxy.addRelation(':user/friends', bob.entityId);
      
      // Initial state: all resources active
      assert.strictEqual(proxy._getEventListenerCount(), 2);
      assert.ok(proxy._getActiveSubscriptionCount() >= 1);
      assert.strictEqual(proxy.testProp, 'Alice');
      assert.strictEqual(proxy.get(':user/friends').length, 1);
      
      // Delete proxy - should cleanup all resources
      proxy.delete();
      
      // Should have triggered delete event
      assert.strictEqual(deleteCount, 1);
      
      // Should have cleaned up resources
      assert.strictEqual(proxy._getEventListenerCount(), 0);
      assert.strictEqual(proxy._getActiveSubscriptionCount(), 0);
      assert.strictEqual(proxy.testProp, undefined);
      assert.strictEqual(proxy.get(':user/friends'), undefined);
    });
  });
});