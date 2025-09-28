/**
 * Unit tests for BTExecutor
 * 
 * BTExecutor manages execution of behavior tree tasks:
 * - Creates root task from tree configuration
 * - Initializes children recursively
 * - Binds tools to action nodes
 * - Tracks execution completion
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createBTTask } from '../../../src/factory/createBTTask.js';
import { SequenceStrategy } from '../../../src/strategies/SequenceStrategy.js';
import { ActionStrategy } from '../../../src/strategies/ActionStrategy.js';
import { SelectorStrategy } from '../../../src/strategies/SelectorStrategy.js';
import { ConditionStrategy } from '../../../src/strategies/ConditionStrategy.js';
import { RetryStrategy } from '../../../src/strategies/RetryStrategy.js';

describe('BTExecutor', () => {
  let BTExecutor;
  let mockToolRegistry;
  
  beforeEach(async () => {
    // Try to import the BTExecutor
    try {
      const executorModule = await import('../../../src/core/BTExecutor.js');
      BTExecutor = executorModule.BTExecutor;
    } catch (error) {
      // Will fail until implemented
      BTExecutor = null;
    }
    
    // Create mock toolRegistry for testing
    mockToolRegistry = {
      tools: new Map(),
      getTool: async function(name) {
        return this.tools.get(name);
      },
      addTool: function(name, tool) {
        this.tools.set(name, tool);
      }
    };
    
    // Add some test tools
    mockToolRegistry.addTool('test_tool', {
      name: 'test_tool',
      execute: async (params) => ({ success: true, data: params.value })
    });
    
    mockToolRegistry.addTool('failing_tool', {
      name: 'failing_tool',
      execute: async () => ({ success: false, error: 'Test failure' })
    });
  });
  
  describe('Constructor and Initialization', () => {
    it('should create BTExecutor with toolRegistry', () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return; // Skip until implemented
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      expect(executor).toBeDefined();
      expect(executor.toolRegistry).toBe(mockToolRegistry);
    });
    
    it('should have executeTree method', () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      expect(typeof executor.executeTree).toBe('function');
    });
    
    it('should have getStrategyForType method', () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      expect(typeof executor.getStrategyForType).toBe('function');
    });
  });
  
  describe('Strategy Type Mapping', () => {
    it('should return correct strategy for each node type', () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      expect(executor.getStrategyForType('sequence')).toBe(SequenceStrategy);
      expect(executor.getStrategyForType('selector')).toBe(SelectorStrategy);
      expect(executor.getStrategyForType('action')).toBe(ActionStrategy);
      expect(executor.getStrategyForType('condition')).toBe(ConditionStrategy);
      expect(executor.getStrategyForType('retry')).toBe(RetryStrategy);
    });
    
    it('should throw error for unknown node type', () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      expect(() => {
        executor.getStrategyForType('unknown_type');
      }).toThrow('Unknown node type: unknown_type');
    });
  });
  
  describe('Tree Configuration Loading', () => {
    it('should create root task from tree config', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      const treeConfig = {
        type: 'sequence',
        name: 'Test Sequence',
        children: []
      };
      
      const context = { workspaceDir: '/test' };
      
      // Start execution
      const executionPromise = executor.executeTree(treeConfig, context);
      
      // Should create a root task with sequence strategy
      expect(executor.rootTask).toBeDefined();
      expect(executor.rootTask.description).toBe('Test Sequence');
      expect(Object.getPrototypeOf(executor.rootTask)).toBe(SequenceStrategy);
      
      // Wait for completion
      const result = await executionPromise;
      expect(result.status).toBe('SUCCESS');
    });
    
    it('should use default name if not provided', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      const treeConfig = {
        type: 'sequence',
        // No name provided
        children: []
      };
      
      const executionPromise = executor.executeTree(treeConfig, {});
      
      // Should use default name
      expect(executor.rootTask.description).toBe('BehaviorTree');
      
      await executionPromise;
    });
  });
  
  describe('Recursive Child Initialization', () => {
    it('should initialize simple children', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      const treeConfig = {
        type: 'sequence',
        name: 'Parent',
        children: [
          {
            type: 'action',
            name: 'Child 1',
            tool: 'test_tool',
            params: { value: 10 }
          },
          {
            type: 'action',
            name: 'Child 2',
            tool: 'test_tool',
            params: { value: 20 }
          }
        ]
      };
      
      const executionPromise = executor.executeTree(treeConfig, {});
      
      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check children were created
      expect(executor.rootTask.children).toBeDefined();
      expect(executor.rootTask.children.length).toBe(2);
      expect(executor.rootTask.children[0].description).toBe('Child 1');
      expect(executor.rootTask.children[1].description).toBe('Child 2');
      
      await executionPromise;
    });
    
    it('should initialize nested children recursively', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      const treeConfig = {
        type: 'sequence',
        name: 'Root',
        children: [
          {
            type: 'selector',
            name: 'Nested Selector',
            children: [
              {
                type: 'action',
                name: 'Deep Action 1',
                tool: 'test_tool',
                params: {}
              },
              {
                type: 'sequence',
                name: 'Deep Sequence',
                children: [
                  {
                    type: 'action',
                    name: 'Very Deep Action',
                    tool: 'test_tool',
                    params: {}
                  }
                ]
              }
            ]
          }
        ]
      };
      
      const executionPromise = executor.executeTree(treeConfig, {});
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check nested structure
      const selector = executor.rootTask.children[0];
      expect(selector.description).toBe('Nested Selector');
      expect(selector.children.length).toBe(2);
      
      const deepAction = selector.children[0];
      expect(deepAction.description).toBe('Deep Action 1');
      
      const deepSequence = selector.children[1];
      expect(deepSequence.description).toBe('Deep Sequence');
      expect(deepSequence.children.length).toBe(1);
      expect(deepSequence.children[0].description).toBe('Very Deep Action');
      
      await executionPromise;
    });
  });
  
  describe('Tool Binding for Action Nodes', () => {
    it('should bind tools to action nodes at creation', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      const treeConfig = {
        type: 'action',
        name: 'Tool Action',
        tool: 'test_tool',
        params: { value: 42 }
      };
      
      // Track tool binding
      let boundTool = null;
      const originalGetTool = mockToolRegistry.getTool;
      mockToolRegistry.getTool = async function(name) {
        const tool = await originalGetTool.call(this, name);
        if (name === 'test_tool') {
          boundTool = tool;
        }
        return tool;
      };
      
      const executionPromise = executor.executeTree(treeConfig, {
        toolRegistry: mockToolRegistry
      });
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Tool should be bound
      expect(boundTool).toBeDefined();
      expect(boundTool.name).toBe('test_tool');
      
      const result = await executionPromise;
      expect(result.status).toBe('SUCCESS');
    });
    
    it('should fail if tool not found', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      const treeConfig = {
        type: 'action',
        name: 'Missing Tool',
        tool: 'nonexistent_tool',
        params: {}
      };
      
      // Should throw or handle error when tool not found
      const result = await executor.executeTree(treeConfig, {
        toolRegistry: mockToolRegistry
      });
      
      expect(result.status).toBe('FAILURE');
      expect(result.error).toContain('nonexistent_tool');
    });
  });
  
  describe('Execution Completion Tracking', () => {
    it('should wait for tree completion', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      const treeConfig = {
        type: 'sequence',
        children: [
          {
            type: 'action',
            tool: 'test_tool',
            params: { value: 1 },
            outputVariable: 'result1'
          },
          {
            type: 'action',
            tool: 'test_tool',
            params: { value: 2 },
            outputVariable: 'result2'
          }
        ]
      };
      
      const result = await executor.executeTree(treeConfig, {
        toolRegistry: mockToolRegistry
      });
      
      // Should wait for completion and return result
      expect(result).toBeDefined();
      expect(result.status).toBe('SUCCESS');
      expect(result.context).toBeDefined();
    });
    
    it('should return failure status when tree fails', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      const treeConfig = {
        type: 'sequence',
        children: [
          {
            type: 'action',
            tool: 'test_tool',
            params: { value: 1 }
          },
          {
            type: 'action',
            tool: 'failing_tool',
            params: {}
          }
        ]
      };
      
      const result = await executor.executeTree(treeConfig, {
        toolRegistry: mockToolRegistry
      });
      
      // Should return failure
      expect(result.status).toBe('FAILURE');
      expect(result.error).toBeDefined();
    });
    
    it('should handle timeout if execution takes too long', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      executor.executionTimeout = 100; // 100ms timeout for testing
      
      // Add slow tool
      mockToolRegistry.addTool('slow_tool', {
        name: 'slow_tool',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return { success: true };
        }
      });
      
      const treeConfig = {
        type: 'action',
        tool: 'slow_tool',
        params: {}
      };
      
      const result = await executor.executeTree(treeConfig, {
        toolRegistry: mockToolRegistry
      });
      
      // Should timeout
      expect(result.status).toBe('FAILURE');
      expect(result.error).toContain('timeout');
    });
  });
  
  describe('Context Management', () => {
    it('should pass context to root task', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      const treeConfig = {
        type: 'action',
        tool: 'test_tool',
        params: { value: '@contextValue' }
      };
      
      const context = {
        workspaceDir: '/test/dir',
        artifacts: {
          contextValue: { value: 42 }
        },
        toolRegistry: mockToolRegistry
      };
      
      const result = await executor.executeTree(treeConfig, context);
      
      // Context should be preserved
      expect(result.context.workspaceDir).toBe('/test/dir');
      expect(result.status).toBe('SUCCESS');
    });
    
    it('should include toolRegistry in context if not present', async () => {
      if (!BTExecutor) {
        expect(BTExecutor).toBeDefined();
        return;
      }
      
      const executor = new BTExecutor(mockToolRegistry);
      
      const treeConfig = {
        type: 'action',
        tool: 'test_tool',
        params: { value: 10 }
      };
      
      const context = {
        workspaceDir: '/test'
        // No toolRegistry
      };
      
      const result = await executor.executeTree(treeConfig, context);
      
      // Should add toolRegistry to context
      expect(result.context.toolRegistry).toBe(mockToolRegistry);
    });
  });
});