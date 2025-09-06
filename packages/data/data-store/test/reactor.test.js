import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ReactiveEngine, TransactionAnalyzer } from '../src/reactor.js';
import { Subscription } from '../src/subscription.js';
import { DataStore } from '../src/store.js';

describe('Transaction Analysis', () => {
  describe('TransactionAnalyzer', () => {
    it('should analyze simple transaction data', () => {
      const txData = [
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 1, a: ':user/age', v: 30, tx: 1001, added: true },
        { e: 2, a: ':user/name', v: 'Bob', tx: 1001, added: true }
      ];
      
      const analysis = TransactionAnalyzer.analyze(txData);
      
      assert.ok(analysis.changedEntities);
      assert.ok(analysis.changedAttributes);
      assert.ok(analysis.addedDatoms);
      assert.ok(analysis.retractedDatoms);
      
      // Should detect changed entities
      assert.ok(analysis.changedEntities.has(1));
      assert.ok(analysis.changedEntities.has(2));
      assert.strictEqual(analysis.changedEntities.size, 2);
      
      // Should detect changed attributes
      assert.ok(analysis.changedAttributes.has(':user/name'));
      assert.ok(analysis.changedAttributes.has(':user/age'));
      assert.strictEqual(analysis.changedAttributes.size, 2);
    });

    it('should distinguish between additions and retractions', () => {
      const txData = [
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 1, a: ':user/email', v: 'old@example.com', tx: 1002, added: false },
        { e: 1, a: ':user/email', v: 'new@example.com', tx: 1002, added: true }
      ];
      
      const analysis = TransactionAnalyzer.analyze(txData);
      
      // Should categorize additions and retractions
      assert.strictEqual(analysis.addedDatoms.length, 2);
      assert.strictEqual(analysis.retractedDatoms.length, 1);
      
      const addedValues = analysis.addedDatoms.map(d => d.v);
      const retractedValues = analysis.retractedDatoms.map(d => d.v);
      
      assert.ok(addedValues.includes('Alice'));
      assert.ok(addedValues.includes('new@example.com'));
      assert.ok(retractedValues.includes('old@example.com'));
    });

    it('should handle empty transaction data', () => {
      const analysis = TransactionAnalyzer.analyze([]);
      
      assert.strictEqual(analysis.changedEntities.size, 0);
      assert.strictEqual(analysis.changedAttributes.size, 0);
      assert.strictEqual(analysis.addedDatoms.length, 0);
      assert.strictEqual(analysis.retractedDatoms.length, 0);
    });

    it('should handle null/undefined transaction data', () => {
      const analysis1 = TransactionAnalyzer.analyze(null);
      const analysis2 = TransactionAnalyzer.analyze(undefined);
      
      [analysis1, analysis2].forEach(analysis => {
        assert.strictEqual(analysis.changedEntities.size, 0);
        assert.strictEqual(analysis.changedAttributes.size, 0);
        assert.strictEqual(analysis.addedDatoms.length, 0);
        assert.strictEqual(analysis.retractedDatoms.length, 0);
      });
    });

    it('should group changes by entity', () => {
      const txData = [
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 1, a: ':user/age', v: 30, tx: 1001, added: true },
        { e: 2, a: ':user/name', v: 'Bob', tx: 1001, added: true },
        { e: 2, a: ':user/email', v: 'bob@example.com', tx: 1001, added: true },
        { e: 3, a: ':user/name', v: 'Charlie', tx: 1001, added: true }
      ];
      
      const analysis = TransactionAnalyzer.analyze(txData);
      
      assert.ok(analysis.changesByEntity);
      assert.ok(analysis.changesByEntity.has(1));
      assert.ok(analysis.changesByEntity.has(2));
      assert.ok(analysis.changesByEntity.has(3));
      
      // Entity 1 should have 2 changes
      const entity1Changes = analysis.changesByEntity.get(1);
      assert.strictEqual(entity1Changes.length, 2);
      assert.ok(entity1Changes.some(d => d.a === ':user/name'));
      assert.ok(entity1Changes.some(d => d.a === ':user/age'));
      
      // Entity 2 should have 2 changes
      const entity2Changes = analysis.changesByEntity.get(2);
      assert.strictEqual(entity2Changes.length, 2);
      
      // Entity 3 should have 1 change
      const entity3Changes = analysis.changesByEntity.get(3);
      assert.strictEqual(entity3Changes.length, 1);
    });

    it('should group changes by attribute', () => {
      const txData = [
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 2, a: ':user/name', v: 'Bob', tx: 1001, added: true },
        { e: 3, a: ':user/name', v: 'Charlie', tx: 1001, added: true },
        { e: 1, a: ':user/age', v: 30, tx: 1001, added: true },
        { e: 2, a: ':user/age', v: 25, tx: 1001, added: true }
      ];
      
      const analysis = TransactionAnalyzer.analyze(txData);
      
      assert.ok(analysis.changesByAttribute);
      assert.ok(analysis.changesByAttribute.has(':user/name'));
      assert.ok(analysis.changesByAttribute.has(':user/age'));
      
      // :user/name should have 3 changes
      const nameChanges = analysis.changesByAttribute.get(':user/name');
      assert.strictEqual(nameChanges.length, 3);
      
      // :user/age should have 2 changes
      const ageChanges = analysis.changesByAttribute.get(':user/age');
      assert.strictEqual(ageChanges.length, 2);
    });

    it('should identify affected entity-attribute pairs', () => {
      const txData = [
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 1, a: ':user/age', v: 30, tx: 1001, added: true },
        { e: 2, a: ':user/name', v: 'Bob', tx: 1001, added: true }
      ];
      
      const analysis = TransactionAnalyzer.analyze(txData);
      
      assert.ok(analysis.affectedPairs);
      assert.ok(analysis.affectedPairs.has('1|:user/name'));
      assert.ok(analysis.affectedPairs.has('1|:user/age'));
      assert.ok(analysis.affectedPairs.has('2|:user/name'));
      assert.strictEqual(analysis.affectedPairs.size, 3);
    });

    it('should handle reference attribute changes', () => {
      const txData = [
        { e: 1, a: ':user/profile', v: 10, tx: 1001, added: true },
        { e: 1, a: ':user/friends', v: 20, tx: 1001, added: true },
        { e: 1, a: ':user/friends', v: 21, tx: 1001, added: true }
      ];
      
      const analysis = TransactionAnalyzer.analyze(txData);
      
      // Should track referenced entities
      assert.ok(analysis.referencedEntities);
      assert.ok(analysis.referencedEntities.has(10));
      assert.ok(analysis.referencedEntities.has(20));
      assert.ok(analysis.referencedEntities.has(21));
      assert.strictEqual(analysis.referencedEntities.size, 3);
    });

    it('should provide transaction summary', () => {
      const txData = [
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 1, a: ':user/age', v: 25, tx: 1002, added: false },
        { e: 1, a: ':user/age', v: 30, tx: 1002, added: true },
        { e: 2, a: ':user/name', v: 'Bob', tx: 1001, added: true }
      ];
      
      const analysis = TransactionAnalyzer.analyze(txData);
      
      const summary = analysis.getSummary();
      assert.strictEqual(summary.totalDatoms, 4);
      assert.strictEqual(summary.addedCount, 3);
      assert.strictEqual(summary.retractedCount, 1);
      assert.strictEqual(summary.entitiesChanged, 2);
      assert.strictEqual(summary.attributesChanged, 2);
    });
  });

  describe('ReactiveEngine Basic Structure', () => {
    it('should create ReactiveEngine with DataStore reference', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      assert.strictEqual(engine.store, store);
      assert.ok(engine.subscriptions);
      assert.strictEqual(engine.subscriptions.size(), 0);
    });

    it('should handle transaction reports', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      // Create a mock transaction report
      const report = {
        dbBefore: store.db(),
        dbAfter: store.db(),
        txData: [
          { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true }
        ],
        tempids: new Map(),
        tx: 1001
      };
      
      // Should not throw when processing transaction
      assert.doesNotThrow(() => {
        engine.processTransaction(report);
      });
    });

    it('should initialize with empty subscription registry', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      assert.strictEqual(engine.getSubscriptionCount(), 0);
      assert.deepStrictEqual(engine.getActiveSubscriptions(), []);
    });

    it('should validate constructor parameters', () => {
      assert.throws(() => {
        new ReactiveEngine(null);
      }, /DataStore is required/);
      
      assert.throws(() => {
        new ReactiveEngine(undefined);
      }, /DataStore is required/);
      
      assert.throws(() => {
        new ReactiveEngine('invalid');
      }, /DataStore must be a DataStore instance/);
    });
  });

  describe('Change Propagation', () => {
    it('should identify affected subscriptions from transaction analysis', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      // Create subscriptions with different patterns
      const nameSubscription = new Subscription('name-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => {});
      
      const ageSubscription = new Subscription('age-sub', {
        find: ['?age'],
        where: [['?e', ':user/age', '?age']]
      }, () => {});
      
      const bothSubscription = new Subscription('both-sub', {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age']
        ]
      }, () => {});
      
      engine.addSubscription(nameSubscription);
      engine.addSubscription(ageSubscription);
      engine.addSubscription(bothSubscription);
      
      // Create transaction analysis
      const txData = [
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 2, a: ':user/email', v: 'bob@example.com', tx: 1001, added: true }
      ];
      const analysis = TransactionAnalyzer.analyze(txData);
      
      // Should identify affected subscriptions
      const affected = engine.findAffectedSubscriptions(analysis);
      assert.strictEqual(affected.length, 2); // nameSubscription and bothSubscription
      assert.ok(affected.includes(nameSubscription));
      assert.ok(affected.includes(bothSubscription));
      assert.ok(!affected.includes(ageSubscription)); // Not affected by :user/name change
    });

    it('should handle entity-rooted subscription matching', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      // Create entity-rooted subscriptions
      const alice123Subscription = new Subscription('alice-sub', {
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, () => {}, 123);
      
      const bob456Subscription = new Subscription('bob-sub', {
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, () => {}, 456);
      
      const generalSubscription = new Subscription('general-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => {});
      
      engine.addSubscription(alice123Subscription);
      engine.addSubscription(bob456Subscription);
      engine.addSubscription(generalSubscription);
      
      // Transaction affecting entity 123
      const txData = [
        { e: 123, a: ':user/friends', v: 789, tx: 1001, added: true }
      ];
      const analysis = TransactionAnalyzer.analyze(txData);
      
      const affected = engine.findAffectedSubscriptions(analysis);
      
      // Only Alice's subscription should be affected
      // General subscription looks for :user/name but transaction only affects :user/friends
      assert.strictEqual(affected.length, 1);
      assert.ok(affected.includes(alice123Subscription));
      assert.ok(!affected.includes(generalSubscription)); // Different attribute
      assert.ok(!affected.includes(bob456Subscription)); // Different entity
    });

    it('should batch subscription notifications', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      let notificationCount = 0;
      const notifications = [];
      
      const subscription = new Subscription('batch-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, (results, changes) => {
        notificationCount++;
        notifications.push({ results, changes });
      });
      
      engine.addSubscription(subscription);
      
      // Create multiple transaction analyses (simulating rapid changes)
      const analyses = [
        TransactionAnalyzer.analyze([
          { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true }
        ]),
        TransactionAnalyzer.analyze([
          { e: 2, a: ':user/name', v: 'Bob', tx: 1002, added: true }
        ]),
        TransactionAnalyzer.analyze([
          { e: 3, a: ':user/age', v: 30, tx: 1003, added: true }
        ])
      ];
      
      // Process analyses in batch
      engine.processBatchedChanges(analyses);
      
      // Should have batched notifications efficiently
      assert.ok(notificationCount > 0);
      assert.strictEqual(notifications.length, notificationCount);
    });

    it('should handle subscription notification errors gracefully', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      let goodCallbackCount = 0;
      let errorCallbackCount = 0;
      
      const goodSubscription = new Subscription('good-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => { goodCallbackCount++; });
      
      const errorSubscription = new Subscription('error-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => { 
        errorCallbackCount++;
        throw new Error('Notification error');
      });
      
      engine.addSubscription(goodSubscription);
      engine.addSubscription(errorSubscription);
      
      const analysis = TransactionAnalyzer.analyze([
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true }
      ]);
      
      // Should handle errors without breaking other subscriptions
      assert.doesNotThrow(() => {
        engine.notifyAffectedSubscriptions(analysis);
      });
      
      assert.ok(goodCallbackCount > 0);
      assert.ok(errorCallbackCount > 0);
    });

    it('should optimize subscription matching for performance', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      // Create many subscriptions with different patterns
      const subscriptions = [];
      for (let i = 0; i < 50; i++) {
        const subscription = new Subscription(`perf-sub-${i}`, {
          find: ['?name'],
          where: [['?e', `:user/attr${i}`, '?name']]
        }, () => {});
        
        subscriptions.push(subscription);
        engine.addSubscription(subscription);
      }
      
      // Transaction that only affects a few attributes
      const analysis = TransactionAnalyzer.analyze([
        { e: 1, a: ':user/attr5', v: 'value5', tx: 1001, added: true },
        { e: 1, a: ':user/attr15', v: 'value15', tx: 1001, added: true }
      ]);
      
      const affected = engine.findAffectedSubscriptions(analysis);
      
      // Should only find subscriptions for affected attributes
      assert.strictEqual(affected.length, 2);
      assert.ok(affected.some(sub => sub.id === 'perf-sub-5'));
      assert.ok(affected.some(sub => sub.id === 'perf-sub-15'));
      
      // Should not include unaffected subscriptions
      assert.ok(!affected.some(sub => sub.id === 'perf-sub-10'));
      assert.ok(!affected.some(sub => sub.id === 'perf-sub-20'));
    });

    it('should handle subscription deactivation during propagation', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      let callbackCount = 0;
      const subscription = new Subscription('temp-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => { callbackCount++; });
      
      engine.addSubscription(subscription);
      
      // Deactivate subscription
      subscription.deactivate();
      
      const analysis = TransactionAnalyzer.analyze([
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true }
      ]);
      
      // Should not notify deactivated subscriptions
      engine.notifyAffectedSubscriptions(analysis);
      assert.strictEqual(callbackCount, 0);
      
      // But subscription should still be in registry until cleanup
      assert.strictEqual(engine.getSubscriptionCount(), 1);
      
      // Cleanup should remove it
      const removedCount = engine.cleanupSubscriptions();
      assert.strictEqual(removedCount, 1);
      assert.strictEqual(engine.getSubscriptionCount(), 0);
    });

    it('should provide change diff information to subscriptions', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      let receivedChanges = null;
      const subscription = new Subscription('diff-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, (results, changes) => {
        receivedChanges = changes;
      });
      
      engine.addSubscription(subscription);
      
      const analysis = TransactionAnalyzer.analyze([
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 2, a: ':user/name', v: 'Bob', tx: 1001, added: true },
        { e: 3, a: ':user/name', v: 'Charlie', tx: 1002, added: false }
      ]);
      
      engine.notifyAffectedSubscriptions(analysis);
      
      // Should provide change information
      assert.ok(receivedChanges);
      assert.ok(receivedChanges.addedEntities);
      assert.ok(receivedChanges.retractedEntities);
      assert.ok(receivedChanges.changedAttributes);
    });

    it('should handle empty transaction analysis gracefully', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      let callbackCount = 0;
      const subscription = new Subscription('empty-sub', {}, () => { callbackCount++; });
      
      engine.addSubscription(subscription);
      
      const emptyAnalysis = TransactionAnalyzer.analyze([]);
      
      // Should not throw with empty analysis
      assert.doesNotThrow(() => {
        engine.notifyAffectedSubscriptions(emptyAnalysis);
      });
      
      // Should not trigger any notifications for empty changes
      assert.strictEqual(callbackCount, 0);
    });
  });
});