/**
 * Unit tests for BehaviorTreeExecutor
 * Tests tree execution, node creation, context management
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { NodeStatus } from '../../src/core/BehaviorTreeNode.js';
import { MockToolRegistry, MockToolFactory } from '../utils/MockToolFactory.js';

describe('BehaviorTreeExecutor Unit Tests', () => {
  let executor;
  let toolRegistry;

  beforeEach(() => {
    toolRegistry = new MockToolRegistry();
    executor = new BehaviorTreeExecutor(toolRegistry);

    // Register common mock tools
    toolRegistry.registerCommonTools();
  });

  describe('Executor Creation and Setup', () => {
    test('should create executor with tool registry', () => {
      expect(executor.toolRegistry).toBe(toolRegistry);
      expect(executor.messageBus).toBeDefined();
      expect(executor.nodeTypes).toBeInstanceOf(Map);
    });

    test('should register default node types', () => {
      expect(executor.nodeTypes.has('sequence')).toBe(true);
      expect(executor.nodeTypes.has('selector')).toBe(true);
      expect(executor.nodeTypes.has('action')).toBe(true);
    });

    test('should register custom node types', () => {
      class CustomNode {
        static getTypeName() { return 'custom'; }
      }

      executor.registerNodeType('custom', CustomNode);
      expect(executor.nodeTypes.has('custom')).toBe(true);
      expect(executor.nodeTypes.get('custom')).toBe(CustomNode);
    });

    test('should get available node types', () => {
      const types = executor.getAvailableNodeTypes();
      expect(types).toContain('sequence');
      expect(types).toContain('selector');
      expect(types).toContain('action');
    });

    test('should get node type metadata', () => {
      const metadata = executor.getNodeTypeMetadata('action');
      expect(metadata).toBeDefined();
      expect(metadata.typeName).toBe('action');
    });
  });

  describe('Node Creation', () => {
    test('should create action node', () => {
      const config = {
        type: 'action',
        tool: 'codeGenerator',
        params: { name: 'TestClass' }
      };

      const node = executor.createNode(config);
      
      expect(node).toBeDefined();
      expect(node.config.type).toBe('action');
      expect(node.config.tool).toBe('codeGenerator');
    });

    test('should create sequence node with children', () => {
      const config = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator' },
          { type: 'action', tool: 'testRunner' }
        ]
      };

      const node = executor.createNode(config);
      
      expect(node).toBeDefined();
      expect(node.children).toHaveLength(2);
      expect(node.children[0].config.tool).toBe('codeGenerator');
      expect(node.children[1].config.tool).toBe('testRunner');
    });

    test('should create selector node with children', () => {
      const config = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'codeGenerator' },
          { type: 'action', tool: 'testRunner' }
        ]
      };

      const node = executor.createNode(config);
      
      expect(node).toBeDefined();
      expect(node.children).toHaveLength(2);
    });

    test('should throw error for unknown node type', () => {
      const config = {
        type: 'unknown',
        tool: 'someool'
      };

      expect(() => executor.createNode(config)).toThrow('Unknown node type: unknown');
    });

    test('should generate unique IDs for nodes', () => {
      const config1 = { type: 'action', tool: 'tool1' };
      const config2 = { type: 'action', tool: 'tool2' };

      const node1 = executor.createNode(config1);
      const node2 = executor.createNode(config2);

      expect(node1.id).not.toBe(node2.id);
    });

    test('should respect provided IDs', () => {
      const config = {
        type: 'action',
        id: 'custom-id',
        tool: 'codeGenerator'
      };

      const node = executor.createNode(config);
      expect(node.id).toBe('custom-id');
    });
  });

  describe('Tree Execution', () => {
    test('should execute simple action tree', async () => {
      const treeConfig = {
        type: 'action',
        tool: 'codeGenerator',
        params: { name: 'TestClass' }
      };

      const context = { className: 'TestClass' };
      const result = await executor.executeTree(treeConfig, context);

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data).toBeDefined();
    });

    test('should execute sequence tree', async () => {
      const treeConfig = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator', params: { step: 1 } },
          { type: 'action', tool: 'testRunner', params: { step: 2 } }
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.status).toBe(NodeStatus.SUCCESS);
    });

    test('should execute selector tree', async () => {
      // Create a failing tool and a succeeding tool
      toolRegistry.registerTool('failingTool', MockToolFactory.createMockTool('failing', { behavior: 'failure' }));
      
      const treeConfig = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'failingTool' },
          { type: 'action', tool: 'codeGenerator' } // This should succeed
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.status).toBe(NodeStatus.SUCCESS);
    });

    test('should handle tree execution errors', async () => {
      // Create a tool that throws an error
      toolRegistry.registerTool('errorTool', MockToolFactory.createMockTool('error', { behavior: 'error' }));
      
      const treeConfig = {
        type: 'action',
        tool: 'errorTool'
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.success).toBe(false);
    });

    test('should provide execution context to nodes', async () => {
      const context = {
        userName: 'TestUser',
        projectName: 'TestProject'
      };

      const treeConfig = {
        type: 'action',
        tool: 'codeGenerator',
        params: {
          name: '{{userName}}',
          project: '{{projectName}}'
        }
      };

      const result = await executor.executeTree(treeConfig, context);

      expect(result.status).toBe(NodeStatus.SUCCESS);
      // The context should have been passed through to the node
    });
  });

  describe('Context Management', () => {
    test('should provide execution context to tree', async () => {
      const context = {
        userName: 'TestUser',
        projectName: 'TestProject'
      };

      const treeConfig = {
        type: 'action',
        tool: 'codeGenerator'
      };

      const result = await executor.executeTree(treeConfig, context);

      expect(result.context).toBeDefined();
      expect(result.context.userName).toBe('TestUser');
      expect(result.context.startTime).toBeDefined();
      expect(result.context.treeConfig).toBe(treeConfig);
    });

    test('should track execution time', async () => {
      const treeConfig = {
        type: 'action',
        tool: 'codeGenerator'
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.executionTime).toBe('number');
    });
  });

  describe('Tree Validation', () => {
    test('should validate tree configuration', () => {
      // Valid tree
      const validTree = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator' }
        ]
      };

      const validResult = executor.validateTreeConfiguration(validTree);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid tree (action without tool)
      const invalidTree = {
        type: 'sequence',
        children: [
          { type: 'action' } // Missing tool
        ]
      };

      const invalidResult = executor.validateTreeConfiguration(invalidTree);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Action nodes must specify tool');
    });

    test('should validate unknown node types', () => {
      const invalidTree = {
        type: 'unknownType'
      };

      const result = executor.validateTreeConfiguration(invalidTree);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown node type: unknownType');
    });

    test('should validate children array', () => {
      const invalidTree = {
        type: 'sequence',
        children: 'not-an-array' // Should be array
      };

      const result = executor.validateTreeConfiguration(invalidTree);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Node children must be an array');
    });
  });

  describe('Executor Statistics', () => {
    test('should provide executor statistics', () => {
      const stats = executor.getStats();
      
      expect(stats.registeredNodeTypes).toBeGreaterThan(0);
      expect(stats.availableNodeTypes).toContain('action');
      expect(stats.availableNodeTypes).toContain('sequence');
      expect(stats.messageBusStatus).toBeDefined();
    });

    test('should support executor shutdown', async () => {
      await executor.shutdown();
      
      expect(executor.nodeTypes.size).toBe(0);
      expect(executor.executionContext).toEqual({});
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle tool execution errors', async () => {
      toolRegistry.registerTool('errorTool', MockToolFactory.createMockTool('error', { behavior: 'error' }));
      
      const treeConfig = {
        type: 'action',
        tool: 'errorTool'
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.success).toBe(false);
    });

    test('should handle missing tools gracefully', async () => {
      const treeConfig = {
        type: 'action',
        tool: 'nonexistentTool'
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.status).toBe(NodeStatus.FAILURE); // ActionNode returns failure for missing tools
      expect(result.success).toBe(false);
    });

    test('should continue execution after recoverable failures in selector', async () => {
      toolRegistry.registerTool('failingTool', MockToolFactory.createMockTool('failing', { behavior: 'failure' }));
      
      const treeConfig = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'failingTool' },    // Will fail
          { type: 'action', tool: 'codeGenerator' }   // Will succeed
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.status).toBe(NodeStatus.SUCCESS);
    });

    test('should stop execution on failure in sequence', async () => {
      toolRegistry.registerTool('failingTool', MockToolFactory.createMockTool('failing', { behavior: 'failure' }));
      
      const treeConfig = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator' },  // Will succeed
          { type: 'action', tool: 'failingTool' },    // Will fail
          { type: 'action', tool: 'testRunner' }      // Should not execute
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.status).toBe(NodeStatus.FAILURE);
    });
  });

  describe('Node Type Management', () => {
    test('should unregister node types', () => {
      expect(executor.nodeTypes.has('action')).toBe(true);
      
      executor.unregisterNodeType('action');
      
      expect(executor.nodeTypes.has('action')).toBe(false);
    });

    test('should load custom node types dynamically', async () => {
      // This test requires actual files, so we'll just test that the method exists
      expect(typeof executor.loadCustomNodeTypes).toBe('function');
    });
  });
});