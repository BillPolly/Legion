/**
 * Test that legacy outputVariable format is completely removed
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import fs from 'fs/promises';

describe('Legacy Format Rejection', () => {
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
      await fs.unlink('legacy_test.txt');
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  test('should NOT store artifacts when using legacy outputVariable format', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    // Create BT with OLD outputVariable format (should not work)
    const behaviorTree = {
      type: 'action',
      id: 'legacy_test',
      tool: 'file_write',
      outputVariable: 'legacyResult',  // OLD FORMAT - should be ignored
      inputs: {
        operation: 'write',
        filepath: 'legacy_test.txt',
        content: 'Legacy test content'
      }
    };

    behaviorTree.tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    // Execution should succeed (file gets created)
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // But NO artifacts should be stored because outputVariable is ignored
    expect(Object.keys(executor.executionContext.artifacts)).toHaveLength(0);
    expect(executor.executionContext.artifacts.legacyResult).toBeUndefined();

    // File should still be created (tool execution works)
    const fileExists = await fs.access('legacy_test.txt')
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  test('should only work with new outputs format', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    // Create BT with NEW outputs format (should work)
    const behaviorTree = {
      type: 'action',
      id: 'new_format_test',
      tool: 'file_write',
      outputs: {
        success: 'newSuccess',
        data: 'newData'
      },
      inputs: {
        operation: 'write',
        filepath: 'new_format_test.txt',
        content: 'New format content'
      }
    };

    behaviorTree.tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Artifacts SHOULD be stored with new format
    expect(executor.executionContext.artifacts.newSuccess).toBe(true);
    expect(executor.executionContext.artifacts.newData).toBeDefined();

    // Clean up
    await fs.unlink('new_format_test.txt').catch(() => {});
  });

  test('should ignore storeResult and other legacy fields', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    // Test that other legacy fields are also ignored
    const behaviorTree = {
      type: 'action',
      id: 'all_legacy_test',
      tool: 'file_write',
      outputVariable: 'legacyOutput',
      storeResult: 'legacyStore',
      // Only outputs should work
      outputs: {
        success: 'realOutput'
      },
      inputs: {
        operation: 'write',
        filepath: 'all_legacy_test.txt',
        content: 'All legacy test'
      }
    };

    behaviorTree.tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Only the new outputs field should work
    expect(executor.executionContext.artifacts.realOutput).toBe(true);
    expect(executor.executionContext.artifacts.legacyOutput).toBeUndefined();
    expect(executor.executionContext.artifacts.legacyStore).toBeUndefined();

    // Clean up
    await fs.unlink('all_legacy_test.txt').catch(() => {});
  });
});