/**
 * Comprehensive test suite for DebugBehaviorTreeExecutor
 * Tests all debugging capabilities including step-through, breakpoints, and state inspection
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { NodeStatus } from '@legion/actor-bt';

describe('DebugBehaviorTreeExecutor', () => {
  let executor;
  let mockToolRegistry;
  
  beforeEach(() => {
    // Create mock tool registry
    mockToolRegistry = {
      getTool: jest.fn()
    };
    
    executor = new DebugBehaviorTreeExecutor(mockToolRegistry);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Tree Initialization', () => {
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
      expect(result.nodeCount).toBe(3); // Root + 2 children
      expect(executor.rootNode).toBeDefined();
      expect(executor.tree).toBe(tree);
    });
    
    test('should initialize all node states to pending', async () => {
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
    
    test('should emit tree:initialized event', async () => {
      const tree = {
        id: 'test-tree',
        type: 'action',
        tool: 'test_tool'
      };
      
      const initListener = jest.fn();
      executor.on('tree:initialized', initListener);
      
      await executor.initializeTree(tree);
      
      expect(initListener).toHaveBeenCalledWith(
        expect.objectContaining({
          treeId: 'test-tree',
          nodeCount: 1,
          mode: 'step'
        })
      );
    });
  });
  
  describe('Step-through Execution', () => {
    test('should execute one node at a time in step mode', async () => {
      const tree = {
        id: 'root',
        type: 'sequence',
        children: [
          { id: 'node1', type: 'action', tool: 'test_tool' },
          { id: 'node2', type: 'action', tool: 'test_tool' }
        ]
      };
      
      // Mock tool execution
      mockToolRegistry.getTool.mockResolvedValue({
        execute: jest.fn().mockResolvedValue({
          success: true,
          data: { message: 'executed' }
        })
      });
      
      await executor.initializeTree(tree);
      
      // First step should execute root node
      const step1 = await executor.stepNext();
      expect(step1.complete).toBe(false);
      expect(executor.getNodeState('root')).toBe('success');
      
      // Second step should execute first child
      const step2 = await executor.stepNext();
      expect(step2.complete).toBe(false);
      expect(executor.getNodeState('node1')).toBe('success');
      
      // Third step should execute second child
      const step3 = await executor.stepNext();
      expect(step3.complete).toBe(true);
      expect(step3.success).toBe(true);
      expect(executor.getNodeState('node2')).toBe('success');
    });
    
    test('should update execution history', async () => {
      const tree = {
        id: 'root',
        type: 'action',
        tool: 'test_tool'
      };
      
      mockToolRegistry.getTool.mockResolvedValue({
        execute: jest.fn().mockResolvedValue({
          success: true,
          data: { result: 'test' }
        })
      });
      
      await executor.initializeTree(tree);
      await executor.stepNext();
      
      const state = executor.getExecutionState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]).toMatchObject({
        nodeId: 'root',
        nodeType: 'action',
        status: NodeStatus.SUCCESS
      });
    });
    
    test('should emit node events during execution', async () => {
      const tree = {
        id: 'test-node',
        type: 'action',
        tool: 'test_tool'
      };
      
      mockToolRegistry.getTool.mockResolvedValue({
        execute: jest.fn().mockResolvedValue({ success: true, data: {} })
      });
      
      const stepListener = jest.fn();
      const completeListener = jest.fn();
      
      executor.on('node:step', stepListener);
      executor.on('node:complete', completeListener);
      
      await executor.initializeTree(tree);
      await executor.stepNext();
      
      expect(stepListener).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'test-node',
          nodeType: 'action'
        })
      );
      
      expect(completeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'test-node',
          status: NodeStatus.SUCCESS
        })
      );
    });
  });
  
  describe('Breakpoint Functionality', () => {
    test('should add and remove breakpoints', () => {
      executor.addBreakpoint('node1');
      executor.addBreakpoint('node2');
      
      let state = executor.getExecutionState();
      expect(state.breakpoints).toContain('node1');
      expect(state.breakpoints).toContain('node2');
      
      executor.removeBreakpoint('node1');
      
      state = executor.getExecutionState();
      expect(state.breakpoints).not.toContain('node1');
      expect(state.breakpoints).toContain('node2');
    });
    
    test('should emit breakpoint events', () => {
      const addListener = jest.fn();
      const removeListener = jest.fn();
      
      executor.on('breakpoint:added', addListener);
      executor.on('breakpoint:removed', removeListener);
      
      executor.addBreakpoint('test-node');
      expect(addListener).toHaveBeenCalledWith({ nodeId: 'test-node' });
      
      executor.removeBreakpoint('test-node');
      expect(removeListener).toHaveBeenCalledWith({ nodeId: 'test-node' });
    });
    
    test('should pause at breakpoints in run mode', async () => {
      const tree = {
        id: 'root',
        type: 'sequence',
        children: [
          { id: 'node1', type: 'action', tool: 'test_tool' },
          { id: 'node2', type: 'action', tool: 'test_tool' },
          { id: 'node3', type: 'action', tool: 'test_tool' }
        ]
      };
      
      mockToolRegistry.getTool.mockResolvedValue({
        execute: jest.fn().mockResolvedValue({ success: true, data: {} })
      });
      
      await executor.initializeTree(tree);
      
      // Set breakpoint on node2
      executor.addBreakpoint('node2');
      
      const breakpointListener = jest.fn();
      executor.on('breakpoint:hit', breakpointListener);
      
      // Start run mode execution
      executor.setMode('run');
      const runPromise = executor.runToCompletion();
      
      // Wait a bit for execution to reach breakpoint
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should have hit breakpoint
      expect(breakpointListener).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'node2'
        })
      );
      
      // Resume execution
      executor.resume();
      
      const result = await runPromise;
      expect(result.complete).toBe(true);
      expect(result.success).toBe(true);
    });
  });
  
  describe('Pause/Resume Functionality', () => {
    test('should pause and resume execution', async () => {
      const tree = {
        id: 'root',
        type: 'sequence',
        children: [
          { id: 'node1', type: 'action', tool: 'test_tool' },
          { id: 'node2', type: 'action', tool: 'test_tool' }
        ]
      };
      
      mockToolRegistry.getTool.mockResolvedValue({
        execute: jest.fn().mockResolvedValue({ success: true, data: {} })
      });
      
      await executor.initializeTree(tree);
      
      const pauseListener = jest.fn();
      const resumeListener = jest.fn();
      
      executor.on('execution:paused', pauseListener);
      executor.on('execution:resumed', resumeListener);
      
      executor.setMode('run');
      const runPromise = executor.runToCompletion();
      
      // Pause after a short delay
      setTimeout(() => executor.pause(), 50);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(pauseListener).toHaveBeenCalled();
      expect(executor.getExecutionState().isPaused).toBe(true);
      
      // Resume
      executor.resume();
      
      expect(resumeListener).toHaveBeenCalled();
      
      const result = await runPromise;
      expect(result.complete).toBe(true);
    });
  });
  
  describe('Reset Functionality', () => {
    test('should reset execution state', async () => {
      const tree = {
        id: 'root',
        type: 'action',
        tool: 'test_tool'
      };
      
      mockToolRegistry.getTool.mockResolvedValue({
        execute: jest.fn().mockResolvedValue({ success: true, data: {} })
      });
      
      await executor.initializeTree(tree);
      await executor.stepNext();
      
      // Verify execution has progressed
      let state = executor.getExecutionState();
      expect(state.history.length).toBeGreaterThan(0);
      expect(state.nodeStates['root']).toBe('success');
      
      // Reset
      const resetListener = jest.fn();
      executor.on('execution:reset', resetListener);
      executor.reset();
      
      expect(resetListener).toHaveBeenCalled();
      
      // Verify reset state
      state = executor.getExecutionState();
      expect(state.history).toHaveLength(0);
      expect(state.nodeStates['root']).toBe('pending');
      expect(state.currentNode).toBeNull();
    });
  });
  
  describe('Execution State Management', () => {
    test('should track execution stack', async () => {
      const tree = {
        id: 'root',
        type: 'sequence',
        children: [
          {
            id: 'child1',
            type: 'sequence',
            children: [
              { id: 'grandchild1', type: 'action', tool: 'test_tool' }
            ]
          }
        ]
      };
      
      mockToolRegistry.getTool.mockResolvedValue({
        execute: jest.fn().mockResolvedValue({ success: true, data: {} })
      });
      
      await executor.initializeTree(tree);
      
      // Step into nested structure
      await executor.stepNext(); // root
      
      const state = executor.getExecutionState();
      expect(state.executionStack).toContain('root');
    });
    
    test('should provide complete execution state', async () => {
      const tree = {
        id: 'test-tree',
        type: 'action',
        tool: 'test_tool'
      };
      
      await executor.initializeTree(tree, { testContext: 'value' });
      
      executor.addBreakpoint('test-node');
      executor.setMode('run');
      
      const state = executor.getExecutionState();
      
      expect(state).toMatchObject({
        mode: 'run',
        isPaused: false,
        currentNode: 'test-tree',
        breakpoints: ['test-node'],
        history: [],
        context: expect.objectContaining({
          testContext: 'value'
        })
      });
    });
  });
  
  describe('Error Handling', () => {
    test('should handle tool execution failures', async () => {
      const tree = {
        id: 'failing-node',
        type: 'action',
        tool: 'failing_tool'
      };
      
      mockToolRegistry.getTool.mockResolvedValue({
        execute: jest.fn().mockResolvedValue({
          success: false,
          error: 'Tool execution failed'
        })
      });
      
      const errorListener = jest.fn();
      executor.on('node:error', errorListener);
      
      await executor.initializeTree(tree);
      const result = await executor.stepNext();
      
      expect(result.complete).toBe(true);
      expect(result.success).toBe(false);
      expect(executor.getNodeState('failing-node')).toBe('failure');
    });
    
    test('should handle missing tools', async () => {
      const tree = {
        id: 'missing-tool-node',
        type: 'action',
        tool: 'non_existent_tool'
      };
      
      mockToolRegistry.getTool.mockResolvedValue(null);
      
      await executor.initializeTree(tree);
      const result = await executor.stepNext();
      
      expect(result.complete).toBe(true);
      expect(result.success).toBe(false);
      expect(executor.getNodeState('missing-tool-node')).toBe('failure');
    });
    
    test('should throw error when executing without initialization', async () => {
      await expect(executor.execute()).rejects.toThrow('Tree not initialized');
      await expect(executor.stepNext()).rejects.toThrow('Tree not initialized');
    });
  });
  
  describe('Mode Switching', () => {
    test('should switch between step and run modes', () => {
      const modeListener = jest.fn();
      executor.on('mode:changed', modeListener);
      
      executor.setMode('run');
      expect(modeListener).toHaveBeenCalledWith({ mode: 'run' });
      expect(executor.getExecutionState().mode).toBe('run');
      
      executor.setMode('step');
      expect(modeListener).toHaveBeenCalledWith({ mode: 'step' });
      expect(executor.getExecutionState().mode).toBe('step');
    });
    
    test('should throw error for invalid mode', () => {
      expect(() => executor.setMode('invalid')).toThrow('Invalid mode: invalid');
    });
  });
  
  describe('Complex Tree Structures', () => {
    test('should handle retry nodes', async () => {
      const tree = {
        id: 'root',
        type: 'retry',
        maxAttempts: 3,
        child: {
          id: 'action-node',
          type: 'action',
          tool: 'test_tool'
        }
      };
      
      let attemptCount = 0;
      mockToolRegistry.getTool.mockResolvedValue({
        execute: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            return Promise.resolve({ success: false, error: 'Failed' });
          }
          return Promise.resolve({ success: true, data: {} });
        })
      });
      
      await executor.initializeTree(tree);
      executor.setMode('run');
      const result = await executor.runToCompletion();
      
      expect(result.complete).toBe(true);
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2); // Failed once, succeeded on second try
    });
    
    test('should handle condition nodes', async () => {
      const tree = {
        id: 'root',
        type: 'sequence',
        children: [
          {
            id: 'set-value',
            type: 'action',
            tool: 'set_tool',
            outputVariable: 'testValue'
          },
          {
            id: 'check-value',
            type: 'condition',
            check: 'context.artifacts["testValue"].value === 42'
          }
        ]
      };
      
      mockToolRegistry.getTool.mockImplementation((toolName) => {
        if (toolName === 'set_tool') {
          return Promise.resolve({
            execute: jest.fn().mockResolvedValue({
              success: true,
              data: { value: 42 }
            })
          });
        }
        return Promise.resolve(null);
      });
      
      await executor.initializeTree(tree);
      executor.setMode('run');
      const result = await executor.runToCompletion();
      
      expect(result.complete).toBe(true);
      expect(result.success).toBe(true);
    });
  });
});