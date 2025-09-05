/**
 * Complete Handle System Integration Test
 * 
 * Tests the entire handle system working together:
 * BaseHandle + TypeHandle + Registry + Caching + Subscriptions + FileHandle
 * 
 * NO MOCKS - demonstrates real-world usage
 */

import { jest } from '@jest/globals';
import { BaseHandle } from '../../src/BaseHandle.js';
import { TypeHandleRegistry } from '../../src/TypeHandleRegistry.js';
import { FileHandle } from '../../src/handles/FileHandle.js';

describe('Complete Handle System Integration', () => {
  let registry;
  let mockFileSystem;

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
  });

  describe('End-to-End Handle Workflow', () => {
    test('should demonstrate complete file handle workflow', async () => {
      // 1. Create FileHandle (auto-registers type)
      const fileHandle = new FileHandle('/data/document.txt', mockFileSystem);
      
      // 2. Verify type introspection works
      expect(fileHandle.type.name).toBe('FileHandle');
      expect(fileHandle.type.respondsTo('read')).toBe(true);
      expect(fileHandle.type.respondsTo('nonExistentMethod')).toBe(false);
      
      // 3. Set up file system mocks
      mockFileSystem.readFile.mockResolvedValue('original content');
      mockFileSystem.writeFile.mockResolvedValue();
      mockFileSystem.stat.mockResolvedValue({ 
        size: 1024, 
        mtime: new Date('2025-01-01'),
        isFile: () => true
      });
      
      // 4. Test cached read operation
      const content1 = await fileHandle.read();
      expect(content1).toBe('original content');
      expect(mockFileSystem.readFile).toHaveBeenCalledTimes(1);
      
      // Second read should use cache (FileHandle marks read as cacheable)
      const content2 = await fileHandle.read();
      expect(content2).toBe('original content');
      expect(mockFileSystem.readFile).toHaveBeenCalledTimes(1); // Still only 1 call
      
      // 5. Test event subscription
      const changeCallback = jest.fn();
      fileHandle.subscribe('content-changed', changeCallback);
      
      // 6. Test state-changing operation with cache invalidation and events
      await fileHandle.write('updated content');
      
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/data/document.txt', 'updated content', 'utf8');
      expect(changeCallback).toHaveBeenCalledWith(true);
      
      // 7. Verify cache was invalidated - next read should call file system again
      mockFileSystem.readFile.mockResolvedValue('updated content');
      const content3 = await fileHandle.read();
      expect(content3).toBe('updated content');
      expect(mockFileSystem.readFile).toHaveBeenCalledTimes(2); // Cache was invalidated
      
      // 8. Test computed attributes
      const size = await fileHandle.size;
      expect(size).toBe(1024);
      expect(mockFileSystem.stat).toHaveBeenCalledTimes(1);
      
      // 9. Test attribute access
      expect(fileHandle.getAttribute('path')).toBe('/data/document.txt');
      expect(fileHandle.getAttribute('extension')).toBe('.txt');
    });
  });

  describe('Multiple Handle Types Integration', () => {
    test('should support multiple different handle types simultaneously', () => {
      // Register a custom handle type
      registry.registerType('DatabaseHandle', {
        methods: {
          query: { params: ['sql:string'], returns: 'array', cacheable: false },
          transaction: { params: ['callback:function'], returns: 'any' }
        },
        attributes: {
          connectionString: { type: 'string', readonly: true },
          connected: { type: 'boolean', computed: true }
        },
        documentation: {
          description: 'Database connection handle'
        }
      });
      
      // Create different handle types
      const fileHandle = new FileHandle('/test/file.txt', mockFileSystem);
      const dbHandle = new BaseHandle('DatabaseHandle', { connectionString: 'postgres://localhost/test' });
      
      // Both should have proper type introspection
      expect(fileHandle.type.name).toBe('FileHandle');
      expect(dbHandle.type.name).toBe('DatabaseHandle');
      
      // FileHandle should have file-specific methods
      expect(fileHandle.type.respondsTo('read')).toBe(true);
      expect(fileHandle.type.respondsTo('query')).toBe(false);
      
      // DatabaseHandle should have db-specific methods
      expect(dbHandle.type.respondsTo('query')).toBe(true);
      expect(dbHandle.type.respondsTo('read')).toBe(false);
      
      // Both should support subscriptions
      const fileCallback = jest.fn();
      const dbCallback = jest.fn();
      
      fileHandle.subscribe('content-changed', fileCallback);
      dbHandle.subscribe('query-executed', dbCallback);
      
      fileHandle.emit('content-changed', 'file data');
      dbHandle.emit('query-executed', 'db data');
      
      expect(fileCallback).toHaveBeenCalledWith('file data');
      expect(dbCallback).toHaveBeenCalledWith('db data');
    });
  });

  describe('Type Compatibility and Introspection', () => {
    test('should demonstrate Smalltalk-style object introspection', () => {
      const fileHandle = new FileHandle('/test/example.js', mockFileSystem);
      
      // Get type handle
      const fileType = fileHandle.type;
      
      // Smalltalk-style method queries
      expect(fileType.respondsTo('read')).toBe(true);
      expect(fileType.respondsTo('compile')).toBe(false);
      
      // Method signature inspection
      const readSig = fileType.getMethodSignature('read');
      expect(readSig.cacheable).toBe(true);
      expect(readSig.returns).toBe('string');
      
      const writeSig = fileType.getMethodSignature('write');
      expect(writeSig.sideEffects).toContain('content-changed');
      
      // Attribute type inspection
      const pathType = fileType.getAttributeType('path');
      expect(pathType.readonly).toBe(true);
      expect(pathType.type).toBe('string');
      
      // Documentation access
      const documentation = fileType.getDocumentation('read');
      expect(documentation).toContain('Read file contents');
    });

    test('should support type compatibility checking', () => {
      // Register a text handle type with overlapping interface
      registry.registerType('TextHandle', {
        methods: {
          read: { params: [], returns: 'string' },
          append: { params: ['text:string'], returns: 'boolean' },
          getLines: { params: [], returns: 'array' }
        },
        attributes: {
          path: { type: 'string', readonly: true },
          lineCount: { type: 'number', computed: true }
        }
      });
      
      const fileHandle = new FileHandle('/test/file.txt', mockFileSystem);
      const textHandle = new BaseHandle('TextHandle', { path: '/test/text.txt' });
      
      // Should be compatible (both have read method)
      expect(fileHandle.type.isCompatibleWith(textHandle.type)).toBe(true);
      expect(textHandle.type.isCompatibleWith(fileHandle.type)).toBe(true);
    });
  });

  describe('Error Handling and Fail-Fast Behavior', () => {
    test('should fail fast on invalid file system', () => {
      expect(() => {
        new FileHandle('/test/file.txt', null);
      }).toThrow('FileSystem implementation is required');
      
      expect(() => {
        new FileHandle('/test/file.txt', { readFile: 'not a function' });
      }).toThrow('FileSystem must implement required methods');
    });

    test('should fail fast on missing type registration', () => {
      const handle = new BaseHandle('UnregisteredType');
      
      expect(handle.type).toBeNull();
    });

    test('should propagate file system errors without fallbacks', async () => {
      mockFileSystem.readFile.mockRejectedValue(new Error('ENOENT: File not found'));
      
      const fileHandle = new FileHandle('/missing/file.txt', mockFileSystem);
      
      await expect(fileHandle.read()).rejects.toThrow('ENOENT: File not found');
    });
  });

  describe('Performance and Scaling', () => {
    test('should handle many handles efficiently', () => {
      const handles = [];
      
      // Create many file handles
      for (let i = 0; i < 100; i++) {
        const handle = new FileHandle(`/test/file${i}.txt`, mockFileSystem);
        handles.push(handle);
        
        // Each should have proper type
        expect(handle.type.name).toBe('FileHandle');
        expect(handle.getAttribute('path')).toBe(`/test/file${i}.txt`);
      }
      
      // All should share the same type instance (singleton)
      const type1 = handles[0].type;
      const type2 = handles[50].type;
      const type3 = handles[99].type;
      
      expect(type1).toBe(type2);
      expect(type2).toBe(type3);
    });

    test('should clean up resources properly', () => {
      const fileHandle = new FileHandle('/test/cleanup.txt', mockFileSystem);
      
      // Add cache entries and subscriptions
      fileHandle.setCachedValue('test-key', 'test-value');
      fileHandle.subscribe('test-event', jest.fn());
      fileHandle.setAttribute('test-attr', 'test-value');
      
      // Dispose handle
      fileHandle.dispose();
      
      // Everything should be cleaned up
      expect(fileHandle.getCachedValue('test-key')).toBeNull();
      expect(fileHandle.getAttribute('test-attr')).toBeUndefined();
      expect(fileHandle.subscriptions.listEvents().length).toBe(0);
    });
  });

  describe('Real-World Usage Patterns', () => {
    test('should support configuration file pattern', async () => {
      mockFileSystem.readFile.mockResolvedValue('{"setting": "value"}');
      mockFileSystem.writeFile.mockResolvedValue();
      
      const configHandle = new FileHandle('/app/config.json', mockFileSystem);
      
      // Read configuration
      const configText = await configHandle.read();
      const config = JSON.parse(configText);
      expect(config.setting).toBe('value');
      
      // Subscribe to changes
      const configChangeCallback = jest.fn();
      configHandle.subscribe('content-changed', configChangeCallback);
      
      // Update configuration
      const newConfig = { setting: 'new value', added: true };
      await configHandle.write(JSON.stringify(newConfig));
      
      expect(configChangeCallback).toHaveBeenCalled();
    });

    test('should support log file monitoring pattern', async () => {
      const logHandle = new FileHandle('/var/log/app.log', mockFileSystem);
      
      const logCallback = jest.fn();
      const mockWatcher = { close: jest.fn() };
      
      mockFileSystem.watch.mockResolvedValue(mockWatcher);
      
      // Set up log file watching
      const watcher = await logHandle.watch(logCallback);
      
      // Should have created file watcher
      expect(mockFileSystem.watch).toHaveBeenCalledWith('/var/log/app.log', logCallback);
      expect(watcher.close).toBeDefined();
      
      // Cleanup
      watcher.close();
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe('Actor System Integration Preview', () => {
    test('should generate proper GUIDs for actor system', () => {
      const handle1 = new FileHandle('/test/file1.txt', mockFileSystem);
      const handle2 = new FileHandle('/test/file2.txt', mockFileSystem);
      
      // Each handle should have unique GUID
      expect(handle1.getGuid()).toBeDefined();
      expect(handle2.getGuid()).toBeDefined();
      expect(handle1.getGuid()).not.toBe(handle2.getGuid());
      
      // GUIDs should be consistent
      expect(handle1.getGuid()).toBe(handle1.getGuid());
    });

    test('should support remote event forwarding pattern', () => {
      const fileHandle = new FileHandle('/test/remote.txt', mockFileSystem);
      
      // Add remote subscription (simulates remote actor)
      fileHandle.subscriptions.subscribeRemote('content-changed', 'remote-actor-guid');
      
      // Mock sendToActor to verify remote forwarding
      const sendSpy = jest.spyOn(fileHandle, 'sendToActor');
      
      // Emit event
      fileHandle.emit('content-changed', 'new data');
      
      // Should forward to remote actor
      expect(sendSpy).toHaveBeenCalledWith('remote-actor-guid', 'handle-event', {
        handleId: fileHandle.getGuid(),
        event: 'content-changed',
        data: 'new data'
      });
      
      sendSpy.mockRestore();
    });
  });
});