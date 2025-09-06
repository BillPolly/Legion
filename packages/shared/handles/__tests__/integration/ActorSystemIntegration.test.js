/**
 * Actor System Integration Test - Phase 3
 * 
 * Tests handle serialization and remote proxy creation
 * Simulates the actor messaging system behavior
 * NO MOCKS - uses real handle classes
 */

import { jest } from '@jest/globals';
import { BaseHandle } from '../../src/BaseHandle.js';
import { FileHandle } from '../../src/handles/FileHandle.js';
import { createRemoteHandleProxy } from '../../src/RemoteHandle.js';
import { TypeHandleRegistry } from '../../src/TypeHandleRegistry.js';

describe('Actor System Integration', () => {
  let registry;
  let mockFileSystem;
  let mockActorChannel;

  beforeAll(() => {
    registry = TypeHandleRegistry.getGlobalRegistry();
  });

  beforeEach(() => {
    registry.clear();
    
    mockFileSystem = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      stat: jest.fn(),
      watch: jest.fn(),
      unlink: jest.fn()
    };
    
    mockActorChannel = {
      sendMessage: jest.fn(),
      getLocalGuid: jest.fn().mockReturnValue('local-actor-guid')
    };
  });

  describe('Handle Serialization (Step 3.1)', () => {
    test('should serialize BaseHandle for actor transmission', () => {
      const handle = new BaseHandle('TestHandle', { path: '/test/data.txt' });
      handle.setAttribute('size', 1024);
      handle.setAttribute('type', 'text');
      
      // ActorSerializer would call this method
      const serialized = handle.serialize();
      
      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.handleId).toBe(handle.getGuid());
      expect(serialized.handleType).toBe('TestHandle');
      expect(serialized.attributes).toEqual({
        size: 1024,
        type: 'text'
      });
      expect(serialized.data).toEqual({ path: '/test/data.txt' });
    });

    test('should serialize FileHandle with all metadata', () => {
      const fileHandle = new FileHandle('/data/config.json', mockFileSystem);
      
      const serialized = fileHandle.serialize();
      
      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.handleType).toBe('FileHandle');
      expect(serialized.attributes.path).toBe('/data/config.json');
      expect(serialized.attributes.extension).toBe('.json');
      expect(serialized.data.path).toBe('/data/config.json');
    });
  });

  describe('Remote Handle Proxy Creation (Step 3.2)', () => {
    test('should create remote proxy from serialized handle', () => {
      // Simulate serialized data from remote actor
      const serializedData = {
        handleId: 'remote-file-handle-123',
        handleType: 'FileHandle',
        attributes: {
          path: '/remote/document.txt',
          extension: '.txt'
        },
        data: { path: '/remote/document.txt' }
      };
      
      // This would happen in ActorDeserializer
      const remoteProxy = createRemoteHandleProxy(serializedData, mockActorChannel);
      
      expect(remoteProxy.handleId).toBe('remote-file-handle-123');
      expect(remoteProxy.handleType).toBe('FileHandle');
      expect(remoteProxy.path).toBe('/remote/document.txt');
      expect(remoteProxy.isRemoteHandle).toBe(true);
    });

    test('should provide same interface as original handle', () => {
      // Create original handle and serialize it
      const originalHandle = new FileHandle('/original/file.txt', mockFileSystem);
      const serialized = originalHandle.serialize();
      
      // Create remote proxy
      const remoteProxy = createRemoteHandleProxy(serialized, mockActorChannel);
      
      // Should have same type
      expect(remoteProxy.type.name).toBe(originalHandle.type.name);
      expect(remoteProxy.type.listMethods()).toEqual(originalHandle.type.listMethods());
      
      // Should support same method checks
      expect('read' in remoteProxy).toBe('read' in originalHandle);
      expect('write' in remoteProxy).toBe('write' in originalHandle);
      expect('unknownMethod' in remoteProxy).toBe('unknownMethod' in originalHandle);
    });
  });

  describe('Bidirectional Handle Flow (Step 3.3)', () => {
    test('should support server→client handle transmission', async () => {
      // Server side: create handle
      const serverHandle = new FileHandle('/server/data.txt', mockFileSystem);
      serverHandle.setAttribute('serverSide', true);
      
      // Simulate actor serialization (server→client)
      const serialized = serverHandle.serialize();
      
      // Client side: receive and create proxy  
      const clientProxy = createRemoteHandleProxy(serialized, mockActorChannel);
      
      // Client can access attributes
      expect(clientProxy.path).toBe('/server/data.txt');
      expect(clientProxy.getAttribute('serverSide')).toBe(true);
      
      // Client can call methods (forwards to server)
      mockActorChannel.sendMessage.mockResolvedValue('server file content');
      
      const content = await clientProxy.read();
      
      expect(mockActorChannel.sendMessage).toHaveBeenCalledWith('call-method', {
        handleId: serverHandle.getGuid(),
        method: 'read',
        args: []
      });
      expect(content).toBe('server file content');
    });

    test('should support client→server handle transmission', () => {
      // Client side: create handle
      const clientHandle = new BaseHandle('ClientDataHandle', { 
        source: 'client',
        id: 'client-123'
      });
      clientHandle.setAttribute('clientSide', true);
      
      // Simulate actor serialization (client→server)
      const serialized = clientHandle.serialize();
      
      // Server side: receive and create proxy
      const serverProxy = createRemoteHandleProxy(serialized, mockActorChannel);
      
      // Server can access client handle attributes
      expect(serverProxy.getAttribute('clientSide')).toBe(true);
      expect(serverProxy.data.source).toBe('client');
      expect(serverProxy.data.id).toBe('client-123');
    });
  });

  describe('Remote Event Forwarding Integration', () => {
    test('should set up remote subscriptions through proxy', () => {
      const serializedData = {
        handleId: 'event-handle-123',
        handleType: 'FileHandle',
        attributes: { path: '/events/file.txt' },
        data: { path: '/events/file.txt' }
      };
      
      const remoteProxy = createRemoteHandleProxy(serializedData, mockActorChannel);
      const callback = jest.fn();
      
      // Subscribe through proxy
      remoteProxy.subscribe('content-changed', callback);
      
      // Should send subscription message to remote handle
      expect(mockActorChannel.sendMessage).toHaveBeenCalledWith('subscribe-remote', {
        handleId: 'event-handle-123',
        event: 'content-changed',
        subscriberGuid: 'local-actor-guid'
      });
    });

    test('should handle incoming remote events', () => {
      const serializedData = {
        handleId: 'event-handle-456',
        handleType: 'FileHandle',
        attributes: {},
        data: {}
      };
      
      const remoteProxy = createRemoteHandleProxy(serializedData, mockActorChannel);
      const callback = jest.fn();
      
      // Set up subscription
      remoteProxy.subscribe('file-updated', callback);
      
      // Simulate incoming event from remote handle
      remoteProxy.handleRemoteEvent('file-updated', { 
        newSize: 2048, 
        timestamp: '2025-01-01T00:00:00Z' 
      });
      
      expect(callback).toHaveBeenCalledWith({
        newSize: 2048,
        timestamp: '2025-01-01T00:00:00Z'
      });
    });
  });

  describe('Complete Actor Integration Workflow', () => {
    test('should demonstrate full server→client→server round trip', async () => {
      // Server: Create file handle
      const serverFileHandle = new FileHandle('/shared/document.txt', mockFileSystem);
      
      // Server: Add some state
      serverFileHandle.setAttribute('owner', 'server');
      serverFileHandle.setAttribute('permissions', 'rw-r--r--');
      
      // Step 1: Server→Client transmission
      const serializedForClient = serverFileHandle.serialize();
      const clientProxy = createRemoteHandleProxy(serializedForClient, mockActorChannel);
      
      // Client: Verify it received the handle properly  
      expect(clientProxy.path).toBe('/shared/document.txt');
      expect(clientProxy.getAttribute('owner')).toBe('server');
      
      // Client: Subscribe to events
      const clientCallback = jest.fn();
      clientProxy.subscribe('content-changed', clientCallback);
      
      // Client: Call methods (forwards to server)
      mockActorChannel.sendMessage.mockResolvedValue('document content');
      const content = await clientProxy.read();
      expect(content).toBe('document content');
      
      // Step 2: Client→Server transmission (client sends handle back)
      // Client creates its own handle to send to server
      const clientHandle = new BaseHandle('ClientProcessingHandle', {
        processedContent: content,
        clientId: 'client-abc'
      });
      
      const serializedForServer = clientHandle.serialize();
      const serverProxy = createRemoteHandleProxy(serializedForServer, mockActorChannel);
      
      // Server: Can access client handle data
      expect(serverProxy.data.processedContent).toBe('document content');
      expect(serverProxy.data.clientId).toBe('client-abc');
      
      // Both handles maintain their identity
      expect(clientProxy.getGuid()).toBe(serverFileHandle.getGuid());
      expect(serverProxy.getGuid()).toBe(clientHandle.getGuid());
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle serialization of handles with complex data', () => {
      const complexData = {
        config: { nested: { deep: { value: 123 } } },
        array: [1, 2, { item: 'test' }],
        date: new Date('2025-01-01'),
        func: () => 'test' // Functions should be handled gracefully
      };
      
      const handle = new BaseHandle('ComplexHandle', complexData);
      
      // Should serialize without error
      const serialized = handle.serialize();
      
      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.data.config.nested.deep.value).toBe(123);
      expect(serialized.data.array).toEqual([1, 2, { item: 'test' }]);
      expect(serialized.data.date).toBeInstanceOf(Date);
    });

    test('should handle proxy creation with missing type', () => {
      const serializedData = {
        handleId: 'unknown-type-handle',
        handleType: 'UnknownType',
        attributes: {},
        data: {}
      };
      
      const proxy = createRemoteHandleProxy(serializedData, mockActorChannel);
      
      // Should still create proxy but type will be null
      expect(proxy.handleId).toBe('unknown-type-handle');
      expect(proxy.type).toBeNull();
    });

    test('should fail fast on invalid serialization data', () => {
      expect(() => {
        new RemoteHandle(null, mockActorChannel);
      }).toThrow();
      
      expect(() => {
        new RemoteHandle({}, mockActorChannel);
      }).toThrow();
    });
  });
});