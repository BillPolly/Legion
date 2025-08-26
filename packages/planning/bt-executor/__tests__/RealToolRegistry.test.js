/**
 * REAL test using the ACTUAL ToolRegistry with REAL tools
 * NO MOCKS - Using the actual Legion tools
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import toolRegistry from '@legion/tools-registry'; // Default singleton export
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';

describe('DebugBehaviorTreeExecutor - WITH REAL TOOL REGISTRY', () => {
  let executor;
  const testDir = '/tmp/bt-executor-real-test';
  
  beforeAll(async () => {
    // Get REAL ResourceManager instance
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // toolRegistry is already the singleton instance from import
    // Load ALL real modules
    console.log('Loading real tool modules...');
    const loadResult = await toolRegistry.loadAllModules();
    console.log(`Loaded ${loadResult.loaded} modules, ${loadResult.failed} failed`);
    
    // List available tools
    const tools = await toolRegistry.listTools();
    console.log('Available tools:', tools.map(t => t.name));
  });
  
  beforeEach(async () => {
    // Clean test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore
    }
    
    // Create executor with REAL tool registry
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
  });
  
  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore
    }
  });
  
  test('should execute a simple tree with REAL tools', async () => {
    // Simple tree that uses real tools
    const simpleTree = {
      id: 'test-tree',
      type: 'sequence',
      children: [
        {
          id: 'create-dir',
          type: 'action',
          tool: 'directory_create',  // Correct tool name from list
          outputVariable: 'dirResult',
          params: {
            path: testDir
          }
        },
        {
          id: 'write-file',
          type: 'action',
          tool: 'file_write',  // Correct tool name from list
          outputVariable: 'fileResult',
          params: {
            path: `${testDir}/test.txt`,
            content: 'Hello from real tools!'
          }
        },
        {
          id: 'read-file',
          type: 'action',
          tool: 'file_read',  // Correct tool name from list
          outputVariable: 'readResult',
          params: {
            path: `${testDir}/test.txt`
          }
        }
      ]
    };
    
    // Initialize tree
    const initResult = await executor.initializeTree(simpleTree);
    expect(initResult.success).toBe(true);
    
    // Execute
    executor.setMode('run');
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Check artifacts
    const state = executor.getExecutionState();
    console.log('Artifacts:', state.context.artifacts);
    
    expect(state.context.artifacts.dirResult.success).toBe(true);
    expect(state.context.artifacts.fileResult.success).toBe(true);
    expect(state.context.artifacts.readResult.success).toBe(true);
    expect(state.context.artifacts.readResult.content).toBe('Hello from real tools!');
    
    // Verify file actually exists
    const content = await fs.readFile(`${testDir}/test.txt`, 'utf8');
    expect(content).toBe('Hello from real tools!');
  });
  
  test('should execute Hello World tree with REAL Legion tools', async () => {
    // Modified tree to use actual Legion tool names
    const helloWorldTree = {
      id: 'hello-world-js',
      description: 'Create and run a JavaScript Hello World program',
      type: 'sequence',
      children: [
        {
          type: 'retry',
          id: 'retry-create-dir',
          maxAttempts: 3,
          child: {
            type: 'sequence',
            id: 'create-dir-sequence',
            children: [
              {
                type: 'action',
                id: 'create-project-dir',
                tool: 'create_directory', // Real Legion tool name
                outputVariable: 'dirResult',
                params: {
                  path: `${testDir}/hello-world`
                }
              },
              {
                type: 'condition',
                id: 'check-dir-created',
                check: 'context.artifacts["dirResult"].success === true'
              }
            ]
          }
        },
        {
          type: 'retry',
          id: 'retry-write-file',
          maxAttempts: 3,
          child: {
            type: 'sequence',
            id: 'write-file-sequence',
            children: [
              {
                type: 'action',
                id: 'write-js-file',
                tool: 'write_file', // Real Legion tool name
                outputVariable: 'fileResult',
                params: {
                  path: `${testDir}/hello-world/index.js`,
                  content: 'console.log("Hello, World!");'
                }
              },
              {
                type: 'condition',
                id: 'check-file-written',
                check: 'context.artifacts["fileResult"].success === true'
              }
            ]
          }
        },
        {
          type: 'retry',
          id: 'retry-run-program',
          maxAttempts: 3,
          child: {
            type: 'sequence',
            id: 'run-program-sequence',
            children: [
              {
                type: 'action',
                id: 'execute-program',
                tool: 'execute_command', // Real Legion tool name
                outputVariable: 'execResult',
                params: {
                  command: 'node',
                  args: [`${testDir}/hello-world/index.js`]
                }
              },
              {
                type: 'condition',
                id: 'check-execution',
                check: 'context.artifacts["execResult"].success === true'
              }
            ]
          }
        }
      ]
    };
    
    // Initialize
    const initResult = await executor.initializeTree(helloWorldTree);
    expect(initResult.success).toBe(true);
    
    // Execute
    executor.setMode('run');
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Check results
    const state = executor.getExecutionState();
    console.log('Final artifacts:', state.context.artifacts);
    
    // Verify files were created
    const fileContent = await fs.readFile(`${testDir}/hello-world/index.js`, 'utf8');
    expect(fileContent).toBe('console.log("Hello, World!");');
    
    // Check execution output
    if (state.context.artifacts.execResult) {
      console.log('Execution output:', state.context.artifacts.execResult.stdout);
      expect(state.context.artifacts.execResult.stdout).toContain('Hello, World!');
    }
  });
  
  test('should handle step-through execution with REAL tools', async () => {
    const tree = {
      id: 'step-test',
      type: 'sequence',
      children: [
        {
          id: 'step1',
          type: 'action',
          tool: 'create_directory',
          params: { path: `${testDir}/step-test` }
        },
        {
          id: 'step2',
          type: 'action',
          tool: 'write_file',
          params: {
            path: `${testDir}/step-test/file.txt`,
            content: 'Step test'
          }
        }
      ]
    };
    
    await executor.initializeTree(tree);
    
    // Step 1: Root sequence
    let result = await executor.stepNext();
    expect(result.complete).toBe(false);
    expect(result.currentNode).toBe('step1');
    
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