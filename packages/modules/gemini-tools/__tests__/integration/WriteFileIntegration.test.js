/**
 * Integration tests for WriteFileTool with real file system
 * NO MOCKS - uses real file operations
 */

import WriteFileTool from '../../src/tools/WriteFileTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('WriteFileTool Integration', () => {
  let tool;
  let testDir;

  beforeEach(async () => {
    // Create real test directory
    testDir = path.join(os.tmpdir(), `gemini-tools-write-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    tool = new WriteFileTool({
      basePath: testDir,
      encoding: 'utf-8'
    });
  });

  afterEach(async () => {
    // Clean up real test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should write real file content', async () => {
    const testFile = path.join(testDir, 'test.txt');
    const content = 'Hello World\nLine 2';

    const result = await tool._execute({
      absolute_path: testFile,
      content: content
    });

    // Verify the tool result
    expect(result.path).toBe(testFile);
    expect(result.bytesWritten).toBeGreaterThan(0);

    // Verify the file was actually written
    const actualContent = await fs.readFile(testFile, 'utf-8');
    expect(actualContent).toBe(content);
  });

  test('should create nested directories when writing file', async () => {
    const nestedFile = path.join(testDir, 'nested', 'deep', 'test.txt');
    const content = 'Nested file content';

    const result = await tool._execute({
      absolute_path: nestedFile,
      content: content
    });

    expect(result.path).toBe(nestedFile);

    // Verify directories were created
    const dirExists = await fs.access(path.dirname(nestedFile)).then(() => true).catch(() => false);
    expect(dirExists).toBe(true);

    // Verify file content
    const actualContent = await fs.readFile(nestedFile, 'utf-8');
    expect(actualContent).toBe(content);
  });

  test('should overwrite existing files', async () => {
    const testFile = path.join(testDir, 'existing.txt');
    
    // Write initial content
    await fs.writeFile(testFile, 'Original content', 'utf-8');
    
    // Overwrite with tool
    const newContent = 'New content';
    const result = await tool._execute({
      absolute_path: testFile,
      content: newContent
    });

    expect(result.path).toBe(testFile);

    // Verify content was overwritten
    const actualContent = await fs.readFile(testFile, 'utf-8');
    expect(actualContent).toBe(newContent);
  });

  test('should handle different encodings', async () => {
    const testFile = path.join(testDir, 'encoded.txt');
    const content = 'Test content with special chars: é, ñ, 中文';

    const result = await tool._execute({
      absolute_path: testFile,
      content: content,
      encoding: 'utf8'
    });

    expect(result.path).toBe(testFile);

    // Verify content with proper encoding
    const actualContent = await fs.readFile(testFile, 'utf8');
    expect(actualContent).toBe(content);
  });

  test('should fail with invalid paths', async () => {
    await expect(tool._execute({
      absolute_path: '',
      content: 'test'
    })).rejects.toThrow('File path cannot be empty');

    await expect(tool._execute({
      absolute_path: '/path/with\0null',
      content: 'test'
    })).rejects.toThrow('Invalid file path');
  });

  test('should calculate bytes written correctly', async () => {
    const testFile = path.join(testDir, 'bytes.txt');
    const content = 'Test content'; // 12 bytes in UTF-8

    const result = await tool._execute({
      absolute_path: testFile,
      content: content
    });

    expect(result.bytesWritten).toBe(12);
  });
});