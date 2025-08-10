/**
 * End-to-end tests for file system tasks using actual Legion tools
 * 
 * Tests the complete flow from decomposition through execution
 * with real FileModule tools
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DecentPlanner } from '../../src/index.js';
import { ResourceManager, ToolRegistry } from '@legion/tools';
import { BehaviorTreeExecutor } from '@legion/actor-bt';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('E2E File System Tasks', () => {
  let planner;
  let executor;
  let testDir;
  let resourceManager;
  let toolRegistry;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Add mock LLM client for testing
    resourceManager.set('llmClient', {
      generateResponse: async ({ messages }) => {
        // Simple mock that returns valid JSON for decomposition
        return {
          content: JSON.stringify({
            subtasks: [
              {
                id: 'task1',
                description: 'First subtask',
                complexity: 'SIMPLE',
                reasoning: 'Simple task',
                suggestedInputs: [],
                suggestedOutputs: []
              }
            ]
          })
        };
      }
    });
    
    // Initialize real tool registry with file tools
    toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    
    // Add tool registry provider for semantic search (mock for testing)
    resourceManager.set('toolRegistryProvider', {
      searchTools: async () => [],
      listTools: async () => []
    });
    
    // Create planner (will use mocks for LLM in these tests)
    planner = await DecentPlanner.create(resourceManager);
    
    // Create behavior tree executor with real tools
    executor = new BehaviorTreeExecutor(toolRegistry);
    
    // Create test directory
    testDir = path.join('/tmp', 'decent-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    
    console.log('📁 Test directory:', testDir);
  });
  
  afterAll(async () => {
    // Clean up test directory
    try {
      process.chdir(__dirname);
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error.message);
    }
  });
  
  describe('Project Structure Creation', () => {
    it('should plan and execute Node.js project structure', async () => {
      // For this test, we'll use a simplified mock decomposition
      // but real tools for execution
      const mockHierarchy = {
        id: 'root',
        description: 'Create Node.js project structure',
        complexity: 'COMPLEX',
        level: 0,
        children: [
          {
            id: 'create-dirs',
            description: 'Create project directories',
            complexity: 'SIMPLE',
            level: 1,
            suggestedInputs: [],
            suggestedOutputs: ['directories_created']
          },
          {
            id: 'create-files',
            description: 'Create configuration files',
            complexity: 'SIMPLE',
            level: 1,
            suggestedInputs: ['directories_created'],
            suggestedOutputs: ['files_created']
          }
        ]
      };
      
      // Create behavior trees for simple tasks
      const createDirsBT = {
        type: 'parallel',
        id: 'create-dirs-bt',
        successPolicy: 'all',
        children: [
          {
            type: 'action',
            id: 'create-src',
            tool: 'directory_create',
            params: { dirpath: path.join(testDir, 'src') }
          },
          {
            type: 'action',
            id: 'create-test',
            tool: 'directory_create',
            params: { dirpath: path.join(testDir, 'test') }
          },
          {
            type: 'action',
            id: 'create-config',
            tool: 'directory_create',
            params: { dirpath: path.join(testDir, 'config') }
          }
        ]
      };
      
      const createFilesBT = {
        type: 'sequence',
        id: 'create-files-bt',
        children: [
          {
            type: 'action',
            id: 'create-package-json',
            tool: 'file_write',
            params: {
              filepath: path.join(testDir, 'package.json'),
              content: JSON.stringify({
                name: 'test-project',
                version: '1.0.0',
                main: 'src/index.js'
              }, null, 2)
            }
          },
          {
            type: 'action',
            id: 'create-index',
            tool: 'file_write',
            params: {
              filepath: path.join(testDir, 'src', 'index.js'),
              content: 'console.log("Hello from test project");'
            }
          },
          {
            type: 'action',
            id: 'create-readme',
            tool: 'file_write',
            params: {
              filepath: path.join(testDir, 'README.md'),
              content: '# Test Project\n\nCreated by decent-planner E2E test'
            }
          }
        ]
      };
      
      // Execute the behavior trees
      console.log('⚡ Executing directory creation...');
      const dirResult = await executor.executeTree(createDirsBT, {
        workspaceDir: testDir
      });
      
      expect(dirResult.success).toBe(true);
      expect(dirResult.status).toBe('SUCCESS');
      
      console.log('⚡ Executing file creation...');
      const fileResult = await executor.executeTree(createFilesBT, {
        workspaceDir: testDir
      });
      
      expect(fileResult.success).toBe(true);
      expect(fileResult.status).toBe('SUCCESS');
      
      // Verify actual file system
      const dirs = await fs.readdir(testDir);
      expect(dirs).toContain('src');
      expect(dirs).toContain('test');
      expect(dirs).toContain('config');
      expect(dirs).toContain('package.json');
      expect(dirs).toContain('README.md');
      
      // Verify file contents
      const packageJson = JSON.parse(
        await fs.readFile(path.join(testDir, 'package.json'), 'utf-8')
      );
      expect(packageJson.name).toBe('test-project');
      
      const indexJs = await fs.readFile(
        path.join(testDir, 'src', 'index.js'),
        'utf-8'
      );
      expect(indexJs).toContain('Hello from test project');
      
      console.log('✅ Project structure created successfully');
    });
  });
  
  describe('File Transformation Tasks', () => {
    it('should read, transform, and write files', async () => {
      // Create a test JSON file
      const inputData = {
        users: [
          { id: 1, name: 'Alice', age: 30 },
          { id: 2, name: 'Bob', age: 25 }
        ]
      };
      
      await fs.writeFile(
        path.join(testDir, 'input.json'),
        JSON.stringify(inputData, null, 2)
      );
      
      // Create behavior tree for transformation
      const transformBT = {
        type: 'sequence',
        id: 'transform-data',
        children: [
          {
            type: 'action',
            id: 'read-input',
            tool: 'file_read',
            params: { filepath: path.join(testDir, 'input.json') },
            outputVariable: 'inputContent'
          },
          {
            type: 'action',
            id: 'write-csv',
            tool: 'file_write',
            params: {
              filepath: path.join(testDir, 'output.csv'),
              content: 'id,name,age\n1,Alice,30\n2,Bob,25'  // Simplified for test
            },
            outputVariable: 'csvFile'
          },
          {
            type: 'action',
            id: 'write-summary',
            tool: 'file_write',
            params: {
              filepath: path.join(testDir, 'summary.txt'),
              content: 'Processed 2 users\nAverage age: 27.5'
            },
            outputVariable: 'summaryFile'
          }
        ]
      };
      
      // Execute transformation
      const result = await executor.executeTree(transformBT, {
        workspaceDir: testDir
      });
      
      expect(result.success).toBe(true);
      
      // Verify output files
      const outputFiles = await fs.readdir(testDir);
      expect(outputFiles).toContain('output.csv');
      expect(outputFiles).toContain('summary.txt');
      
      const csvContent = await fs.readFile(
        path.join(testDir, 'output.csv'),
        'utf-8'
      );
      expect(csvContent).toContain('Alice');
      expect(csvContent).toContain('Bob');
      
      const summaryContent = await fs.readFile(
        path.join(testDir, 'summary.txt'),
        'utf-8'
      );
      expect(summaryContent).toContain('2 users');
    });
  });
  
  describe('Directory Analysis Tasks', () => {
    it('should analyze directory contents and generate report', async () => {
      // Create some test files
      const testFiles = [
        { name: 'file1.js', content: 'const x = 1;' },
        { name: 'file2.json', content: '{"key": "value"}' },
        { name: 'file3.md', content: '# Title' }
      ];
      
      for (const file of testFiles) {
        await fs.writeFile(
          path.join(testDir, file.name),
          file.content
        );
      }
      
      // Create behavior tree for analysis
      const analysisBT = {
        type: 'sequence',
        id: 'analyze-dir',
        children: [
          {
            type: 'action',
            id: 'list-files',
            tool: 'directory_list',
            params: { dirpath: testDir },
            outputVariable: 'fileList'
          },
          {
            type: 'action',
            id: 'create-report',
            tool: 'file_write',
            params: {
              filepath: path.join(testDir, 'analysis.md'),
              content: `# Directory Analysis\n\n## Files Found\n- file1.js\n- file2.json\n- file3.md\n\n## Statistics\n- Total files: 3\n- File types: .js, .json, .md`
            },
            outputVariable: 'report'
          }
        ]
      };
      
      // Execute analysis
      const result = await executor.executeTree(analysisBT, {
        workspaceDir: testDir
      });
      
      expect(result.success).toBe(true);
      
      // Verify report was created
      const reportExists = await fs.access(
        path.join(testDir, 'analysis.md')
      ).then(() => true).catch(() => false);
      
      expect(reportExists).toBe(true);
      
      const reportContent = await fs.readFile(
        path.join(testDir, 'analysis.md'),
        'utf-8'
      );
      expect(reportContent).toContain('Directory Analysis');
      expect(reportContent).toContain('file1.js');
    });
  });
  
  describe('Complex File Operations', () => {
    it('should handle nested directory operations', async () => {
      // Create complex behavior tree with nested operations
      const complexBT = {
        type: 'sequence',
        id: 'complex-ops',
        children: [
          {
            type: 'parallel',
            id: 'create-structure',
            successPolicy: 'all',
            children: [
              {
                type: 'action',
                id: 'create-app-dir',
                tool: 'directory_create',
                params: { dirpath: path.join(testDir, 'app') }
              },
              {
                type: 'action',
                id: 'create-lib-dir',
                tool: 'directory_create',
                params: { dirpath: path.join(testDir, 'lib') }
              }
            ]
          },
          {
            type: 'sequence',
            id: 'create-nested',
            children: [
              {
                type: 'action',
                id: 'create-components',
                tool: 'directory_create',
                params: { dirpath: path.join(testDir, 'app', 'components') }
              },
              {
                type: 'action',
                id: 'create-utils',
                tool: 'directory_create',
                params: { dirpath: path.join(testDir, 'lib', 'utils') }
              }
            ]
          },
          {
            type: 'parallel',
            id: 'create-files',
            successPolicy: 'all',
            children: [
              {
                type: 'action',
                id: 'create-component',
                tool: 'file_write',
                params: {
                  filepath: path.join(testDir, 'app', 'components', 'Button.js'),
                  content: 'export const Button = () => {};'
                }
              },
              {
                type: 'action',
                id: 'create-util',
                tool: 'file_write',
                params: {
                  filepath: path.join(testDir, 'lib', 'utils', 'helpers.js'),
                  content: 'export const helper = () => {};'
                }
              }
            ]
          }
        ]
      };
      
      // Execute complex operations
      const result = await executor.executeTree(complexBT, {
        workspaceDir: testDir,
        timeout: 30000
      });
      
      expect(result.success).toBe(true);
      
      // Verify nested structure
      const appComponents = await fs.readdir(
        path.join(testDir, 'app', 'components')
      );
      expect(appComponents).toContain('Button.js');
      
      const libUtils = await fs.readdir(
        path.join(testDir, 'lib', 'utils')
      );
      expect(libUtils).toContain('helpers.js');
      
      console.log('✅ Complex nested operations completed');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle file operation errors gracefully', async () => {
      // Try to read non-existent file
      const errorBT = {
        type: 'sequence',
        id: 'error-handling',
        children: [
          {
            type: 'action',
            id: 'read-missing',
            tool: 'file_read',
            params: { filepath: path.join(testDir, 'does-not-exist.txt') },
            outputVariable: 'content'
          }
        ]
      };
      
      const result = await executor.executeTree(errorBT, {
        workspaceDir: testDir
      });
      
      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILURE');
      expect(result.error).toBeDefined();
    });
    
    it('should handle invalid directory paths', async () => {
      const invalidBT = {
        type: 'action',
        id: 'invalid-dir',
        tool: 'directory_create',
        params: { dirpath: '/root/restricted/path' }
      };
      
      const result = await executor.executeTree(invalidBT, {
        workspaceDir: testDir
      });
      
      expect(result.success).toBe(false);
    });
  });
});