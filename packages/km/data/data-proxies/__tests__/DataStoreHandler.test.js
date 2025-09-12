/**
 * DataStore Resource Handler Interface Unit Tests
 * Testing the interface methods that DataStore needs to support proxy operations
 */

import { createTestStore, createSampleData, assertions, validators, errorHelpers } from './setup.js';

describe('DataStore Resource Handler Interface', () => {
  let store;
  let sampleData;
  
  beforeEach(() => {
    store = createTestStore();
    sampleData = createSampleData(store);
  });
  
  describe('subscribe() Method', () => {
    test('should add subscribe method to DataStore', () => {
      expect(typeof store.subscribe).toBe('function');
    });
    
    test('should create subscription for query specification', () => {
      const querySpec = { find: ['?e'], where: [['?e', ':user/name', '?name']] };
      let callbackCalled = false;
      let receivedData = null;
      
      const callback = (data) => {
        callbackCalled = true;
        receivedData = data;
      };
      
      const subscription = store.subscribe(querySpec, callback);
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      expect(subscription.id).toBeDefined();
      expect(typeof subscription.id).toBe('string');
    });
    
    test('should validate query specification parameter', () => {
      expect(() => store.subscribe()).toThrow('Query specification is required');
      expect(() => store.subscribe(null, () => {})).toThrow('Query specification is required');
      expect(() => store.subscribe('invalid', () => {})).toThrow('Query specification must be an object');
    });
    
    test('should validate callback parameter', () => {
      const validQuery = { find: ['?e'], where: [] };
      
      expect(() => store.subscribe(validQuery)).toThrow('Callback function is required');
      expect(() => store.subscribe(validQuery, null)).toThrow('Callback function is required');
      expect(() => store.subscribe(validQuery, 'not a function')).toThrow('Callback must be a function');
    });
    
    test('should validate query specification structure', () => {
      const callback = () => {};
      
      expect(() => store.subscribe({}, callback)).toThrow('Query must have find clause');
      expect(() => store.subscribe({ find: [] }, callback)).toThrow('Query must have find clause');
      expect(() => store.subscribe({ find: ['?e'] }, callback)).toThrow('Query must have where clause');
      expect(() => store.subscribe({ find: ['?e'], where: 'invalid' }, callback)).toThrow('Where clause must be an array');
    });
    
    test('should trigger callback with initial query results', (done) => {
      const querySpec = { 
        find: ['?e', '?name'], 
        where: [['?e', ':user/name', '?name']] 
      };
      
      const subscription = store.subscribe(querySpec, (results) => {
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(3); // Alice, Bob, Charlie
        done();
      });
      
      // Cleanup
      setTimeout(() => subscription.unsubscribe(), 10);
    });
    
    test('should not trigger callback for unrelated changes', (done) => {
      const querySpec = { 
        find: ['?e'], 
        where: [['?e', ':user/name', 'NonExistent']] 
      };
      
      let callCount = 0;
      const subscription = store.subscribe(querySpec, () => {
        callCount++;
      });
      
      // Make unrelated change
      store.createEntity({
        ':project/name': 'Unrelated Project'
      });
      
      setTimeout(() => {
        expect(callCount).toBe(1); // Only initial callback
        subscription.unsubscribe();
        done();
      }, 20);
    });
  });
  
  describe('Subscription Object', () => {
    test('should return subscription with unsubscribe method', () => {
      const querySpec = { find: ['?e'], where: [['?e', ':user/name', '?name']] };
      const subscription = store.subscribe(querySpec, () => {});
      
      expect(subscription).toHaveProperty('unsubscribe');
      expect(typeof subscription.unsubscribe).toBe('function');
      expect(subscription).toHaveProperty('id');
      expect(typeof subscription.id).toBe('string');
      
      // Cleanup
      subscription.unsubscribe();
    });
    
    test('should handle unsubscribe safely', () => {
      const querySpec = { find: ['?e'], where: [['?e', ':user/name', '?name']] };
      const subscription = store.subscribe(querySpec, () => {});
      
      // Should not throw
      expect(() => subscription.unsubscribe()).not.toThrow();
      
      // Should be safe to call multiple times
      expect(() => {
        subscription.unsubscribe();
        subscription.unsubscribe();
      }).not.toThrow();
    });
    
    test('should stop receiving callbacks after unsubscribe', (done) => {
      const querySpec = { 
        find: ['?e'], 
        where: [['?e', ':user/name', '?name']] 
      };
      
      let callCount = 0;
      const subscription = store.subscribe(querySpec, () => {
        callCount++;
      });
      
      // Unsubscribe immediately after first callback
      setTimeout(() => {
        subscription.unsubscribe();
        
        // Make a change that would trigger the subscription
        store.createEntity({
          ':user/name': 'New User',
          ':user/email': 'new@example.com'
        });
        
        // Verify no additional callbacks
        setTimeout(() => {
          expect(callCount).toBe(1); // Only initial callback
          done();
        }, 20);
      }, 10);
    });
  });
  
  describe('Reactive Updates', () => {
    test('should trigger subscription when relevant data changes', (done) => {
      const querySpec = { 
        find: ['?e', '?name'], 
        where: [['?e', ':user/name', '?name']] 
      };
      
      let callCount = 0;
      let lastResults = null;
      
      const subscription = store.subscribe(querySpec, (results) => {
        callCount++;
        lastResults = results;
        
        if (callCount === 2) {
          // Second callback - should have 4 users now
          expect(results.length).toBe(4);
          subscription.unsubscribe();
          done();
        }
      });
      
      // Add a new user after initial subscription
      setTimeout(() => {
        store.createEntity({
          ':user/name': 'Dave',
          ':user/email': 'dave@example.com',
          ':user/age': 28
        });
      }, 10);
    });
    
    test('should trigger subscription when entity is updated', (done) => {
      const querySpec = { 
        find: ['?e', '?age'], 
        where: [
          ['?e', ':user/name', 'Alice'],
          ['?e', ':user/age', '?age']
        ] 
      };
      
      let callCount = 0;
      const subscription = store.subscribe(querySpec, (results) => {
        callCount++;
        
        if (callCount === 1) {
          // Initial callback - Alice age should be 30
          expect(results[0][1]).toBe(30);
        } else if (callCount === 2) {
          // After update - Alice age should be 31
          expect(results[0][1]).toBe(31);
          subscription.unsubscribe();
          done();
        }
      });
      
      // Update Alice's age
      setTimeout(() => {
        store.updateEntity(sampleData.users.alice, {
          ':user/age': 31
        });
      }, 10);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle callback errors gracefully', (done) => {
      const querySpec = { find: ['?e'], where: [['?e', ':user/name', '?name']] };
      
      // Subscription with failing callback should not break the system
      const subscription = store.subscribe(querySpec, () => {
        throw new Error('Callback error');
      });
      
      // Should not throw when creating entity (reactive system should handle callback errors)
      expect(() => {
        store.createEntity({
          ':user/name': 'Error Test',
          ':user/email': 'error@example.com'
        });
      }).not.toThrow();
      
      setTimeout(() => {
        subscription.unsubscribe();
        done();
      }, 20);
    });
    
    test('should fail fast with invalid parameters', () => {
      // No fallbacks - should throw immediately
      errorHelpers.expectNoFallback(() => store.subscribe());
      errorHelpers.expectNoFallback(() => store.subscribe(null, () => {}));
      errorHelpers.expectNoFallback(() => store.subscribe({}, null));
    });
  });
  
  describe('Subscription Management', () => {
    test('should handle multiple subscriptions independently', (done) => {
      const querySpec1 = { find: ['?e'], where: [['?e', ':user/name', '?name']] };
      const querySpec2 = { find: ['?e'], where: [['?e', ':project/name', '?name']] };
      
      let callback1Called = false;
      let callback2Called = false;
      
      const sub1 = store.subscribe(querySpec1, () => { callback1Called = true; });
      const sub2 = store.subscribe(querySpec2, () => { callback2Called = true; });
      
      expect(sub1.id).not.toBe(sub2.id);
      
      // Wait for async callbacks
      setTimeout(() => {
        expect(callback1Called).toBe(true);
        expect(callback2Called).toBe(true);
        
        sub1.unsubscribe();
        sub2.unsubscribe();
        done();
      }, 10);
    });
    
    test('should clean up subscriptions properly', () => {
      const subscriptions = [];
      
      // Create multiple subscriptions
      for (let i = 0; i < 5; i++) {
        const subscription = store.subscribe(
          { find: ['?e'], where: [['?e', ':user/name', '?name']] },
          () => {}
        );
        subscriptions.push(subscription);
      }
      
      // Unsubscribe all
      subscriptions.forEach(sub => {
        expect(() => sub.unsubscribe()).not.toThrow();
      });
    });
  });
});