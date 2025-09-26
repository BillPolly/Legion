import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('FileSystemDataSource - Directory List Operations', () => {
  let dataSource;
  let testDir;
  
  beforeEach(() => {
    // Create a unique test directory in temp
    testDir = path.join(os.tmpdir(), `fs-datasource-list-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    // Create test file structure
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(testDir, 'file2.js'), 'console.log("test");');
    fs.writeFileSync(path.join(testDir, '.hidden'), 'hidden file');
    fs.mkdirSync(path.join(testDir, 'subdir1'));
    fs.mkdirSync(path.join(testDir, 'subdir2'));
    fs.mkdirSync(path.join(testDir, '.git'));
    fs.writeFileSync(path.join(testDir, 'subdir1', 'nested.txt'), 'nested');
    fs.symlinkSync(path.join(testDir, 'file1.txt'), path.join(testDir, 'link.txt'));
    
    dataSource = new FileSystemDataSource({ rootPath: testDir });
  });
  
  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('Basic directory listing', () => {
    it('should list all entries in directory', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list'
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(7); // Including hidden files and symlink
      
      const names = result.map(entry => entry.name).sort();
      expect(names).toEqual(['.git', '.hidden', 'file1.txt', 'file2.js', 'link.txt', 'subdir1', 'subdir2']);
    });
    
    it('should include entry metadata', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list'
      });
      
      const file1 = result.find(entry => entry.name === 'file1.txt');
      expect(file1).toBeDefined();
      expect(file1.path).toBe('file1.txt');
      expect(file1.isFile).toBe(true);
      expect(file1.isDirectory).toBe(false);
      expect(file1.size).toBe(8); // 'content1'
      
      const subdir1 = result.find(entry => entry.name === 'subdir1');
      expect(subdir1).toBeDefined();
      expect(subdir1.isFile).toBe(false);
      expect(subdir1.isDirectory).toBe(true);
      
      const link = result.find(entry => entry.name === 'link.txt');
      expect(link).toBeDefined();
      expect(link.isSymbolicLink).toBe(true);
    });
    
    it('should list subdirectory contents', () => {
      const result = dataSource.query({
        type: 'directory',
        path: 'subdir1',
        operation: 'list'
      });
      
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('nested.txt');
    });
    
    it('should return empty array for empty directory', () => {
      fs.mkdirSync(path.join(testDir, 'empty'));
      
      const result = dataSource.query({
        type: 'directory',
        path: 'empty',
        operation: 'list'
      });
      
      expect(result).toEqual([]);
    });
  });
  
  describe('Filtered listing', () => {
    it('should filter by file type', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { type: 'file' }
      });
      
      expect(result.length).toBe(4); // file1.txt, file2.js, .hidden, link.txt
      expect(result.every(entry => entry.isFile || entry.isSymbolicLink)).toBe(true);
    });
    
    it('should filter by directory type', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { type: 'directory' }
      });
      
      expect(result.length).toBe(3); // subdir1, subdir2, .git
      expect(result.every(entry => entry.isDirectory)).toBe(true);
    });
    
    it('should filter by extension', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { extension: '.txt' }
      });
      
      expect(result.length).toBe(2); // file1.txt, link.txt
      expect(result.every(entry => entry.name.endsWith('.txt'))).toBe(true);
    });
    
    it('should filter hidden files', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { hidden: false }
      });
      
      expect(result.length).toBe(5); // Excluding .hidden and .git
      expect(result.every(entry => !entry.name.startsWith('.'))).toBe(true);
    });
    
    it('should combine multiple filters', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { 
          type: 'file',
          extension: '.txt',
          hidden: false
        }
      });
      
      expect(result.length).toBe(2); // file1.txt, link.txt
    });
  });
  
  describe('Sorting', () => {
    it('should sort by name ascending', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        sort: { by: 'name', order: 'asc' }
      });
      
      const names = result.map(entry => entry.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
    
    it('should sort by name descending', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        sort: { by: 'name', order: 'desc' }
      });
      
      const names = result.map(entry => entry.name);
      const sortedNames = [...names].sort().reverse();
      expect(names).toEqual(sortedNames);
    });
    
    it('should sort by size', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { type: 'file' },
        sort: { by: 'size', order: 'asc' }
      });
      
      // Check that files are sorted by size
      for (let i = 1; i < result.length; i++) {
        expect(result[i].size).toBeGreaterThanOrEqual(result[i-1].size);
      }
    });
  });
  
  describe('Error handling', () => {
    it('should throw error for non-existent directory', () => {
      expect(() => {
        dataSource.query({
          type: 'directory',
          path: 'nonexistent',
          operation: 'list'
        });
      }).toThrow('Directory not found');
    });
    
    it('should throw error when listing file as directory', () => {
      expect(() => {
        dataSource.query({
          type: 'directory',
          path: 'file1.txt',
          operation: 'list'
        });
      }).toThrow('Path is not a directory');
    });
  });
});