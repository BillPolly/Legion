/**
 * FileHandle Unit Tests
 * Test file-specific handle functionality with mock file system
 */

import { jest } from '@jest/globals';
import { FileHandle } from '../../src/handles/FileHandle.js';
import { TypeHandleRegistry } from '../../src/TypeHandleRegistry.js';

describe('FileHandle', () => {
  let fileHandle;
  let mockFileSystem;
  let registry;

  beforeEach(() => {
    registry = new TypeHandleRegistry();
    global.TypeHandleRegistry = registry;
    
    mockFileSystem = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      stat: jest.fn(),
      watch: jest.fn(),
      unlink: jest.fn()
    };
    
    fileHandle = new FileHandle('/test/file.txt', mockFileSystem);
  });

  describe('Initialization', () => {
    test('should extend BaseHandle', () => {
      expect(fileHandle.isActor).toBe(true);
      expect(fileHandle.handleType).toBe('FileHandle');
    });

    test('should initialize with file path and file system', () => {
      expect(fileHandle.data.path).toBe('/test/file.txt');
      expect(fileHandle.fileSystem).toBe(mockFileSystem);
    });

    test('should set file-specific attributes', () => {
      expect(fileHandle.getAttribute('path')).toBe('/test/file.txt');
      expect(fileHandle.getAttribute('extension')).toBe('.txt');
    });

    test('should register FileHandle type automatically', () => {
      expect(registry.hasType('FileHandle')).toBe(true);
      
      const type = registry.getTypeHandle('FileHandle');
      expect(type.listMethods()).toContain('read');
      expect(type.listMethods()).toContain('write');
      expect(type.listMethods()).toContain('stat');
      expect(type.listMethods()).toContain('watch');
    });
  });

  describe('File Operations', () => {
    test('should read file content', async () => {
      mockFileSystem.readFile.mockResolvedValue('file content');
      
      const content = await fileHandle.read();
      
      expect(mockFileSystem.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf8');
      expect(content).toBe('file content');
    });

    test('should write file content and emit event', async () => {
      mockFileSystem.writeFile.mockResolvedValue();
      const changeCallback = jest.fn();
      
      fileHandle.subscribe('content-changed', changeCallback);
      
      const result = await fileHandle.write('new content');
      
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/test/file.txt', 'new content', 'utf8');
      expect(result).toBe(true);
      expect(changeCallback).toHaveBeenCalledWith(true);
    });

    test('should get file statistics', async () => {
      const mockStats = { size: 1024, mtime: new Date() };
      mockFileSystem.stat.mockResolvedValue(mockStats);
      
      const stats = await fileHandle.stat();
      
      expect(mockFileSystem.stat).toHaveBeenCalledWith('/test/file.txt');
      expect(stats).toBe(mockStats);
    });

    test('should delete file', async () => {
      mockFileSystem.unlink.mockResolvedValue(true);
      
      const result = await fileHandle.delete();
      
      expect(mockFileSystem.unlink).toHaveBeenCalledWith('/test/file.txt');
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors', async () => {
      mockFileSystem.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(fileHandle.read()).rejects.toThrow('File not found');
    });

    test('should fail fast with invalid file system', () => {
      expect(() => {
        new FileHandle('/test/file.txt', null);
      }).toThrow('FileSystem implementation is required');
      
      expect(() => {
        new FileHandle('/test/file.txt', {});
      }).toThrow('FileSystem must implement required methods');
    });
  });
});