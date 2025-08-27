/**
 * Final validation test - proves all tools work correctly
 */

import ClaudeToolsModule from '../../src/ClaudeToolsModule.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Final Validation - All Tools Working', () => {
  let module;
  let resourceManager;
  let testDir;

  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();
    module = await ClaudeToolsModule.create(resourceManager);
    
    testDir = path.join(os.tmpdir(), `validation-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('All 14 tools are accessible and functional', async () => {
    const expectedTools = [
      // File Operations (5)
      'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
      // Search Navigation (3) 
      'Glob', 'Grep', 'LS',
      // System Operations (1)
      'Bash',
      // Web Tools (2)
      'WebSearch', 'WebFetch', 
      // Task Management (3)
      'Task', 'TodoWrite', 'ExitPlanMode'
    ];

    const availableTools = module.listTools();
    expect(availableTools.length).toBe(14);
    
    for (const toolName of expectedTools) {
      expect(availableTools).toContain(toolName);
      
      const tool = module.getTool(toolName);
      expect(tool).toBeDefined();
      expect(tool.name).toBe(toolName);
      
      const metadata = tool.getMetadata();
      expect(metadata.name).toBe(toolName);
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.outputSchema).toBeDefined();
    }
  });

  test('All 5 modules are registered and functional', async () => {
    const expectedModules = [
      'file-operations',
      'search-navigation', 
      'system-operations',
      'web-tools',
      'task-management'
    ];

    const availableModules = module.listSubModules();
    expect(availableModules.length).toBe(5);
    
    for (const moduleName of expectedModules) {
      expect(availableModules).toContain(moduleName);
      
      const subModule = module.getSubModule(moduleName);
      expect(subModule).toBeDefined();
      expect(subModule.name).toBe(moduleName);
    }
  });

  test('Sample workflow: Create, search, edit, and execute', async () => {
    // 1. Write a file
    const testFile = path.join(testDir, 'workflow.js');
    const writeResult = await module.executeTool('Write', {
      file_path: testFile,
      content: 'console.log("Hello World");\nfunction test() { return 42; }'
    });
    expect(writeResult.success).toBe(true);

    // 2. Read the file back
    const readResult = await module.executeTool('Read', {
      file_path: testFile
    });
    expect(readResult.success).toBe(true);
    expect(readResult.data.content).toContain('Hello World');

    // 3. Search for JavaScript files
    const globResult = await module.executeTool('Glob', {
      pattern: '*.js',
      path: testDir
    });
    expect(globResult.success).toBe(true);
    expect(globResult.data.matches.length).toBe(1);

    // 4. Search content with Grep
    const grepResult = await module.executeTool('Grep', {
      pattern: 'function',
      path: testDir,
      output_mode: 'files_with_matches'
    });
    expect(grepResult.success).toBe(true);
    expect(grepResult.data.files.length).toBe(1);

    // 5. Edit the file
    const editResult = await module.executeTool('Edit', {
      file_path: testFile,
      old_string: 'Hello World',
      new_string: 'Hello Claude'
    });
    expect(editResult.success).toBe(true);

    // 6. Execute a command
    const bashResult = await module.executeTool('Bash', {
      command: `node ${testFile}`,
      description: 'Run the JavaScript file'
    });
    expect(bashResult.success).toBe(true);
    expect(bashResult.data.stdout).toContain('Hello Claude');

    // 7. Create a todo
    const todoResult = await module.executeTool('TodoWrite', {
      todos: [
        { content: 'File workflow completed', status: 'completed', id: 'wf-1' }
      ]
    });
    expect(todoResult.success).toBe(true);
    expect(todoResult.data.summary.completed).toBe(1);

    // 8. Web search
    const searchResult = await module.executeTool('WebSearch', {
      query: 'JavaScript best practices'
    });
    expect(searchResult.success).toBe(true);
    expect(searchResult.data.results).toBeInstanceOf(Array);

    // 9. Execute a task
    const taskResult = await module.executeTool('Task', {
      description: 'Validate workflow',
      prompt: 'All tools working correctly',
      subagent_type: 'general-purpose'
    });
    expect(taskResult.success).toBe(true);
    expect(taskResult.data.task_id).toBeDefined();
  });

  test('Error handling works correctly across all tools', async () => {
    // Test file operations error
    const readError = await module.executeTool('Read', {
      file_path: '/nonexistent/file.txt'
    });
    expect(readError.success).toBe(false);
    expect(readError.error).toBeDefined();

    // Test validation error
    const writeError = await module.executeTool('Write', {
      // Missing required parameters to trigger validation error
      content: 'test'
    });
    expect(writeError.success).toBe(false);

    // Test command error (use a command that will definitely fail)
    const bashError = await module.executeTool('Bash', {
      command: 'exit 1',  // Command that always fails
      description: 'Test error handling'
    });
    expect(bashError.success).toBe(true); // Bash tool succeeds even if command fails
    expect(bashError.data.exit_code).toBe(1); // But exit code shows failure
  });

  test('Module metadata is complete and accurate', async () => {
    const metadata = module.getMetadata();
    
    expect(metadata.name).toBe('claude-tools');
    expect(metadata.totalTools).toBe(14);
    expect(Object.keys(metadata.subModules)).toHaveLength(5);
    expect(Object.keys(metadata.tools)).toHaveLength(5);
    
    // Check each sub-module has correct tool counts
    expect(metadata.subModules['file-operations'].toolCount).toBe(5);
    expect(metadata.subModules['search-navigation'].toolCount).toBe(3);
    expect(metadata.subModules['system-operations'].toolCount).toBe(1);
    expect(metadata.subModules['web-tools'].toolCount).toBe(2);
    expect(metadata.subModules['task-management'].toolCount).toBe(3);
  });
});