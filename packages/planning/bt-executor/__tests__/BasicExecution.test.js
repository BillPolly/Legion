/**
 * Basic execution test to verify the executor works
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';

describe('Basic Execution', () => {
  test('executor handles all node types correctly', async () => {
    // Mock tool registry that just succeeds
    const toolRegistry = {
      getTool: async (name) => ({
        execute: async (params) => ({ 
          success: true, 
          data: { tool: name, params } 
        })
      })
    };
    
    const executor = new DebugBehaviorTreeExecutor(toolRegistry);
    
    // The actual Hello World tree structure
    const tree = {
      id: 'root',
      type: 'sequence',
      children: [
        {
          type: 'retry',
          id: 'retry1',
          maxAttempts: 2,
          child: {
            type: 'sequence',
            id: 'seq1',
            children: [
              {
                type: 'action',
                id: 'action1',
                tool: 'test_tool',
                outputVariable: 'result1',
                params: { test: true }
              },
              {
                type: 'condition',
                id: 'cond1',
                check: 'context.artifacts["result1"].success === true'
              }
            ]
          }
        },
        {
          type: 'action',
          id: 'action2',
          tool: 'test_tool2',
          params: { final: true }
        }
      ]
    };
    
    // Initialize
    const init = await executor.initializeTree(tree);
    expect(init.success).toBe(true);
    expect(init.nodeCount).toBe(7); // root + retry1 + seq1 + action1 + cond1 + action2 = 6 + child counted in retry
    
    // Execute
    executor.setMode('run');
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Check that all nodes were executed
    const state = executor.getExecutionState();
    expect(state.nodeStates['action1']).toBe('success');
    expect(state.nodeStates['cond1']).toBe('success');
    expect(state.nodeStates['action2']).toBe('success');
    
    // Check artifacts were stored
    expect(state.context.artifacts.result1).toBeDefined();
    expect(state.context.artifacts.result1.success).toBe(true);
  });
  
  test('step execution works correctly', async () => {
    const toolRegistry = {
      getTool: async () => ({
        execute: async () => ({ success: true, data: {} })
      })
    };
    
    const executor = new DebugBehaviorTreeExecutor(toolRegistry);
    
    const tree = {
      id: 'root',
      type: 'sequence',
      children: [
        { id: 'step1', type: 'action', tool: 'tool1' },
        { id: 'step2', type: 'action', tool: 'tool2' }
      ]
    };
    
    await executor.initializeTree(tree);
    
    // Step through execution
    let result;
    let steps = [];
    
    // Track steps
    executor.on('node:step', (data) => steps.push(data.nodeId));
    
    // Step 1: root sequence
    result = await executor.stepNext();
    expect(result.complete).toBe(false);
    expect(steps).toContain('root');
    
    // Step 2: first action
    result = await executor.stepNext();
    expect(result.complete).toBe(false);
    expect(steps).toContain('step1');
    
    // Step 3: second action
    result = await executor.stepNext();
    expect(result.complete).toBe(false);
    expect(steps).toContain('step2');
    
    // Step 4: complete
    result = await executor.stepNext();
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
  });
});