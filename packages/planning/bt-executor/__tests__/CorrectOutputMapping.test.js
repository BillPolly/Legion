/**
 * Test that outputs correctly map to tool data fields, not execution wrapper
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import fs from 'fs/promises';

describe('Correct Output Mapping', () => {
  let executor;
  let mockToolRegistry;

  beforeEach(async () => {
    // Clean up test files
    try {
      await fs.unlink('correct_mapping_test.txt');
      await fs.unlink('condition_test.txt');
      await fs.unlink('partial_test.txt');
    } catch (error) {
      // Ignore if file doesn't exist
    }
    
    // Create mock tool registry
    mockToolRegistry = {
      getToolById: async (toolId) => {
        if (toolId === 'file_write') {
          return {
            name: 'file_write',
            execute: async (params) => {
              try {
                await fs.writeFile(params.filepath, params.content);
                return {
                  success: true,
                  data: {
                    filepath: params.filepath,
                    content: params.content,
                    bytesWritten: params.content.length,
                    created: true
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
        }
        return null;
      }
    };
    
    executor = new DebugBehaviorTreeExecutor(mockToolRegistry);
  });

  test('should map to actual tool data fields, not execution wrapper', async () => {
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
        filepath: 'correct_mapping_test.txt',
        content: 'Test correct mapping'
      }
    };
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Verify artifacts map to ACTUAL tool data fields
    const state = executor.getExecutionState();
    expect(state.context.artifacts.createdPath).toBe('correct_mapping_test.txt');
    expect(state.context.artifacts.fileSize).toBe(20); // "Test correct mapping".length
    expect(state.context.artifacts.wasCreated).toBe(true);

    // Verify wrapper fields are NOT mapped
    expect(state.context.artifacts.success).toBeUndefined();
    expect(state.context.artifacts.data).toBeUndefined();
    expect(state.context.artifacts.error).toBeUndefined();

    // Verify file was actually created
    const fileExists = await fs.access('correct_mapping_test.txt')
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  test('should work with condition checking mapped data fields', async () => {
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
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Cleanup
    await fs.unlink('condition_test.txt').catch(() => {});
  });

  test('should handle partial output mapping', async () => {
    const behaviorTree = {
      type: 'action',
      id: 'partial_mapping',
      tool: 'file_write',
      outputs: {
        // Only map filepath, ignore other fields
        filepath: 'onlyPath'
      },
      inputs: {
        filepath: 'partial_test.txt',
        content: 'Partial mapping'
      }
    };
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Should only have the mapped field
    const state = executor.getExecutionState();
    expect(state.context.artifacts.onlyPath).toBe('partial_test.txt');
    expect(state.context.artifacts.bytesWritten).toBeUndefined();
    expect(state.context.artifacts.created).toBeUndefined();

    // Cleanup
    await fs.unlink('partial_test.txt').catch(() => {});
  });
});