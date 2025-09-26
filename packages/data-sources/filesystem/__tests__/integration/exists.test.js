import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('FileSystemDataSource - Exists Operation', () => {
  let dataSource;
  let testDir;
  
  beforeEach(() => {
    // Create a unique test directory in temp
    testDir = path.join(os.tmpdir(), `fs-datasource-exists-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    // Create test file structure
    fs.writeFileSync(path.join(testDir, 'exists.txt'), 'I exist');
    fs.mkdirSync(path.join(testDir, 'existing-dir'));
    
    dataSource = new FileSystemDataSource({ rootPath: testDir });
  });
  
  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('File existence checks', () => {
    it('should return true for existing file', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'exists.txt',
        operation: 'exists'
      });
      
      expect(result.exists).toBe(true);
      expect(result.path).toBe(path.join(testDir, 'exists.txt'));
    });
    
    it('should return false for non-existent file', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'nonexistent.txt',
        operation: 'exists'
      });
      
      expect(result.exists).toBe(false);
      expect(result.path).toBe(path.join(testDir, 'nonexistent.txt'));
    });
  });
  
  describe('Directory existence checks', () => {
    it('should return true for existing directory', () => {
      const result = dataSource.query({
        type: 'directory',
        path: 'existing-dir',
        operation: 'exists'
      });
      
      expect(result.exists).toBe(true);
      expect(result.path).toBe(path.join(testDir, 'existing-dir'));
    });
    
    it('should return false for non-existent directory', () => {
      const result = dataSource.query({
        type: 'directory',
        path: 'nonexistent-dir',
        operation: 'exists'
      });
      
      expect(result.exists).toBe(false);
      expect(result.path).toBe(path.join(testDir, 'nonexistent-dir'));
    });
    
    it('should return true for root directory', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'exists'
      });
      
      expect(result.exists).toBe(true);
      expect(result.path).toBe(testDir);
    });
  });
  
  describe('Path resolution', () => {
    it('should handle nested paths', () => {
      fs.mkdirSync(path.join(testDir, 'existing-dir', 'nested'));
      fs.writeFileSync(path.join(testDir, 'existing-dir', 'nested', 'deep.txt'), 'deep');
      
      const result = dataSource.query({
        type: 'file',
        path: 'existing-dir/nested/deep.txt',
        operation: 'exists'
      });
      
      expect(result.exists).toBe(true);
    });
    
    it('should prevent path traversal', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: '../outside.txt',
          operation: 'exists'
        });
      }).toThrow('Path traversal not allowed');
    });
  });
});