import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Subscription, SubscriptionRegistry } from '../../src/subscription.js';
import { ReactiveEngine } from '../../src/reactor.js';
import { DataStore } from '../../src/store.js';

describe('Subscription Management - DataScript Integration', () => {
  describe('Subscription Registry with ReactiveEngine', () => {
    it('should integrate subscription registry with reactive engine', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      // Should have access to subscription registry
      assert.ok(engine.subscriptions);
      assert.strictEqual(engine.getSubscriptionCount(), 0);
      
      // Should be able to add subscriptions to engine
      const subscription = new Subscription('test-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => {});
      
      engine.addSubscription(subscription);
      assert.strictEqual(engine.getSubscriptionCount(), 1);
      assert.ok(engine.getActiveSubscriptions().includes(subscription));
    });

    it('should handle subscription lifecycle with real transactions', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      const engine = new ReactiveEngine(store);
      
      const subscription = new Subscription('user-sub', {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age']
        ]
      }, () => {});
      
      engine.addSubscription(subscription);
      engine.startListening();
      
      // Create entities
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30
      });
      
      const bob = store.createEntity({
        ':user/name': 'Bob',
        ':user/age': 25
      });
      
      // Subscription should remain active and registered
      assert.ok(subscription.isActive());
      assert.strictEqual(engine.getSubscriptionCount(), 1);
      
      engine.stopListening();
    });

    it('should manage multiple concurrent subscriptions', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      const subscriptions = [];
      const callbacks = [];
      
      // Create multiple subscriptions
      for (let i = 0; i < 5; i++) {
        const callback = (results, changes) => {
          callbacks[i] = { results, changes };
        };
        
        const subscription = new Subscription(`sub-${i}`, {
          find: ['?name'],
          where: [['?e', ':user/name', '?name']]
        }, callback);
        
        subscriptions.push(subscription);
        engine.addSubscription(subscription);
      }
      
      assert.strictEqual(engine.getSubscriptionCount(), 5);
      
      // Remove some subscriptions
      engine.removeSubscription('sub-1');
      engine.removeSubscription('sub-3');
      
      assert.strictEqual(engine.getSubscriptionCount(), 3);
      assert.strictEqual(engine.getSubscription('sub-1'), undefined);
      assert.strictEqual(engine.getSubscription('sub-3'), undefined);
      assert.ok(engine.getSubscription('sub-0'));
      assert.ok(engine.getSubscription('sub-2'));
      assert.ok(engine.getSubscription('sub-4'));
    });

    it('should handle entity-rooted subscriptions with real entities', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      const engine = new ReactiveEngine(store);
      
      // Create entities
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      let aliceCallbackCount = 0;
      let bobCallbackCount = 0;
      
      // Create entity-rooted subscriptions
      const aliceSubscription = new Subscription('alice-friends', {
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, () => { aliceCallbackCount++; }, alice.entityId);
      
      const bobSubscription = new Subscription('bob-friends', {
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, () => { bobCallbackCount++; }, bob.entityId);
      
      engine.addSubscription(aliceSubscription);
      engine.addSubscription(bobSubscription);
      
      assert.ok(aliceSubscription.isEntityRooted());
      assert.ok(bobSubscription.isEntityRooted());
      assert.strictEqual(aliceSubscription.rootEntity, alice.entityId);
      assert.strictEqual(bobSubscription.rootEntity, bob.entityId);
      
      // Should be able to find entity-rooted subscriptions
      const aliceSubs = engine.findSubscriptionsByEntity(alice.entityId);
      assert.strictEqual(aliceSubs.length, 1);
      assert.strictEqual(aliceSubs[0], aliceSubscription);
      
      const bobSubs = engine.findSubscriptionsByEntity(bob.entityId);
      assert.strictEqual(bobSubs.length, 1);
      assert.strictEqual(bobSubs[0], bobSubscription);
    });

    it('should cleanup invalid subscriptions automatically', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      // Create subscriptions
      const sub1 = new Subscription('sub-1', {}, () => {});
      const sub2 = new Subscription('sub-2', {}, () => {});
      const sub3 = new Subscription('sub-3', {}, () => {});
      
      engine.addSubscription(sub1);
      engine.addSubscription(sub2);
      engine.addSubscription(sub3);
      
      assert.strictEqual(engine.getSubscriptionCount(), 3);
      
      // Deactivate some subscriptions
      sub1.deactivate();
      sub3.deactivate();
      
      // Cleanup should remove deactivated subscriptions
      const removedCount = engine.cleanupSubscriptions();
      assert.strictEqual(removedCount, 2);
      assert.strictEqual(engine.getSubscriptionCount(), 1);
      assert.ok(engine.getSubscription('sub-2'));
    });

    it('should handle subscription errors without affecting other subscriptions', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      let goodCallbackCount = 0;
      let errorCallbackCount = 0;
      
      const goodSubscription = new Subscription('good-sub', {}, () => {
        goodCallbackCount++;
      });
      
      const errorSubscription = new Subscription('error-sub', {}, () => {
        errorCallbackCount++;
        throw new Error('Subscription callback error');
      });
      
      engine.addSubscription(goodSubscription);
      engine.addSubscription(errorSubscription);
      
      // Simulate notification (normally triggered by transaction analysis)
      goodSubscription.notify([], {});
      errorSubscription.notify([], {}); // Should not throw
      
      assert.strictEqual(goodCallbackCount, 1);
      assert.strictEqual(errorCallbackCount, 1);
      assert.strictEqual(engine.getSubscriptionCount(), 2); // Both still registered
    });

    it('should support subscription metadata querying', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      const subscription = new Subscription('metadata-sub', {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age'],
          ['?e', ':user/active', true]
        ]
      }, () => {});
      
      engine.addSubscription(subscription);
      
      // Should be able to find by attribute
      const nameSubs = engine.findSubscriptionsByAttribute(':user/name');
      assert.strictEqual(nameSubs.length, 1);
      assert.strictEqual(nameSubs[0], subscription);
      
      const ageSubs = engine.findSubscriptionsByAttribute(':user/age');
      assert.strictEqual(ageSubs.length, 1);
      
      const activeSubs = engine.findSubscriptionsByAttribute(':user/active');
      assert.strictEqual(activeSubs.length, 1);
      
      // Non-existent attribute should return empty
      const nonExistentSubs = engine.findSubscriptionsByAttribute(':user/nonexistent');
      assert.strictEqual(nonExistentSubs.length, 0);
    });
  });

  describe('Subscription Integration with DataStore Operations', () => {
    it('should maintain subscriptions through entity creation and updates', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      let notificationCount = 0;
      let latestResults = null;
      
      const subscription = new Subscription('persistent-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, (results) => {
        notificationCount++;
        latestResults = results;
      });
      
      engine.addSubscription(subscription);
      assert.ok(subscription.isActive());
      
      // Perform database operations
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      // Update entity
      store.conn.transact([
        { ':db/id': alice.entityId, ':user/age': 30 }
      ]);
      
      // Subscription should remain active
      assert.ok(subscription.isActive());
      assert.strictEqual(engine.getSubscriptionCount(), 1);
      
      engine.stopListening();
    });

    it('should handle subscription removal during transaction processing', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      const sub1 = new Subscription('temp-sub-1', {}, () => {});
      const sub2 = new Subscription('temp-sub-2', {}, () => {});
      
      engine.addSubscription(sub1);
      engine.addSubscription(sub2);
      engine.startListening();
      
      assert.strictEqual(engine.getSubscriptionCount(), 2);
      
      // Remove subscription while engine is processing
      engine.removeSubscription('temp-sub-1');
      
      assert.strictEqual(engine.getSubscriptionCount(), 1);
      assert.strictEqual(engine.getSubscription('temp-sub-1'), undefined);
      assert.ok(engine.getSubscription('temp-sub-2'));
      
      engine.stopListening();
    });

    it('should handle high subscription volume', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      const subscriptionCount = 100;
      const subscriptions = [];
      
      // Create many subscriptions
      for (let i = 0; i < subscriptionCount; i++) {
        const subscription = new Subscription(`bulk-sub-${i}`, {
          find: ['?name'],
          where: [['?e', ':user/name', '?name']]
        }, () => {});
        
        subscriptions.push(subscription);
        engine.addSubscription(subscription);
      }
      
      assert.strictEqual(engine.getSubscriptionCount(), subscriptionCount);
      
      // Should handle bulk cleanup efficiently
      subscriptions.slice(0, 50).forEach(sub => sub.deactivate());
      
      const removedCount = engine.cleanupSubscriptions();
      assert.strictEqual(removedCount, 50);
      assert.strictEqual(engine.getSubscriptionCount(), 50);
      
      // Remaining subscriptions should still be active
      subscriptions.slice(50).forEach(sub => {
        assert.ok(sub.isActive());
        assert.ok(engine.getSubscription(sub.id));
      });
    });
  });
});