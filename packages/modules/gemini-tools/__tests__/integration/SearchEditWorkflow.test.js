/**
 * Integration test for complete search and edit workflow
 * Tests grep and edit tools working together with real file system
 * NO MOCKS - uses real file operations
 */

import ReadFileTool from '../../src/tools/ReadFileTool.js';
import WriteFileTool from '../../src/tools/WriteFileTool.js';
import GrepTool from '../../src/tools/GrepTool.js';
import EditFileTool from '../../src/tools/EditFileTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Search and Edit Workflow Integration', () => {
  let readTool, writeTool, grepTool, editTool;
  let testDir;

  beforeEach(async () => {
    // Create real test directory
    testDir = path.join(os.tmpdir(), `gemini-search-edit-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create tool instances
    const config = { basePath: testDir, encoding: 'utf-8' };
    readTool = new ReadFileTool(config);
    writeTool = new WriteFileTool(config);
    grepTool = new GrepTool(config);
    editTool = new EditFileTool(config);
  });

  afterEach(async () => {
    // Clean up real test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should complete search → edit → verify workflow', async () => {
    // Step 1: Write test files with searchable content
    const file1 = path.join(testDir, 'component.js');
    const file2 = path.join(testDir, 'utils.js');
    
    await writeTool._execute({
      absolute_path: file1,
      content: 'export function oldFunction() {\n  return "old value";\n}'
    });
    
    await writeTool._execute({
      absolute_path: file2,
      content: 'import { oldFunction } from "./component.js";\nconsole.log(oldFunction());'
    });

    // Step 2: Search for the old function name
    const searchResult = await grepTool._execute({
      pattern: 'oldFunction',
      path: testDir,
      include: '*.js'
    });

    expect(searchResult.totalMatches).toBe(3); // Function declaration, import, call
    expect(searchResult.matches.length).toBe(3);

    // Step 3: Edit files to rename the function
    const editResult1 = await editTool._execute({
      absolute_path: file1,
      old_string: 'oldFunction',
      new_string: 'newFunction',
      replace_all: true
    });

    const editResult2 = await editTool._execute({
      absolute_path: file2,
      old_string: 'oldFunction',
      new_string: 'newFunction',
      replace_all: true
    });

    expect(editResult1.replacements).toBe(1);
    expect(editResult2.replacements).toBe(2);

    // Step 4: Verify changes by searching again
    const verifyResult = await grepTool._execute({
      pattern: 'oldFunction',
      path: testDir
    });

    expect(verifyResult.totalMatches).toBe(0); // Should find no old references

    // Search for new function name
    const newSearchResult = await grepTool._execute({
      pattern: 'newFunction',
      path: testDir
    });

    expect(newSearchResult.totalMatches).toBe(3); // Same number of matches with new name

    // Step 5: Verify final file contents
    const finalContent1 = await readTool._execute({ absolute_path: file1 });
    const finalContent2 = await readTool._execute({ absolute_path: file2 });

    expect(finalContent1.content).toContain('newFunction');
    expect(finalContent1.content).not.toContain('oldFunction');
    expect(finalContent2.content).toContain('newFunction');
    expect(finalContent2.content).not.toContain('oldFunction');
  });

  test('should handle complex refactoring workflow', async () => {
    // Create a more complex codebase
    await fs.mkdir(path.join(testDir, 'src'));
    
    const files = [
      { 
        path: path.join(testDir, 'src', 'auth.js'),
        content: 'export class AuthService {\n  authenticate() {\n    return "old-auth";\n  }\n}'
      },
      {
        path: path.join(testDir, 'src', 'user.js'), 
        content: 'import { AuthService } from "./auth.js";\nconst auth = new AuthService();\nauth.authenticate();'
      },
      {
        path: path.join(testDir, 'README.md'),
        content: '# Project\n\nUses old-auth system for authentication.'
      }
    ];

    // Write all files
    for (const file of files) {
      await writeTool._execute({
        absolute_path: file.path,
        content: file.content
      });
    }

    // Search for old authentication references
    const oldAuthSearch = await grepTool._execute({
      pattern: 'old-auth',
      path: testDir
    });

    expect(oldAuthSearch.totalMatches).toBe(2); // In auth.js and README.md

    // Replace old-auth with new-auth system
    for (const match of oldAuthSearch.matches) {
      await editTool._execute({
        absolute_path: match.filePath,
        old_string: 'old-auth',
        new_string: 'new-auth',
        replace_all: true
      });
    }

    // Verify no old references remain
    const verifySearch = await grepTool._execute({
      pattern: 'old-auth',
      path: testDir
    });

    expect(verifySearch.totalMatches).toBe(0);

    // Verify new references exist
    const newAuthSearch = await grepTool._execute({
      pattern: 'new-auth',
      path: testDir
    });

    expect(newAuthSearch.totalMatches).toBe(2);
  });

  test('should handle error scenarios in workflow', async () => {
    // Try to search in non-existent directory
    await expect(grepTool._execute({
      pattern: 'test',
      path: path.join(testDir, 'nonexistent')
    })).rejects.toThrow();

    // Try to edit non-existent file
    await expect(editTool._execute({
      absolute_path: path.join(testDir, 'nonexistent.js'),
      old_string: 'old',
      new_string: 'new'
    })).rejects.toThrow('File not found or not accessible');

    // All errors should fail fast (Legion pattern)
  });
});