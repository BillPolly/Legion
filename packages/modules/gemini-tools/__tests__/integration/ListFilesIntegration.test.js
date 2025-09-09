/**
 * Integration tests for ListFilesTool with real file system
 * NO MOCKS - uses real file operations
 */

import ListFilesTool from '../../src/tools/ListFilesTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('ListFilesTool Integration', () => {
  let tool;
  let testDir;

  beforeEach(async () => {
    // Create real test directory structure
    testDir = path.join(os.tmpdir(), `gemini-tools-list-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create test files and directories
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'File 1 content');
    await fs.writeFile(path.join(testDir, 'file2.js'), 'console.log("test");');
    await fs.mkdir(path.join(testDir, 'subdir'));
    await fs.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'Nested content');

    tool = new ListFilesTool({
      basePath: testDir
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

  test('should list real directory contents', async () => {
    const result = await tool._execute({ path: testDir });

    expect(result.path).toBe(testDir);
    expect(Array.isArray(result.entries)).toBe(true);
    expect(result.entries.length).toBe(3); // 2 files + 1 directory

    // Check entries are properly structured
    const fileNames = result.entries.map(e => e.name);
    expect(fileNames).toContain('file1.txt');
    expect(fileNames).toContain('file2.js');
    expect(fileNames).toContain('subdir');

    // Check directory entry
    const subdirEntry = result.entries.find(e => e.name === 'subdir');
    expect(subdirEntry.type).toBe('directory');

    // Check file entries
    const file1Entry = result.entries.find(e => e.name === 'file1.txt');
    expect(file1Entry.type).toBe('file');
    expect(file1Entry.size).toBeGreaterThan(0);
    expect(file1Entry.modified).toBeDefined();
  });

  test('should list recursively when requested', async () => {
    const result = await tool._execute({ 
      path: testDir,
      recursive: true 
    });

    expect(result.entries.length).toBeGreaterThan(3); // Should include nested files
    
    // Should include the nested file
    const nestedFile = result.entries.find(e => e.name === 'nested.txt');
    expect(nestedFile).toBeDefined();
    expect(nestedFile.path).toContain('subdir');
  });

  test('should fail with non-existent directory', async () => {
    const nonExistentDir = path.join(testDir, 'nonexistent');
    
    await expect(tool._execute({ path: nonExistentDir }))
      .rejects.toThrow('Directory not found');
  });

  test('should fail when path is not a directory', async () => {
    const filePath = path.join(testDir, 'file1.txt');
    
    await expect(tool._execute({ path: filePath }))
      .rejects.toThrow('Path is not a directory');
  });

  test('should sort entries properly (directories first)', async () => {
    const result = await tool._execute({ path: testDir });
    
    // Find first directory and first file
    let firstDirIndex = -1;
    let firstFileIndex = -1;
    
    for (let i = 0; i < result.entries.length; i++) {
      const entry = result.entries[i];
      if (entry.type === 'directory' && firstDirIndex === -1) {
        firstDirIndex = i;
      }
      if (entry.type === 'file' && firstFileIndex === -1) {
        firstFileIndex = i;
      }
    }
    
    if (firstDirIndex !== -1 && firstFileIndex !== -1) {
      expect(firstDirIndex).toBeLessThan(firstFileIndex);
    }
  });
});