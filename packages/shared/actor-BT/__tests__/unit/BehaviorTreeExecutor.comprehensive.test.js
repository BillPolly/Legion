/**
 * Comprehensive BehaviorTreeExecutor Tests
 * 
 * These tests thoroughly exercise the BehaviorTreeExecutor with:
 * - Different node types (action, sequence, selector, retry, condition)
 * - Tool integration and execution
 * - Event emission and progress tracking
 * - Error handling and recovery
 * - Tree validation and configuration
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { NodeStatus } from '../../src/core/BehaviorTreeNode.js';

describe('BehaviorTreeExecutor - Comprehensive Tests', () => {
  let executor;
  let mockToolRegistry;
  let mockTool;
  let eventsSpy;

  beforeEach(() => {
    // Create mock tool that can succeed or fail
    mockTool = {
      name: 'test_tool',
      execute: jest.fn().mockResolvedValue({ success: true, message: 'Tool executed', data: 'test result' }),
      getMetadata: jest.fn().mockResolvedValue({ 
        name: 'test_tool',
        description: 'Test tool',
        input: { type: 'object', properties: {} }
      })
    };

    // Create mock tool registry
    mockToolRegistry = {
      getTool: jest.fn().mockResolvedValue(mockTool),
      getAllTools: jest.fn().mockReturnValue([mockTool])
    };

    // Create executor
    executor = new BehaviorTreeExecutor(mockToolRegistry);

    // Set up event spy
    eventsSpy = {
      'tree:start': jest.fn(),
      'tree:complete': jest.fn(),
      'tree:error': jest.fn()
    };

    Object.keys(eventsSpy).forEach(event => {
      executor.on(event, eventsSpy[event]);
    });
  });

  afterEach(async () => {
    if (executor) {
      await executor.shutdown();
    }
  });

  describe('Basic Executor Functionality', () => {
    test('should initialize with correct node types', () => {
      const availableTypes = executor.getAvailableNodeTypes();
      
      expect(availableTypes).toContain('action');
      expect(availableTypes).toContain('sequence');
      expect(availableTypes).toContain('selector');
      expect(availableTypes).toContain('retry');
      expect(availableTypes).toContain('condition');
    });

    test('should provide node type metadata', () => {
      const actionMetadata = executor.getNodeTypeMetadata('action');
      
      expect(actionMetadata).toEqual({
        typeName: 'action',
        className: 'ActionNode',
        description: 'action coordination node'
      });
    });

    test('should count nodes correctly in tree configuration', () => {
      const treeConfig = {
        type: 'sequence',
        id: 'root',
        children: [
          { type: 'action', id: 'action1', tool: 'test_tool' },
          { type: 'action', id: 'action2', tool: 'test_tool' },
          {
            type: 'sequence',
            id: 'nested',
            children: [
              { type: 'action', id: 'action3', tool: 'test_tool' }
            ]
          }
        ]
      };

      const nodeCount = executor.countNodes(treeConfig);
      expect(nodeCount).toBe(5); // root + 2 actions + nested sequence + 1 action
    });
  });

  describe('Simple Action Node Execution', () => {
    test('should execute single action node successfully', async () => {
      const treeConfig = {
        type: 'action',
        id: 'test-action',
        tool: 'test_tool',
        params: { input: 'test' }
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(true);
      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(mockToolRegistry.getTool).toHaveBeenCalledWith('test_tool');
      expect(mockTool.execute).toHaveBeenCalledWith({ input: 'test' });
      expect(eventsSpy['tree:start']).toHaveBeenCalled();
      expect(eventsSpy['tree:complete']).toHaveBeenCalled();
    });

    test('should handle action node failure', async () => {
      mockTool.execute.mockRejectedValue(new Error('Tool execution failed'));

      const treeConfig = {
        type: 'action',
        id: 'failing-action',
        tool: 'test_tool'
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(false);
      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.error).toContain('Tool execution failed');
    });

    test('should handle missing tool', async () => {
      mockToolRegistry.getTool.mockResolvedValue(null);

      const treeConfig = {
        type: 'action',
        id: 'missing-tool-action',
        tool: 'nonexistent_tool'
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool \'nonexistent_tool\' not found');
    });
  });

  describe('Sequence Node Execution', () => {
    test('should execute sequence nodes in order', async () => {
      const executionOrder = [];
      mockTool.execute = jest.fn().mockImplementation(async (params) => {
        executionOrder.push(params.step);
        return { success: true, data: `step-${params.step}-result` };
      });

      const treeConfig = {
        type: 'sequence',
        id: 'test-sequence',
        children: [
          { type: 'action', id: 'step1', tool: 'test_tool', params: { step: 1 } },
          { type: 'action', id: 'step2', tool: 'test_tool', params: { step: 2 } },
          { type: 'action', id: 'step3', tool: 'test_tool', params: { step: 3 } }
        ]
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual([1, 2, 3]);
      expect(mockTool.execute).toHaveBeenCalledTimes(3);
    });

    test('should fail sequence if any child fails', async () => {
      let callCount = 0;
      mockTool.execute = jest.fn().mockImplementation(async (params) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Second step failed');
        }
        return { success: true, data: `step-${callCount}-result` };
      });

      const treeConfig = {
        type: 'sequence',
        id: 'failing-sequence',
        children: [
          { type: 'action', id: 'step1', tool: 'test_tool' },
          { type: 'action', id: 'step2', tool: 'test_tool' },
          { type: 'action', id: 'step3', tool: 'test_tool' }
        ]
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(false);
      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(mockTool.execute).toHaveBeenCalledTimes(2); // Should stop at failure
    });
  });

  describe('Selector Node Execution', () => {
    test('should succeed on first successful child', async () => {
      let callCount = 0;
      mockTool.execute = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { success: true, data: 'first-success' };
        }
        return { success: false, error: 'should not reach here' };
      });

      const treeConfig = {
        type: 'selector',
        id: 'test-selector',
        children: [
          { type: 'action', id: 'option1', tool: 'test_tool' },
          { type: 'action', id: 'option2', tool: 'test_tool' },
          { type: 'action', id: 'option3', tool: 'test_tool' }
        ]
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(true);
      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(mockTool.execute).toHaveBeenCalledTimes(1); // Should stop at first success
    });

    test('should try all children if they fail', async () => {
      let callCount = 0;
      mockTool.execute = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error(`Attempt ${callCount} failed`);
        }
        return { success: true, data: 'final-success' };
      });

      const treeConfig = {
        type: 'selector',
        id: 'persistent-selector',
        children: [
          { type: 'action', id: 'option1', tool: 'test_tool' },
          { type: 'action', id: 'option2', tool: 'test_tool' },
          { type: 'action', id: 'option3', tool: 'test_tool' }
        ]
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('Retry Node Execution', () => {
    test('should retry failed actions', async () => {
      let attemptCount = 0;
      mockTool.execute = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return { success: true, data: 'retry-success' };
      });

      const treeConfig = {
        type: 'retry',
        id: 'retry-node',
        maxAttempts: 3,
        child: {
          type: 'action',
          id: 'retry-action',
          tool: 'test_tool'
        }
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledTimes(3);
    });

    test('should fail after max attempts', async () => {
      mockTool.execute = jest.fn().mockRejectedValue(new Error('Always fails'));

      const treeConfig = {
        type: 'retry',
        id: 'failing-retry',
        maxAttempts: 2,
        child: {
          type: 'action',
          id: 'failing-action',
          tool: 'test_tool'
        }
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(false);
      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(mockTool.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('Condition Node Execution', () => {
    test('should evaluate simple condition', async () => {
      const treeConfig = {
        type: 'condition',
        id: 'test-condition',
        check: 'context.value > 10',
        params: { value: 15 }
      };

      const result = await executor.executeTree(treeConfig, { value: 15 });

      expect(result.success).toBe(true);
      expect(result.status).toBe(NodeStatus.SUCCESS);
    });

    test('should fail when condition is false', async () => {
      const treeConfig = {
        type: 'condition',
        id: 'failing-condition',
        check: 'context.value > 10',
        params: { value: 5 }
      };

      const result = await executor.executeTree(treeConfig, { value: 5 });

      expect(result.success).toBe(false);
      expect(result.status).toBe(NodeStatus.FAILURE);
    });
  });

  describe('Complex Tree Structures', () => {
    test('should execute nested sequences and selectors', async () => {
      const executionLog = [];
      mockTool.execute = jest.fn().mockImplementation(async (params) => {
        executionLog.push(params.name);
        if (params.shouldFail) {
          throw new Error('Intentional failure');
        }
        return { success: true, data: `${params.name}-result` };
      });

      const treeConfig = {
        type: 'sequence',
        id: 'root',
        children: [
          {
            type: 'action',
            id: 'setup',
            tool: 'test_tool',
            params: { name: 'setup' }
          },
          {
            type: 'selector',
            id: 'alternatives',
            children: [
              {
                type: 'action',
                id: 'option1',
                tool: 'test_tool',
                params: { name: 'option1', shouldFail: true }
              },
              {
                type: 'action',
                id: 'option2',
                tool: 'test_tool',
                params: { name: 'option2' }
              }
            ]
          },
          {
            type: 'action',
            id: 'cleanup',
            tool: 'test_tool',
            params: { name: 'cleanup' }
          }
        ]
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(true);
      expect(executionLog).toEqual(['setup', 'option1', 'option2', 'cleanup']);
    });
  });

  describe('Event System', () => {
    test('should emit tree lifecycle events', async () => {
      const treeConfig = {
        type: 'action',
        id: 'event-test',
        tool: 'test_tool'
      };

      await executor.executeTree(treeConfig);

      expect(eventsSpy['tree:start']).toHaveBeenCalledWith(
        expect.objectContaining({
          treeId: 'event-test',
          treeName: expect.any(String),
          nodeCount: 1
        })
      );

      expect(eventsSpy['tree:complete']).toHaveBeenCalledWith(
        expect.objectContaining({
          treeId: 'event-test',
          success: true,
          status: NodeStatus.SUCCESS,
          executionTime: expect.any(Number)
        })
      );
    });

    test('should emit error events on failure', async () => {
      mockTool.execute.mockRejectedValue(new Error('Test error'));

      const treeConfig = {
        type: 'action',
        id: 'error-test',
        tool: 'test_tool'
      };

      await executor.executeTree(treeConfig);

      expect(eventsSpy['tree:error']).toHaveBeenCalledWith(
        expect.objectContaining({
          treeId: 'error-test',
          error: expect.stringContaining('Test error'),
          executionTime: expect.any(Number)
        })
      );
    });
  });

  describe('Tree Validation', () => {
    test('should validate correct tree configuration', () => {
      const treeConfig = {
        type: 'sequence',
        id: 'valid-tree',
        children: [
          { type: 'action', id: 'action1', tool: 'test_tool' }
        ]
      };

      const validation = executor.validateTreeConfiguration(treeConfig);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid node types', () => {
      const treeConfig = {
        type: 'invalid_type',
        id: 'invalid-tree'
      };

      const validation = executor.validateTreeConfiguration(treeConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Unknown node type: invalid_type');
    });

    test('should detect missing action tool', () => {
      const treeConfig = {
        type: 'action',
        id: 'no-tool-action'
        // Missing tool property
      };

      const validation = executor.validateTreeConfiguration(treeConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Action nodes must specify tool');
    });
  });

  describe('Node Type Registration', () => {
    test('should register custom node type', () => {
      class CustomNode {
        static getTypeName() {
          return 'custom';
        }
      }

      executor.registerNodeType('custom', CustomNode);

      const types = executor.getAvailableNodeTypes();
      expect(types).toContain('custom');
    });

    test('should prevent registration of mismatched node types', () => {
      class MismatchedNode {
        static getTypeName() {
          return 'different';
        }
      }

      expect(() => {
        executor.registerNodeType('custom', MismatchedNode);
      }).toThrow('Type name mismatch');
    });

    test('should unregister node types', () => {
      class TemporaryNode {
        static getTypeName() {
          return 'temporary';
        }
      }

      executor.registerNodeType('temporary', TemporaryNode);
      expect(executor.getAvailableNodeTypes()).toContain('temporary');

      executor.unregisterNodeType('temporary');
      expect(executor.getAvailableNodeTypes()).not.toContain('temporary');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle tool registry failures gracefully', async () => {
      mockToolRegistry.getTool.mockRejectedValue(new Error('Registry failure'));

      const treeConfig = {
        type: 'action',
        id: 'registry-failure',
        tool: 'test_tool'
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Registry failure');
    });

    test('should handle malformed tree configurations', async () => {
      const treeConfig = null;

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should provide statistics', () => {
      const stats = executor.getStats();

      expect(stats).toEqual({
        registeredNodeTypes: expect.any(Number),
        availableNodeTypes: expect.any(Array),
        messageBusStatus: expect.any(Object)
      });
    });
  });

  describe('Node Type Inference', () => {
    test('should infer action type from tool presence', async () => {
      const treeConfig = {
        id: 'inferred-action',
        tool: 'test_tool' // No explicit type, but has tool
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalled();
    });

    test('should infer sequence type from children presence', async () => {
      const treeConfig = {
        id: 'inferred-sequence',
        // No explicit type, but has children
        children: [
          { type: 'action', id: 'child1', tool: 'test_tool' },
          { type: 'action', id: 'child2', tool: 'test_tool' }
        ]
      };

      const result = await executor.executeTree(treeConfig);

      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('Context and Parameter Resolution', () => {
    test('should pass execution context to actions', async () => {
      const treeConfig = {
        type: 'action',
        id: 'context-test',
        tool: 'test_tool',
        params: { input: 'test-value' }
      };

      const executionContext = {
        workspaceDir: '/test/workspace',
        sessionId: 'test-session',
        customData: 'context-data'
      };

      await executor.executeTree(treeConfig, executionContext);

      expect(mockTool.execute).toHaveBeenCalledWith({ input: 'test-value' });
    });
  });
});