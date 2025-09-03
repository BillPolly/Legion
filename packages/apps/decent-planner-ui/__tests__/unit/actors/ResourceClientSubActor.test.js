/**
 * Unit tests for ResourceClientSubActor  
 * TDD: Test-first implementation of client-side resource management actor
 */

import { jest } from '@jest/globals';

describe('ResourceClientSubActor', () => {
  let actor;
  let mockRemoteActor;
  let mockParentActor;
  
  beforeEach(async () => {
    mockRemoteActor = {
      receive: jest.fn()
    };
    
    mockParentActor = {
      receive: jest.fn()
    };
    
    const { ResourceClientSubActor } = await import('../../../src/client/actors/ResourceClientSubActor.js');
    actor = new ResourceClientSubActor();
  });

  describe('Actor Setup', () => {
    test('should initialize as ProtocolActor with resource protocol', () => {
      expect(actor.protocol).toBeDefined();
      expect(actor.protocol.name).toBe('ResourceClientActor');
      expect(actor.state.connected).toBe(false);
      expect(actor.proxies).toBeDefined();
      expect(actor.proxies instanceof Map).toBe(true);
    });

    test('should set remote actor and connect', async () => {
      await actor.setRemoteActor(mockRemoteActor);
      
      expect(actor.remoteActor).toBe(mockRemoteActor);
      expect(actor.state.connected).toBe(true);
    });

    test('should set parent actor', () => {
      actor.setParentActor(mockParentActor);
      
      expect(actor.parentActor).toBe(mockParentActor);
    });
  });

  describe('Resource Handle Reception', () => {
    beforeEach(async () => {
      await actor.setRemoteActor(mockRemoteActor);
      actor.setParentActor(mockParentActor);
    });

    test('should create proxy from handle metadata', async () => {
      const handleData = {
        handleId: 'test-handle-123',
        resourceType: 'FileHandle',
        methodSignatures: ['read', 'write', 'stat'],
        metadata: {
          path: '/test.txt',
          extension: '.txt',
          type: 'file'
        }
      };

      await actor.receive('resource:handle', handleData);

      // Should create and store proxy
      expect(actor.proxies.has('test-handle-123')).toBe(true);
      
      const proxy = actor.proxies.get('test-handle-123');
      expect(proxy.__handleId).toBe('test-handle-123');
      expect(proxy.__resourceType).toBe('FileHandle');
      
      // Should notify parent actor - check call structure manually to avoid Jest matcher issues
      expect(mockParentActor.receive).toHaveBeenCalledTimes(1);
      const parentCall = mockParentActor.receive.mock.calls[0];
      expect(parentCall[0]).toBe('resource:ready');
      expect(parentCall[1].path).toBe('/test.txt');
      expect(parentCall[1].handle).toBeDefined();
      expect(parentCall[1].handle.__handleId).toBe('test-handle-123');
    });

    test('should handle image handle metadata', async () => {
      const imageHandleData = {
        handleId: 'image-handle-456',
        resourceType: 'ImageHandle', 
        methodSignatures: ['getData', 'getUrl', 'getMetadata'],
        metadata: {
          path: '/image.png',
          extension: '.png',
          type: 'image'
        }
      };

      await actor.receive('resource:handle', imageHandleData);

      const proxy = actor.proxies.get('image-handle-456');
      expect(proxy.__resourceType).toBe('ImageHandle');
    });
  });

  describe('Resource Method Calls', () => {
    beforeEach(async () => {
      await actor.setRemoteActor(mockRemoteActor);
    });

    test('should route resource method calls to server actor', async () => {
      const handleId = 'test-handle-789';
      const method = 'read';
      const args = [];

      // Don't await the call (it waits for result), just trigger it
      const callPromise = actor.callResourceMethod(handleId, method, args);

      // Small delay to let the send happen
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        'resource:call',
        {
          handleId,
          method,
          args
        }
      );
      
      // Resolve the pending call to avoid hanging
      actor.receive('resource:result', { handleId, method, result: 'test result' });
      await callPromise;
    });

    test('should handle method calls with arguments', async () => {
      const handleId = 'test-handle-write';
      const method = 'write';
      const args = ['new content'];

      const callPromise = actor.callResourceMethod(handleId, method, args);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        'resource:call',
        {
          handleId,
          method,
          args
        }
      );
      
      // Resolve the pending call
      actor.receive('resource:result', { handleId, method, result: true });
      await callPromise;
    });
  });

  describe('Resource Results Handling', () => {
    beforeEach(async () => {
      await actor.setRemoteActor(mockRemoteActor);
    });

    test('should resolve pending calls on resource:result', async () => {
      const resultData = {
        handleId: 'test-handle-result',
        method: 'read',
        result: 'file content'
      };

      // Create a pending call promise
      const callPromise = actor.callResourceMethod('test-handle-result', 'read', []);

      // Small delay then simulate result coming back
      setTimeout(() => {
        actor.receive('resource:result', resultData);
      }, 10);

      // Promise should resolve with result
      const result = await callPromise;
      expect(result).toBe('file content');
    });

    test('should reject pending calls on resource:result with error', async () => {
      const errorData = {
        handleId: 'test-handle-error',
        method: 'read',
        error: 'File not found'
      };

      const callPromise = actor.callResourceMethod('test-handle-error', 'read', []);

      setTimeout(() => {
        actor.receive('resource:result', errorData);
      }, 10);

      await expect(callPromise).rejects.toThrow('File not found');
    });
  });

  describe('Handle Lifecycle', () => {
    beforeEach(async () => {
      await actor.setRemoteActor(mockRemoteActor);
    });

    test('should create proxy from serialization data', () => {
      const handleData = {
        handleId: 'proxy-test-123',
        resourceType: 'FileHandle',
        methodSignatures: ['read', 'write']
      };

      const proxy = actor.createProxyFromData(handleData);

      expect(proxy.__handleId).toBe('proxy-test-123');
      expect(proxy.__resourceType).toBe('FileHandle');
      expect(proxy.__isResourceHandle).toBe(true);
    });

    test('should release proxy when handle is released', () => {
      const handleId = 'release-test-456';
      
      // Create proxy first
      actor.proxies.set(handleId, { test: 'proxy' });
      
      actor.receive('resource:released', { handleId });
      
      expect(actor.proxies.has(handleId)).toBe(false);
    });
  });
});