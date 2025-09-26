import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ServerFileHandle } from '../../src/handles/ServerFileHandle.js';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ServerFileHandle', () => {
  let dataSource;
  let fileHandle;
  let testDir;
  let testFilePath;
  
  beforeEach(() => {
    // Create test directory and file
    testDir = path.join(os.tmpdir(), `fs-handle-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    testFilePath = path.join(testDir, 'test.txt');
    
    // Wait a tiny bit to ensure different timestamps
    const start = Date.now();
    while (Date.now() === start) { /* wait */ }
    
    fs.writeFileSync(testFilePath, 'Initial content');
    
    // Create datasource
    dataSource = new FileSystemDataSource({ rootPath: testDir });
    
    // Create file handle
    fileHandle = new ServerFileHandle(dataSource, 'test.txt');
  });
  
  afterEach(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('constructor', () => {
    it('should create instance with datasource and path', () => {
      expect(fileHandle).toBeDefined();
      expect(fileHandle.dataSource).toBe(dataSource);
      expect(fileHandle.path).toBe('test.txt');
    });
    
    it('should validate datasource interface', () => {
      expect(() => {
        new ServerFileHandle(null, 'test.txt');
      }).toThrow();
      
      expect(() => {
        new ServerFileHandle({}, 'test.txt');
      }).toThrow();
    });
    
    it('should require path', () => {
      expect(() => {
        new ServerFileHandle(dataSource);
      }).toThrow('Path is required for ServerFileHandle');
    });
  });
  
  describe('value() method', () => {
    it('should return file metadata', () => {
      const metadata = fileHandle.value();
      
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('test.txt');
      expect(metadata.path).toBe(testFilePath);
      expect(metadata.size).toBe(15); // 'Initial content'
      expect(metadata.isFile).toBe(true);
      expect(metadata.isDirectory).toBe(false);
    });
    
    it('should throw error for non-existent file', () => {
      const missingHandle = new ServerFileHandle(dataSource, 'missing.txt');
      
      expect(() => {
        missingHandle.value();
      }).toThrow('File not found');
    });
  });
  
  describe('content() method', () => {
    it('should read file content as UTF-8 by default', () => {
      const content = fileHandle.content();
      expect(content).toBe('Initial content');
    });
    
    it('should read file content with specific encoding', () => {
      const content = fileHandle.content('base64');
      expect(content).toBe(Buffer.from('Initial content').toString('base64'));
    });
    
    it('should read file content as buffer', () => {
      const content = fileHandle.content('buffer');
      expect(content).toBeInstanceOf(Buffer);
      expect(content.toString()).toBe('Initial content');
    });
  });
  
  describe('exists() method', () => {
    it('should return true for existing file', () => {
      expect(fileHandle.exists()).toBe(true);
    });
    
    it('should return false for non-existent file', () => {
      const missingHandle = new ServerFileHandle(dataSource, 'missing.txt');
      expect(missingHandle.exists()).toBe(false);
    });
  });
  
  describe('size() method', () => {
    it('should return file size', () => {
      expect(fileHandle.size()).toBe(15); // 'Initial content'
    });
    
    it('should return 0 for non-existent file', () => {
      const missingHandle = new ServerFileHandle(dataSource, 'missing.txt');
      expect(missingHandle.size()).toBe(0);
    });
  });
  
  describe('lastModified() method', () => {
    it('should return last modified date', () => {
      const mtime = fileHandle.lastModified();
      const afterTest = Date.now();
      // Jest has issues with Date instanceof checks
      expect(Object.prototype.toString.call(mtime)).toBe('[object Date]');
      expect(mtime.getTime()).toBeLessThanOrEqual(afterTest);
      // Should be recent (within last few seconds)
      expect(afterTest - mtime.getTime()).toBeLessThan(5000);
    });
  });
  
  // Write operations will be implemented in Phase 4
  describe('write operations (Phase 4)', () => {
    it.skip('should have write() method', () => {
      expect(typeof fileHandle.write).toBe('function');
    });
    
    it.skip('should have append() method', () => {
      expect(typeof fileHandle.append).toBe('function');
    });
    
    it.skip('should have delete() method', () => {
      expect(typeof fileHandle.delete).toBe('function');
    });
    
    it.skip('should have copyTo() method', () => {
      expect(typeof fileHandle.copyTo).toBe('function');
    });
    
    it.skip('should have moveTo() method', () => {
      expect(typeof fileHandle.moveTo).toBe('function');
    });
  });
  
  // Watch operations will be implemented in Phase 7
  describe('watch operations (Phase 7)', () => {
    it.skip('should have watch() method', () => {
      expect(typeof fileHandle.watch).toBe('function');
    });
  });
});