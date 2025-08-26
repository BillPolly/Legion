/**
 * Simplified test for Hello World behavior tree execution
 * Validates that the actual tree from formal planning can be executed
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { NodeStatus } from '@legion/actor-bt';

describe('Hello World Tree Execution - Simple', () => {
  let executor;
  let toolExecutions;
  
  // The actual behavior tree from formal planning
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
                "path": "./hello-world"
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
                "filepath": "./hello-world/index.js",
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
                "filepath": "./hello-world/index.js"
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
  
  beforeEach(() => {
    toolExecutions = [];
    
    // Create mock tool registry that tracks executions
    const mockToolRegistry = {
      getTool: (toolName) => {
        // Return appropriate mock for each tool
        if (toolName === 'directory_create') {
          return Promise.resolve({
            execute: (params) => {
              toolExecutions.push({ tool: 'directory_create', params });
              return Promise.resolve({
                success: true,
                data: { path: params.path, created: true }
              });
            }
          });
        }
        
        if (toolName === 'file_write') {
          return Promise.resolve({
            execute: (params) => {
              toolExecutions.push({ tool: 'file_write', params });
              return Promise.resolve({
                success: true,
                data: { filepath: params.filepath, written: true }
              });
            }
          });
        }
        
        if (toolName === 'run_node') {
          return Promise.resolve({
            execute: (params) => {
              toolExecutions.push({ tool: 'run_node', params });
              return Promise.resolve({
                success: true,
                data: { 
                  output: 'Hello, World!',
                  exitCode: 0,
                  filepath: params.filepath
                }
              });
            }
          });
        }
        
        return Promise.resolve(null);
      }
    };
    
    executor = new DebugBehaviorTreeExecutor(mockToolRegistry);
  });
  
  test('should initialize the Hello World tree successfully', async () => {
    const result = await executor.initializeTree(helloWorldTree);
    
    expect(result.success).toBe(true);
    expect(result.treeId).toBe('hello-world-js');
    expect(result.nodeCount).toBe(13); // All nodes in the tree
  });
  
  test('should execute Hello World tree in run mode', async () => {
    await executor.initializeTree(helloWorldTree);
    
    // Set to run mode for continuous execution
    executor.setMode('run');
    
    // Execute the tree
    const result = await executor.runToCompletion();
    
    // Verify successful completion
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Verify all tools were called in correct order
    expect(toolExecutions.length).toBe(3);
    
    expect(toolExecutions[0]).toMatchObject({
      tool: 'directory_create',
      params: { path: './hello-world' }
    });
    
    expect(toolExecutions[1]).toMatchObject({
      tool: 'file_write',
      params: {
        filepath: './hello-world/index.js',
        content: "console.log('Hello, World!');"
      }
    });
    
    expect(toolExecutions[2]).toMatchObject({
      tool: 'run_node',
      params: { filepath: './hello-world/index.js' }
    });
  });
  
  test('should handle step-by-step execution', async () => {
    await executor.initializeTree(helloWorldTree);
    
    // Keep stepping until complete
    let result;
    let stepCount = 0;
    const maxSteps = 20; // Safety limit
    
    do {
      result = await executor.stepNext();
      stepCount++;
    } while (!result.complete && stepCount < maxSteps);
    
    // Should complete successfully
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // All tools should have been executed
    expect(toolExecutions.length).toBe(3);
  });
  
  test('should track execution state correctly', async () => {
    await executor.initializeTree(helloWorldTree);
    
    // Initial state check
    let state = executor.getExecutionState();
    expect(state.nodeStates['hello-world-js']).toBe('pending');
    expect(state.nodeStates['create-project-dir']).toBe('pending');
    expect(state.nodeStates['write-js-file']).toBe('pending');
    expect(state.nodeStates['execute-program']).toBe('pending');
    
    // Execute
    executor.setMode('run');
    await executor.runToCompletion();
    
    // Final state check
    state = executor.getExecutionState();
    expect(state.nodeStates['create-project-dir']).toBe('success');
    expect(state.nodeStates['write-js-file']).toBe('success');
    expect(state.nodeStates['execute-program']).toBe('success');
    
    // Check artifacts were stored
    expect(state.context.artifacts).toBeDefined();
    expect(state.context.artifacts.dirResult).toMatchObject({ success: true });
    expect(state.context.artifacts.fileResult).toMatchObject({ success: true });
    expect(state.context.artifacts.execResult).toMatchObject({ success: true });
  });
  
  test('should handle breakpoints in Hello World tree', async () => {
    await executor.initializeTree(helloWorldTree);
    
    // Set breakpoint on file write
    executor.addBreakpoint('write-js-file');
    
    // Track when breakpoint is hit
    let breakpointHit = false;
    executor.on('breakpoint:hit', (data) => {
      if (data.nodeId === 'write-js-file') {
        breakpointHit = true;
        // Resume after breakpoint
        executor.resume();
      }
    });
    
    // Run execution
    executor.setMode('run');
    const result = await executor.runToCompletion();
    
    // Should have hit breakpoint and completed
    expect(breakpointHit).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // All tools should still have executed
    expect(toolExecutions.length).toBe(3);
  });
  
  test('should handle retry logic on failure', async () => {
    let createDirAttempts = 0;
    
    // Override directory_create to fail first time
    const mockToolRegistry = {
      getTool: (toolName) => {
        if (toolName === 'directory_create') {
          return Promise.resolve({
            execute: (params) => {
              createDirAttempts++;
              toolExecutions.push({ tool: 'directory_create', params, attempt: createDirAttempts });
              
              // Fail on first attempt
              if (createDirAttempts === 1) {
                return Promise.resolve({
                  success: false,
                  error: 'Permission denied'
                });
              }
              
              // Succeed on retry
              return Promise.resolve({
                success: true,
                data: { path: params.path, created: true }
              });
            }
          });
        }
        
        // Other tools succeed normally
        if (toolName === 'file_write') {
          return Promise.resolve({
            execute: (params) => {
              toolExecutions.push({ tool: 'file_write', params });
              return Promise.resolve({
                success: true,
                data: { filepath: params.filepath }
              });
            }
          });
        }
        
        if (toolName === 'run_node') {
          return Promise.resolve({
            execute: (params) => {
              toolExecutions.push({ tool: 'run_node', params });
              return Promise.resolve({
                success: true,
                data: { output: 'Hello, World!' }
              });
            }
          });
        }
        
        return Promise.resolve(null);
      }
    };
    
    const retryExecutor = new DebugBehaviorTreeExecutor(mockToolRegistry);
    await retryExecutor.initializeTree(helloWorldTree);
    
    retryExecutor.setMode('run');
    const result = await retryExecutor.runToCompletion();
    
    // Should succeed after retry
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Directory create should have been attempted twice
    expect(createDirAttempts).toBe(2);
    
    // Check that retry was recorded
    const dirCreateExecutions = toolExecutions.filter(e => e.tool === 'directory_create');
    expect(dirCreateExecutions.length).toBe(2);
    expect(dirCreateExecutions[0].attempt).toBe(1);
    expect(dirCreateExecutions[1].attempt).toBe(2);
  });
  
  test('should allow reset and re-execution', async () => {
    await executor.initializeTree(helloWorldTree);
    
    // First execution
    executor.setMode('run');
    let result = await executor.runToCompletion();
    expect(result.success).toBe(true);
    expect(toolExecutions.length).toBe(3);
    
    // Reset
    toolExecutions = []; // Clear execution tracking
    executor.reset();
    
    // Verify reset state
    const state = executor.getExecutionState();
    expect(state.history).toHaveLength(0);
    expect(state.nodeStates['hello-world-js']).toBe('pending');
    
    // Second execution
    result = await executor.runToCompletion();
    expect(result.success).toBe(true);
    expect(toolExecutions.length).toBe(3); // Should execute all tools again
  });
});