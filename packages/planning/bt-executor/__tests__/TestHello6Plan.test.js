/**
 * Test execution of the hello6 plan with real tools
 * NO MOCKS - uses real tool registry and real tools
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { ResourceManager } from '@legion/resource-manager';
// For tests, we import the class directly to use getInstance()
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import fs from 'fs/promises';
import path from 'path';

describe('hello6 Plan Execution', () => {
  let executor;
  let toolRegistry;
  let resourceManager;

  beforeAll(async () => {
    // Get the singleton instances
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Get the singleton ToolRegistry - tests use getInstance() directly
    toolRegistry = await ToolRegistry.getInstance();
    
    // Load all modules to ensure tools are available
    console.log('[TEST] Loading all modules...');
    const loadResult = await toolRegistry.loadAllModules();
    console.log(`[TEST] Loaded ${loadResult.modulesLoaded} modules, ${loadResult.toolsLoaded} tools`);
    
    if (loadResult.modulesFailed > 0) {
      console.log(`[TEST] Failed modules:`, loadResult.errors);
    }
  });

  beforeEach(() => {
    // Create a new executor for each test
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
  });

  afterAll(async () => {
    // Clean up any resources
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
  });

  test('should execute the hello6 plan successfully', async () => {
    // The hello6 plan - write 'hello world' to hello6.txt
    const hello6Plan = {
      "name": "Write hello world to file",
      "type": "sequence",
      "children": [
        {
          "type": "action",
          "name": "write_hello_world",
          "config": {
            "tool": "file_write",
            "tool_id": null,  // Will be enriched
            "inputs": {
              "operation": "write",
              "filepath": "hello6.txt",
              "content": "hello world"
            },
            "outputs": {
              "success": "fileWriteSuccess",
              "data": "fileWriteData"
            }
          }
        }
      ]
    };
    
    // First enrich the plan with tool IDs
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    expect(fileWriteTool).toBeDefined();
    
    // Enrich the plan with the tool ID
    hello6Plan.children[0].config.tool_id = fileWriteTool._id;
    
    // Initialize the tree and set to run mode
    executor.setMode('run');
    await executor.initializeTree(hello6Plan);
    
    // Execute the tree
    const result = await executor.execute();
    
    // Check execution result
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Check the file was created
    const fileExists = await fs.access('hello6.txt')
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
    
    // Check the file content
    const content = await fs.readFile('hello6.txt', 'utf8');
    expect(content).toBe('hello world');
    
    // Check execution context has the artifact
    const artifacts = executor.executionContext.artifacts;
    expect(artifacts).toBeDefined();
    expect(Object.keys(artifacts).length).toBeGreaterThan(0);
    expect(artifacts.fileWriteResult).toBeDefined();
    expect(artifacts.fileWriteResult.success).toBe(true);
    
    // Clean up
    await fs.unlink('hello6.txt').catch(() => {});
  });

  test('should handle step-by-step execution of hello6 plan', async () => {
    // The hello6 plan with multiple steps
    const hello6Plan = {
      "name": "Multi-step hello world",
      "type": "sequence",
      "children": [
        {
          "type": "action",
          "name": "write_hello",
          "config": {
            "tool": "file_write",
            "tool_id": null,
            "inputs": {
              "operation": "write",
              "filepath": "hello6_step1.txt",
              "content": "hello"
            },
            "outputs": {
              "success": "step1Success"
            }
          }
        },
        {
          "type": "action",
          "name": "write_world",
          "config": {
            "tool": "file_write",
            "tool_id": null,
            "inputs": {
              "operation": "write",
              "filepath": "hello6_step2.txt",
              "content": "world"
            },
            "outputs": {
              "success": "step2Success"
            }
          }
        }
      ]
    };
    
    // Enrich with tool IDs
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    hello6Plan.children[0].config.tool_id = fileWriteTool._id;
    hello6Plan.children[1].config.tool_id = fileWriteTool._id;
    
    // Initialize the tree in step mode (default)
    await executor.initializeTree(hello6Plan);
    
    // Set breakpoint on second action
    executor.addBreakpoint('write_world');
    
    // Start execution - should pause at breakpoint
    const executePromise = executor.execute();
    
    // Wait a bit for execution to start
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that we're in step mode
    expect(executor.executionMode).toBe('step');
    
    // First file should be created
    const file1Exists = await fs.access('hello6_step1.txt')
      .then(() => true)
      .catch(() => false);
    expect(file1Exists).toBe(true);
    
    // Second file should not exist yet
    const file2Exists = await fs.access('hello6_step2.txt')
      .then(() => true)
      .catch(() => false);
    expect(file2Exists).toBe(false);
    
    // Continue execution
    executor.continue();
    
    // Wait for completion
    const result = await executePromise;
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Now both files should exist
    const file2ExistsAfter = await fs.access('hello6_step2.txt')
      .then(() => true)
      .catch(() => false);
    expect(file2ExistsAfter).toBe(true);
    
    // Clean up
    await fs.unlink('hello6_step1.txt').catch(() => {});
    await fs.unlink('hello6_step2.txt').catch(() => {});
  });
});