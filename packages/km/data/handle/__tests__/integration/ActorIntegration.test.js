/**
 * ActorIntegration.test.js - Verify Handle's Actor system integration
 * 
 * Tests that Handle properly extends Actor and supports remote capability
 * for frontend/backend communication.
 */

import { Handle } from '../../src/Handle.js';
import { Actor } from '@legion/actors';
import { createMockResourceManager } from '../testUtils.js';

describe('Handle Actor Integration', () => {
  let mockResourceManager;
  let handle;

  beforeEach(() => {
    mockResourceManager = createMockResourceManager();
  });

  afterEach(() => {
    if (handle && !handle.isDestroyed()) {
      handle.destroy();
    }
  });

  describe('Actor Inheritance', () => {
    test('Handle should extend Actor class', () => {
      // Create a test handle implementation
      class TestHandle extends Handle {
        value() {
          return 'test-value';
        }
        
        query(querySpec) {
          return this.resourceManager.query(querySpec);
        }
      }
      
      handle = new TestHandle(mockResourceManager);
      
      // Verify it's an instance of Actor
      expect(handle).toBeInstanceOf(Actor);
      expect(handle).toBeInstanceOf(Handle);
    });

    test('Handle should inherit Actor methods', () => {
      class TestHandle extends Handle {
        value() {
          return 'test-value';
        }
        
        query(querySpec) {
          return this.resourceManager.query(querySpec);
        }
      }
      
      handle = new TestHandle(mockResourceManager);
      
      // Check for Actor methods
      expect(typeof handle.receive).toBe('function');
      expect(typeof handle.call).toBe('function');
      // Actor base class should provide these
    });
  });

  describe('Message Passing', () => {
    test('Handle should support Actor message passing', () => {
      class TestHandle extends Handle {
        value() {
          return 'test-value';
        }
        
        query(querySpec) {
          return ['query-result'];
        }
      }
      
      handle = new TestHandle(mockResourceManager);
      
      // Test message passing via receive
      const valueResult = handle.receive({ type: 'value' });
      expect(valueResult).toBe('test-value');
      
      const queryResult = handle.receive({ 
        type: 'query', 
        querySpec: { find: ['?e'], where: [['?e', ':attr', '?v']] }
      });
      expect(queryResult).toEqual(['query-result']);
      
      const introspectResult = handle.receive({ type: 'introspect' });
      expect(introspectResult).toHaveProperty('handleType');
      expect(introspectResult).toHaveProperty('isDestroyed');
    });

    test('Handle should support remote-style calls', () => {
      class TestHandle extends Handle {
        value() {
          return 'remote-value';
        }
        
        query(querySpec) {
          return ['remote-result'];
        }
      }
      
      handle = new TestHandle(mockResourceManager);
      
      // Simulate remote-style message (could come from frontend/backend)
      const message = {
        type: 'value',
        correlationId: 'test-123'
      };
      
      const result = handle.receive(message);
      expect(result).toBe('remote-value');
    });
  });

  describe('Frontend/Backend Capability', () => {
    test('Handle should support subscription messages for remote observers', () => {
      class TestHandle extends Handle {
        value() {
          return 'test-value';
        }
        
        query(querySpec) {
          return [];
        }
      }
      
      handle = new TestHandle(mockResourceManager);
      
      // Remote subscription setup
      const remoteCallback = () => {}; // Simple callback function for testing
      const subscribeMessage = {
        type: 'subscribe',
        querySpec: { find: ['?e'], where: [['?e', ':user/name', '?name']] },
        callback: remoteCallback
      };
      
      const subscription = handle.receive(subscribeMessage);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // Verify subscription is tracked
      const introspect = handle.receive({ type: 'introspect' });
      expect(introspect.subscriptionCount).toBe(1);
      
      // Clean up
      subscription.unsubscribe();
    });

    test('Handle should support remote destruction', () => {
      class TestHandle extends Handle {
        value() {
          return 'test-value';
        }
        
        query(querySpec) {
          return [];
        }
      }
      
      handle = new TestHandle(mockResourceManager);
      
      // Remote destroy message
      const destroyMessage = { type: 'destroy' };
      
      expect(handle.isDestroyed()).toBe(false);
      handle.receive(destroyMessage);
      expect(handle.isDestroyed()).toBe(true);
      
      // Should reject operations after remote destroy
      expect(() => handle.receive({ type: 'value' })).toThrow('Handle has been destroyed');
    });
  });

  describe('Actor Pattern Compliance', () => {
    test('Handle should follow Actor pattern for async appearance with sync internals', () => {
      class TestHandle extends Handle {
        value() {
          // Synchronous internally
          return this._computeValue();
        }
        
        query(querySpec) {
          // Synchronous internally
          return this._executeQuery(querySpec);
        }
        
        _computeValue() {
          return 'computed-value';
        }
        
        _executeQuery(spec) {
          return ['result'];
        }
      }
      
      handle = new TestHandle(mockResourceManager);
      
      // Message passing appears async but is sync internally
      const startTime = Date.now();
      const result = handle.receive({ type: 'value' });
      const endTime = Date.now();
      
      expect(result).toBe('computed-value');
      // Should be virtually instant (< 1ms) since it's synchronous
      expect(endTime - startTime).toBeLessThan(2);
    });

    test('Handle should support Actor-style error handling', () => {
      class TestHandle extends Handle {
        value() {
          throw new Error('Value computation failed');
        }
        
        query(querySpec) {
          return [];
        }
      }
      
      handle = new TestHandle(mockResourceManager);
      
      // Actor pattern - errors thrown synchronously
      expect(() => handle.receive({ type: 'value' })).toThrow('Value computation failed');
    });
  });
});