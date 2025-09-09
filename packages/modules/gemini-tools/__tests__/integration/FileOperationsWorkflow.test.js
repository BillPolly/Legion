/**
 * Integration test for complete file operations workflow
 * Tests all file tools working together with real file system
 * NO MOCKS - uses real file operations
 */

import ReadFileTool from '../../src/tools/ReadFileTool.js';
import WriteFileTool from '../../src/tools/WriteFileTool.js';
import ListFilesTool from '../../src/tools/ListFilesTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('File Operations Workflow Integration', () => {
  let readTool, writeTool, listTool;
  let testDir;

  beforeEach(async () => {
    // Create real test directory
    testDir = path.join(os.tmpdir(), `gemini-file-workflow-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create tool instances
    const config = { basePath: testDir, encoding: 'utf-8' };
    readTool = new ReadFileTool(config);
    writeTool = new WriteFileTool(config);
    listTool = new ListFilesTool(config);
  });

  afterEach(async () => {
    // Clean up real test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should complete full file workflow: list → write → read', async () => {
    // Step 1: List empty directory
    const initialList = await listTool._execute({ path: testDir });
    expect(initialList.entries.length).toBe(0);

    // Step 2: Write a new file
    const testFile = path.join(testDir, 'workflow.js');
    const content = 'console.log("Workflow test");\n// This is a test file';
    
    const writeResult = await writeTool._execute({
      absolute_path: testFile,
      content: content
    });
    
    expect(writeResult.path).toBe(testFile);
    expect(writeResult.bytesWritten).toBeGreaterThan(0);

    // Step 3: List directory to see new file
    const updatedList = await listTool._execute({ path: testDir });
    expect(updatedList.entries.length).toBe(1);
    expect(updatedList.entries[0].name).toBe('workflow.js');
    expect(updatedList.entries[0].type).toBe('file');

    // Step 4: Read the file back
    const readResult = await readTool._execute({ absolute_path: testFile });
    expect(readResult.content).toBe(content);
    expect(readResult.path).toBe(testFile);
    expect(readResult.lines).toBe(2);
  });

  test('should handle multiple file operations in sequence', async () => {
    const files = [
      { name: 'file1.txt', content: 'Content 1' },
      { name: 'file2.js', content: 'console.log("test");' },
      { name: 'file3.md', content: '# Header\n\nContent' }
    ];

    // Write multiple files
    for (const file of files) {
      const filePath = path.join(testDir, file.name);
      await writeTool._execute({
        absolute_path: filePath,
        content: file.content
      });
    }

    // List all files
    const listResult = await listTool._execute({ path: testDir });
    expect(listResult.entries.length).toBe(3);

    // Read each file and verify content
    for (const file of files) {
      const filePath = path.join(testDir, file.name);
      const readResult = await readTool._execute({ absolute_path: filePath });
      expect(readResult.content).toBe(file.content);
    }
  });

  test('should handle nested directory operations', async () => {
    // Create nested structure
    const nestedFile = path.join(testDir, 'nested', 'deep', 'file.txt');
    const content = 'Nested file content';

    // Write to nested path (should create directories)
    await writeTool._execute({
      absolute_path: nestedFile,
      content: content
    });

    // List root directory
    const rootList = await listTool._execute({ path: testDir });
    expect(rootList.entries.length).toBe(1);
    expect(rootList.entries[0].name).toBe('nested');
    expect(rootList.entries[0].type).toBe('directory');

    // List recursively to find nested file
    const recursiveList = await listTool._execute({ 
      path: testDir, 
      recursive: true 
    });
    
    const nestedFileEntry = recursiveList.entries.find(e => e.name === 'file.txt');
    expect(nestedFileEntry).toBeDefined();
    expect(nestedFileEntry.path).toBe(nestedFile);

    // Read the nested file
    const readResult = await readTool._execute({ absolute_path: nestedFile });
    expect(readResult.content).toBe(content);
  });

  test('should handle error scenarios gracefully', async () => {
    // Try to read non-existent file
    await expect(readTool._execute({ 
      absolute_path: path.join(testDir, 'nonexistent.txt') 
    })).rejects.toThrow('File not found or not accessible');

    // Try to list non-existent directory  
    await expect(listTool._execute({ 
      path: path.join(testDir, 'nonexistent-dir')
    })).rejects.toThrow('Directory not found');

    // All errors should fail fast (Legion pattern)
    // No fallbacks or graceful degradation
  });
});