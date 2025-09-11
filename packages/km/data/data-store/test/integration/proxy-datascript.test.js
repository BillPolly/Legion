import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EntityProxy } from '../../src/proxy.js';
import { DataStore } from '../../src/store.js';
import datascript from 'datascript';

describe('EntityProxy - DataScript Integration', () => {
  describe('Proxy Creation with Real Entities', () => {
    it('should create proxy for real DataScript entity', () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      // Create real entity
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com'
      });
      
      // Create proxy for real entity
      const proxy = new EntityProxy(result.entityId, store);
      
      assert.strictEqual(proxy.entityId, result.entityId);
      assert.ok(proxy.isValid());
      
      // Verify entity exists in database
      const entity = store.db().entity(result.entityId);
      assert.ok(entity);
      assert.strictEqual(entity[':user/name'], 'Alice');
    });

    it('should handle proxy for non-existent entity', () => {
      const store = new DataStore();
      
      // Create proxy for non-existent entity
      const proxy = new EntityProxy(999999, store);
      
      assert.strictEqual(proxy.entityId, 999999);
      assert.ok(!proxy.isValid());
      
      // Verify entity does not exist in database
      const entity = store.db().entity(999999);
      assert.ok(!entity);
    });

    it('should track entity lifecycle through database changes', () => {
      const store = new DataStore();
      
      // Create entity
      const result = store.createEntity({
        ':user/name': 'Bob',
        ':user/active': true
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      assert.ok(proxy.isValid());
      
      // Entity should exist
      let entity = store.db().entity(result.entityId);
      assert.ok(entity);
      assert.strictEqual(entity[':user/name'], 'Bob');
      
      // Delete entity from database
      const newDB = retractEntity(store.db(), result.entityId);
      store.conn._db = newDB; // Simulate database update
      
      // Proxy should now be invalid
      assert.ok(!proxy.isValid());
      
      // Entity should no longer exist
      entity = store.db().entity(result.entityId);
      assert.ok(!entity);
    });
  });

  describe('Entity Validity with Database State', () => {
    it('should reflect current database state for validity', () => {
      const store = new DataStore();
      
      // Create multiple entities
      const user1 = store.createEntity({ ':user/name': 'Alice' });
      const user2 = store.createEntity({ ':user/name': 'Bob' });
      const user3 = store.createEntity({ ':user/name': 'Charlie' });
      
      // Create proxies
      const proxy1 = new EntityProxy(user1.entityId, store);
      const proxy2 = new EntityProxy(user2.entityId, store);
      const proxy3 = new EntityProxy(user3.entityId, store);
      
      // All should be valid initially
      assert.ok(proxy1.isValid());
      assert.ok(proxy2.isValid());
      assert.ok(proxy3.isValid());
      
      // Delete one entity
      let newDB = retractEntity(store.db(), user2.entityId);
      store.conn._db = newDB;
      
      // Only proxy2 should be invalid
      assert.ok(proxy1.isValid());
      assert.ok(!proxy2.isValid());
      assert.ok(proxy3.isValid());
      
      // Delete another entity
      newDB = retractEntity(store.db(), user3.entityId);
      store.conn._db = newDB;
      
      // Now proxy3 should also be invalid
      assert.ok(proxy1.isValid());
      assert.ok(!proxy2.isValid());
      assert.ok(!proxy3.isValid());
    });

    it('should handle schema constraints in entity validation', () => {
      const schema = {
        ':user/id': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      // Create entity with unique constraints
      const result = store.createEntity({
        ':user/id': 'user-123',
        ':user/email': 'test@example.com',
        ':user/name': 'Test User'
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      assert.ok(proxy.isValid());
      
      // Verify entity has all expected attributes
      const entity = store.db().entity(result.entityId);
      assert.strictEqual(entity[':user/id'], 'user-123');
      assert.strictEqual(entity[':user/email'], 'test@example.com');
      assert.strictEqual(entity[':user/name'], 'Test User');
    });
  });

  describe('Proxy Registry Integration', () => {
    it('should integrate with store proxy registry', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      // Create proxy and register it
      const proxy = new EntityProxy(result.entityId, store);
      store._registerProxy(result.entityId, proxy);
      
      // Should be retrievable from registry
      const retrievedProxy = store._getRegisteredProxy(result.entityId);
      assert.strictEqual(retrievedProxy, proxy);
      assert.ok(retrievedProxy.isValid());
    });

    it('should support cleanup through registry', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      // Create and register proxy
      const proxy = new EntityProxy(result.entityId, store);
      store._registerProxy(result.entityId, proxy);
      
      // Delete entity
      const newDB = retractEntity(store.db(), result.entityId);
      store.conn._db = newDB;
      
      // Proxy should be invalid
      assert.ok(!proxy.isValid());
      
      // Registry cleanup should remove invalid proxy
      store._cleanupProxies();
      const retrievedProxy = store._getRegisteredProxy(result.entityId);
      assert.strictEqual(retrievedProxy, undefined);
    });

    it('should maintain proxy identity across multiple lookups', () => {
      const store = new DataStore();
      const result = store.createEntity({ ':user/name': 'Alice' });
      
      // Create and register proxy
      const proxy1 = new EntityProxy(result.entityId, store);
      store._registerProxy(result.entityId, proxy1);
      
      // Multiple retrievals should return same proxy
      const proxy2 = store._getRegisteredProxy(result.entityId);
      const proxy3 = store._getRegisteredProxy(result.entityId);
      
      assert.strictEqual(proxy1, proxy2);
      assert.strictEqual(proxy2, proxy3);
      assert.strictEqual(proxy1.entityId, result.entityId);
    });
  });

  describe('Concurrent Entity Operations', () => {
    it('should handle multiple concurrent proxy operations', () => {
      const store = new DataStore();
      
      // Create multiple entities concurrently
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < 10; i++) {
        const result = store.createEntity({ ':user/name': `User${i}` });
        entities.push(result);
        
        const proxy = new EntityProxy(result.entityId, store);
        proxies.push(proxy);
        store._registerProxy(result.entityId, proxy);
      }
      
      // All proxies should be valid
      proxies.forEach(proxy => {
        assert.ok(proxy.isValid());
      });
      
      // Delete some entities
      for (let i = 0; i < 5; i++) {
        const newDB = retractEntity(store.db(), entities[i].entityId);
        store.conn._db = newDB;
      }
      
      // First 5 proxies should be invalid, rest should be valid
      for (let i = 0; i < 10; i++) {
        if (i < 5) {
          assert.ok(!proxies[i].isValid(), `Proxy ${i} should be invalid`);
        } else {
          assert.ok(proxies[i].isValid(), `Proxy ${i} should be valid`);
        }
      }
    });
  });

  describe('Reactive Property Access Integration', () => {
    it('should access properties using DataScript pull operations', () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' },
        ':user/age': { valueType: 'number' }
      };
      const store = new DataStore(schema);
      
      // Create entity with multiple attributes
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com',
        ':user/age': 30,
        ':user/active': true
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Property access should use pull operations behind the scenes
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      assert.strictEqual(proxy.get(':user/email'), 'alice@example.com');
      assert.strictEqual(proxy.get(':user/age'), 30);
      assert.strictEqual(proxy.get(':user/active'), true);
      
      // Verify data exists in database using direct pull
      const directPull = pull(store.db(), [
        ':user/name', 
        ':user/email', 
        ':user/age', 
        ':user/active'
      ], result.entityId);
      
      assert.strictEqual(directPull[':user/name'], 'Alice');
      assert.strictEqual(directPull[':user/email'], 'alice@example.com');
      assert.strictEqual(directPull[':user/age'], 30);
      assert.strictEqual(directPull[':user/active'], true);
    });

    it('should reflect live database changes', () => {
      const store = new DataStore();
      
      // Create initial entity
      const result = store.createEntity({
        ':user/name': 'Bob',
        ':user/status': 'pending'
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Initial state
      assert.strictEqual(proxy.get(':user/name'), 'Bob');
      assert.strictEqual(proxy.get(':user/status'), 'pending');
      assert.strictEqual(proxy.get(':user/email'), undefined);
      
      // Update database through store connection
      store.conn.transact([
        { ':db/id': result.entityId, ':user/status': 'active' },
        { ':db/id': result.entityId, ':user/email': 'bob@example.com' }
      ]);
      
      // Proxy should immediately reflect changes
      assert.strictEqual(proxy.get(':user/name'), 'Bob');
      assert.strictEqual(proxy.get(':user/status'), 'active');
      assert.strictEqual(proxy.get(':user/email'), 'bob@example.com');
    });

    it('should handle complex attribute updates', () => {
      const schema = {
        ':user/tags': { card: 'many' },
        ':user/profile': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create user and profile entities
      const profileResult = store.createEntity({
        ':profile/bio': 'Software Engineer',
        ':profile/location': 'San Francisco'
      });
      
      const userResult = store.createEntity({
        ':user/name': 'Charlie',
        ':user/tags': ['developer', 'javascript'],
        ':user/profile': profileResult.entityId
      });
      
      const proxy = new EntityProxy(userResult.entityId, store);
      
      // Initial state
      assert.strictEqual(proxy.get(':user/name'), 'Charlie');
      assert.deepStrictEqual(proxy.get(':user/tags'), ['developer', 'javascript']);
      
      // Profile should be a proxy object, not entity ID
      const profileProxy = proxy.get(':user/profile');
      assert.ok(profileProxy instanceof EntityProxy);
      assert.strictEqual(profileProxy.entityId, profileResult.entityId);
      
      // Update many-valued attribute
      store.conn.transact([
        ['+', userResult.entityId, ':user/tags', 'react'],
        ['+', userResult.entityId, ':user/tags', 'node']
      ]);
      
      // Should reflect updated tags
      const updatedTags = proxy.get(':user/tags');
      assert.ok(updatedTags.includes('developer'));
      assert.ok(updatedTags.includes('javascript'));
      assert.ok(updatedTags.includes('react'));
      assert.ok(updatedTags.includes('node'));
    });

    it('should handle entity deletion gracefully', () => {
      const store = new DataStore();
      
      const result = store.createEntity({
        ':user/name': 'ToBeDeleted',
        ':user/email': 'delete@example.com'
      });
      
      const proxy = new EntityProxy(result.entityId, store);
      
      // Initially should work
      assert.strictEqual(proxy.get(':user/name'), 'ToBeDeleted');
      assert.strictEqual(proxy.get(':user/email'), 'delete@example.com');
      
      // Delete entity from database
      const newDB = retractEntity(store.db(), result.entityId);
      store.conn._db = newDB;
      
      // Property access should return undefined after deletion
      assert.strictEqual(proxy.get(':user/name'), undefined);
      assert.strictEqual(proxy.get(':user/email'), undefined);
      assert.strictEqual(proxy.get(':user/nonexistent'), undefined);
    });

    it('should handle concurrent property access', () => {
      const store = new DataStore();
      
      // Create multiple entities
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < 5; i++) {
        const result = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i,
          ':user/active': i % 2 === 0
        });
        entities.push(result);
        proxies.push(new EntityProxy(result.entityId, store));
      }
      
      // Concurrent property access should work correctly
      proxies.forEach((proxy, index) => {
        assert.strictEqual(proxy.get(':user/name'), `User${index}`);
        assert.strictEqual(proxy.get(':user/index'), index);
        assert.strictEqual(proxy.get(':user/active'), index % 2 === 0);
      });
      
      // Update all entities
      const txData = [];
      entities.forEach((entity, index) => {
        txData.push({ ':db/id': entity.entityId, ':user/updated': true });
      });
      store.conn.transact(txData);
      
      // All proxies should reflect updates
      proxies.forEach((proxy, index) => {
        assert.strictEqual(proxy.get(':user/name'), `User${index}`);
        assert.strictEqual(proxy.get(':user/index'), index);
        assert.strictEqual(proxy.get(':user/updated'), true);
      });
    });

    it('should work with schema constraints', () => {
      const schema = {
        ':user/id': { unique: 'identity' },
        ':user/email': { unique: 'value' },
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/age': { valueType: 'number' }
      };
      const store = new DataStore(schema);
      
      // Create entities with schema constraints
      const alice = store.createEntity({
        ':user/id': 'alice-123',
        ':user/email': 'alice@example.com',
        ':user/age': 25
      });
      
      const bob = store.createEntity({
        ':user/id': 'bob-456', 
        ':user/email': 'bob@example.com',
        ':user/age': 30,
        ':user/friends': [alice.entityId]
      });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      
      // Access properties with schema constraints
      assert.strictEqual(aliceProxy.get(':user/id'), 'alice-123');
      assert.strictEqual(aliceProxy.get(':user/email'), 'alice@example.com');
      assert.strictEqual(aliceProxy.get(':user/age'), 25);
      
      assert.strictEqual(bobProxy.get(':user/id'), 'bob-456');
      assert.strictEqual(bobProxy.get(':user/email'), 'bob@example.com');
      assert.strictEqual(bobProxy.get(':user/age'), 30);
      
      // Friends should now be proxy objects, not entity IDs
      const bobFriends = bobProxy.get(':user/friends');
      assert.ok(Array.isArray(bobFriends));
      assert.strictEqual(bobFriends.length, 1);
      assert.ok(bobFriends[0] instanceof EntityProxy);
      assert.strictEqual(bobFriends[0].entityId, alice.entityId);
    });
  });

  describe('Reference Property Conversion Integration', () => {
    it('should convert ref attributes to proxy objects with real DataScript data', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' },
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':profile/company': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create complex entity relationships
      const company = store.createEntity({
        ':company/name': 'Tech Corp',
        ':company/industry': 'Software'
      });
      
      const profile = store.createEntity({
        ':profile/bio': 'Senior Developer',
        ':profile/years': 5,
        ':profile/company': company.entityId
      });
      
      const friend1 = store.createEntity({ ':user/name': 'Bob' });
      const friend2 = store.createEntity({ ':user/name': 'Charlie' });
      
      const user = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com',
        ':user/profile': profile.entityId,
        ':user/friends': [friend1.entityId, friend2.entityId]
      });
      
      const userProxy = new EntityProxy(user.entityId, store);
      
      // Test single ref conversion
      const profileProxy = userProxy.get(':user/profile');
      assert.ok(profileProxy instanceof EntityProxy);
      assert.strictEqual(profileProxy.entityId, profile.entityId);
      assert.strictEqual(profileProxy.get(':profile/bio'), 'Senior Developer');
      assert.strictEqual(profileProxy.get(':profile/years'), 5);
      
      // Test nested ref conversion
      const companyProxy = profileProxy.get(':profile/company');
      assert.ok(companyProxy instanceof EntityProxy);
      assert.strictEqual(companyProxy.entityId, company.entityId);
      assert.strictEqual(companyProxy.get(':company/name'), 'Tech Corp');
      assert.strictEqual(companyProxy.get(':company/industry'), 'Software');
      
      // Test many-cardinality ref conversion
      const friendProxies = userProxy.get(':user/friends');
      assert.ok(Array.isArray(friendProxies));
      assert.strictEqual(friendProxies.length, 2);
      
      friendProxies.forEach(friendProxy => {
        assert.ok(friendProxy instanceof EntityProxy);
        assert.ok(['Bob', 'Charlie'].includes(friendProxy.get(':user/name')));
      });
    });

    it('should integrate with proxy registry for ref attributes', () => {
      const schema = {
        ':user/manager': { valueType: 'ref' },
        ':user/reports': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create entities
      const manager = store.createEntity({ ':user/name': 'Manager' });
      const report1 = store.createEntity({ ':user/name': 'Report1' });
      const report2 = store.createEntity({ ':user/name': 'Report2' });
      
      // Pre-register some proxies
      const managerProxy = new EntityProxy(manager.entityId, store);
      const report1Proxy = new EntityProxy(report1.entityId, store);
      store._registerProxy(manager.entityId, managerProxy);
      store._registerProxy(report1.entityId, report1Proxy);
      
      const user = store.createEntity({
        ':user/name': 'Employee',
        ':user/manager': manager.entityId,
        ':user/reports': [report1.entityId, report2.entityId]
      });
      
      const userProxy = new EntityProxy(user.entityId, store);
      
      // Should return registered proxy instances
      const retrievedManagerProxy = userProxy.get(':user/manager');
      assert.strictEqual(retrievedManagerProxy, managerProxy);
      
      const reportProxies = userProxy.get(':user/reports');
      assert.strictEqual(reportProxies[0], report1Proxy); // First should be registered proxy
      assert.ok(reportProxies[1] instanceof EntityProxy); // Second should be new proxy
      assert.strictEqual(reportProxies[1].entityId, report2.entityId);
    });

    it('should handle ref attribute updates with database transactions', () => {
      const schema = {
        ':user/manager': { valueType: 'ref' },
        ':user/team': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create initial entities
      const manager1 = store.createEntity({ ':user/name': 'Manager1' });
      const manager2 = store.createEntity({ ':user/name': 'Manager2' });
      const teammate1 = store.createEntity({ ':user/name': 'Teammate1' });
      const teammate2 = store.createEntity({ ':user/name': 'Teammate2' });
      const teammate3 = store.createEntity({ ':user/name': 'Teammate3' });
      
      const user = store.createEntity({
        ':user/name': 'Employee',
        ':user/manager': manager1.entityId,
        ':user/team': [teammate1.entityId, teammate2.entityId]
      });
      
      const userProxy = new EntityProxy(user.entityId, store);
      
      // Initial state
      let managerProxy = userProxy.get(':user/manager');
      assert.strictEqual(managerProxy.get(':user/name'), 'Manager1');
      
      let teamProxies = userProxy.get(':user/team');
      assert.strictEqual(teamProxies.length, 2);
      
      // Update references through transactions
      store.conn.transact([
        // Change manager
        { ':db/id': user.entityId, ':user/manager': manager2.entityId },
        // Add team member
        ['+', user.entityId, ':user/team', teammate3.entityId],
        // Remove team member  
        ['-', user.entityId, ':user/team', teammate1.entityId]
      ]);
      
      // Should reflect changes immediately
      managerProxy = userProxy.get(':user/manager');
      assert.strictEqual(managerProxy.get(':user/name'), 'Manager2');
      assert.strictEqual(managerProxy.entityId, manager2.entityId);
      
      teamProxies = userProxy.get(':user/team');
      assert.strictEqual(teamProxies.length, 2);
      const teamNames = teamProxies.map(p => p.get(':user/name')).sort();
      assert.deepStrictEqual(teamNames, ['Teammate2', 'Teammate3']);
    });

    it('should handle component relationships with cascading deletion', () => {
      const schema = {
        ':user/profile': { valueType: 'ref', component: true },
        ':profile/address': { valueType: 'ref', component: true }
      };
      const store = new DataStore(schema);
      
      // Create component hierarchy
      const address = store.createEntity({
        ':address/street': '123 Main St',
        ':address/city': 'San Francisco'
      });
      
      const profile = store.createEntity({
        ':profile/bio': 'Software Engineer',
        ':profile/address': address.entityId
      });
      
      const user = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile.entityId
      });
      
      const userProxy = new EntityProxy(user.entityId, store);
      
      // Verify component navigation works
      const profileProxy = userProxy.get(':user/profile');
      assert.ok(profileProxy instanceof EntityProxy);
      assert.strictEqual(profileProxy.get(':profile/bio'), 'Software Engineer');
      
      const addressProxy = profileProxy.get(':profile/address');
      assert.ok(addressProxy instanceof EntityProxy);
      assert.strictEqual(addressProxy.get(':address/street'), '123 Main St');
      assert.strictEqual(addressProxy.get(':address/city'), 'San Francisco');
      
      // Delete user (should cascade to components due to component: true)
      const newDB = retractEntity(store.db(), user.entityId);
      store.conn._db = newDB;
      
      // All proxies should become invalid
      assert.ok(!userProxy.isValid());
      assert.ok(!profileProxy.isValid());
      assert.ok(!addressProxy.isValid());
    });

    it('should handle large ref collections efficiently', () => {
      const schema = {
        ':user/followers': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create many follower entities
      const followerIds = [];
      for (let i = 0; i < 100; i++) {
        const follower = store.createEntity({
          ':user/name': `Follower${i}`,
          ':user/index': i
        });
        followerIds.push(follower.entityId);
      }
      
      // Create user with many followers
      const user = store.createEntity({
        ':user/name': 'Influencer',
        ':user/followers': followerIds
      });
      
      const userProxy = new EntityProxy(user.entityId, store);
      
      // Should efficiently handle large collections
      const followerProxies = userProxy.get(':user/followers');
      assert.ok(Array.isArray(followerProxies));
      assert.strictEqual(followerProxies.length, 100);
      
      // All should be proxy objects
      followerProxies.forEach((proxy, index) => {
        assert.ok(proxy instanceof EntityProxy);
        assert.strictEqual(proxy.get(':user/name'), `Follower${index}`);
        assert.strictEqual(proxy.get(':user/index'), index);
      });
    });

    it('should maintain referential integrity with schema constraints', () => {
      const schema = {
        ':user/best-friend': { valueType: 'ref' },
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/id': { unique: 'identity' }
      };
      const store = new DataStore(schema);
      
      // Create users with unique constraints
      const alice = store.createEntity({
        ':user/id': 'alice-123',
        ':user/name': 'Alice'
      });
      
      const bob = store.createEntity({
        ':user/id': 'bob-456', 
        ':user/name': 'Bob'
      });
      
      const charlie = store.createEntity({
        ':user/id': 'charlie-789',
        ':user/name': 'Charlie',
        ':user/best-friend': alice.entityId,
        ':user/friends': [alice.entityId, bob.entityId]
      });
      
      const charlieProxy = new EntityProxy(charlie.entityId, store);
      
      // Verify relationships work with unique constraints
      const bestFriendProxy = charlieProxy.get(':user/best-friend');
      assert.ok(bestFriendProxy instanceof EntityProxy);
      assert.strictEqual(bestFriendProxy.get(':user/id'), 'alice-123');
      assert.strictEqual(bestFriendProxy.get(':user/name'), 'Alice');
      
      const friendProxies = charlieProxy.get(':user/friends');
      assert.strictEqual(friendProxies.length, 2);
      
      const friendIds = friendProxies.map(p => p.get(':user/id')).sort();
      assert.deepStrictEqual(friendIds, ['alice-123', 'bob-456']);
    });
  });

  describe('Proxy Updates Integration', () => {
    it('should propagate updates to DataScript database', () => {
      const schema = {
        ':user/email': { unique: 'value' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create initial entity
      const user = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 25,
        ':user/active': false
      });
      
      const proxy = new EntityProxy(user.entityId, store);
      
      // Update through proxy
      const updateResult = proxy.update({
        ':user/name': 'Alice Smith',
        ':user/email': 'alice@example.com',
        ':user/age': 26,
        ':user/active': true,
        ':user/bio': 'Software Engineer'
      });
      
      // Check update result
      assert.ok(updateResult.dbAfter);
      assert.strictEqual(updateResult.entityId, user.entityId);
      
      // Verify changes in database directly
      const db = store.db();
      const entity = db.entity(user.entityId);
      assert.strictEqual(entity[':user/name'], 'Alice Smith');
      assert.strictEqual(entity[':user/email'], 'alice@example.com');
      assert.strictEqual(entity[':user/age'], 26);
      assert.strictEqual(entity[':user/active'], true);
      assert.strictEqual(entity[':user/bio'], 'Software Engineer');
      
      // Verify through proxy access
      assert.strictEqual(proxy.get(':user/name'), 'Alice Smith');
      assert.strictEqual(proxy.get(':user/email'), 'alice@example.com');
      assert.strictEqual(proxy.get(':user/age'), 26);
      assert.strictEqual(proxy.get(':user/active'), true);
      assert.strictEqual(proxy.get(':user/bio'), 'Software Engineer');
    });

    it('should handle schema constraint enforcement in updates', () => {
      const schema = {
        ':user/id': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      // Create users with unique constraints
      const alice = store.createEntity({
        ':user/id': 'alice-123',
        ':user/email': 'alice@example.com'
      });
      
      const bob = store.createEntity({
        ':user/id': 'bob-456',
        ':user/email': 'bob@example.com'
      });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Valid update should work
      aliceProxy.update({
        ':user/name': 'Alice Updated',
        ':user/age': 30
      });
      
      assert.strictEqual(aliceProxy.get(':user/name'), 'Alice Updated');
      assert.strictEqual(aliceProxy.get(':user/age'), 30);
      
      // Unique constraint violation should fail
      try {
        aliceProxy.update({
          ':user/email': 'bob@example.com'  // Bob's email
        });
        assert.fail('Should have thrown unique constraint error');
      } catch (error) {
        assert.ok(error.message.includes('Unique constraint'));
      }
      
      // Original email should remain unchanged
      assert.strictEqual(aliceProxy.get(':user/email'), 'alice@example.com');
    });

    it('should handle reference updates with entity relationships', () => {
      const schema = {
        ':user/manager': { valueType: 'ref' },
        ':user/team': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create entities
      const manager1 = store.createEntity({ ':user/name': 'Manager1' });
      const manager2 = store.createEntity({ ':user/name': 'Manager2' });
      const teammate1 = store.createEntity({ ':user/name': 'Teammate1' });
      const teammate2 = store.createEntity({ ':user/name': 'Teammate2' });
      const teammate3 = store.createEntity({ ':user/name': 'Teammate3' });
      
      const employee = store.createEntity({
        ':user/name': 'Employee',
        ':user/manager': manager1.entityId,
        ':user/team': [teammate1.entityId, teammate2.entityId]
      });
      
      const employeeProxy = new EntityProxy(employee.entityId, store);
      
      // Initial state verification
      let managerProxy = employeeProxy.get(':user/manager');
      assert.strictEqual(managerProxy.get(':user/name'), 'Manager1');
      
      let teamProxies = employeeProxy.get(':user/team');
      assert.strictEqual(teamProxies.length, 2);
      
      // Update relationships
      employeeProxy.update({
        ':user/manager': manager2.entityId,
        ':user/team': [teammate2.entityId, teammate3.entityId]
      });
      
      // Verify updates in database
      const db = store.db();
      const entity = db.entity(employee.entityId);
      assert.strictEqual(entity[':user/manager'], manager2.entityId);
      assert.deepStrictEqual([...entity[':user/team']].sort(), [teammate2.entityId, teammate3.entityId].sort());
      
      // Verify through proxy access
      managerProxy = employeeProxy.get(':user/manager');
      assert.strictEqual(managerProxy.get(':user/name'), 'Manager2');
      
      teamProxies = employeeProxy.get(':user/team');
      assert.strictEqual(teamProxies.length, 2);
      const teamNames = teamProxies.map(p => p.get(':user/name')).sort();
      assert.deepStrictEqual(teamNames, ['Teammate2', 'Teammate3']);
    });

    it('should handle transaction rollback on constraint violations', () => {
      const schema = {
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      // Create users
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com',
        ':user/age': 25
      });
      
      const bob = store.createEntity({
        ':user/name': 'Bob', 
        ':user/email': 'bob@example.com'
      });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Attempt invalid update
      try {
        aliceProxy.update({
          ':user/age': 30,  // Valid change
          ':user/email': 'bob@example.com'  // Invalid - unique constraint
        });
        assert.fail('Should have thrown constraint error');
      } catch (error) {
        assert.ok(error.message.includes('Unique constraint'));
      }
      
      // No changes should have been applied (transaction rollback)
      assert.strictEqual(aliceProxy.get(':user/age'), 25); // Original value
      assert.strictEqual(aliceProxy.get(':user/email'), 'alice@example.com'); // Original value
    });

    it('should handle updates with component relationships', () => {
      const schema = {
        ':user/profile': { valueType: 'ref', component: true }
      };
      const store = new DataStore(schema);
      
      // Create entities
      const profile1 = store.createEntity({
        ':profile/bio': 'Engineer',
        ':profile/years': 3
      });
      
      const profile2 = store.createEntity({
        ':profile/bio': 'Senior Engineer', 
        ':profile/years': 7
      });
      
      const user = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile1.entityId
      });
      
      const userProxy = new EntityProxy(user.entityId, store);
      
      // Verify initial component relationship
      let profileProxy = userProxy.get(':user/profile');
      assert.strictEqual(profileProxy.get(':profile/bio'), 'Engineer');
      assert.strictEqual(profileProxy.get(':profile/years'), 3);
      
      // Update component reference
      userProxy.update({
        ':user/profile': profile2.entityId
      });
      
      // Verify component relationship updated
      profileProxy = userProxy.get(':user/profile');
      assert.strictEqual(profileProxy.get(':profile/bio'), 'Senior Engineer');
      assert.strictEqual(profileProxy.get(':profile/years'), 7);
      assert.strictEqual(profileProxy.entityId, profile2.entityId);
    });

    it('should handle concurrent proxy updates', () => {
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
        proxies.push(new EntityProxy(entity.entityId, store));
      }
      
      // Perform concurrent updates
      proxies.forEach((proxy, index) => {
        proxy.update({
          ':user/name': `UpdatedUser${index}`,
          ':user/age': 20 + index,
          ':user/active': index % 2 === 0
        });
      });
      
      // Verify all updates applied correctly
      proxies.forEach((proxy, index) => {
        assert.strictEqual(proxy.get(':user/name'), `UpdatedUser${index}`);
        assert.strictEqual(proxy.get(':user/age'), 20 + index);
        assert.strictEqual(proxy.get(':user/active'), index % 2 === 0);
        assert.strictEqual(proxy.get(':user/index'), index); // Unchanged
      });
      
      // Verify in database directly
      const db = store.db();
      entities.forEach((entity, index) => {
        const dbEntity = db.entity(entity.entityId);
        assert.strictEqual(dbEntity[':user/name'], `UpdatedUser${index}`);
        assert.strictEqual(dbEntity[':user/age'], 20 + index);
        assert.strictEqual(dbEntity[':user/active'], index % 2 === 0);
      });
    });

    it('should handle large update operations efficiently', () => {
      const store = new DataStore();
      
      // Create entity with many attributes
      const initialData = {};
      for (let i = 0; i < 50; i++) {
        initialData[`:user/field${i}`] = `value${i}`;
      }
      
      const entity = store.createEntity(initialData);
      const proxy = new EntityProxy(entity.entityId, store);
      
      // Perform large update
      const updateData = {};
      for (let i = 0; i < 50; i++) {
        updateData[`:user/field${i}`] = `updated${i}`;
      }
      
      const updateResult = proxy.update(updateData);
      assert.ok(updateResult.dbAfter);
      
      // Verify all updates applied
      for (let i = 0; i < 50; i++) {
        assert.strictEqual(proxy.get(`:user/field${i}`), `updated${i}`);
      }
    });
  });

  describe('Entity-Rooted Query Execution Integration', () => {
    it('should execute queries against live DataScript database', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/posts': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create complex entity graph
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/age': 30 });
      const bob = store.createEntity({ ':user/name': 'Bob', ':user/age': 25 });
      const charlie = store.createEntity({ ':user/name': 'Charlie', ':user/age': 35 });
      
      const post1 = store.createEntity({
        ':post/title': 'Alice Post 1',
        ':post/views': 100,
        ':post/published': true
      });
      
      const post2 = store.createEntity({
        ':post/title': 'Alice Post 2',
        ':post/views': 50,
        ':post/published': false
      });
      
      // Create relationships
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId],
        ['+', alice.entityId, ':user/posts', post1.entityId],
        ['+', alice.entityId, ':user/posts', post2.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Test friend queries
      const friendNames = aliceProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      
      assert.strictEqual(friendNames.length, 2);
      const names = friendNames.map(r => r[0]).sort();
      assert.deepStrictEqual(names, ['Bob', 'Charlie']);
      
      // Test post queries with filtering
      const publishedPosts = aliceProxy.query({
        find: ['?title', '?views'],
        where: [
          ['?this', ':user/posts', '?post'],
          ['?post', ':post/title', '?title'],
          ['?post', ':post/views', '?views'],
          ['?post', ':post/published', true]
        ]
      });
      
      assert.strictEqual(publishedPosts.length, 1);
      assert.deepStrictEqual(publishedPosts[0], ['Alice Post 1', 100]);
    });

    it.skip('should handle entity-rooted queries with predicates and DataScript features (TODO: fix predicate binding)', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create entities with various ages
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/age': 30 });
      const bob = store.createEntity({ ':user/name': 'Bob', ':user/age': 25 });
      const charlie = store.createEntity({ ':user/name': 'Charlie', ':user/age': 35 });
      const diana = store.createEntity({ ':user/name': 'Diana', ':user/age': 20 });
      
      // Alice is friends with everyone
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId],
        ['+', alice.entityId, ':user/friends', diana.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Query for friends over 24
      const adultFriends = aliceProxy.query({
        find: ['?friend-name', '?friend-age'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name'],
          ['?friend', ':user/age', '?friend-age'],
          [(age) => age > 24, '?friend-age']
        ]
      });
      
      assert.strictEqual(adultFriends.length, 2);
      const adultNames = adultFriends.map(r => r[0]).sort();
      assert.deepStrictEqual(adultNames, ['Bob', 'Charlie']);
      
      // Verify ages
      const bobResult = adultFriends.find(r => r[0] === 'Bob');
      const charlieResult = adultFriends.find(r => r[0] === 'Charlie');
      assert.strictEqual(bobResult[1], 25);
      assert.strictEqual(charlieResult[1], 35);
    });

    it('should handle nested entity relationships in queries', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' },
        ':profile/company': { valueType: 'ref' },
        ':company/employees': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create entity hierarchy
      const company = store.createEntity({
        ':company/name': 'Tech Corp',
        ':company/industry': 'Software'
      });
      
      const profile = store.createEntity({
        ':profile/title': 'Senior Developer',
        ':profile/years': 5,
        ':profile/company': company.entityId
      });
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile.entityId
      });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Query through nested relationships
      const companyInfo = aliceProxy.query({
        find: ['?company-name', '?industry'],
        where: [
          ['?this', ':user/profile', '?profile'],
          ['?profile', ':profile/company', '?company'],
          ['?company', ':company/name', '?company-name'],
          ['?company', ':company/industry', '?industry']
        ]
      });
      
      assert.strictEqual(companyInfo.length, 1);
      assert.deepStrictEqual(companyInfo[0], ['Tech Corp', 'Software']);
      
      // Query for profile details
      const profileInfo = aliceProxy.query({
        find: ['?title', '?years'],
        where: [
          ['?this', ':user/profile', '?profile'],
          ['?profile', ':profile/title', '?title'],
          ['?profile', ':profile/years', '?years']
        ]
      });
      
      assert.strictEqual(profileInfo.length, 1);
      assert.deepStrictEqual(profileInfo[0], ['Senior Developer', 5]);
    });

    it('should integrate ?this binding with DataScript query engine', () => {
      const store = new DataStore();
      
      // Create entity with self-referential data
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com',
        ':user/age': 30,
        ':user/active': true,
        ':user/score': 95.5
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Verify ?this binding works with different attribute types
      const allData = proxy.query({
        find: ['?name', '?email', '?age', '?active', '?score'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/email', '?email'],
          ['?this', ':user/age', '?age'],
          ['?this', ':user/active', '?active'],
          ['?this', ':user/score', '?score']
        ]
      });
      
      assert.strictEqual(allData.length, 1);
      assert.deepStrictEqual(allData[0], ['Alice', 'alice@example.com', 30, true, 95.5]);
      
      // Verify query works same as direct DataScript query with explicit entity ID
      const directResult = q({
        find: ['?name', '?email', '?age', '?active', '?score'],
        where: [
          [alice.entityId, ':user/name', '?name'],
          [alice.entityId, ':user/email', '?email'],
          [alice.entityId, ':user/age', '?age'],
          [alice.entityId, ':user/active', '?active'],
          [alice.entityId, ':user/score', '?score']
        ]
      }, store.db());
      
      assert.deepStrictEqual(allData, directResult);
    });

    it('should handle query result processing with ref attributes', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/manager': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create management hierarchy
      const manager = store.createEntity({ ':user/name': 'Manager', ':user/level': 'senior' });
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/manager': manager.entityId });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Query should return entity IDs for ref attributes (raw results)
      const managerQuery = aliceProxy.query({
        find: ['?manager-name', '?manager-id'],
        where: [
          ['?this', ':user/manager', '?manager-id'],
          ['?manager-id', ':user/name', '?manager-name']
        ]
      });
      
      assert.strictEqual(managerQuery.length, 1);
      assert.strictEqual(managerQuery[0][0], 'Manager');
      assert.strictEqual(managerQuery[0][1], manager.entityId);
    });

    it('should handle query edge cases with real database state', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/tags': ['developer', 'javascript', 'react']
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Query for non-existent relationships
      const friends = proxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      
      assert.deepStrictEqual(friends, []);
      
      // Query for existing scalar attributes
      const name = proxy.query({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      });
      
      assert.strictEqual(name.length, 1);
      assert.strictEqual(name[0][0], 'Alice');
      
      // Query for many-cardinality non-ref attributes
      const tags = proxy.query({
        find: ['?tag'],
        where: [['?this', ':user/tags', '?tag']]
      });
      
      assert.strictEqual(tags.length, 3);
      const tagValues = tags.map(t => t[0]).sort();
      assert.deepStrictEqual(tagValues, ['developer', 'javascript', 'react']);
    });
  });
});