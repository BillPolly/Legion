import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createDataStore, EntityProxy, DataStore, Subscription, ReactiveEngine } from '../../index.js';
import { SubscriptionRegistry } from '../../src/subscription.js';
import { TransactionAnalyzer } from '../../src/reactor.js';

describe('API Completeness - Design Document Validation', () => {
  describe('DataStore Creation API', () => {
    it('should implement createDataStore as documented', () => {
      // API from design doc: createDataStore({ schema, options })
      const store = createDataStore({
        schema: {
          ':user/id': { unique: 'identity' },
          ':user/friends': { card: 'many', valueType: 'ref' },
          ':post/author': { valueType: 'ref' }
        },
        options: {
          debounceMs: 10,
          maxSubscriptions: 1000
        }
      });
      
      assert.ok(store instanceof DataStore);
      assert.ok(store.schema);
      assert.ok(store.options);
      assert.strictEqual(store.options.debounceMs, 10);
      
      // Should have reactive engine
      assert.ok(store._reactiveEngine instanceof ReactiveEngine);
    });

    it('should implement DataStore constructor as documented', () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      
      const options = { debounceMs: 15 };
      
      const store = new DataStore(schema, options);
      
      assert.deepStrictEqual(store.schema, schema);
      assert.strictEqual(store.options.debounceMs, 15);
      assert.ok(store.conn); // DataScript connection
      assert.ok(store._reactiveEngine);
    });

    it('should implement entity creation methods as documented', () => {
      const store = createDataStore();
      
      // Single entity creation
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com'
      });
      
      assert.ok(alice.entityId);
      assert.ok(alice.tempids);
      assert.ok(alice.dbAfter);
      
      // Batch entity creation
      const batchResult = store.createEntities([
        { ':user/name': 'Bob' },
        { ':user/name': 'Charlie' },
        { ':user/name': 'Diana' }
      ]);
      
      assert.ok(Array.isArray(batchResult.entityIds));
      assert.strictEqual(batchResult.entityIds.length, 3);
      assert.ok(batchResult.tempids);
      assert.ok(batchResult.dbAfter);
    });
  });

  describe('EntityProxy API', () => {
    it('should implement proxy creation as documented', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      
      // EntityProxy creation
      const proxy = new EntityProxy(alice.entityId, store);
      
      assert.strictEqual(proxy.entityId, alice.entityId);
      assert.strictEqual(proxy.store, store);
      assert.ok(proxy.isValid());
    });

    it('should implement reactive property access as documented', () => {
      const store = createDataStore();
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/email': 'alice@example.com',
        ':user/active': true,
        ':user/tags': ['developer', 'javascript']
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // get() method for attributes
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      assert.strictEqual(proxy.get(':user/age'), 30);
      assert.strictEqual(proxy.get(':user/email'), 'alice@example.com');
      assert.strictEqual(proxy.get(':user/active'), true);
      assert.deepStrictEqual(proxy.get(':user/tags'), ['developer', 'javascript']);
      
      // Convenience property access
      assert.strictEqual(proxy.name, 'Alice');
      assert.strictEqual(proxy.email, 'alice@example.com');
      assert.strictEqual(proxy.age, 30);
      assert.strictEqual(proxy.active, true);
      
      // getAll() method
      const allData = proxy.getAll();
      assert.ok(allData[':user/name']);
      assert.ok(allData[':user/age']);
      assert.ok(allData[':user/email']);
      assert.ok(allData[':user/active']);
      assert.ok(allData[':user/tags']);
    });

    it('should implement proxy updates as documented', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/age': 25 });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // update() method
      const updateResult = proxy.update({
        ':user/name': 'Alice Smith',
        ':user/email': 'alice@example.com',
        ':user/age': 26
      });
      
      assert.ok(updateResult.entityId);
      assert.ok(updateResult.dbAfter);
      assert.ok(updateResult.tempids);
      
      // Verify changes
      assert.strictEqual(proxy.get(':user/name'), 'Alice Smith');
      assert.strictEqual(proxy.get(':user/email'), 'alice@example.com');
      assert.strictEqual(proxy.get(':user/age'), 26);
    });

    it('should implement reference property conversion as documented', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create referenced entities
      const profile = store.createEntity({
        ':profile/bio': 'Software Engineer',
        ':profile/location': 'San Francisco'
      });
      
      const friend1 = store.createEntity({ ':user/name': 'Bob' });
      const friend2 = store.createEntity({ ':user/name': 'Charlie' });
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile.entityId,
        ':user/friends': [friend1.entityId, friend2.entityId]
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Single ref should return proxy object
      const profileProxy = proxy.get(':user/profile');
      assert.ok(profileProxy instanceof EntityProxy);
      assert.strictEqual(profileProxy.entityId, profile.entityId);
      assert.strictEqual(profileProxy.get(':profile/bio'), 'Software Engineer');
      
      // Many ref should return array of proxy objects
      const friendProxies = proxy.get(':user/friends');
      assert.ok(Array.isArray(friendProxies));
      assert.strictEqual(friendProxies.length, 2);
      
      friendProxies.forEach(friendProxy => {
        assert.ok(friendProxy instanceof EntityProxy);
      });
      
      const friendNames = friendProxies.map(f => f.get(':user/name')).sort();
      assert.deepStrictEqual(friendNames, ['Bob', 'Charlie']);
    });

    it('should implement entity-rooted queries as documented', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId]
      ]);
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // query() method with ?this binding
      const results = proxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      
      assert.strictEqual(results.length, 2);
      const friendNames = results.map(r => r[0]).sort();
      assert.deepStrictEqual(friendNames, ['Bob', 'Charlie']);
    });

    it('should implement query subscriptions as documented', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      let callbackResults = null;
      let callbackChanges = null;
      
      // subscribe() method
      const unsubscribe = proxy.subscribe({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, (results, changes) => {
        callbackResults = results;
        callbackChanges = changes;
      });
      
      assert.ok(typeof unsubscribe === 'function');
      
      // Should be registered in reactive engine
      assert.ok(store._reactiveEngine.getSubscriptionCount() >= 1);
      
      // Manual trigger for testing
      proxy._triggerSubscription('test', [['Alice']], { type: 'test' });
      
      assert.deepStrictEqual(callbackResults, [['Alice']]);
      assert.strictEqual(callbackChanges.type, 'test');
      
      // Unsubscribe should work
      unsubscribe();
    });

    it('should implement computed properties as documented', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId]
      ]);
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // computed() method as documented
      proxy.computed('friendCount', {
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, (results) => results.length);
      
      // Property should be accessible
      assert.strictEqual(proxy.friendCount, 2);
      
      // Should cache result
      const cachedResult = proxy.friendCount;
      assert.strictEqual(cachedResult, 2);
      
      // removeComputed() method
      const removed = proxy.removeComputed('friendCount');
      assert.ok(removed);
      
      // Should no longer be accessible
      assert.strictEqual(proxy.friendCount, undefined);
    });

    it('should implement relationship management as documented', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/manager': { valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const manager = store.createEntity({ ':user/name': 'Manager' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const managerProxy = new EntityProxy(manager.entityId, store);
      
      // addRelation() method
      aliceProxy.addRelation(':user/friends', bobProxy);
      aliceProxy.addRelation(':user/manager', managerProxy);
      
      // Verify relationships
      const friends = aliceProxy.get(':user/friends');
      const managerRef = aliceProxy.get(':user/manager');
      
      assert.strictEqual(friends.length, 1);
      assert.strictEqual(friends[0].entityId, bob.entityId);
      assert.strictEqual(managerRef.entityId, manager.entityId);
      
      // removeRelation() method
      aliceProxy.removeRelation(':user/friends', bobProxy);
      
      const friendsAfterRemoval = aliceProxy.get(':user/friends');
      assert.strictEqual(friendsAfterRemoval.length, 0);
    });

    it('should implement proxy lifecycle events as documented', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/age': 30 });
      const proxy = new EntityProxy(alice.entityId, store);
      
      let changeEvents = [];
      let deleteEvents = [];
      
      // onChange() method as documented
      const unsubChange = proxy.onChange((changes) => {
        changeEvents.push(changes);
      });
      
      // onDelete() method as documented
      const unsubDelete = proxy.onDelete(() => {
        deleteEvents.push({ timestamp: Date.now() });
      });
      
      assert.ok(typeof unsubChange === 'function');
      assert.ok(typeof unsubDelete === 'function');
      
      // Should trigger on updates
      proxy.update({ ':user/age': 31 });
      
      assert.strictEqual(changeEvents.length, 1);
      assert.strictEqual(changeEvents[0].type, 'update');
      assert.deepStrictEqual(changeEvents[0].attributes, [':user/age']);
      
      // Should trigger on deletion
      proxy.delete();
      
      assert.strictEqual(deleteEvents.length, 1);
      assert.ok(deleteEvents[0].timestamp);
      
      unsubChange();
      unsubDelete();
    });

    it('should implement proxy deletion as documented', () => {
      const store = createDataStore();
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/active': true
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Initially valid
      assert.ok(proxy.isValid());
      assert.strictEqual(proxy.get(':user/name'), 'Alice');
      
      // delete() method as documented
      proxy.delete();
      
      // Should be invalid after deletion
      assert.ok(!proxy.isValid());
      
      // Should return undefined for all properties
      assert.strictEqual(proxy.get(':user/name'), undefined);
      assert.strictEqual(proxy.get(':user/age'), undefined);
      
      // Entity should not exist in database
      const entity = store.db().entity(alice.entityId);
      assert.ok(!entity);
    });

    it('should implement proxy utility methods as documented', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const aliceProxy2 = new EntityProxy(alice.entityId, store);
      
      // equals() method
      assert.ok(aliceProxy.equals(aliceProxy2)); // Same entity
      assert.ok(!aliceProxy.equals(bobProxy)); // Different entities
      
      // toString() method
      const str = aliceProxy.toString();
      assert.ok(str.includes('EntityProxy'));
      assert.ok(str.includes(alice.entityId.toString()));
      assert.ok(str.includes('valid'));
      
      // toJSON() method
      const json = aliceProxy.toJSON();
      assert.strictEqual(json.type, 'EntityProxy');
      assert.strictEqual(json.entityId, alice.entityId);
      assert.strictEqual(json.isValid, true);
      
      // After deletion
      aliceProxy.delete();
      const invalidStr = aliceProxy.toString();
      assert.ok(invalidStr.includes('invalid'));
      
      const invalidJson = aliceProxy.toJSON();
      assert.strictEqual(invalidJson.isValid, false);
    });
  });

  describe('Store-Level Operations API', () => {
    it('should implement store query methods as documented', () => {
      const store = createDataStore();
      
      // Create test data
      store.createEntity({ ':user/name': 'Alice', ':user/age': 30 });
      store.createEntity({ ':user/name': 'Bob', ':user/age': 25 });
      store.createEntity({ ':user/name': 'Charlie', ':user/age': 35 });
      
      // query() method on store (without predicate to avoid DataScript issue)
      const results = store.query({
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age']
        ]
      });
      
      assert.strictEqual(results.length, 3); // Alice, Bob, and Charlie
      const names = results.map(r => r[0]).sort();
      assert.deepStrictEqual(names, ['Alice', 'Bob', 'Charlie']);
      
      // db() method
      const db = store.db();
      assert.ok(db);
      assert.ok(db.datoms);
      assert.ok(db.entity);
    });

    it('should implement proxy registry operations as documented', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Register proxy
      store._registerProxy(alice.entityId, proxy);
      
      // Should be retrievable
      const retrievedProxy = store._getRegisteredProxy(alice.entityId);
      assert.strictEqual(retrievedProxy, proxy);
      
      // Invalidate proxy
      proxy._invalidate();
      
      // Should cleanup invalid proxies
      store._cleanupProxies();
      
      // Should no longer be in registry
      const afterCleanup = store._getRegisteredProxy(alice.entityId);
      assert.strictEqual(afterCleanup, undefined);
    });
  });

  describe('Subscription System API', () => {
    it('should implement subscription creation as documented', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      
      let callbackInvoked = false;
      let receivedResults = null;
      let receivedChanges = null;
      
      // Subscription constructor as documented
      const subscription = new Subscription(
        'test-subscription',
        {
          find: ['?name'],
          where: [['?e', ':user/name', '?name']]
        },
        (results, changes) => {
          callbackInvoked = true;
          receivedResults = results;
          receivedChanges = changes;
        }
      );
      
      assert.strictEqual(subscription.id, 'test-subscription');
      assert.ok(subscription.isActive());
      assert.ok(!subscription.isEntityRooted());
      
      // notify() method
      subscription.notify([['Alice']], { type: 'test' });
      
      assert.ok(callbackInvoked);
      assert.deepStrictEqual(receivedResults, [['Alice']]);
      assert.strictEqual(receivedChanges.type, 'test');
      
      // deactivate() method
      subscription.deactivate();
      assert.ok(!subscription.isActive());
    });

    it('should implement entity-rooted subscriptions as documented', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      
      // Entity-rooted subscription
      const subscription = new Subscription(
        'entity-rooted-sub',
        {
          find: ['?name'],
          where: [['?this', ':user/name', '?name']]
        },
        () => {},
        alice.entityId // Root entity
      );
      
      assert.ok(subscription.isEntityRooted());
      assert.strictEqual(subscription.rootEntity, alice.entityId);
      
      // getQueryMetadata() method
      const metadata = subscription.getQueryMetadata();
      assert.ok(metadata.variables);
      assert.ok(metadata.attributes);
      assert.ok(metadata.variables.includes('?this'));
      assert.ok(metadata.variables.includes('?name'));
      assert.ok(metadata.attributes.includes(':user/name'));
    });

    it('should implement reactive engine operations as documented', () => {
      const store = createDataStore();
      const engine = store._reactiveEngine;
      
      assert.ok(engine instanceof ReactiveEngine);
      assert.strictEqual(engine.store, store);
      
      // Should start with no subscriptions
      assert.strictEqual(engine.getSubscriptionCount(), 0);
      assert.deepStrictEqual(engine.getActiveSubscriptions(), []);
      
      // addSubscription() method
      const subscription = new Subscription('test-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => {});
      
      engine.addSubscription(subscription);
      assert.strictEqual(engine.getSubscriptionCount(), 1);
      assert.ok(engine.getActiveSubscriptions().includes(subscription));
      
      // getSubscription() method
      const retrieved = engine.getSubscription('test-sub');
      assert.strictEqual(retrieved, subscription);
      
      // removeSubscription() method
      const removed = engine.removeSubscription('test-sub');
      assert.strictEqual(removed, subscription);
      assert.strictEqual(engine.getSubscriptionCount(), 0);
    });
  });

  describe('Advanced Features API', () => {
    it('should implement all convenience methods as documented', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/manager': { valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const manager = store.createEntity({ ':user/name': 'Manager' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const managerProxy = new EntityProxy(manager.entityId, store);
      
      // Test all relationship convenience methods
      aliceProxy.addRelation(':user/friends', bobProxy);
      aliceProxy.addRelation(':user/manager', managerProxy);
      
      assert.strictEqual(aliceProxy.get(':user/friends').length, 1);
      assert.ok(aliceProxy.get(':user/manager'));
      
      aliceProxy.removeRelation(':user/friends', bobProxy);
      assert.strictEqual(aliceProxy.get(':user/friends').length, 0);
      
      // Test computed property methods
      aliceProxy.computed('managerName', {
        find: ['?manager-name'],
        where: [
          ['?this', ':user/manager', '?manager'],
          ['?manager', ':user/name', '?manager-name']
        ]
      }, (results) => results.length > 0 ? results[0][0] : 'No manager');
      
      assert.strictEqual(aliceProxy.managerName, 'Manager');
      
      const removedProp = aliceProxy.removeComputed('managerName');
      assert.ok(removedProp);
      assert.strictEqual(aliceProxy.managerName, undefined);
    });

    it('should implement error handling as documented', () => {
      const store = createDataStore();
      
      // All documented error cases should work
      
      // Invalid proxy operations
      const invalidProxy = new EntityProxy(999, store);
      
      assert.throws(() => invalidProxy.update({}), /Cannot update invalid entity/);
      assert.throws(() => invalidProxy.query({ find: ['?e'], where: [] }), /Cannot query invalid entity/);
      const validQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
      assert.throws(() => invalidProxy.subscribe(validQuery, () => {}), /Cannot subscribe to invalid entity/);
      assert.throws(() => invalidProxy.addRelation(':user/friends', 1), /Cannot modify relationships on invalid entity/);
      
      // Invalid parameters
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      assert.throws(() => proxy.update(null), /Update data is required/);
      assert.throws(() => proxy.query(null), /Query is required/);
      assert.throws(() => proxy.subscribe(null, () => {}), /Query is required/);
      assert.throws(() => proxy.computed(null, {}, () => {}), /Property name is required/);
      assert.throws(() => proxy.onChange(null), /Callback is required/);
      
      // Property access should not throw
      assert.strictEqual(invalidProxy.get(':user/name'), undefined);
      assert.strictEqual(invalidProxy.name, undefined);
    });

    it('should implement complete reactive data flow as documented', () => {
      const schema = {
        ':user/posts': { card: 'many', valueType: 'ref' },
        ':post/author': { valueType: 'ref' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create entities as per design doc examples
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      const post = store.createEntity({
        ':post/title': 'Hello World',
        ':post/content': 'My first post!',
        ':post/author': alice.entityId,
        ':post/published': true
      });
      
      store.conn.transact([
        ['+', alice.entityId, ':user/posts', post.entityId],
        ['+', alice.entityId, ':user/friends', bob.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Complete reactive flow as documented
      
      // 1. Property access
      assert.strictEqual(aliceProxy.get(':user/name'), 'Alice');
      assert.strictEqual(aliceProxy.name, 'Alice'); // Convenience property
      
      const friends = aliceProxy.get(':user/friends');
      assert.ok(Array.isArray(friends));
      assert.strictEqual(friends.length, 1);
      assert.ok(friends[0] instanceof EntityProxy);
      
      // 2. Entity-rooted query
      const posts = aliceProxy.query({
        find: ['?title', '?content'],
        where: [
          ['?this', ':user/posts', '?post'],
          ['?post', ':post/title', '?title'],
          ['?post', ':post/content', '?content'],
          ['?post', ':post/published', true]
        ]
      });
      
      assert.strictEqual(posts.length, 1);
      assert.strictEqual(posts[0][0], 'Hello World');
      assert.strictEqual(posts[0][1], 'My first post!');
      
      // 3. Computed properties
      aliceProxy.computed('postCount', {
        find: ['?post'],
        where: [
          ['?this', ':user/posts', '?post'],
          ['?post', ':post/published', true]
        ]
      }, (results) => results.length);
      
      assert.strictEqual(aliceProxy.postCount, 1);
      
      // 4. Subscriptions
      let subscriptionTriggered = false;
      const unsubscribe = aliceProxy.subscribe({
        find: ['?post-title'],
        where: [
          ['?this', ':user/posts', '?post'],
          ['?post', ':post/title', '?post-title']
        ]
      }, () => { subscriptionTriggered = true; });
      
      assert.ok(typeof unsubscribe === 'function');
      
      // 5. Change events
      let changeEventTriggered = false;
      aliceProxy.onChange(() => { changeEventTriggered = true; });
      
      // 6. Updates trigger reactive system
      aliceProxy.update({ ':user/bio': 'Software Engineer' });
      
      assert.ok(changeEventTriggered);
      assert.strictEqual(aliceProxy.get(':user/bio'), 'Software Engineer');
      
      unsubscribe();
    });
  });

  describe('Integration API Validation', () => {
    it('should validate complete API surface matches design document', () => {
      const store = createDataStore();
      
      // Validate DataStore API
      const storeApiMethods = [
        'createEntity', 'createEntities', 'query', 'db',
        '_registerProxy', '_getRegisteredProxy', '_cleanupProxies'
      ];
      
      storeApiMethods.forEach(method => {
        assert.ok(typeof store[method] === 'function', `DataStore missing method: ${method}`);
      });
      
      // Validate DataStore properties
      assert.ok(store.schema !== undefined, 'DataStore missing schema property');
      assert.ok(store.options !== undefined, 'DataStore missing options property');
      assert.ok(store.conn !== undefined, 'DataStore missing conn property');
      assert.ok(store._reactiveEngine !== undefined, 'DataStore missing _reactiveEngine property');
      
      // Validate EntityProxy API
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      const proxyApiMethods = [
        'get', 'getAll', 'update', 'query', 'subscribe', 'computed', 'removeComputed',
        'addRelation', 'removeRelation', 'onChange', 'onDelete', 'delete',
        'isValid', 'equals', 'toString', 'toJSON'
      ];
      
      proxyApiMethods.forEach(method => {
        assert.ok(typeof proxy[method] === 'function', `EntityProxy missing method: ${method}`);
      });
      
      // Validate EntityProxy properties
      assert.ok(proxy.entityId !== undefined, 'EntityProxy missing entityId property');
      assert.ok(proxy.store !== undefined, 'EntityProxy missing store property');
      
      // Validate convenience getters exist (they return undefined if no attribute)
      const convenienceGetters = ['name', 'email', 'age', 'active', 'id', 'friends', 'profile'];
      convenienceGetters.forEach(getter => {
        // Just check that the getter exists and doesn't throw
        assert.doesNotThrow(() => {
          const value = proxy[getter];
          // Value can be undefined if attribute doesn't exist
        }, `EntityProxy missing convenience getter: ${getter}`);
      });
    });

    it('should validate reactive engine API completeness', () => {
      const store = createDataStore();
      const engine = store._reactiveEngine;
      
      // Validate ReactiveEngine API
      const engineApiMethods = [
        'startListening', 'stopListening', 'addSubscription', 'removeSubscription',
        'getSubscription', 'getSubscriptionCount', 'getActiveSubscriptions',
        'findSubscriptionsByEntity', 'findSubscriptionsByAttribute', 'cleanupSubscriptions',
        'findAffectedSubscriptions', 'notifyAffectedSubscriptions', 'processBatchedChanges'
      ];
      
      engineApiMethods.forEach(method => {
        assert.ok(typeof engine[method] === 'function', `ReactiveEngine missing method: ${method}`);
      });
      
      // Validate ReactiveEngine properties  
      assert.ok(engine.store !== undefined, 'ReactiveEngine missing store property');
      assert.ok(engine.subscriptions !== undefined, 'ReactiveEngine missing subscriptions property');
      
      // Test basic engine functionality
      assert.strictEqual(engine.getSubscriptionCount(), 0);
      
      const subscription = new Subscription('test', {}, () => {});
      engine.addSubscription(subscription);
      assert.strictEqual(engine.getSubscriptionCount(), 1);
      
      engine.removeSubscription('test');
      assert.strictEqual(engine.getSubscriptionCount(), 0);
    });

    it('should validate subscription registry API completeness', () => {
      
      const registry = new SubscriptionRegistry();
      
      // Validate SubscriptionRegistry API
      const registryApiMethods = [
        'register', 'unregister', 'get', 'getAll', 'size',
        'findByEntity', 'findByAttribute', 'cleanup'
      ];
      
      registryApiMethods.forEach(method => {
        assert.ok(typeof registry[method] === 'function', `SubscriptionRegistry missing method: ${method}`);
      });
      
      // Test basic registry functionality
      assert.strictEqual(registry.size(), 0);
      
      const subscription = new Subscription('test', {}, () => {});
      registry.register(subscription);
      assert.strictEqual(registry.size(), 1);
      
      const retrieved = registry.get('test');
      assert.strictEqual(retrieved, subscription);
      
      registry.unregister('test');
      assert.strictEqual(registry.size(), 0);
    });

    it('should validate transaction analyzer API completeness', () => {
      
      // Validate TransactionAnalyzer API
      assert.ok(typeof TransactionAnalyzer.analyze === 'function', 'TransactionAnalyzer missing analyze method');
      
      // Test transaction analysis
      const txData = [
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 1, a: ':user/age', v: 30, tx: 1001, added: true }
      ];
      
      const analysis = TransactionAnalyzer.analyze(txData);
      
      // Validate analysis result structure
      assert.ok(analysis.changedEntities instanceof Set);
      assert.ok(analysis.changedAttributes instanceof Set);
      assert.ok(Array.isArray(analysis.addedDatoms));
      assert.ok(Array.isArray(analysis.retractedDatoms));
      assert.ok(analysis.changesByEntity instanceof Map);
      assert.ok(analysis.changesByAttribute instanceof Map);
      assert.ok(typeof analysis.getSummary === 'function');
      
      // Test analysis functionality
      assert.ok(analysis.changedEntities.has(1));
      assert.ok(analysis.changedAttributes.has(':user/name'));
      assert.ok(analysis.changedAttributes.has(':user/age'));
      assert.strictEqual(analysis.addedDatoms.length, 2);
      
      const summary = analysis.getSummary();
      assert.strictEqual(summary.entitiesChanged, 1);
      assert.strictEqual(summary.attributesChanged, 2);
    });
  });

  describe('Export API Validation', () => {
    it('should validate all exports are available and functional', () => {
      // Test main exports
      assert.ok(typeof createDataStore === 'function', 'createDataStore not exported');
      assert.ok(typeof DataStore === 'function', 'DataStore not exported');
      assert.ok(typeof EntityProxy === 'function', 'EntityProxy not exported');
      assert.ok(typeof Subscription === 'function', 'Subscription not exported');
      assert.ok(typeof ReactiveEngine === 'function', 'ReactiveEngine not exported');
      
      // Test that exports work
      const store = createDataStore();
      assert.ok(store instanceof DataStore);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      assert.ok(proxy instanceof EntityProxy);
      
      const subscription = new Subscription('test', {}, () => {});
      assert.ok(subscription instanceof Subscription);
      
      const engine = new ReactiveEngine(store);
      assert.ok(engine instanceof ReactiveEngine);
    });

    it('should validate complete usage example from design document', () => {
      // Complete example from design document
      const store = createDataStore({
        schema: {
          ':user/id': { unique: 'identity' },
          ':user/friends': { card: 'many', valueType: 'ref' },
          ':post/author': { valueType: 'ref' }
        }
      });
      
      // Create user through proxy (design doc example)
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com'
      });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Property access (design doc example)
      assert.strictEqual(aliceProxy.get(':user/name'), 'Alice');
      assert.strictEqual(aliceProxy.name, 'Alice'); // Convenience property
      assert.strictEqual(aliceProxy.email, 'alice@example.com');
      
      // Updates (design doc example)
      aliceProxy.update({
        ':user/name': 'Alice Smith',
        ':user/age': 30
      });
      
      assert.strictEqual(aliceProxy.get(':user/name'), 'Alice Smith');
      assert.strictEqual(aliceProxy.get(':user/age'), 30);
      
      // Create relationships (design doc example)
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const bobProxy = new EntityProxy(bob.entityId, store);
      
      aliceProxy.addRelation(':user/friends', bobProxy);
      
      const friends = aliceProxy.get(':user/friends');
      assert.strictEqual(friends.length, 1);
      assert.strictEqual(friends[0].get(':user/name'), 'Bob');
      
      // Entity-rooted queries (design doc example)
      const friendQuery = aliceProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      
      assert.strictEqual(friendQuery.length, 1);
      assert.strictEqual(friendQuery[0][0], 'Bob');
      
      // Subscriptions (design doc example)
      let subscriptionResults = null;
      const unsubscribe = aliceProxy.subscribe({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, (results) => {
        subscriptionResults = results;
      });
      
      assert.ok(typeof unsubscribe === 'function');
      
      // Computed properties (design doc example)
      aliceProxy.computed('friendCount', {
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, (results) => results.length);
      
      assert.strictEqual(aliceProxy.friendCount, 1);
      
      // Event handling (design doc example)
      let changeDetected = false;
      aliceProxy.onChange(() => { changeDetected = true; });
      
      // Trigger change
      aliceProxy.update({ ':user/score': 85 });
      assert.ok(changeDetected);
      
      // Deletion (design doc example)
      aliceProxy.delete();
      assert.ok(!aliceProxy.isValid());
      
      unsubscribe();
    });
  });
});