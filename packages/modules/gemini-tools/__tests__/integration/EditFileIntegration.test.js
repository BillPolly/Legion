/**
 * Integration tests for EditFileTool with real file system
 * NO MOCKS - uses real file operations
 */

import EditFileTool from '../../src/tools/EditFileTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('EditFileTool Integration', () => {
  let tool;
  let testDir;

  beforeEach(async () => {
    // Create real test directory and file
    testDir = path.join(os.tmpdir(), `gemini-edit-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    tool = new EditFileTool({
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

  test('should edit real file with single replacement', async () => {
    const testFile = path.join(testDir, 'edit-test.js');
    const originalContent = 'console.log("Hello World");\nconst x = 42;';
    await fs.writeFile(testFile, originalContent, 'utf-8');

    const result = await tool._execute({
      absolute_path: testFile,
      old_string: 'Hello World',
      new_string: 'Hello Universe',
      replace_all: false
    });

    expect(result.path).toBe(testFile);
    expect(result.replacements).toBe(1);
    expect(result.backup_path).toBeDefined();

    // Verify file content was changed
    const newContent = await fs.readFile(testFile, 'utf-8');
    expect(newContent).toBe('console.log("Hello Universe");\nconst x = 42;');

    // Verify backup was created
    const backupExists = await fs.access(result.backup_path).then(() => true).catch(() => false);
    expect(backupExists).toBe(true);

    // Verify backup content
    const backupContent = await fs.readFile(result.backup_path, 'utf-8');
    expect(backupContent).toBe(originalContent);
  });

  test('should edit real file with replace all', async () => {
    const testFile = path.join(testDir, 'replace-all.js');
    const originalContent = 'let x = test;\nlet y = test;\nlet z = test;';
    await fs.writeFile(testFile, originalContent, 'utf-8');

    const result = await tool._execute({
      absolute_path: testFile,
      old_string: 'test',
      new_string: 'value',
      replace_all: true
    });

    expect(result.replacements).toBe(3);

    // Verify all occurrences were replaced
    const newContent = await fs.readFile(testFile, 'utf-8');
    expect(newContent).toBe('let x = value;\nlet y = value;\nlet z = value;');
    expect(newContent).not.toContain('test');
  });

  test('should handle special characters in replacement', async () => {
    const testFile = path.join(testDir, 'special-chars.js');
    const originalContent = 'const regex = /pattern/;';
    await fs.writeFile(testFile, originalContent, 'utf-8');

    const result = await tool._execute({
      absolute_path: testFile,
      old_string: '/pattern/',
      new_string: '/new[.*+?^${}()|pattern/',
      replace_all: false
    });

    expect(result.replacements).toBe(1);

    const newContent = await fs.readFile(testFile, 'utf-8');
    expect(newContent).toBe('const regex = /new[.*+?^${}()|pattern/;');
  });

  test('should fail when string not found', async () => {
    const testFile = path.join(testDir, 'not-found.js');
    await fs.writeFile(testFile, 'console.log("test");', 'utf-8');

    await expect(tool._execute({
      absolute_path: testFile,
      old_string: 'NONEXISTENT',
      new_string: 'replacement'
    })).rejects.toThrow('String not found in file');

    // Verify file wasn't modified
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe('console.log("test");');
  });

  test('should fail with non-existent file', async () => {
    const nonExistentFile = path.join(testDir, 'nonexistent.txt');

    await expect(tool._execute({
      absolute_path: nonExistentFile,
      old_string: 'old',
      new_string: 'new'
    })).rejects.toThrow('File not found or not accessible');
  });

  test('should handle multiline replacements', async () => {
    const testFile = path.join(testDir, 'multiline.js');
    const originalContent = `function old() {
  return "old value";
}`;
    await fs.writeFile(testFile, originalContent, 'utf-8');

    const result = await tool._execute({
      absolute_path: testFile,
      old_string: 'function old() {\n  return "old value";\n}',
      new_string: 'function new() {\n  return "new value";\n}',
      replace_all: false
    });

    expect(result.replacements).toBe(1);

    const newContent = await fs.readFile(testFile, 'utf-8');
    expect(newContent).toBe(`function new() {
  return "new value";
}`);
  });
});