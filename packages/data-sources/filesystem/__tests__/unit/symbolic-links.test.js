import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('FileSystemDataSource - Symbolic Links', () => {
  let dataSource;
  let testDir;
  
  beforeEach(() => {
    // Create test directory
    testDir = path.join(os.tmpdir(), `fs-symlink-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    // Create test files and directories
    fs.writeFileSync(path.join(testDir, 'target-file.txt'), 'Target file content');
    fs.mkdirSync(path.join(testDir, 'target-dir'));
    fs.writeFileSync(path.join(testDir, 'target-dir', 'nested-file.txt'), 'Nested content');
    
    dataSource = new FileSystemDataSource({ rootPath: testDir });
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('Creating symbolic links', () => {
    it('should create symbolic link to file', () => {
      const result = dataSource.update({
        type: 'file',
        path: 'link-to-file.txt',
        operation: 'symlink',
        target: 'target-file.txt'
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('symlink');
      expect(result.type).toBe('file');
      
      // Verify symlink was created
      const linkPath = path.join(testDir, 'link-to-file.txt');
      expect(fs.existsSync(linkPath)).toBe(true);
      expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    });
    
    it('should create symbolic link to directory', () => {
      const result = dataSource.update({
        type: 'directory',
        path: 'link-to-dir',
        operation: 'symlink',
        target: 'target-dir'
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('symlink');
      expect(result.type).toBe('directory');
      
      // Verify symlink was created
      const linkPath = path.join(testDir, 'link-to-dir');
      expect(fs.existsSync(linkPath)).toBe(true);
      expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    });
    
    it('should create absolute symbolic link', () => {
      const absoluteTarget = path.join(testDir, 'target-file.txt');
      
      const result = dataSource.update({
        type: 'file',
        path: 'abs-link.txt',
        operation: 'symlink',
        target: absoluteTarget,
        absolute: true
      });
      
      expect(result.success).toBe(true);
      
      // Verify it's an absolute symlink
      const linkPath = path.join(testDir, 'abs-link.txt');
      const linkTarget = fs.readlinkSync(linkPath);
      expect(path.isAbsolute(linkTarget)).toBe(true);
    });
    
    it('should fail to create symlink to non-existent target', () => {
      expect(() => {
        dataSource.update({
          type: 'file',
          path: 'broken-link.txt',
          operation: 'symlink',
          target: 'non-existent.txt'
        });
      }).toThrow('Symlink target does not exist');
    });
    
    it('should create symlink even when target does not exist if allowBroken is true', () => {
      const result = dataSource.update({
        type: 'file',
        path: 'broken-link.txt',
        operation: 'symlink',
        target: 'non-existent.txt',
        allowBroken: true
      });
      
      expect(result.success).toBe(true);
      
      const linkPath = path.join(testDir, 'broken-link.txt');
      expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    });
  });
  
  describe('Querying symbolic links', () => {
    beforeEach(() => {
      // Create test symlinks
      fs.symlinkSync('target-file.txt', path.join(testDir, 'link-to-file.txt'));
      fs.symlinkSync('target-dir', path.join(testDir, 'link-to-dir'));
      fs.symlinkSync('non-existent.txt', path.join(testDir, 'broken-link.txt'));
    });
    
    it('should detect symbolic links in metadata', () => {
      const metadata = dataSource.query({
        type: 'file',
        path: 'link-to-file.txt',
        operation: 'metadata',
        metadata: ['isSymlink', 'linkTarget']
      });
      
      expect(metadata.isSymlink).toBe(true);
      expect(metadata.linkTarget).toBe('target-file.txt');
      expect(metadata.name).toBe('link-to-file.txt');
    });
    
    it('should follow symlinks when reading content by default', () => {
      const content = dataSource.query({
        type: 'file',
        path: 'link-to-file.txt',
        operation: 'content'
      });
      
      expect(content).toBe('Target file content');
    });
    
    it('should not follow symlinks when followSymlinks is false', () => {
      const metadata = dataSource.query({
        type: 'file',
        path: 'link-to-file.txt',
        operation: 'metadata',
        followSymlinks: false
      });
      
      // Should return metadata of the symlink itself, not the target
      expect(metadata.isSymlink).toBe(true);
      expect(metadata.isFile).toBe(false); // symlink itself is not a regular file
    });
    
    it('should handle broken symlinks gracefully', () => {
      const metadata = dataSource.query({
        type: 'file',
        path: 'broken-link.txt',
        operation: 'metadata',
        metadata: ['isSymlink', 'linkTarget', 'isBroken']
      });
      
      expect(metadata.isSymlink).toBe(true);
      expect(metadata.linkTarget).toBe('non-existent.txt');
      expect(metadata.isBroken).toBe(true);
    });
    
    it('should fail when reading content of broken symlink', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'broken-link.txt',
          operation: 'content'
        });
      }).toThrow('Broken symbolic link');
    });
    
    it('should list symlinks in directory listings', () => {
      const entries = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list'
      });
      
      const symlinks = entries.filter(entry => entry.isSymlink);
      expect(symlinks.length).toBe(3);
      
      const fileSymlink = symlinks.find(s => s.name === 'link-to-file.txt');
      expect(fileSymlink.linkTarget).toBe('target-file.txt');
      expect(fileSymlink.isBroken).toBe(false);
      
      const brokenSymlink = symlinks.find(s => s.name === 'broken-link.txt');
      expect(brokenSymlink.isBroken).toBe(true);
    });
    
    it('should filter symlinks in directory listings', () => {
      const symlinksOnly = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { type: 'symlink' }
      });
      
      expect(symlinksOnly.length).toBe(3);
      expect(symlinksOnly.every(entry => entry.isSymlink)).toBe(true);
      
      const workingSymlinks = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'list',
        filter: { type: 'symlink', broken: false }
      });
      
      expect(workingSymlinks.length).toBe(2);
      expect(workingSymlinks.every(entry => !entry.isBroken)).toBe(true);
    });
  });
  
  describe('Symbolic link navigation', () => {
    beforeEach(() => {
      fs.symlinkSync('target-dir', path.join(testDir, 'link-to-dir'));
    });
    
    it('should navigate through symlinked directories', () => {
      const entries = dataSource.query({
        type: 'directory',
        path: 'link-to-dir',
        operation: 'list'
      });
      
      expect(entries.length).toBe(1);
      expect(entries[0].name).toBe('nested-file.txt');
    });
    
    it('should read files through symlinked directories', () => {
      const content = dataSource.query({
        type: 'file',
        path: 'link-to-dir/nested-file.txt',
        operation: 'content'
      });
      
      expect(content).toBe('Nested content');
    });
  });
  
  describe('Symbolic link resolution', () => {
    beforeEach(() => {
      // Create chain of symlinks
      fs.symlinkSync('target-file.txt', path.join(testDir, 'link1.txt'));
      fs.symlinkSync('link1.txt', path.join(testDir, 'link2.txt'));
      fs.symlinkSync('link2.txt', path.join(testDir, 'link3.txt'));
    });
    
    it('should resolve symlink chains', () => {
      const metadata = dataSource.query({
        type: 'file',
        path: 'link3.txt',
        operation: 'metadata',
        metadata: ['resolvedTarget', 'linkDepth']
      });
      
      expect(metadata.resolvedTarget).toBe('target-file.txt');
      expect(metadata.linkDepth).toBe(3);
    });
    
    it('should detect circular symlinks', () => {
      // Create circular symlink
      fs.symlinkSync('circular2.txt', path.join(testDir, 'circular1.txt'));
      fs.symlinkSync('circular1.txt', path.join(testDir, 'circular2.txt'));
      
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'circular1.txt',
          operation: 'content'
        });
      }).toThrow('Circular symbolic link detected');
    });
    
    it('should limit symlink resolution depth', () => {
      // Create very long chain
      let current = 'target-file.txt';
      for (let i = 1; i <= 20; i++) {
        const linkName = `chain${i}.txt`;
        fs.symlinkSync(current, path.join(testDir, linkName));
        current = linkName;
      }
      
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'chain20.txt',
          operation: 'content'
        });
      }).toThrow('Symbolic link resolution depth exceeded');
    });
  });
});