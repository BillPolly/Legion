/**
 * Unit Tests for DirectoryHandle
 * 
 * Tests the DirectoryHandle class functionality with mock DataSource
 */

import { DirectoryHandle } from '../../src/handles/index.js';
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
      
      // Look for parent clause and matches clause for search queries
      const parentClause = where.find(clause => 
        Array.isArray(clause) && clause.length >= 2 && clause[0] === 'parent'
      );
      
      const matchesClause = where.find(clause => 
        Array.isArray(clause) && clause.length >= 3 && clause[1] === 'matches'
      );
      
      if (parentClause && matchesClause) {
        // This is a search query - return filtered results based on pattern
        const pattern = matchesClause[2];
        if (pattern === '*.txt') {
          return [
            { name: 'test.txt', path: '/test/test.txt', type: 'file', metadata: {} }
          ];
        }
        // For other patterns, return empty results
        return [];
      }
      
      if (parentClause) {
        // Mock directory listing for new parent clause pattern
        const path = parentClause[1];
        return [
          { name: 'file1.txt', path: `${path}/file1.txt`, type: 'file', metadata: {} },
          { name: 'file2.js', path: `${path}/file2.js`, type: 'file', metadata: {} },
          { name: 'subdir', path: `${path}/subdir`, type: 'directory', metadata: {} }
        ];
      }
      
      for (const clause of where) {
        if (Array.isArray(clause) && clause.length >= 3) {
          const [subject, predicate, object] = clause;
          
          // Handle new query patterns: ['directory', path, 'metadata'] and ['file', path, 'metadata']
          if ((subject === 'directory' || subject === 'file') && object === 'metadata') {
            return [{
              path: predicate,
              type: subject,
              exists: true,
              size: subject === 'directory' ? 4096 : 1024,
              lastModified: new Date().toISOString(),
              created: new Date().toISOString(),
              permissions: { readable: true, writable: true, executable: subject === 'directory' },
              isDirectory: subject === 'directory',
              isFile: subject === 'file'
            }];
          }
          
          // Handle legacy patterns
          if (predicate === 'metadata') {
            return [{
              path: subject || object || '/',
              type: 'directory',
              exists: true,
              size: 4096,
              lastModified: new Date().toISOString(),
              created: new Date().toISOString(),
              permissions: { readable: true, writable: true, executable: true },
              isDirectory: true,
              isFile: false
            }];
          } else if (subject === 'parent') {
            // Legacy parent pattern fallback
            const path = predicate;
            return [
              { name: 'file1.txt', path: `${path}/file1.txt`, type: 'file', metadata: {} },
              { name: 'file2.js', path: `${path}/file2.js`, type: 'file', metadata: {} },
              { name: 'subdir', path: `${path}/subdir`, type: 'directory', metadata: {} }
            ];
          } else if (predicate === 'matches') {
            // Mock search results
            return [
              { name: 'test.txt', path: '/test.txt', type: 'file', metadata: {} }
            ];
          }
        }
      }
    }
    
    return [];
  }
  
  update(path, data) {
    // Mock update implementation
    return {
      success: true,
      path: data.path || path
    };
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
      capabilities: { read: true, write: true, watch: true, search: true }
    };
  }
}

