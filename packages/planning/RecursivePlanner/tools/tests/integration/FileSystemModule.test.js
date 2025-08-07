/**
 * Integration tests for FileSystem Module
 * Tests real file system operations wrapped as tools
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { 
  FileSystemModuleDefinition,
  FileSystemModuleInstance 
} from '../../src/modules/FileSystemModule.js';

describe('FileSystem Module Integration', () => {
  let testDir;
  let module;
  let instance;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-module-test-'));
    
    // Create module instance
    instance = await FileSystemModuleDefinition.create({
      basePath: testDir,
      allowWrite: true,
      allowDelete: true
    });
    
    module = instance;
  });

  afterEach(async () => {
    // Clean up test directory
    if (instance && instance.cleanup) {
      await instance.cleanup();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic file operations', () => {
    test('should read and write files', async () => {
      const writeFile = module.getTool('writeFile');
      const readFile = module.getTool('readFile');

      // Write a file
      const writeResult = await writeFile.execute({
        path: 'test.txt',
        content: 'Hello, World!'
      });
      expect(writeResult.success).toBe(true);
      expect(writeResult.data.path).toContain('test.txt');

      // Read the file back
      const readResult = await readFile.execute({
        path: 'test.txt'
      });
      expect(readResult.success).toBe(true);
      expect(readResult.data.content).toBe('Hello, World!');
    });

    test('should handle binary files', async () => {
      const writeFile = module.getTool('writeFile');
      const readFile = module.getTool('readFile');

      // Write binary data
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      await writeFile.execute({
        path: 'test.png',
        content: binaryData,
        encoding: 'binary'
      });

      // Read binary data
      const result = await readFile.execute({
        path: 'test.png',
        encoding: 'binary'
      });
      expect(result.success).toBe(true);
      expect(Buffer.from(result.data.content)).toEqual(binaryData);
    });

    test('should append to files', async () => {
      const writeFile = module.getTool('writeFile');
      const appendFile = module.getTool('appendFile');
      const readFile = module.getTool('readFile');

      await writeFile.execute({
        path: 'log.txt',
        content: 'Line 1\n'
      });

      await appendFile.execute({
        path: 'log.txt',
        content: 'Line 2\n'
      });

      const result = await readFile.execute({ path: 'log.txt' });
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Line 1\nLine 2\n');
    });

    test('should handle file not found errors', async () => {
      const readFile = module.getTool('readFile');
      
      const result = await readFile.execute({
        path: 'nonexistent.txt'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.code).toBe('ENOENT');
    });
  });

  describe('Directory operations', () => {
    test('should create directories', async () => {
      const mkdir = module.getTool('mkdir');
      const exists = module.getTool('exists');

      const result = await mkdir.execute({
        path: 'new-dir',
        recursive: true
      });
      expect(result.success).toBe(true);

      const existsResult = await exists.execute({
        path: 'new-dir'
      });
      expect(existsResult.success).toBe(true);
      expect(existsResult.data.exists).toBe(true);
      expect(existsResult.data.isDirectory).toBe(true);
    });

    test('should list directory contents', async () => {
      const writeFile = module.getTool('writeFile');
      const mkdir = module.getTool('mkdir');
      const listDir = module.getTool('listDir');

      // Create some files and directories
      await mkdir.execute({ path: 'subdir' });
      await writeFile.execute({ path: 'file1.txt', content: 'test' });
      await writeFile.execute({ path: 'file2.txt', content: 'test' });
      await writeFile.execute({ path: 'subdir/file3.txt', content: 'test' });

      const result = await listDir.execute({ path: '.' });
      expect(result.success).toBe(true);
      expect(result.data.entries).toContainEqual(
        expect.objectContaining({ name: 'file1.txt', type: 'file' })
      );
      expect(result.data.entries).toContainEqual(
        expect.objectContaining({ name: 'file2.txt', type: 'file' })
      );
      expect(result.data.entries).toContainEqual(
        expect.objectContaining({ name: 'subdir', type: 'directory' })
      );
    });

    test('should remove directories', async () => {
      const mkdir = module.getTool('mkdir');
      const rmdir = module.getTool('rmdir');
      const exists = module.getTool('exists');

      await mkdir.execute({ path: 'temp-dir' });
      
      const removeResult = await rmdir.execute({
        path: 'temp-dir',
        recursive: true
      });
      expect(removeResult.success).toBe(true);

      const existsResult = await exists.execute({ path: 'temp-dir' });
      expect(existsResult.success).toBe(true);
      expect(existsResult.data.exists).toBe(false);
    });
  });

  describe('File metadata operations', () => {
    test('should get file stats', async () => {
      const writeFile = module.getTool('writeFile');
      const stat = module.getTool('stat');

      const content = 'Test content';
      await writeFile.execute({
        path: 'test.txt',
        content
      });

      const result = await stat.execute({ path: 'test.txt' });
      expect(result.success).toBe(true);
      expect(result.data.size).toBe(content.length);
      expect(result.data.isFile).toBe(true);
      expect(result.data.isDirectory).toBe(false);
      expect(result.data.mtime).toBeDefined();
    });

    test('should copy files', async () => {
      const writeFile = module.getTool('writeFile');
      const copyFile = module.getTool('copyFile');
      const readFile = module.getTool('readFile');

      await writeFile.execute({
        path: 'source.txt',
        content: 'Original content'
      });

      await copyFile.execute({
        source: 'source.txt',
        destination: 'copy.txt'
      });

      const result = await readFile.execute({ path: 'copy.txt' });
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Original content');
    });

    test('should move/rename files', async () => {
      const writeFile = module.getTool('writeFile');
      const moveFile = module.getTool('moveFile');
      const exists = module.getTool('exists');
      const readFile = module.getTool('readFile');

      await writeFile.execute({
        path: 'old-name.txt',
        content: 'File content'
      });

      await moveFile.execute({
        source: 'old-name.txt',
        destination: 'new-name.txt'
      });

      const oldExists = await exists.execute({ path: 'old-name.txt' });
      expect(oldExists.success).toBe(true);
      expect(oldExists.data.exists).toBe(false);

      const newExists = await exists.execute({ path: 'new-name.txt' });
      expect(newExists.success).toBe(true);
      expect(newExists.data.exists).toBe(true);

      const content = await readFile.execute({ path: 'new-name.txt' });
      expect(content.success).toBe(true);
      expect(content.data.content).toBe('File content');
    });

    test('should delete files', async () => {
      const writeFile = module.getTool('writeFile');
      const deleteFile = module.getTool('deleteFile');
      const exists = module.getTool('exists');

      await writeFile.execute({
        path: 'temp.txt',
        content: 'Temporary'
      });

      await deleteFile.execute({ path: 'temp.txt' });

      const result = await exists.execute({ path: 'temp.txt' });
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
    });
  });

  describe('Advanced operations', () => {
    test('should watch for file changes', async () => {
      const writeFile = module.getTool('writeFile');
      const watchFile = module.getTool('watchFile');

      // Create initial file
      await writeFile.execute({
        path: 'watched.txt',
        content: 'Initial'
      });

      // Start watching
      const watchResult = await watchFile.execute({
        path: 'watched.txt'
      });
      expect(watchResult.success).toBe(true);
      expect(watchResult.data.handle).toBeDefined();
      expect(watchResult.data.type).toBe('watcher');

      // Note: Testing actual file change events would require 
      // more complex async handling and is omitted for brevity
    });

    test('should find files matching pattern', async () => {
      const writeFile = module.getTool('writeFile');
      const mkdir = module.getTool('mkdir');
      const findFiles = module.getTool('findFiles');

      // Create file structure
      await mkdir.execute({ path: 'src' });
      await mkdir.execute({ path: 'test' });
      await writeFile.execute({ path: 'src/app.js', content: '' });
      await writeFile.execute({ path: 'src/util.js', content: '' });
      await writeFile.execute({ path: 'test/app.test.js', content: '' });
      await writeFile.execute({ path: 'README.md', content: '' });

      // Find all .js files
      const jsFiles = await findFiles.execute({
        pattern: '**/*.js'
      });
      expect(jsFiles.success).toBe(true);
      expect(jsFiles.data.files).toHaveLength(3);
      expect(jsFiles.data.files.some(f => f.includes('app.js'))).toBe(true);

      // Find test files
      const testFiles = await findFiles.execute({
        pattern: '**/*.test.js'
      });
      expect(testFiles.success).toBe(true);
      expect(testFiles.data.files).toHaveLength(1);
      expect(testFiles.data.files[0]).toContain('app.test.js');
    });

    test('should calculate file checksums', async () => {
      const writeFile = module.getTool('writeFile');
      const checksum = module.getTool('checksum');

      await writeFile.execute({
        path: 'data.txt',
        content: 'Hello, World!'
      });

      const result = await checksum.execute({
        path: 'data.txt',
        algorithm: 'sha256'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.checksum).toBeDefined();
      expect(result.data.algorithm).toBe('sha256');
      // SHA256 of "Hello, World!" 
      expect(result.data.checksum).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
    });

    test('should handle permissions', async () => {
      const writeFile = module.getTool('writeFile');
      const chmod = module.getTool('chmod');
      const stat = module.getTool('stat');

      await writeFile.execute({
        path: 'script.sh',
        content: '#!/bin/bash\necho "Hello"'
      });

      await chmod.execute({
        path: 'script.sh',
        mode: '755'
      });

      const result = await stat.execute({ path: 'script.sh' });
      expect(result.success).toBe(true);
      expect(result.data.mode).toBeDefined();
      // Check if execute bit is set (Unix-specific)
      if (process.platform !== 'win32') {
        expect(result.data.mode & 0o111).toBeTruthy();
      }
    });
  });

  describe('Security and validation', () => {
    test('should prevent path traversal attacks', async () => {
      const readFile = module.getTool('readFile');
      
      const result = await readFile.execute({
        path: '../../../etc/passwd'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.code).toBe('FORBIDDEN');
    });

    test('should respect write permissions', async () => {
      // Create read-only module
      const readOnlyInstance = await FileSystemModuleDefinition.create({
        basePath: testDir,
        allowWrite: false
      });

      const writeFile = readOnlyInstance.getTool('writeFile');
      
      const result = await writeFile.execute({
        path: 'test.txt',
        content: 'Should fail'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.code).toBe('PERMISSION_DENIED');
    });

    test('should validate file size limits', async () => {
      // Create module with size limits
      const limitedInstance = await FileSystemModuleDefinition.create({
        basePath: testDir,
        maxFileSize: 100 // 100 bytes
      });

      const writeFile = limitedInstance.getTool('writeFile');
      
      const result = await writeFile.execute({
        path: 'large.txt',
        content: 'x'.repeat(200) // 200 bytes
      });
      
      expect(result.success).toBe(false);
      expect(result.data.code).toBe('FILE_TOO_LARGE');
    });
  });
});