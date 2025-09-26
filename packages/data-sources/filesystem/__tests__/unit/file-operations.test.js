/**
 * Unit tests for FileSystemDataSource file operations
 * Tests chmod, stats, links, and other file system operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileSystemDataSource - file operations', () => {
  const testRoot = path.join(__dirname, '../tmp/file-ops-test');
  let dataSource;
  
  beforeAll(() => {
    // Create test directory
    fs.mkdirSync(testRoot, { recursive: true });
    dataSource = new FileSystemDataSource({ rootPath: testRoot });
  });
  
  afterAll(() => {
    // Clean up test directory
    fs.rmSync(testRoot, { recursive: true, force: true });
  });
  
  beforeEach(() => {
    // Clean directory contents
    const files = fs.readdirSync(testRoot);
    for (const file of files) {
      const filePath = path.join(testRoot, file);
      fs.rmSync(filePath, { recursive: true, force: true });
    }
  });
  
  describe('chmod operations', () => {
    it('should change file permissions', () => {
      // Create a test file
      fs.writeFileSync(path.join(testRoot, 'test.txt'), 'content');
      
      const result = dataSource.update({
        operation: 'chmod',
        path: 'test.txt',
        mode: 0o644
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('chmod');
      
      const stats = fs.statSync(path.join(testRoot, 'test.txt'));
      // Check that the mode matches (mask with 0o777 to get permission bits)
      expect((stats.mode & 0o777).toString(8)).toBe('644');
    });
    
    it('should change directory permissions', () => {
      fs.mkdirSync(path.join(testRoot, 'testdir'));
      
      const result = dataSource.update({
        operation: 'chmod',
        path: 'testdir',
        mode: 0o755
      });
      
      expect(result.success).toBe(true);
      
      const stats = fs.statSync(path.join(testRoot, 'testdir'));
      expect((stats.mode & 0o777).toString(8)).toBe('755');
    });
    
    it('should accept string mode', () => {
      fs.writeFileSync(path.join(testRoot, 'test.txt'), 'content');
      
      const result = dataSource.update({
        operation: 'chmod',
        path: 'test.txt',
        mode: '755'
      });
      
      expect(result.success).toBe(true);
      
      const stats = fs.statSync(path.join(testRoot, 'test.txt'));
      expect((stats.mode & 0o777).toString(8)).toBe('755');
    });
    
    it('should fail for non-existent file', () => {
      expect(() => {
        dataSource.update({
          operation: 'chmod',
          path: 'non-existent.txt',
          mode: 0o644
        });
      }).toThrow('Path does not exist');
    });
  });
  
  describe('detailed stats operations', () => {
    it('should get extended file stats', () => {
      fs.writeFileSync(path.join(testRoot, 'test.txt'), 'test content');
      
      const result = dataSource.query({
        operation: 'stats',
        path: 'test.txt'
      });
      
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('uid');
      expect(result).toHaveProperty('gid');
      expect(result).toHaveProperty('atime');
      expect(result).toHaveProperty('mtime');
      expect(result).toHaveProperty('ctime');
      expect(result).toHaveProperty('birthtime');
      expect(result).toHaveProperty('isFile');
      expect(result).toHaveProperty('isDirectory');
      expect(result).toHaveProperty('isSymbolicLink');
      expect(result).toHaveProperty('blocks');
      expect(result).toHaveProperty('blksize');
      
      expect(result.isFile).toBe(true);
      expect(result.isDirectory).toBe(false);
      expect(result.size).toBe(12); // 'test content' is 12 bytes
    });
    
    it('should get directory stats', () => {
      fs.mkdirSync(path.join(testRoot, 'testdir'));
      
      const result = dataSource.query({
        operation: 'stats',
        path: 'testdir'
      });
      
      expect(result.isDirectory).toBe(true);
      expect(result.isFile).toBe(false);
    });
    
    it('should include permission string in stats', () => {
      fs.writeFileSync(path.join(testRoot, 'test.txt'), 'content');
      fs.chmodSync(path.join(testRoot, 'test.txt'), 0o644);
      
      const result = dataSource.query({
        operation: 'stats',
        path: 'test.txt',
        includePermissionString: true
      });
      
      expect(result).toHaveProperty('permissions');
      // Permission string format: -rw-r--r--
      expect(result.permissions).toMatch(/^-[rwx-]{9}$/);
    });
  });
  
  describe('symlink operations', () => {
    // Skip symlink tests on Windows
    const skipOnWindows = os.platform() === 'win32' ? it.skip : it;
    
    skipOnWindows('should create symbolic link to file', () => {
      fs.writeFileSync(path.join(testRoot, 'target.txt'), 'target content');
      
      const result = dataSource.update({
        operation: 'symlink',
        target: 'target.txt',
        path: 'link.txt'
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('symlink');
      
      const linkPath = path.join(testRoot, 'link.txt');
      expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
      
      // Should be able to read through the link
      const content = fs.readFileSync(linkPath, 'utf8');
      expect(content).toBe('target content');
    });
    
    skipOnWindows('should create symbolic link to directory', () => {
      fs.mkdirSync(path.join(testRoot, 'targetdir'));
      fs.writeFileSync(path.join(testRoot, 'targetdir/file.txt'), 'content');
      
      const result = dataSource.update({
        operation: 'symlink',
        target: 'targetdir',
        path: 'linkdir'
      });
      
      expect(result.success).toBe(true);
      
      const linkPath = path.join(testRoot, 'linkdir');
      expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
      
      // Should be able to access files through the link
      const content = fs.readFileSync(path.join(linkPath, 'file.txt'), 'utf8');
      expect(content).toBe('content');
    });
    
    skipOnWindows('should read symlink target', () => {
      fs.writeFileSync(path.join(testRoot, 'target.txt'), 'content');
      fs.symlinkSync('target.txt', path.join(testRoot, 'link.txt'));
      
      const result = dataSource.query({
        operation: 'readlink',
        path: 'link.txt'
      });
      
      expect(result.target).toBe('target.txt');
      expect(result.isSymbolicLink).toBe(true);
    });
    
    skipOnWindows('should follow symlinks when reading content', () => {
      fs.writeFileSync(path.join(testRoot, 'target.txt'), 'linked content');
      fs.symlinkSync('target.txt', path.join(testRoot, 'link.txt'));
      
      const result = dataSource.query({
        operation: 'content',
        path: 'link.txt',
        followSymlinks: true
      });
      
      expect(result).toBe('linked content');
    });
    
    skipOnWindows('should not follow symlinks when specified', () => {
      fs.writeFileSync(path.join(testRoot, 'target.txt'), 'content');
      fs.symlinkSync('target.txt', path.join(testRoot, 'link.txt'));
      
      const result = dataSource.query({
        operation: 'stats',
        path: 'link.txt',
        followSymlinks: false
      });
      
      expect(result.isSymbolicLink).toBe(true);
      expect(result.isFile).toBe(false);
    });
  });
  
  describe('touch operation', () => {
    it('should create empty file if it does not exist', () => {
      const result = dataSource.update({
        operation: 'touch',
        path: 'newfile.txt'
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('touch');
      
      const filePath = path.join(testRoot, 'newfile.txt');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe('');
    });
    
    it('should update modification time of existing file', () => {
      const filePath = path.join(testRoot, 'existing.txt');
      fs.writeFileSync(filePath, 'content');
      
      // Get original mtime
      const originalStats = fs.statSync(filePath);
      const originalMtime = originalStats.mtime.getTime();
      
      // Wait a bit to ensure time difference
      const delay = new Promise(resolve => setTimeout(resolve, 10));
      return delay.then(() => {
        const result = dataSource.update({
          operation: 'touch',
          path: 'existing.txt'
        });
        
        expect(result.success).toBe(true);
        
        const newStats = fs.statSync(filePath);
        const newMtime = newStats.mtime.getTime();
        
        expect(newMtime).toBeGreaterThan(originalMtime);
        // Content should remain unchanged
        expect(fs.readFileSync(filePath, 'utf8')).toBe('content');
      });
    });
    
    it('should set specific times when provided', () => {
      const specificTime = new Date('2024-01-01T00:00:00Z');
      
      const result = dataSource.update({
        operation: 'touch',
        path: 'timed.txt',
        atime: specificTime,
        mtime: specificTime
      });
      
      expect(result.success).toBe(true);
      
      const stats = fs.statSync(path.join(testRoot, 'timed.txt'));
      expect(stats.atime.getTime()).toBe(specificTime.getTime());
      expect(stats.mtime.getTime()).toBe(specificTime.getTime());
    });
  });
  
  describe('truncate operation', () => {
    it('should truncate file to specified size', () => {
      const filePath = path.join(testRoot, 'truncate.txt');
      fs.writeFileSync(filePath, 'This is a longer content string');
      
      const result = dataSource.update({
        operation: 'truncate',
        path: 'truncate.txt',
        length: 10
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('truncate');
      
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toBe('This is a ');
      expect(content.length).toBe(10);
    });
    
    it('should extend file with null bytes if length is greater', () => {
      const filePath = path.join(testRoot, 'extend.txt');
      fs.writeFileSync(filePath, 'short');
      
      const result = dataSource.update({
        operation: 'truncate',
        path: 'extend.txt',
        length: 10
      });
      
      expect(result.success).toBe(true);
      
      const buffer = fs.readFileSync(filePath);
      expect(buffer.length).toBe(10);
      // Check that it was padded with null bytes
      expect(buffer[5]).toBe(0);
      expect(buffer[9]).toBe(0);
    });
    
    it('should truncate to zero if no length specified', () => {
      const filePath = path.join(testRoot, 'zero.txt');
      fs.writeFileSync(filePath, 'content to remove');
      
      const result = dataSource.update({
        operation: 'truncate',
        path: 'zero.txt',
        length: 0
      });
      
      expect(result.success).toBe(true);
      
      const stats = fs.statSync(filePath);
      expect(stats.size).toBe(0);
      expect(fs.readFileSync(filePath, 'utf8')).toBe('');
    });
  });
  
  describe('realpath operation', () => {
    it('should resolve real path of file', () => {
      fs.mkdirSync(path.join(testRoot, 'dir1'));
      fs.writeFileSync(path.join(testRoot, 'dir1/file.txt'), 'content');
      
      const result = dataSource.query({
        operation: 'realpath',
        path: 'dir1/../dir1/file.txt'
      });
      
      expect(result.realpath).toContain('dir1');
      expect(result.realpath).toContain('file.txt');
      expect(result.realpath).not.toContain('..');
    });
    
    // Skip symlink realpath test on Windows
    const skipOnWindows = os.platform() === 'win32' ? it.skip : it;
    
    skipOnWindows('should resolve symlinks to real path', () => {
      fs.writeFileSync(path.join(testRoot, 'target.txt'), 'content');
      fs.symlinkSync('target.txt', path.join(testRoot, 'link.txt'));
      
      const result = dataSource.query({
        operation: 'realpath',
        path: 'link.txt'
      });
      
      expect(result.realpath).toContain('target.txt');
      expect(result.realpath).not.toContain('link.txt');
    });
  });
});