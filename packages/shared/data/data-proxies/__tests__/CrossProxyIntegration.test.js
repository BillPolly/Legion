/**
 * Cross-Proxy Integration Tests
 * Testing interactions between EntityProxy, CollectionProxy, and StreamProxy
 */

import { EntityProxy } from '../src/EntityProxy.js';
import { CollectionProxy } from '../src/CollectionProxy.js';
import { StreamProxy } from '../src/StreamProxy.js';
import { Handle } from '@legion/handle';
import { DataStoreResourceManager } from '../src/DataStoreResourceManager.js';
import { createTestStore, createSampleData } from './setup.js';

describe('Cross-Proxy Integration', () => {
  let store;
  let resourceManager;
  let sampleData;
  
  beforeEach(() => {
    store = createTestStore();
    resourceManager = new DataStoreResourceManager(store);
    sampleData = createSampleData(store);
  });
  
  describe('Entity-Collection Integration', () => {
    test('should allow accessing individual entities through CollectionProxy', () => {
      // Create collection of all users
      const userCollection = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      // Get individual entity proxy from collection
      const aliceProxy = userCollection.get(sampleData.users.alice);
      
      expect(aliceProxy).toBeInstanceOf(EntityProxy);
      expect(aliceProxy.entityId).toBe(sampleData.users.alice);
      
      // Should access Alice's data through EntityProxy
      const aliceName = aliceProxy.get(':user/name');
      expect(aliceName).toBe('Alice');
      
      // Cleanup
      userCollection.destroy();
      aliceProxy.destroy();
    });
    
    test('should reflect entity updates across different proxy types', () => {
      // Create EntityProxy for Bob
      const bobEntity = new EntityProxy(resourceManager, sampleData.users.bob);
      
      // Create CollectionProxy for active users (Bob is initially active)
      const activeUsers = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      });
      
      // Initial state: Bob should be in active users collection
      expect(activeUsers.length).toBe(2); // Alice and Bob
      const bobData = bobEntity.value();
      expect(bobData[':user/active']).toBe(true);
      
      // Update Bob's active status through EntityProxy
      bobEntity.set(':user/active', false);
      
      // Collection should reflect the change
      expect(activeUsers.length).toBe(1); // Only Alice now
      
      // EntityProxy should reflect the change
      const updatedBobData = bobEntity.value();
      expect(updatedBobData[':user/active']).toBe(false);
      
      // Cleanup
      bobEntity.destroy();
      activeUsers.destroy();
    });
    
    test('should maintain consistency across bulk operations', () => {
      // Create collection of active users
      const activeUsers = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      });
      
      // Get entity proxies for individual users
      const aliceEntity = activeUsers.get(sampleData.users.alice);
      const bobEntity = activeUsers.get(sampleData.users.bob);
      
      // Initial state: both active
      expect(aliceEntity.get(':user/active')).toBe(true);
      expect(bobEntity.get(':user/active')).toBe(true);
      expect(activeUsers.length).toBe(2);
      
      // Perform bulk update through collection
      activeUsers.updateAll({ ':user/status': 'online' });
      
      // Entity proxies should reflect the bulk update
      expect(aliceEntity.get(':user/status')).toBe('online');
      expect(bobEntity.get(':user/status')).toBe('online');
      
      // Collection should still have same entities
      expect(activeUsers.length).toBe(2);
      
      // Cleanup
      activeUsers.destroy();
      // Entity proxies are automatically cleaned up by collection
    });
  });
  
  describe('Collection-Stream Integration', () => {
    test('should provide complementary views of the same data', () => {
      // Create collection for all users (static view)
      const userCollection = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      // Create stream for user names (query result stream)
      const nameStream = new StreamProxy(resourceManager, {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      });
      
      // Both should see the same data
      const collectionEntities = userCollection.value();
      const streamResults = nameStream.value();
      
      expect(collectionEntities.length).toBe(3);
      expect(streamResults.length).toBe(3);
      
      // Stream results should include names that exist in collection entities
      const collectionNames = collectionEntities.map(e => e[':user/name']);
      const streamNames = streamResults.map(r => r[1]);
      
      expect(streamNames).toEqual(expect.arrayContaining(collectionNames));
      
      // Cleanup
      userCollection.destroy();
      nameStream.destroy();
    });
    
    test('should both reflect data changes consistently', () => {
      // Create collection for users with age data
      const ageCollection = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/age', '?age']],
        entityKey: '?e'
      });
      
      // Create stream for age query results
      const ageStream = new StreamProxy(resourceManager, {
        find: ['?e', '?age'],
        where: [['?e', ':user/age', '?age']]
      });
      
      // Initial state
      const initialCollection = ageCollection.value();
      const initialStream = ageStream.value();
      
      expect(initialCollection.length).toBe(3);
      expect(initialStream.length).toBe(3);
      
      // Add new user with age through store
      const newUserResult = store.createEntity({
        ':user/name': 'Dave',
        ':user/age': 40,
        ':user/active': true
      });
      const newUserId = newUserResult.entityId;
      
      // Both collection and stream should see the new user
      const updatedCollection = ageCollection.value();
      const updatedStream = ageStream.value();
      
      expect(updatedCollection.length).toBe(4);
      expect(updatedStream.length).toBe(4);
      
      // Find the new user in both
      const newUserInCollection = updatedCollection.find(e => e[':db/id'] === newUserId);
      const newUserInStream = updatedStream.find(r => r[0] === newUserId);
      
      expect(newUserInCollection).toBeTruthy();
      expect(newUserInStream).toBeTruthy();
      expect(newUserInCollection[':user/name']).toBe('Dave');
      expect(newUserInStream[1]).toBe(40); // Age in stream result
      
      // Cleanup
      ageCollection.destroy();
      ageStream.destroy();
    });
  });
  
  describe('Entity-Stream Integration', () => {
    test('should provide different perspectives on entity data', () => {
      // Create EntityProxy for Alice
      const aliceEntity = new EntityProxy(resourceManager, sampleData.users.alice);
      
      // Create StreamProxy for Alice's attributes
      const aliceAttributeStream = new StreamProxy(resourceManager, {
        find: ['?attr', '?value'],
        where: [[sampleData.users.alice, '?attr', '?value']]
      });
      
      // EntityProxy gives object view
      const entityView = aliceEntity.value();
      expect(typeof entityView).toBe('object');
      expect(entityView[':user/name']).toBe('Alice');
      
      // StreamProxy gives tuple array view
      const streamView = aliceAttributeStream.value();
      expect(Array.isArray(streamView)).toBe(true);
      expect(streamView.length).toBeGreaterThan(0);
      
      // Should contain the same data in different formats
      const nameFromStream = streamView.find(tuple => tuple[0] === ':user/name');
      expect(nameFromStream[1]).toBe('Alice');
      
      // Both should reflect updates
      aliceEntity.set(':user/nickname', 'Al');
      
      const updatedEntityView = aliceEntity.value();
      const updatedStreamView = aliceAttributeStream.value();
      
      expect(updatedEntityView[':user/nickname']).toBe('Al');
      
      const nicknameFromStream = updatedStreamView.find(tuple => tuple[0] === ':user/nickname');
      expect(nicknameFromStream[1]).toBe('Al');
      
      // Cleanup
      aliceEntity.destroy();
      aliceAttributeStream.destroy();
    });
  });
  
  describe('Three-Way Integration', () => {
    test('should demonstrate complete proxy ecosystem working together', () => {
      // Create EntityProxy for specific user management
      const aliceEntity = new EntityProxy(resourceManager, sampleData.users.alice);
      
      // Create CollectionProxy for bulk operations and iteration
      const activeUsers = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      });
      
      // Create StreamProxy for monitoring specific query results
      const userAgeStream = new StreamProxy(resourceManager, {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age'],
          ['?e', ':user/active', true]
        ]
      });
      
      // Initial state verification across all proxies
      expect(aliceEntity.get(':user/active')).toBe(true);
      expect(activeUsers.length).toBe(2); // Alice and Bob
      expect(userAgeStream.value().length).toBe(2); // Alice and Bob ages
      
      // Make change through EntityProxy
      aliceEntity.set(':user/age', 31);
      
      // Verify change propagates to all proxy types
      expect(aliceEntity.get(':user/age')).toBe(31);
      
      // CollectionProxy should still see Alice (she's still active)
      expect(activeUsers.length).toBe(2);
      const aliceInCollection = activeUsers.find(e => e[':db/id'] === sampleData.users.alice);
      expect(aliceInCollection[':user/age']).toBe(31);
      
      // StreamProxy should see the updated age
      const streamResults = userAgeStream.value();
      const aliceInStream = streamResults.find(r => r[0] === 'Alice');
      expect(aliceInStream[1]).toBe(31);
      
      // Make bulk change through CollectionProxy
      activeUsers.updateAll({ ':user/department': 'Engineering' });
      
      // EntityProxy should see the bulk update
      expect(aliceEntity.get(':user/department')).toBe('Engineering');
      
      // StreamProxy with additional query should see departments
      const deptStream = new StreamProxy(resourceManager, {
        find: ['?name', '?dept'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/department', '?dept'],
          ['?e', ':user/active', true]
        ]
      });
      
      const deptResults = deptStream.value();
      expect(deptResults.length).toBe(2); // Alice and Bob
      expect(deptResults.every(r => r[1] === 'Engineering')).toBe(true);
      
      // Cleanup all proxies
      aliceEntity.destroy();
      activeUsers.destroy();
      userAgeStream.destroy();
      deptStream.destroy();
    });
  });
  
  describe('Error Handling Across Proxies', () => {
    test('should maintain error handling consistency', () => {
      const entityProxy = new EntityProxy(resourceManager, sampleData.users.alice);
      const collectionProxy = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      const streamProxy = new StreamProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      });
      
      // All should be Handle instances
      expect(entityProxy).toBeInstanceOf(Handle);
      expect(collectionProxy).toBeInstanceOf(Handle);
      expect(streamProxy).toBeInstanceOf(Handle);
      
      // Destroy all
      entityProxy.destroy();
      collectionProxy.destroy();
      streamProxy.destroy();
      
      // All should consistently fail after destruction
      expect(() => entityProxy.value()).toThrow('Handle has been destroyed');
      expect(() => collectionProxy.value()).toThrow('Handle has been destroyed');
      expect(() => streamProxy.value()).toThrow('Handle has been destroyed');
    });
    
    test('should handle cascading destruction properly', () => {
      // Create collection with cached entity proxies
      const collection = new CollectionProxy(resourceManager, {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']],
        entityKey: '?e'
      });
      
      // Get some entity proxies (creates cache)
      const aliceProxy = collection.get(sampleData.users.alice);
      const bobProxy = collection.get(sampleData.users.bob);
      
      expect(collection._entityProxies.size).toBe(2);
      
      // Destroy collection - should cleanup entity proxies
      collection.destroy();
      
      expect(collection._entityProxies.size).toBe(0);
      expect(collection.isDestroyed()).toBe(true);
      
      // Entity proxies should also be destroyed
      if (typeof aliceProxy.isDestroyed === 'function') {
        expect(aliceProxy.isDestroyed()).toBe(true);
      }
      if (typeof bobProxy.isDestroyed === 'function') {
        expect(bobProxy.isDestroyed()).toBe(true);
      }
    });
  });
  
  describe('Performance and Resource Management', () => {
    test('should handle multiple concurrent proxies efficiently', () => {
      const proxies = [];
      
      // Create multiple proxies of different types
      for (let i = 0; i < 10; i++) {
        // Mix of different proxy types
        if (i % 3 === 0) {
          proxies.push(new EntityProxy(resourceManager, sampleData.users.alice));
        } else if (i % 3 === 1) {
          proxies.push(new CollectionProxy(resourceManager, {
            find: ['?e'],
            where: [['?e', ':user/active', true]],
            entityKey: '?e'
          }));
        } else {
          proxies.push(new StreamProxy(resourceManager, {
            find: ['?e', '?name'],
            where: [['?e', ':user/name', '?name']]
          }));
        }
      }
      
      expect(proxies.length).toBe(10);
      
      // All should be working
      proxies.forEach(proxy => {
        expect(() => proxy.value()).not.toThrow();
        expect(proxy.isDestroyed()).toBe(false);
      });
      
      // Cleanup all
      proxies.forEach(proxy => proxy.destroy());
      
      // All should be destroyed
      proxies.forEach(proxy => {
        expect(proxy.isDestroyed()).toBe(true);
      });
    });
  });
});