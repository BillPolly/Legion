import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ServerDirectoryHandle } from '../../src/handles/ServerDirectoryHandle.js';
import { ServerFileHandle } from '../../src/handles/ServerFileHandle.js';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ServerDirectoryHandle', () => {
  let dataSource;
  let dirHandle;
  let testDir;
  
  beforeEach(() => {
    // Create test directory structure
    testDir = path.join(os.tmpdir(), `fs-dir-handle-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'subdir'));
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(testDir, 'file2.js'), 'console.log("test");');
    fs.writeFileSync(path.join(testDir, 'subdir', 'nested.txt'), 'nested content');
    
    // Create datasource
    dataSource = new FileSystemDataSource({ rootPath: testDir });
    
    // Create directory handle for root
    dirHandle = new ServerDirectoryHandle(dataSource, '');
  });
  
  afterEach(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('constructor', () => {
    it('should create instance with datasource and path', () => {
      expect(dirHandle).toBeDefined();
      expect(dirHandle.dataSource).toBe(dataSource);
      expect(dirHandle.path).toBe('');
    });
    
    it('should validate datasource interface', () => {
      expect(() => {
        new ServerDirectoryHandle(null, '');
      }).toThrow();
      
      expect(() => {
        new ServerDirectoryHandle({}, '');
      }).toThrow();
    });
    
    it('should handle subdirectory path', () => {
      const subdirHandle = new ServerDirectoryHandle(dataSource, 'subdir');
      expect(subdirHandle.path).toBe('subdir');
    });
  });
  
  describe('value() method', () => {
    it('should return directory metadata', () => {
      const metadata = dirHandle.value();
      
      expect(metadata).toBeDefined();
      expect(metadata.path).toBe(testDir);
      expect(metadata.isFile).toBe(false);
      expect(metadata.isDirectory).toBe(true);
    });
    
    it('should return subdirectory metadata', () => {
      const subdirHandle = new ServerDirectoryHandle(dataSource, 'subdir');
      const metadata = subdirHandle.value();
      
      expect(metadata.name).toBe('subdir');
      expect(metadata.path).toBe(path.join(testDir, 'subdir'));
      expect(metadata.isDirectory).toBe(true);
    });
    
    it('should throw error for non-existent directory', () => {
      const missingHandle = new ServerDirectoryHandle(dataSource, 'missing');
      
      expect(() => {
        missingHandle.value();
      }).toThrow('Directory not found');
    });
  });
  
  describe('list() method', () => {
    it('should list directory contents', () => {
      const entries = dirHandle.list();
      
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBe(3); // file1.txt, file2.js, subdir
      
      const names = entries.map(e => e.name).sort();
      expect(names).toEqual(['file1.txt', 'file2.js', 'subdir']);
    });
    
    it('should accept filter options', () => {
      const files = dirHandle.list({ filter: { type: 'file' } });
      expect(files.length).toBe(2);
      expect(files.every(e => e.isFile)).toBe(true);
      
      const dirs = dirHandle.list({ filter: { type: 'directory' } });
      expect(dirs.length).toBe(1);
      expect(dirs[0].name).toBe('subdir');
    });
    
    it('should accept sort options', () => {
      const sorted = dirHandle.list({ sort: { by: 'name', order: 'desc' } });
      const names = sorted.map(e => e.name);
      expect(names).toEqual(['subdir', 'file2.js', 'file1.txt']);
    });
    
    it('should list subdirectory contents', () => {
      const subdirHandle = new ServerDirectoryHandle(dataSource, 'subdir');
      const entries = subdirHandle.list();
      
      expect(entries.length).toBe(1);
      expect(entries[0].name).toBe('nested.txt');
    });
  });
  
  describe('file() method', () => {
    it('should return ServerFileHandle for file', () => {
      const fileHandle = dirHandle.file('file1.txt');
      
      expect(fileHandle).toBeInstanceOf(ServerFileHandle);
      expect(fileHandle.path).toBe('file1.txt');
      expect(fileHandle.dataSource).toBe(dataSource);
    });
    
    it('should handle nested file paths', () => {
      const fileHandle = dirHandle.file('subdir/nested.txt');
      
      expect(fileHandle).toBeInstanceOf(ServerFileHandle);
      expect(fileHandle.path).toBe('subdir/nested.txt');
    });
    
    it('should return handle even for non-existent file', () => {
      const fileHandle = dirHandle.file('missing.txt');
      
      expect(fileHandle).toBeInstanceOf(ServerFileHandle);
      expect(fileHandle.exists()).toBe(false);
    });
  });
  
  describe('directory() method', () => {
    it('should return ServerDirectoryHandle for subdirectory', () => {
      const subdirHandle = dirHandle.directory('subdir');
      
      expect(subdirHandle).toBeInstanceOf(ServerDirectoryHandle);
      expect(subdirHandle.path).toBe('subdir');
      expect(subdirHandle.dataSource).toBe(dataSource);
    });
    
    it('should handle nested directory paths', () => {
      fs.mkdirSync(path.join(testDir, 'subdir', 'deep'));
      
      const deepHandle = dirHandle.directory('subdir/deep');
      
      expect(deepHandle).toBeInstanceOf(ServerDirectoryHandle);
      expect(deepHandle.path).toBe('subdir/deep');
    });
    
    it('should return handle even for non-existent directory', () => {
      const missingHandle = dirHandle.directory('missing');
      
      expect(missingHandle).toBeInstanceOf(ServerDirectoryHandle);
      expect(missingHandle.exists()).toBe(false);
    });
  });
  
  describe('exists() method', () => {
    it('should return true for existing directory', () => {
      expect(dirHandle.exists()).toBe(true);
      
      const subdirHandle = new ServerDirectoryHandle(dataSource, 'subdir');
      expect(subdirHandle.exists()).toBe(true);
    });
    
    it('should return false for non-existent directory', () => {
      const missingHandle = new ServerDirectoryHandle(dataSource, 'missing');
      expect(missingHandle.exists()).toBe(false);
    });
  });
  
  describe('isEmpty() method', () => {
    it('should return false for non-empty directory', () => {
      expect(dirHandle.isEmpty()).toBe(false);
    });
    
    it('should return true for empty directory', () => {
      fs.mkdirSync(path.join(testDir, 'empty'));
      const emptyHandle = new ServerDirectoryHandle(dataSource, 'empty');
      expect(emptyHandle.isEmpty()).toBe(true);
    });
  });
  
  // Search operations will be implemented in Phase 5
  describe('search operations (Phase 5)', () => {
    it.skip('should have search() method', () => {
      expect(typeof dirHandle.search).toBe('function');
    });
    
    it.skip('should have findByContent() method', () => {
      expect(typeof dirHandle.findByContent).toBe('function');
    });
  });
  
  // Write operations will be implemented in Phase 4
  describe('write operations (Phase 4)', () => {
    it.skip('should have createDirectory() method', () => {
      expect(typeof dirHandle.createDirectory).toBe('function');
    });
    
    it.skip('should have createFile() method', () => {
      expect(typeof dirHandle.createFile).toBe('function');
    });
    
    it.skip('should have delete() method', () => {
      expect(typeof dirHandle.delete).toBe('function');
    });
  });
});