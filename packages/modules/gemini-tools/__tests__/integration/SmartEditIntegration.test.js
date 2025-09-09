/**
 * Integration tests for SmartEditTool with real file system
 * NO MOCKS - uses real file operations
 */

import SmartEditTool from '../../src/tools/SmartEditTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('SmartEditTool Integration', () => {
  let tool;
  let testDir;

  beforeEach(async () => {
    // Create real test directory
    testDir = path.join(os.tmpdir(), `gemini-smartedit-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    tool = new SmartEditTool({
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

  test('should perform smart edit with validation', async () => {
    const testFile = path.join(testDir, 'smart-test.js');
    const originalContent = 'function oldName() {\n  return "old value";\n}';
    await fs.writeFile(testFile, originalContent, 'utf-8');

    const result = await tool._execute({
      absolute_path: testFile,
      old_string: 'oldName',
      new_string: 'newName',
      create_backup: true
    });

    expect(result.path).toBe(testFile);
    expect(result.changes_made).toBe(true);
    expect(result.validation_passed).toBe(true);
    expect(result.backup_path).toBeDefined();

    // Verify file content was changed
    const newContent = await fs.readFile(testFile, 'utf-8');
    expect(newContent).toContain('newName');
    expect(newContent).not.toContain('oldName');

    // Verify backup was created
    const backupExists = await fs.access(result.backup_path).then(() => true).catch(() => false);
    expect(backupExists).toBe(true);

    const backupContent = await fs.readFile(result.backup_path, 'utf-8');
    expect(backupContent).toBe(originalContent);
  });

  test('should validate JSON syntax after edit', async () => {
    const testFile = path.join(testDir, 'config.json');
    const originalContent = '{\n  "name": "old-name",\n  "version": "1.0.0"\n}';
    await fs.writeFile(testFile, originalContent, 'utf-8');

    // Valid JSON edit
    const result = await tool._execute({
      absolute_path: testFile,
      old_string: '"old-name"',
      new_string: '"new-name"',
      create_backup: false
    });

    expect(result.validation_passed).toBe(true);
    expect(result.changes_made).toBe(true);

    // Invalid JSON edit should fail
    await fs.writeFile(testFile, originalContent, 'utf-8');
    
    await expect(tool._execute({
      absolute_path: testFile,
      old_string: '"old-name"',
      new_string: 'invalid-json-"syntax',
      create_backup: false
    })).rejects.toThrow('Edit validation failed: Invalid JSON syntax');
  });

  test('should validate JavaScript bracket balance', async () => {
    const testFile = path.join(testDir, 'code.js');
    const originalContent = 'function test() {\n  if (true) {\n    return "value";\n  }\n}';
    await fs.writeFile(testFile, originalContent, 'utf-8');

    // Valid edit
    const result = await tool._execute({
      absolute_path: testFile,
      old_string: '"value"',
      new_string: '"new value"',
      create_backup: false
    });

    expect(result.validation_passed).toBe(true);

    // Edit that creates unbalanced brackets should fail
    await fs.writeFile(testFile, originalContent, 'utf-8');
    
    await expect(tool._execute({
      absolute_path: testFile,
      old_string: '  }',
      new_string: '  // removed bracket',
      create_backup: false
    })).rejects.toThrow('Edit validation failed: Unbalanced brackets detected');
  });

  test('should handle no changes made scenario', async () => {
    const testFile = path.join(testDir, 'no-change.js');
    const originalContent = 'console.log("hello");';
    await fs.writeFile(testFile, originalContent, 'utf-8');

    const result = await tool._execute({
      absolute_path: testFile,
      old_string: 'NONEXISTENT_STRING',
      new_string: 'replacement',
      create_backup: true
    });

    expect(result.changes_made).toBe(false);
    expect(result.validation_passed).toBe(true);
    expect(result.backup_path).toBeNull();

    // File should be unchanged
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe(originalContent);
  });

  test('should skip backup when create_backup is false', async () => {
    const testFile = path.join(testDir, 'no-backup.js');
    await fs.writeFile(testFile, 'console.log("test");', 'utf-8');

    const result = await tool._execute({
      absolute_path: testFile,
      old_string: 'test',
      new_string: 'updated',
      create_backup: false
    });

    expect(result.changes_made).toBe(true);
    expect(result.backup_path).toBeNull();
  });

  test('should prevent editing that results in empty file', async () => {
    const testFile = path.join(testDir, 'content.js');
    const originalContent = 'const value = "important";';
    await fs.writeFile(testFile, originalContent, 'utf-8');

    await expect(tool._execute({
      absolute_path: testFile,
      old_string: originalContent,
      new_string: '',
      create_backup: false
    })).rejects.toThrow('Edit validation failed: Edit resulted in empty file');
  });

  test('should validate input parameters', async () => {
    await expect(tool._execute({
      absolute_path: '',
      old_string: 'old',
      new_string: 'new'
    })).rejects.toThrow('File path cannot be empty');

    await expect(tool._execute({
      absolute_path: '/path/to/file.js',
      old_string: 'test',
      new_string: 'test'
    })).rejects.toThrow('old_string and new_string cannot be identical');
  });

  test('should handle file not found', async () => {
    await expect(tool._execute({
      absolute_path: path.join(testDir, 'nonexistent.js'),
      old_string: 'old',
      new_string: 'new'
    })).rejects.toThrow('File not found or not accessible');
  });

  test('should handle different file types without syntax validation', async () => {
    const testFile = path.join(testDir, 'plain.txt');
    await fs.writeFile(testFile, 'This is plain text content.', 'utf-8');

    const result = await tool._execute({
      absolute_path: testFile,
      old_string: 'plain text',
      new_string: 'modified text',
      create_backup: false
    });

    expect(result.validation_passed).toBe(true);
    expect(result.changes_made).toBe(true);

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('modified text');
  });
});