/**
 * Test output mapping behavior with different formats
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import fs from 'fs/promises';

describe('Output Format Behavior', () => {
  let executor;
  let mockToolRegistry;

  beforeEach(async () => {
    // Clean up test files
    try {
      await fs.unlink('legacy_test.txt');
      await fs.unlink('new_format_test.txt');
      await fs.unlink('all_legacy_test.txt');
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

  test('should support legacy outputVariable format for backward compatibility', async () => {
    // Create BT with outputVariable format (should work for backward compatibility)
    const behaviorTree = {
      type: 'action',
      id: 'legacy_test',
      tool: 'file_write',
      outputVariable: 'legacyResult',  // Should store entire result
      inputs: {
        filepath: 'legacy_test.txt',
        content: 'Legacy test content'
      }
    };
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    // Execution should succeed (file gets created)
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Entire result should be stored in the specified outputVariable
    const state = executor.getExecutionState();
    expect(state.context.artifacts.legacyResult).toBeDefined();
    expect(state.context.artifacts.legacyResult.success).toBe(true);
    expect(state.context.artifacts.legacyResult.data.filepath).toBe('legacy_test.txt');

    // File should be created (tool execution works)
    const fileExists = await fs.access('legacy_test.txt')
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  test('should work with new outputs format for selective mapping', async () => {
    // Create BT with NEW outputs format (should work)
    const behaviorTree = {
      type: 'action',
      id: 'new_format_test',
      tool: 'file_write',
      outputs: {
        // Map from result.data fields to artifacts
        filepath: 'savedPath',
        bytesWritten: 'fileSize',
        created: 'wasCreated'
      },
      inputs: {
        filepath: 'new_format_test.txt',
        content: 'New format content'
      }
    };
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Artifacts SHOULD be stored with selective mapping
    const state = executor.getExecutionState();
    expect(state.context.artifacts.savedPath).toBe('new_format_test.txt');
    expect(state.context.artifacts.fileSize).toBe(18); // "New format content".length
    expect(state.context.artifacts.wasCreated).toBe(true);

    // Clean up
    await fs.unlink('new_format_test.txt').catch(() => {});
  });

  test('should prioritize outputs over outputVariable when both are present', async () => {
    // Test that outputs takes precedence over outputVariable when both are present
    const behaviorTree = {
      type: 'action',
      id: 'all_legacy_test',
      tool: 'file_write',
      outputVariable: 'legacyOutput',  // Should be ignored when outputs is also present
      outputs: {
        filepath: 'savedPath',
        created: 'realOutput'
      },
      inputs: {
        filepath: 'all_legacy_test.txt',
        content: 'All legacy test'
      }
    };
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);

    // Only the outputs mapping should work, not outputVariable
    const state = executor.getExecutionState();
    expect(state.context.artifacts.realOutput).toBe(true);
    expect(state.context.artifacts.savedPath).toBe('all_legacy_test.txt');
    expect(state.context.artifacts.legacyOutput).toBeUndefined();

    // Clean up
    await fs.unlink('all_legacy_test.txt').catch(() => {});
  });
});