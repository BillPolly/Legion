/**
 * Integration tests for ReadManyFilesTool with real file system
 * NO MOCKS - uses real file operations
 */

import ReadManyFilesTool from '../../src/tools/ReadManyFilesTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('ReadManyFilesTool Integration', () => {
  let tool;
  let testDir;

  beforeEach(async () => {
    // Create real test directory structure
    testDir = path.join(os.tmpdir(), `gemini-readmany-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create test files with content
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.mkdir(path.join(testDir, 'tests'));

    const testFiles = [
      { path: 'config.js', content: 'module.exports = { env: "test" };' },
      { path: 'README.md', content: '# Test Project\n\nThis is a test.' },
      { path: 'src/index.js', content: 'console.log("Hello World");\nexport default function() {}' },
      { path: 'src/utils.js', content: 'export function helper() {\n  return "help";\n}' },
      { path: 'tests/test1.js', content: 'test("should work", () => {\n  expect(true).toBe(true);\n});' },
      { path: 'ignore.log', content: 'log file content' }
    ];

    for (const file of testFiles) {
      await fs.writeFile(path.join(testDir, file.path), file.content);
    }

    tool = new ReadManyFilesTool({ basePath: testDir, encoding: 'utf-8' });
  });

  afterEach(async () => {
    // Clean up real test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should read multiple specified files', async () => {
    const result = await tool._execute({
      paths: [
        path.join(testDir, 'config.js'),
        path.join(testDir, 'README.md')
      ]
    });

    expect(result.totalFiles).toBe(2);
    expect(Array.isArray(result.files)).toBe(true);

    // Check file contents
    const configFile = result.files.find(f => f.path.includes('config.js'));
    const readmeFile = result.files.find(f => f.path.includes('README.md'));

    expect(configFile).toBeDefined();
    expect(configFile.content).toContain('module.exports');
    expect(configFile.lines).toBe(1);

    expect(readmeFile).toBeDefined();
    expect(readmeFile.content).toContain('# Test Project');
    expect(readmeFile.lines).toBe(3);
  });

  test('should read files from directories with include patterns', async () => {
    const result = await tool._execute({
      paths: [testDir],
      include: ['*.js'],
      recursive: true
    });

    expect(result.totalFiles).toBeGreaterThan(0);

    // Should only include JavaScript files
    for (const file of result.files) {
      expect(file.path).toMatch(/\.js$/);
    }

    // Should include files from subdirectories
    const hasSrcFiles = result.files.some(f => f.path.includes('/src/'));
    const hasTestFiles = result.files.some(f => f.path.includes('/tests/'));
    expect(hasSrcFiles).toBe(true);
    expect(hasTestFiles).toBe(true);
  });

  test('should exclude files matching exclude patterns', async () => {
    const result = await tool._execute({
      paths: [testDir],
      exclude: ['*.log', '*.md'],
      recursive: true
    });

    expect(result.totalFiles).toBeGreaterThan(0);

    // Should not include .log or .md files
    for (const file of result.files) {
      expect(file.path).not.toMatch(/\.(log|md)$/);
    }
  });

  test('should handle both include and exclude patterns', async () => {
    const result = await tool._execute({
      paths: [testDir],
      include: ['*.js', '*.ts'],
      exclude: ['*test1*'], // More specific exclude to avoid matching "test" in temp directory name
      recursive: true
    });

    expect(result.totalFiles).toBeGreaterThan(0);

    // Should include JS/TS files but exclude test1 files specifically
    for (const file of result.files) {
      expect(file.path).toMatch(/\.(js|ts)$/);
      expect(path.basename(file.path)).not.toMatch(/test1/i);
    }
  });

  test('should read files non-recursively when specified', async () => {
    const result = await tool._execute({
      paths: [testDir],
      recursive: false
    });

    // Should only include root level files
    for (const file of result.files) {
      const relativePath = path.relative(testDir, file.path);
      expect(relativePath).not.toContain('/'); // No path separators = root level
    }
  });

  test('should handle empty directories', async () => {
    const emptyDir = path.join(testDir, 'empty');
    await fs.mkdir(emptyDir);

    const result = await tool._execute({
      paths: [emptyDir],
      recursive: true
    });

    expect(result.totalFiles).toBe(0);
    expect(result.files.length).toBe(0);
  });

  test('should handle mixed file and directory paths', async () => {
    const result = await tool._execute({
      paths: [
        path.join(testDir, 'config.js'),  // Specific file
        path.join(testDir, 'src')         // Directory
      ],
      recursive: true
    });

    expect(result.totalFiles).toBeGreaterThan(1);

    // Should include the specific file
    const hasConfigFile = result.files.some(f => f.path.includes('config.js'));
    expect(hasConfigFile).toBe(true);

    // Should include files from src directory
    const hasSrcFiles = result.files.some(f => f.path.includes('/src/'));
    expect(hasSrcFiles).toBe(true);
  });

  test('should validate input parameters', async () => {
    await expect(tool._execute({
      paths: 'not-an-array'
    })).rejects.toThrow('Paths must be an array');

    await expect(tool._execute({
      paths: []
    })).rejects.toThrow('At least one path must be provided');
  });

  test('should handle non-existent paths gracefully', async () => {
    const result = await tool._execute({
      paths: [
        path.join(testDir, 'config.js'),        // Exists
        path.join(testDir, 'nonexistent.js')    // Doesn't exist
      ]
    });

    // Should read the existing file and skip the non-existent one
    expect(result.totalFiles).toBe(1);
    expect(result.files[0].path).toContain('config.js');
  });

  test('should provide file metadata', async () => {
    const result = await tool._execute({
      paths: [path.join(testDir, 'src', 'index.js')]
    });

    expect(result.totalFiles).toBe(1);
    const file = result.files[0];

    expect(file.path).toBeDefined();
    expect(file.content).toBeDefined();
    expect(file.lines).toBeDefined();
    expect(typeof file.lines).toBe('number');
    expect(file.lines).toBeGreaterThan(0);
  });
});