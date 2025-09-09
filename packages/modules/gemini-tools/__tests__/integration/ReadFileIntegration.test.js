/**
 * Integration tests for ReadFileTool with real file system
 * NO MOCKS - uses real file operations
 */

import ReadFileTool from '../../src/tools/ReadFileTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('ReadFileTool Integration', () => {
  let tool;
  let testDir;
  let testFile;

  beforeEach(async () => {
    // Create real test directory and file
    testDir = path.join(os.tmpdir(), `gemini-tools-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    testFile = path.join(testDir, 'test.txt');
    await fs.writeFile(testFile, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 'utf-8');

    tool = new ReadFileTool({
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

  test('should read real file content', async () => {
    const result = await tool._execute({ absolute_path: testFile });
    
    expect(result.content).toBe('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
    expect(result.path).toBe(testFile);
    expect(result.lines).toBe(5);
    expect(result.truncated).toBe(false);
  });

  test('should read file with line offset and limit', async () => {
    const result = await tool._execute({ 
      absolute_path: testFile,
      offset: 1,
      limit: 2
    });
    
    expect(result.content).toBe('Line 2\nLine 3');
    expect(result.lines).toBe(5);
    expect(result.truncated).toBe(true);
  });

  test('should fail with real file not found error', async () => {
    const nonExistentFile = path.join(testDir, 'nonexistent.txt');
    
    await expect(tool._execute({ absolute_path: nonExistentFile }))
      .rejects.toThrow('File not found or not accessible');
  });

  test('should handle real empty file', async () => {
    const emptyFile = path.join(testDir, 'empty.txt');
    await fs.writeFile(emptyFile, '', 'utf-8');
    
    const result = await tool._execute({ absolute_path: emptyFile });
    
    expect(result.content).toBe('');
    expect(result.path).toBe(emptyFile);
    expect(result.lines).toBe(1); // Empty file still has 1 "line"
  });

  test('should handle real binary file gracefully', async () => {
    const binaryFile = path.join(testDir, 'binary.bin');
    const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    await fs.writeFile(binaryFile, binaryContent);
    
    // Should still attempt to read (Legion pattern: fail fast, no fallbacks)
    const result = await tool._execute({ absolute_path: binaryFile });
    
    expect(result.path).toBe(binaryFile);
    expect(typeof result.content).toBe('string');
  });
});