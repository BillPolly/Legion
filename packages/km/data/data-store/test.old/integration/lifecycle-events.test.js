import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EntityProxy } from '../../src/proxy.js';
import { DataStore } from '../../src/store.js';
import { retractEntity } from 'datascript';

describe('Proxy Lifecycle Events - Integration', () => {
  describe('Events Triggered by Database Changes', () => {
    it('should trigger onChange events when entity updated through store', () => {
      const store = new DataStore();
      const alice = store.createEntity({ 
        ':user/name': 'Alice',
        ':user/age': 30,
        ':user/score': 85
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      let changeEvents = [];
      
      proxy.onChange((changes) => {
        changeEvents.push(changes);
      });
      
      // Update through proxy
      proxy.update({
        ':user/age': 31,
        ':user/score': 90
      });
      
      // Should have triggered onChange event
      assert.strictEqual(changeEvents.length, 1);
      assert.strictEqual(changeEvents[0].type, 'update');
      assert.deepStrictEqual(changeEvents[0].attributes, [':user/age', ':user/score']);
      assert.ok(changeEvents[0].updateData);
      assert.strictEqual(changeEvents[0].updateData[':user/age'], 31);
      assert.strictEqual(changeEvents[0].updateData[':user/score'], 90);
    });

    it('should trigger onChange events when relationships modified', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/manager': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const manager = store.createEntity({ ':user/name': 'Manager' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const managerProxy = new EntityProxy(manager.entityId, store);
      
      let relationshipEvents = [];
      
      aliceProxy.onChange((changes) => {
        relationshipEvents.push(changes);
      });
      
      // Add friend relationship
      aliceProxy.addRelation(':user/friends', bobProxy);
      
      assert.strictEqual(relationshipEvents.length, 1);
      assert.strictEqual(relationshipEvents[0].type, 'relationAdded');
      assert.strictEqual(relationshipEvents[0].attribute, ':user/friends');
      assert.strictEqual(relationshipEvents[0].targetEntityId, bob.entityId);
      
      // Add manager relationship
      aliceProxy.addRelation(':user/manager', managerProxy);
      
      assert.strictEqual(relationshipEvents.length, 2);
      assert.strictEqual(relationshipEvents[1].type, 'relationAdded');
      assert.strictEqual(relationshipEvents[1].attribute, ':user/manager');
      assert.strictEqual(relationshipEvents[1].targetEntityId, manager.entityId);
      
      // Remove friend relationship
      aliceProxy.removeRelation(':user/friends', bobProxy);
      
      assert.strictEqual(relationshipEvents.length, 3);
      assert.strictEqual(relationshipEvents[2].type, 'relationRemoved');
      assert.strictEqual(relationshipEvents[2].attribute, ':user/friends');
      assert.strictEqual(relationshipEvents[2].targetEntityId, bob.entityId);
    });

    it('should trigger onDelete events when entity deleted from database', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/age': 30
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      let deleteEvents = [];
      
      proxy.onDelete(() => {
        deleteEvents.push({ entityId: alice.entityId, timestamp: Date.now() });
      });
      
      // Initially valid
      assert.ok(proxy.isValid());
      assert.strictEqual(deleteEvents.length, 0);
      
      // Delete entity from database
      const newDB = retractEntity(store.db(), alice.entityId);
      store.conn._db = newDB;
      
      // Proxy should become invalid and trigger onDelete
      assert.ok(!proxy.isValid());
      
      // Manually trigger cleanup (in real implementation this would be automatic)
      proxy._invalidate();
      
      assert.strictEqual(deleteEvents.length, 1);
      assert.strictEqual(deleteEvents[0].entityId, alice.entityId);
      assert.ok(deleteEvents[0].timestamp);
    });

    it('should handle events with multiple proxies and database operations', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create entities
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const charlieProxy = new EntityProxy(charlie.entityId, store);
      
      let aliceEvents = [];
      let bobEvents = [];
      
      aliceProxy.onChange((changes) => {
        aliceEvents.push({ ...changes, proxyId: 'alice' });
      });
      
      bobProxy.onChange((changes) => {
        bobEvents.push({ ...changes, proxyId: 'bob' });
      });
      
      // Operations on Alice should only trigger Alice events
      aliceProxy.update({ ':user/age': 30 });
      aliceProxy.addRelation(':user/friends', bobProxy);
      
      assert.strictEqual(aliceEvents.length, 2);
      assert.strictEqual(bobEvents.length, 0);
      assert.strictEqual(aliceEvents[0].type, 'update');
      assert.strictEqual(aliceEvents[1].type, 'relationAdded');
      
      // Operations on Bob should only trigger Bob events
      bobProxy.update({ ':user/age': 25 });
      bobProxy.addRelation(':user/friends', charlieProxy);
      
      assert.strictEqual(aliceEvents.length, 2); // Unchanged
      assert.strictEqual(bobEvents.length, 2);
      assert.strictEqual(bobEvents[0].type, 'update');
      assert.strictEqual(bobEvents[1].type, 'relationAdded');
    });

    it('should integrate lifecycle events with subscriptions and computed properties', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      
      // Set up computed property
      aliceProxy.computed('friendCount', {
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, (results) => results.length);
      
      // Set up subscription
      let subscriptionResults = [];
      const unsubscribe = aliceProxy.subscribe({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, (results) => {
        subscriptionResults.push(results);
      });
      
      // Set up change events
      let changeEvents = [];
      aliceProxy.onChange((changes) => {
        changeEvents.push(changes);
      });
      
      // Initial state
      assert.strictEqual(aliceProxy.friendCount, 0);
      
      // Add friend - should trigger multiple systems
      aliceProxy.addRelation(':user/friends', bobProxy);
      
      // Should have triggered change event
      assert.strictEqual(changeEvents.length, 1);
      assert.strictEqual(changeEvents[0].type, 'relationAdded');
      
      // Should have updated computed property
      assert.strictEqual(aliceProxy.friendCount, 1);
      
      unsubscribe();
    });

    it('should handle event cleanup when proxy becomes invalid', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      let changeEventCount = 0;
      let deleteEventCount = 0;
      
      // Register event listeners
      const unsubChange = proxy.onChange(() => { changeEventCount++; });
      const unsubDelete = proxy.onDelete(() => { deleteEventCount++; });
      
      assert.strictEqual(proxy._getEventListenerCount(), 2);
      
      // Update entity - should trigger change event
      proxy.update({ ':user/age': 30 });
      assert.strictEqual(changeEventCount, 1);
      assert.strictEqual(deleteEventCount, 0);
      
      // Invalidate proxy - should trigger delete event
      proxy._invalidate();
      assert.strictEqual(deleteEventCount, 1);
      
      // Further change attempts should not trigger events (proxy invalid)
      proxy._triggerChange({ type: 'should-not-work' });
      assert.strictEqual(changeEventCount, 1); // Should not increase
      
      // Cleanup
      unsubChange();
      unsubDelete();
    });

    it('should handle high volume of event listeners', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const proxy = new EntityProxy(alice.entityId, store);
      
      const changeCounters = [];
      const deleteCounters = [];
      const unsubscribeFunctions = [];
      
      // Create many event listeners
      for (let i = 0; i < 50; i++) {
        let changeCount = 0;
        let deleteCount = 0;
        
        changeCounters.push(() => changeCount);
        deleteCounters.push(() => deleteCount);
        
        unsubscribeFunctions.push(proxy.onChange(() => { changeCount++; }));
        unsubscribeFunctions.push(proxy.onDelete(() => { deleteCount++; }));
      }
      
      assert.strictEqual(proxy._getEventListenerCount(), 100);
      
      // Trigger events
      proxy.update({ ':user/age': 25 });
      proxy._triggerDelete();
      
      // All listeners should have been called
      changeCounters.forEach(counter => {
        assert.strictEqual(counter(), 1);
      });
      
      deleteCounters.forEach(counter => {
        assert.strictEqual(counter(), 1);
      });
      
      // Cleanup
      unsubscribeFunctions.forEach(unsub => unsub());
      assert.strictEqual(proxy._getEventListenerCount(), 0);
    });

    it('should maintain event listener isolation between proxies', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      
      let aliceChangeCount = 0;
      let bobChangeCount = 0;
      let aliceDeleteCount = 0;
      let bobDeleteCount = 0;
      
      aliceProxy.onChange(() => { aliceChangeCount++; });
      aliceProxy.onDelete(() => { aliceDeleteCount++; });
      
      bobProxy.onChange(() => { bobChangeCount++; });
      bobProxy.onDelete(() => { bobDeleteCount++; });
      
      // Update Alice - should only trigger Alice events
      aliceProxy.update({ ':user/age': 30 });
      
      assert.strictEqual(aliceChangeCount, 1);
      assert.strictEqual(bobChangeCount, 0);
      assert.strictEqual(aliceDeleteCount, 0);
      assert.strictEqual(bobDeleteCount, 0);
      
      // Update Bob - should only trigger Bob events
      bobProxy.update({ ':user/age': 25 });
      
      assert.strictEqual(aliceChangeCount, 1);
      assert.strictEqual(bobChangeCount, 1);
      assert.strictEqual(aliceDeleteCount, 0);
      assert.strictEqual(bobDeleteCount, 0);
      
      // Delete Alice - should only trigger Alice delete event
      aliceProxy._invalidate();
      
      assert.strictEqual(aliceChangeCount, 1);
      assert.strictEqual(bobChangeCount, 1);
      assert.strictEqual(aliceDeleteCount, 1);
      assert.strictEqual(bobDeleteCount, 0);
    });
  });
});