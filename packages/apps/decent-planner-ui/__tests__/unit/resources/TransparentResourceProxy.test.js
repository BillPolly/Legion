/**
 * Unit tests for TransparentResourceProxy
 * TDD: Test-first implementation of transparent resource proxy using JavaScript Proxy API
 */

import { jest } from '@jest/globals';

describe('TransparentResourceProxy', () => {
  let mockActorChannel;
  
  beforeEach(() => {
    mockActorChannel = {
      callResourceMethod: jest.fn()
    };
  });

  describe('Proxy Creation', () => {
    test('should create proxy with handle metadata', async () => {
      const { TransparentResourceProxy } = await import('../../../src/shared/resources/TransparentResourceProxy.js');
      
      const handleId = 'test-handle-123';
      const resourceType = 'FileHandle';
      const methodSignatures = ['read', 'write', 'stat'];
      
      const proxy = new TransparentResourceProxy(
        handleId,
        resourceType, 
        methodSignatures,
        mockActorChannel
      );
      
      expect(proxy.__handleId).toBe(handleId);
      expect(proxy.__resourceType).toBe(resourceType);
      expect(proxy.__isResourceHandle).toBe(true);
    });

    test('should proxy method calls to actor channel', async () => {
      const { TransparentResourceProxy } = await import('../../../src/shared/resources/TransparentResourceProxy.js');
      
      mockActorChannel.callResourceMethod.mockResolvedValue('file content');
      
      const proxy = new TransparentResourceProxy(
        'test-handle',
        'FileHandle',
        ['read', 'write'],
        mockActorChannel
      );
      
      const result = await proxy.read();
      
      expect(mockActorChannel.callResourceMethod).toHaveBeenCalledWith(
        'test-handle',
        'read', 
        []
      );
      expect(result).toBe('file content');
    });

    test('should proxy method calls with arguments', async () => {
      const { TransparentResourceProxy } = await import('../../../src/shared/resources/TransparentResourceProxy.js');
      
      mockActorChannel.callResourceMethod.mockResolvedValue(true);
      
      const proxy = new TransparentResourceProxy(
        'test-handle',
        'FileHandle',
        ['read', 'write'], 
        mockActorChannel
      );
      
      await proxy.write('new content');
      
      expect(mockActorChannel.callResourceMethod).toHaveBeenCalledWith(
        'test-handle',
        'write',
        ['new content']
      );
    });

    test('should return original property for non-method properties', async () => {
      const { TransparentResourceProxy } = await import('../../../src/shared/resources/TransparentResourceProxy.js');
      
      const proxy = new TransparentResourceProxy(
        'test-handle',
        'FileHandle',
        ['read'],
        mockActorChannel
      );
      
      expect(proxy.__handleId).toBe('test-handle');
      expect(proxy.__resourceType).toBe('FileHandle');
      expect(proxy.__isResourceHandle).toBe(true);
    });

    test('should throw error for unknown method calls', async () => {
      const { TransparentResourceProxy } = await import('../../../src/shared/resources/TransparentResourceProxy.js');
      
      const proxy = new TransparentResourceProxy(
        'test-handle',
        'FileHandle',
        ['read'], // 'write' not in signatures
        mockActorChannel
      );
      
      expect(() => proxy.write).toThrow('Method write not available on FileHandle');
    });
  });

  describe('Error Handling', () => {
    test('should propagate errors from actor channel', async () => {
      const { TransparentResourceProxy } = await import('../../../src/shared/resources/TransparentResourceProxy.js');
      
      const error = new Error('Network failure');
      mockActorChannel.callResourceMethod.mockRejectedValue(error);
      
      const proxy = new TransparentResourceProxy(
        'test-handle',
        'FileHandle',
        ['read'],
        mockActorChannel
      );
      
      await expect(proxy.read()).rejects.toThrow('Network failure');
    });

    test('should fail fast when actor channel is null', async () => {
      const { TransparentResourceProxy } = await import('../../../src/shared/resources/TransparentResourceProxy.js');
      
      expect(() => {
        new TransparentResourceProxy('test-handle', 'FileHandle', ['read'], null);
      }).toThrow('Actor channel is required for resource proxy');
    });
  });

  describe('Handle Serialization Support', () => {
    test('should provide serialization metadata', async () => {
      const { TransparentResourceProxy } = await import('../../../src/shared/resources/TransparentResourceProxy.js');
      
      const proxy = new TransparentResourceProxy(
        'test-handle-456',
        'ImageHandle', 
        ['getData', 'getUrl'],
        mockActorChannel
      );
      
      const metadata = proxy.getSerializationData();
      
      expect(metadata).toEqual({
        handleId: 'test-handle-456',
        resourceType: 'ImageHandle',
        methodSignatures: ['getData', 'getUrl']
      });
    });
  });
});