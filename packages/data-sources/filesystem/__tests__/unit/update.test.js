/**
 * Unit tests for FileSystemDataSource update operations
 * Tests write, append, create, delete, copy, and move operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileSystemDataSource - update operations', () => {
  const testRoot = path.join(__dirname, '../tmp/update-test');
  let dataSource;
  
  beforeEach(() => {
    // Create test directory
    fs.mkdirSync(testRoot, { recursive: true });
    dataSource = new FileSystemDataSource({ rootPath: testRoot });
  });
  
  afterEach(() => {
    // Clean up
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });
  
  describe('file operations', () => {
    describe('create operation', () => {
      it('should create new file with content', () => {
        const result = dataSource.update({
          operation: 'create',
          type: 'file',
          path: 'new-file.txt',
          content: 'Hello World',
          encoding: 'utf8'
        });
        
        expect(result.success).toBe(true);
        expect(result.operation).toBe('create');
        expect(result.path).toContain('new-file.txt');
        
        // Verify file was created
        const filePath = path.join(testRoot, 'new-file.txt');
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toBe('Hello World');
      });
      
      it('should create file with buffer content', () => {
        const buffer = Buffer.from('Binary content');
        const result = dataSource.update({
          operation: 'create',
          type: 'file',
          path: 'binary.dat',
          content: buffer,
          encoding: 'buffer'
        });
        
        expect(result.success).toBe(true);
        
        const filePath = path.join(testRoot, 'binary.dat');
        const readBuffer = fs.readFileSync(filePath);
        expect(readBuffer.equals(buffer)).toBe(true);
      });
      
      it('should create file in subdirectory', () => {
        // Create subdirectory first
        fs.mkdirSync(path.join(testRoot, 'subdir'), { recursive: true });
        
        const result = dataSource.update({
          operation: 'create',
          type: 'file',
          path: 'subdir/nested.txt',
          content: 'Nested content'
        });
        
        expect(result.success).toBe(true);
        
        const filePath = path.join(testRoot, 'subdir/nested.txt');
        expect(fs.existsSync(filePath)).toBe(true);
      });
      
      it('should fail if file already exists', () => {
        const filePath = path.join(testRoot, 'existing.txt');
        fs.writeFileSync(filePath, 'Existing content');
        
        expect(() => {
          dataSource.update({
            operation: 'create',
            type: 'file',
            path: 'existing.txt',
            content: 'New content'
          });
        }).toThrow('File already exists');
      });
    });
    
    describe('write operation', () => {
      it('should overwrite existing file', () => {
        const filePath = path.join(testRoot, 'overwrite.txt');
        fs.writeFileSync(filePath, 'Old content');
        
        const result = dataSource.update({
          operation: 'write',
          type: 'file',
          path: 'overwrite.txt',
          content: 'New content',
          encoding: 'utf8'
        });
        
        expect(result.success).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toBe('New content');
      });
      
      it('should create file if it does not exist', () => {
        const result = dataSource.update({
          operation: 'write',
          type: 'file',
          path: 'new-write.txt',
          content: 'Created by write'
        });
        
        expect(result.success).toBe(true);
        
        const filePath = path.join(testRoot, 'new-write.txt');
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toBe('Created by write');
      });
    });
    
    describe('append operation', () => {
      it('should append to existing file', () => {
        const filePath = path.join(testRoot, 'append.txt');
        fs.writeFileSync(filePath, 'Line 1\n');
        
        const result = dataSource.update({
          operation: 'append',
          type: 'file',
          path: 'append.txt',
          content: 'Line 2\n'
        });
        
        expect(result.success).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toBe('Line 1\nLine 2\n');
      });
      
      it('should create file if it does not exist', () => {
        const result = dataSource.update({
          operation: 'append',
          type: 'file',
          path: 'new-append.txt',
          content: 'First line'
        });
        
        expect(result.success).toBe(true);
        
        const filePath = path.join(testRoot, 'new-append.txt');
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toBe('First line');
      });
    });
    
    describe('delete operation', () => {
      it('should delete existing file', () => {
        const filePath = path.join(testRoot, 'delete-me.txt');
        fs.writeFileSync(filePath, 'Delete this');
        
        const result = dataSource.update({
          operation: 'delete',
          type: 'file',
          path: 'delete-me.txt'
        });
        
        expect(result.success).toBe(true);
        expect(fs.existsSync(filePath)).toBe(false);
      });
      
      it('should fail if file does not exist', () => {
        expect(() => {
          dataSource.update({
            operation: 'delete',
            type: 'file',
            path: 'non-existent.txt'
          });
        }).toThrow('Path does not exist');
      });
    });
    
    describe('copy operation', () => {
      it('should copy file to new location', () => {
        const sourcePath = path.join(testRoot, 'source.txt');
        fs.writeFileSync(sourcePath, 'Copy me');
        
        const result = dataSource.update({
          operation: 'copy',
          type: 'file',
          path: 'source.txt',
          destination: 'copy.txt'
        });
        
        expect(result.success).toBe(true);
        
        const destPath = path.join(testRoot, 'copy.txt');
        expect(fs.existsSync(sourcePath)).toBe(true); // Original still exists
        expect(fs.existsSync(destPath)).toBe(true);
        expect(fs.readFileSync(destPath, 'utf8')).toBe('Copy me');
      });
      
      it('should fail if destination already exists', () => {
        fs.writeFileSync(path.join(testRoot, 'source.txt'), 'Source');
        fs.writeFileSync(path.join(testRoot, 'dest.txt'), 'Existing');
        
        expect(() => {
          dataSource.update({
            operation: 'copy',
            type: 'file',
            path: 'source.txt',
            destination: 'dest.txt'
          });
        }).toThrow('Destination already exists');
      });
    });
    
    describe('move operation', () => {
      it('should move file to new location', () => {
        const sourcePath = path.join(testRoot, 'move-me.txt');
        fs.writeFileSync(sourcePath, 'Move me');
        
        const result = dataSource.update({
          operation: 'move',
          type: 'file',
          path: 'move-me.txt',
          destination: 'moved.txt'
        });
        
        expect(result.success).toBe(true);
        
        const destPath = path.join(testRoot, 'moved.txt');
        expect(fs.existsSync(sourcePath)).toBe(false); // Original removed
        expect(fs.existsSync(destPath)).toBe(true);
        expect(fs.readFileSync(destPath, 'utf8')).toBe('Move me');
      });
      
      it('should rename file in same directory', () => {
        const oldPath = path.join(testRoot, 'old-name.txt');
        fs.writeFileSync(oldPath, 'Rename me');
        
        const result = dataSource.update({
          operation: 'move',
          type: 'file',
          path: 'old-name.txt',
          destination: 'new-name.txt'
        });
        
        expect(result.success).toBe(true);
        
        const newPath = path.join(testRoot, 'new-name.txt');
        expect(fs.existsSync(oldPath)).toBe(false);
        expect(fs.existsSync(newPath)).toBe(true);
      });
    });
  });
  
  describe('directory operations', () => {
    describe('create operation', () => {
      it('should create new directory', () => {
        const result = dataSource.update({
          operation: 'create',
          type: 'directory',
          path: 'new-dir'
        });
        
        expect(result.success).toBe(true);
        
        const dirPath = path.join(testRoot, 'new-dir');
        expect(fs.existsSync(dirPath)).toBe(true);
        expect(fs.statSync(dirPath).isDirectory()).toBe(true);
      });
      
      it('should create nested directories', () => {
        const result = dataSource.update({
          operation: 'create',
          type: 'directory',
          path: 'parent/child/grandchild',
          recursive: true
        });
        
        expect(result.success).toBe(true);
        
        const dirPath = path.join(testRoot, 'parent/child/grandchild');
        expect(fs.existsSync(dirPath)).toBe(true);
      });
      
      it('should fail if directory already exists', () => {
        fs.mkdirSync(path.join(testRoot, 'existing-dir'));
        
        expect(() => {
          dataSource.update({
            operation: 'create',
            type: 'directory',
            path: 'existing-dir'
          });
        }).toThrow('Directory already exists');
      });
    });
    
    describe('delete operation', () => {
      it('should delete empty directory', () => {
        const dirPath = path.join(testRoot, 'empty-dir');
        fs.mkdirSync(dirPath);
        
        const result = dataSource.update({
          operation: 'delete',
          type: 'directory',
          path: 'empty-dir'
        });
        
        expect(result.success).toBe(true);
        expect(fs.existsSync(dirPath)).toBe(false);
      });
      
      it('should delete directory recursively', () => {
        const dirPath = path.join(testRoot, 'full-dir');
        fs.mkdirSync(dirPath);
        fs.writeFileSync(path.join(dirPath, 'file.txt'), 'content');
        fs.mkdirSync(path.join(dirPath, 'subdir'));
        
        const result = dataSource.update({
          operation: 'delete',
          type: 'directory',
          path: 'full-dir',
          recursive: true
        });
        
        expect(result.success).toBe(true);
        expect(fs.existsSync(dirPath)).toBe(false);
      });
      
      it('should fail if directory is not empty without recursive flag', () => {
        const dirPath = path.join(testRoot, 'full-dir');
        fs.mkdirSync(dirPath);
        fs.writeFileSync(path.join(dirPath, 'file.txt'), 'content');
        
        expect(() => {
          dataSource.update({
            operation: 'delete',
            type: 'directory',
            path: 'full-dir'
          });
        }).toThrow('Directory not empty');
      });
    });
    
    describe('copy operation', () => {
      it('should copy directory recursively', () => {
        const sourceDir = path.join(testRoot, 'source-dir');
        fs.mkdirSync(sourceDir);
        fs.writeFileSync(path.join(sourceDir, 'file.txt'), 'content');
        fs.mkdirSync(path.join(sourceDir, 'subdir'));
        fs.writeFileSync(path.join(sourceDir, 'subdir/nested.txt'), 'nested');
        
        const result = dataSource.update({
          operation: 'copy',
          type: 'directory',
          path: 'source-dir',
          destination: 'copy-dir'
        });
        
        expect(result.success).toBe(true);
        
        const destDir = path.join(testRoot, 'copy-dir');
        expect(fs.existsSync(destDir)).toBe(true);
        expect(fs.existsSync(path.join(destDir, 'file.txt'))).toBe(true);
        expect(fs.existsSync(path.join(destDir, 'subdir/nested.txt'))).toBe(true);
        expect(fs.existsSync(sourceDir)).toBe(true); // Original still exists
      });
    });
    
    describe('move operation', () => {
      it('should move directory to new location', () => {
        const sourceDir = path.join(testRoot, 'move-dir');
        fs.mkdirSync(sourceDir);
        fs.writeFileSync(path.join(sourceDir, 'file.txt'), 'content');
        
        const result = dataSource.update({
          operation: 'move',
          type: 'directory',
          path: 'move-dir',
          destination: 'moved-dir'
        });
        
        expect(result.success).toBe(true);
        
        const destDir = path.join(testRoot, 'moved-dir');
        expect(fs.existsSync(destDir)).toBe(true);
        expect(fs.existsSync(path.join(destDir, 'file.txt'))).toBe(true);
        expect(fs.existsSync(sourceDir)).toBe(false); // Original removed
      });
    });
  });
  
  describe('permission checks', () => {
    it('should respect read-only permissions', () => {
      const readOnlySource = new FileSystemDataSource({
        rootPath: testRoot,
        permissions: 'r'
      });
      
      expect(() => {
        readOnlySource.update({
          operation: 'write',
          type: 'file',
          path: 'test.txt',
          content: 'content'
        });
      }).toThrow('Write operations not permitted');
    });
  });
  
  describe('path security', () => {
    it('should prevent path traversal', () => {
      expect(() => {
        dataSource.update({
          operation: 'write',
          type: 'file',
          path: '../outside.txt',
          content: 'content'
        });
      }).toThrow('Path traversal not allowed');
    });
  });
});