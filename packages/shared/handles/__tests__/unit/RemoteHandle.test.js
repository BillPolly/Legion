/**
 * RemoteHandle Unit Tests
 * Test remote handle proxy functionality and serialization
 */

import { jest } from '@jest/globals';
import { RemoteHandle, createRemoteHandleProxy } from '../../src/RemoteHandle.js';
import { TypeHandleRegistry } from '../../src/TypeHandleRegistry.js';

describe('RemoteHandle', () => {
  let remoteHandle;
  let mockActorChannel;
  let mockSerializedData;
  let registry;

  beforeEach(() => {
    registry = new TypeHandleRegistry();
    global.TypeHandleRegistry = registry;
    
    // Register a test type for remote handles
    registry.registerType('TestRemoteHandle', {
      methods: {
        read: { params: [], returns: 'string' },
        write: { params: ['content:string'], returns: 'boolean' }
      },
      attributes: {
        path: { type: 'string', readonly: true },
        size: { type: 'number', computed: true }
      }
    });
    
    mockActorChannel = {
      sendMessage: jest.fn(),
      getLocalGuid: jest.fn().mockReturnValue('local-actor-guid')
    };
    
    mockSerializedData = {
      handleId: 'remote-handle-123',
      handleType: 'TestRemoteHandle',
      attributes: {
        path: '/remote/file.txt',
        size: 2048
      },
      data: { path: '/remote/file.txt' }
    };
    
    remoteHandle = new RemoteHandle(mockSerializedData, mockActorChannel);
  });

  describe('Initialization', () => {
    test('should initialize from serialized data', () => {
      expect(remoteHandle.handleId).toBe('remote-handle-123');
      expect(remoteHandle.handleType).toBe('TestRemoteHandle');
      expect(remoteHandle.isRemoteHandle).toBe(true);
      expect(remoteHandle.data.path).toBe('/remote/file.txt');
    });

    test('should restore attributes from serialized data', () => {
      expect(remoteHandle.getAttribute('path')).toBe('/remote/file.txt');
      expect(remoteHandle.getAttribute('size')).toBe(2048);
      expect(remoteHandle.listAttributes()).toEqual(['path', 'size']);
    });

    test('should provide same type introspection as original handle', () => {
      expect(remoteHandle.type.name).toBe('TestRemoteHandle');
      expect(remoteHandle.type.listMethods()).toEqual(['read', 'write']);
      expect(remoteHandle.type.respondsTo('read')).toBe(true);
      expect(remoteHandle.type.respondsTo('nonExistent')).toBe(false);
    });
  });

  describe('Remote Method Forwarding', () => {
    test('should forward setAttribute to remote handle', () => {
      remoteHandle.setAttribute('newAttr', 'newValue');
      
      expect(mockActorChannel.sendMessage).toHaveBeenCalledWith('set-attribute', {
        handleId: 'remote-handle-123',
        attribute: 'newAttr',
        value: 'newValue'
      });
      
      // Should also update local attributes
      expect(remoteHandle.getAttribute('newAttr')).toBe('newValue');
    });

    test('should handle remote subscription setup', () => {
      const callback = jest.fn();
      
      const unsubscribe = remoteHandle.subscribe('content-changed', callback);
      
      expect(mockActorChannel.sendMessage).toHaveBeenCalledWith('subscribe-remote', {
        handleId: 'remote-handle-123',
        event: 'content-changed',
        subscriberGuid: 'local-actor-guid'
      });
      
      // Unsubscribe should also send message
      unsubscribe();
      
      expect(mockActorChannel.sendMessage).toHaveBeenCalledWith('unsubscribe-remote', {
        handleId: 'remote-handle-123',
        event: 'content-changed',
        subscriberGuid: 'local-actor-guid'
      });
    });

    test('should handle incoming remote events', () => {
      const callback = jest.fn();
      remoteHandle.subscribe('test-event', callback);
      
      // Simulate incoming event from remote handle
      remoteHandle.handleRemoteEvent('test-event', { data: 'remote data' });
      
      expect(callback).toHaveBeenCalledWith({ data: 'remote data' });
    });
  });

  describe('Proxy Integration', () => {
    test('should create proxy with dynamic method forwarding', () => {
      const proxy = createRemoteHandleProxy(mockSerializedData, mockActorChannel);
      
      expect(proxy.handleId).toBe('remote-handle-123');
      expect(proxy.handleType).toBe('TestRemoteHandle');
      expect(proxy.isRemoteHandle).toBe(true);
    });

    test('should forward method calls through proxy', async () => {
      mockActorChannel.sendMessage.mockResolvedValue('remote result');
      
      const proxy = createRemoteHandleProxy(mockSerializedData, mockActorChannel);
      
      // Call method through proxy
      const result = await proxy.read();
      
      expect(mockActorChannel.sendMessage).toHaveBeenCalledWith('call-method', {
        handleId: 'remote-handle-123',
        method: 'read',
        args: []
      });
      
      expect(result).toBe('remote result');
    });

    test('should support method calls with arguments', async () => {
      mockActorChannel.sendMessage.mockResolvedValue(true);
      
      const proxy = createRemoteHandleProxy(mockSerializedData, mockActorChannel);
      
      // Call method with arguments
      const result = await proxy.write('new content');
      
      expect(mockActorChannel.sendMessage).toHaveBeenCalledWith('call-method', {
        handleId: 'remote-handle-123',
        method: 'write',
        args: ['new content']
      });
      
      expect(result).toBe(true);
    });

    test('should provide attribute access through proxy', () => {
      const proxy = createRemoteHandleProxy(mockSerializedData, mockActorChannel);
      
      expect(proxy.path).toBe('/remote/file.txt');
      expect(proxy.size).toBe(2048);
    });

    test('should support introspection through proxy', () => {
      const proxy = createRemoteHandleProxy(mockSerializedData, mockActorChannel);
      
      expect(proxy.type.name).toBe('TestRemoteHandle');
      expect(proxy.type.respondsTo('read')).toBe(true);
      expect('read' in proxy).toBe(true);
      expect('nonExistent' in proxy).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle actor channel errors', async () => {
      mockActorChannel.sendMessage.mockRejectedValue(new Error('Network error'));
      
      const proxy = createRemoteHandleProxy(mockSerializedData, mockActorChannel);
      
      await expect(proxy.read()).rejects.toThrow('Network error');
    });

    test('should fail fast for unknown methods', () => {
      const proxy = createRemoteHandleProxy(mockSerializedData, mockActorChannel);
      
      expect(() => proxy.unknownMethod()).toThrow();
    });

    test('should handle missing type registry gracefully', () => {
      delete global.TypeHandleRegistry;
      
      expect(() => {
        remoteHandle.type;
      }).toThrow('TypeHandleRegistry not available');
      
      // Restore for other tests
      global.TypeHandleRegistry = registry;
    });
  });
});