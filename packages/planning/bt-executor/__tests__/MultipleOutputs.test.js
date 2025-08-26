/**
 * Test the new multiple outputs format
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { BTValidator } from '@legion/bt-validator';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import fs from 'fs/promises';

describe('Multiple Outputs Format', () => {
  let executor;
  let validator;
  let toolRegistry;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    toolRegistry = await ToolRegistry.getInstance();
    await toolRegistry.loadAllModules();
    
    validator = new BTValidator();
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
  });

  afterAll(async () => {
    await toolRegistry.cleanup();
  });

  beforeEach(async () => {
    // Clean up test files
    const testFiles = ['outputs_test.txt', 'multi_outputs_test.txt'];
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
  });

  test('should validate and execute BT with new outputs format', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    // Create BT with new outputs format
    const behaviorTree = {
      type: 'sequence',
      id: 'outputs_test',
      description: 'Test new outputs format',
      children: [
        {
          type: 'action',
          id: 'write_file',
          tool: 'file_write',
          description: 'Write test file',
          outputs: {
            success: 'writeSuccess',
            data: 'writeData',
            error: 'writeError'
          },
          inputs: {
            operation: 'write',
            filepath: 'outputs_test.txt',
            content: 'Testing multiple outputs'
          }
        },
        {
          type: 'condition',
          id: 'check_success',
          check: 'context.artifacts[\'writeSuccess\'] === true',
          description: 'Check if write was successful'
        },
        {
          type: 'condition',
          id: 'check_data',
          check: 'context.artifacts[\'writeData\'] && context.artifacts[\'writeData\'].filepath === \'outputs_test.txt\'',
          description: 'Check file data is correct'
        }
      ]
    };

    console.log('=== VALIDATING NEW OUTPUTS FORMAT ===');
    const validationResult = await validator.validate(behaviorTree, [fileWriteTool]);
    
    console.log('Validation result:', {
      valid: validationResult.valid,
      errors: validationResult.errors,
      warnings: validationResult.warnings
    });

    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);

    console.log('=== EXECUTING WITH NEW OUTPUTS FORMAT ===');
    
    // Enrich and execute
    behaviorTree.children[0].tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    console.log('Execution result:', result);
    console.log('Execution artifacts:', executor.executionContext.artifacts);
    
    // Verify execution succeeded
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Verify multiple outputs were mapped correctly
    expect(executor.executionContext.artifacts.writeSuccess).toBe(true);
    expect(executor.executionContext.artifacts.writeData).toBeDefined();
    expect(executor.executionContext.artifacts.writeData.filepath).toBe('outputs_test.txt');
    expect(executor.executionContext.artifacts.writeError).toBeNull();

    // Verify file was created
    const fileExists = await fs.access('outputs_test.txt')
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    const fileContent = await fs.readFile('outputs_test.txt', 'utf8');
    expect(fileContent).toBe('Testing multiple outputs');
  });

  test('should handle multiple actions with different output mappings', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    const behaviorTree = {
      type: 'sequence',
      id: 'multiple_actions_test',
      children: [
        // First action - map success only
        {
          type: 'action',
          id: 'write_first',
          tool: 'file_write',
          outputs: {
            success: 'firstSuccess'
          },
          inputs: {
            operation: 'write',
            filepath: 'multi_outputs_test.txt',
            content: 'First write'
          }
        },
        // Second action - map success and data
        {
          type: 'action',
          id: 'write_second',
          tool: 'file_write',
          outputs: {
            success: 'secondSuccess',
            data: 'secondData'
          },
          inputs: {
            operation: 'write',
            filepath: 'multi_outputs_test.txt',
            content: 'Second write'
          }
        },
        // Check both
        {
          type: 'condition',
          id: 'check_first',
          check: 'context.artifacts[\'firstSuccess\'] === true'
        },
        {
          type: 'condition',
          id: 'check_second',
          check: 'context.artifacts[\'secondSuccess\'] === true'
        }
      ]
    };

    // Enrich
    behaviorTree.children[0].tool_id = fileWriteTool._id;
    behaviorTree.children[1].tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Verify first action output
    expect(executor.executionContext.artifacts.firstSuccess).toBe(true);

    // Verify second action outputs  
    expect(executor.executionContext.artifacts.secondSuccess).toBe(true);
    expect(executor.executionContext.artifacts.secondData).toBeDefined();
    expect(executor.executionContext.artifacts.secondData.filepath).toBe('multi_outputs_test.txt');
  });

  test('should handle selective output mapping', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    const behaviorTree = {
      type: 'action',
      id: 'selective_outputs',
      tool: 'file_write',
      outputs: {
        // Only map success field, ignore data/message/error
        success: 'justSuccess'
      },
      inputs: {
        operation: 'write',
        filepath: 'selective_test.txt',
        content: 'Selective mapping'
      }
    };

    behaviorTree.tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Should only have the mapped output
    expect(executor.executionContext.artifacts.justSuccess).toBe(true);
    expect(executor.executionContext.artifacts.data).toBeUndefined();
    expect(executor.executionContext.artifacts.message).toBeUndefined();

    // Clean up
    await fs.unlink('selective_test.txt').catch(() => {});
  });

  test('should work without any outputs specified', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    const behaviorTree = {
      type: 'action',
      id: 'no_outputs',
      tool: 'file_write',
      // No outputs or outputVariable specified
      inputs: {
        operation: 'write',
        filepath: 'no_outputs_test.txt',
        content: 'No outputs'
      }
    };

    behaviorTree.tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Should not have stored any artifacts
    expect(Object.keys(executor.executionContext.artifacts)).toHaveLength(0);

    // Clean up
    await fs.unlink('no_outputs_test.txt').catch(() => {});
  });
});