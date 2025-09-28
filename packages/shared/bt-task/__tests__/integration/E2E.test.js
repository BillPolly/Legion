/**
 * End-to-end integration tests for BT-Task package
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BTExecutor } from '../../src/core/BTExecutor.js';
import { BTLoader } from '../../src/integration/BTLoader.js';
import { BTTool } from '../../src/integration/BTTool.js';

describe('BT-Task E2E Tests', () => {
  let mockToolRegistry;
  
  beforeEach(() => {
    // Create mock tool registry with various tools
    mockToolRegistry = {
      getTool: async (name) => {
        const tools = {
          'create_file': {
            execute: async (params) => ({
              success: true,
              data: { 
                file: params.path,
                content: params.content,
                created: true
              }
            })
          },
          'read_file': {
            execute: async (params) => ({
              success: true,
              data: { 
                content: `Content of ${params.path}`,
                exists: true
              }
            })
          },
          'validate_syntax': {
            execute: async (params) => ({
              success: params.code && params.code.includes('function'),
              data: { 
                valid: params.code && params.code.includes('function'),
                errors: []
              }
            })
          },
          'compile_code': {
            execute: async (params) => ({
              success: true,
              data: { 
                compiled: `compiled: ${params.source}`,
                output: 'output.js'
              }
            })
          },
          'run_tests': {
            execute: async (params) => ({
              success: !params.failTests,
              data: { 
                passed: params.failTests ? 0 : 5,
                failed: params.failTests ? 2 : 0,
                total: params.failTests ? 2 : 5
              }
            })
          }
        };
        return tools[name] || null;
      }
    };
  });
  
  describe('Complete Workflow Tests', () => {
    it('should execute a complete build workflow', async () => {
      const executor = new BTExecutor(mockToolRegistry);
      
      const buildTree = {
        type: 'sequence',
        name: 'Build Workflow',
        children: [
          {
            type: 'action',
            name: 'Create Source',
            tool: 'create_file',
            params: {
              path: 'src/main.js',
              content: 'function main() { return 42; }'
            },
            outputVariable: 'sourceFile'
          },
          {
            type: 'action',
            name: 'Validate Syntax',
            tool: 'validate_syntax',
            params: {
              code: '@sourceFile.content'
            },
            outputVariable: 'validation'
          },
          {
            type: 'condition',
            name: 'If Valid',
            condition: '@validation.valid',
            children: [
              {
                type: 'action',
                name: 'Compile',
                tool: 'compile_code',
                params: {
                  source: '@sourceFile.file'
                },
                outputVariable: 'compiled'
              }
            ]
          },
          {
            type: 'action',
            name: 'Run Tests',
            tool: 'run_tests',
            params: {
              file: '@compiled.output'
            },
            outputVariable: 'testResults'
          }
        ]
      };
      
      const result = await executor.executeTree(buildTree, { artifacts: {} });
      
      expect(result.status).toBe('SUCCESS');
      expect(result.context.artifacts.sourceFile).toBeDefined();
      expect(result.context.artifacts.validation.value.valid).toBe(true);
      expect(result.context.artifacts.compiled).toBeDefined();
      expect(result.context.artifacts.testResults.value.passed).toBe(5);
    });
    
    it('should handle failure scenarios correctly', async () => {
      const executor = new BTExecutor(mockToolRegistry);
      
      const failingTree = {
        type: 'selector',
        name: 'Fallback Workflow',
        children: [
          {
            type: 'sequence',
            name: 'Primary Path',
            children: [
              {
                type: 'action',
                tool: 'create_file',
                params: {
                  path: 'src/bad.js',
                  content: 'invalid syntax {'
                },
                outputVariable: 'badFile'
              },
              {
                type: 'action',
                tool: 'validate_syntax',
                params: {
                  code: '@badFile.content'
                },
                outputVariable: 'validation'
              },
              {
                type: 'condition',
                condition: '@validation.valid',
                children: [
                  {
                    type: 'action',
                    tool: 'compile_code',
                    params: { source: '@badFile.file' }
                  }
                ]
              }
            ]
          },
          {
            type: 'action',
            name: 'Fallback',
            tool: 'create_file',
            params: {
              path: 'fallback.txt',
              content: 'Fallback executed'
            },
            outputVariable: 'fallback'
          }
        ]
      };
      
      const result = await executor.executeTree(failingTree, { artifacts: {} });
      
      expect(result.status).toBe('SUCCESS');
      expect(result.context.artifacts.fallback).toBeDefined();
      expect(result.context.artifacts.fallback.value.content).toBe('Fallback executed');
    });
  });
  
  describe('BTLoader Integration', () => {
    it('should load and execute complex configuration', async () => {
      const loader = new BTLoader(mockToolRegistry);
      
      const config = {
        type: 'sequence',
        name: 'Loaded Tree',
        children: [
          {
            type: 'retry',
            maxAttempts: 3,
            children: [
              {
                type: 'action',
                tool: 'run_tests',
                params: { failTests: false }
              }
            ]
          }
        ]
      };
      
      loader.loadConfig(config);
      const result = await loader.execute({ artifacts: {} });
      
      expect(result.status).toBe('SUCCESS');
    });
    
    it('should load from JSON string and execute', async () => {
      const loader = new BTLoader(mockToolRegistry);
      
      const jsonConfig = JSON.stringify({
        type: 'action',
        tool: 'create_file',
        params: {
          path: 'test.json',
          content: '{"test": true}'
        }
      });
      
      loader.loadJSON(jsonConfig);
      const result = await loader.execute();
      
      expect(result.status).toBe('SUCCESS');
    });
  });
  
  describe('BTTool Integration', () => {
    it('should work as a tool in a workflow', async () => {
      const btTool = new BTTool(mockToolRegistry);
      
      // Use BTTool to execute a sub-tree
      const result = await btTool.execute({
        treeConfig: {
          type: 'sequence',
          children: [
            {
              type: 'action',
              tool: 'create_file',
              params: { path: 'via-tool.txt', content: 'Created via BTTool' }
            },
            {
              type: 'action',
              tool: 'read_file',
              params: { path: '@previous.file' }
            }
          ]
        },
        context: { artifacts: {} }
      });
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
    });
    
    it('should expose correct metadata', async () => {
      const btTool = new BTTool(mockToolRegistry);
      const metadata = btTool.getMetadata();
      
      expect(metadata.name).toBe('behavior_tree');
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.outputSchema).toBeDefined();
    });
  });
  
  describe('Error Propagation', () => {
    it('should propagate tool errors correctly', async () => {
      const errorRegistry = {
        getTool: async (name) => {
          if (name === 'error_tool') {
            return {
              execute: async () => {
                throw new Error('Tool execution error');
              }
            };
          }
          return null;
        }
      };
      
      const executor = new BTExecutor(errorRegistry);
      
      const errorTree = {
        type: 'action',
        tool: 'error_tool',
        params: {}
      };
      
      const result = await executor.executeTree(errorTree, {});
      
      expect(result.status).toBe('FAILURE');
      expect(result.error).toContain('Tool execution error');
    });
    
    it('should handle missing tools gracefully', async () => {
      const executor = new BTExecutor(mockToolRegistry);
      
      const missingToolTree = {
        type: 'action',
        tool: 'non_existent_tool',
        params: {}
      };
      
      const result = await executor.executeTree(missingToolTree, {});
      
      expect(result.status).toBe('FAILURE');
      expect(result.error).toContain('not found');
    });
  });
  
  describe('All Node Types Together', () => {
    it('should execute tree with all node types', async () => {
      const executor = new BTExecutor(mockToolRegistry);
      
      const complexTree = {
        type: 'sequence',
        name: 'Complex Tree',
        children: [
          // Action node
          {
            type: 'action',
            tool: 'create_file',
            params: { path: 'file1.txt', content: 'content1' },
            outputVariable: 'file1'
          },
          // Selector node
          {
            type: 'selector',
            children: [
              {
                type: 'action',
                tool: 'non_existent',
                params: {}
              },
              {
                type: 'action',
                tool: 'create_file',
                params: { path: 'file2.txt', content: 'fallback' },
                outputVariable: 'file2'
              }
            ]
          },
          // Condition node
          {
            type: 'condition',
            condition: '@file2',
            children: [
              {
                type: 'action',
                tool: 'read_file',
                params: { path: '@file2.file' },
                outputVariable: 'readResult'
              }
            ]
          },
          // Retry node
          {
            type: 'retry',
            maxAttempts: 2,
            children: [
              {
                type: 'action',
                tool: 'run_tests',
                params: { failTests: false },
                outputVariable: 'tests'
              }
            ]
          }
        ]
      };
      
      const result = await executor.executeTree(complexTree, { artifacts: {} });
      
      expect(result.status).toBe('SUCCESS');
      expect(result.context.artifacts.file1).toBeDefined();
      expect(result.context.artifacts.file2).toBeDefined();
      expect(result.context.artifacts.readResult).toBeDefined();
      expect(result.context.artifacts.tests).toBeDefined();
    });
  });
  
  describe('Artifact Flow', () => {
    it('should flow artifacts through nested trees', async () => {
      const executor = new BTExecutor(mockToolRegistry);
      
      const nestedTree = {
        type: 'sequence',
        children: [
          {
            type: 'action',
            tool: 'create_file',
            params: { path: 'data.json', content: '{"value": 42}' },
            outputVariable: 'dataFile'
          },
          {
            type: 'sequence',
            name: 'Nested Sequence',
            children: [
              {
                type: 'action',
                tool: 'read_file',
                params: { path: '@dataFile.file' },
                outputVariable: 'readData'
              },
              {
                type: 'selector',
                children: [
                  {
                    type: 'condition',
                    condition: '@readData.exists',
                    children: [
                      {
                        type: 'action',
                        tool: 'validate_syntax',
                        params: { code: 'function test() { return @readData.content; }' },
                        outputVariable: 'validated'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
      
      const result = await executor.executeTree(nestedTree, { artifacts: {} });
      
      expect(result.status).toBe('SUCCESS');
      expect(result.context.artifacts.dataFile).toBeDefined();
      expect(result.context.artifacts.readData).toBeDefined();
      expect(result.context.artifacts.validated).toBeDefined();
    });
  });
});