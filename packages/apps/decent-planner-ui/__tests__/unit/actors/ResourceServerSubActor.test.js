/**
 * Unit tests for ResourceServerSubActor
 * TDD: Test-first implementation of server-side resource management actor
 */

import { jest } from '@jest/globals';

describe('ResourceServerSubActor', () => {
  let actor;
  let mockServices;
  let mockRemoteActor;
  let mockFileSystem;
  
  beforeEach(async () => {
    mockFileSystem = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      stat: jest.fn(),
      readdir: jest.fn(),
      mkdir: jest.fn(),
      unlink: jest.fn(),
      rmdir: jest.fn()
    };
    
    mockServices = {
      fileSystem: mockFileSystem
    };
    
    mockRemoteActor = {
      receive: jest.fn()
    };
    
    const ResourceServerSubActor = (await import('../../../src/server/actors/ResourceServerSubActor.js')).default;
    actor = new ResourceServerSubActor(mockServices);
  });

  describe('Actor Setup', () => {
    test('should initialize with services and resource manager', () => {
      expect(actor.services).toBe(mockServices);
      expect(actor.resourceManager).toBeDefined();
      expect(actor.fileSystem).toBe(mockFileSystem);
      expect(actor.remoteActor).toBeNull();
    });

    test('should set remote actor and connect', async () => {
      await actor.setRemoteActor(mockRemoteActor);
      
      expect(actor.remoteActor).toBe(mockRemoteActor);
      expect(actor.state.connected).toBe(true);
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('ready', expect.any(Object));
    });
  });

  describe('Resource Request Handling', () => {
    beforeEach(async () => {
      await actor.setRemoteActor(mockRemoteActor);
    });

    test('should create file handle for resource request', async () => {
      const requestData = { path: '/test/file.txt', type: 'file' };
      
      await actor.receive('resource:request', requestData);
      
      expect(actor.resourceManager.handles.size).toBe(1);
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        'resource:handle',
        expect.objectContaining({
          handleId: expect.any(String),
          resourceType: 'FileHandle',
          metadata: expect.objectContaining({
            path: '/test/file.txt'
          })
        })
      );
    });

    test('should create image handle for image resource request', async () => {
      const requestData = { path: '/test/image.png', type: 'image' };
      
      await actor.receive('resource:request', requestData);
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        'resource:handle',
        expect.objectContaining({
          resourceType: 'ImageHandle'
        })
      );
    });

    test('should create directory handle for directory resource request', async () => {
      const requestData = { path: '/test/dir', type: 'directory' };
      
      await actor.receive('resource:request', requestData);
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        'resource:handle',
        expect.objectContaining({
          resourceType: 'DirectoryHandle'
        })
      );
    });
  });

  describe('Resource Method Execution', () => {
    test('should execute read method on real file handle', async () => {
      await actor.setRemoteActor(mockRemoteActor);
      await actor.receive('resource:request', { path: '/test.txt', type: 'file' });
      
      const handleCall = mockRemoteActor.receive.mock.calls.find(call => call[0] === 'resource:handle');
      const testHandleId = handleCall[1].handleId;
      
      mockFileSystem.readFile.mockResolvedValue('file content');
      
      await actor.receive('resource:call', {
        handleId: testHandleId,
        method: 'read',
        args: []
      });
      
      // Small delay to ensure async completion
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockFileSystem.readFile).toHaveBeenCalledWith('/test.txt', 'utf8');
      
      // Check that we have at least 3 calls: ready, resource:handle, resource:result
      expect(mockRemoteActor.receive).toHaveBeenCalledTimes(3);
      
      // Find the resource:result call
      const resultCall = mockRemoteActor.receive.mock.calls.find(call => call[0] === 'resource:result');
      expect(resultCall).toBeDefined();
      expect(resultCall[1]).toMatchObject({
        handleId: testHandleId,
        method: 'read',
        result: 'file content'
      });
    });

    test('should execute write method on real file handle', async () => {
      await actor.setRemoteActor(mockRemoteActor);
      await actor.receive('resource:request', { path: '/test.txt', type: 'file' });
      
      const handleCall = mockRemoteActor.receive.mock.calls.find(call => call[0] === 'resource:handle');
      const testHandleId = handleCall[1].handleId;
      
      mockFileSystem.writeFile.mockResolvedValue();
      
      await actor.receive('resource:call', {
        handleId: testHandleId,
        method: 'write',
        args: ['new content']
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/test.txt', 'new content', 'utf8');
      
      const resultCall = mockRemoteActor.receive.mock.calls.find(call => call[0] === 'resource:result');
      expect(resultCall).toBeDefined();
      expect(resultCall[1]).toMatchObject({
        handleId: testHandleId,
        method: 'write',
        result: true
      });
    });

    test('should handle errors in resource method execution', async () => {
      await actor.setRemoteActor(mockRemoteActor);
      await actor.receive('resource:request', { path: '/test.txt', type: 'file' });
      
      const handleCall = mockRemoteActor.receive.mock.calls.find(call => call[0] === 'resource:handle');
      const testHandleId = handleCall[1].handleId;
      
      mockFileSystem.readFile.mockRejectedValue(new Error('File not found'));
      
      await actor.receive('resource:call', {
        handleId: testHandleId,
        method: 'read', 
        args: []
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const resultCall = mockRemoteActor.receive.mock.calls.find(call => call[0] === 'resource:result');
      expect(resultCall).toBeDefined();
      expect(resultCall[1]).toMatchObject({
        handleId: testHandleId,
        method: 'read',
        error: 'File not found'
      });
    });
  });

  describe('Handle Lifecycle', () => {
    beforeEach(async () => {
      await actor.setRemoteActor(mockRemoteActor);
    });

    test('should track created handles', async () => {
      await actor.receive('resource:request', { path: '/test1.txt', type: 'file' });
      await actor.receive('resource:request', { path: '/test2.txt', type: 'file' });
      
      expect(actor.resourceManager.handles.size).toBe(2);
    });

    test('should release handles on request', async () => {
      await actor.receive('resource:request', { path: '/test.txt', type: 'file' });
      
      const handleCall = mockRemoteActor.receive.mock.calls.find(call => call[0] === 'resource:handle');
      const handleId = handleCall[1].handleId;
      
      await actor.receive('resource:release', { handleId });
      
      expect(actor.resourceManager.getHandle(handleId)).toBeNull();
    });
  });
});