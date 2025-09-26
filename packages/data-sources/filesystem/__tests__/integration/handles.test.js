/**
 * Integration tests for Handle classes with FileSystemDataSource
 * Tests real filesystem operations through Handle interface
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import { ServerFileHandle } from '../../src/handles/ServerFileHandle.js';
import { ServerDirectoryHandle } from '../../src/handles/ServerDirectoryHandle.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Handle Classes Integration', () => {
  const testRoot = path.join(__dirname, '../tmp/handles-test');
  let dataSource;
  
  beforeAll(() => {
    // Create test directory structure
    fs.mkdirSync(testRoot, { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'subdir1'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'subdir2'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'subdir1/nested'), { recursive: true });
    
    // Create test files
    fs.writeFileSync(path.join(testRoot, 'file1.txt'), 'Content of file 1');
    fs.writeFileSync(path.join(testRoot, 'file2.json'), '{"key": "value"}');
    fs.writeFileSync(path.join(testRoot, 'subdir1/sub-file.txt'), 'Subdirectory file');
    fs.writeFileSync(path.join(testRoot, 'subdir1/nested/deep.txt'), 'Deep nested file');
    
    // Initialize datasource
    dataSource = new FileSystemDataSource({ rootPath: testRoot });
  });
  
  afterAll(() => {
    // Clean up test directory
    fs.rmSync(testRoot, { recursive: true, force: true });
  });
  
  describe('ServerFileHandle integration', () => {
    it('should read file through handle', () => {
      const fileHandle = new ServerFileHandle(dataSource, 'file1.txt');
      
      // Test value() method
      const metadata = fileHandle.value();
      expect(metadata.name).toBe('file1.txt');
      expect(metadata.size).toBe(17); // 'Content of file 1'
      expect(metadata.isFile).toBe(true);
      
      // Test content() method
      const content = fileHandle.content();
      expect(content).toBe('Content of file 1');
      
      // Test exists() method
      expect(fileHandle.exists()).toBe(true);
      
      // Test size() method
      expect(fileHandle.size()).toBe(17);
      
      // Test path utility methods
      expect(fileHandle.name()).toBe('file1.txt');
      expect(fileHandle.extension()).toBe('.txt');
      expect(fileHandle.basename()).toBe('file1');
    });
    
    it('should read JSON file with different encoding', () => {
      const jsonHandle = new ServerFileHandle(dataSource, 'file2.json');
      
      // Read as UTF-8
      const textContent = jsonHandle.content('utf8');
      expect(textContent).toBe('{"key": "value"}');
      
      // Read as base64
      const base64Content = jsonHandle.content('base64');
      const decoded = Buffer.from(base64Content, 'base64').toString('utf8');
      expect(decoded).toBe('{"key": "value"}');
      
      // Read as buffer
      const bufferContent = jsonHandle.content('buffer');
      expect(bufferContent).toBeInstanceOf(Buffer);
      expect(bufferContent.toString()).toBe('{"key": "value"}');
    });
    
    it('should handle nested file paths', () => {
      const nestedFile = new ServerFileHandle(dataSource, 'subdir1/nested/deep.txt');
      
      expect(nestedFile.exists()).toBe(true);
      expect(nestedFile.content()).toBe('Deep nested file');
      expect(nestedFile.name()).toBe('deep.txt');
      expect(nestedFile.dirname()).toBe('subdir1/nested');
    });
  });
  
  describe('ServerDirectoryHandle integration', () => {
    it('should list directory contents', () => {
      const dirHandle = new ServerDirectoryHandle(dataSource, '');
      
      // Test value() method
      const metadata = dirHandle.value();
      expect(metadata.name).toBe('handles-test');
      expect(metadata.isDirectory).toBe(true);
      expect(metadata.isFile).toBe(false);
      
      // Test list() method
      const entries = dirHandle.list();
      expect(entries.length).toBeGreaterThan(0);
      
      const fileNames = entries.map(e => e.name);
      expect(fileNames).toContain('file1.txt');
      expect(fileNames).toContain('file2.json');
      expect(fileNames).toContain('subdir1');
      expect(fileNames).toContain('subdir2');
      
      // Test exists() method
      expect(dirHandle.exists()).toBe(true);
    });
    
    it('should filter directory listings', () => {
      const dirHandle = new ServerDirectoryHandle(dataSource, '');
      
      // Filter for files only
      const files = dirHandle.list({ filter: { type: 'file' } });
      expect(files.every(f => f.isFile)).toBe(true);
      expect(files.length).toBe(2); // file1.txt, file2.json
      
      // Filter for directories only
      const dirs = dirHandle.list({ filter: { type: 'directory' } });
      expect(dirs.every(d => d.isDirectory)).toBe(true);
      expect(dirs.length).toBe(2); // subdir1, subdir2
      
      // Filter by extension
      const txtFiles = dirHandle.list({ filter: { extension: '.txt' } });
      expect(txtFiles.every(f => f.name.endsWith('.txt'))).toBe(true);
      expect(txtFiles.length).toBe(1); // file1.txt
    });
    
    it('should sort directory listings', () => {
      const dirHandle = new ServerDirectoryHandle(dataSource, '');
      
      // Sort by name ascending
      const sortedAsc = dirHandle.list({ sort: { by: 'name', order: 'asc' } });
      expect(sortedAsc[0].name).toBe('file1.txt');
      
      // Sort by name descending
      const sortedDesc = dirHandle.list({ sort: { by: 'name', order: 'desc' } });
      expect(sortedDesc[0].name).toBe('subdir2');
      
      // Sort by size
      const sortedBySize = dirHandle.list({ 
        filter: { type: 'file' },
        sort: { by: 'size', order: 'asc' } 
      });
      expect(sortedBySize[0].name).toBe('file2.json'); // '{"key": "value"}' = 16 bytes
      expect(sortedBySize[1].name).toBe('file1.txt'); // 'Content of file 1' = 17 bytes
    });
    
    it('should navigate to subdirectories', () => {
      const dirHandle = new ServerDirectoryHandle(dataSource, '');
      
      // Get subdirectory handle
      const subdirHandle = dirHandle.directory('subdir1');
      expect(subdirHandle).toBeInstanceOf(ServerDirectoryHandle);
      expect(subdirHandle.path).toBe('subdir1');
      expect(subdirHandle.exists()).toBe(true);
      
      // List subdirectory contents
      const subdirContents = subdirHandle.list();
      const names = subdirContents.map(e => e.name);
      expect(names).toContain('sub-file.txt');
      expect(names).toContain('nested');
      
      // Navigate deeper
      const nestedHandle = subdirHandle.directory('nested');
      expect(nestedHandle.exists()).toBe(true);
      const nestedContents = nestedHandle.list();
      expect(nestedContents[0].name).toBe('deep.txt');
    });
    
    it('should get file handles from directory', () => {
      const dirHandle = new ServerDirectoryHandle(dataSource, '');
      
      // Get file handle
      const fileHandle = dirHandle.file('file1.txt');
      expect(fileHandle).toBeInstanceOf(ServerFileHandle);
      expect(fileHandle.path).toBe('file1.txt');
      expect(fileHandle.exists()).toBe(true);
      expect(fileHandle.content()).toBe('Content of file 1');
      
      // Get file in subdirectory
      const subdirHandle = dirHandle.directory('subdir1');
      const subFileHandle = subdirHandle.file('sub-file.txt');
      expect(subFileHandle.exists()).toBe(true);
      expect(subFileHandle.content()).toBe('Subdirectory file');
    });
    
    it('should check if directory is empty', () => {
      const emptyDirPath = path.join(testRoot, 'empty');
      fs.mkdirSync(emptyDirPath, { recursive: true });
      
      const emptyHandle = new ServerDirectoryHandle(dataSource, 'empty');
      expect(emptyHandle.isEmpty()).toBe(true);
      
      const nonEmptyHandle = new ServerDirectoryHandle(dataSource, 'subdir1');
      expect(nonEmptyHandle.isEmpty()).toBe(false);
      
      fs.rmSync(emptyDirPath, { recursive: true });
    });
    
    it('should count directory entries', () => {
      const dirHandle = new ServerDirectoryHandle(dataSource, '');
      
      expect(dirHandle.count()).toBe(4); // 2 files + 2 directories
      expect(dirHandle.count({ type: 'file' })).toBe(2);
      expect(dirHandle.count({ type: 'directory' })).toBe(2);
    });
    
    it('should get directory name and parent path', () => {
      const subdirHandle = new ServerDirectoryHandle(dataSource, 'subdir1/nested');
      
      expect(subdirHandle.name()).toBe('nested');
      expect(subdirHandle.dirname()).toBe(path.join(testRoot, 'subdir1'));
    });
    
    it('should handle getAllFiles and getAllDirectories (basic)', () => {
      const dirHandle = new ServerDirectoryHandle(dataSource, '');
      
      // Basic implementation - non-recursive for now
      const allFiles = dirHandle.getAllFiles();
      expect(allFiles.length).toBe(2); // Just files in root
      
      const allDirs = dirHandle.getAllDirectories();
      expect(allDirs.length).toBe(2); // Just directories in root
    });
  });
  
  describe('Handle interoperability', () => {
    it('should navigate between handles seamlessly', () => {
      // Start with root directory
      const rootDir = new ServerDirectoryHandle(dataSource, '');
      
      // Navigate to subdirectory
      const subdir1 = rootDir.directory('subdir1');
      expect(subdir1.exists()).toBe(true);
      
      // Get file in subdirectory
      const file = subdir1.file('sub-file.txt');
      expect(file.content()).toBe('Subdirectory file');
      
      // Navigate to nested directory
      const nested = subdir1.directory('nested');
      expect(nested.exists()).toBe(true);
      
      // Get file in nested directory
      const deepFile = nested.file('deep.txt');
      expect(deepFile.content()).toBe('Deep nested file');
      
      // Check paths are correct
      expect(deepFile.path).toBe('subdir1/nested/deep.txt');
      expect(deepFile.dirname()).toBe('subdir1/nested');
    });
    
    it('should handle non-existent paths gracefully', () => {
      const dirHandle = new ServerDirectoryHandle(dataSource, 'nonexistent');
      expect(dirHandle.exists()).toBe(false);
      
      expect(() => {
        dirHandle.list();
      }).toThrow('Directory not found');
      
      const fileHandle = new ServerFileHandle(dataSource, 'missing.txt');
      expect(fileHandle.exists()).toBe(false);
      expect(fileHandle.size()).toBe(0);
      
      expect(() => {
        fileHandle.content();
      }).toThrow('File not found');
    });
  });
});