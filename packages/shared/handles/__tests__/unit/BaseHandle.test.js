/**
 * BaseHandle Unit Tests
 * Test the core handle functionality without external dependencies
 */

import { jest } from '@jest/globals';
import { BaseHandle } from '../../src/BaseHandle.js';

// Mock TypeHandleRegistry for testing
global.TypeHandleRegistry = {
  getTypeHandle: jest.fn().mockReturnValue({
    name: 'TestHandle',
    listMethods: jest.fn().mockReturnValue(['testMethod']),
    listAttributes: jest.fn().mockReturnValue(['testAttr']),
    getMethodSignature: jest.fn().mockReturnValue({
      params: [],
      returns: 'any',
      cacheable: false
    })
  })
};

describe('BaseHandle', () => {
  let handle;

  beforeEach(() => {
    handle = new BaseHandle('TestHandle', { testData: 'value' });
  });

  describe('Initialization', () => {
    test('should extend Actor class', () => {
      expect(handle.isActor).toBe(true);
    });

    test('should initialize with handle type and data', () => {
      expect(handle.handleType).toBe('TestHandle');
      expect(handle.data.testData).toBe('value');
    });

    test('should have empty cache and subscriptions initially', () => {
      expect(handle.cache).toBeDefined();
      expect(handle.subscriptions).toBeDefined();
      expect(handle.attributes).toBeDefined();
    });

    test('should be unique Actor instances', () => {
      const handle2 = new BaseHandle('TestHandle2');
      expect(handle).not.toBe(handle2);
      expect(handle.isActor).toBe(true);
      expect(handle2.isActor).toBe(true);
    });
  });

  describe('Generic Method Call Infrastructure', () => {
    test('should dispatch method calls correctly', async () => {
      // Add a mock method for testing
      handle._testMethod = jest.fn().mockResolvedValue('test result');
      
      const result = await handle.callMethod('testMethod', ['arg1', 'arg2']);
      
      expect(handle._testMethod).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('test result');
    });

    test('should throw error for non-existent methods', async () => {
      await expect(handle.callMethod('nonExistentMethod', []))
        .rejects.toThrow('Method nonExistentMethod not supported');
    });

    test('should handle async method calls', async () => {
      handle._asyncMethod = jest.fn().mockResolvedValue('async result');
      
      const result = await handle.callMethod('asyncMethod', []);
      
      expect(result).toBe('async result');
    });
  });

  describe('Generic Caching Infrastructure', () => {
    test('should cache and retrieve values', () => {
      handle.setCachedValue('testKey', 'testValue', 1000);
      
      expect(handle.getCachedValue('testKey')).toBe('testValue');
    });

    test('should return null for non-existent cache keys', () => {
      expect(handle.getCachedValue('nonExistentKey')).toBeNull();
    });

    test('should invalidate cache by pattern', () => {
      handle.setCachedValue('method:read', 'content1');
      handle.setCachedValue('method:write', 'result1'); 
      handle.setCachedValue('attr:size', 100);
      
      handle.invalidateCache('method:');
      
      expect(handle.getCachedValue('method:read')).toBeNull();
      expect(handle.getCachedValue('method:write')).toBeNull();
      expect(handle.getCachedValue('attr:size')).toBe(100);
    });
  });

  describe('Generic Subscription Infrastructure', () => {
    test('should add and trigger subscriptions', () => {
      const callback = jest.fn();
      
      handle.subscribe('test-event', callback);
      handle.emit('test-event', { data: 'test' });
      
      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    test('should support multiple subscribers for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      handle.subscribe('test-event', callback1);
      handle.subscribe('test-event', callback2);
      handle.emit('test-event', 'data');
      
      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });

    test('should return unsubscribe function', () => {
      const callback = jest.fn();
      
      const unsubscribe = handle.subscribe('test-event', callback);
      handle.emit('test-event', 'data1');
      
      unsubscribe();
      handle.emit('test-event', 'data2');
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('data1');
    });
  });

  describe('Generic Attribute System', () => {
    test('should set and get attributes', () => {
      handle.setAttribute('testAttr', 'testValue');
      
      expect(handle.getAttribute('testAttr')).toBe('testValue');
    });

    test('should return undefined for non-existent attributes', () => {
      expect(handle.getAttribute('nonExistentAttr')).toBeUndefined();
    });

    test('should list all attributes', () => {
      handle.setAttribute('attr1', 'value1');
      handle.setAttribute('attr2', 'value2');
      
      const attrs = handle.listAttributes();
      expect(attrs).toContain('attr1');
      expect(attrs).toContain('attr2');
    });
  });

  describe('Type System Integration', () => {
    test('should have type property', () => {
      expect(handle.type).toBeDefined();
    });

    test('should throw error if TypeHandleRegistry not available', () => {
      // This test ensures fail-fast behavior
      const originalRegistry = global.TypeHandleRegistry;
      delete global.TypeHandleRegistry;
      
      expect(() => handle.type).toThrow('TypeHandleRegistry not available');
      
      global.TypeHandleRegistry = originalRegistry;
    });
  });

  describe('Actor Integration', () => {
    test('should inherit Actor message handling', () => {
      expect(typeof handle.receive).toBe('function');
      expect(typeof handle.call).toBe('function');
    });

    test('should handle actor messages for method calls', async () => {
      handle._testMethod = jest.fn().mockResolvedValue('result');
      
      const response = await handle.receive('call-method', {
        method: 'testMethod',
        args: ['arg1']
      });
      
      expect(handle._testMethod).toHaveBeenCalledWith('arg1');
      expect(response).toBe('result');
    });

    test('should handle actor messages for attribute access', async () => {
      handle.setAttribute('testAttr', 'testValue');
      
      const response = await handle.receive('get-attribute', {
        attribute: 'testAttr'
      });
      
      expect(response).toBe('testValue');
    });
  });

  describe('Serialization for Actor System', () => {
    test('should provide serialize method for ActorSerializer delegation', () => {
      handle.setAttribute('testAttr', 'testValue');
      
      const serialized = handle.serialize();
      
      expect(serialized).toEqual({
        __type: 'RemoteHandle',
        handleId: handle.getGuid(),
        handleType: 'TestHandle',
        attributes: {
          testAttr: 'testValue'
        },
        data: { testData: 'value' }
      });
    });

    test('should produce consistent serialization', () => {
      const serialized1 = handle.serialize();
      const serialized2 = handle.serialize();
      
      expect(serialized1.handleId).toBe(serialized2.handleId);
      expect(serialized1.handleType).toBe(serialized2.handleType);
    });

    test('should include all attributes in serialization', () => {
      handle.setAttribute('attr1', 'value1');
      handle.setAttribute('attr2', { nested: 'object' });
      handle.setAttribute('attr3', 12345);
      
      const serialized = handle.serialize();
      
      expect(serialized.attributes).toEqual({
        attr1: 'value1',
        attr2: { nested: 'object' },
        attr3: 12345
      });
    });

    test('should handle empty attributes in serialization', () => {
      const serialized = handle.serialize();
      
      expect(serialized.attributes).toEqual({});
      expect(serialized.data).toEqual({ testData: 'value' });
    });
  });
});