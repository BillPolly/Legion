/**
 * Integration tests for ClaudeToolsModule
 */

import ClaudeToolsModule from '../../src/ClaudeToolsModule.js';
import { ResourceManager } from '@legion/resource-manager';
import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ClaudeToolsModule Integration', () => {
  let module;
  let resourceManager;
  let testDir;

  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();
    module = await ClaudeToolsModule.create(resourceManager);
    
    // Create test directory
    testDir = path.join(os.tmpdir(), `claude-tools-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Module initialization', () => {
    it('should create module with all sub-modules', () => {
      expect(module.name).toBe('claude-tools');
      expect(module.description).toContain('Complete suite');
      
      const subModules = module.listSubModules();
      expect(subModules).toContain('file-operations');
      expect(subModules).toContain('search-navigation');
      expect(subModules).toContain('system-operations');
      expect(subModules).toContain('web-tools');
      expect(subModules).toContain('task-management');
      expect(subModules.length).toBe(5);
    });

    it('should register all tools from sub-modules', () => {
      const tools = module.listTools();
      
      // File operations tools
      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
      expect(tools).toContain('Edit');
      expect(tools).toContain('MultiEdit');
      expect(tools).toContain('NotebookEdit');
      
      // Search navigation tools
      expect(tools).toContain('Glob');
      expect(tools).toContain('Grep');
      expect(tools).toContain('LS');
      
      // System operations tools
      expect(tools).toContain('Bash');
      
      // Web tools
      expect(tools).toContain('WebSearch');
      expect(tools).toContain('WebFetch');
      
      // Task management tools
      expect(tools).toContain('Task');
      expect(tools).toContain('TodoWrite');
      expect(tools).toContain('ExitPlanMode');
      
      // Total: 5 + 3 + 1 + 2 + 3 = 14 tools
      expect(tools.length).toBe(14);
    });

    it('should provide access to sub-modules', () => {
      const fileOpsModule = module.getSubModule('file-operations');
      expect(fileOpsModule).toBeDefined();
      expect(fileOpsModule.name).toBe('file-operations');
      
      const searchModule = module.getSubModule('search-navigation');
      expect(searchModule).toBeDefined();
      expect(searchModule.name).toBe('search-navigation');
    });

    it('should provide categorized tools', () => {
      const categories = module.getCategorizedTools();
      
      expect(categories['file-operations']).toContain('Read');
      expect(categories['file-operations']).toContain('Write');
      expect(categories['search-navigation']).toContain('Glob');
      expect(categories['system-operations']).toContain('Bash');
      expect(categories['web-tools']).toContain('WebSearch');
      expect(categories['task-management']).toContain('Task');
    });
  });

  describe('Tool execution integration', () => {
    it('should execute file operations workflow', async () => {
      const testFile = path.join(testDir, 'test.txt');
      
      // Write a file
      const writeResult = await module.executeTool('Write', {
        file_path: testFile,
        content: 'Hello, World!'
      });
      expect(writeResult.success).toBe(true);
      
      // Read the file
      const readResult = await module.executeTool('Read', {
        file_path: testFile
      });
      expect(readResult.success).toBe(true);
      expect(readResult.data.content).toBe('Hello, World!');
      
      // Edit the file
      const editResult = await module.executeTool('Edit', {
        file_path: testFile,
        old_string: 'World',
        new_string: 'Claude'
      });
      expect(editResult.success).toBe(true);
      
      // Verify edit
      const verifyResult = await module.executeTool('Read', {
        file_path: testFile
      });
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data.content).toBe('Hello, Claude!');
    });

    it('should execute search navigation workflow', async () => {
      // Create test files
      await fs.writeFile(path.join(testDir, 'file1.js'), 'const test = "value";');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'test content');
      await fs.writeFile(path.join(testDir, 'file3.js'), 'function test() {}');
      
      // Use Glob to find JS files
      const globResult = await module.executeTool('Glob', {
        pattern: '*.js',
        path: testDir
      });
      expect(globResult.success).toBe(true);
      expect(globResult.data.matches.length).toBe(2);
      
      // Use Grep to search for 'test'
      const grepResult = await module.executeTool('Grep', {
        pattern: 'test',
        path: testDir,
        output_mode: 'files_with_matches'
      });
      expect(grepResult.success).toBe(true);
      expect(grepResult.data.files.length).toBe(3);
      
      // Use LS to list files
      const lsResult = await module.executeTool('LS', {
        path: testDir
      });
      expect(lsResult.success).toBe(true);
      expect(lsResult.data.entries.length).toBe(3);
    });

    it('should execute system operations', async () => {
      // Run a simple command
      const result = await module.executeTool('Bash', {
        command: 'echo "Hello from Bash"',
        description: 'Test echo command'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('Hello from Bash');
      expect(result.data.exit_code).toBe(0);
    });

    it('should execute task management workflow', async () => {
      // Create todos
      const todoResult = await module.executeTool('TodoWrite', {
        todos: [
          { content: 'Task 1', status: 'pending', id: '1' },
          { content: 'Task 2', status: 'in_progress', id: '2' }
        ]
      });
      expect(todoResult.success).toBe(true);
      expect(todoResult.data.summary.total).toBe(2);
      
      // Execute a task
      const taskResult = await module.executeTool('Task', {
        description: 'Test task',
        prompt: 'Execute test',
        subagent_type: 'general-purpose'
      });
      expect(taskResult.success).toBe(true);
      expect(taskResult.data.task_id).toBeDefined();
      
      // Exit plan mode
      const planResult = await module.executeTool('ExitPlanMode', {
        plan: 'Test plan for implementation'
      });
      expect(planResult.success).toBe(true);
      expect(planResult.data.plan).toContain('Test plan');
    });

    it('should execute web tools', async () => {
      // Web search
      const searchResult = await module.executeTool('WebSearch', {
        query: 'test query'
      });
      expect(searchResult.success).toBe(true);
      expect(searchResult.data.results).toBeInstanceOf(Array);
      
      // Web fetch validation test
      const fetchResult = await module.executeTool('WebFetch', {
        url: 'invalid-url',
        prompt: 'test'
      });
      expect(fetchResult.success).toBe(false);
    });
  });

  describe('Metadata and introspection', () => {
    it('should provide comprehensive metadata', () => {
      const metadata = module.getMetadata();
      
      expect(metadata.name).toBe('claude-tools');
      expect(metadata.description).toBeDefined();
      expect(metadata.subModules).toBeDefined();
      expect(metadata.tools).toBeDefined();
      expect(metadata.totalTools).toBe(14);
      
      // Check sub-module metadata
      expect(metadata.subModules['file-operations']).toBeDefined();
      expect(metadata.subModules['file-operations'].toolCount).toBe(5);
      
      // Check tool grouping
      expect(metadata.tools['file-operations']).toBeInstanceOf(Array);
      expect(metadata.tools['file-operations'].length).toBe(5);
    });

    it('should provide tool metadata for all tools', () => {
      const tools = module.listTools();
      
      for (const toolName of tools) {
        const tool = module.getTool(toolName);
        expect(tool).toBeDefined();
        
        const metadata = tool.getMetadata();
        expect(metadata.name).toBe(toolName);
        expect(metadata.description).toBeDefined();
        expect(metadata.inputSchema).toBeDefined();
        expect(metadata.outputSchema).toBeDefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      // Try to read non-existent file
      const result = await module.executeTool('Read', {
        file_path: '/non/existent/file.txt'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(['ENOENT', 'FILE_NOT_FOUND', 'RESOURCE_NOT_FOUND']).toContain(result.error.code);
    });

    it('should handle validation errors', async () => {
      // Invalid input
      const result = await module.executeTool('Task', {
        description: 'ab', // Too short
        prompt: 'test',
        subagent_type: 'general-purpose'
      });
      
      expect(result.success).toBe(false);
      // Validation error could be in data or error
      expect(result.data || result.error).toBeDefined();
    });

    it('should handle non-existent tool gracefully', async () => {
      // executeTool throws an error for non-existent tools
      await expect(
        module.executeTool('NonExistentTool', {})
      ).rejects.toThrow("Tool 'NonExistentTool' not found in module");
    });
  });
});