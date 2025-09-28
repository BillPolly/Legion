/**
 * Unit Tests for FileHandle
 * 
 * Tests the FileHandle class functionality with mock DataSource
 */

import { FileHandle } from '../../src/handles/index.js';
import { Handle } from '@legion/handle';
import { jest } from '@jest/globals';

// Mock DataSource for testing
class MockDataSource {
  constructor() {
    this.data = new Map();
    this.subscribers = [];
    this.nextId = 1;
  }
  
  queryBuilder(sourceHandle) {
    // Return a simple query builder that just forwards queries
    return {
      query: (querySpec) => this.query(querySpec)
    };
  }
  
  query(querySpec) {
    // Mock query implementation
    if (querySpec.find && querySpec.where) {
      const where = querySpec.where;
      
      for (const clause of where) {
        if (Array.isArray(clause) && clause.length >= 3) {
          const [subject, predicate, object] = clause;
          
          // Handle new query patterns: ['file', path, 'metadata'] and ['file', path, 'content']
          if (subject === 'file' && object === 'metadata') {
            return [{
              path: predicate,
              type: 'file',
              exists: true,
              size: 1024,
              lastModified: new Date('2023-01-01T12:00:00Z').toISOString(),
              created: new Date('2023-01-01T10:00:00Z').toISOString(),
              permissions: { readable: true, writable: true, executable: false },
              isDirectory: false,
              isFile: true
            }];
          } else if (subject === 'file' && object === 'content') {
            // Mock file content based on encoding
            const encoding = querySpec.options?.encoding;
            if (encoding === null) {
              // Binary data
              return [new Uint8Array([72, 101, 108, 108, 111])]; // "Hello" in binary
            } else if (encoding === 'utf8' || !encoding) {
              // Text content
              return ['Hello World\nThis is test content'];
            }
          } else if (subject === 'file' && object === 'readStream') {
            // Mock readable stream
            return [{
              read: jest.fn(),
              on: jest.fn(),
              pipe: jest.fn(),
              destroy: jest.fn()
            }];
          } else if (subject === 'file' && object === 'writeStream') {
            // Mock writable stream
            return [{
              write: jest.fn(),
              end: jest.fn(),
              on: jest.fn(),
              destroy: jest.fn()
            }];
          }
          
          // Handle legacy patterns
          if (predicate === 'metadata') {
            return [{
              path: subject || object || '/test.txt',
              type: 'file',
              exists: true,
              size: 1024,
              lastModified: new Date('2023-01-01T12:00:00Z').toISOString(),
              created: new Date('2023-01-01T10:00:00Z').toISOString(),
              permissions: { readable: true, writable: true, executable: false },
              isDirectory: false,
              isFile: true
            }];
          } else if (predicate === 'content') {
            // Mock file content based on encoding
            const encoding = querySpec.options?.encoding;
            if (encoding === null) {
              // Binary data
              return [new Uint8Array([72, 101, 108, 108, 111])]; // "Hello" in binary
            } else if (encoding === 'utf8' || !encoding) {
              // Text content
              return ['Hello World\nThis is test content'];
            }
          } else if (predicate === 'readStream') {
            // Mock readable stream
            return [{
              read: jest.fn(),
              on: jest.fn(),
              pipe: jest.fn(),
              destroy: jest.fn()
            }];
          } else if (predicate === 'writeStream') {
            // Mock writable stream
            return [{
              write: jest.fn(),
              end: jest.fn(),
              on: jest.fn(),
              destroy: jest.fn()
            }];
          }
        }
      }
    }
    
    return [];
  }
  
  update(path, data) {
    // Mock update implementation
    const operation = data.operation || data.type;
    
    if (operation === 'write') {
      return {
        success: true,
        path: path,
        size: data.content ? data.content.length : 0
      };
    } else if (operation === 'copy') {
      return {
        success: true,
        source: data.source,
        target: data.target
      };
    } else if (operation === 'move') {
      return {
        success: true,
        oldPath: path,
        newPath: data.target
      };
    } else if (operation === 'delete') {
      return {
        success: true,
        path: path
      };
    }
    
    return { success: true };
  }
  
  subscribe(querySpec, callback) {
    const subscription = {
      id: this.nextId++,
      querySpec,
      callback,
      unsubscribe: () => {
        const index = this.subscribers.indexOf(subscription);
        if (index > -1) this.subscribers.splice(index, 1);
      }
    };
    
    this.subscribers.push(subscription);
    return subscription;
  }
  
