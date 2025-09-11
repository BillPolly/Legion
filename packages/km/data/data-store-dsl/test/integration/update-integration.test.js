import { describe, it } from 'node:test';
import assert from 'node:assert';
import { update } from '../../src/update-dsl.js';
import { defineSchema } from '../../src/schema-dsl.js';
import { createDataStore, EntityProxy } from '@legion/data-store';

describe('Update DSL Integration - Real Data-Store Operations', () => {
  describe('Update Execution with Real Database', () => {
    it('should execute DSL updates against real data-store', () => {
      const schema = defineSchema`
        user/name: string
        user/email: string
        user/age: number
        user/active: boolean
      `;
      
      const store = createDataStore({ schema });
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Test DSL update execution
      const dslUpdate = update`
        user/email = "alice@example.com"
        user/age = 30
        user/active = true
      `;
      
      // Should be compatible with EntityProxy.update method
      const updateResult = aliceProxy.update(dslUpdate);
      
      assert.ok(updateResult.entityId);
      assert.ok(updateResult.dbAfter);
      
      // Verify changes took effect
      assert.strictEqual(aliceProxy.get(':user/email'), 'alice@example.com');
      assert.strictEqual(aliceProxy.get(':user/age'), 30);
      assert.strictEqual(aliceProxy.get(':user/active'), true);
    });

    it('should handle DSL updates with expressions', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/score': 80 });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      const currentScore = aliceProxy.get(':user/score');
      const bonus = 15;
      const newRank = 'senior';
      
      const dslUpdate = update`
        user/score = ${currentScore + bonus}
        user/rank = ${newRank}
        user/lastUpdate = ${new Date()}
      `;
      
      aliceProxy.update(dslUpdate);
      
      assert.strictEqual(aliceProxy.get(':user/score'), 95);
      assert.strictEqual(aliceProxy.get(':user/rank'), 'senior');
      assert.ok(aliceProxy.get(':user/lastUpdate'));
    });

    it('should handle relationship operations with real entities', () => {
      const schema = defineSchema`
        user/name: string
        user/friends: many ref -> user
        user/manager: ref -> user
      `;
      
      const store = createDataStore({ schema });
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      const manager = store.createEntity({ ':user/name': 'Manager' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Initial friends setup
      aliceProxy.addRelation(':user/friends', bob.entityId);
      
      // Test relationship DSL operations
      const relationshipUpdate = update`
        user/name = "Alice Smith"
        +user/friends = ${charlie.entityId}
        user/manager = ${manager.entityId}
      `;
      
      // Apply update with relationships
      if (relationshipUpdate.updateData) {
        aliceProxy.update(relationshipUpdate.updateData);
      }
      
      if (relationshipUpdate.relationships) {
        relationshipUpdate.relationships.forEach(relation => {
          const [op, , attr, value] = relation;
          if (op === '+') {
            aliceProxy.addRelation(attr, value);
          } else if (op === '-') {
            aliceProxy.removeRelation(attr, value);
          }
        });
      }
      
      // Verify results
      assert.strictEqual(aliceProxy.get(':user/name'), 'Alice Smith');
      
      const friends = aliceProxy.get(':user/friends');
      assert.ok(Array.isArray(friends));
      assert.ok(friends.length >= 2); // Bob + Charlie
      
      const managerProxy = aliceProxy.get(':user/manager');
      assert.ok(managerProxy instanceof EntityProxy);
      assert.strictEqual(managerProxy.get(':user/name'), 'Manager');
    });

    it('should handle complex data types in DSL updates', () => {
      const schema = defineSchema`
        user/name: string
        user/tags: many string
        user/metadata: string
        user/scores: many number
      `;
      
      const store = createDataStore({ schema });
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      const tags = ['developer', 'javascript', 'react'];
      const metadata = JSON.stringify({ theme: 'dark', notifications: true });
      const scores = [85, 90, 88];
      
      const complexUpdate = update`
        user/tags = ${tags}
        user/metadata = ${metadata}
        user/scores = ${scores}
      `;
      
      aliceProxy.update(complexUpdate);
      
      // Verify complex data handling
      const retrievedTags = aliceProxy.get(':user/tags');
      const retrievedMetadata = aliceProxy.get(':user/metadata');
      const retrievedScores = aliceProxy.get(':user/scores');
      
      assert.deepStrictEqual(retrievedTags, tags);
      assert.strictEqual(retrievedMetadata, metadata);
      assert.deepStrictEqual(retrievedScores, scores);
    });

    it('should handle update DSL parsing errors with data-store context', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Invalid update structures should be caught
      const invalidUpdates = [
        () => update`user/name =`, // Missing value
        () => update`= "Alice"`, // Missing attribute
        () => update`user/name "Alice"`, // Missing operator
      ];
      
      invalidUpdates.forEach(updateFn => {
        assert.throws(() => {
          updateFn();
        }, Error);
      });
    });

    it('should maintain update performance with DSL parsing', () => {
      const store = createDataStore();
      
      // Create test entity
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/score': 0 });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      const startTime = Date.now();
      
      // Perform multiple DSL updates
      for (let i = 0; i < 10; i++) {
        const dslUpdate = update`
          user/score = ${i * 10}
          user/lastUpdate = ${Date.now()}
        `;
        
        aliceProxy.update(dslUpdate);
      }
      
      const updateTime = Date.now() - startTime;
      console.log(`10 DSL updates executed in ${updateTime}ms`);
      
      // Verify final state
      assert.strictEqual(aliceProxy.get(':user/score'), 90);
      assert.ok(aliceProxy.get(':user/lastUpdate'));
      
      // Should be reasonably fast
      assert.ok(updateTime < 1000);
    });

    it('should integrate with data-store reactive system', () => {
      const schema = defineSchema`
        user/name: string
        user/score: number
        user/friends: many ref -> user
      `;
      
      const store = createDataStore({ schema });
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Set up computed property
      aliceProxy.computed('scoreLevel', {
        find: ['?score'],
        where: [['?this', ':user/score', '?score']]
      }, (results) => {
        const score = results.length > 0 ? results[0][0] : 0;
        return score >= 90 ? 'expert' : score >= 70 ? 'intermediate' : 'beginner';
      });
      
      // Set up change listener
      let changeEvents = [];
      aliceProxy.onChange((changes) => {
        changeEvents.push(changes);
      });
      
      // Perform DSL update
      const dslUpdate = update`
        user/score = 95
        user/rank = "senior"
      `;
      
      aliceProxy.update(dslUpdate);
      
      // Verify reactive system triggered
      assert.strictEqual(aliceProxy.scoreLevel, 'expert');
      assert.strictEqual(changeEvents.length, 1);
      assert.strictEqual(changeEvents[0].type, 'update');
    });

    it('should handle batch updates with DSL syntax', () => {
      const store = createDataStore();
      
      // Create multiple entities
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < 5; i++) {
        const entity = store.createEntity({ ':user/name': `User${i}` });
        entities.push(entity);
        proxies.push(new EntityProxy(entity.entityId, store));
      }
      
      // Batch update using DSL
      const timestamp = new Date();
      
      proxies.forEach((proxy, index) => {
        const dslUpdate = update`
          user/index = ${index}
          user/score = ${index * 20}
          user/lastUpdate = ${timestamp}
          user/active = true
        `;
        
        proxy.update(dslUpdate);
      });
      
      // Verify all updates worked
      proxies.forEach((proxy, index) => {
        assert.strictEqual(proxy.get(':user/index'), index);
        assert.strictEqual(proxy.get(':user/score'), index * 20);
        assert.strictEqual(proxy.get(':user/lastUpdate'), timestamp);
        assert.strictEqual(proxy.get(':user/active'), true);
      });
    });
  });
});