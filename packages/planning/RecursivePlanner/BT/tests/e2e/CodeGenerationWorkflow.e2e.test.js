/**
 * End-to-End test for complete code generation workflow using BT
 * Tests a realistic scenario of generating code, running tests, and creating documentation
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { BehaviorTreeTool } from '../../src/integration/BehaviorTreeTool.js';
import { BehaviorTreeLoader } from '../../src/integration/BehaviorTreeLoader.js';
import { PlanToBTConverter } from '../../src/integration/PlanToBTConverter.js';
import { NodeStatus } from '../../src/core/BehaviorTreeNode.js';

// Mock file system for testing
class MockFileSystem {
  constructor() {
    this.files = new Map();
    this.directories = new Set();
  }

  writeFile(path, content) {
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      this.directories.add(dir);
    }
    this.files.set(path, content);
    return { success: true, path };
  }

  readFile(path) {
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    return this.files.get(path);
  }

  exists(path) {
    return this.files.has(path) || this.directories.has(path);
  }

  mkdir(path) {
    this.directories.add(path);
    return { success: true, path };
  }

  listFiles() {
    return Array.from(this.files.keys());
  }

  clear() {
    this.files.clear();
    this.directories.clear();
  }
}

// Mock tool implementations
class MockToolImplementations {
  constructor(fileSystem) {
    this.fs = fileSystem;
    this.executionLog = [];
  }

  createCodeGenerator() {
    const self = this;
    return {
      name: 'codeGenerator',
      async execute(params) {
        self.executionLog.push({ tool: 'codeGenerator', params });
        
        const { className, methods = [], language = 'javascript' } = params;
        
        if (!className) {
          return { success: false, data: { error: 'className is required' } };
        }

        let code;
        if (language === 'javascript') {
          code = `class ${className} {
  constructor() {
    this.initialized = true;
  }
${methods.map(m => `
  ${m}() {
    console.log('Executing ${m}');
    return { success: true };
  }`).join('')}
}

module.exports = ${className};`;
        } else if (language === 'python') {
          code = `class ${className}:
    def __init__(self):
        self.initialized = True
${methods.map(m => `
    def ${m}(self):
        print(f'Executing ${m}')
        return {'success': True}`).join('')}`;
        }

        return {
          success: true,
          data: {
            code,
            className,
            methods,
            language,
            timestamp: Date.now()
          }
        };
      },
      getMetadata() {
        return {
          name: 'codeGenerator',
          description: 'Generates code for a class',
          input: {
            className: { type: 'string', required: true },
            methods: { type: 'array', required: false },
            language: { type: 'string', required: false }
          }
        };
      }
    };
  }

  createFileWriter() {
    const self = this;
    return {
      name: 'fileWriter',
      async execute(params) {
        self.executionLog.push({ tool: 'fileWriter', params });
        
        const { path, content } = params;
        
        if (!path || !content) {
          return { 
            success: false, 
            data: { error: 'path and content are required' } 
          };
        }

        try {
          const result = self.fs.writeFile(path, content);
          return {
            success: true,
            data: {
              path,
              bytesWritten: content.length,
              timestamp: Date.now()
            }
          };
        } catch (error) {
          return {
            success: false,
            data: { error: error.message }
          };
        }
      },
      getMetadata() {
        return {
          name: 'fileWriter',
          description: 'Writes content to a file',
          input: {
            path: { type: 'string', required: true },
            content: { type: 'string', required: true }
          }
        };
      }
    };
  }

  createTestRunner() {
    const self = this;
    return {
      name: 'testRunner',
      async execute(params) {
        self.executionLog.push({ tool: 'testRunner', params });
        
        const { testFile, coverage = false } = params;
        
        // Simulate test execution - deterministic for testing
        const testResults = {
          passed: true, // Always pass for predictable tests
          tests: 10,
          failures: 0,
          duration: 250
        };

        if (coverage) {
          testResults.coverage = {
            lines: 85,
            branches: 78,
            functions: 92
          };
        }

        return {
          success: testResults.passed,
          data: testResults
        };
      },
      getMetadata() {
        return {
          name: 'testRunner',
          description: 'Runs tests for code',
          input: {
            testFile: { type: 'string', required: false },
            coverage: { type: 'boolean', required: false }
          }
        };
      }
    };
  }

  createDocGenerator() {
    const self = this;
    return {
      name: 'docGenerator',
      async execute(params) {
        self.executionLog.push({ tool: 'docGenerator', params });
        
        const { sourceFiles = [], format = 'markdown' } = params;
        
        const docs = `# API Documentation

Generated on: ${new Date().toISOString()}

## Classes

${sourceFiles.map(file => `- ${file}`).join('\n')}

## Summary

This documentation was auto-generated.
Format: ${format}
`;

        return {
          success: true,
          data: {
            documentation: docs,
            format,
            filesProcessed: sourceFiles.length
          }
        };
      },
      getMetadata() {
        return {
          name: 'docGenerator',
          description: 'Generates documentation',
          input: {
            sourceFiles: { type: 'array', required: false },
            format: { type: 'string', required: false }
          }
        };
      }
    };
  }

  createLinter() {
    const self = this;
    return {
      name: 'linter',
      async execute(params) {
        self.executionLog.push({ tool: 'linter', params });
        
        const { files = [], fix = false } = params;
        
        // Deterministic linting results
        const issues = fix ? 0 : 2; // If fix is true, all issues are fixed
        const fixed = fix ? 2 : 0;

        return {
          success: issues === 0 || (fix && fixed >= issues),
          data: {
            issues,
            fixed,
            files: files.length,
            warnings: Math.max(0, issues - fixed)
          }
        };
      },
      getMetadata() {
        return {
          name: 'linter',
          description: 'Lints code files',
          input: {
            files: { type: 'array', required: false },
            fix: { type: 'boolean', required: false }
          }
        };
      }
    };
  }

  getExecutionLog() {
    return this.executionLog;
  }

  clearLog() {
    this.executionLog = [];
  }
}

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

  hasTool(name) {
    return this.tools.has(name);
  }
}

describe('Code Generation Workflow E2E Tests', () => {
  let toolRegistry;
  let executor;
  let fileSystem;
  let toolImpls;
  let loader;

  beforeEach(() => {
    fileSystem = new MockFileSystem();
    toolImpls = new MockToolImplementations(fileSystem);
    toolRegistry = new MockToolRegistry();
    executor = new BehaviorTreeExecutor(toolRegistry);
    loader = new BehaviorTreeLoader(toolRegistry);

    // Register all mock tools
    toolRegistry.registerTool('codeGenerator', toolImpls.createCodeGenerator());
    toolRegistry.registerTool('fileWriter', toolImpls.createFileWriter());
    toolRegistry.registerTool('testRunner', toolImpls.createTestRunner());
    toolRegistry.registerTool('docGenerator', toolImpls.createDocGenerator());
    toolRegistry.registerTool('linter', toolImpls.createLinter());
  });

  describe('Complete Development Workflow', () => {
    test('should execute full code generation pipeline', async () => {
      // Define a complete development workflow BT
      const workflowBT = {
        type: 'sequence',
        description: 'Complete development workflow',
        children: [
          {
            type: 'action',
            id: 'generate-code',
            tool: 'codeGenerator',
            params: {
              className: 'UserService',
              methods: ['create', 'update', 'delete', 'findById'],
              language: 'javascript'
            }
          },
          {
            type: 'action',
            id: 'write-source',
            tool: 'fileWriter',
            params: {
              path: 'src/UserService.js',
              content: '{{generate-code.data.code}}'
            }
          },
          {
            type: 'action',
            id: 'lint-code',
            tool: 'linter',
            params: {
              files: ['src/UserService.js'],
              fix: true
            }
          },
          {
            type: 'action',
            id: 'run-tests',
            tool: 'testRunner',
            params: {
              testFile: 'src/UserService.test.js',
              coverage: true
            }
          },
          {
            type: 'action',
            id: 'generate-docs',
            tool: 'docGenerator',
            params: {
              sourceFiles: ['src/UserService.js'],
              format: 'markdown'
            }
          },
          {
            type: 'action',
            id: 'write-docs',
            tool: 'fileWriter',
            params: {
              path: 'docs/UserService.md',
              content: '{{generate-docs.data.documentation}}'
            }
          }
        ]
      };

      const result = await executor.executeTree(workflowBT, {});

      // Debug: Log the result if it fails
      if (!result.success) {
        console.log('Execution failed:', JSON.stringify(result, null, 2));
      }

      // Verify workflow completed successfully
      expect(result.success).toBe(true);
      expect(result.status).toBe(NodeStatus.SUCCESS);

      // Verify all steps executed
      const log = toolImpls.getExecutionLog();
      expect(log).toHaveLength(6);
      expect(log[0].tool).toBe('codeGenerator');
      expect(log[1].tool).toBe('fileWriter');
      expect(log[2].tool).toBe('linter');
      expect(log[3].tool).toBe('testRunner');
      expect(log[4].tool).toBe('docGenerator');
      expect(log[5].tool).toBe('fileWriter');

      // Verify files were created
      expect(fileSystem.exists('src/UserService.js')).toBe(true);
      expect(fileSystem.exists('docs/UserService.md')).toBe(true);

      // Verify code was generated correctly
      const generatedCode = fileSystem.readFile('src/UserService.js');
      expect(generatedCode).toContain('class UserService');
      expect(generatedCode).toContain('create()');
      expect(generatedCode).toContain('update()');
      expect(generatedCode).toContain('delete()');
      expect(generatedCode).toContain('findById()');
    });

    test('should handle workflow with error recovery', async () => {
      // Temporarily make test runner always fail
      const originalTestRunner = toolImpls.createTestRunner();
      toolRegistry.registerTool('testRunner', {
        ...originalTestRunner,
        async execute(params) {
          return {
            success: false,
            data: {
              passed: false,
              tests: 10,
              failures: 3,
              duration: 500
            }
          };
        }
      });

      // Workflow with fallback strategy
      const workflowWithRecovery = {
        type: 'selector',
        description: 'Development workflow with recovery',
        children: [
          {
            type: 'sequence',
            description: 'Primary workflow',
            children: [
              {
                type: 'action',
                id: 'generate',
                tool: 'codeGenerator',
                params: { className: 'Service', methods: ['process'] }
              },
              {
                type: 'action',
                id: 'test',
                tool: 'testRunner',
                params: { coverage: true }
              },
              {
                type: 'action',
                id: 'deploy',
                tool: 'fileWriter',
                params: { path: 'dist/Service.js', content: '{{generate.data.code}}' }
              }
            ]
          },
          {
            type: 'sequence',
            description: 'Fallback workflow',
            children: [
              {
                type: 'action',
                id: 'generate-simple',
                tool: 'codeGenerator',
                params: { className: 'SimpleService', methods: [] }
              },
              {
                type: 'action',
                id: 'write-simple',
                tool: 'fileWriter',
                params: { path: 'dist/SimpleService.js', content: '{{generate-simple.data.code}}' }
              }
            ]
          }
        ]
      };

      const result = await executor.executeTree(workflowWithRecovery, {});

      // Should succeed via fallback
      expect(result.success).toBe(true);
      
      // Verify fallback was used
      expect(fileSystem.exists('dist/SimpleService.js')).toBe(true);
      expect(fileSystem.exists('dist/Service.js')).toBe(false);
    });
  });

  describe('BT Tool as Reusable Workflow', () => {
    test('should register and execute BT workflow as a tool', async () => {
      // Create a reusable code review workflow
      const codeReviewBT = {
        name: 'CodeReviewWorkflow',
        description: 'Automated code review process',
        input: {
          className: { type: 'string', required: true },
          methods: { type: 'array', required: true }
        },
        output: {
          reviewPassed: { type: 'boolean' },
          codeLocation: { type: 'string' }
        },
        implementation: {
          type: 'sequence',
          children: [
            {
              type: 'action',
              id: 'generate',
              tool: 'codeGenerator',
              params: {
                className: '{{className}}',
                methods: '{{methods}}'
              }
            },
            {
              type: 'action',
              id: 'lint',
              tool: 'linter',
              params: {
                files: ['{{className}}.js'],
                fix: true
              }
            },
            {
              type: 'action',
              id: 'test',
              tool: 'testRunner',
              params: {
                coverage: true
              }
            },
            {
              type: 'action',
              id: 'save',
              tool: 'fileWriter',
              params: {
                path: 'reviewed/{{className}}.js',
                content: '{{generate.data.code}}'
              }
            }
          ]
        }
      };

      // Register as BT tool
      const btTool = new BehaviorTreeTool(codeReviewBT, toolRegistry);
      await toolRegistry.registerProvider(btTool.asModuleProvider());
      toolRegistry.registerTool('CodeReviewWorkflow', btTool);

      // Use the BT tool in another workflow
      const mainWorkflow = {
        type: 'sequence',
        children: [
          {
            type: 'action',
            tool: 'CodeReviewWorkflow',
            params: {
              className: 'ProductManager',
              methods: ['addProduct', 'removeProduct']
            }
          },
          {
            type: 'action',
            tool: 'docGenerator',
            params: {
              sourceFiles: ['reviewed/ProductManager.js']
            }
          }
        ]
      };

      const result = await executor.executeTree(mainWorkflow, {});

      expect(result.success).toBe(true);
      
      // Verify nested BT execution
      const log = toolImpls.getExecutionLog();
      expect(log.some(entry => entry.tool === 'codeGenerator')).toBe(true);
      expect(log.some(entry => entry.tool === 'linter')).toBe(true);
      expect(log.some(entry => entry.tool === 'testRunner')).toBe(true);
      expect(log.some(entry => entry.tool === 'fileWriter')).toBe(true);
      expect(log.some(entry => entry.tool === 'docGenerator')).toBe(true);
    });
  });

  describe('Plan to BT Conversion Workflow', () => {
    test('should convert linear plan to BT and execute', async () => {
      // Original linear plan
      const linearPlan = [
        {
          id: 'step1',
          tool: 'codeGenerator',
          params: { className: 'DataProcessor', methods: ['process', 'validate'] }
        },
        {
          id: 'step2',
          tool: 'fileWriter',
          params: { path: 'src/DataProcessor.js', content: '{{step1.data.code}}' }
        },
        {
          id: 'step3',
          tool: 'linter',
          params: { files: ['src/DataProcessor.js'], fix: true }
        },
        {
          id: 'step4',
          tool: 'docGenerator',
          params: { sourceFiles: ['src/DataProcessor.js'] }
        }
      ];

      // Convert to BT
      const btConfig = PlanToBTConverter.convertPlanToBT(linearPlan, {
        description: 'Converted data processing workflow'
      });

      // Execute converted BT
      const result = await executor.executeTree(btConfig, {});

      expect(result.success).toBe(true);
      expect(result.status).toBe(NodeStatus.SUCCESS);

      // Verify all plan steps executed in order
      const log = toolImpls.getExecutionLog();
      expect(log).toHaveLength(4);
      expect(log[0].tool).toBe('codeGenerator');
      expect(log[1].tool).toBe('fileWriter');
      expect(log[2].tool).toBe('linter');
      expect(log[3].tool).toBe('docGenerator');

      // Verify file was created
      expect(fileSystem.exists('src/DataProcessor.js')).toBe(true);
    });

    test('should handle complex nested plan conversion', async () => {
      // Nested plan with groups
      const nestedPlan = [
        {
          id: 'setup',
          type: 'group',
          description: 'Setup phase',
          steps: [
            { id: 'gen1', tool: 'codeGenerator', params: { className: 'Module1' } },
            { id: 'gen2', tool: 'codeGenerator', params: { className: 'Module2' } }
          ]
        },
        {
          id: 'test',
          tool: 'testRunner',
          params: { coverage: true }
        },
        {
          id: 'deploy',
          type: 'group',
          description: 'Deployment phase',
          steps: [
            { id: 'write1', tool: 'fileWriter', params: { path: 'dist/Module1.js', content: '{{gen1.data.code}}' } },
            { id: 'write2', tool: 'fileWriter', params: { path: 'dist/Module2.js', content: '{{gen2.data.code}}' } }
          ]
        }
      ];

      // Convert nested plan
      const btConfig = PlanToBTConverter.convertNestedPlanToBT(nestedPlan);

      // Execute
      const result = await executor.executeTree(btConfig, {});

      expect(result.success).toBe(true);

      // Verify grouped execution
      const log = toolImpls.getExecutionLog();
      expect(log[0].tool).toBe('codeGenerator');
      expect(log[0].params.className).toBe('Module1');
      expect(log[1].tool).toBe('codeGenerator');
      expect(log[1].params.className).toBe('Module2');
      expect(log[2].tool).toBe('testRunner');
      expect(log[3].tool).toBe('fileWriter');
      expect(log[4].tool).toBe('fileWriter');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large workflow efficiently', async () => {
      // Create a large workflow with many steps
      const largeWorkflow = {
        type: 'sequence',
        children: []
      };

      // Add 50 code generation and write steps
      for (let i = 0; i < 50; i++) {
        largeWorkflow.children.push({
          type: 'action',
          id: `gen_${i}`,
          tool: 'codeGenerator',
          params: { className: `Class${i}`, methods: [`method${i}`] }
        });
        largeWorkflow.children.push({
          type: 'action',
          id: `write_${i}`,
          tool: 'fileWriter',
          params: { path: `src/Class${i}.js`, content: `{{gen_${i}.data.code}}` }
        });
      }

      const startTime = Date.now();
      const result = await executor.executeTree(largeWorkflow, {});
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all files created
      for (let i = 0; i < 50; i++) {
        expect(fileSystem.exists(`src/Class${i}.js`)).toBe(true);
      }

      // Verify execution log
      expect(toolImpls.getExecutionLog()).toHaveLength(100);
    });

    test('should handle deeply nested workflows', async () => {
      // Create deeply nested sequence structure (simpler, more predictable)
      const createNestedStructure = (depth) => {
        if (depth === 0) {
          return {
            type: 'action',
            tool: 'codeGenerator',
            params: { className: `Depth${depth}`, methods: [] }
          };
        }

        return {
          type: 'sequence',
          children: [
            createNestedStructure(depth - 1),
            {
              type: 'action',
              tool: 'linter',
              params: { files: [`Depth${depth}.js`], fix: true }
            }
          ]
        };
      };

      const deepWorkflow = createNestedStructure(5); // Reduce depth for faster execution
      const result = await executor.executeTree(deepWorkflow, {});

      expect(result.success).toBe(true);
      
      // Verify execution occurred at various depths
      const log = toolImpls.getExecutionLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log.some(entry => entry.tool === 'codeGenerator')).toBe(true);
      expect(log.some(entry => entry.tool === 'linter')).toBe(true);
    });
  });

  describe('Error Handling and Validation', () => {
    test('should validate workflow before execution', () => {
      const invalidWorkflow = {
        type: 'sequence',
        children: [
          { type: 'action' }, // Missing tool
          { type: 'unknown-type' } // Invalid type
        ]
      };

      const validation = executor.validateTreeConfiguration(invalidWorkflow);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Action nodes must specify tool');
      expect(validation.errors.some(e => e.includes('Unknown node type'))).toBe(true);
    });

    test('should handle runtime errors gracefully', async () => {
      // Register a tool that throws errors
      toolRegistry.registerTool('errorTool', {
        async execute() {
          throw new Error('Intentional runtime error');
        },
        getMetadata() {
          return { name: 'errorTool' };
        }
      });

      const errorWorkflow = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator', params: { className: 'Test' } },
          { type: 'action', tool: 'errorTool' },
          { type: 'action', tool: 'fileWriter', params: { path: 'test.js', content: 'test' } }
        ]
      };

      const result = await executor.executeTree(errorWorkflow, {});

      expect(result.success).toBe(false);
      expect(result.status).toBe(NodeStatus.FAILURE);
      
      // First step should have executed
      expect(toolImpls.getExecutionLog()).toHaveLength(1);
      
      // File should not be written (third step)
      expect(fileSystem.exists('test.js')).toBe(false);
    });

    test('should enforce input schemas on BT tools', async () => {
      const strictBT = {
        name: 'StrictWorkflow',
        input: {
          requiredParam: { type: 'string', required: true },
          optionalParam: { type: 'number', required: false }
        },
        implementation: {
          type: 'action',
          tool: 'codeGenerator',
          params: { className: '{{requiredParam}}' }
        }
      };

      const btTool = new BehaviorTreeTool(strictBT, toolRegistry);

      // Missing required parameter
      const invalidResult = await btTool.execute({ optionalParam: 42 });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.data.error).toContain('Missing required inputs');

      // Valid parameters
      const validResult = await btTool.execute({ requiredParam: 'TestClass' });
      expect(validResult.success).toBe(true);
    });
  });
});