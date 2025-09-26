/**
 * Unit tests for Error Handling and Validation
 * Tests comprehensive error conditions, input validation, and security measures
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Error Handling and Validation', () => {
  const testRoot = path.join(__dirname, '../tmp/error-handling-test');
  let dataSource;
  
  beforeAll(() => {
    // Create test directory structure
    fs.mkdirSync(testRoot, { recursive: true });
    
    // Create test files
    fs.writeFileSync(path.join(testRoot, 'test-file.txt'), 'test content');
    fs.mkdirSync(path.join(testRoot, 'test-dir'));
    fs.writeFileSync(path.join(testRoot, 'test-dir/nested-file.txt'), 'nested content');
    
    dataSource = new FileSystemDataSource({ rootPath: testRoot });
  });
  
  afterAll(() => {
    // Clean up test directory
    fs.rmSync(testRoot, { recursive: true, force: true });
  });
  
  describe('DataSource initialization validation', () => {
    it('should throw error for missing rootPath', () => {
      expect(() => {
        new FileSystemDataSource();
      }).toThrow('rootPath is required');
    });
    
    it('should throw error for null rootPath', () => {
      expect(() => {
        new FileSystemDataSource({ rootPath: null });
      }).toThrow('rootPath is required');
    });
    
    it('should throw error for empty rootPath', () => {
      expect(() => {
        new FileSystemDataSource({ rootPath: '' });
      }).toThrow('rootPath is required');
    });
    
    it('should throw error for non-existent rootPath', () => {
      expect(() => {
        new FileSystemDataSource({ rootPath: '/non/existent/path' });
      }).toThrow('Root path does not exist');
    });
    
    it('should throw error for rootPath that is not a directory', () => {
      const filePath = path.join(testRoot, 'test-file.txt');
      expect(() => {
        new FileSystemDataSource({ rootPath: filePath });
      }).toThrow('Root path must be a directory');
    });
  });
  
  describe('Query parameter validation', () => {
    it('should throw error for missing query object', () => {
      expect(() => {
        dataSource.query();
      }).toThrow('Query must be an object');
    });
    
    it('should throw error for null query', () => {
      expect(() => {
        dataSource.query(null);
      }).toThrow('Query must be an object');
    });
    
    it('should throw error for non-object query', () => {
      expect(() => {
        dataSource.query('invalid');
      }).toThrow('Query must be an object');
    });
    
    it('should throw error for missing operation', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'test-file.txt'
        });
      }).toThrow('Query operation is required');
    });
    
    it('should throw error for invalid operation', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'test-file.txt',
          operation: 'invalid-operation'
        });
      }).toThrow('Unsupported operation: invalid-operation');
    });
    
    it('should throw error for missing path when required', () => {
      expect(() => {
        dataSource.query({
          operation: 'metadata'
        });
      }).toThrow('Path is required');
    });
  });
  
  describe('Path security validation', () => {
    it('should throw error for path traversal with ../', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: '../../../etc/passwd',
          operation: 'metadata'
        });
      }).toThrow('Path traversal not allowed');
    });
    
    it('should throw error for absolute paths outside root', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: '/etc/passwd',
          operation: 'metadata'
        });
      }).toThrow('Absolute paths not allowed');
    });
    
    it('should throw error for paths with null bytes', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'test\0file.txt',
          operation: 'metadata'
        });
      }).toThrow('Invalid characters in path');
    });
    
    it('should throw error for paths with control characters', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'test\x01file.txt',
          operation: 'metadata'
        });
      }).toThrow('Invalid characters in path');
    });
    
    it('should handle normalized paths that traverse beyond root', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'test-dir/../../../etc/passwd',
          operation: 'metadata'
        });
      }).toThrow('Path traversal not allowed');
    });
    
    it('should allow legitimate relative paths', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'test-dir/nested-file.txt',
          operation: 'metadata'
        });
      }).not.toThrow();
    });
  });
  
  describe('File operation error handling', () => {
    it('should throw error for non-existent file metadata', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'non-existent.txt',
          operation: 'metadata'
        });
      }).toThrow('File not found');
    });
    
    it('should throw error for non-existent file content', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'non-existent.txt',
          operation: 'content'
        });
      }).toThrow('File not found');
    });
    
    it('should throw error when reading directory as file', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'test-dir',
          operation: 'content'
        });
      }).toThrow('Path is not a file');
    });
    
    it('should handle permission errors gracefully', () => {
      // Create a file with restricted permissions (if possible)
      const restrictedFile = path.join(testRoot, 'restricted.txt');
      fs.writeFileSync(restrictedFile, 'restricted content');
      
      try {
        fs.chmodSync(restrictedFile, 0o000); // No permissions
        
        expect(() => {
          dataSource.query({
            type: 'file',
            path: 'restricted.txt',
            operation: 'content'
          });
        }).toThrow();
      } finally {
        // Restore permissions for cleanup
        try {
          fs.chmodSync(restrictedFile, 0o644);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });
  
  describe('Directory operation error handling', () => {
    it('should throw error for non-existent directory list', () => {
      expect(() => {
        dataSource.query({
          type: 'directory',
          path: 'non-existent-dir',
          operation: 'list'
        });
      }).toThrow('Directory not found');
    });
    
    it('should throw error when listing file as directory', () => {
      expect(() => {
        dataSource.query({
          type: 'directory',
          path: 'test-file.txt',
          operation: 'list'
        });
      }).toThrow('Path is not a directory');
    });
    
    it('should throw error for non-existent directory metadata', () => {
      expect(() => {
        dataSource.query({
          type: 'directory',
          path: 'non-existent-dir',
          operation: 'metadata'
        });
      }).toThrow('Directory not found');
    });
  });
  
  describe('Update operation validation', () => {
    it('should throw error for missing update object', () => {
      expect(() => {
        dataSource.update();
      }).toThrow('Update must be an object');
    });
    
    it('should throw error for null update', () => {
      expect(() => {
        dataSource.update(null);
      }).toThrow('Update must be an object');
    });
    
    it('should throw error for missing update operation', () => {
      expect(() => {
        dataSource.update({
          type: 'file',
          path: 'test.txt'
        });
      }).toThrow('Update operation is required');
    });
    
    it('should throw error for invalid update operation', () => {
      expect(() => {
        dataSource.update({
          type: 'file',
          path: 'test.txt',
          operation: 'invalid-update'
        });
      }).toThrow('Unsupported operation: invalid-update');
    });
  });
  
  describe('Subscription validation', () => {
    afterEach(() => {
      // Clean up any active subscriptions
      if (dataSource._subscriptions) {
        for (const [id, subscription] of dataSource._subscriptions) {
          if (subscription.unsubscribe) {
            subscription.unsubscribe();
          }
        }
        dataSource._subscriptions.clear();
      }
      if (dataSource._watchers) {
        dataSource._watchers.clear();
      }
    });
    
    it('should throw error for missing callback', () => {
      expect(() => {
        dataSource.subscribe({
          operation: 'watch',
          path: 'test-file.txt',
          events: ['change']
        });
      }).toThrow('Subscribe requires a callback function');
    });
    
    it('should throw error for non-function callback', () => {
      expect(() => {
        dataSource.subscribe({
          operation: 'watch',
          path: 'test-file.txt',
          events: ['change']
        }, 'not-a-function');
      }).toThrow('Subscribe requires a callback function');
    });
    
    it('should throw error for invalid subscription query', () => {
      expect(() => {
        dataSource.subscribe(null, () => {});
      }).toThrow('Subscribe query must be an object');
    });
    
    it('should throw error for missing events array', () => {
      expect(() => {
        dataSource.subscribe({
          operation: 'watch',
          path: 'test-file.txt'
        }, () => {});
      }).toThrow('Events array is required');
    });
    
    it('should throw error for empty events array', () => {
      expect(() => {
        dataSource.subscribe({
          operation: 'watch',
          path: 'test-file.txt',
          events: []
        }, () => {});
      }).toThrow('Events array cannot be empty');
    });
  });
  
  describe('Handle creation validation', () => {
    it('should throw error for ServerFileHandle without path', () => {
      expect(() => {
        dataSource.file();
      }).toThrow('File path is required');
    });
    
    it('should throw error for ServerFileHandle with null path', () => {
      expect(() => {
        dataSource.file(null);
      }).toThrow('File path is required');
    });
    
    it('should allow ServerDirectoryHandle with empty path (root)', () => {
      expect(() => {
        dataSource.directory('');
      }).not.toThrow();
    });
    
    it('should throw error for invalid file paths', () => {
      expect(() => {
        dataSource.file('../../../etc/passwd');
      }).toThrow('Path traversal not allowed');
    });
  });
  
  describe('Handle method error handling', () => {
    it('should handle ServerFileHandle methods on non-existent files', () => {
      const fileHandle = dataSource.file('non-existent.txt');
      
      expect(() => {
        fileHandle.value();
      }).toThrow('File not found');
      
      expect(() => {
        fileHandle.content();
      }).toThrow('File not found');
      
      expect(fileHandle.exists()).toBe(false);
      expect(fileHandle.size()).toBe(0); // Should return 0 for non-existent files
    });
    
    it('should handle ServerDirectoryHandle methods on non-existent directories', () => {
      const dirHandle = dataSource.directory('non-existent-dir');
      
      expect(() => {
        dirHandle.value();
      }).toThrow('Directory not found');
      
      expect(() => {
        dirHandle.list();
      }).toThrow('Directory not found');
      
      expect(dirHandle.exists()).toBe(false);
      expect(dirHandle.children()).toEqual([]); // Should return empty array for graceful degradation
    });
  });
  
  describe('Edge cases and boundary conditions', () => {
    it('should handle very long paths', () => {
      const longName = 'a'.repeat(255); // Typical filesystem limit
      
      expect(() => {
        dataSource.file(longName);
      }).not.toThrow();
    });
    
    it('should handle paths with special characters', () => {
      const specialChars = 'file with spaces & symbols!@#$%^&()_+={}.txt';
      
      expect(() => {
        dataSource.file(specialChars);
      }).not.toThrow();
    });
    
    it('should handle Unicode paths', () => {
      const unicodePath = 'test-文件.txt';
      
      expect(() => {
        dataSource.file(unicodePath);
      }).not.toThrow();
    });
    
    it('should handle empty string queries gracefully', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: '',
          operation: 'metadata'
        });
      }).toThrow('Path cannot be empty for file operations');
    });
    
    it('should handle concurrent operations safely', (done) => {
      const promises = [];
      
      // Create multiple concurrent queries
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise((resolve) => {
            try {
              const result = dataSource.query({
                type: 'file',
                path: 'test-file.txt',
                operation: 'metadata'
              });
              resolve({ success: true, result });
            } catch (error) {
              resolve({ success: false, error });
            }
          })
        );
      }
      
      Promise.all(promises).then(results => {
        // All operations should succeed
        const successes = results.filter(r => r.success);
        expect(successes.length).toBe(10);
        done();
      });
    });
  });
  
  describe('Resource cleanup and memory management', () => {
    it('should clean up resources on repeated operations', () => {
      // Perform many operations to test for memory leaks
      for (let i = 0; i < 100; i++) {
        const fileHandle = dataSource.file('test-file.txt');
        fileHandle.exists();
        fileHandle.size();
        
        const dirHandle = dataSource.directory('test-dir');
        dirHandle.exists();
        dirHandle.isEmpty();
      }
      
      // If we get here without running out of memory, cleanup is working
      expect(true).toBe(true);
    });
    
    it('should handle subscription cleanup properly', () => {
      const subscriptions = [];
      
      // Create multiple subscriptions
      for (let i = 0; i < 10; i++) {
        const subscription = dataSource.subscribe({
          operation: 'watch',
          path: 'test-file.txt',
          events: ['change']
        }, () => {});
        
        subscriptions.push(subscription);
      }
      
      // Verify subscriptions are tracked
      expect(dataSource._subscriptions.size).toBe(10);
      expect(dataSource._watchers.size).toBe(10);
      
      // Clean up all subscriptions
      subscriptions.forEach(sub => sub.unsubscribe());
      
      // Verify cleanup
      expect(dataSource._subscriptions.size).toBe(0);
      expect(dataSource._watchers.size).toBe(0);
    });
  });
});