/**
 * Simplified test suite for DebugBehaviorTreeExecutor without jest mocking
 * Tests core functionality with manual mocks
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { NodeStatus } from '@legion/actor-bt';

// Manual mock helper
function createMockFunction(returnValue) {
  let calls = [];
  const fn = (...args) => {
    calls.push(args);
    if (typeof returnValue === 'function') {
      return returnValue(...args);
    }
    return returnValue;
  };
  fn.calls = calls;
  fn.wasCalled = () => calls.length > 0;
  fn.callCount = () => calls.length;
  fn.reset = () => { calls = []; fn.calls = calls; };
  return fn;
}

describe('DebugBehaviorTreeExecutor - Core Tests', () => {
  let executor;
  let mockToolRegistry;
  
  beforeEach(() => {
    // Create simple mock tool registry
    mockToolRegistry = {
      getTool: (toolName) => {
        // Return mock tools for specific tools
        if (toolName === 'test_tool') {
          return Promise.resolve({
            execute: (params) => Promise.resolve({
              success: true,
              data: { executed: true, params }
            })
          });
        }
        return Promise.resolve(null);
      }
    };
    
    executor = new DebugBehaviorTreeExecutor(mockToolRegistry);
  });
  
  test('should initialize a simple tree', async () => {
    const tree = {
      id: 'test-tree',
      type: 'sequence',
      children: [
        { id: 'node1', type: 'action', tool: 'test_tool' },
        { id: 'node2', type: 'action', tool: 'test_tool' }
      ]
    };
    
    const result = await executor.initializeTree(tree);
    
    expect(result.success).toBe(true);
    expect(result.treeId).toBe('test-tree');
    expect(result.nodeCount).toBe(3);
    expect(executor.rootNode).toBeDefined();
  });
  
  test('should execute in step mode', async () => {
    const tree = {
      id: 'root',
      type: 'action',
      tool: 'test_tool'
    };
    
    await executor.initializeTree(tree);
    
    const result = await executor.stepNext();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    const state = executor.getExecutionState();
    expect(state.nodeStates['root']).toBe('success');
    expect(state.history.length).toBe(1);
  });
  
  test('should handle breakpoints', async () => {
    executor.addBreakpoint('test-node');
    
    const state = executor.getExecutionState();
    expect(state.breakpoints).toContain('test-node');
    
    executor.removeBreakpoint('test-node');
    const newState = executor.getExecutionState();
    expect(newState.breakpoints).not.toContain('test-node');
  });
  
  test('should reset execution state', async () => {
    const tree = {
      id: 'root',
      type: 'action',
      tool: 'test_tool'
    };
    
    await executor.initializeTree(tree);
    await executor.stepNext();
    
    // Verify execution has progressed
    let state = executor.getExecutionState();
    expect(state.history.length).toBeGreaterThan(0);
    
    // Reset
    executor.reset();
    
    // Verify reset state
    state = executor.getExecutionState();
    expect(state.history).toHaveLength(0);
    expect(state.currentNode).toBeNull();
    expect(state.nodeStates['root']).toBe('pending');
  });
  
  test('should switch execution modes', () => {
    executor.setMode('run');
    expect(executor.getExecutionState().mode).toBe('run');
    
    executor.setMode('step');
    expect(executor.getExecutionState().mode).toBe('step');
  });
  
  test('should count nodes correctly', async () => {
    const complexTree = {
      id: 'root',
      type: 'sequence',
      children: [
        {
          id: 'child1',
          type: 'sequence',
          children: [
            { id: 'grandchild1', type: 'action', tool: 'test_tool' },
            { id: 'grandchild2', type: 'action', tool: 'test_tool' }
          ]
        },
        { id: 'child2', type: 'action', tool: 'test_tool' }
      ]
    };
    
    const result = await executor.initializeTree(complexTree);
    expect(result.nodeCount).toBe(5); // root + child1 + grandchild1 + grandchild2 + child2
  });
  
  test('should track node states', async () => {
    const tree = {
      id: 'test-tree',
      type: 'sequence',
      children: [
        { id: 'node1', type: 'action', tool: 'test_tool' },
        { id: 'node2', type: 'action', tool: 'test_tool' }
      ]
    };
    
    await executor.initializeTree(tree);
    
    const state = executor.getExecutionState();
    expect(state.nodeStates['test-tree']).toBe('pending');
    expect(state.nodeStates['node1']).toBe('pending');
    expect(state.nodeStates['node2']).toBe('pending');
  });
  
  test('should handle tool failures', async () => {
    // Override mock to return failure
    mockToolRegistry.getTool = (toolName) => {
      if (toolName === 'failing_tool') {
        return Promise.resolve({
          execute: () => Promise.resolve({
            success: false,
            error: 'Tool failed'
          })
        });
      }
      return Promise.resolve(null);
    };
    
    const tree = {
      id: 'failing-node',
      type: 'action',
      tool: 'failing_tool'
    };
    
    await executor.initializeTree(tree);
    const result = await executor.stepNext();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(false);
    expect(executor.getNodeState('failing-node')).toBe('failure');
  });
  
  test('should provide execution state', async () => {
    const tree = {
      id: 'test-node',
      type: 'action',
      tool: 'test_tool'
    };
    
    await executor.initializeTree(tree, { customContext: 'test' });
    
    const state = executor.getExecutionState();
    
    expect(state).toMatchObject({
      mode: 'step',
      isPaused: false,
      currentNode: 'test-node',
      breakpoints: [],
      history: [],
      context: expect.objectContaining({
        customContext: 'test'
      })
    });
  });
});