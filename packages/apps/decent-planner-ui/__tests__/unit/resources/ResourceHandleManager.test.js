/**
 * Unit tests for ResourceHandleManager
 * TDD: Test-first implementation of core handle infrastructure
 */

import { jest } from '@jest/globals';

describe('ResourceHandleManager', () => {
  let manager;
  
  beforeEach(async () => {
    // Import after setup to allow for proper ES module handling
    const { ResourceHandleManager } = await import('../../../src/shared/resources/ResourceHandleManager.js');
    manager = new ResourceHandleManager();
  });

  describe('Handle Creation', () => {
    test('should create file handle with unique ID', () => {
      const mockFileSystem = { readFile: jest.fn(), writeFile: jest.fn() };
      const filePath = '/test/file.txt';
      
      const handle = manager.createFileHandle(filePath, mockFileSystem);
      
      expect(handle).toBeDefined();
      expect(handle.handleId).toBeDefined();
      expect(typeof handle.handleId).toBe('string');
      expect(handle.path).toBe(filePath);
      expect(handle.resourceType).toBe('FileHandle');
    });

    test('should create image handle with unique ID', () => {
      const mockFileSystem = { readFile: jest.fn() };
      const imagePath = '/test/image.png';
      
      const handle = manager.createImageHandle(imagePath, mockFileSystem);
      
      expect(handle).toBeDefined();
      expect(handle.handleId).toBeDefined();
      expect(handle.path).toBe(imagePath);
      expect(handle.resourceType).toBe('ImageHandle');
    });

    test('should create directory handle with unique ID', () => {
      const mockFileSystem = { readdir: jest.fn(), mkdir: jest.fn() };
      const dirPath = '/test/dir';
      
      const handle = manager.createDirectoryHandle(dirPath, mockFileSystem);
      
      expect(handle).toBeDefined();
      expect(handle.handleId).toBeDefined();
      expect(handle.path).toBe(dirPath);
      expect(handle.resourceType).toBe('DirectoryHandle');
    });

    test('should generate unique handle IDs', () => {
      const mockFs = { readFile: jest.fn() };
      
      const handle1 = manager.createFileHandle('/file1.txt', mockFs);
      const handle2 = manager.createFileHandle('/file2.txt', mockFs);
      
      expect(handle1.handleId).not.toBe(handle2.handleId);
    });
  });

  describe('Handle Tracking', () => {
    test('should track created handles', () => {
      const mockFs = { readFile: jest.fn() };
      const handle = manager.createFileHandle('/test.txt', mockFs);
      
      manager.trackHandle(handle.handleId, handle);
      
      const retrieved = manager.getHandle(handle.handleId);
      expect(retrieved).toBe(handle);
    });

    test('should return null for unknown handle ID', () => {
      const result = manager.getHandle('unknown-id');
      expect(result).toBeNull();
    });

    test('should release tracked handles', () => {
      const mockFs = { readFile: jest.fn() };
      const handle = manager.createFileHandle('/test.txt', mockFs);
      
      manager.trackHandle(handle.handleId, handle);
      manager.releaseHandle(handle.handleId);
      
      const result = manager.getHandle(handle.handleId);
      expect(result).toBeNull();
    });
  });

  describe('Resource Type Registration', () => {
    test('should register resource types with method signatures', () => {
      const methodSignatures = ['query', 'insert', 'update'];
      
      manager.registerResourceType('DatabaseHandle', methodSignatures);
      
      const registered = manager.getResourceType('DatabaseHandle');
      expect(registered).toEqual(methodSignatures);
    });

    test('should throw error for duplicate resource type registration', () => {
      manager.registerResourceType('CustomHandle', ['method1', 'method2']);
      
      expect(() => {
        manager.registerResourceType('CustomHandle', ['method1']);
      }).toThrow('Resource type CustomHandle already registered');
    });

    test('should have built-in resource types registered', () => {
      expect(manager.getResourceType('FileHandle')).toEqual(['read', 'write', 'stat', 'watch', 'delete']);
      expect(manager.getResourceType('ImageHandle')).toEqual(['getMetadata', 'getData', 'getUrl', 'resize']);
      expect(manager.getResourceType('DirectoryHandle')).toEqual(['list', 'createFile', 'createDir', 'delete']);
    });
  });

  describe('Handle Validation', () => {
    test('should validate handle has required properties', () => {
      const validHandle = {
        handleId: 'test-id',
        resourceType: 'FileHandle',
        path: '/test.txt'
      };
      
      expect(manager.isValidHandle(validHandle)).toBe(true);
    });

    test('should reject handle missing required properties', () => {
      const invalidHandle = { handleId: 'test-id' };
      
      expect(manager.isValidHandle(invalidHandle)).toBe(false);
    });
  });
});