describe('DirectoryHandle', () => {
  let mockDataSource;
  let directoryHandle;
  
  beforeEach(() => {
    mockDataSource = new MockDataSource();
    directoryHandle = new DirectoryHandle(mockDataSource, '/test');
  });
  
  afterEach(() => {
    if (directoryHandle && !directoryHandle.isDestroyed()) {
      directoryHandle.destroy();
    }
  });
  
  describe('Constructor', () => {
    test('should extend Handle', () => {
      expect(directoryHandle).toBeInstanceOf(Handle);
    });
    
    test('should initialize with dataSource and path', () => {
      expect(directoryHandle.dataSource).toBe(mockDataSource);
      expect(directoryHandle.path).toBe('/test');
    });
    
    test('should set correct handle type', () => {
      expect(directoryHandle.handleType).toBe('DirectoryHandle');
    });
    
    test('should normalize path correctly', () => {
      const dir1 = new DirectoryHandle(mockDataSource, 'test');
      expect(dir1.path).toBe('/test');
      
      const dir2 = new DirectoryHandle(mockDataSource, '/test/');
      expect(dir2.path).toBe('/test');
      
      const dir3 = new DirectoryHandle(mockDataSource, '');
      expect(dir3.path).toBe('/');
      
      dir1.destroy();
      dir2.destroy();
      dir3.destroy();
    });
    
    test('should throw error for missing dataSource', () => {
      expect(() => {
        new DirectoryHandle(null, '/test');
      }).toThrow('DataSource must be a non-null object');
    });
  });
  
  describe('Handle Integration', () => {
    test('should have Actor capabilities from Handle', () => {
      expect(typeof directoryHandle.receive).toBe('function');
      expect(typeof directoryHandle.call).toBe('function');
      expect(typeof directoryHandle.query).toBe('function');
    });
    
    test('should have Handle lifecycle capabilities', () => {
      expect(typeof directoryHandle.subscribe).toBe('function');
      expect(typeof directoryHandle.destroy).toBe('function');
      expect(typeof directoryHandle.isDestroyed).toBe('function');
    });
    
    test('should be an instance of Actor', () => {
      expect(directoryHandle.isActor).toBe(true);
    });
  });
  
  describe('Directory Operations', () => {
    describe('value()', () => {
      test('should return directory metadata', () => {
        const metadata = directoryHandle.value();
        
        expect(metadata).toEqual(expect.objectContaining({
          path: '/test',
          type: 'directory',
          exists: true,
          isDirectory: true,
          isFile: false
        }));
      });
    });
    
    describe('list()', () => {
      test('should list directory contents', () => {
        const contents = directoryHandle.list();
        
        expect(Array.isArray(contents)).toBe(true);
        expect(contents).toHaveLength(3);
        expect(contents[0]).toEqual(expect.objectContaining({
          name: 'file1.txt',
          type: 'file'
        }));
        expect(contents[2]).toEqual(expect.objectContaining({
          name: 'subdir',
          type: 'directory'
        }));
      });
      
      test('should support recursive listing', () => {
        const contents = directoryHandle.list({ recursive: true });
        expect(Array.isArray(contents)).toBe(true);
      });
      
      test('should support filtering', () => {
        const filter = (item) => item.type === 'file';
        const contents = directoryHandle.list({ filter });
        expect(Array.isArray(contents)).toBe(true);
      });
    });
    
    describe('file()', () => {
      test('should return FileHandle for valid filename', () => {
        const fileHandle = directoryHandle.file('test.txt');
        
        expect(fileHandle).toBeDefined();
        expect(fileHandle.handleType).toBe('FileHandle');
        expect(fileHandle.path).toBe('/test/test.txt');
        
        fileHandle.destroy();
      });
      
      test('should cache FileHandle instances', () => {
        const fileHandle1 = directoryHandle.file('test.txt');
        const fileHandle2 = directoryHandle.file('test.txt');
        
        expect(fileHandle1).toBe(fileHandle2);
        
        fileHandle1.destroy();
      });
      
      test('should validate filename', () => {
        expect(() => directoryHandle.file('')).toThrow('Filename must be a non-empty string');
        expect(() => directoryHandle.file(null)).toThrow('Filename must be a non-empty string');
        expect(() => directoryHandle.file('file/name')).toThrow('Filename cannot contain path separators');
        expect(() => directoryHandle.file('.')).toThrow('Filename cannot be . or ..');
        expect(() => directoryHandle.file('..')).toThrow('Filename cannot be . or ..');
      });
    });
    
    describe('directory()', () => {
      test('should return DirectoryHandle for valid directory name', () => {
        const subDirHandle = directoryHandle.directory('subdir');
        
        expect(subDirHandle).toBeInstanceOf(DirectoryHandle);
        expect(subDirHandle.path).toBe('/test/subdir');
        
        subDirHandle.destroy();
      });
      
      test('should cache DirectoryHandle instances', () => {
        const dirHandle1 = directoryHandle.directory('subdir');
        const dirHandle2 = directoryHandle.directory('subdir');
        
        expect(dirHandle1).toBe(dirHandle2);
        
        dirHandle1.destroy();
      });
    });
    
    describe('createFile()', () => {
      test('should create new file', () => {
        const fileHandle = directoryHandle.createFile('newfile.txt', 'Hello World');
        
        expect(fileHandle).toBeDefined();
        expect(fileHandle.handleType).toBe('FileHandle');
        expect(fileHandle.path).toBe('/test/newfile.txt');
        
        fileHandle.destroy();
      });
      
      test('should handle empty content', () => {
        const fileHandle = directoryHandle.createFile('empty.txt');
        
        expect(fileHandle).toBeDefined();
        expect(fileHandle.path).toBe('/test/empty.txt');
        
        fileHandle.destroy();
      });
    });
    
    describe('createDirectory()', () => {
      test('should create new directory', () => {
        const subDirHandle = directoryHandle.createDirectory('newdir');
        
        expect(subDirHandle).toBeInstanceOf(DirectoryHandle);
        expect(subDirHandle.path).toBe('/test/newdir');
        
        subDirHandle.destroy();
      });
    });
    
    describe('delete()', () => {
      test('should delete file or directory', () => {
        const result = directoryHandle.delete('oldfile.txt');
        
        expect(result).toEqual(expect.objectContaining({
          success: true
        }));
      });
    });
    
    describe('search()', () => {
      test('should search with string pattern', () => {
        const results = directoryHandle.search('*.txt');
        
        expect(Array.isArray(results)).toBe(true);
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual(expect.objectContaining({
          name: 'test.txt',
          type: 'file'
        }));
      });
      
      test('should search with object query', () => {
        const results = directoryHandle.search({ name: '*.js', type: 'file' });
        
        expect(Array.isArray(results)).toBe(true);
      });
      
      test('should support search options', () => {
        const results = directoryHandle.search('*', { recursive: true, limit: 10 });
        
        expect(Array.isArray(results)).toBe(true);
      });
    });
    
    describe('watch()', () => {
      test('should create file watcher', () => {
        const callback = jest.fn();
        const subscription = directoryHandle.watch(callback);
        
        expect(subscription).toEqual(expect.objectContaining({
          id: expect.any(Number),
          unsubscribe: expect.any(Function)
        }));
        
        subscription.unsubscribe();
      });
      
      test('should validate callback', () => {
        expect(() => directoryHandle.watch(null)).toThrow('Watch callback must be a function');
        expect(() => directoryHandle.watch('invalid')).toThrow('Watch callback must be a function');
      });
    });
    
    describe('parent()', () => {
      test('should return parent DirectoryHandle', () => {
        const parentHandle = directoryHandle.parent();
        
        expect(parentHandle).toBeInstanceOf(DirectoryHandle);
        expect(parentHandle.path).toBe('/');
        
        parentHandle.destroy();
      });
      
      test('should return null for root directory', () => {
        const rootHandle = new DirectoryHandle(mockDataSource, '/');
        const parentHandle = rootHandle.parent();
        
        expect(parentHandle).toBeNull();
        
        rootHandle.destroy();
      });
    });
  });
  
  describe('Error Handling', () => {
    test('should handle DataSource errors gracefully', () => {
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
      
      const errorDir = new DirectoryHandle(errorDataSource, '/test');
      
      expect(() => errorDir.value()).toThrow('Query failed');
      expect(() => errorDir.list()).toThrow('Query failed');
      
      errorDir.destroy();
    });
    
    test('should throw error when used after destruction', () => {
      directoryHandle.destroy();
      
      expect(() => directoryHandle.value()).toThrow('Handle has been destroyed');
      expect(() => directoryHandle.list()).toThrow('Handle has been destroyed');
      expect(() => directoryHandle.file('test.txt')).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Cleanup and Destruction', () => {
    test('should clean up child handles on destroy', () => {
      // Create some child handles
      const fileHandle = directoryHandle.file('test.txt');
      const subDirHandle = directoryHandle.directory('subdir');
      
      // Spy on their destroy methods
      const fileDestroySpy = jest.spyOn(fileHandle, 'destroy');
      const dirDestroySpy = jest.spyOn(subDirHandle, 'destroy');
      
      // Destroy parent
      directoryHandle.destroy();
      
      expect(fileDestroySpy).toHaveBeenCalled();
      expect(dirDestroySpy).toHaveBeenCalled();
      expect(directoryHandle.isDestroyed()).toBe(true);
    });
    
    test('should be safe to call destroy multiple times', () => {
      directoryHandle.destroy();
      directoryHandle.destroy(); // Should not throw
      
      expect(directoryHandle.isDestroyed()).toBe(true);
    });
  });
});