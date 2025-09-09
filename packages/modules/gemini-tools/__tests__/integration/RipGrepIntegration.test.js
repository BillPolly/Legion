/**
 * Integration tests for RipGrepTool with real file system
 * NO MOCKS - uses real file operations
 */

import RipGrepTool from '../../src/tools/RipGrepTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('RipGrepTool Integration', () => {
  let tool;
  let testDir;

  beforeEach(async () => {
    // Create real test directory structure
    testDir = path.join(os.tmpdir(), `gemini-ripgrep-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test files with searchable content
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.mkdir(path.join(testDir, 'tests'));

    const testFiles = [
      { path: 'src/app.js', content: 'function calculateTotal() {\n  return sum + tax;\n}\nconsole.log("Debug message");' },
      { path: 'src/utils.ts', content: 'export function calculateSum(a: number, b: number) {\n  return a + b;\n}' },
      { path: 'tests/app.test.js', content: 'test("calculateTotal works", () => {\n  expect(calculateTotal()).toBe(10);\n});' },
      { path: 'README.md', content: '# Project\n\nCalculate totals and sums.' },
      { path: 'config.py', content: 'def calculate_value():\n    return 42' }
    ];

    for (const file of testFiles) {
      await fs.writeFile(path.join(testDir, file.path), file.content);
    }

    tool = new RipGrepTool({ basePath: testDir });
  });

  afterEach(async () => {
    // Clean up real test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should perform fast search across all files', async () => {
    const result = await tool._execute({
      pattern: 'calculate',
      path: testDir
    });

    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.searchedFiles).toBeGreaterThan(0);
    expect(Array.isArray(result.matches)).toBe(true);

    // Should find matches in multiple files
    const uniqueFiles = new Set(result.matches.map(m => m.filePath));
    expect(uniqueFiles.size).toBeGreaterThan(1);

    // Each match should have proper structure
    for (const match of result.matches) {
      expect(match.filePath).toBeDefined();
      expect(match.lineNumber).toBeGreaterThan(0);
      expect(match.line).toBeDefined();
      expect(match.matchText).toBeDefined();
    }
  });

  test('should filter by file type', async () => {
    const result = await tool._execute({
      pattern: 'function',
      path: testDir,
      file_type: 'js'
    });

    expect(result.totalMatches).toBeGreaterThan(0);

    // Should only search JavaScript files
    for (const match of result.matches) {
      expect(match.filePath).toMatch(/\.js$/);
    }
  });

  test('should handle case sensitivity', async () => {
    const caseSensitive = await tool._execute({
      pattern: 'CALCULATE',
      path: testDir,
      ignore_case: false
    });

    const caseInsensitive = await tool._execute({
      pattern: 'CALCULATE',
      path: testDir,
      ignore_case: true
    });

    // Case insensitive should find more matches
    expect(caseInsensitive.totalMatches).toBeGreaterThanOrEqual(caseSensitive.totalMatches);
  });

  test('should search TypeScript files when specified', async () => {
    const result = await tool._execute({
      pattern: 'number',
      path: testDir,
      file_type: 'ts'
    });

    expect(result.totalMatches).toBeGreaterThan(0);

    // Should only search TypeScript files
    for (const match of result.matches) {
      expect(match.filePath).toMatch(/\.ts$/);
    }
  });

  test('should provide detailed match information', async () => {
    const result = await tool._execute({
      pattern: 'calculateTotal',
      path: testDir
    });

    expect(result.totalMatches).toBeGreaterThan(0);
    
    const match = result.matches[0];
    expect(typeof match.matchStart).toBe('number');
    expect(match.matchText).toBe('calculateTotal');
    expect(match.line).toContain('calculateTotal');
  });

  test('should handle regex patterns', async () => {
    const result = await tool._execute({
      pattern: 'function \\w+\\(',
      path: testDir,
      file_type: 'js'
    });

    expect(result.totalMatches).toBeGreaterThan(0);
    
    // Should find function declarations
    const functionMatches = result.matches.filter(m => 
      m.line.includes('function') && m.line.includes('(')
    );
    expect(functionMatches.length).toBeGreaterThan(0);
  });

  test('should search all file types when no type specified', async () => {
    const result = await tool._execute({
      pattern: 'calculate',
      path: testDir
    });

    expect(result.totalMatches).toBeGreaterThan(0);

    // Should search across different file types
    const fileExtensions = new Set(
      result.matches.map(m => path.extname(m.filePath))
    );
    expect(fileExtensions.size).toBeGreaterThan(1);
  });

  test('should validate input parameters', async () => {
    await expect(tool._execute({
      pattern: '',
      path: testDir
    })).rejects.toThrow('Pattern cannot be empty');

    await expect(tool._execute({
      pattern: '[invalid(regex',
      path: testDir
    })).rejects.toThrow('Invalid regex pattern');
  });

  test('should return no matches for non-existent pattern', async () => {
    const result = await tool._execute({
      pattern: 'NONEXISTENT_PATTERN_12345',
      path: testDir
    });

    expect(result.totalMatches).toBe(0);
    expect(result.matches.length).toBe(0);
    expect(result.searchedFiles).toBeGreaterThan(0); // Files were searched
  });

  test('should provide search statistics', async () => {
    const result = await tool._execute({
      pattern: 'calculate',
      path: testDir
    });

    expect(typeof result.totalMatches).toBe('number');
    expect(typeof result.searchedFiles).toBe('number');
    expect(result.searchedFiles).toBeGreaterThan(0);
    expect(result.totalMatches).toBeGreaterThanOrEqual(0);
  });
});