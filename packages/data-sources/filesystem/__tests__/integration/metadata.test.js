import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('FileSystemDataSource - Metadata Integration Tests', () => {
  let dataSource;
  let testDir;
  
  beforeEach(() => {
    // Create a unique test directory in temp
    testDir = path.join(os.tmpdir(), `fs-datasource-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    // Create test file structure
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'Hello World');
    fs.writeFileSync(path.join(testDir, 'file2.js'), 'console.log("test");');
    fs.mkdirSync(path.join(testDir, 'subdir'));
    fs.writeFileSync(path.join(testDir, 'subdir', 'nested.txt'), 'Nested content');
    
    dataSource = new FileSystemDataSource({ rootPath: testDir });
  });
  
  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('File metadata queries', () => {
    it('should retrieve metadata for text file', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'file1.txt',
        operation: 'metadata'
      });
      
      expect(result).toBeDefined();
      expect(result.name).toBe('file1.txt');
      expect(result.path).toBe(path.join(testDir, 'file1.txt'));
      expect(result.size).toBe(11); // "Hello World"
      expect(result.isFile).toBe(true);
      expect(result.isDirectory).toBe(false);
    });
    
    it('should retrieve metadata with specific fields', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'file2.js',
        operation: 'metadata',
        metadata: ['size', 'mtime', 'type', 'mode']
      });
      
      expect(result.size).toBe(20); // 'console.log("test");'
      expect(result.mtime).toBeDefined();
      // Check if it's a valid Date
      expect(Object.prototype.toString.call(result.mtime)).toBe('[object Date]');
      expect(result.type).toBe('file');
      expect(typeof result.mode).toBe('number');
    });
    
    it('should retrieve nested file metadata', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'subdir/nested.txt',
        operation: 'metadata'
      });
      
      expect(result.name).toBe('nested.txt');
      expect(result.size).toBe(14); // "Nested content"
      expect(result.isFile).toBe(true);
    });
  });
  
  describe('Directory metadata queries', () => {
    it('should retrieve metadata for directory', () => {
      const result = dataSource.query({
        type: 'directory',
        path: 'subdir',
        operation: 'metadata'
      });
      
      expect(result.name).toBe('subdir');
      expect(result.isDirectory).toBe(true);
      expect(result.isFile).toBe(false);
    });
    
    it('should retrieve metadata for root directory', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'metadata'
      });
      
      expect(result.path).toBe(testDir);
      expect(result.isDirectory).toBe(true);
    });
  });
  
  describe('Error handling', () => {
    it('should throw error for non-existent file', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'nonexistent.txt',
          operation: 'metadata'
        });
      }).toThrow('File not found');
    });
    
    it('should throw error for path traversal attempt', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: '../outside.txt',
          operation: 'metadata'
        });
      }).toThrow('Path traversal not allowed');
    });
    
    it('should throw error without operation', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'file1.txt'
        });
      }).toThrow('Query operation is required');
    });
  });
  
  describe('File stats accuracy', () => {
    it('should return accurate file timestamps', () => {
      const filePath = path.join(testDir, 'timestamp-test.txt');
      const beforeCreate = new Date();
      
      // Add small delay to ensure timestamp difference
      fs.writeFileSync(filePath, 'test');
      
      const afterCreate = new Date();
      // Add tolerance for timing
      afterCreate.setMilliseconds(afterCreate.getMilliseconds() + 10);
      
      const result = dataSource.query({
        type: 'file',
        path: 'timestamp-test.txt',
        operation: 'metadata',
        metadata: ['mtime', 'ctime', 'atime']
      });
      
      // mtime should be between before and after (with tolerance)
      expect(result.mtime.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(result.mtime.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      
      // All timestamps should be Date objects
      expect(Object.prototype.toString.call(result.mtime)).toBe('[object Date]');
      expect(Object.prototype.toString.call(result.ctime)).toBe('[object Date]');
      expect(Object.prototype.toString.call(result.atime)).toBe('[object Date]');
    });
    
    it('should return accurate file permissions', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'file1.txt',
        operation: 'metadata',
        metadata: ['mode', 'uid', 'gid']
      });
      
      expect(typeof result.mode).toBe('number');
      expect(typeof result.uid).toBe('number');
      expect(typeof result.gid).toBe('number');
      expect(result.uid).toBeGreaterThanOrEqual(0);
      expect(result.gid).toBeGreaterThanOrEqual(0);
    });
  });
});