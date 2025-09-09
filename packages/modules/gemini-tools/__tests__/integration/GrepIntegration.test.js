/**
 * Integration tests for GrepTool with real file system
 * NO MOCKS - uses real file operations
 */

import GrepTool from '../../src/tools/GrepTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('GrepTool Integration', () => {
  let tool;
  let testDir;

  beforeEach(async () => {
    // Create real test directory and files
    testDir = path.join(os.tmpdir(), `gemini-grep-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create test files with searchable content
    await fs.writeFile(
      path.join(testDir, 'test1.js'),
      'function hello() {\n  console.log("Hello World");\n  return "test";\n}'
    );
    
    await fs.writeFile(
      path.join(testDir, 'test2.js'),
      'const greeting = "Hello";\nfunction goodbye() {\n  console.log("Goodbye");\n}'
    );
    
    await fs.writeFile(
      path.join(testDir, 'readme.md'),
      '# Hello Project\n\nThis is a test project.\nHello from markdown!'
    );

    // Create subdirectory with more files
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.writeFile(
      path.join(testDir, 'src', 'utils.js'),
      'export function sayHello(name) {\n  return `Hello ${name}!`;\n}'
    );

    tool = new GrepTool({ basePath: testDir });
  });

  afterEach(async () => {
    // Clean up real test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should find pattern matches in real files', async () => {
    const result = await tool._execute({ 
      pattern: 'Hello',
      path: testDir 
    });

    expect(result.totalMatches).toBeGreaterThan(0);
    expect(Array.isArray(result.matches)).toBe(true);

    // Should find Hello in multiple files
    const filePaths = result.matches.map(m => path.basename(m.filePath));
    expect(filePaths).toContain('test1.js');
    expect(filePaths).toContain('test2.js');
    expect(filePaths).toContain('readme.md');
  });

  test('should search with file inclusion pattern', async () => {
    const result = await tool._execute({ 
      pattern: 'console',
      path: testDir,
      include: '*.js'
    });

    expect(result.totalMatches).toBeGreaterThan(0);
    
    // Should only find matches in .js files
    for (const match of result.matches) {
      expect(path.extname(match.filePath)).toBe('.js');
    }
  });

  test('should provide line numbers and content', async () => {
    const result = await tool._execute({ 
      pattern: 'function hello',
      path: testDir 
    });

    expect(result.totalMatches).toBe(1);
    const match = result.matches[0];
    
    expect(match.lineNumber).toBe(1); // First line
    expect(match.line).toContain('function hello');
    expect(path.basename(match.filePath)).toBe('test1.js');
  });

  test('should handle case-insensitive search', async () => {
    const result = await tool._execute({ 
      pattern: 'HELLO', // Uppercase
      path: testDir 
    });

    // Should find lowercase "hello" matches due to case-insensitive regex
    expect(result.totalMatches).toBeGreaterThan(0);
  });

  test('should search recursively in subdirectories', async () => {
    const result = await tool._execute({ 
      pattern: 'sayHello',
      path: testDir 
    });

    expect(result.totalMatches).toBe(1);
    const match = result.matches[0];
    expect(match.filePath).toContain('src/utils.js');
    expect(match.line).toContain('sayHello');
  });

  test('should handle regex patterns', async () => {
    const result = await tool._execute({ 
      pattern: 'function \\w+\\(',
      path: testDir 
    });

    // Should find function declarations
    expect(result.totalMatches).toBeGreaterThan(0);
    
    const functionMatches = result.matches.filter(m => 
      m.line.includes('function hello') || 
      m.line.includes('function goodbye') ||
      m.line.includes('function sayHello')
    );
    expect(functionMatches.length).toBeGreaterThan(0);
  });

  test('should return empty results for non-matching pattern', async () => {
    const result = await tool._execute({ 
      pattern: 'NONEXISTENT_PATTERN_12345',
      path: testDir 
    });

    expect(result.totalMatches).toBe(0);
    expect(result.matches.length).toBe(0);
  });

  test('should fail with invalid regex pattern', async () => {
    await expect(tool._execute({ 
      pattern: '[invalid(regex',
      path: testDir 
    })).rejects.toThrow('Invalid regex pattern');
  });
});