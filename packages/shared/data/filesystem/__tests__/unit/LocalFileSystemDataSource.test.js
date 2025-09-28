/**
 * Unit Tests for LocalFileSystemDataSource
 * 
 * Tests the LocalFileSystemDataSource implementation with Node.js fs operations
 */

import { LocalFileSystemDataSource } from '../../src/datasources/LocalFileSystemDataSource.js';
import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('LocalFileSystemDataSource', () => {
  let dataSource;
  let testDir;
  
  beforeEach(async () => {
    dataSource = new LocalFileSystemDataSource();
    
    // Create test directory for each test
    testDir = path.join(__dirname, '../tmp/localfs-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    if (dataSource) {
      dataSource.removeAllListeners();
    }
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Constructor and Initialization', () => {
    test('should create instance successfully', () => {
      expect(dataSource).toBeInstanceOf(LocalFileSystemDataSource);
    });
    
    test('should be an EventEmitter', () => {
      expect(typeof dataSource.on).toBe('function');
      expect(typeof dataSource.emit).toBe('function');
      expect(typeof dataSource.removeAllListeners).toBe('function');
    });
    
    test('should implement required DataSource interface', () => {
      expect(typeof dataSource.query).toBe('function');
      expect(typeof dataSource.update).toBe('function');
      expect(typeof dataSource.subscribe).toBe('function');
      expect(typeof dataSource.getSchema).toBe('function');
    });
  });
  
  describe('Schema Support', () => {
    test('should return valid schema', () => {
      const schema = dataSource.getSchema();
      
      expect(schema).toEqual(expect.objectContaining({
        version: expect.any(String),
        type: 'local-filesystem',
        capabilities: expect.objectContaining({
          read: true,
          write: true,
          watch: true,
          search: true,
          streams: true
        })
      }));
    });
  });
  
  describe('Directory Metadata Queries', () => {
    test('should query directory metadata', async () => {
      const querySpec = {
        find: ['metadata'],
        where: [['directory', testDir, 'metadata']]
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(1);
      
      const metadata = results[0];
      expect(metadata).toEqual(expect.objectContaining({
        path: testDir,
        type: 'directory',
        exists: true,
        isDirectory: true,
        isFile: false
      }));
    });
    
    test('should handle non-existent directory', () => {
      const nonExistentDir = path.join(testDir, 'nonexistent');
      const querySpec = {
        find: ['metadata'],
        where: [['directory', nonExistentDir, 'metadata']]
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(1);
      
      const metadata = results[0];
      expect(metadata.exists).toBe(false);
    });
  });
  
  describe('File Metadata Queries', () => {
    let testFile;
    
    beforeEach(async () => {
      testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello World', 'utf8');
    });
    
    test('should query file metadata', () => {
      const querySpec = {
        find: ['metadata'],
        where: [['file', testFile, 'metadata']]
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(1);
      
      const metadata = results[0];
      expect(metadata).toEqual(expect.objectContaining({
        path: testFile,
        type: 'file',
        exists: true,
        isDirectory: false,
        isFile: true,
        size: 11 // "Hello World" length
      }));
    });
    
    test('should handle non-existent file', () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt');
      const querySpec = {
        find: ['metadata'],
        where: [['file', nonExistentFile, 'metadata']]
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(1);
      
      const metadata = results[0];
      expect(metadata.exists).toBe(false);
    });
  });
  
  describe('File Content Queries', () => {
    let testFile;
    const testContent = 'Hello World\nThis is test content';
    
    beforeEach(async () => {
      testFile = path.join(testDir, 'content.txt');
      await fs.writeFile(testFile, testContent, 'utf8');
    });
    
    test('should read file content as text', () => {
      const querySpec = {
        find: ['content'],
        where: [['file', testFile, 'content']],
        options: { encoding: 'utf8' }
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(testContent);
    });
    
    test('should read file content as binary', () => {
      const querySpec = {
        find: ['content'],
        where: [['file', testFile, 'content']],
        options: { encoding: null }
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(Buffer);
    });
    
    test('should read partial file content', () => {
      const querySpec = {
        find: ['content'],
        where: [['file', testFile, 'content']],
        options: { encoding: 'utf8', offset: 6, length: 5 }
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(1);
      expect(results[0]).toBe('World');
    });
    
    test('should throw error for non-existent file', () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt');
      const querySpec = {
        find: ['content'],
        where: [['file', nonExistentFile, 'content']]
      };
      
      expect(() => dataSource.query(querySpec)).toThrow();
    });
  });
  
  describe('Directory Listing Queries', () => {
    beforeEach(async () => {
      // Create test directory structure
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.js'), 'content2');
      await fs.mkdir(path.join(testDir, 'subdir'));
      await fs.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'nested');
    });
    
    test('should list directory contents', () => {
      const querySpec = {
        find: ['name', 'type', 'metadata'],
        where: [
          ['parent', testDir],
          ['name', '?name'],
          ['type', '?type'],
          ['metadata', '?metadata']
        ]
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(3);
      
      const names = results.map(r => r.name).sort();
      expect(names).toEqual(['file1.txt', 'file2.js', 'subdir']);
      
      const fileResult = results.find(r => r.name === 'file1.txt');
      expect(fileResult.type).toBe('file');
      
      const dirResult = results.find(r => r.name === 'subdir');
      expect(dirResult.type).toBe('directory');
    });
    
    test('should support recursive listing', () => {
      const querySpec = {
        find: ['name', 'type', 'metadata'],
        where: [['parent', testDir]],
        recursive: true
      };
      
      const results = dataSource.query(querySpec);
      expect(results.length).toBeGreaterThan(3); // Should include nested files
      
      const nestedFile = results.find(r => r.name === 'nested.txt');
      expect(nestedFile).toBeDefined();
    });
    
    test('should support filtering', () => {
      const querySpec = {
        find: ['name', 'type', 'metadata'],
        where: [['parent', testDir]],
        filter: (item) => item.type === 'file'
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(2); // Only files, not directory
      expect(results.every(r => r.type === 'file')).toBe(true);
    });
  });
  
  describe('File Write Operations', () => {
    test('should write new file', async () => {
      const filePath = path.join(testDir, 'new.txt');
      const content = 'New file content';
      
      const result = dataSource.update(filePath, {
        operation: 'write',
        content: content,
        options: { encoding: 'utf8' }
      });
      
      expect(result.success).toBe(true);
      expect(result.path).toBe(filePath);
      
      // Verify file was created
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });
    
    test('should append to existing file', async () => {
      const filePath = path.join(testDir, 'append.txt');
      await fs.writeFile(filePath, 'Initial content', 'utf8');
      
      const result = dataSource.update(filePath, {
        operation: 'write',
        content: '\nAppended content',
        options: { append: true }
      });
      
      expect(result.success).toBe(true);
      
      // Verify content was appended
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('Initial content\nAppended content');
    });
    
    test('should create parent directories when needed', () => {
      const filePath = path.join(testDir, 'deep', 'nested', 'file.txt');
      
      const result = dataSource.update(filePath, {
        operation: 'write',
        content: 'Deep file',
        options: { createParents: true }
      });
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('File and Directory Creation', () => {
    test('should create new file with content', () => {
      const filePath = path.join(testDir, 'created.txt');
      
      const result = dataSource.update(null, {
        type: 'file',
        path: filePath,
        content: 'Created content'
      });
      
      expect(result.success).toBe(true);
      expect(result.path).toBe(filePath);
    });
    
    test('should create new directory', () => {
      const dirPath = path.join(testDir, 'newdir');
      
      const result = dataSource.update(null, {
        type: 'directory',
        path: dirPath
      });
      
      expect(result.success).toBe(true);
      expect(result.path).toBe(dirPath);
    });
    
    test('should create nested directories recursively', () => {
      const dirPath = path.join(testDir, 'deep', 'nested', 'dirs');
      
      const result = dataSource.update(null, {
        type: 'directory',
        path: dirPath,
        options: { recursive: true }
      });
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('File Operations', () => {
    let sourceFile;
    
    beforeEach(async () => {
      sourceFile = path.join(testDir, 'source.txt');
      await fs.writeFile(sourceFile, 'Source content', 'utf8');
    });
    
    test('should copy file', async () => {
      const targetFile = path.join(testDir, 'copied.txt');
      
      const result = dataSource.update(null, {
        operation: 'copy',
        source: sourceFile,
        target: targetFile
      });
      
      expect(result.success).toBe(true);
      
      // Verify both files exist with same content
      const sourceContent = await fs.readFile(sourceFile, 'utf8');
      const targetContent = await fs.readFile(targetFile, 'utf8');
      expect(targetContent).toBe(sourceContent);
    });
    
    test('should move file', async () => {
      const targetFile = path.join(testDir, 'moved.txt');
      
      const result = dataSource.update(sourceFile, {
        operation: 'move',
        target: targetFile
      });
      
      expect(result.success).toBe(true);
      
      // Verify source no longer exists and target exists
      expect(async () => await fs.access(sourceFile)).rejects.toThrow();
      const targetContent = await fs.readFile(targetFile, 'utf8');
      expect(targetContent).toBe('Source content');
    });
    
    test('should delete file', async () => {
      const result = dataSource.update(sourceFile, {
        operation: 'delete'
      });
      
      expect(result.success).toBe(true);
      
      // Verify file no longer exists
      expect(async () => await fs.access(sourceFile)).rejects.toThrow();
    });
  });
  
  describe('File Watching', () => {
    test('should create file watcher subscription', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['event', 'data'],
        where: [['file', testDir, 'change']]
      };
      
      const subscription = dataSource.subscribe(querySpec, callback);
      
      expect(subscription).toEqual(expect.objectContaining({
        id: expect.any(Number),
        querySpec: querySpec,
        callback: callback,
        unsubscribe: expect.any(Function)
      }));
      
      subscription.unsubscribe();
    });
    
    test('should cleanup watchers on unsubscribe', () => {
      const callback = jest.fn();
      const querySpec = {
        find: ['event', 'data'],
        where: [['file', testDir, 'change']]
      };
      
      const subscription = dataSource.subscribe(querySpec, callback);
      const initialWatchers = dataSource._watchers.size;
      
      subscription.unsubscribe();
      
      expect(dataSource._watchers.size).toBeLessThan(initialWatchers);
    });
  });
  
  describe('Stream Support', () => {
    let testFile;
    
    beforeEach(async () => {
      testFile = path.join(testDir, 'stream.txt');
      await fs.writeFile(testFile, 'Stream test content', 'utf8');
    });
    
    test('should create read stream', () => {
      const querySpec = {
        find: ['stream'],
        where: [['file', testFile, 'readStream']],
        options: { encoding: 'utf8' }
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(1);
      
      const stream = results[0];
      expect(stream).toEqual(expect.objectContaining({
        read: expect.any(Function),
        on: expect.any(Function),
        pipe: expect.any(Function)
      }));
    });
    
    test('should create write stream', () => {
      const newFile = path.join(testDir, 'write-stream.txt');
      const querySpec = {
        find: ['stream'],
        where: [['file', newFile, 'writeStream']],
        options: { encoding: 'utf8' }
      };
      
      const results = dataSource.query(querySpec);
      expect(results).toHaveLength(1);
      
      const stream = results[0];
      expect(stream).toEqual(expect.objectContaining({
        write: expect.any(Function),
        end: expect.any(Function),
        on: expect.any(Function)
      }));
    });
  });
  
  describe('Error Handling', () => {
    test('should handle file read errors gracefully', () => {
      const nonExistentFile = '/non/existent/file.txt';
      const querySpec = {
        find: ['content'],
        where: [['file', nonExistentFile, 'content']]
      };
      
      expect(() => dataSource.query(querySpec)).toThrow();
    });
    
    test('should handle write errors gracefully', () => {
      const invalidPath = '/root/invalid/path/file.txt'; // Should fail on most systems
      
      const result = dataSource.update(invalidPath, {
        operation: 'write',
        content: 'test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    test('should handle unknown operations', () => {
      const result = dataSource.update('/test.txt', {
        operation: 'unknown'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unknown operation/);
    });
    
    test('should handle malformed queries', () => {
      const querySpec = {
        find: ['invalid'],
        where: [['malformed', 'query']]
      };
      
      expect(() => dataSource.query(querySpec)).toThrow();
    });
  });
  
  describe('Performance and Caching', () => {
    test('should handle multiple concurrent operations', async () => {
      const operations = [];
      
      // Create multiple files concurrently
      for (let i = 0; i < 10; i++) {
        const filePath = path.join(testDir, `concurrent-${i}.txt`);
        operations.push(
          Promise.resolve(dataSource.update(filePath, {
            operation: 'write',
            content: `Content ${i}`
          }))
        );
      }
      
      const results = await Promise.all(operations);
      
      // All operations should succeed
      expect(results.every(r => r.success)).toBe(true);
    });
    
    test('should clean up resources properly', () => {
      const initialWatchers = dataSource._watchers.size;
      const initialSubscriptions = dataSource._subscriptions.length;
      
      // Create and remove multiple subscriptions
      const subscriptions = [];
      for (let i = 0; i < 5; i++) {
        const sub = dataSource.subscribe(
          { find: ['event'], where: [['file', testDir, 'change']] },
          jest.fn()
        );
        subscriptions.push(sub);
      }
      
      // Unsubscribe all
      subscriptions.forEach(sub => sub.unsubscribe());
      
      // Resources should be cleaned up
      expect(dataSource._subscriptions.length).toBe(initialSubscriptions);
    });
  });
});