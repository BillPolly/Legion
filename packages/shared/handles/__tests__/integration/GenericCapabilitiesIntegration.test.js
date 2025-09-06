/**
 * Generic Handle Capabilities Integration Test - Phase 2
 * 
 * Tests BaseHandle + HandleCache + HandleSubscriptions integration
 * NO MOCKS - uses real classes only
 */

import { jest } from '@jest/globals';
import { BaseHandle } from '../../src/BaseHandle.js';
import { TypeHandleRegistry } from '../../src/TypeHandleRegistry.js';

describe('Generic Handle Capabilities Integration', () => {
  let registry;
  let testHandleMetadata;

  beforeAll(() => {
    registry = TypeHandleRegistry.getGlobalRegistry();
    
    testHandleMetadata = {
      methods: {
        read: { 
          params: [], 
          returns: 'string', 
          cacheable: true,
          ttl: 1000,
          documentation: 'Read content'
        },
        write: { 
          params: ['content:string'], 
          returns: 'boolean', 
          sideEffects: ['content-changed'],
          documentation: 'Write content'
        },
        process: {
          params: ['data:any'],
          returns: 'object',
          sideEffects: ['processing-complete']
        }
      },
      attributes: {
        path: { type: 'string', readonly: true },
        size: { type: 'number', computed: true }
      },
      documentation: {
        description: "Integration test handle",
        examples: ["handle.read()", "handle.write('data')"]
      }
    };
  });

  beforeEach(() => {
    registry.clear();
  });

  describe('Method Calls with Caching Integration', () => {
    test('should cache method results for cacheable methods', async () => {
      registry.registerType('TestHandle', testHandleMetadata);
      
      class TestHandle extends BaseHandle {
        constructor() {
          super('TestHandle', { path: '/test/file.txt' });
          this.readCount = 0;
        }

        async _read() {
          this.readCount++;
          return `file content ${this.readCount}`;
        }
      }

      const handle = new TestHandle();
      
      // First call should execute method
      const result1 = await handle.callMethod('read', []);
      expect(result1).toBe('file content 1');
      expect(handle.readCount).toBe(1);
      
      // Second call should use cache (if caching is implemented)
      const result2 = await handle.callMethod('read', []);
      expect(result2).toBe('file content 1'); // Same result
      // Note: readCount might be 1 or 2 depending on caching implementation
    });

    test('should emit side effects for methods that specify them', async () => {
      registry.registerType('TestHandle', testHandleMetadata);
      
      class TestHandle extends BaseHandle {
        constructor() {
          super('TestHandle'); // Pass the correct type name
        }
        
        async _write(content) {
          this.data.content = content;
          return true;
        }

        async _process(data) {
          return { processed: data };
        }
      }

      const handle = new TestHandle();
      const changeCallback = jest.fn();
      const processCallback = jest.fn();
      
      handle.subscribe('content-changed', changeCallback);
      handle.subscribe('processing-complete', processCallback);
      
      // Call write method (has side effect) - must use callMethod for side effects
      await handle.callMethod('write', ['new content']);
      
      // Call process method (has side effect) - must use callMethod for side effects
      await handle.callMethod('process', [{ data: 'test' }]);
      
      // Side effects should be emitted
      expect(changeCallback).toHaveBeenCalledWith(true);
      expect(processCallback).toHaveBeenCalledWith({ processed: { data: 'test' } });
    });
  });

  describe('Event Subscriptions with Local and Remote Forwarding', () => {
    test('should handle mixed local and remote subscriptions', () => {
      registry.registerType('TestHandle', testHandleMetadata);
      const handle = new BaseHandle('TestHandle');
      
      const localCallback1 = jest.fn();
      const localCallback2 = jest.fn();
      
      // Add local subscriptions
      handle.subscribe('test-event', localCallback1);
      handle.subscribe('test-event', localCallback2);
      
      // Add remote subscription
      handle.subscriptions.subscribeRemote('test-event', 'remote-actor-123');
      
      // Emit event
      handle.emit('test-event', { message: 'test data' });
      
      // Verify local callbacks called
      expect(localCallback1).toHaveBeenCalledWith({ message: 'test data' });
      expect(localCallback2).toHaveBeenCalledWith({ message: 'test data' });
      
      // Note: Remote forwarding tested in unit tests since we can't test real actor system here
    });

    test('should support subscription chaining and cleanup', () => {
      registry.registerType('TestHandle', testHandleMetadata);
      const handle = new BaseHandle('TestHandle');
      
      const callback = jest.fn();
      
      // Subscribe and get unsubscribe function
      const unsubscribe = handle.subscribe('chain-event', callback);
      
      // Emit event - should trigger callback
      handle.emit('chain-event', 'data1');
      expect(callback).toHaveBeenCalledWith('data1');
      
      // Unsubscribe
      unsubscribe();
      
      // Emit again - should not trigger callback
      handle.emit('chain-event', 'data2');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Caching with Pattern Invalidation Integration', () => {
    test('should invalidate method caches when state changes', async () => {
      registry.registerType('TestHandle', testHandleMetadata);
      
      class TestHandle extends BaseHandle {
        constructor() {
          super('TestHandle');
          this.content = 'initial content';
        }

        async _read() {
          return this.content;
        }

        async _write(newContent) {
          this.content = newContent;
          // Invalidate read cache since content changed
          this.invalidateCache('method:read');
          return true;
        }
      }

      const handle = new TestHandle();
      
      // Cache read result
      const result1 = await handle._read();
      handle.setCachedValue('method:read', result1, 5000);
      expect(handle.getCachedValue('method:read')).toBe('initial content');
      
      // Write new content (should invalidate cache)
      await handle._write('updated content');
      expect(handle.getCachedValue('method:read')).toBeNull();
      
      // New read should return updated content
      const result2 = await handle._read();
      expect(result2).toBe('updated content');
    });

    test('should support attribute caching with selective invalidation', () => {
      registry.registerType('TestHandle', testHandleMetadata);
      const handle = new BaseHandle('TestHandle');
      
      // Cache multiple attributes
      handle.setCachedValue('attr:size', 1024);
      handle.setCachedValue('attr:path', '/test/file.txt');
      handle.setCachedValue('method:stat', { size: 1024 });
      
      // Invalidate only attribute cache
      handle.invalidateCache('attr:');
      
      expect(handle.getCachedValue('attr:size')).toBeNull();
      expect(handle.getCachedValue('attr:path')).toBeNull();
      expect(handle.getCachedValue('method:stat')).toEqual({ size: 1024 });
    });
  });

  describe('Complete Handle Lifecycle with All Capabilities', () => {
    test('should demonstrate complete handle workflow', async () => {
      registry.registerType('CompleteTestHandle', testHandleMetadata);
      
      class CompleteTestHandle extends BaseHandle {
        constructor(path) {
          super('CompleteTestHandle', { path });
          this.setAttribute('path', path);
          this.content = 'default content';
          this.operations = [];
        }

        async _read() {
          this.operations.push('read');
          return this.content;
        }

        async _write(content) {
          this.operations.push('write');
          this.content = content;
          this.invalidateCache('method:read'); // Clear read cache
          this.emit('content-changed', content);
          return true;
        }

        async _process(data) {
          this.operations.push('process');
          const result = { processed: data, timestamp: Date.now() };
          this.emit('processing-complete', result);
          return result;
        }
      }

      const handle = new CompleteTestHandle('/test/complete.txt');
      
      // Set up subscriptions
      const changeCallback = jest.fn();
      const processCallback = jest.fn();
      
      handle.subscribe('content-changed', changeCallback);
      handle.subscribe('processing-complete', processCallback);
      
      // Test type introspection
      expect(handle.type.name).toBe('CompleteTestHandle');
      expect(handle.type.listMethods()).toContain('read');
      expect(handle.type.listMethods()).toContain('write');
      
      // Test attribute access
      expect(handle.getAttribute('path')).toBe('/test/complete.txt');
      
      // Test method calls with caching
      const content1 = await handle.callMethod('read', []);
      expect(content1).toBe('default content');
      
      // Test state change with cache invalidation and events
      await handle.callMethod('write', ['new content']);
      expect(changeCallback).toHaveBeenCalledWith('new content');
      
      // Test read again (should get new content)
      const content2 = await handle.callMethod('read', []);
      expect(content2).toBe('new content');
      
      // Test processing with events
      const processResult = await handle.callMethod('process', [{ data: 'test' }]);
      expect(processResult.processed.data).toBe('test');
      expect(processCallback).toHaveBeenCalledWith(processResult);
      
      // Verify operation history
      expect(handle.operations).toEqual(['read', 'write', 'read', 'process']);
    });
  });

  describe('Error Handling and Fail-Fast Behavior', () => {
    test('should fail fast on invalid method calls', async () => {
      registry.registerType('TestHandle', testHandleMetadata);
      const handle = new BaseHandle('TestHandle');
      
      await expect(handle.callMethod('nonExistentMethod', []))
        .rejects.toThrow('Method nonExistentMethod not supported');
    });

    test('should fail fast when type not registered', () => {
      const handle = new BaseHandle('UnregisteredType');
      
      expect(handle.type).toBeNull();
    });

    test('should handle subscription errors gracefully without stopping other subscribers', () => {
      registry.registerType('TestHandle', testHandleMetadata);
      const handle = new BaseHandle('TestHandle');
      
      const errorCallback = jest.fn(() => { throw new Error('Subscriber error'); });
      const goodCallback = jest.fn();
      
      handle.subscribe('error-test', errorCallback);
      handle.subscribe('error-test', goodCallback);
      
      // Should not throw, but should call good callback
      expect(() => handle.emit('error-test', 'data')).not.toThrow();
      expect(goodCallback).toHaveBeenCalledWith('data');
    });
  });

  describe('Performance and Memory Management', () => {
    test('should handle large numbers of subscriptions efficiently', () => {
      registry.registerType('TestHandle', testHandleMetadata);
      const handle = new BaseHandle('TestHandle');
      
      const callbacks = [];
      
      // Add many subscribers
      for (let i = 0; i < 1000; i++) {
        const callback = jest.fn();
        callbacks.push(callback);
        handle.subscribe('load-test', callback);
      }
      
      // Emit event
      handle.emit('load-test', 'load-data');
      
      // All callbacks should be called
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalledWith('load-data');
      });
    });

    test('should clean up resources properly on dispose', () => {
      registry.registerType('TestHandle', testHandleMetadata);
      const handle = new BaseHandle('TestHandle');
      
      // Add cache entries
      handle.setCachedValue('test-key', 'test-value');
      
      // Add subscriptions
      handle.subscribe('test-event', jest.fn());
      
      // Add attributes
      handle.setAttribute('test-attr', 'test-value');
      
      // Dispose handle
      handle.dispose();
      
      // Everything should be cleaned up
      expect(handle.getCachedValue('test-key')).toBeNull();
      expect(handle.getAttribute('test-attr')).toBeUndefined();
      expect(handle.listAttributes()).toEqual([]);
    });
  });
});