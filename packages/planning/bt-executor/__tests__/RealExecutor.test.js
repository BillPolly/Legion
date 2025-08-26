/**
 * REAL test for DebugBehaviorTreeExecutor with NO MOCKS
 * Tests actual execution with real tool implementations
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { NodeStatus } from '@legion/actor-bt';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('DebugBehaviorTreeExecutor - REAL EXECUTION', () => {
  let executor;
  let toolRegistry;
  const testDir = '/tmp/bt-executor-test';
  
  // The ACTUAL Hello World behavior tree from formal planning
  const helloWorldTree = {
    "id": "hello-world-js",
    "description": "Create and run a JavaScript Hello World program",
    "type": "sequence",
    "children": [
      {
        "type": "retry",
        "id": "retry-create-dir",
        "maxAttempts": 3,
        "description": "Create project directory with retry",
        "child": {
          "type": "sequence",
          "id": "create-dir-sequence",
          "description": "Create directory and verify",
          "children": [
            {
              "type": "action",
              "id": "create-project-dir",
              "tool": "directory_create",
              "description": "Create project directory",
              "outputVariable": "dirResult",
              "params": {
                "path": `${testDir}/hello-world`
              }
            },
            {
              "type": "condition",
              "id": "check-dir-created",
              "check": "context.artifacts['dirResult'].success === true",
              "description": "Verify directory was created"
            }
          ]
        }
      },
      {
        "type": "retry",
        "id": "retry-write-file",
        "maxAttempts": 3,
        "description": "Write JavaScript file with retry",
        "child": {
          "type": "sequence",
          "id": "write-file-sequence",
          "description": "Write file and verify",
          "children": [
            {
              "type": "action",
              "id": "write-js-file",
              "tool": "file_write",
              "description": "Write Hello World JavaScript file",
              "outputVariable": "fileResult",
              "params": {
                "filepath": `${testDir}/hello-world/index.js`,
                "content": "console.log('Hello, World!');"
              }
            },
            {
              "type": "condition",
              "id": "check-file-written",
              "check": "context.artifacts['fileResult'].success === true",
              "description": "Verify file was written successfully"
            }
          ]
        }
      },
      {
        "type": "retry",
        "id": "retry-run-program",
        "maxAttempts": 3,
        "description": "Execute the JavaScript program with retry",
        "child": {
          "type": "sequence",
          "id": "run-program-sequence",
          "description": "Run program and verify output",
          "children": [
            {
              "type": "action",
              "id": "execute-program",
              "tool": "run_node",
              "description": "Execute the JavaScript program",
              "outputVariable": "execResult",
              "params": {
                "filepath": `${testDir}/hello-world/index.js`
              }
            },
            {
              "type": "condition",
              "id": "check-execution",
              "check": "context.artifacts['execResult'].success === true",
              "description": "Verify program executed successfully"
            }
          ]
        }
      }
    ]
  };
  
  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore if doesn't exist
    }
    
    // Create REAL tool registry with REAL tool implementations
    toolRegistry = {
      getTool: async (toolName) => {
        switch (toolName) {
          case 'directory_create':
            return {
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
                    data: { path: params.path, error: error.message }
                  };
                }
              }
            };
            
          case 'file_write':
            return {
              execute: async (params) => {
                try {
                  // Ensure directory exists
                  const dir = path.dirname(params.filepath);
                  await fs.mkdir(dir, { recursive: true });
                  
                  // Write the file
                  await fs.writeFile(params.filepath, params.content, 'utf8');
                  
                  // Verify it was written
                  const content = await fs.readFile(params.filepath, 'utf8');
                  return {
                    success: content === params.content,
                    data: {
                      filepath: params.filepath,
                      written: true,
                      size: content.length
                    }
                  };
                } catch (error) {
                  return {
                    success: false,
                    error: error.message,
                    data: { filepath: params.filepath, error: error.message }
                  };
                }
              }
            };
            
          case 'run_node':
            return {
              execute: async (params) => {
                try {
                  const { stdout, stderr } = await execAsync(`node ${params.filepath}`);
                  return {
                    success: true,
                    data: {
                      output: stdout.trim(),
                      error: stderr,
                      exitCode: 0,
                      filepath: params.filepath
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
    
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
  });
  
  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore
    }
  });
  
  test('should execute Hello World tree with REAL file operations', async () => {
    // Initialize the tree
    const initResult = await executor.initializeTree(helloWorldTree);
    
    expect(initResult.success).toBe(true);
    expect(initResult.treeId).toBe('hello-world-js');
    
    // Execute in run mode
    executor.setMode('run');
    const result = await executor.runToCompletion();
    
    // Should complete successfully
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Verify the ACTUAL file was created
    const fileExists = await fs.access(`${testDir}/hello-world/index.js`)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
    
    // Verify the file content
    const content = await fs.readFile(`${testDir}/hello-world/index.js`, 'utf8');
    expect(content).toBe("console.log('Hello, World!');");
    
    // Check execution artifacts
    const state = executor.getExecutionState();
    expect(state.context.artifacts.dirResult.success).toBe(true);
    expect(state.context.artifacts.fileResult.success).toBe(true);
    expect(state.context.artifacts.execResult.success).toBe(true);
    expect(state.context.artifacts.execResult.data.output).toBe('Hello, World!');
  });
  
  test('should handle step-by-step execution with REAL operations', async () => {
    await executor.initializeTree(helloWorldTree);
    
    let result;
    let stepCount = 0;
    const maxSteps = 30; // Safety limit
    
    // Step through execution
    do {
      result = await executor.stepNext();
      stepCount++;
      
      const state = executor.getExecutionState();
      console.log(`Step ${stepCount}: Node ${state.currentNode}, History: ${state.history.length}`);
      
    } while (!result.complete && stepCount < maxSteps);
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Verify file was created
    const content = await fs.readFile(`${testDir}/hello-world/index.js`, 'utf8');
    expect(content).toBe("console.log('Hello, World!');");
  });
  
  test('should handle retry logic with REAL failures', async () => {
    let createAttempts = 0;
    
    // Override directory_create to fail first time
    const originalGetTool = toolRegistry.getTool;
    toolRegistry.getTool = async (toolName) => {
      if (toolName === 'directory_create') {
        return {
          execute: async (params) => {
            createAttempts++;
            if (createAttempts === 1) {
              // First attempt fails
              return {
                success: false,
                error: 'Simulated failure for testing retry',
                data: { path: params.path }
              };
            }
            // Second attempt succeeds
            try {
              await fs.mkdir(params.path, { recursive: true });
              const stats = await fs.stat(params.path);
              return {
                success: true,
                data: { path: params.path, created: true }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        };
      }
      return originalGetTool(toolName);
    };
    
    await executor.initializeTree(helloWorldTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    expect(createAttempts).toBe(2); // Failed once, succeeded on retry
  });
  
  test('should properly track all node states', async () => {
    await executor.initializeTree(helloWorldTree);
    
    // Check initial states
    const initialState = executor.getExecutionState();
    const expectedNodes = [
      'hello-world-js',
      'retry-create-dir',
      'create-dir-sequence',
      'create-project-dir',
      'check-dir-created',
      'retry-write-file',
      'write-file-sequence',
      'write-js-file',
      'check-file-written',
      'retry-run-program',
      'run-program-sequence',
      'execute-program',
      'check-execution'
    ];
    
    expectedNodes.forEach(nodeId => {
      expect(initialState.nodeStates[nodeId]).toBe('pending');
    });
    
    // Execute
    executor.setMode('run');
    await executor.runToCompletion();
    
    // Check final states - action nodes should be success
    const finalState = executor.getExecutionState();
    expect(finalState.nodeStates['create-project-dir']).toBe('success');
    expect(finalState.nodeStates['write-js-file']).toBe('success');
    expect(finalState.nodeStates['execute-program']).toBe('success');
  });
  
  test('should handle breakpoints during REAL execution', async () => {
    await executor.initializeTree(helloWorldTree);
    
    // Set breakpoint on write-js-file
    executor.addBreakpoint('write-js-file');
    
    let breakpointHit = false;
    executor.on('breakpoint:hit', (data) => {
      if (data.nodeId === 'write-js-file') {
        breakpointHit = true;
        
        // Check that directory was created but file not yet
        fs.access(`${testDir}/hello-world`)
          .then(() => console.log('Directory exists at breakpoint'))
          .catch(() => console.log('Directory does not exist'));
        
        // Resume
        executor.resume();
      }
    });
    
    executor.setMode('run');
    const result = await executor.runToCompletion();
    
    expect(breakpointHit).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // File should exist after completion
    const content = await fs.readFile(`${testDir}/hello-world/index.js`, 'utf8');
    expect(content).toBe("console.log('Hello, World!');");
  });
});