  getSchema() {
    return {
      version: '1.0.0',
      type: 'mock',
      capabilities: { read: true, write: true, watch: true, streams: true }
    };
  }
}

describe('FileHandle', () => {
  let mockDataSource;
  let fileHandle;
  
  beforeEach(() => {
    mockDataSource = new MockDataSource();
    fileHandle = new FileHandle(mockDataSource, '/test/file.txt');
  });
  
  afterEach(() => {
    if (fileHandle && !fileHandle.isDestroyed()) {
      fileHandle.destroy();
    }
  });
  
  describe('Constructor', () => {
    test('should extend Handle', () => {
      expect(fileHandle).toBeInstanceOf(Handle);
    });
    
    test('should initialize with dataSource and path', () => {
      expect(fileHandle.dataSource).toBe(mockDataSource);
      expect(fileHandle.path).toBe('/test/file.txt');
    });
    
    test('should set correct handle type', () => {
      expect(fileHandle.handleType).toBe('FileHandle');
    });
    
    test('should normalize path correctly', () => {
      const file1 = new FileHandle(mockDataSource, 'test.txt');
      expect(file1.path).toBe('/test.txt');
      
      const file2 = new FileHandle(mockDataSource, '\\test\\file.txt');
      expect(file2.path).toBe('/test/file.txt');
      
      file1.destroy();
      file2.destroy();
    });
    
    test('should throw error for missing path', () => {
      expect(() => {
        new FileHandle(mockDataSource, '');
      }).toThrow('File path is required and must be a string');
      
      expect(() => {
        new FileHandle(mockDataSource, null);
      }).toThrow('File path is required and must be a string');
    });
    
    test('should throw error for missing dataSource', () => {
      expect(() => {
        new FileHandle(null, '/test.txt');
      }).toThrow('DataSource must be a non-null object');
    });
  });
  
  describe('Handle Integration', () => {
    test('should have Actor capabilities from Handle', () => {
      expect(typeof fileHandle.receive).toBe('function');
      expect(typeof fileHandle.call).toBe('function');
      expect(typeof fileHandle.query).toBe('function');
    });
    
    test('should have Handle lifecycle capabilities', () => {
      expect(typeof fileHandle.subscribe).toBe('function');
      expect(typeof fileHandle.destroy).toBe('function');
      expect(typeof fileHandle.isDestroyed).toBe('function');
    });
    
    test('should be an instance of Actor', () => {
      expect(fileHandle.isActor).toBe(true);
    });
  });
  
  describe('File Metadata Operations', () => {
    describe('value()', () => {
      test('should return file metadata', () => {
        const metadata = fileHandle.value();
        
        expect(metadata).toEqual(expect.objectContaining({
          path: '/test/file.txt',
          type: 'file',
          exists: true,
          isFile: true,
          isDirectory: false,
          size: 1024
        }));
      });
      
      test('should cache metadata by default', () => {
        const spy = jest.spyOn(mockDataSource, 'query');
        
        fileHandle.value(); // First call
        fileHandle.value(); // Second call (should use cache)
        
        expect(spy).toHaveBeenCalledTimes(1);
      });
      
      test('should bypass cache when fresh=true', () => {
        const spy = jest.spyOn(mockDataSource, 'query');
        
        fileHandle.value(); // First call
        fileHandle.value(true); // Second call with fresh=true
        
        expect(spy).toHaveBeenCalledTimes(2);
      });
    });
    
    describe('exists()', () => {
      test('should return true for existing file', () => {
        expect(fileHandle.exists()).toBe(true);
      });
    });
    
    describe('size()', () => {
      test('should return file size', () => {
        expect(fileHandle.size()).toBe(1024);
      });
    });
    
    describe('lastModified()', () => {
      test('should return modification date', () => {
        const lastMod = fileHandle.lastModified();
        expect(lastMod).toBeInstanceOf(Date);
        expect(lastMod.toISOString()).toBe('2023-01-01T12:00:00.000Z');
      });
    });
  });
  
  describe('File Content Operations', () => {
    describe('read()', () => {
      test('should read file content as text by default', () => {
        const content = fileHandle.read();
        expect(content).toBe('Hello World\nThis is test content');
      });
      
      test('should read with specific encoding', () => {
        const content = fileHandle.read({ encoding: 'utf8' });
        expect(content).toBe('Hello World\nThis is test content');
      });
      
      test('should read binary data when encoding is null', () => {
        const content = fileHandle.read({ encoding: null });
        expect(content).toBeInstanceOf(Uint8Array);
        expect(Array.from(content)).toEqual([72, 101, 108, 108, 111]);
      });
      
      test('should support read options', () => {
        const spy = jest.spyOn(mockDataSource, 'query');
        
        fileHandle.read({ offset: 10, length: 5 });
        
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
          options: expect.objectContaining({
            offset: 10,
            length: 5
          })
        }));
      });
      
      test('should throw error for missing file', () => {
        const errorDataSource = {
          query: () => [],
          getSchema: () => ({ version: '1.0.0' }),
          update: () => ({ success: true }),
          subscribe: () => ({ id: 1, unsubscribe: () => {} }),
          queryBuilder: () => ({ query: (querySpec) => [] })
        };
        
        const errorFile = new FileHandle(errorDataSource, '/missing.txt');
        
        expect(() => errorFile.read()).toThrow('File not found: /missing.txt');
        
        errorFile.destroy();
      });
    });
    
    describe('text()', () => {
      test('should read file as text', () => {
        const content = fileHandle.text();
        expect(content).toBe('Hello World\nThis is test content');
      });
      
      test('should use specified encoding', () => {
        const spy = jest.spyOn(fileHandle, 'read').mockReturnValue('mocked content');
        
        fileHandle.text('ascii');
        
        expect(spy).toHaveBeenCalledWith({ encoding: 'ascii' });
        
        spy.mockRestore();
      });
    });
    
    describe('binary()', () => {
      test('should read file as binary data', () => {
        const content = fileHandle.binary();
        expect(content).toBeInstanceOf(Uint8Array);
      });
    });
    
    describe('json()', () => {
      test('should parse JSON content', () => {
        // Mock JSON content
        const jsonDataSource = {
          query: () => ['{"name": "test", "value": 42}'],
          getSchema: () => ({ version: '1.0.0' }),
          update: () => ({ success: true }),
          subscribe: () => ({ id: 1, unsubscribe: () => {} }),
          queryBuilder: () => ({ query: (querySpec) => ['{"name": "test", "value": 42}'] })
        };
        
        const jsonFile = new FileHandle(jsonDataSource, '/data.json');
        const data = jsonFile.json();
        
        expect(data).toEqual({ name: 'test', value: 42 });
        
        jsonFile.destroy();
      });
      
      test('should throw error for invalid JSON', () => {
        // Mock invalid JSON content
        const invalidJsonDataSource = {
          query: () => ['{ invalid json }'],
          getSchema: () => ({ version: '1.0.0' }),
          update: () => ({ success: true }),
          subscribe: () => ({ id: 1, unsubscribe: () => {} }),
          queryBuilder: () => ({ query: (querySpec) => ['{ invalid json }'] })
        };
        
        const invalidJsonFile = new FileHandle(invalidJsonDataSource, '/invalid.json');
        
        expect(() => invalidJsonFile.json()).toThrow('Failed to parse JSON from /invalid.json');
        
        invalidJsonFile.destroy();
      });
    });
  });
  
  describe('File Writing Operations', () => {
    describe('write()', () => {
      test('should write string content', () => {
        const result = fileHandle.write('New content');
        
        expect(result).toEqual(expect.objectContaining({
          success: true,
          path: '/test/file.txt'
        }));
      });
      
      test('should write with options', () => {
        const spy = jest.spyOn(mockDataSource, 'update');
        
        fileHandle.write('Content', { encoding: 'utf8', append: true });
        
        expect(spy).toHaveBeenCalledWith('/test/file.txt', expect.objectContaining({
          operation: 'write',
          content: 'Content',
          options: expect.objectContaining({
            encoding: 'utf8',
            append: true
          })
        }));
      });
      
      test('should invalidate metadata cache after write', () => {
        // Prime the cache
        fileHandle.value();
        expect(fileHandle._metadataCache).toBeTruthy();
        
        // Write to file
        fileHandle.write('New content');
        
        // Cache should be invalidated
        expect(fileHandle._metadataCache).toBeNull();
      });
      
      test('should throw error for null/undefined content', () => {
        expect(() => fileHandle.write(null)).toThrow('Content to write cannot be null or undefined');
        expect(() => fileHandle.write(undefined)).toThrow('Content to write cannot be null or undefined');
      });
    });
    
    describe('append()', () => {
      test('should append content to file', () => {
        const spy = jest.spyOn(fileHandle, 'write');
        
        fileHandle.append('Additional content');
        
        expect(spy).toHaveBeenCalledWith('Additional content', { append: true });
      });
    });
  });
  
  describe('File Operations', () => {
    describe('copy()', () => {
      test('should copy file to target path', () => {
        const targetFile = fileHandle.copy('/backup/file.txt');
        
        expect(targetFile).toBeInstanceOf(FileHandle);
        expect(targetFile.path).toBe('/backup/file.txt');
        
        targetFile.destroy();
      });
      
      test('should copy with options', () => {
        const spy = jest.spyOn(mockDataSource, 'update');
        
        fileHandle.copy('/backup/file.txt', { overwrite: true });
        
        expect(spy).toHaveBeenCalledWith(null, expect.objectContaining({
          operation: 'copy',
          source: '/test/file.txt',
          target: '/backup/file.txt',
          options: expect.objectContaining({
            overwrite: true
          })
        }));
      });
      
      test('should throw error for invalid target path', () => {
        expect(() => fileHandle.copy('')).toThrow('Target path must be a non-empty string');
        expect(() => fileHandle.copy(null)).toThrow('Target path must be a non-empty string');
      });
      
      test('should throw error when copy fails', () => {
        const errorDataSource = {
          update: () => ({ success: false, error: 'Copy failed' }),
          getSchema: () => ({ version: '1.0.0' }),
          query: () => [],
          subscribe: () => ({ id: 1, unsubscribe: () => {} }),
          queryBuilder: () => ({ query: (querySpec) => [] })
        };
        
        const errorFile = new FileHandle(errorDataSource, '/test.txt');
        
        expect(() => errorFile.copy('/backup.txt')).toThrow('Failed to copy file: Copy failed');
        
        errorFile.destroy();
      });
    });
    
    describe('move()', () => {
      test('should move file to target path', () => {
        const result = fileHandle.move('/moved/file.txt');
        
        expect(result).toBe(fileHandle); // Returns same instance
        expect(fileHandle.path).toBe('/moved/file.txt');
      });
      
      test('should invalidate cache after move', () => {
        // Prime the cache
        fileHandle.value();
        expect(fileHandle._metadataCache).toBeTruthy();
        
        // Move file
        fileHandle.move('/moved/file.txt');
        
        // Cache should be invalidated
        expect(fileHandle._metadataCache).toBeNull();
      });
    });
    
    describe('delete()', () => {
      test('should delete file', () => {
        const result = fileHandle.delete();
        
        expect(result).toEqual(expect.objectContaining({
          success: true,
          path: '/test/file.txt'
        }));
      });
      
      test('should delete with options', () => {
        const spy = jest.spyOn(mockDataSource, 'update');
        
        fileHandle.delete({ force: true });
        
        expect(spy).toHaveBeenCalledWith('/test/file.txt', expect.objectContaining({
          operation: 'delete',
          options: { force: true }
        }));
      });
    });
  });
  
  describe('File Navigation', () => {
    describe('parent()', () => {
      test('should return parent DirectoryHandle', () => {
        const parentHandle = fileHandle.parent();
        
        expect(parentHandle.handleType).toBe('DirectoryHandle');
        expect(parentHandle.path).toBe('/test');
        
        parentHandle.destroy();
      });
      
      test('should return root for file in root', () => {
        const rootFile = new FileHandle(mockDataSource, '/root.txt');
        const parentHandle = rootFile.parent();
        
        expect(parentHandle.path).toBe('/');
        
        rootFile.destroy();
        parentHandle.destroy();
      });
    });
    
    describe('name()', () => {
      test('should return file name', () => {
        expect(fileHandle.name()).toBe('file.txt');
      });
      
      test('should handle file in root', () => {
        const rootFile = new FileHandle(mockDataSource, '/root.txt');
        expect(rootFile.name()).toBe('root.txt');
        rootFile.destroy();
      });
    });
    
    describe('extension()', () => {
      test('should return file extension', () => {
        expect(fileHandle.extension()).toBe('.txt');
      });
      
      test('should return empty string for no extension', () => {
        const noExtFile = new FileHandle(mockDataSource, '/test/README');
        expect(noExtFile.extension()).toBe('');
        noExtFile.destroy();
      });
      
      test('should handle multiple dots', () => {
        const multiDotFile = new FileHandle(mockDataSource, '/test/file.tar.gz');
        expect(multiDotFile.extension()).toBe('.gz');
        multiDotFile.destroy();
      });
    });
    
    describe('basename()', () => {
      test('should return filename without extension', () => {
        expect(fileHandle.basename()).toBe('file');
      });
      
      test('should return full name if no extension', () => {
        const noExtFile = new FileHandle(mockDataSource, '/test/README');
        expect(noExtFile.basename()).toBe('README');
        noExtFile.destroy();
      });
    });
  });
  
  describe('File Streams', () => {
    describe('createReadStream()', () => {
      test('should create readable stream', () => {
        const stream = fileHandle.createReadStream();
        
        expect(stream).toEqual(expect.objectContaining({
          read: expect.any(Function),
          on: expect.any(Function),
          pipe: expect.any(Function)
        }));
      });
      
      test('should create stream with options', () => {
        const spy = jest.spyOn(mockDataSource, 'query');
        
        fileHandle.createReadStream({ encoding: 'utf8', start: 10, end: 100 });
        
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
          options: expect.objectContaining({
            encoding: 'utf8',
            start: 10,
            end: 100
          })
        }));
      });
    });
    
    describe('createWriteStream()', () => {
      test('should create writable stream', () => {
        const stream = fileHandle.createWriteStream();
        
        expect(stream).toEqual(expect.objectContaining({
          write: expect.any(Function),
          end: expect.any(Function),
          on: expect.any(Function)
        }));
      });
    });
  });
  
  describe('File Watching', () => {
    describe('watch()', () => {
      test('should create file watcher', () => {
        const callback = jest.fn();
        const subscription = fileHandle.watch(callback);
        
        expect(subscription).toEqual(expect.objectContaining({
          id: expect.any(Number),
          unsubscribe: expect.any(Function)
        }));
        
        subscription.unsubscribe();
      });
      
      test('should watch with options', () => {
        const spy = jest.spyOn(mockDataSource, 'subscribe');
        const callback = jest.fn();
        
        fileHandle.watch(callback, { content: true, metadata: false });
        
        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            find: ['event', 'data'],
            where: expect.arrayContaining([
              ['file', '/test/file.txt', 'change']
            ]),
            watchContent: true
          }),
          expect.any(Function)
        );
      });
      
      test('should invalidate cache on file change', () => {
        const callback = jest.fn();
        
        // Prime the cache
        fileHandle.value();
        expect(fileHandle._metadataCache).toBeTruthy();
        
        // Set up watcher
        const subscription = fileHandle.watch(callback);
        
        // Simulate file change by calling the callback
        const watchCallback = mockDataSource.subscribers[0].callback;
        watchCallback([{ event: 'change', path: '/test/file.txt' }]);
        
        // Cache should be invalidated
        expect(fileHandle._metadataCache).toBeNull();
        
        subscription.unsubscribe();
      });
      
      test('should validate callback', () => {
        expect(() => fileHandle.watch(null)).toThrow('Watch callback must be a function');
        expect(() => fileHandle.watch('invalid')).toThrow('Watch callback must be a function');
      });
    });
  });
  
  describe('Error Handling', () => {
    test('should handle data source errors gracefully', () => {
      const errorDataSource = {
        query() {
          throw new Error('Query failed');
        },
        update() {
          throw new Error('Update failed');
        },
        subscribe() {
          return { id: 'test', unsubscribe: () => {} };
        },
        getSchema() {
          return { version: '1.0.0' };
        },
        queryBuilder() {
          return { query: (querySpec) => this.query(querySpec) };
        }
      };
      
      const errorFile = new FileHandle(errorDataSource, '/test.txt');
      
      expect(() => errorFile.value()).toThrow('Query failed');
      expect(() => errorFile.read()).toThrow('Query failed');
      expect(() => errorFile.write('content')).toThrow('Update failed');
      
      errorFile.destroy();
    });
    
    test('should throw error when used after destruction', () => {
      fileHandle.destroy();
      
      expect(() => fileHandle.value()).toThrow('Handle has been destroyed');
      expect(() => fileHandle.read()).toThrow('Handle has been destroyed');
      expect(() => fileHandle.write('content')).toThrow('Handle has been destroyed');
      expect(() => fileHandle.watch(() => {})).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Cleanup and Destruction', () => {
    test('should be safe to call destroy multiple times', () => {
      fileHandle.destroy();
      fileHandle.destroy(); // Should not throw
      
      expect(fileHandle.isDestroyed()).toBe(true);
    });
    
    test('should clean up metadata cache on destroy', () => {
      // Prime the cache
      fileHandle.value();
      expect(fileHandle._metadataCache).toBeTruthy();
      
      // Destroy handle
      fileHandle.destroy();
      
      expect(fileHandle.isDestroyed()).toBe(true);
    });
  });
});