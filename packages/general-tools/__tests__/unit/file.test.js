/**
 * Simplified unit tests for File Tool using real testdata files
 */

import { jest } from '@jest/globals';
import { FileOperationsTool, FileModule } from '../../src/file/FileModule.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

describe('FileOperationsTool', () => {
  let fileTool;
  const testDataDir = path.join(process.cwd(), '__tests__', 'testdata');

  beforeEach(() => {
    fileTool = new FileOperationsTool();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(fileTool.name).toBe('file_operations');
      expect(fileTool.description).toContain('file system operations');
    });
  });

  describe('getAllToolDescriptions', () => {
    test('should return all six file operation functions', () => {
      const descriptions = fileTool.getAllToolDescriptions();
      
      expect(descriptions).toHaveLength(6);
      expect(descriptions[0].function.name).toBe('file_read');
      expect(descriptions[1].function.name).toBe('file_write');
      expect(descriptions[2].function.name).toBe('directory_create');
      expect(descriptions[3].function.name).toBe('directory_current');
      expect(descriptions[4].function.name).toBe('directory_list');
      expect(descriptions[5].function.name).toBe('directory_change');
    });
  });

  describe('readFile method', () => {
    test('should successfully read a file', async () => {
      const testFilePath = path.join(testDataDir, 'test.txt');
      const result = await fileTool.readFile(testFilePath);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Test file content');
      expect(result.data.filepath).toBe(testFilePath);
      expect(result.data.size).toBe(17); // "Test file content".length
    });

    test('should handle file not found error', async () => {
      const result = await fileTool.readFile('nonexistent.txt');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });
  });

  describe('writeFile method', () => {
    test('should successfully write a new file', async () => {
      const testFilePath = path.join(testDataDir, 'write-test.txt');
      const content = 'New file content';
      
      const result = await fileTool.writeFile(testFilePath, content);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.filepath).toBe(testFilePath);
      expect(result.data.bytesWritten).toBe(content.length);
    });
  });

  describe('createDirectory method', () => {
    test('should successfully create a new directory', async () => {
      const testDirPath = path.join(testDataDir, 'new-test-dir');
      
      const result = await fileTool.createDirectory(testDirPath);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.dirpath).toBe(testDirPath);
    });
  });

  describe('invoke method', () => {
    test('should route file_read calls correctly', async () => {
      const testFilePath = path.join(testDataDir, 'test.txt');
      const toolCall = createMockToolCall('file_read', { filepath: testFilePath });
      
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Test file content');
    });

    test('should route file_write calls correctly', async () => {
      const testFilePath = path.join(testDataDir, 'invoke-write-test.txt');
      const content = 'Invoke test content';
      const toolCall = createMockToolCall('file_write', { 
        filepath: testFilePath, 
        content: content 
      });
      
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.bytesWritten).toBe(content.length);
    });

    test('should route directory_create calls correctly', async () => {
      const testDirPath = path.join(testDataDir, 'invoke-test-dir');
      const toolCall = createMockToolCall('directory_create', { dirpath: testDirPath });
      
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.dirpath).toBe(testDirPath);
    });

    test('should handle unknown function names', async () => {
      const toolCall = createMockToolCall('unknown_function', {});
      
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown function');
    });
  });

  describe('getTools method (FileModule)', () => {
    test('should return array of file operation tools', () => {
      const fileModule = new FileModule();
      const tools = fileModule.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBeInstanceOf(FileOperationsTool);
    });
  });
});