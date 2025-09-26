import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('FileSystemDataSource - File Permissions and Attributes', () => {
  let dataSource;
  let testDir;
  
  beforeEach(() => {
    // Create test directory
    testDir = path.join(os.tmpdir(), `fs-permissions-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    // Create test files with different permissions
    fs.writeFileSync(path.join(testDir, 'normal-file.txt'), 'Normal file content');
    fs.writeFileSync(path.join(testDir, 'readonly-file.txt'), 'Read-only file content');
    fs.writeFileSync(path.join(testDir, 'executable-file.sh'), '#!/bin/bash\necho "Hello"');
    
    // Set different permissions
    if (process.platform !== 'win32') {
      fs.chmodSync(path.join(testDir, 'readonly-file.txt'), 0o444); // Read-only
      fs.chmodSync(path.join(testDir, 'executable-file.sh'), 0o755); // Executable
    }
    
    // Create subdirectory
    fs.mkdirSync(path.join(testDir, 'subdir'));
    
    dataSource = new FileSystemDataSource({ rootPath: testDir });
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      // Reset permissions before cleanup to avoid permission errors
      if (process.platform !== 'win32') {
        try {
          fs.chmodSync(path.join(testDir, 'readonly-file.txt'), 0o644);
        } catch (error) {
          // Ignore permission errors during cleanup
        }
      }
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('File Permissions Metadata', () => {
    it('should return file permissions in metadata', () => {
      const metadata = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'metadata',
        metadata: ['permissions', 'mode', 'isReadable', 'isWritable', 'isExecutable']
      });
      
      expect(metadata.permissions).toBeDefined();
      expect(metadata.mode).toBeDefined();
      expect(typeof metadata.isReadable).toBe('boolean');
      expect(typeof metadata.isWritable).toBe('boolean');
      expect(typeof metadata.isExecutable).toBe('boolean');
    });
    
    it('should detect read-only files', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const metadata = dataSource.query({
        type: 'file',
        path: 'readonly-file.txt',
        operation: 'metadata',
        metadata: ['isReadable', 'isWritable', 'isExecutable']
      });
      
      expect(metadata.isReadable).toBe(true);
      expect(metadata.isWritable).toBe(false);
      expect(metadata.isExecutable).toBe(false);
    });
    
    it('should detect executable files', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const metadata = dataSource.query({
        type: 'file',
        path: 'executable-file.sh',
        operation: 'metadata',
        metadata: ['isReadable', 'isWritable', 'isExecutable']
      });
      
      expect(metadata.isReadable).toBe(true);
      expect(metadata.isWritable).toBe(true);
      expect(metadata.isExecutable).toBe(true);
    });
    
    it('should return octal permissions format', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const metadata = dataSource.query({
        type: 'file',
        path: 'readonly-file.txt',
        operation: 'metadata',
        metadata: ['permissions', 'octalMode']
      });
      
      expect(metadata.permissions).toMatch(/^r--r--r--$/);
      expect(metadata.octalMode).toBe('444');
    });
    
    it('should return human-readable permissions', () => {
      const metadata = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'metadata',
        metadata: ['permissions', 'permissionString']
      });
      
      expect(metadata.permissions).toMatch(/^[rwx-]{9}$/);
      expect(metadata.permissionString).toMatch(/^[rwx-]{9}$/);
    });
  });
  
  describe('Directory Permissions', () => {
    it('should return directory permissions', () => {
      const metadata = dataSource.query({
        type: 'directory',
        path: 'subdir',
        operation: 'metadata',
        metadata: ['permissions', 'isReadable', 'isWritable', 'isExecutable']
      });
      
      expect(metadata.permissions).toBeDefined();
      expect(typeof metadata.isReadable).toBe('boolean');
      expect(typeof metadata.isWritable).toBe('boolean');
      expect(typeof metadata.isExecutable).toBe('boolean'); // Execute = searchable for directories
    });
    
    it('should detect directory access permissions', () => {
      const metadata = dataSource.query({
        type: 'directory',
        path: 'subdir',
        operation: 'metadata',
        metadata: ['isReadable', 'isWritable', 'isExecutable']
      });
      
      // Should be able to read and write to created directory
      expect(metadata.isReadable).toBe(true);
      expect(metadata.isWritable).toBe(true);
      expect(metadata.isExecutable).toBe(true); // Should be searchable
    });
  });
  
  describe('File Attributes', () => {
    it('should return file owner information', () => {
      const metadata = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'metadata',
        metadata: ['uid', 'gid', 'owner', 'group']
      });
      
      expect(typeof metadata.uid).toBe('number');
      expect(typeof metadata.gid).toBe('number');
      // owner and group might not be available on all systems
      if (metadata.owner !== undefined) {
        expect(typeof metadata.owner).toBe('string');
      }
      if (metadata.group !== undefined) {
        expect(typeof metadata.group).toBe('string');
      }
    });
    
    it('should return file type attributes', () => {
      const metadata = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'metadata',
        metadata: ['isFile', 'isDirectory', 'isSymlink', 'isBlockDevice', 'isCharacterDevice', 'isFIFO', 'isSocket']
      });
      
      expect(metadata.isFile).toBe(true);
      expect(metadata.isDirectory).toBe(false);
      expect(metadata.isSymlink).toBe(false);
      expect(metadata.isBlockDevice).toBe(false);
      expect(metadata.isCharacterDevice).toBe(false);
      expect(metadata.isFIFO).toBe(false);
      expect(metadata.isSocket).toBe(false);
    });
    
    it('should return inode information', () => {
      const metadata = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'metadata',
        metadata: ['ino', 'dev', 'nlink']
      });
      
      expect(typeof metadata.ino).toBe('number');
      expect(typeof metadata.dev).toBe('number');
      expect(typeof metadata.nlink).toBe('number');
      expect(metadata.nlink).toBeGreaterThan(0);
    });
    
    it('should return extended file attributes', () => {
      const metadata = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'metadata',
        metadata: ['blocks', 'blksize']
      });
      
      // These might not be available on all systems
      if (metadata.blocks !== undefined) {
        expect(typeof metadata.blocks).toBe('number');
      }
      if (metadata.blksize !== undefined) {
        expect(typeof metadata.blksize).toBe('number');
      }
    });
  });
  
  describe('Permission Modification', () => {
    it('should change file permissions', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const result = dataSource.update({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'chmod',
        mode: 0o644
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('chmod');
      
      // Verify permissions changed
      const metadata = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'metadata',
        metadata: ['mode', 'octalMode']
      });
      
      expect(metadata.octalMode).toBe('644');
    });
    
    it('should change permissions using octal string', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const result = dataSource.update({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'chmod',
        mode: '755'
      });
      
      expect(result.success).toBe(true);
      
      // Verify permissions changed
      const metadata = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'metadata',
        metadata: ['octalMode']
      });
      
      expect(metadata.octalMode).toBe('755');
    });
    
    it('should change permissions using symbolic notation', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const result = dataSource.update({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'chmod',
        mode: 'u+x'  // Add execute permission for user
      });
      
      expect(result.success).toBe(true);
      
      // Verify execute permission was added
      const metadata = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'metadata',
        metadata: ['isExecutable']
      });
      
      expect(metadata.isExecutable).toBe(true);
    });
    
    it('should change directory permissions', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const result = dataSource.update({
        type: 'directory',
        path: 'subdir',
        operation: 'chmod',
        mode: 0o755
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('chmod');
    });
  });
  
  describe('Ownership Modification', () => {
    it.skip('should change file owner (if running as root)', function() {
      // Skip this test - we're not running as root and this would require elevated privileges
      
      const result = dataSource.update({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'chown',
        uid: 1000,
        gid: 1000
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('chown');
    });
    
    it('should handle chown errors gracefully when not root', function() {
      if (process.platform === 'win32' || process.getuid() === 0) {
        return; // Skip on Windows or when running as root
      }
      
      expect(() => {
        dataSource.update({
          type: 'file',
          path: 'normal-file.txt',
          operation: 'chown',
          uid: 0,
          gid: 0
        });
      }).toThrow(/Permission denied|Operation not permitted/);
    });
  });
  
  describe('Permission Checking', () => {
    it('should check file access permissions', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'access',
        mode: 'r' // Check read access
      });
      
      expect(result.accessible).toBe(true);
      expect(result.mode).toBe('r');
    });
    
    it('should check multiple access modes', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'access',
        mode: 'rw' // Check read and write access
      });
      
      expect(result.accessible).toBe(true);
      expect(result.mode).toBe('rw');
    });
    
    it('should return false for inaccessible files', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const result = dataSource.query({
        type: 'file',
        path: 'readonly-file.txt',
        operation: 'access',
        mode: 'w' // Check write access on read-only file
      });
      
      expect(result.accessible).toBe(false);
      expect(result.mode).toBe('w');
    });
  });
  
  describe('Permission-based Filtering', () => {
    it('should filter files by readable permission', () => {
      const entries = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { readable: true }
      });
      
      // All test files should be readable
      const files = entries.filter(entry => entry.isFile);
      expect(files.length).toBeGreaterThan(0);
      expect(files.every(file => file.isReadable)).toBe(true);
    });
    
    it('should filter files by writable permission', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const entries = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { writable: false }
      });
      
      // Should find the read-only file
      const readOnlyFiles = entries.filter(entry => entry.name === 'readonly-file.txt');
      expect(readOnlyFiles.length).toBe(1);
      expect(readOnlyFiles[0].isWritable).toBe(false);
    });
    
    it('should filter files by executable permission', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const entries = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { executable: true }
      });
      
      // Should find the executable file
      const executableFiles = entries.filter(entry => entry.name === 'executable-file.sh');
      expect(executableFiles.length).toBe(1);
      expect(executableFiles[0].isExecutable).toBe(true);
    });
    
    it('should filter files by permission pattern', function() {
      if (process.platform === 'win32') {
        this.skip(); // Skip on Windows due to different permission model
      }
      
      const entries = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { permissions: 'r--r--r--' }
      });
      
      // Should find the read-only file
      const readOnlyFiles = entries.filter(entry => entry.name === 'readonly-file.txt');
      expect(readOnlyFiles.length).toBe(1);
    });
  });
});