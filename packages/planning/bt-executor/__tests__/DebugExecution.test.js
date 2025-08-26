/**
 * Debug test to understand execution flow
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import fs from 'fs/promises';

describe('Debug Execution Flow', () => {
  test('should trace execution path', async () => {
    const testDir = '/tmp/bt-debug-test';
    
    // Simple tree to debug
    const simpleTree = {
      id: 'root',
      type: 'sequence',
      children: [
        {
          id: 'action1',
          type: 'action',
          tool: 'directory_create',
          params: { path: `${testDir}/test` }
        },
        {
          id: 'action2',
          type: 'action', 
          tool: 'file_write',
          params: { 
            filepath: `${testDir}/test/file.txt`,
            content: 'test'
          }
        }
      ]
    };
    
    // Real tools
    const toolRegistry = {
      getTool: async (toolName) => {
        if (toolName === 'directory_create') {
          return {
            execute: async (params) => {
              console.log('TOOL: Creating directory', params.path);
              await fs.mkdir(params.path, { recursive: true });
              return { success: true, data: { path: params.path } };
            }
          };
        }
        if (toolName === 'file_write') {
          return {
            execute: async (params) => {
              console.log('TOOL: Writing file', params.filepath);
              await fs.writeFile(params.filepath, params.content);
              return { success: true, data: { filepath: params.filepath } };
            }
          };
        }
        return null;
      }
    };
    
    const executor = new DebugBehaviorTreeExecutor(toolRegistry);
    
    // Add detailed logging
    executor.on('node:step', (data) => {
      console.log('STEP:', data);
    });
    
    executor.on('node:complete', (data) => {
      console.log('COMPLETE:', data);
    });
    
    await executor.initializeTree(simpleTree);
    
    // Step through
    let step = 1;
    let result;
    do {
      console.log(`\n=== STEP ${step} ===`);
      const state = executor.getExecutionState();
      console.log('Current node:', state.currentNode);
      console.log('Node states:', state.nodeStates);
      
      result = await executor.stepNext();
      console.log('Step result:', result);
      step++;
    } while (!result.complete && step < 10);
    
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
  });
});