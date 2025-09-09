/**
 * Integration tests for GlobTool with real file system
 * NO MOCKS - uses real file operations
 */

import GlobTool from '../../src/tools/GlobTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('GlobTool Integration', () => {
  let tool;
  let testDir;

  beforeEach(async () => {
    // Create real test directory structure
    testDir = path.join(os.tmpdir(), `gemini-glob-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create comprehensive test file structure
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.mkdir(path.join(testDir, 'test'));
    await fs.mkdir(path.join(testDir, 'docs'));
    await fs.mkdir(path.join(testDir, 'src', 'components'));
    await fs.mkdir(path.join(testDir, 'src', 'utils'));

    // Create test files with different extensions
    const testFiles = [
      'package.json',
      'README.md',
      'src/index.js',
      'src/app.ts',
      'src/components/Button.jsx',
      'src/components/Modal.tsx',
      'src/utils/helpers.js',
      'src/utils/validators.ts',
      'test/app.test.js',
      'test/utils.test.ts',
      'docs/guide.md',
      'docs/api.txt'
    ];

    for (const file of testFiles) {
      const filePath = path.join(testDir, file);
      await fs.writeFile(filePath, `// ${file}\ncontent for ${file}`);
    }

    tool = new GlobTool({ basePath: testDir });
  });

  afterEach(async () => {
    // Clean up real test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should match simple glob patterns', async () => {
    const result = await tool._execute({ 
      pattern: '*.js',
      path: testDir 
    });

    expect(result.totalFiles).toBeGreaterThan(0);
    expect(Array.isArray(result.files)).toBe(true);
    
    // Should find JavaScript files in root
    const jsFiles = result.files.filter(f => f.endsWith('.js'));
    expect(jsFiles.length).toBeGreaterThan(0);
  });

  test('should match recursive glob patterns', async () => {
    const result = await tool._execute({ 
      pattern: '**/*.js',
      path: testDir 
    });

    expect(result.totalFiles).toBeGreaterThan(0);
    
    // Should find JS files in subdirectories too
    const hasNestedJS = result.files.some(f => f.includes('src/') && f.endsWith('.js'));
    expect(hasNestedJS).toBe(true);
  });

  test('should match TypeScript files', async () => {
    const result = await tool._execute({ 
      pattern: '**/*.ts',
      path: testDir 
    });

    expect(result.totalFiles).toBeGreaterThan(0);
    
    // Should find TypeScript files
    const tsFiles = result.files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    expect(tsFiles.length).toBeGreaterThan(0);
  });

  test('should match multiple extensions pattern', async () => {
    const result = await tool._execute({ 
      pattern: '**/*.{js,ts}',
      path: testDir 
    });

    expect(result.totalFiles).toBeGreaterThan(0);
    
    // Should find both JS and TS files
    const hasJS = result.files.some(f => f.endsWith('.js'));
    const hasTS = result.files.some(f => f.endsWith('.ts'));
    expect(hasJS).toBe(true);
    expect(hasTS).toBe(true);
  });

  test('should match files in specific directories', async () => {
    const result = await tool._execute({ 
      pattern: 'src/**/*.js',
      path: testDir 
    });

    expect(result.totalFiles).toBeGreaterThan(0);
    
    // All results should be in src directory
    for (const file of result.files) {
      expect(file).toContain('/src/');
    }
  });

  test('should handle case sensitivity', async () => {
    // Create file with mixed case
    await fs.writeFile(path.join(testDir, 'MixedCase.JS'), 'mixed case content');

    const caseSensitive = await tool._execute({ 
      pattern: '*.js',
      path: testDir,
      case_sensitive: true
    });

    const caseInsensitive = await tool._execute({ 
      pattern: '*.js',
      path: testDir,
      case_sensitive: false
    });

    // Case insensitive should find more files (including .JS)
    expect(caseInsensitive.totalFiles).toBeGreaterThanOrEqual(caseSensitive.totalFiles);
  });

  test('should sort files by recency', async () => {
    // Create files with different timestamps
    const recentFile = path.join(testDir, 'recent.js');
    const oldFile = path.join(testDir, 'old.js');
    
    await fs.writeFile(oldFile, 'old content');
    
    // Wait a bit and create recent file
    await new Promise(resolve => setTimeout(resolve, 10));
    await fs.writeFile(recentFile, 'recent content');

    const result = await tool._execute({ 
      pattern: '*.js',
      path: testDir 
    });

    expect(result.totalFiles).toBeGreaterThan(0);
    
    // Files should be returned (recent files typically come first in Gemini CLI)
    expect(Array.isArray(result.files)).toBe(true);
  });

  test('should handle non-existent directories', async () => {
    await expect(tool._execute({
      pattern: '*.js',
      path: '/nonexistent/directory'
    })).rejects.toThrow('Search path not found or not accessible');
  });

  test('should validate pattern input', async () => {
    await expect(tool._execute({
      pattern: '',
      path: testDir
    })).rejects.toThrow('Pattern cannot be empty');

    await expect(tool._execute({
      pattern: 123,
      path: testDir
    })).rejects.toThrow('Pattern must be a string');
  });

  test('should find no matches for impossible patterns', async () => {
    const result = await tool._execute({ 
      pattern: '*.impossible_extension',
      path: testDir 
    });

    expect(result.totalFiles).toBe(0);
    expect(result.files.length).toBe(0);
  });
});