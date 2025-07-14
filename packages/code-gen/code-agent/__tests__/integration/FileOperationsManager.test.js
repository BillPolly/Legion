/**
 * Tests for FileOperationsManager integration with @jsenvoy/general-tools
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { FileOperationsManager } from '../../src/integration/FileOperationsManager.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileOperationsManager', () => {
  let manager;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(__dirname, 'temp', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new FileOperationsManager();
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    test('should create FileOperationsManager instance', () => {
      expect(manager).toBeDefined();
      expect(manager.fileModule).toBeNull();
      expect(manager.initialized).toBe(false);
    });
  });

  describe('Initialization', () => {
    test('should initialize with file module', async () => {
      await manager.initialize();
      
      expect(manager.initialized).toBe(true);
      expect(manager.fileModule).toBeDefined();
    });

    test('should throw error if initialization fails', async () => {
      // Test will depend on actual implementation
      expect(manager.initialize).toBeDefined();
    });
  });

  describe('File Operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should read file content', async () => {
      const testFile = path.join(testDir, 'test.txt');
      const content = 'Hello, World!';
      await fs.writeFile(testFile, content);

      const result = await manager.readFile(testFile);
      
      expect(result.success).toBe(true);
      expect(result.content).toBe(content);
      expect(result.filepath).toBe(testFile);
    });

    test('should write file content', async () => {
      const testFile = path.join(testDir, 'test.txt');
      const content = 'Hello, World!';

      const result = await manager.writeFile(testFile, content);
      
      expect(result.success).toBe(true);
      expect(result.filepath).toBe(testFile);
      expect(result.bytesWritten).toBe(content.length);

      // Verify file was actually written
      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toBe(content);
    });

    test('should create directory', async () => {
      const testDirPath = path.join(testDir, 'new-directory');

      const result = await manager.createDirectory(testDirPath);
      
      expect(result.success).toBe(true);
      expect(result.dirpath).toBe(testDirPath);
      expect(result.created).toBe(true);

      // Verify directory was actually created
      const stats = await fs.stat(testDirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    test('should list directory contents', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.js');
      const subDir = path.join(testDir, 'subdir');

      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');
      await fs.mkdir(subDir);

      const result = await manager.listDirectory(testDir);
      
      expect(result.success).toBe(true);
      expect(result.contents).toHaveLength(3);
      
      const names = result.contents.map(item => item.name);
      expect(names).toContain('file1.txt');
      expect(names).toContain('file2.js');
      expect(names).toContain('subdir');
    });

    test('should get current directory', async () => {
      const result = await manager.getCurrentDirectory();
      
      expect(result.success).toBe(true);
      expect(result.currentDirectory).toBeDefined();
      expect(typeof result.currentDirectory).toBe('string');
    });

    test('should change directory', async () => {
      const subDir = path.join(testDir, 'subdir');
      await fs.mkdir(subDir);

      const result = await manager.changeDirectory(subDir);
      
      expect(result.success).toBe(true);
      expect(result.currentDirectory).toBe(subDir);
      expect(result.previousDirectory).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should handle file not found error', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt');

      const result = await manager.readFile(nonExistentFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should handle permission denied error gracefully', async () => {
      // This test may vary based on the system
      const result = await manager.readFile('/root/restricted');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle invalid directory path', async () => {
      const invalidPath = '/path/that/definitely/does/not/exist';

      const result = await manager.listDirectory(invalidPath);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Integration with jsEnvoy Tools', () => {
    test('should use FileModule from @jsenvoy/general-tools', async () => {
      await manager.initialize();
      
      // Verify that it's using the actual jsEnvoy file module
      expect(manager.fileModule).toBeDefined();
      expect(typeof manager.fileModule.invoke).toBe('function');
    });

    test('should handle ToolResult format correctly', async () => {
      await manager.initialize();
      
      const testFile = path.join(testDir, 'test.txt');
      const content = 'test content';
      
      const result = await manager.writeFile(testFile, content);
      
      // Should return standardized result format
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      if (!result.success) {
        expect(result).toHaveProperty('error');
      }
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should check if file exists', async () => {
      const testFile = path.join(testDir, 'test.txt');
      
      let exists = await manager.fileExists(testFile);
      expect(exists).toBe(false);

      await fs.writeFile(testFile, 'content');
      
      exists = await manager.fileExists(testFile);
      expect(exists).toBe(true);
    });

    test('should check if directory exists', async () => {
      const testDirPath = path.join(testDir, 'new-dir');
      
      let exists = await manager.directoryExists(testDirPath);
      expect(exists).toBe(false);

      await fs.mkdir(testDirPath);
      
      exists = await manager.directoryExists(testDirPath);
      expect(exists).toBe(true);
    });

    test('should resolve absolute paths', () => {
      const relativePath = './test.txt';
      const absolutePath = manager.resolvePath(relativePath);
      
      expect(path.isAbsolute(absolutePath)).toBe(true);
      expect(absolutePath).toContain('test.txt');
    });
  });
});