/**
 * End-to-End test for ClassGeneratorWorkflow
 * Tests a self-correcting code generation workflow using BT
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { BehaviorTreeTool } from '../../src/integration/BehaviorTreeTool.js';
import { NodeStatus } from '../../src/core/BehaviorTreeNode.js';
import { MockDevTools } from './mock-dev-tools.js';

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

describe('ClassGeneratorWorkflow E2E Tests', () => {
  let toolRegistry;
  let executor;
  let devTools;

  beforeEach(() => {
    toolRegistry = new MockToolRegistry();
    executor = new BehaviorTreeExecutor(toolRegistry);
    devTools = new MockDevTools();

    // Register all mock tools
    toolRegistry.registerTool('classGenerator', devTools.createClassGenerator());
    toolRegistry.registerTool('testGenerator', devTools.createTestGenerator());
    toolRegistry.registerTool('testRunner', devTools.createTestRunner());
    toolRegistry.registerTool('codeFixer', devTools.createCodeFixer());
    toolRegistry.registerTool('successValidator', devTools.createSuccessValidator());
  });

  describe('Basic Class Generation Workflow', () => {
    test('should generate class and tests successfully on first try', async () => {
      // Define the workflow
      const workflow = {
        type: 'sequence',
        children: [
          {
            id: 'generate-class',
            type: 'action',
            tool: 'classGenerator',
            params: {
              className: 'UserManager',
              description: 'Manages user operations',
              methods: ['addUser', 'getUser', 'updateUser', 'deleteUser', 'listUsers']
            }
          },
          {
            id: 'generate-tests',
            type: 'action',
            tool: 'testGenerator',
            params: {
              className: 'UserManager',
              classCode: '{{generate-class.data.code}}',
              methods: ['addUser', 'getUser', 'updateUser', 'deleteUser', 'listUsers']
            }
          },
          {
            id: 'run-tests',
            type: 'action',
            tool: 'testRunner',
            params: {
              className: 'UserManager',
              classCode: '{{generate-class.data.code}}',
              testCode: '{{generate-tests.data.testCode}}',
              methods: ['addUser', 'getUser', 'updateUser', 'deleteUser', 'listUsers']
            }
          }
        ]
      };

      const result = await executor.executeTree(workflow, {});

      expect(result.success).toBe(true);
      expect(result.status).toBe(NodeStatus.SUCCESS);

      // Verify all steps executed
      const log = devTools.getExecutionLog();
      expect(log).toHaveLength(3);
      expect(log[0].tool).toBe('classGenerator');
      expect(log[1].tool).toBe('testGenerator');
      expect(log[2].tool).toBe('testRunner');

      // Verify files were created
      expect(devTools.getFile('src/UserManager.js')).toBeDefined();
      expect(devTools.getFile('tests/UserManager.test.js')).toBeDefined();

      // Verify test results
      const testResults = result.context['run-tests'].data;
      expect(testResults.passed).toBe(6); // 5 methods + 1 constructor test
      expect(testResults.failed).toBe(0);
    });

    test('should fix code when tests fail using retry mechanism', async () => {
      // Add a failure scenario
      devTools.addTestFailureScenario('Calculator', 'divide', {
        buggyCode: 'return a / b;', // Missing zero check
        fixedCode: 'if (b === 0) throw new Error("Division by zero");\n    return a / b;',
        errorMessage: 'Division by zero not handled',
        expected: 'Error thrown',
        received: 'Infinity'
      });

      // Workflow with retry and fix logic
      const workflowWithFix = {
        type: 'retry',
        maxAttempts: 3,
        child: {
          type: 'sequence',
          children: [
            {
              id: 'generate-class',
              type: 'action',
              tool: 'classGenerator',
              params: {
                className: 'Calculator',
                description: 'Basic calculator operations',
                methods: ['add', 'subtract', 'multiply', 'divide']
              }
            },
            {
              id: 'generate-tests',
              type: 'action',
              tool: 'testGenerator',
              params: {
                className: 'Calculator',
                classCode: '{{generate-class.data.code}}',
                methods: ['add', 'subtract', 'multiply', 'divide']
              }
            },
            {
              id: 'run-tests',
              type: 'action',
              tool: 'testRunner',
              params: {
                className: 'Calculator',
                classCode: '{{generate-class.data.code}}',
                testCode: '{{generate-tests.data.testCode}}',
                methods: ['add', 'subtract', 'multiply', 'divide']
              }
            },
            {
              id: 'check-and-fix',
              type: 'selector',
              children: [
                {
                  type: 'action',
                  tool: 'successValidator',
                  params: {
                    testResults: '{{run-tests.data}}'
                  }
                },
                {
                  type: 'sequence',
                  children: [
                    {
                      id: 'fix-code',
                      type: 'action',
                      tool: 'codeFixer',
                      params: {
                        className: 'Calculator',
                        classCode: '{{generate-class.data.code}}',
                        testResults: '{{run-tests.data}}'
                      }
                    },
                    {
                      id: 'update-context',
                      type: 'action',
                      tool: 'classGenerator',
                      params: {
                        className: 'Calculator',
                        description: 'Fixed calculator operations',
                        methods: ['add', 'subtract', 'multiply', 'divide']
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      const result = await executor.executeTree(workflowWithFix, {});

      expect(result.success).toBe(true);
      expect(result.status).toBe(NodeStatus.SUCCESS);

      // Verify retry happened
      expect(result.data.totalAttempts).toBeGreaterThanOrEqual(1);
      
      // Verify fix was applied
      const log = devTools.getExecutionLog();
      const fixerCalls = log.filter(entry => entry.tool === 'codeFixer');
      expect(fixerCalls.length).toBeGreaterThan(0);

      // Verify final code is fixed
      const finalCode = devTools.getFile('src/Calculator.js');
      expect(finalCode).toContain('Division by zero');
    });
  });

  describe('ClassGeneratorWorkflow as Reusable BT Tool', () => {
    test('should register and use workflow as a tool', async () => {
      // Define the complete workflow as a BT configuration
      const classGeneratorBT = {
        name: 'ClassGeneratorTool',
        description: 'Automated class generation with testing',
        input: {
          className: { type: 'string', required: true },
          description: { type: 'string', required: false },
          methods: { type: 'array', required: true }
        },
        output: {
          classCode: { type: 'string' },
          testCode: { type: 'string' },
          testsPassed: { type: 'boolean' }
        },
        implementation: {
          type: 'retry',
          maxAttempts: 3,
          child: {
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
                  classCode: '{{gen-class.data.code}}',
                  methods: '{{methods}}'
                }
              },
              {
                id: 'test-run',
                type: 'action',
                tool: 'testRunner',
                params: {
                  className: '{{className}}',
                  classCode: '{{gen-class.data.code}}',
                  testCode: '{{gen-tests.data.testCode}}',
                  methods: '{{methods}}'
                }
              },
              {
                type: 'action',
                tool: 'successValidator',
                params: {
                  testResults: '{{test-run.data}}'
                }
              }
            ]
          }
        }
      };

      // Register as BT tool
      const btTool = new BehaviorTreeTool(classGeneratorBT, toolRegistry);
      toolRegistry.registerTool('ClassGeneratorTool', btTool);

      // Use the tool in another workflow
      const mainWorkflow = {
        type: 'sequence',
        children: [
          {
            type: 'action',
            tool: 'ClassGeneratorTool',
            params: {
              className: 'DataProcessor',
              description: 'Processes various data formats',
              methods: ['processJSON', 'processXML', 'processCSV']
            }
          }
        ]
      };

      const result = await executor.executeTree(mainWorkflow, {});

      expect(result.success).toBe(true);
      
      // Verify the nested BT executed
      const log = devTools.getExecutionLog();
      expect(log.some(entry => entry.tool === 'classGenerator')).toBe(true);
      expect(log.some(entry => entry.tool === 'testGenerator')).toBe(true);
      expect(log.some(entry => entry.tool === 'testRunner')).toBe(true);
      
      // Verify files were created
      expect(devTools.getFile('src/DataProcessor.js')).toBeDefined();
      expect(devTools.getFile('tests/DataProcessor.test.js')).toBeDefined();
    });

    test('should handle complex nested workflow with multiple class generations', async () => {
      // Workflow that generates multiple related classes
      const multiClassWorkflow = {
        type: 'sequence',
        children: [
          {
            id: 'create-model',
            type: 'action',
            tool: 'classGenerator',
            params: {
              className: 'UserModel',
              description: 'User data model',
              methods: ['validate', 'serialize', 'deserialize']
            }
          },
          {
            id: 'create-controller',
            type: 'action',
            tool: 'classGenerator',
            params: {
              className: 'UserController',
              description: 'User controller for handling requests',
              methods: ['create', 'read', 'update', 'delete']
            }
          },
          {
            id: 'create-service',
            type: 'action',
            tool: 'classGenerator',
            params: {
              className: 'UserService',
              description: 'Business logic for user operations',
              methods: ['authenticate', 'authorize', 'audit']
            }
          },
          {
            type: 'sequence',
            id: 'test-all',
            children: [
              {
                type: 'action',
                tool: 'testGenerator',
                params: {
                  className: 'UserModel',
                  classCode: '{{create-model.data.code}}',
                  methods: ['validate', 'serialize', 'deserialize']
                }
              },
              {
                type: 'action',
                tool: 'testGenerator',
                params: {
                  className: 'UserController',
                  classCode: '{{create-controller.data.code}}',
                  methods: ['create', 'read', 'update', 'delete']
                }
              },
              {
                type: 'action',
                tool: 'testGenerator',
                params: {
                  className: 'UserService',
                  classCode: '{{create-service.data.code}}',
                  methods: ['authenticate', 'authorize', 'audit']
                }
              }
            ]
          }
        ]
      };

      const result = await executor.executeTree(multiClassWorkflow, {});

      expect(result.success).toBe(true);

      // Verify all classes were generated
      expect(devTools.getFile('src/UserModel.js')).toBeDefined();
      expect(devTools.getFile('src/UserController.js')).toBeDefined();
      expect(devTools.getFile('src/UserService.js')).toBeDefined();

      // Verify all test files were generated
      expect(devTools.getFile('tests/UserModel.test.js')).toBeDefined();
      expect(devTools.getFile('tests/UserController.test.js')).toBeDefined();
      expect(devTools.getFile('tests/UserService.test.js')).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle max retry attempts gracefully', async () => {
      // Add a persistent failure that won't be fixed
      devTools.addTestFailureScenario('BrokenClass', 'criticalMethod', {
        buggyCode: 'throw new Error("Permanent failure");',
        fixedCode: 'throw new Error("Still broken");', // Fix doesn't actually work
        errorMessage: 'Critical method always fails'
      });

      const workflowWithPersistentFailure = {
        type: 'retry',
        maxAttempts: 2,
        child: {
          type: 'sequence',
          children: [
            {
              id: 'gen',
              type: 'action',
              tool: 'classGenerator',
              params: {
                className: 'BrokenClass',
                methods: ['criticalMethod']
              }
            },
            {
              id: 'test',
              type: 'action',
              tool: 'testRunner',
              params: {
                className: 'BrokenClass',
                classCode: '{{gen.data.code}}',
                testCode: 'mock test',
                methods: ['criticalMethod']
              }
            },
            {
              type: 'action',
              tool: 'successValidator',
              params: {
                testResults: '{{test.data}}'
              }
            }
          ]
        }
      };

      const result = await executor.executeTree(workflowWithPersistentFailure, {});

      expect(result.success).toBe(false);
      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.exhaustedRetries).toBe(true);
      expect(result.data.totalAttempts).toBe(2);
    });

    test('should validate input schemas', async () => {
      const btWithSchema = {
        name: 'StrictClassGenerator',
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

      const btTool = new BehaviorTreeTool(btWithSchema, toolRegistry);

      // Missing required field
      const invalidResult = await btTool.execute({ className: 'Test' });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.data.error).toContain('Missing required inputs');

      // Valid input
      const validResult = await btTool.execute({
        className: 'Test',
        methods: ['method1']
      });
      expect(validResult.success).toBe(true);
    });
  });
});