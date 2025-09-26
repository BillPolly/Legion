import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('FileSystemDataSource - Security and Advanced Path Resolution', () => {
  let dataSource;
  let testDir;
  
  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `fs-security-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    // Create test files and directories
    fs.writeFileSync(path.join(testDir, 'normal-file.txt'), 'Normal content');
    fs.mkdirSync(path.join(testDir, 'subdir'));
    fs.writeFileSync(path.join(testDir, 'subdir', 'nested-file.txt'), 'Nested content');
    
    dataSource = new FileSystemDataSource({ 
      rootPath: testDir,
      maxPathLength: 255,
      allowHiddenFiles: false,
      allowSymlinks: true
    });
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Basic Path Security (Existing)', () => {
    it('should reject null bytes in paths', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'file\0.txt',
          operation: 'exists'
        });
      }).toThrow('Invalid characters in path');
    });

    it('should reject absolute paths', () => {
      expect(() => {
        dataSource.query({
          type: 'file', 
          path: '/etc/passwd',
          operation: 'exists'
        });
      }).toThrow('Absolute paths not allowed');
    });

    it('should reject path traversal attempts', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: '../../../etc/passwd',
          operation: 'exists'
        });
      }).toThrow('Path traversal not allowed');
    });

    it('should reject complex path traversal', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'subdir/../../secret.txt',
          operation: 'exists'
        });
      }).toThrow('Path traversal not allowed');
    });
  });

  describe('Enhanced Path Length Validation', () => {
    it('should reject paths exceeding maximum length', () => {
      const longPath = 'a'.repeat(300);
      expect(() => {
        dataSource.query({
          type: 'file',
          path: longPath,
          operation: 'exists'
        });
      }).toThrow('Path exceeds maximum length');
    });

    it('should accept paths within maximum length', () => {
      const acceptablePath = 'a'.repeat(100);
      fs.writeFileSync(path.join(testDir, acceptablePath), 'test');
      
      const result = dataSource.query({
        type: 'file',
        path: acceptablePath,
        operation: 'exists'
      });
      
      expect(result.exists).toBe(true);
    });
  });

  describe('Hidden File Protection', () => {
    beforeEach(() => {
      // Create hidden files
      fs.writeFileSync(path.join(testDir, '.hidden-file'), 'hidden content');
      fs.mkdirSync(path.join(testDir, '.hidden-dir'));
      fs.writeFileSync(path.join(testDir, '.hidden-dir', 'secret.txt'), 'secret');
    });

    it('should reject access to hidden files when disabled', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: '.hidden-file',
          operation: 'content'
        });
      }).toThrow('Access to hidden files not allowed');
    });

    it('should reject access to files in hidden directories when disabled', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: '.hidden-dir/secret.txt',
          operation: 'content'
        });
      }).toThrow('Access to hidden files not allowed');
    });

    it('should allow access to hidden files when enabled', () => {
      const permissiveDataSource = new FileSystemDataSource({ 
        rootPath: testDir,
        allowHiddenFiles: true
      });

      const result = permissiveDataSource.query({
        type: 'file',
        path: '.hidden-file',
        operation: 'content'
      });

      expect(result).toBe('hidden content');
    });
  });

  describe('Reserved Name Protection', () => {
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    reservedNames.forEach(name => {
      it(`should reject reserved name: ${name}`, () => {
        expect(() => {
          dataSource.update({
            type: 'file',
            path: name,
            operation: 'create',
            content: 'test'
          });
        }).toThrow('Reserved filename not allowed');
      });

      it(`should reject reserved name with extension: ${name}.txt`, () => {
        expect(() => {
          dataSource.update({
            type: 'file',
            path: `${name}.txt`,
            operation: 'create',
            content: 'test'
          });
        }).toThrow('Reserved filename not allowed');
      });
    });
  });

  describe('Unicode and Special Character Validation', () => {
    it('should reject control characters (0x00-0x1F)', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'file\x01name.txt',
          operation: 'exists'
        });
      }).toThrow('Invalid characters in path');
    });

    it('should reject DEL character (0x7F)', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'file\x7fname.txt',
          operation: 'exists'
        });
      }).toThrow('Invalid characters in path');
    });

    it('should accept valid Unicode characters', () => {
      const unicodePath = 'файл-тест.txt'; // Cyrillic
      fs.writeFileSync(path.join(testDir, unicodePath), 'unicode test');
      
      const result = dataSource.query({
        type: 'file',
        path: unicodePath,
        operation: 'exists'
      });
      
      expect(result.exists).toBe(true);
    });

    it('should accept emoji in filenames', () => {
      const emojiPath = 'test-😀-file.txt';
      fs.writeFileSync(path.join(testDir, emojiPath), 'emoji test');
      
      const result = dataSource.query({
        type: 'file',
        path: emojiPath,
        operation: 'exists'
      });
      
      expect(result.exists).toBe(true);
    });
  });

  describe('Symlink Security', () => {
    beforeEach(() => {
      // Create external directory
      const externalDir = path.join(os.tmpdir(), `external-${Date.now()}`);
      fs.mkdirSync(externalDir, { recursive: true });
      fs.writeFileSync(path.join(externalDir, 'external-secret.txt'), 'external secret');
      
      // Create symlinks
      fs.symlinkSync(
        path.join(externalDir, 'external-secret.txt'),
        path.join(testDir, 'external-link')
      );
      
      fs.symlinkSync(
        '../../../etc/passwd',
        path.join(testDir, 'traversal-link')
      );
      
      fs.symlinkSync(
        'normal-file.txt',
        path.join(testDir, 'safe-link')
      );
    });

    it('should reject symlinks pointing outside root directory', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'external-link',
          operation: 'content'
        });
      }).toThrow('Symlink target outside allowed path');
    });

    it('should reject symlinks with path traversal', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'traversal-link',
          operation: 'content'
        });
      }).toThrow('Symlink target outside allowed path');
    });

    it('should allow safe internal symlinks', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'safe-link',
        operation: 'content'
      });
      
      expect(result).toBe('Normal content');
    });

    it('should reject symlinks when disabled', () => {
      const restrictiveDataSource = new FileSystemDataSource({ 
        rootPath: testDir,
        allowSymlinks: false
      });

      expect(() => {
        restrictiveDataSource.query({
          type: 'file',
          path: 'safe-link',
          operation: 'content'
        });
      }).toThrow('Symbolic links not allowed');
    });
  });

  describe('Advanced Path Resolution', () => {
    beforeEach(() => {
      // Create complex directory structure
      fs.mkdirSync(path.join(testDir, 'real-dir'));
      fs.writeFileSync(path.join(testDir, 'real-dir', 'target.txt'), 'target content');
      
      // Create symlink to directory
      fs.symlinkSync('real-dir', path.join(testDir, 'dir-link'));
    });

    it('should resolve canonical paths correctly', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'real-dir/../real-dir/target.txt',
        operation: 'metadata',
        metadata: ['canonicalPath']
      });
      
      expect(result.canonicalPath).toBe(path.join(testDir, 'real-dir', 'target.txt'));
    });

    it('should provide relative path information', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'subdir/nested-file.txt',
        operation: 'metadata',
        metadata: ['relativePath', 'pathComponents']
      });
      
      expect(result.relativePath).toBe('subdir/nested-file.txt');
      expect(result.pathComponents).toEqual(['subdir', 'nested-file.txt']);
    });

    it('should detect symlink chains', () => {
      // Create symlink chain
      fs.symlinkSync('dir-link', path.join(testDir, 'chain-link'));
      
      const result = dataSource.query({
        type: 'file',
        path: 'chain-link/target.txt',
        operation: 'metadata',
        metadata: ['symlinkChain', 'resolvedPath']
      });
      
      expect(result.symlinkChain).toHaveLength(2);
      expect(result.resolvedPath).toBe(path.join(testDir, 'real-dir', 'target.txt'));
    });
  });

  describe('Permission-Based Access Control', () => {
    it('should respect read-only permissions', () => {
      const readOnlyDataSource = new FileSystemDataSource({ 
        rootPath: testDir,
        permissions: 'r'
      });

      expect(() => {
        readOnlyDataSource.update({
          type: 'file',
          path: 'new-file.txt',
          operation: 'create',
          content: 'test'
        });
      }).toThrow('Write operations not permitted');
    });

    it('should allow read operations with read-only permissions', () => {
      const readOnlyDataSource = new FileSystemDataSource({ 
        rootPath: testDir,
        permissions: 'r'
      });

      const result = readOnlyDataSource.query({
        type: 'file',
        path: 'normal-file.txt',
        operation: 'content'
      });

      expect(result).toBe('Normal content');
    });

    it('should reject read operations with write-only permissions', () => {
      const writeOnlyDataSource = new FileSystemDataSource({ 
        rootPath: testDir,
        permissions: 'w'
      });

      expect(() => {
        writeOnlyDataSource.query({
          type: 'file',
          path: 'normal-file.txt',
          operation: 'content'
        });
      }).toThrow('Read operations not permitted');
    });
  });

  describe('Resource Limits', () => {
    it('should enforce maximum file size for reads', () => {
      const limitedDataSource = new FileSystemDataSource({ 
        rootPath: testDir,
        maxFileSize: 10 // 10 bytes
      });

      // Create large file
      const largeContent = 'x'.repeat(20);
      fs.writeFileSync(path.join(testDir, 'large-file.txt'), largeContent);

      expect(() => {
        limitedDataSource.query({
          type: 'file',
          path: 'large-file.txt',
          operation: 'content'
        });
      }).toThrow('File exceeds maximum size limit');
    });

    it('should enforce maximum file size for writes', () => {
      const limitedDataSource = new FileSystemDataSource({ 
        rootPath: testDir,
        maxFileSize: 10 // 10 bytes
      });

      const largeContent = 'x'.repeat(20);
      
      expect(() => {
        limitedDataSource.update({
          type: 'file',
          path: 'large-new-file.txt',
          operation: 'create',
          content: largeContent
        });
      }).toThrow('Content exceeds maximum file size');
    });

    it('should allow files within size limits', () => {
      const limitedDataSource = new FileSystemDataSource({ 
        rootPath: testDir,
        maxFileSize: 100
      });

      const result = limitedDataSource.update({
        type: 'file',
        path: 'small-file.txt',
        operation: 'create',
        content: 'small'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('MIME Type Restrictions', () => {
    it('should reject disallowed file types', () => {
      const restrictedDataSource = new FileSystemDataSource({ 
        rootPath: testDir,
        allowedMimeTypes: ['text/plain', 'text/markdown']
      });

      expect(() => {
        restrictedDataSource.update({
          type: 'file',
          path: 'script.exe',
          operation: 'create',
          content: 'MZ\x90\x00' // PE header start
        });
      }).toThrow('File type not allowed');
    });

    it('should allow permitted file types', () => {
      const restrictedDataSource = new FileSystemDataSource({ 
        rootPath: testDir,
        allowedMimeTypes: ['text/plain']
      });

      const result = restrictedDataSource.update({
        type: 'file',
        path: 'text-file.txt',
        operation: 'create',
        content: 'plain text content'
      });

      expect(result.success).toBe(true);
    });
  });
});