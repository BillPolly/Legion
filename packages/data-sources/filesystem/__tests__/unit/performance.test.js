import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('FileSystemDataSource - Performance Tests', () => {
  let dataSource;
  let testDir;
  
  beforeEach(() => {
    // Create test directory with many files for performance testing
    testDir = path.join(os.tmpdir(), `fs-perf-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    // Create nested directory structure
    for (let i = 0; i < 10; i++) {
      const subdir = path.join(testDir, `dir${i}`);
      fs.mkdirSync(subdir);
      
      for (let j = 0; j < 50; j++) {
        fs.writeFileSync(path.join(subdir, `file${j}.txt`), `Content of file ${j} in dir ${i}`);
      }
    }
    
    dataSource = new FileSystemDataSource({ rootPath: testDir });
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('Metadata caching', () => {
    it('should cache metadata queries for better performance', () => {
      const start1 = process.hrtime.bigint();
      const result1 = dataSource.query({
        type: 'file',
        path: 'dir0/file0.txt',
        operation: 'metadata'
      });
      const end1 = process.hrtime.bigint();
      const firstCallTime = Number(end1 - start1) / 1_000_000; // Convert to milliseconds
      
      // Second call should be faster due to caching
      const start2 = process.hrtime.bigint();
      const result2 = dataSource.query({
        type: 'file',
        path: 'dir0/file0.txt',
        operation: 'metadata'
      });
      const end2 = process.hrtime.bigint();
      const secondCallTime = Number(end2 - start2) / 1_000_000;
      
      expect(result1).toEqual(result2);
      expect(secondCallTime).toBeLessThan(firstCallTime * 0.5); // Should be at least 50% faster
    });
    
    it('should invalidate cache when file is modified', () => {
      // Get initial metadata
      const result1 = dataSource.query({
        type: 'file',
        path: 'dir0/file0.txt',
        operation: 'metadata',
        metadata: ['mtime']
      });
      
      // Wait a tiny bit to ensure different timestamps
      const start = Date.now();
      while (Date.now() === start) { /* wait */ }
      
      // Modify file through DataSource (this will invalidate cache)
      dataSource.update({
        type: 'file',
        path: 'dir0/file0.txt',
        operation: 'write',
        content: 'Modified content'
      });
      
      // Get metadata again - should be updated
      const result2 = dataSource.query({
        type: 'file',
        path: 'dir0/file0.txt',
        operation: 'metadata',
        metadata: ['mtime']
      });
      
      expect(result2.mtime.getTime()).toBeGreaterThan(result1.mtime.getTime());
      expect(result2.size).not.toBe(result1.size);
    });
  });
  
  describe('Directory listing caching', () => {
    it('should cache directory listing results', () => {
      const start1 = process.hrtime.bigint();
      const result1 = dataSource.query({
        type: 'directory',
        path: 'dir0',
        operation: 'list'
      });
      const end1 = process.hrtime.bigint();
      const firstCallTime = Number(end1 - start1) / 1_000_000;
      
      // Second call should be faster
      const start2 = process.hrtime.bigint();
      const result2 = dataSource.query({
        type: 'directory',
        path: 'dir0',
        operation: 'list'
      });
      const end2 = process.hrtime.bigint();
      const secondCallTime = Number(end2 - start2) / 1_000_000;
      
      expect(result1).toEqual(result2);
      expect(secondCallTime).toBeLessThan(firstCallTime * 0.5);
    });
    
    it('should invalidate directory cache when contents change', () => {
      // Get initial listing
      const result1 = dataSource.query({
        type: 'directory',
        path: 'dir0',
        operation: 'list'
      });
      
      // Add new file through DataSource (this will invalidate cache)
      dataSource.update({
        type: 'file',
        path: 'dir0/newfile.txt',
        operation: 'write',
        content: 'New file'
      });
      
      // Get listing again - should include new file
      const result2 = dataSource.query({
        type: 'directory',
        path: 'dir0',
        operation: 'list'
      });
      
      expect(result2.length).toBe(result1.length + 1);
      expect(result2.some(entry => entry.name === 'newfile.txt')).toBe(true);
    });
  });
  
  describe('Bulk operations performance', () => {
    it('should handle multiple metadata queries efficiently', () => {
      const paths = [];
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 10; j++) {
          paths.push(`dir${i}/file${j}.txt`);
        }
      }
      
      const start = process.hrtime.bigint();
      const results = paths.map(filePath => 
        dataSource.query({
          type: 'file',
          path: filePath,
          operation: 'metadata'
        })
      );
      const end = process.hrtime.bigint();
      const totalTime = Number(end - start) / 1_000_000;
      
      expect(results.length).toBe(50);
      expect(results.every(r => r.name && r.size !== undefined)).toBe(true);
      
      // Should complete all 50 queries in reasonable time (< 100ms)
      expect(totalTime).toBeLessThan(100);
    });
    
    it('should handle multiple directory listings efficiently', () => {
      const dirs = Array.from({ length: 10 }, (_, i) => `dir${i}`);
      
      const start = process.hrtime.bigint();
      const results = dirs.map(dirPath =>
        dataSource.query({
          type: 'directory',
          path: dirPath,
          operation: 'list'
        })
      );
      const end = process.hrtime.bigint();
      const totalTime = Number(end - start) / 1_000_000;
      
      expect(results.length).toBe(10);
      expect(results.every(r => Array.isArray(r) && r.length === 50)).toBe(true);
      
      // Should complete all 10 directory listings in reasonable time (< 50ms)
      expect(totalTime).toBeLessThan(50);
    });
  });
  
  describe('Memory usage optimization', () => {
    it('should not hold excessive references to large content', () => {
      // Create a large file
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      fs.writeFileSync(path.join(testDir, 'large.txt'), largeContent);
      
      // Read metadata (shouldn't load content)
      const metadata = dataSource.query({
        type: 'file',
        path: 'large.txt',
        operation: 'metadata'
      });
      
      expect(metadata.size).toBe(1024 * 1024);
      
      // Read content
      const content = dataSource.query({
        type: 'file',
        path: 'large.txt',
        operation: 'content'
      });
      
      expect(content).toBe(largeContent);
      expect(content.length).toBe(1024 * 1024);
    });
  });
  
  describe('Cache limits and eviction', () => {
    it('should respect cache size limits', () => {
      // Perform many operations to test cache eviction
      for (let i = 0; i < 100; i++) {
        dataSource.query({
          type: 'file',
          path: `dir${i % 10}/file${i % 50}.txt`,
          operation: 'metadata'
        });
      }
      
      // Cache should not grow indefinitely
      expect(dataSource._metadataCache.size).toBeLessThan(200);
    });
    
    it('should evict least recently used items when cache is full', () => {
      // Fill cache beyond limit
      const paths = [];
      for (let i = 0; i < 150; i++) {
        const filePath = `dir${i % 10}/file${i % 50}.txt`;
        paths.push(filePath);
        dataSource.query({
          type: 'file',
          path: filePath,
          operation: 'metadata'
        });
      }
      
      // Cache should have evicted some entries (max is 100 by default)
      expect(dataSource._metadataCache.size).toBeLessThanOrEqual(100);
      
      // Most recent entries should still be cached (check by key format)
      const recentPath = paths[paths.length - 1];
      const recentKey = `${recentPath}:[]`;
      expect(dataSource._metadataCache.has(recentKey)).toBe(true);
    });
  });
});