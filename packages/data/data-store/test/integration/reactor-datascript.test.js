import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ReactiveEngine, TransactionAnalyzer } from '../../src/reactor.js';
import { Subscription } from '../../src/subscription.js';
import { DataStore } from '../../src/store.js';

describe('Transaction Analysis - DataScript Integration', () => {
  describe('Real Transaction Analysis', () => {
    it('should analyze real DataScript transaction reports', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Capture transaction report
      let capturedReport = null;
      store.conn.listen('test-listener', (report) => {
        capturedReport = report;
      });
      
      // Perform transaction
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/active': true
      });
      
      // Should have captured transaction report
      assert.ok(capturedReport);
      assert.ok(capturedReport.txData);
      assert.ok(capturedReport.dbBefore);
      assert.ok(capturedReport.dbAfter);
      
      // Analyze the real transaction
      const analysis = TransactionAnalyzer.analyze(capturedReport.txData);
      
      assert.ok(analysis.changedEntities.has(result.entityId));
      assert.ok(analysis.changedAttributes.has(':user/name'));
      assert.ok(analysis.changedAttributes.has(':user/age'));
      assert.ok(analysis.changedAttributes.has(':user/active'));
      assert.strictEqual(analysis.addedDatoms.length, 3);
      assert.strictEqual(analysis.retractedDatoms.length, 0);
      
      // Cleanup
      store.conn.unlisten('test-listener');
    });

    it('should analyze entity updates with retractions', () => {
      const schema = {
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      // Create initial entity
      const entity = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com',
        ':user/age': 25
      });
      
      // Capture update transaction
      let updateReport = null;
      store.conn.listen('update-listener', (report) => {
        updateReport = report;
      });
      
      // Update entity (will retract old values and add new ones)
      store.conn.transact([
        { ':db/id': entity.entityId, ':user/age': 26, ':user/status': 'active' }
      ]);
      
      assert.ok(updateReport);
      
      const analysis = TransactionAnalyzer.analyze(updateReport.txData);
      
      // Should detect entity change
      assert.ok(analysis.changedEntities.has(entity.entityId));
      
      // Should have both additions and possibly retractions
      assert.ok(analysis.addedDatoms.length > 0);
      
      // Should detect attribute changes
      assert.ok(analysis.changedAttributes.has(':user/age'));
      assert.ok(analysis.changedAttributes.has(':user/status'));
      
      store.conn.unlisten('update-listener');
    });

    it('should analyze relationship changes', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create entities
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      // Capture relationship transaction
      let relationshipReport = null;
      store.conn.listen('rel-listener', (report) => {
        relationshipReport = report;
      });
      
      // Add relationships
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId]
      ]);
      
      assert.ok(relationshipReport);
      
      const analysis = TransactionAnalyzer.analyze(relationshipReport.txData);
      
      // Should detect changes
      assert.ok(analysis.changedEntities.has(alice.entityId));
      assert.ok(analysis.changedAttributes.has(':user/friends'));
      
      // Should track referenced entities
      assert.ok(analysis.referencedEntities.has(bob.entityId));
      assert.ok(analysis.referencedEntities.has(charlie.entityId));
      
      // Should have additions
      assert.strictEqual(analysis.addedDatoms.length, 2);
      assert.strictEqual(analysis.retractedDatoms.length, 0);
      
      store.conn.unlisten('rel-listener');
    });

    it('should analyze complex multi-entity transactions', () => {
      const schema = {
        ':user/manager': { valueType: 'ref' },
        ':user/reports': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create initial entities
      const manager = store.createEntity({ ':user/name': 'Manager' });
      const employee1 = store.createEntity({ ':user/name': 'Employee1' });
      const employee2 = store.createEntity({ ':user/name': 'Employee2' });
      
      // Capture complex transaction
      let complexReport = null;
      store.conn.listen('complex-listener', (report) => {
        complexReport = report;
      });
      
      // Complex transaction affecting multiple entities
      store.conn.transact([
        { ':db/id': employee1.entityId, ':user/manager': manager.entityId, ':user/level': 'junior' },
        { ':db/id': employee2.entityId, ':user/manager': manager.entityId, ':user/level': 'senior' },
        { ':db/id': manager.entityId, ':user/reports': [employee1.entityId, employee2.entityId] }
      ]);
      
      assert.ok(complexReport);
      
      const analysis = TransactionAnalyzer.analyze(complexReport.txData);
      
      // Should detect all affected entities
      assert.ok(analysis.changedEntities.has(manager.entityId));
      assert.ok(analysis.changedEntities.has(employee1.entityId));
      assert.ok(analysis.changedEntities.has(employee2.entityId));
      assert.strictEqual(analysis.changedEntities.size, 3);
      
      // Should detect all changed attributes
      assert.ok(analysis.changedAttributes.has(':user/manager'));
      assert.ok(analysis.changedAttributes.has(':user/level'));
      assert.ok(analysis.changedAttributes.has(':user/reports'));
      
      // Should track all referenced entities
      assert.ok(analysis.referencedEntities.has(manager.entityId));
      assert.ok(analysis.referencedEntities.has(employee1.entityId));
      assert.ok(analysis.referencedEntities.has(employee2.entityId));
      
      store.conn.unlisten('complex-listener');
    });

    it('should handle entity deletion analysis', () => {
      const store = new DataStore();
      
      // Create entity
      const entity = store.createEntity({
        ':user/name': 'ToDelete',
        ':user/age': 30,
        ':user/active': true
      });
      
      // Capture deletion transaction
      let deleteReport = null;
      store.conn.listen('delete-listener', (report) => {
        deleteReport = report;
      });
      
      // Delete entity using retraction
      store.conn.transact([
        ['-', entity.entityId, ':user/name', 'ToDelete'],
        ['-', entity.entityId, ':user/age', 30],
        ['-', entity.entityId, ':user/active', true]
      ]);
      
      assert.ok(deleteReport);
      
      const analysis = TransactionAnalyzer.analyze(deleteReport.txData);
      
      // Should detect entity changes (all retractions)
      assert.ok(analysis.changedEntities.has(entity.entityId));
      assert.strictEqual(analysis.addedDatoms.length, 0);
      assert.strictEqual(analysis.retractedDatoms.length, 3);
      
      // Should detect all retracted attributes
      assert.ok(analysis.changedAttributes.has(':user/name'));
      assert.ok(analysis.changedAttributes.has(':user/age'));
      assert.ok(analysis.changedAttributes.has(':user/active'));
      
      store.conn.unlisten('delete-listener');
    });

    it('should handle batch operations with multiple transaction types', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create initial entities
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      // Capture batch transaction
      let batchReport = null;
      store.conn.listen('batch-listener', (report) => {
        batchReport = report;
      });
      
      // Batch operation: creates, updates, and relationship changes
      store.conn.transact([
        // Create new entity
        { ':db/id': -1, ':user/name': 'Diana', ':user/age': 28 },
        // Update existing entity
        { ':db/id': alice.entityId, ':user/age': 30, ':user/status': 'updated' },
        // Add relationships
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId],
        // Remove a relationship (if existed)
        ['+', bob.entityId, ':user/friends', alice.entityId]
      ]);
      
      assert.ok(batchReport);
      
      const analysis = TransactionAnalyzer.analyze(batchReport.txData);
      
      // Should detect all entity changes
      assert.ok(analysis.changedEntities.has(alice.entityId));
      assert.ok(analysis.changedEntities.has(bob.entityId));
      
      // Should detect new entity (tempid resolved)
      const newEntityId = batchReport.tempids.get(-1);
      assert.ok(newEntityId);
      assert.ok(analysis.changedEntities.has(newEntityId));
      
      // Should detect various attribute changes
      assert.ok(analysis.changedAttributes.has(':user/name'));
      assert.ok(analysis.changedAttributes.has(':user/age'));
      assert.ok(analysis.changedAttributes.has(':user/status'));
      assert.ok(analysis.changedAttributes.has(':user/friends'));
      
      store.conn.unlisten('batch-listener');
    });
  });

  describe('ReactiveEngine Integration', () => {
    it('should integrate with DataStore transaction listener', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      // Engine should be able to listen to store transactions
      engine.startListening();
      
      // Perform transaction
      const entity = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30
      });
      
      // Engine should have processed the transaction
      const lastAnalysis = engine.getLastAnalysis();
      assert.ok(lastAnalysis);
      assert.ok(lastAnalysis.changedEntities.has(entity.entityId));
      
      engine.stopListening();
    });

    it('should handle multiple concurrent transactions', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      const analyses = [];
      engine.onTransactionAnalysis = (analysis) => {
        analyses.push(analysis);
      };
      
      engine.startListening();
      
      // Multiple transactions
      const entity1 = store.createEntity({ ':user/name': 'Alice' });
      const entity2 = store.createEntity({ ':user/name': 'Bob' });
      const entity3 = store.createEntity({ ':user/name': 'Charlie' });
      
      // Should have captured multiple analyses
      assert.strictEqual(analyses.length, 3);
      
      // Each analysis should have different changed entities
      assert.ok(analyses[0].changedEntities.has(entity1.entityId));
      assert.ok(analyses[1].changedEntities.has(entity2.entityId));
      assert.ok(analyses[2].changedEntities.has(entity3.entityId));
      
      engine.stopListening();
    });
  });

  describe('End-to-End Change Propagation', () => {
    it('should identify subscriptions affected by real DataScript transactions', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      const engine = new ReactiveEngine(store);
      
      // Create subscription for user names
      const subscription = new Subscription('e2e-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => {});
      
      engine.addSubscription(subscription);
      
      // Capture actual transaction
      let realAnalysis = null;
      engine.onTransactionAnalysis = (analysis) => {
        realAnalysis = analysis;
      };
      
      engine.startListening();
      
      // Create entity
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30
      });
      
      engine.stopListening();
      
      // Should have captured and analyzed the transaction
      assert.ok(realAnalysis);
      assert.ok(realAnalysis.changedEntities.has(alice.entityId));
      assert.ok(realAnalysis.changedAttributes.has(':user/name'));
      
      // Should identify subscription as affected
      const affected = engine.findAffectedSubscriptions(realAnalysis);
      assert.strictEqual(affected.length, 1);
      assert.strictEqual(affected[0], subscription);
    });

    it('should handle multiple subscriptions with overlapping queries', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      // Overlapping subscriptions
      const sub1 = new Subscription('overlap-1', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => {});
      
      const sub2 = new Subscription('overlap-2', {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age']
        ]
      }, () => {});
      
      const sub3 = new Subscription('overlap-3', {
        find: ['?email'],
        where: [['?e', ':user/email', '?email']]
      }, () => {});
      
      engine.addSubscription(sub1);
      engine.addSubscription(sub2);
      engine.addSubscription(sub3);
      
      // Simulate transaction affecting :user/name and :user/age
      const analysis = TransactionAnalyzer.analyze([
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 1, a: ':user/age', v: 30, tx: 1001, added: true }
      ]);
      
      const affected = engine.findAffectedSubscriptions(analysis);
      
      // sub1 and sub2 should be affected (both involve :user/name or :user/age)
      // sub3 should not be affected (:user/email not changed)
      assert.strictEqual(affected.length, 2);
      assert.ok(affected.includes(sub1));
      assert.ok(affected.includes(sub2));
      assert.ok(!affected.includes(sub3));
    });

    it('should handle entity-rooted subscription propagation', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      const engine = new ReactiveEngine(store);
      
      // Create entities
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      // Entity-rooted subscriptions
      const aliceSub = new Subscription('alice-friends', {
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, () => {}, alice.entityId);
      
      const bobSub = new Subscription('bob-friends', {
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, () => {}, bob.entityId);
      
      engine.addSubscription(aliceSub);
      engine.addSubscription(bobSub);
      
      // Simulate transaction affecting Alice's friends
      const analysis = TransactionAnalyzer.analyze([
        { e: alice.entityId, a: ':user/friends', v: charlie.entityId, tx: 1001, added: true }
      ]);
      
      const affected = engine.findAffectedSubscriptions(analysis);
      
      // Only Alice's subscription should be affected
      assert.strictEqual(affected.length, 1);
      assert.strictEqual(affected[0], aliceSub);
      assert.ok(!affected.includes(bobSub)); // Different entity
    });

    it('should handle subscription cleanup during change propagation', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      const activeSub = new Subscription('active-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => {});
      
      const inactiveSub = new Subscription('inactive-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => {});
      
      engine.addSubscription(activeSub);
      engine.addSubscription(inactiveSub);
      
      // Deactivate one subscription
      inactiveSub.deactivate();
      
      const analysis = TransactionAnalyzer.analyze([
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true }
      ]);
      
      // Find affected subscriptions
      const affected = engine.findAffectedSubscriptions(analysis);
      
      // Only active subscription should be in affected list
      assert.strictEqual(affected.length, 1);
      assert.strictEqual(affected[0], activeSub);
      assert.ok(!affected.includes(inactiveSub)); // Deactivated, so filtered out
    });

    it('should handle complex multi-attribute changes', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      const engine = new ReactiveEngine(store);
      
      const complexSubscription = new Subscription('complex-sub', {
        find: ['?name', '?profile'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/profile', '?profile']
        ]
      }, () => {});
      
      engine.addSubscription(complexSubscription);
      
      // Simulate complex transaction with multiple attributes
      const analysis = TransactionAnalyzer.analyze([
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true },
        { e: 1, a: ':user/profile', v: 10, tx: 1001, added: true },
        { e: 1, a: ':user/active', v: true, tx: 1001, added: true }
      ]);
      
      const affected = engine.findAffectedSubscriptions(analysis);
      
      // Complex subscription should be affected (queries both :user/name and :user/profile)
      assert.strictEqual(affected.length, 1);
      assert.strictEqual(affected[0], complexSubscription);
    });

    it('should handle subscription state consistency', () => {
      const store = new DataStore();
      const engine = new ReactiveEngine(store);
      
      const persistentSub = new Subscription('persistent-sub', {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      }, () => {});
      
      engine.addSubscription(persistentSub);
      
      // Multiple analyses
      const analysis1 = TransactionAnalyzer.analyze([
        { e: 1, a: ':user/name', v: 'Alice', tx: 1001, added: true }
      ]);
      
      const analysis2 = TransactionAnalyzer.analyze([
        { e: 2, a: ':user/name', v: 'Bob', tx: 1002, added: true }
      ]);
      
      // Should consistently find the subscription as affected
      const affected1 = engine.findAffectedSubscriptions(analysis1);
      const affected2 = engine.findAffectedSubscriptions(analysis2);
      
      assert.strictEqual(affected1.length, 1);
      assert.strictEqual(affected2.length, 1);
      assert.strictEqual(affected1[0], persistentSub);
      assert.strictEqual(affected2[0], persistentSub);
      
      // Subscription should remain active
      assert.ok(persistentSub.isActive());
      assert.strictEqual(engine.getSubscriptionCount(), 1);
    });
  });
});