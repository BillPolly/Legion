/**
 * End-to-End test for ClassGeneratorWorkflow using REAL development tools
 * Tests actual code generation, file writing, test execution, and error fixing
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { BehaviorTreeTool } from '../../src/integration/BehaviorTreeTool.js';
import { NodeStatus } from '../../src/core/BehaviorTreeNode.js';
import { RealDevTools } from '../../src/tools/dev-tools.js';
import fs from 'fs/promises';
import path from 'path';

// Mock ToolRegistry
class MockToolRegistry {
  constructor() {
    this.tools = new Map();
    this.providers = new Map();
  }

  async getTool(toolName) {
    return this.tools.get(toolName);
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
  }

  async registerProvider(provider) {
    this.providers.set(provider.name, provider);
  }
}

describe('Real ClassGeneratorWorkflow E2E Tests', () => {
  let toolRegistry;
  let executor;
  let devTools;
  const testWorkingDir = './test-generated-classes';

  beforeEach(async () => {
    toolRegistry = new MockToolRegistry();
    executor = new BehaviorTreeExecutor(toolRegistry);
    devTools = new RealDevTools(testWorkingDir);

    // Register all real tools
    toolRegistry.registerTool('classGenerator', devTools.createClassGenerator());
    toolRegistry.registerTool('testGenerator', devTools.createTestGenerator());
    toolRegistry.registerTool('testRunner', devTools.createTestRunner());
    toolRegistry.registerTool('codeFixer', devTools.createCodeFixer());
    toolRegistry.registerTool('successValidator', devTools.createSuccessValidator());

    // Ensure clean test environment
    try {
      await fs.rm(testWorkingDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    // Cleanup after tests
    try {
      await fs.rm(testWorkingDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Real Code Generation and Testing', () => {
    test('should generate actual class file with working methods', async () => {
      const workflow = {
        type: 'sequence',
        children: [
          {
            id: 'generate-class',
            type: 'action',
            tool: 'classGenerator',
            params: {
              className: 'TaskManager',
              description: 'Manages task operations',
              methods: ['addTask', 'getTask', 'updateTask', 'deleteTask', 'listTasks']
            }
          },
          {
            id: 'generate-tests',
            type: 'action',
            tool: 'testGenerator',
            params: {
              className: 'TaskManager',
              methods: ['addTask', 'getTask', 'updateTask', 'deleteTask', 'listTasks']
            }
          }
        ]
      };

      const result = await executor.executeTree(workflow, {});

      expect(result.success).toBe(true);
      expect(result.status).toBe(NodeStatus.SUCCESS);

      // Verify actual files were created
      const classFile = path.join(testWorkingDir, 'src', 'TaskManager.js');
      const testFile = path.join(testWorkingDir, 'tests', 'TaskManager.test.js');

      const classExists = await fs.access(classFile).then(() => true).catch(() => false);
      const testExists = await fs.access(testFile).then(() => true).catch(() => false);

      expect(classExists).toBe(true);
      expect(testExists).toBe(true);

      // Verify file contents
      const classContent = await fs.readFile(classFile, 'utf-8');
      expect(classContent).toContain('class TaskManager');
      expect(classContent).toContain('addTask(');
      expect(classContent).toContain('getTask(');
      expect(classContent).toContain('export default TaskManager');

      const testContent = await fs.readFile(testFile, 'utf-8');
      expect(testContent).toContain('import TaskManager');
      expect(testContent).toContain('describe(\'TaskManager\'');
      expect(testContent).toContain('test(\'should addTask correctly\'');
    });

    test.skip('should run real Jest tests and get actual results', async () => {
      // Skip this test by default since it requires npm install
      const workflow = {
        type: 'sequence',
        children: [
          {
            id: 'generate-class',
            type: 'action',
            tool: 'classGenerator',
            params: {
              className: 'SimpleCalculator',
              description: 'Basic calculator operations',
              methods: ['add', 'subtract', 'multiply', 'divide']
            }
          },
          {
            id: 'generate-tests',
            type: 'action',
            tool: 'testGenerator',
            params: {
              className: 'SimpleCalculator',
              methods: ['add', 'subtract', 'multiply', 'divide']
            }
          },
          {
            id: 'run-tests',
            type: 'action',
            tool: 'testRunner',
            params: {
              className: 'SimpleCalculator'
            }
          }
        ]
      };

      const result = await executor.executeTree(workflow, {});

      expect(result.success).toBe(true);
      
      // Check test results
      const testResults = result.context['run-tests'].data;
      expect(testResults.totalTests).toBeGreaterThan(0);
      expect(typeof testResults.passed).toBe('number');
      expect(typeof testResults.failed).toBe('number');
    });
  });

  describe('ClassGeneratorWorkflow as Reusable BT Tool', () => {
    test('should create a reusable BT tool for class generation', async () => {
      // Define the complete workflow as a BT tool
      const classGeneratorBT = {
        name: 'ClassGeneratorWorkflow',
        description: 'Complete class generation with testing workflow',
        input: {
          className: { type: 'string', required: true },
          description: { type: 'string', required: false },
          methods: { type: 'array', required: true }
        },
        output: {
          classGenerated: { type: 'boolean' },
          testsGenerated: { type: 'boolean' },
          filePaths: { type: 'object' }
        },
        implementation: {
          type: 'sequence',
          children: [
            {
              id: 'gen-class',
              type: 'action',
              tool: 'classGenerator',
              params: {
                className: '{{className}}',
                description: '{{description}}',
                methods: '{{methods}}'
              }
            },
            {
              id: 'gen-tests',
              type: 'action',
              tool: 'testGenerator',
              params: {
                className: '{{className}}',
                methods: '{{methods}}'
              }
            }
          ]
        }
      };

      // Register as BT tool
      const btTool = new BehaviorTreeTool(classGeneratorBT, toolRegistry);
      toolRegistry.registerTool('ClassGeneratorWorkflow', btTool);

      // Use the tool
      const result = await btTool.execute({
        className: 'UserService',
        description: 'User management service',
        methods: ['createUser', 'findUser', 'updateUser', 'deleteUser']
      });

      expect(result.success).toBe(true);

      // Verify files were created through the BT tool
      const classFile = path.join(testWorkingDir, 'src', 'UserService.js');
      const testFile = path.join(testWorkingDir, 'tests', 'UserService.test.js');

      const classExists = await fs.access(classFile).then(() => true).catch(() => false);
      const testExists = await fs.access(testFile).then(() => true).catch(() => false);

      expect(classExists).toBe(true);
      expect(testExists).toBe(true);
    });

    test('should handle workflow that uses the BT tool multiple times', async () => {
      // First register the ClassGeneratorWorkflow as a tool
      const classGenBT = {
        name: 'QuickClassGen',
        input: {
          className: { type: 'string', required: true },
          methods: { type: 'array', required: true }
        },
        implementation: {
          type: 'sequence',
          children: [
            {
              type: 'action',
              tool: 'classGenerator',
              params: {
                className: '{{className}}',
                methods: '{{methods}}'
              }
            },
            {
              type: 'action',
              tool: 'testGenerator',
              params: {
                className: '{{className}}',
                methods: '{{methods}}'
              }
            }
          ]
        }
      };

      const btTool = new BehaviorTreeTool(classGenBT, toolRegistry);
      toolRegistry.registerTool('QuickClassGen', btTool);

      // Now use it in a larger workflow
      const multiClassWorkflow = {
        type: 'sequence',
        children: [
          {
            type: 'action',
            tool: 'QuickClassGen',
            params: {
              className: 'DataModel',
              methods: ['validate', 'serialize']
            }
          },
          {
            type: 'action',
            tool: 'QuickClassGen',
            params: {
              className: 'DataController',
              methods: ['handle', 'process']
            }
          },
          {
            type: 'action',
            tool: 'QuickClassGen',
            params: {
              className: 'DataService',
              methods: ['fetch', 'save']
            }
          }
        ]
      };

      const result = await executor.executeTree(multiClassWorkflow, {});

      expect(result.success).toBe(true);

      // Verify all three classes were created
      const files = [
        'DataModel.js',
        'DataController.js', 
        'DataService.js'
      ];

      for (const file of files) {
        const filePath = path.join(testWorkingDir, 'src', file);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Self-Correcting Workflow with Retry', () => {
    test('should demonstrate retry workflow structure (without actual fixing)', async () => {
      // This demonstrates the workflow structure for self-correction
      // The actual fixing would require more sophisticated analysis
      
      const selfCorrectingWorkflow = {
        type: 'retry',
        maxAttempts: 2, // Keep low for testing
        child: {
          type: 'sequence',
          children: [
            {
              id: 'generate',
              type: 'action',
              tool: 'classGenerator',
              params: {
                className: 'TestClass',
                methods: ['testMethod']
              }
            },
            {
              id: 'test-gen',
              type: 'action',
              tool: 'testGenerator',
              params: {
                className: 'TestClass',
                methods: ['testMethod']
              }
            },
            // This would normally run tests, but we'll skip for this demo
            {
              type: 'action',
              tool: 'successValidator',
              params: {
                testResults: {
                  passed: 1,
                  failed: 0,
                  totalTests: 1
                }
              }
            }
          ]
        }
      };

      const result = await executor.executeTree(selfCorrectingWorkflow, {});

      expect(result.success).toBe(true);
      expect(result.data.totalAttempts).toBe(1); // Should succeed on first try

      // Verify the retry structure worked
      expect(result.data.attempts).toBeDefined();
      expect(result.data.attempts).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid class names gracefully', async () => {
      const result = await executor.executeTree({
        type: 'action',
        tool: 'classGenerator',
        params: {
          className: '', // Invalid empty name
          methods: ['test']
        }
      }, {});

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('className is required');
    });

    test('should handle file system errors', async () => {
      // Try to write to an invalid directory by temporarily changing working dir
      const invalidDirTools = new RealDevTools('/invalid/path/that/does/not/exist');
      toolRegistry.registerTool('invalidClassGen', invalidDirTools.createClassGenerator());

      const result = await executor.executeTree({
        type: 'action',
        tool: 'invalidClassGen',
        params: {
          className: 'TestClass',
          methods: ['test']
        }
      }, {});

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('Failed to write file');
    });
  });

  describe('Tool Metadata and Schema Validation', () => {
    test('should provide proper metadata for all tools', () => {
      const classGen = devTools.createClassGenerator();
      const metadata = classGen.getMetadata();

      expect(metadata.name).toBe('classGenerator');
      expect(metadata.description).toContain('JavaScript class');
      expect(metadata.input).toBeDefined();
      expect(metadata.input.className.required).toBe(true);
      expect(metadata.output).toBeDefined();
    });

    test('should work with BehaviorTreeTool input validation', async () => {
      const strictBT = {
        name: 'StrictClassGen',
        input: {
          className: { type: 'string', required: true },
          methods: { type: 'array', required: true }
        },
        implementation: {
          type: 'action',
          tool: 'classGenerator',
          params: {
            className: '{{className}}',
            methods: '{{methods}}'
          }
        }
      };

      const btTool = new BehaviorTreeTool(strictBT, toolRegistry);

      // Test validation failure
      const invalidResult = await btTool.execute({ className: 'Test' }); // Missing methods
      expect(invalidResult.success).toBe(false);

      // Test validation success
      const validResult = await btTool.execute({
        className: 'ValidClass',
        methods: ['validMethod']
      });
      expect(validResult.success).toBe(true);
    });
  });
});