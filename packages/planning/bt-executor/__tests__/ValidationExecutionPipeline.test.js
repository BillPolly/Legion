/**
 * Comprehensive test of the execution pipeline
 * Tests the complete flow from BT initialization through execution
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import fs from 'fs/promises';
import path from 'path';

describe('Validation and Execution Pipeline', () => {
  let executor;
  let mockToolRegistry;

  beforeAll(async () => {
    // Create mock tool registry with common tools
    mockToolRegistry = {
      getToolById: async (id) => {
        const tools = {
          'file_write': {
            name: 'file_write',
            execute: async (params) => {
              const { filepath, content } = params;
              await fs.writeFile(filepath, content);
              return {
                success: true,
                data: {
                  filepath: path.resolve(filepath),
                  content,
                  bytesWritten: content.length,
                  created: new Date().toISOString()
                }
              };
            }
          },
          'directory_create': {
            name: 'directory_create',
            execute: async (params) => {
              const { path: dirPath } = params;
              await fs.mkdir(dirPath, { recursive: true });
              return {
                success: true,
                data: {
                  path: path.resolve(dirPath),
                  created: new Date().toISOString()
                }
              };
            }
          }
        };
        return tools[id] || null;
      }
    };
    
    executor = new DebugBehaviorTreeExecutor(mockToolRegistry);
  });

  beforeEach(async () => {
    // Clean up test files
    const testFiles = ['pipeline_test.txt', 'validation_test.txt', 'output_test.txt'];
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
  });

  test('should execute BT with proper inputs structure', async () => {
    // Get file_write tool
    const fileWriteTool = await mockToolRegistry.getToolById('file_write');
    expect(fileWriteTool).toBeTruthy();

    // Create BT with proper inputs structure
    const behaviorTree = {
      type: 'sequence',
      id: 'file_operation_test',
      children: [
        {
          type: 'action',
          id: 'write_file',
          tool: 'file_write',
          inputs: {
            filepath: 'pipeline_test.txt',
            content: 'Pipeline test content'
          },
          outputVariable: 'write_result'
        }
      ]
    };

    // Execute the behavior tree
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Verify file was created
    const fileExists = await fs.access('pipeline_test.txt').then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    const fileContent = await fs.readFile('pipeline_test.txt', 'utf8');
    expect(fileContent).toBe('Pipeline test content');
    
    // Check that output was stored in artifacts
    const state = executor.getExecutionState();
    expect(state.context.artifacts.write_result).toBeDefined();
    expect(state.context.artifacts.write_result.success).toBe(true);
  });

  test('should execute action with proper input/output mapping', async () => {
    const fileWriteTool = await mockToolRegistry.getToolById('file_write');
    expect(fileWriteTool).toBeTruthy();
    
    // Create BT with proper inputs
    const validBT = {
      type: 'action',
      id: 'valid_write',
      tool: 'file_write',
      inputs: {
        filepath: 'validation_test.txt',
        content: 'Validation test content'
      },
      outputVariable: 'file_result'
    };

    // Execute the behavior tree
    await executor.initializeTree(validBT);
    executor.setMode('run');
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Verify file was created
    const fileContent = await fs.readFile('validation_test.txt', 'utf8');
    expect(fileContent).toBe('Validation test content');
    
    // Check artifacts
    const state = executor.getExecutionState();
    expect(state.context.artifacts.file_result).toBeDefined();
    expect(state.context.artifacts.file_result.success).toBe(true);
  });

  test('should store complete tool output with all fields', async () => {
    const fileWriteTool = await mockToolRegistry.getToolById('file_write');
    
    const behaviorTree = {
      type: 'action',
      id: 'output_test',
      tool: 'file_write',
      inputs: {
        filepath: 'output_test.txt',
        content: 'Output mapping test'
      },
      outputs: {
        filepath: 'created_file_path',
        bytesWritten: 'file_size'
      }
    };

    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Check that specific outputs were mapped to artifacts
    const state = executor.getExecutionState();
    expect(state.context.artifacts.created_file_path).toBeDefined();
    expect(state.context.artifacts.file_size).toBeDefined();
    expect(state.context.artifacts.file_size).toBe(19); // Length of "Output mapping test"
  });

  test('should handle condition nodes checking artifact success', async () => {
    const fileWriteTool = await mockToolRegistry.getToolById('file_write');
    
    const behaviorTree = {
      type: 'sequence',
      id: 'condition_test',
      children: [
        {
          type: 'action',
          id: 'write_file',
          tool: 'file_write',
          inputs: {
            filepath: 'condition_test.txt',
            content: 'Condition test'
          },
          outputVariable: 'write_result'
        },
        {
          type: 'condition',
          id: 'check_success',
          check: "context.artifacts['write_result'].success === true"
        }
      ]
    };

    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Check that both nodes succeeded
    const state = executor.getExecutionState();
    expect(state.nodeStates['write_file']).toBe('success');
    expect(state.nodeStates['check_success']).toBe('success');
    
    // Verify artifacts
    expect(state.context.artifacts.write_result).toBeDefined();
    expect(state.context.artifacts.write_result.success).toBe(true);
  });
});