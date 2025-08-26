/**
 * Test that outputs correctly map to tool data fields, not execution wrapper
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import fs from 'fs/promises';

describe('Correct Output Mapping', () => {
  let executor;
  let toolRegistry;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    toolRegistry = await ToolRegistry.getInstance();
    await toolRegistry.loadAllModules();
    
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
  });

  afterAll(async () => {
    await toolRegistry.cleanup();
  });

  beforeEach(async () => {
    // Clean up test files
    try {
      await fs.unlink('correct_mapping_test.txt');
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  test('should map to actual tool data fields, not execution wrapper', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    // Create BT that maps to actual tool output fields
    const behaviorTree = {
      type: 'action',
      id: 'test_correct_mapping',
      tool: 'file_write',
      outputs: {
        // Map to ACTUAL tool output fields from result.data
        filepath: 'createdPath',
        bytesWritten: 'fileSize',
        created: 'wasCreated'
      },
      inputs: {
        operation: 'write',
        filepath: 'correct_mapping_test.txt',
        content: 'Test correct mapping'
      }
    };

    behaviorTree.tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Verify artifacts map to ACTUAL tool data fields
    expect(executor.executionContext.artifacts.createdPath).toBe('correct_mapping_test.txt');
    expect(executor.executionContext.artifacts.fileSize).toBe(19); // "Test correct mapping".length
    expect(executor.executionContext.artifacts.wasCreated).toBe(true);

    // Verify wrapper fields are NOT mapped
    expect(executor.executionContext.artifacts.success).toBeUndefined();
    expect(executor.executionContext.artifacts.data).toBeUndefined();
    expect(executor.executionContext.artifacts.error).toBeUndefined();

    // Verify file was actually created
    const fileExists = await fs.access('correct_mapping_test.txt')
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  test('should work with condition checking mapped data fields', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    const behaviorTree = {
      type: 'sequence',
      id: 'condition_test',
      children: [
        {
          type: 'action',
          id: 'write_file',
          tool: 'file_write',
          outputs: {
            filepath: 'resultPath',
            bytesWritten: 'resultSize'
          },
          inputs: {
            operation: 'write',
            filepath: 'condition_test.txt',
            content: 'Condition test'
          }
        },
        {
          type: 'condition',
          id: 'check_path',
          check: "context.artifacts['resultPath'] === 'condition_test.txt'",
          description: 'Verify correct path was stored'
        },
        {
          type: 'condition',
          id: 'check_size',
          check: "context.artifacts['resultSize'] > 0",
          description: 'Verify bytes were written'
        }
      ]
    };

    behaviorTree.children[0].tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Cleanup
    await fs.unlink('condition_test.txt').catch(() => {});
  });

  test('should handle partial output mapping', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    const behaviorTree = {
      type: 'action',
      id: 'partial_mapping',
      tool: 'file_write',
      outputs: {
        // Only map filepath, ignore other fields
        filepath: 'onlyPath'
      },
      inputs: {
        operation: 'write',
        filepath: 'partial_test.txt',
        content: 'Partial mapping'
      }
    };

    behaviorTree.tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Should only have the mapped field
    expect(executor.executionContext.artifacts.onlyPath).toBe('partial_test.txt');
    expect(executor.executionContext.artifacts.bytesWritten).toBeUndefined();
    expect(executor.executionContext.artifacts.created).toBeUndefined();

    // Cleanup
    await fs.unlink('partial_test.txt').catch(() => {});
  });
});