/**
 * Test the multiple outputs format functionality
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import fs from 'fs/promises';

describe('Multiple Outputs Format', () => {
  let executor;
  let mockToolRegistry;

  beforeEach(async () => {
    // Clean up test files
    const testFiles = ['outputs_test.txt', 'multi_outputs_test.txt', 'selective_test.txt', 'no_outputs_test.txt'];
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore if file doesn't exist
      }
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

  test('should execute BT with multiple outputs mapping', async () => {
    // Create BT with multiple outputs mapping from result.data fields
    const behaviorTree = {
      type: 'sequence',
      id: 'outputs_test',
      children: [
        {
          type: 'action',
          id: 'write_file',
          tool: 'file_write',
          outputs: {
            // Map from result.data fields
            filepath: 'savedPath',
            bytesWritten: 'fileSize',
            created: 'wasCreated'
          },
          inputs: {
            filepath: 'outputs_test.txt',
            content: 'Testing multiple outputs'
          }
        },
        {
          type: 'condition',
          id: 'check_path',
          check: "context.artifacts['savedPath'] === 'outputs_test.txt'"
        },
        {
          type: 'condition',
          id: 'check_created',
          check: "context.artifacts['wasCreated'] === true"
        }
      ]
    };
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    // Verify execution succeeded
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Verify multiple outputs were mapped correctly
    const state = executor.getExecutionState();
    expect(state.context.artifacts.savedPath).toBe('outputs_test.txt');
    expect(state.context.artifacts.fileSize).toBe(24); // "Testing multiple outputs".length
    expect(state.context.artifacts.wasCreated).toBe(true);

    // Verify file was created
    const fileExists = await fs.access('outputs_test.txt')
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    const fileContent = await fs.readFile('outputs_test.txt', 'utf8');
    expect(fileContent).toBe('Testing multiple outputs');
  });

  test('should handle multiple actions with different output mappings', async () => {
    const behaviorTree = {
      type: 'sequence',
      id: 'multiple_actions_test',
      children: [
        // First action - map only filepath
        {
          type: 'action',
          id: 'write_first',
          tool: 'file_write',
          outputs: {
            filepath: 'firstPath'
          },
          inputs: {
            filepath: 'multi_outputs_test.txt',
            content: 'First write'
          }
        },
        // Second action - map filepath and created
        {
          type: 'action',
          id: 'write_second',
          tool: 'file_write',
          outputs: {
            filepath: 'secondPath',
            created: 'secondCreated'
          },
          inputs: {
            filepath: 'multi_outputs_test.txt',
            content: 'Second write'
          }
        },
        // Check both
        {
          type: 'condition',
          id: 'check_first',
          check: "context.artifacts['firstPath'] === 'multi_outputs_test.txt'"
        },
        {
          type: 'condition',
          id: 'check_second',
          check: "context.artifacts['secondCreated'] === true"
        }
      ]
    };
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Verify first action output
    const state = executor.getExecutionState();
    expect(state.context.artifacts.firstPath).toBe('multi_outputs_test.txt');

    // Verify second action outputs  
    expect(state.context.artifacts.secondPath).toBe('multi_outputs_test.txt');
    expect(state.context.artifacts.secondCreated).toBe(true);
  });

  test('should handle selective output mapping', async () => {
    const behaviorTree = {
      type: 'action',
      id: 'selective_outputs',
      tool: 'file_write',
      outputs: {
        // Only map filepath, ignore other data fields
        filepath: 'justPath'
      },
      inputs: {
        filepath: 'selective_test.txt',
        content: 'Selective mapping'
      }
    };
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Should only have the mapped output
    const state = executor.getExecutionState();
    expect(state.context.artifacts.justPath).toBe('selective_test.txt');
    expect(state.context.artifacts.content).toBeUndefined();
    expect(state.context.artifacts.bytesWritten).toBeUndefined();
    expect(state.context.artifacts.created).toBeUndefined();

    // Clean up
    await fs.unlink('selective_test.txt').catch(() => {});
  });

  test('should work without any outputs specified', async () => {
    const behaviorTree = {
      type: 'action',
      id: 'no_outputs',
      tool: 'file_write',
      // No outputs or outputVariable specified
      inputs: {
        filepath: 'no_outputs_test.txt',
        content: 'No outputs'
      }
    };
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Should not have stored any artifacts
    const state = executor.getExecutionState();
    expect(Object.keys(state.context.artifacts)).toHaveLength(0);

    // Clean up
    await fs.unlink('no_outputs_test.txt').catch(() => {});
  });
});