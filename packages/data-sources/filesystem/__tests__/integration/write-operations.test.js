/**
 * Integration tests for write operations through handles
 * Tests create, write, append, delete, copy, and move through ServerFileHandle and ServerDirectoryHandle
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

describe('Handle Write Operations Integration', () => {
  const testRoot = path.join(__dirname, '../tmp/write-ops-test');
  let dataSource;
  let rootDir;
  
  beforeAll(() => {
    // Create test directory structure
    fs.mkdirSync(testRoot, { recursive: true });
    
    // Initialize datasource
    dataSource = new FileSystemDataSource({ rootPath: testRoot });
    rootDir = new ServerDirectoryHandle(dataSource, '');
  });
  
  afterAll(() => {
    // Clean up test directory
    fs.rmSync(testRoot, { recursive: true, force: true });
  });
  
  beforeEach(() => {
    // Clean directory contents but not the directory itself
    const files = fs.readdirSync(testRoot);
    for (const file of files) {
      const filePath = path.join(testRoot, file);
      fs.rmSync(filePath, { recursive: true, force: true });
    }
  });
  
  describe('ServerFileHandle write operations', () => {
    it('should write content to file', () => {
      // Create a file first
      fs.writeFileSync(path.join(testRoot, 'test.txt'), 'original');
      
      const fileHandle = new ServerFileHandle(dataSource, 'test.txt');
      const result = fileHandle.write('new content');
      
      expect(result.success).toBe(true);
      expect(fileHandle.content()).toBe('new content');
    });
    
    it('should create file if it does not exist when writing', () => {
      const fileHandle = new ServerFileHandle(dataSource, 'new.txt');
      const result = fileHandle.write('created content');
      
      expect(result.success).toBe(true);
      expect(fileHandle.exists()).toBe(true);
      expect(fileHandle.content()).toBe('created content');
    });
    
    it('should append content to file', () => {
      fs.writeFileSync(path.join(testRoot, 'append.txt'), 'line1\n');
      
      const fileHandle = new ServerFileHandle(dataSource, 'append.txt');
      const result = fileHandle.append('line2\n');
      
      expect(result.success).toBe(true);
      expect(fileHandle.content()).toBe('line1\nline2\n');
    });
    
    it('should delete file', () => {
      fs.writeFileSync(path.join(testRoot, 'delete.txt'), 'delete me');
      
      const fileHandle = new ServerFileHandle(dataSource, 'delete.txt');
      expect(fileHandle.exists()).toBe(true);
      
      const result = fileHandle.delete();
      
      expect(result.success).toBe(true);
      expect(fileHandle.exists()).toBe(false);
    });
    
    it('should copy file to new location', () => {
      fs.writeFileSync(path.join(testRoot, 'source.txt'), 'copy me');
      
      const fileHandle = new ServerFileHandle(dataSource, 'source.txt');
      const result = fileHandle.copyTo('copied.txt');
      
      expect(result.success).toBe(true);
      expect(fileHandle.exists()).toBe(true); // Source still exists
      
      const copiedHandle = new ServerFileHandle(dataSource, 'copied.txt');
      expect(copiedHandle.exists()).toBe(true);
      expect(copiedHandle.content()).toBe('copy me');
    });
    
    it('should move file to new location', () => {
      fs.writeFileSync(path.join(testRoot, 'move-me.txt'), 'move content');
      
      const fileHandle = new ServerFileHandle(dataSource, 'move-me.txt');
      const result = fileHandle.moveTo('moved.txt');
      
      expect(result.success).toBe(true);
      expect(fileHandle.exists()).toBe(false); // Source removed
      
      const movedHandle = new ServerFileHandle(dataSource, 'moved.txt');
      expect(movedHandle.exists()).toBe(true);
      expect(movedHandle.content()).toBe('move content');
    });
  });
  
  describe('ServerDirectoryHandle write operations', () => {
    it('should create subdirectory', () => {
      const result = rootDir.createDirectory('newdir');
      
      expect(result.success).toBe(true);
      
      const subdirHandle = rootDir.directory('newdir');
      expect(subdirHandle.exists()).toBe(true);
    });
    
    it('should create file in directory', () => {
      const result = rootDir.createFile('newfile.txt', 'file content');
      
      expect(result.success).toBe(true);
      
      const fileHandle = rootDir.file('newfile.txt');
      expect(fileHandle.exists()).toBe(true);
      expect(fileHandle.content()).toBe('file content');
    });
    
    it('should delete empty directory', () => {
      fs.mkdirSync(path.join(testRoot, 'empty-dir'));
      
      const dirHandle = rootDir.directory('empty-dir');
      expect(dirHandle.exists()).toBe(true);
      
      const result = dirHandle.delete();
      
      expect(result.success).toBe(true);
      expect(dirHandle.exists()).toBe(false);
    });
    
    it('should delete directory recursively', () => {
      const dirPath = path.join(testRoot, 'full-dir');
      fs.mkdirSync(dirPath);
      fs.writeFileSync(path.join(dirPath, 'file.txt'), 'content');
      fs.mkdirSync(path.join(dirPath, 'subdir'));
      
      const dirHandle = rootDir.directory('full-dir');
      const result = dirHandle.delete(true); // recursive
      
      expect(result.success).toBe(true);
      expect(dirHandle.exists()).toBe(false);
    });
    
    it('should copy directory recursively', () => {
      const sourceDir = path.join(testRoot, 'source-dir');
      fs.mkdirSync(sourceDir);
      fs.writeFileSync(path.join(sourceDir, 'file.txt'), 'content');
      fs.mkdirSync(path.join(sourceDir, 'subdir'));
      fs.writeFileSync(path.join(sourceDir, 'subdir/nested.txt'), 'nested');
      
      const dirHandle = rootDir.directory('source-dir');
      const result = dirHandle.copyTo('copied-dir');
      
      expect(result.success).toBe(true);
      expect(dirHandle.exists()).toBe(true); // Source still exists
      
      const copiedHandle = rootDir.directory('copied-dir');
      expect(copiedHandle.exists()).toBe(true);
      
      const files = copiedHandle.list();
      expect(files.length).toBeGreaterThan(0);
      
      const nestedFile = copiedHandle.directory('subdir').file('nested.txt');
      expect(nestedFile.content()).toBe('nested');
    });
    
    it('should move directory to new location', () => {
      const sourceDir = path.join(testRoot, 'move-dir');
      fs.mkdirSync(sourceDir);
      fs.writeFileSync(path.join(sourceDir, 'file.txt'), 'content');
      
      const dirHandle = rootDir.directory('move-dir');
      const result = dirHandle.moveTo('moved-dir');
      
      expect(result.success).toBe(true);
      expect(dirHandle.exists()).toBe(false); // Source removed
      
      const movedHandle = rootDir.directory('moved-dir');
      expect(movedHandle.exists()).toBe(true);
      
      const fileInMoved = movedHandle.file('file.txt');
      expect(fileInMoved.content()).toBe('content');
    });
  });
  
  describe('Combined operations', () => {
    it('should create nested structure through handles', () => {
      // Create directory
      rootDir.createDirectory('project');
      const projectDir = rootDir.directory('project');
      
      // Create subdirectory
      projectDir.createDirectory('src');
      const srcDir = projectDir.directory('src');
      
      // Create files
      projectDir.createFile('package.json', '{"name": "test"}');
      srcDir.createFile('index.js', 'console.log("hello");');
      
      // Verify structure
      expect(projectDir.exists()).toBe(true);
      expect(srcDir.exists()).toBe(true);
      expect(projectDir.file('package.json').content()).toBe('{"name": "test"}');
      expect(srcDir.file('index.js').content()).toBe('console.log("hello");');
      
      // List project directory
      const projectFiles = projectDir.list();
      const fileNames = projectFiles.map(f => f.name);
      expect(fileNames).toContain('package.json');
      expect(fileNames).toContain('src');
    });
    
    it('should handle complex file operations', () => {
      // Create initial file
      const file1 = rootDir.createFile('original.txt', 'v1');
      const handle1 = rootDir.file('original.txt');
      
      // Copy it
      handle1.copyTo('backup.txt');
      
      // Modify original
      handle1.write('v2');
      
      // Verify both exist with different content
      expect(handle1.content()).toBe('v2');
      
      const backupHandle = rootDir.file('backup.txt');
      expect(backupHandle.content()).toBe('v1');
      
      // Move backup
      backupHandle.moveTo('archive.txt');
      
      expect(backupHandle.exists()).toBe(false);
      const archiveHandle = rootDir.file('archive.txt');
      expect(archiveHandle.content()).toBe('v1');
    });
  });
});