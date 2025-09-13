/**
 * Subscription System Integration Tests
 * Testing subscription lifecycle, cleanup, and cross-proxy subscriptions
 */

import { DataStoreProxy } from '../src/DataStoreProxy.js';
import { EntityProxy } from '../src/EntityProxy.js';
import { StreamProxy } from '../src/StreamProxy.js';
import { CollectionProxy } from '../src/CollectionProxy.js';
import { createTestStore, createSampleData } from './setup.js';

describe('Subscription System Integration', () => {
  let store;
  let sampleData;
  let proxy;
  
  beforeEach(() => {
    store = createTestStore();
    sampleData = createSampleData(store);
    proxy = new DataStoreProxy(store);
  });
  
  afterEach(() => {
    // Cleanup all proxies after each test
    if (proxy && !proxy.isDestroyed()) {
      proxy.destroy();
    }
  });
  
  describe('DataStoreProxy Subscriptions', () => {
    test('should create and manage global subscriptions', (done) => {
      const subscription = proxy.subscribe(
        {
          find: ['?e'],
          where: [['?e', ':user/active', true]]
        },
        (results) => {
          try {
            // Verify callback triggered with expected results
            expect(results).toBeTruthy();
            expect(results.length).toBe(2);
            expect(results.map(r => r[0])).toContain(sampleData.users.alice);
            expect(results.map(r => r[0])).toContain(sampleData.users.bob);
            subscription.unsubscribe();
            done();
          } catch (error) {
            done(error);
          }
        }
      );
      
      // Verify subscription is tracked
      expect(proxy._subscriptions.has(subscription)).toBe(true);
    });
    
    test('should cleanup subscriptions on destroy', () => {
      const subscription1 = proxy.subscribe(
        { find: ['?e'], where: [['?e', ':user/active', true]] },
        () => {}
      );
      
      const subscription2 = proxy.subscribe(
        { find: ['?name'], where: [['?e', ':user/name', '?name']] },
        () => {}
      );
      
      // DataStoreProxy has 2 explicit subscriptions (no cache invalidation in simplified implementation)
      expect(proxy._subscriptions.size).toBe(2);
      
      proxy.destroy();
      
      expect(proxy.isDestroyed()).toBe(true);
      expect(proxy._subscriptions.size).toBe(0);
    });
  });
  
  describe('EntityProxy Subscriptions', () => {
    test('should subscribe to entity changes', (done) => {
      const entityProxy = proxy.entity(sampleData.users.alice);
      
      // Subscribe to all attributes of this entity
      const querySpec = {
        find: ['?attr', '?value'],
        where: [[sampleData.users.alice, '?attr', '?value']]
      };
      
      const subscription = entityProxy.subscribe(querySpec, (results) => {
        try {
          // Verify initial callback triggered with entity attributes
          expect(Array.isArray(results)).toBe(true);
          
          // Results will be in the format [[':attr', value], ...]
          const entity = {};
          results.forEach(([attr, value]) => {
            entity[attr] = value;
          });
          
          expect(entity[':user/name']).toBe('Alice');
          expect(entity[':user/age']).toBe(30);
          subscription.unsubscribe();
          done();
        } catch (error) {
          done(error);
        }
      });
    });
    
    test('should support query-based subscriptions on entity', (done) => {
      const entityProxy = proxy.entity(sampleData.users.alice);
      
      const subscription = entityProxy.subscribe(
        {
          find: ['?age'],
          where: [[sampleData.users.alice, ':user/age', '?age']]
        },
        (results) => {
          try {
            expect(results).toEqual([[30]]);
            subscription.unsubscribe();
            done();
          } catch (error) {
            done(error);
          }
        }
      );
    });
    
    test('should cleanup subscriptions when entity proxy is destroyed', () => {
      const entityProxy = proxy.entity(sampleData.users.alice);
      
      // Subscribe to all attributes
      const querySpec1 = {
        find: ['?attr', '?value'],
        where: [[sampleData.users.alice, '?attr', '?value']]
      };
      const sub1 = entityProxy.subscribe(querySpec1, () => {});
      
      const sub2 = entityProxy.subscribe(
        { find: ['?age'], where: [[sampleData.users.alice, ':user/age', '?age']] },
        () => {}
      );
      
      // EntityProxy has 2 explicit subscriptions
      expect(entityProxy._subscriptions.size).toBe(2);
      
      entityProxy.destroy();
      
      expect(entityProxy.isDestroyed()).toBe(true);
      expect(entityProxy._subscriptions.size).toBe(0);
    });
  });
  
  describe('StreamProxy Subscriptions', () => {
    test('should subscribe to stream query changes', (done) => {
      const streamProxy = proxy.stream({
        find: ['?e', '?name'],
        where: [
          ['?e', ':user/active', true],
          ['?e', ':user/name', '?name']
        ]
      });
      
      const subscription = streamProxy.subscribe((results) => {
        try {
          expect(results.length).toBe(2);
          const names = results.map(r => r[1]);
          expect(names).toContain('Alice');
          expect(names).toContain('Bob');
          subscription.unsubscribe();
          done();
        } catch (error) {
          done(error);
        }
      });
    });
    
    test('should support filter with subscriptions', (done) => {
      const streamProxy = proxy.stream({
        find: ['?e', '?age'],
        where: [
          ['?e', ':user/active', true],
          ['?e', ':user/age', '?age']
        ]
      });
      
      // Filter for users over 25
      const filteredStream = streamProxy.filter(result => result[1] > 25);
      
      const subscription = filteredStream.subscribe((results) => {
        try {
          // Bob is 25, Alice is 30 - only Alice passes filter
          expect(results.length).toBe(1);
          expect(results[0][1]).toBe(30);
          subscription.unsubscribe();
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
  
  describe('CollectionProxy Subscriptions', () => {
    test('should subscribe to collection changes', (done) => {
      const collectionProxy = proxy.collection({
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      });
      
      const subscription = collectionProxy.subscribe(
        {
          find: ['?e'],
          where: [['?e', ':user/active', true]]
        },
        (results) => {
          try {
            expect(results.length).toBe(2);
            subscription.unsubscribe();
            done();
          } catch (error) {
            done(error);
          }
        }
      );
    });
    
    test('should propagate subscriptions to entity proxies', (done) => {
      const collectionProxy = proxy.collection({
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      });
      
      // Get an entity proxy from the collection
      const entityIds = collectionProxy._getEntityIds();
      const firstEntity = collectionProxy.get(entityIds[0]);
      
      // Subscribe to all attributes of the first entity
      const querySpec = {
        find: ['?attr', '?value'],
        where: [[entityIds[0], '?attr', '?value']]
      };
      
      const subscription = firstEntity.subscribe(querySpec, (results) => {
        try {
          // Verify initial callback triggered with entity attributes
          expect(Array.isArray(results)).toBe(true);
          
          // Results will be in the format [[':attr', value], ...]
          const entity = {};
          results.forEach(([attr, value]) => {
            entity[attr] = value;
          });
          
          expect(entity[':user/age']).toBeDefined();
          subscription.unsubscribe();
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
  
  describe('Cross-Proxy Subscription Management', () => {
    test('should handle cascading destroy from factory to all proxies', () => {
      // Create various proxy types
      const entity1 = proxy.entity(sampleData.users.alice);
      const entity2 = proxy.entity(sampleData.users.bob);
      
      const stream = proxy.stream({
        find: ['?e'],
        where: [['?e', ':user/active', true]]
      });
      
      const collection = proxy.collection({
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      });
      
      // Create subscriptions on each
      const entityQuerySpec = {
        find: ['?attr', '?value'],
        where: [[sampleData.users.alice, '?attr', '?value']]
      };
      const sub1 = entity1.subscribe(entityQuerySpec, () => {});
      const sub2 = stream.subscribe(() => {});
      const sub3 = collection.subscribe(
        { find: ['?e'], where: [['?e', ':user/active', true]] },
        () => {}
      );
      
      // Verify all are active
      expect(entity1.isDestroyed()).toBe(false);
      expect(entity2.isDestroyed()).toBe(false);
      expect(stream.isDestroyed()).toBe(false);
      expect(collection.isDestroyed()).toBe(false);
      
      // Destroy factory proxy
      proxy.destroy();
      
      // All entity proxies should be destroyed
      expect(entity1.isDestroyed()).toBe(true);
      expect(entity2.isDestroyed()).toBe(true);
      // Stream and collection proxies are independent
      expect(stream.isDestroyed()).toBe(false);
      expect(collection.isDestroyed()).toBe(false);
      
      // Clean up remaining proxies
      stream.destroy();
      collection.destroy();
    });
    
    test('should handle subscription errors gracefully', () => {
      // Store original console.warn
      const originalWarn = console.warn;
      let warnCalled = false;
      let warnMessage = null;
      
      // Replace console.warn temporarily
      console.warn = (msg, error) => {
        warnCalled = true;
        warnMessage = msg;
      };
      
      try {
        // Create a proxy with subscription
        const entityProxy = proxy.entity(sampleData.users.alice);
        const querySpec = {
          find: ['?attr', '?value'],
          where: [[sampleData.users.alice, '?attr', '?value']]
        };
        const subscription = entityProxy.subscribe(querySpec, () => {});
        
        // The subscription is tracked in entityProxy._subscriptions
        // We need to replace the unsubscribe method on the actual tracked subscription
        // First check if there are subscriptions
        expect(entityProxy._subscriptions.size).toBeGreaterThan(0);
        
        // Replace unsubscribe method for all tracked subscriptions to throw error
        for (const trackedSub of entityProxy._subscriptions) {
          const originalUnsubscribe = trackedSub.unsubscribe;
          trackedSub.unsubscribe = () => {
            throw new Error('Unsubscribe failed');
          };
        }
        
        // Destroy should continue despite error
        expect(() => entityProxy.destroy()).not.toThrow();
        expect(entityProxy.isDestroyed()).toBe(true);
        // The warning message from Handle.destroy() includes more text
        expect(warnCalled).toBe(true);
        expect(warnMessage).toContain('Failed to unsubscribe');
      } finally {
        // Restore original console.warn
        console.warn = originalWarn;
      }
    });
  });
  
  describe('Subscription Memory Management', () => {
    test('should prevent memory leaks with proper cleanup', () => {
      const subscriptions = [];
      
      // Create many subscriptions
      for (let i = 0; i < 100; i++) {
        subscriptions.push(
          proxy.subscribe(
            { find: ['?e'], where: [['?e', ':user/active', true]] },
            () => {}
          )
        );
      }
      
      // DataStoreProxy has 100 explicit subscriptions (no cache invalidation in simplified implementation)
      expect(proxy._subscriptions.size).toBe(100);
      
      // Unsubscribe half
      for (let i = 0; i < 50; i++) {
        subscriptions[i].unsubscribe();
      }
      
      // DataStoreProxy has 50 remaining explicit subscriptions
      expect(proxy._subscriptions.size).toBe(50);
      
      // Destroy proxy cleans up remaining
      proxy.destroy();
      expect(proxy._subscriptions.size).toBe(0);
    });
    
    test('should handle rapid subscribe/unsubscribe cycles', () => {
      const maxCycles = 10;
      
      for (let i = 0; i < maxCycles; i++) {
        const subscription = proxy.subscribe(
          { find: ['?e'], where: [['?e', ':user/active', true]] },
          () => {}
        );
        
        // Immediately unsubscribe
        subscription.unsubscribe();
      }
      
      // All subscriptions should be cleaned up
      expect(proxy._subscriptions.size).toBe(0);
    });
  });
  
  describe('Subscription Query Validation', () => {
    test('should validate subscription parameters', () => {
      expect(() => {
        proxy.subscribe(null, () => {});
      }).toThrow('Query specification is required');
      
      expect(() => {
        proxy.subscribe({ find: ['?e'], where: [] }, null);
      }).toThrow('Callback function is required');
      
      expect(() => {
        proxy.subscribe({ find: ['?e'], where: [] }, 'not-a-function');
      }).toThrow('Callback function is required');
    });
    
    test('should prevent subscriptions on destroyed proxies', () => {
      proxy.destroy();
      
      expect(() => {
        proxy.subscribe(
          { find: ['?e'], where: [['?e', ':user/active', true]] },
          () => {}
        );
      }).toThrow('Handle has been destroyed');
    });
  });
});