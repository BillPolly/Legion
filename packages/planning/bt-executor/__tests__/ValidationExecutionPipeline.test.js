/**
 * Comprehensive test of the validation and execution pipeline
 * Tests the complete flow from BT validation through execution
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { BTValidator } from '@legion/bt-validator';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import fs from 'fs/promises';

describe('Validation and Execution Pipeline', () => {
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
    const testFiles = ['pipeline_test.txt', 'validation_test.txt'];
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
  });

  test('should validate and execute BT with proper inputs structure', async () => {
    // Get file_write tool for validation
    const fileWriteTool = await toolRegistry.getTool('file_write');
    expect(fileWriteTool).toBeTruthy();
    expect(fileWriteTool.inputSchema).toBeDefined();

    // Create BT with proper inputs structure
    const behaviorTree = {
      type: 'sequence',
      id: 'pipeline_test',
      description: 'Test validation and execution pipeline',
      children: [
        {
          type: 'action',
          id: 'write_test_file',
          tool: 'file_write',
          description: 'Write test file',
          outputs: {
            success: 'writeSuccess',
            data: 'writeData'
          },
          inputs: {
            operation: 'write',
            filepath: 'pipeline_test.txt',
            content: 'Pipeline test content'
          }
        }
      ]
    };

    // Step 1: Validate the BT structure
    console.log('=== VALIDATION PHASE ===');
    const tools = [fileWriteTool];
    const validationResult = await validator.validate(behaviorTree, tools);
    
    console.log('Validation result:', {
      valid: validationResult.valid,
      errors: validationResult.errors,
      warnings: validationResult.warnings
    });

    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);

    // Step 2: Execute the validated BT
    console.log('=== EXECUTION PHASE ===');
    
    // Enrich the BT with tool IDs
    behaviorTree.children[0].tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    console.log('Execution result:', result);
    console.log('Execution artifacts:', executor.executionContext.artifacts);
    
    // Step 3: Verify execution results
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Verify artifacts were stored
    expect(executor.executionContext.artifacts.writeSuccess).toBe(true);
    expect(executor.executionContext.artifacts.writeData).toBeDefined();
    expect(executor.executionContext.artifacts.writeData.filepath).toBe('pipeline_test.txt');

    // Verify file was actually created
    const fileExists = await fs.access('pipeline_test.txt')
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    const fileContent = await fs.readFile('pipeline_test.txt', 'utf8');
    expect(fileContent).toBe('Pipeline test content');
  });

  test('should validate input parameters against tool inputSchema', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    // Create BT with invalid inputs (missing required field)
    const invalidBT = {
      type: 'action',
      id: 'invalid_write',
      tool: 'file_write',
      inputs: {
        operation: 'write',
        // Missing filepath and content
      }
    };

    const validationResult = await validator.validate(invalidBT, [fileWriteTool]);
    
    console.log('Validation errors for invalid BT:', validationResult.errors);
    
    expect(validationResult.valid).toBe(false);
    expect(validationResult.errors.length).toBeGreaterThan(0);
    
    // Should have errors about missing required fields
    const hasFilepathError = validationResult.errors.some(error => 
      error.message.includes('filepath') || error.message.includes('required')
    );
    expect(hasFilepathError).toBe(true);
  });

  test('should store complete tool output with all fields', async () => {
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    const behaviorTree = {
      type: 'action',
      id: 'output_test',
      tool: 'file_write',
      outputs: {
        success: 'writeSuccess',
        data: 'writeData',
        error: 'writeError'
      },
      inputs: {
        operation: 'write',
        filepath: 'validation_test.txt',
        content: 'Output test'
      }
    };

    // Enrich and execute
    behaviorTree.tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Verify complete output mapping
    expect(executor.executionContext.artifacts.writeSuccess).toBe(true);
    expect(executor.executionContext.artifacts.writeData).toBeDefined();
    expect(executor.executionContext.artifacts.writeData).toMatchObject({
      filepath: 'validation_test.txt',
      bytesWritten: 11
    });
    expect(executor.executionContext.artifacts.writeError).toBeNull();
  });

  test('should handle condition nodes checking artifact success', async () => {
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
            success: 'writeSuccess'
          },
          inputs: {
            operation: 'write',
            filepath: 'condition_test.txt',
            content: 'Success test'
          }
        },
        {
          type: 'condition',
          id: 'check_success',
          check: "context.artifacts['writeSuccess'] === true",
          description: 'Verify write succeeded'
        }
      ]
    };

    // Validate first
    const validationResult = await validator.validate(behaviorTree, [fileWriteTool]);
    expect(validationResult.valid).toBe(true);

    // Enrich and execute
    behaviorTree.children[0].tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Cleanup
    await fs.unlink('condition_test.txt').catch(() => {});
  });
});