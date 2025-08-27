/**
 * Test DebugBehaviorTreeExecutor with realistic tool operations
 * Focus on executor functionality with mock tools
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import fs from 'fs/promises';
import path from 'path';

describe('DebugBehaviorTreeExecutor - Realistic Tool Operations', () => {
  let executor;
  let mockToolRegistry;
  const testDir = '/tmp/bt-executor-realistic-test';
  
  beforeEach(async () => {
    // Clean test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore
    }
    
    // Create mock tool registry with realistic tools
    mockToolRegistry = {
      getToolById: async (toolId) => {
        switch (toolId) {
          case 'directory_create':
            return {
              name: 'directory_create',
              execute: async (params) => {
                try {
                  await fs.mkdir(params.path, { recursive: true });
                  const stats = await fs.stat(params.path);
                  return {
                    success: true,
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
                    data: { path: params.path, error: error.message }
                  };
                }
              }
            };
            
          case 'file_write':
            return {
              name: 'file_write',
              execute: async (params) => {
                try {
                  await fs.writeFile(params.path, params.content);
                  return {
                    success: true,
                    data: {
                      path: params.path,
                      content: params.content,
                      bytesWritten: params.content.length
                    }
                  };
                } catch (error) {
                  return {
                    success: false,
                    error: error.message,
                    data: { path: params.path, error: error.message }
                  };
                }
              }
            };
            
          case 'file_read':
            return {
              name: 'file_read',
              execute: async (params) => {
                try {
                  const content = await fs.readFile(params.path, 'utf8');
                  return {
                    success: true,
                    data: {
                      path: params.path,
                      content: content,
                      bytesRead: content.length
                    }
                  };
                } catch (error) {
                  return {
                    success: false,
                    error: error.message,
                    data: { path: params.path, error: error.message }
                  };
                }
              }
            };
            
          case 'execute_command':
            return {
              name: 'execute_command',
              execute: async (params) => {
                try {
                  const { exec } = await import('child_process');
                  const { promisify } = await import('util');
                  const execAsync = promisify(exec);
                  
                  const cmd = params.args ? `${params.command} ${params.args.join(' ')}` : params.command;
                  const result = await execAsync(cmd);
                  
                  return {
                    success: true,
                    data: {
                      command: cmd,
                      stdout: result.stdout,
                      stderr: result.stderr,
                      exitCode: 0
                    }
                  };
                } catch (error) {
                  return {
                    success: false,
                    error: error.message,
                    data: {
                      command: params.command,
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
    
    // Create executor with mock tool registry
    executor = new DebugBehaviorTreeExecutor(mockToolRegistry);
  });
  
  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore
    }
  });
  
  test('should execute a simple tree with realistic tool operations', async () => {
    // Simple tree that uses mock tools doing realistic operations
    const simpleTree = {
      id: 'test-tree',
      type: 'sequence',
      children: [
        {
          id: 'create-dir',
          type: 'action',
          tool: 'directory_create',
          outputVariable: 'dirResult',
          inputs: {
            path: testDir
          }
        },
        {
          id: 'write-file',
          type: 'action',
          tool: 'file_write',
          outputVariable: 'fileResult',
          inputs: {
            path: `${testDir}/test.txt`,
            content: 'Hello from realistic tools!'
          }
        },
        {
          id: 'read-file',
          type: 'action',
          tool: 'file_read',
          outputVariable: 'readResult',
          inputs: {
            path: `${testDir}/test.txt`
          }
        }
      ]
    };
    
    // Initialize tree
    await executor.initializeTree(simpleTree);
    
    // Execute
    executor.setMode('run');
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Check artifacts
    const state = executor.getExecutionState();
    
    expect(state.context.artifacts.dirResult.success).toBe(true);
    expect(state.context.artifacts.fileResult.success).toBe(true);
    expect(state.context.artifacts.readResult.success).toBe(true);
    expect(state.context.artifacts.readResult.data.content).toBe('Hello from realistic tools!');
    
    // Verify file actually exists
    const content = await fs.readFile(`${testDir}/test.txt`, 'utf8');
    expect(content).toBe('Hello from realistic tools!');
  });
  
  test('should execute Hello World program creation and execution', async () => {
    // Simplified tree for creating and running a Hello World program
    const helloWorldTree = {
      id: 'hello-world-js',
      description: 'Create and run a JavaScript Hello World program',
      type: 'sequence',
      children: [
        {
          type: 'action',
          id: 'create-project-dir',
          tool: 'directory_create',
          outputVariable: 'dirResult',
          inputs: {
            path: `${testDir}/hello-world`
          }
        },
        {
          type: 'action',
          id: 'write-js-file',
          tool: 'file_write',
          outputVariable: 'fileResult',
          inputs: {
            path: `${testDir}/hello-world/index.js`,
            content: 'console.log("Hello, World!");'
          }
        },
        {
          type: 'action',
          id: 'execute-program',
          tool: 'execute_command',
          outputVariable: 'execResult',
          inputs: {
            command: 'node',
            args: [`${testDir}/hello-world/index.js`]
          }
        }
      ]
    };
    
    // Initialize
    await executor.initializeTree(helloWorldTree);
    
    // Execute
    executor.setMode('run');
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Check results
    const state = executor.getExecutionState();
    
    expect(state.context.artifacts.dirResult.success).toBe(true);
    expect(state.context.artifacts.fileResult.success).toBe(true);
    expect(state.context.artifacts.execResult.success).toBe(true);
    
    // Verify files were created
    const fileContent = await fs.readFile(`${testDir}/hello-world/index.js`, 'utf8');
    expect(fileContent).toBe('console.log("Hello, World!");');
    
    // Check execution output
    expect(state.context.artifacts.execResult.data.stdout).toContain('Hello, World!');
  });
  
  test('should handle step-through execution with realistic tools', async () => {
    const tree = {
      id: 'step-test',
      type: 'sequence',
      children: [
        {
          id: 'step1',
          type: 'action',
          tool: 'directory_create',
          inputs: { path: `${testDir}/step-test` }
        },
        {
          id: 'step2',
          type: 'action',
          tool: 'file_write',
          inputs: {
            path: `${testDir}/step-test/file.txt`,
            content: 'Step test'
          }
        }
      ]
    };
    
    await executor.initializeTree(tree);
    executor.setMode('step');
    
    // Step 1: Root sequence
    let result = await executor.stepNext();
    expect(result.complete).toBe(false);
    
    // Step 2: Create directory
    result = await executor.stepNext();
    expect(result.complete).toBe(false);
    let state = executor.getExecutionState();
    expect(state.nodeStates['step1']).toBe('success');
    
    // Step 3: Write file  
    result = await executor.stepNext();
    expect(result.complete).toBe(false);
    state = executor.getExecutionState();
    expect(state.nodeStates['step2']).toBe('success');
    
    // Step 4: Complete
    result = await executor.stepNext();
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Verify file exists
    const content = await fs.readFile(`${testDir}/step-test/file.txt`, 'utf8');
    expect(content).toBe('Step test');
  });
});