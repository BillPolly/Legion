/**
 * Test for DebugBehaviorTreeExecutor with complex behavior trees
 * Tests retry logic, sequences, and multiple tool interactions
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { NodeStatus } from '@legion/bt-task';
import fs from 'fs/promises';
import path from 'path';

describe('DebugBehaviorTreeExecutor - Complex Execution', () => {
  let executor;
  let mockToolRegistry;
  const testDir = '/tmp/bt-executor-test';
  
  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore if doesn't exist
    }
    
    // Create mock tool registry with tool implementations
    mockToolRegistry = {
      getToolById: async (toolId) => {
        switch (toolId) {
          case 'directory_create':
            return {
              name: 'directory_create',
              execute: async (params) => {
                try {
                  await fs.mkdir(params.path, { recursive: true });
                  // Verify it was created
                  const stats = await fs.stat(params.path);
                  return {
                    success: stats.isDirectory(),
                    data: {
                      path: params.path,
                      created: true,
                      isDirectory: stats.isDirectory()
                    }
                  };
                } catch (error) {
                  return {
                    success: false,
                    error: error.message,
                    data: {
                      path: params.path,
                      error: error.message
                    }
                  };
                }
              }
            };
            
          case 'file_write':
            return {
              name: 'file_write',
              execute: async (params) => {
                try {
                  await fs.writeFile(params.filepath, params.content);
                  return {
                    success: true,
                    data: {
                      filepath: params.filepath,
                      content: params.content,
                      bytesWritten: params.content.length
                    }
                  };
                } catch (error) {
                  return {
                    success: false,
                    error: error.message,
                    data: {
                      filepath: params.filepath,
                      error: error.message
                    }
                  };
                }
              }
            };
            
          case 'run_node':
            return {
              name: 'run_node',
              execute: async (params) => {
                try {
                  const { exec } = await import('child_process');
                  const { promisify } = await import('util');
                  const execAsync = promisify(exec);
                  
                  const result = await execAsync(`node "${params.filepath}"`);
                  return {
                    success: true,
                    data: {
                      filepath: params.filepath,
                      output: result.stdout,
                      stderr: result.stderr,
                      exitCode: 0
                    }
                  };
                } catch (error) {
                  return {
                    success: false,
                    error: error.message,
                    data: {
                      filepath: params.filepath,
                      error: error.message,
                      exitCode: error.code || 1
                    }
                  };
                }
              }
            };
            
          default:
            return null;
        }
      }
    };
    
    executor = new DebugBehaviorTreeExecutor(mockToolRegistry);
  });
  
  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore
    }
  });

  test('should execute simple sequence with file operations', async () => {
    const simpleTree = {
      type: 'sequence',
      id: 'file-sequence',
      children: [
        {
          type: 'action',
          id: 'create-dir',
          tool: 'directory_create',
          inputs: {
            path: `${testDir}/test-project`
          },
          outputVariable: 'dirResult'
        },
        {
          type: 'action',
          id: 'write-file',
          tool: 'file_write',
          inputs: {
            filepath: `${testDir}/test-project/test.js`,
            content: 'console.log("Test");'
          },
          outputVariable: 'fileResult'
        }
      ]
    };

    await executor.initializeTree(simpleTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Verify directory was created
    const dirExists = await fs.access(`${testDir}/test-project`)
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);
    
    // Verify file was created
    const fileExists = await fs.access(`${testDir}/test-project/test.js`)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
    
    // Verify file content
    const content = await fs.readFile(`${testDir}/test-project/test.js`, 'utf8');
    expect(content).toBe('console.log("Test");');
    
    // Check artifacts
    const state = executor.getExecutionState();
    expect(state.context.artifacts.dirResult.success).toBe(true);
    expect(state.context.artifacts.fileResult.success).toBe(true);
  });

  test('should handle action failure and success', async () => {
    // Test that executor properly handles tool failures
    const failingTree = {
      type: 'action',
      id: 'failing-action',
      tool: 'directory_create',
      inputs: {
        path: '/invalid/path/that/cannot/be/created'
      },
      outputVariable: 'failResult'
    };

    await executor.initializeTree(failingTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(false); // Action should fail
    
    // Check that failure was stored in artifacts
    const state = executor.getExecutionState();
    expect(state.context.artifacts.failResult).toBeDefined();
    expect(state.context.artifacts.failResult.success).toBe(false);
    
    // Now test successful action
    const successTree = {
      type: 'action',
      id: 'success-action',
      tool: 'directory_create',
      inputs: {
        path: `${testDir}/success-test`
      },
      outputVariable: 'successResult'
    };

    await executor.initializeTree(successTree);
    executor.setMode('run');
    
    const successResult = await executor.runToCompletion();
    
    expect(successResult.complete).toBe(true);
    expect(successResult.success).toBe(true);
    
    // Verify directory was created
    const dirExists = await fs.access(`${testDir}/success-test`)
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);
  });

  test('should properly track node states in complex tree', async () => {
    const complexTree = {
      type: 'sequence',
      id: 'complex-test',
      children: [
        {
          type: 'action',
          id: 'create-project-dir',
          tool: 'directory_create',
          inputs: {
            path: `${testDir}/complex-project`
          }
        },
        {
          type: 'sequence',
          id: 'nested-sequence',
          children: [
            {
              type: 'action',
              id: 'write-file-1',
              tool: 'file_write',
              inputs: {
                filepath: `${testDir}/complex-project/file1.js`,
                content: 'console.log("File 1");'
              }
            },
            {
              type: 'action',
              id: 'write-file-2',
              tool: 'file_write',
              inputs: {
                filepath: `${testDir}/complex-project/file2.js`,
                content: 'console.log("File 2");'
              }
            }
          ]
        }
      ]
    };

    await executor.initializeTree(complexTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Check that all nodes have proper states
    const state = executor.getExecutionState();
    expect(state.nodeStates['create-project-dir']).toBe('success');
    expect(state.nodeStates['nested-sequence']).toBe('success');
    expect(state.nodeStates['write-file-1']).toBe('success');
    expect(state.nodeStates['write-file-2']).toBe('success');
    expect(state.nodeStates['complex-test']).toBe('success');
  });

  test('should handle step-by-step execution', async () => {
    const stepTree = {
      type: 'sequence',
      id: 'step-test',
      children: [
        {
          type: 'action',
          id: 'step-1',
          tool: 'directory_create',
          inputs: {
            path: `${testDir}/step-test`
          }
        },
        {
          type: 'action',
          id: 'step-2',
          tool: 'file_write',
          inputs: {
            filepath: `${testDir}/step-test/step.txt`,
            content: 'Step content'
          }
        }
      ]
    };

    await executor.initializeTree(stepTree);
    executor.setMode('step');
    
    // Step 1: Should start the sequence
    let result = await executor.stepNext();
    expect(result.complete).toBe(false);
    
    // Step 2: Should execute first action
    result = await executor.stepNext();
    expect(result.complete).toBe(false);
    
    // Step 3: Should execute second action
    result = await executor.stepNext();
    expect(result.complete).toBe(false);
    
    // Step 4: Should complete
    result = await executor.stepNext();
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Verify both operations completed
    const fileExists = await fs.access(`${testDir}/step-test/step.txt`)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });
});