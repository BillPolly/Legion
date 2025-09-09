/**
 * Integration test for complete 10-tool toolset
 * NO MOCKS - tests all tools with real operations
 */

import GeminiToolsModule from '../../src/GeminiToolsModule.js';
import { ResourceManager } from '@legion/resource-manager';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Complete Toolset Integration (10 Tools)', () => {
  let toolsModule;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    // Get real ResourceManager (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    
    // Create test directory
    testDir = path.join(os.tmpdir(), `complete-toolset-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Initialize tools module
    toolsModule = await GeminiToolsModule.create(resourceManager);
    
    console.log('Tools available:', toolsModule.getStatistics().tools);
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should have all 10 tools available', () => {
    const stats = toolsModule.getStatistics();
    expect(stats.toolCount).toBe(10);
    
    const expectedTools = [
      'read_file', 'write_file', 'list_files', 'grep_search', 
      'edit_file', 'shell_command', 'glob_pattern', 'read_many_files',
      'save_memory', 'smart_edit'
    ];
    
    for (const tool of expectedTools) {
      expect(stats.tools).toContain(tool);
    }
  });

  test('should execute write_file → read_file → edit_file workflow', async () => {
    const testFile = path.join(testDir, 'workflow.js');
    
    // Step 1: Create file
    const writeResult = await toolsModule.invoke('write_file', {
      absolute_path: testFile,
      content: 'function oldName() {\n  return "original value";\n}'
    });
    expect(writeResult.success).toBe(true);
    
    // Step 2: Read it back
    const readResult = await toolsModule.invoke('read_file', {
      absolute_path: testFile
    });
    expect(readResult.success).toBe(true);
    expect(readResult.data.content).toContain('oldName');
    
    // Step 3: Edit the function name
    const editResult = await toolsModule.invoke('edit_file', {
      absolute_path: testFile,
      old_string: 'oldName',
      new_string: 'newName'
    });
    expect(editResult.success).toBe(true);
    
    // Step 4: Verify edit worked
    const verifyResult = await toolsModule.invoke('read_file', {
      absolute_path: testFile
    });
    expect(verifyResult.data.content).toContain('newName');
    expect(verifyResult.data.content).not.toContain('oldName');
  });

  test('should execute search workflow with grep_search and glob_pattern', async () => {
    // Create test files
    await fs.writeFile(path.join(testDir, 'test1.js'), 'function calculateSum() { return 1; }');
    await fs.writeFile(path.join(testDir, 'test2.ts'), 'function calculateTotal() { return 2; }');
    await fs.writeFile(path.join(testDir, 'readme.md'), '# Calculate functions');
    
    // Test grep search
    const grepResult = await toolsModule.invoke('grep_search', {
      pattern: 'calculate',
      path: testDir
    });
    expect(grepResult.success).toBe(true);
    expect(grepResult.data.totalMatches).toBeGreaterThan(0);
    
    // Test glob pattern for JS/TS files
    const globResult = await toolsModule.invoke('glob_pattern', {
      pattern: '*.{js,ts}',
      path: testDir
    });
    expect(globResult.success).toBe(true);
    expect(globResult.data.totalFiles).toBe(2);
  });

  test('should execute read_many_files for batch operations', async () => {
    // Create multiple files
    const files = ['batch1.js', 'batch2.js', 'batch3.txt'];
    for (const file of files) {
      await fs.writeFile(path.join(testDir, file), `Content of ${file}`);
    }
    
    const result = await toolsModule.invoke('read_many_files', {
      paths: [testDir],
      include: ['*.js'],
      recursive: false
    });
    
    expect(result.success).toBe(true);
    expect(result.data.totalFiles).toBe(2); // Only JS files
    
    for (const file of result.data.files) {
      expect(file.path).toMatch(/\.js$/);
      expect(file.content).toContain('Content of');
    }
  });

  test('should execute shell_command for system operations', async () => {
    const result = await toolsModule.invoke('shell_command', {
      command: 'echo "Shell command working!"',
      working_directory: testDir
    });
    
    expect(result.success).toBe(true);
    expect(result.data.stdout).toContain('Shell command working!');
    expect(result.data.exit_code).toBe(0);
  });

  test('should execute save_memory for fact storage', async () => {
    const result = await toolsModule.invoke('save_memory', {
      fact: 'User prefers TypeScript for new projects'
    });
    
    expect(result.success).toBe(true);
    expect(result.data.saved).toBe(true);
    expect(result.data.fact).toBe('User prefers TypeScript for new projects');
    
    // Verify memory file was created
    const memoryFileExists = await fs.access(result.data.memoryPath).then(() => true).catch(() => false);
    expect(memoryFileExists).toBe(true);
  });

  test('should execute smart_edit with validation', async () => {
    const testFile = path.join(testDir, 'smart.js');
    await fs.writeFile(testFile, '{"name": "test", "value": 42}');
    
    const result = await toolsModule.invoke('smart_edit', {
      absolute_path: testFile,
      old_string: '"test"',
      new_string: '"updated"',
      create_backup: false
    });
    
    expect(result.success).toBe(true);
    expect(result.data.changes_made).toBe(true);
    expect(result.data.validation_passed).toBe(true);
    
    // Verify edit was applied
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('"updated"');
  });

  test('should handle complete development workflow', async () => {
    // Simulate a complete development task
    const projectDir = path.join(testDir, 'project');
    await fs.mkdir(projectDir);
    
    // 1. List initial directory
    const listResult = await toolsModule.invoke('list_files', {
      path: projectDir
    });
    expect(listResult.data.entries.length).toBe(0);
    
    // 2. Create package.json
    await toolsModule.invoke('write_file', {
      absolute_path: path.join(projectDir, 'package.json'),
      content: JSON.stringify({name: 'test-project', version: '1.0.0'}, null, 2)
    });
    
    // 3. Create source file
    await toolsModule.invoke('write_file', {
      absolute_path: path.join(projectDir, 'index.js'),
      content: 'console.log("Hello Project");'
    });
    
    // 4. Search for console.log
    const searchResult = await toolsModule.invoke('grep_search', {
      pattern: 'console.log',
      path: projectDir
    });
    expect(searchResult.data.totalMatches).toBe(1);
    
    // 5. List final structure
    const finalList = await toolsModule.invoke('list_files', {
      path: projectDir
    });
    expect(finalList.data.entries.length).toBe(2);
    
    console.log('✅ Complete workflow test passed');
  });
});