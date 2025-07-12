/**
 * Integration tests for File Tool with real filesystem operations
 * All file operations are contained within __tests__/testdata directory
 */

import { jest } from '@jest/globals';
import { FileOperationsTool } from '../../src/file/FileModule.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('File Operations Integration Tests', () => {
  let fileTool;
  let testDataDir;
  let createdFiles = [];
  let createdDirs = [];

  beforeAll(async () => {
    fileTool = new FileOperationsTool();
    testDataDir = path.join(__dirname, '..', 'testdata');
    
    // Ensure testdata directory exists
    try {
      await fs.mkdir(testDataDir, { recursive: true });
    } catch (error) {
      // Directory may already exist
    }
  });

  afterAll(async () => {
    // Cleanup all created files and directories within testdata
    for (const file of createdFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // File may already be deleted
      }
    }
    
    for (const dir of createdDirs.reverse()) {
      try {
        await fs.rmdir(dir);
      } catch (error) {
        // Directory may already be deleted or not empty
      }
    }
  });

  describe('file read operations', () => {
    test('should read existing file successfully', async () => {
      const testContent = 'Hello, World!\nThis is a test file.';
      const testFile = path.join(testDataDir, 'test-read.txt');
      
      // Create test file
      await fs.writeFile(testFile, testContent, 'utf8');
      createdFiles.push(testFile);

      const toolCall = createMockToolCall('file_read', { 
        filepath: testFile 
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.content).toBe(testContent);
      expect(result.data.filepath).toBe(testFile);
      expect(result.data.size).toBe(testContent.length);
    });

    test('should handle non-existent file', async () => {
      const nonExistentFile = path.join(testDataDir, 'does-not-exist.txt');
      
      const toolCall = createMockToolCall('file_read', { 
        filepath: nonExistentFile 
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('ENOENT');
      expect(result.data.filepath).toBe(nonExistentFile);
    });

    test('should handle directory instead of file', async () => {
      const testDir = path.join(testDataDir, 'test-dir');
      await fs.mkdir(testDir, { recursive: true });
      createdDirs.push(testDir);
      
      const toolCall = createMockToolCall('file_read', { 
        filepath: testDir 
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('EISDIR');
    });

    test('should read large file successfully', async () => {
      const largeContent = 'x'.repeat(10000); // 10KB file
      const largeFile = path.join(testDataDir, 'large-file.txt');
      
      await fs.writeFile(largeFile, largeContent, 'utf8');
      createdFiles.push(largeFile);

      const toolCall = createMockToolCall('file_read', { 
        filepath: largeFile 
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.content.length).toBe(10000);
      expect(result.data.size).toBe(10000);
    });
  });

  describe('file write operations', () => {
    test('should create new file successfully', async () => {
      const testContent = 'This is new file content.';
      const newFile = path.join(testDataDir, 'new-file.txt');
      
      const toolCall = createMockToolCall('file_write', { 
        filepath: newFile,
        content: testContent
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.filepath).toBe(newFile);
      expect(result.data.bytesWritten).toBe(testContent.length);
      expect(result.data.created).toBe(true);
      
      // Verify file was actually created
      const fileContent = await fs.readFile(newFile, 'utf8');
      expect(fileContent).toBe(testContent);
      
      createdFiles.push(newFile);
    });

    test('should overwrite existing file', async () => {
      const originalContent = 'Original content';
      const newContent = 'Updated content';
      const existingFile = path.join(testDataDir, 'existing-file.txt');
      
      // Create original file
      await fs.writeFile(existingFile, originalContent, 'utf8');
      createdFiles.push(existingFile);
      
      const toolCall = createMockToolCall('file_write', { 
        filepath: existingFile,
        content: newContent
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(false); // File was overwritten
      expect(result.data.bytesWritten).toBe(newContent.length);
      
      // Verify file was updated
      const fileContent = await fs.readFile(existingFile, 'utf8');
      expect(fileContent).toBe(newContent);
    });

    test('should create nested directories within testdata', async () => {
      const nestedPath = path.join(testDataDir, 'nested', 'deep', 'directory', 'file.txt');
      const content = 'Nested file content';
      
      const toolCall = createMockToolCall('file_write', { 
        filepath: nestedPath,
        content: content
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(true);
      
      // Verify file was created in nested directory
      const fileContent = await fs.readFile(nestedPath, 'utf8');
      expect(fileContent).toBe(content);
      
      createdFiles.push(nestedPath);
      createdDirs.push(path.dirname(nestedPath));
      createdDirs.push(path.join(testDataDir, 'nested', 'deep'));
      createdDirs.push(path.join(testDataDir, 'nested'));
    });

    test('should handle empty content', async () => {
      const emptyFile = path.join(testDataDir, 'empty-file.txt');
      
      const toolCall = createMockToolCall('file_write', { 
        filepath: emptyFile,
        content: ''
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.bytesWritten).toBe(0);
      
      const fileContent = await fs.readFile(emptyFile, 'utf8');
      expect(fileContent).toBe('');
      
      createdFiles.push(emptyFile);
    });
  });

  describe('directory creation operations', () => {
    test('should create new directory successfully', async () => {
      const newDir = path.join(testDataDir, 'new-directory');
      
      const toolCall = createMockToolCall('directory_create', { 
        dirpath: newDir 
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.dirpath).toBe(newDir);
      expect(result.data.created).toBe(true);
      
      // Verify directory was created
      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
      
      createdDirs.push(newDir);
    });

    test('should handle existing directory', async () => {
      const existingDir = path.join(testDataDir, 'existing-directory');
      
      // Create directory first
      await fs.mkdir(existingDir, { recursive: true });
      createdDirs.push(existingDir);
      
      const toolCall = createMockToolCall('directory_create', { 
        dirpath: existingDir 
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(false); // Directory already existed
    });

    test('should create nested directories within testdata', async () => {
      const nestedDir = path.join(testDataDir, 'level1', 'level2', 'level3');
      
      const toolCall = createMockToolCall('directory_create', { 
        dirpath: nestedDir 
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(true);
      
      // Verify nested directories were created
      const stats = await fs.stat(nestedDir);
      expect(stats.isDirectory()).toBe(true);
      
      createdDirs.push(nestedDir);
      createdDirs.push(path.join(testDataDir, 'level1', 'level2'));
      createdDirs.push(path.join(testDataDir, 'level1'));
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle very long file paths within testdata', async () => {
      const longFileName = 'a'.repeat(100) + '.txt';
      const longFilePath = path.join(testDataDir, longFileName);
      const content = 'Long filename test';
      
      const toolCall = createMockToolCall('file_write', { 
        filepath: longFilePath,
        content: content
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      
      createdFiles.push(longFilePath);
    });

    test('should handle special characters in paths within testdata', async () => {
      const specialFile = path.join(testDataDir, 'file with spaces & symbols!.txt');
      const content = 'Special characters test';
      
      const toolCall = createMockToolCall('file_write', { 
        filepath: specialFile,
        content: content
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(specialFile, 'utf8');
      expect(fileContent).toBe(content);
      
      createdFiles.push(specialFile);
    });

    test('should handle Unicode content within testdata', async () => {
      const unicodeContent = 'Hello 世界 🌍 café naïve résumé';
      const unicodeFile = path.join(testDataDir, 'unicode-test.txt');
      
      const toolCall = createMockToolCall('file_write', { 
        filepath: unicodeFile,
        content: unicodeContent
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(unicodeFile, 'utf8');
      expect(fileContent).toBe(unicodeContent);
      
      createdFiles.push(unicodeFile);
    });
  });
});