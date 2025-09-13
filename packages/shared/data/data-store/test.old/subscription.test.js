import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Subscription, SubscriptionRegistry } from '../src/subscription.js';
import { DataStore } from '../src/store.js';

describe('Subscription System', () => {
  describe('Subscription', () => {
    it('should create subscription with query and callback', () => {
      const query = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      const callback = (results) => {};
      
      const subscription = new Subscription('sub-1', query, callback);
      
      assert.strictEqual(subscription.id, 'sub-1');
      assert.deepStrictEqual(subscription.query, query);
      assert.strictEqual(subscription.callback, callback);
      assert.ok(subscription.isActive());
      assert.strictEqual(subscription.rootEntity, null);
    });

    it('should support entity-rooted subscriptions', () => {
      const query = {
        find: ['?name'],
        where: [['?this', ':user/friends', '?friend'], ['?friend', ':user/name', '?name']]
      };
      const callback = (results) => {};
      const rootEntity = 123;
      
      const subscription = new Subscription('sub-1', query, callback, rootEntity);
      
      assert.strictEqual(subscription.rootEntity, rootEntity);
      assert.ok(subscription.isEntityRooted());
    });

    it('should validate constructor parameters', () => {
      const query = { find: ['?e'], where: [['?e', ':user/name', '?name']] };
      const callback = () => {};
      
      // Should throw for missing ID
      assert.throws(() => {
        new Subscription(null, query, callback);
      }, /Subscription ID is required/);
      
      // Should throw for missing query
      assert.throws(() => {
        new Subscription('sub-1', null, callback);
      }, /Query is required/);
      
      // Should throw for missing callback
      assert.throws(() => {
        new Subscription('sub-1', query, null);
      }, /Callback is required/);
      
      // Should throw for non-function callback
      assert.throws(() => {
        new Subscription('sub-1', query, 'invalid');
      }, /Callback must be a function/);
    });

    it('should support subscription deactivation', () => {
      const subscription = new Subscription('sub-1', {}, () => {});
      
      assert.ok(subscription.isActive());
      
      subscription.deactivate();
      assert.ok(!subscription.isActive());
      
      // Should not affect multiple deactivations
      subscription.deactivate();
      assert.ok(!subscription.isActive());
    });

    it('should provide query metadata', () => {
      const query = {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age']
        ]
      };
      
      const subscription = new Subscription('sub-1', query, () => {});
      
      const metadata = subscription.getQueryMetadata();
      assert.ok(metadata.variables);
      assert.ok(metadata.attributes);
      assert.ok(metadata.variables.includes('?e'));
      assert.ok(metadata.variables.includes('?name'));
      assert.ok(metadata.variables.includes('?age'));
      assert.ok(metadata.attributes.includes(':user/name'));
      assert.ok(metadata.attributes.includes(':user/age'));
    });

    it('should execute callbacks safely', () => {
      let callbackInvoked = false;
      let receivedResults = null;
      let receivedChanges = null;
      
      const callback = (results, changes) => {
        callbackInvoked = true;
        receivedResults = results;
        receivedChanges = changes;
      };
      
      const subscription = new Subscription('sub-1', {}, callback);
      
      const testResults = [['Alice', 30], ['Bob', 25]];
      const testChanges = { added: 1, removed: 0 };
      
      subscription.notify(testResults, testChanges);
      
      assert.ok(callbackInvoked);
      assert.strictEqual(receivedResults, testResults);
      assert.strictEqual(receivedChanges, testChanges);
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = () => {
        throw new Error('Callback error');
      };
      
      const subscription = new Subscription('sub-1', {}, errorCallback);
      
      // Should not throw when callback errors
      assert.doesNotThrow(() => {
        subscription.notify([], {});
      });
    });

    it('should not notify deactivated subscriptions', () => {
      let callbackInvoked = false;
      const callback = () => { callbackInvoked = true; };
      
      const subscription = new Subscription('sub-1', {}, callback);
      subscription.deactivate();
      
      subscription.notify([], {});
      assert.ok(!callbackInvoked);
    });
  });

  describe('SubscriptionRegistry', () => {
    it('should create empty registry', () => {
      const registry = new SubscriptionRegistry();
      
      assert.strictEqual(registry.size(), 0);
      assert.deepStrictEqual(registry.getAll(), []);
      assert.strictEqual(registry.get('non-existent'), undefined);
    });

    it('should register and retrieve subscriptions', () => {
      const registry = new SubscriptionRegistry();
      const subscription1 = new Subscription('sub-1', {}, () => {});
      const subscription2 = new Subscription('sub-2', {}, () => {});
      
      registry.register(subscription1);
      registry.register(subscription2);
      
      assert.strictEqual(registry.size(), 2);
      assert.strictEqual(registry.get('sub-1'), subscription1);
      assert.strictEqual(registry.get('sub-2'), subscription2);
      
      const allSubs = registry.getAll();
      assert.strictEqual(allSubs.length, 2);
      assert.ok(allSubs.includes(subscription1));
      assert.ok(allSubs.includes(subscription2));
    });

    it('should prevent duplicate subscription IDs', () => {
      const registry = new SubscriptionRegistry();
      const subscription1 = new Subscription('sub-1', {}, () => {});
      const subscription2 = new Subscription('sub-1', {}, () => {}); // Same ID
      
      registry.register(subscription1);
      
      assert.throws(() => {
        registry.register(subscription2);
      }, /Subscription with ID 'sub-1' already exists/);
      
      assert.strictEqual(registry.size(), 1);
    });

    it('should unregister subscriptions', () => {
      const registry = new SubscriptionRegistry();
      const subscription = new Subscription('sub-1', {}, () => {});
      
      registry.register(subscription);
      assert.strictEqual(registry.size(), 1);
      
      const removed = registry.unregister('sub-1');
      assert.strictEqual(removed, subscription);
      assert.strictEqual(registry.size(), 0);
      assert.strictEqual(registry.get('sub-1'), undefined);
    });

    it('should handle unregistering non-existent subscriptions', () => {
      const registry = new SubscriptionRegistry();
      
      const removed = registry.unregister('non-existent');
      assert.strictEqual(removed, undefined);
      assert.strictEqual(registry.size(), 0);
    });

    it('should find subscriptions by criteria', () => {
      const registry = new SubscriptionRegistry();
      
      const entitySub = new Subscription('entity-1', {}, () => {}, 123);
      const generalSub1 = new Subscription('general-1', {}, () => {});
      const generalSub2 = new Subscription('general-2', {}, () => {});
      
      registry.register(entitySub);
      registry.register(generalSub1);
      registry.register(generalSub2);
      
      // Find entity-rooted subscriptions
      const entitySubs = registry.findByEntity(123);
      assert.strictEqual(entitySubs.length, 1);
      assert.strictEqual(entitySubs[0], entitySub);
      
      // Find general subscriptions (no root entity)
      const generalSubs = registry.findByEntity(null);
      assert.strictEqual(generalSubs.length, 2);
      assert.ok(generalSubs.includes(generalSub1));
      assert.ok(generalSubs.includes(generalSub2));
    });

    it('should find subscriptions by attribute', () => {
      const registry = new SubscriptionRegistry();
      
      const nameSub = new Subscription('name-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => {});
      
      const ageSub = new Subscription('age-sub', {
        find: ['?age'],  
        where: [['?e', ':user/age', '?age']]
      }, () => {});
      
      const bothSub = new Subscription('both-sub', {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age']
        ]
      }, () => {});
      
      registry.register(nameSub);
      registry.register(ageSub);
      registry.register(bothSub);
      
      // Find subscriptions that involve :user/name
      const nameSubs = registry.findByAttribute(':user/name');
      assert.strictEqual(nameSubs.length, 2);
      assert.ok(nameSubs.includes(nameSub));
      assert.ok(nameSubs.includes(bothSub));
      
      // Find subscriptions that involve :user/age
      const ageSubs = registry.findByAttribute(':user/age');
      assert.strictEqual(ageSubs.length, 2);
      assert.ok(ageSubs.includes(ageSub));
      assert.ok(ageSubs.includes(bothSub));
    });

    it('should cleanup deactivated subscriptions', () => {
      const registry = new SubscriptionRegistry();
      
      const sub1 = new Subscription('sub-1', {}, () => {});
      const sub2 = new Subscription('sub-2', {}, () => {});
      const sub3 = new Subscription('sub-3', {}, () => {});
      
      registry.register(sub1);
      registry.register(sub2);
      registry.register(sub3);
      
      assert.strictEqual(registry.size(), 3);
      
      // Deactivate some subscriptions
      sub1.deactivate();
      sub3.deactivate();
      
      // Cleanup should remove deactivated subscriptions
      const removedCount = registry.cleanup();
      assert.strictEqual(removedCount, 2);
      assert.strictEqual(registry.size(), 1);
      assert.strictEqual(registry.get('sub-2'), sub2);
      assert.strictEqual(registry.get('sub-1'), undefined);
      assert.strictEqual(registry.get('sub-3'), undefined);
    });

    it('should handle concurrent registration operations', () => {
      const registry = new SubscriptionRegistry();
      const subscriptions = [];
      
      // Register multiple subscriptions concurrently
      for (let i = 0; i < 10; i++) {
        const sub = new Subscription(`sub-${i}`, {}, () => {}, i % 3 === 0 ? 100 + i : null);
        subscriptions.push(sub);
        registry.register(sub);
      }
      
      assert.strictEqual(registry.size(), 10);
      
      // All should be retrievable
      subscriptions.forEach(sub => {
        assert.strictEqual(registry.get(sub.id), sub);
      });
      
      // Should be able to find entity-rooted subscriptions
      const entitySubs = registry.findByEntity(100);
      assert.strictEqual(entitySubs.length, 1);
      assert.strictEqual(entitySubs[0].id, 'sub-0');
    });
  });
});