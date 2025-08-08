import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

describe('BehaviorTreeExecutor', () => {
  let executor;
  let mockToolRegistry;
  let mockTool;

  beforeEach(() => {
    // Create mock tool
    mockTool = {
      name: 'test_tool',
      description: 'Test tool',
      execute: jest.fn().mockResolvedValue({
        success: true,
        output: 'Tool executed successfully'
      })
    };

    // Create mock tool registry
    mockToolRegistry = {
      getTool: jest.fn().mockResolvedValue(mockTool),
      hasTool: jest.fn().mockReturnValue(true)
    };

    executor = new BehaviorTreeExecutor(mockToolRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create executor with tool registry', () => {
      expect(executor.toolRegistry).toBe(mockToolRegistry);
      expect(executor.messageBus).toBeDefined();
      expect(executor.nodeTypes).toBeDefined();
      expect(executor.executionContext).toEqual({});
    });

    test('should register built-in node types', () => {
      expect(executor.nodeTypes.has('action')).toBe(true);
      expect(executor.nodeTypes.has('sequence')).toBe(true);
      expect(executor.nodeTypes.has('selector')).toBe(true);
      expect(executor.nodeTypes.has('retry')).toBe(true);
      expect(executor.nodeTypes.has('condition')).toBe(true);
    });
  });

  describe('createNode', () => {
    test('should create action node with explicit type', async () => {
      const config = {
        type: 'action',
        id: 'test-action',
        tool: 'test_tool',
        description: 'Test action'
      };

      const node = await executor.createNode(config);
      expect(node).toBeDefined();
      expect(mockToolRegistry.getTool).toHaveBeenCalledWith('test_tool');
      expect(config.toolInstance).toBe(mockTool);
    });

    test('should infer action node type from tool presence', async () => {
      const config = {
        id: 'test-action',
        tool: 'test_tool',
        description: 'Test action'
      };

      const node = await executor.createNode(config);
      expect(node).toBeDefined();
      expect(config.toolInstance).toBe(mockTool);
    });

    test('should create sequence node with explicit type', async () => {
      const config = {
        type: 'sequence',
        id: 'test-sequence',
        children: [
          { type: 'action', id: 'child1', tool: 'test_tool' },
          { type: 'action', id: 'child2', tool: 'test_tool' }
        ]
      };

      const node = await executor.createNode(config);
      expect(node).toBeDefined();
    });

    test('should infer sequence node type from children presence', async () => {
      const config = {
        id: 'test-sequence',
        children: [
          { type: 'action', id: 'child1', tool: 'test_tool' },
          { type: 'action', id: 'child2', tool: 'test_tool' }
        ]
      };

      const node = await executor.createNode(config);
      expect(node).toBeDefined();
    });

    test('should create retry node', async () => {
      const config = {
        type: 'retry',
        id: 'test-retry',
        maxAttempts: 3,
        child: {
          type: 'action',
          id: 'retry-child',
          tool: 'test_tool'
        }
      };

      const node = await executor.createNode(config);
      expect(node).toBeDefined();
    });

    test('should create condition node', async () => {
      const config = {
        type: 'condition',
        id: 'test-condition',
        check: 'context.value === true'
      };

      const node = await executor.createNode(config);
      expect(node).toBeDefined();
    });

    test('should throw error for invalid node configuration', async () => {
      const config = {
        id: 'invalid-node'
        // No type, children, or tool
      };

      await expect(executor.createNode(config)).rejects.toThrow(
        'Node configuration must specify type or have children/tool'
      );
    });

    test('should throw error when tool not found', async () => {
      mockToolRegistry.getTool.mockResolvedValue(null);

      const config = {
        type: 'action',
        id: 'test-action',
        tool: 'missing_tool'
      };

      await expect(executor.createNode(config)).rejects.toThrow(
        "Tool 'missing_tool' not found in registry"
      );
    });
  });

  describe('executeTree', () => {
    test('should execute simple action tree successfully', async () => {
      const treeConfig = {
        type: 'action',
        id: 'simple-action',
        tool: 'test_tool',
        params: { input: 'test' }
      };

      const result = await executor.executeTree(treeConfig, { workspaceDir: '/tmp' });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.executionTime).toBeDefined();
      expect(mockTool.execute).toHaveBeenCalledWith({ input: 'test' });
    });

    test('should execute sequence tree successfully', async () => {
      const treeConfig = {
        type: 'sequence',
        id: 'test-sequence',
        children: [
          {
            type: 'action',
            id: 'action1',
            tool: 'test_tool',
            params: { step: 1 }
          },
          {
            type: 'action',
            id: 'action2',
            tool: 'test_tool',
            params: { step: 2 }
          }
        ]
      };

      const result = await executor.executeTree(treeConfig, { workspaceDir: '/tmp' });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(mockTool.execute).toHaveBeenCalledTimes(2);
      expect(mockTool.execute).toHaveBeenCalledWith({ step: 1 });
      expect(mockTool.execute).toHaveBeenCalledWith({ step: 2 });
    });

    test('should handle tool execution failure', async () => {
      mockTool.execute.mockResolvedValue({
        success: false,
        error: 'Tool execution failed'
      });

      const treeConfig = {
        type: 'action',
        id: 'failing-action',
        tool: 'test_tool'
      };

      const result = await executor.executeTree(treeConfig, { workspaceDir: '/tmp' });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILURE');
    });

    test('should handle retry logic', async () => {
      // First two attempts fail, third succeeds
      mockTool.execute
        .mockResolvedValueOnce({ success: false, error: 'Failed attempt 1' })
        .mockResolvedValueOnce({ success: false, error: 'Failed attempt 2' })
        .mockResolvedValueOnce({ success: true, output: 'Success on retry' });

      const treeConfig = {
        type: 'retry',
        id: 'retry-test',
        maxAttempts: 3,
        child: {
          type: 'action',
          id: 'retry-action',
          tool: 'test_tool'
        }
      };

      const result = await executor.executeTree(treeConfig, { workspaceDir: '/tmp' });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(mockTool.execute).toHaveBeenCalledTimes(3);
    });

    test('should emit events during execution', async () => {
      const treeStartSpy = jest.fn();
      const treeCompleteSpy = jest.fn();
      const nodeStartSpy = jest.fn();
      const nodeCompleteSpy = jest.fn();
      const actionExecuteSpy = jest.fn();
      const actionResultSpy = jest.fn();

      executor.on('tree:start', treeStartSpy);
      executor.on('tree:complete', treeCompleteSpy);
      executor.on('node:start', nodeStartSpy);
      executor.on('node:complete', nodeCompleteSpy);
      executor.on('action:execute', actionExecuteSpy);
      executor.on('action:result', actionResultSpy);

      const treeConfig = {
        type: 'action',
        id: 'event-test',
        tool: 'test_tool'
      };

      await executor.executeTree(treeConfig);

      expect(treeStartSpy).toHaveBeenCalled();
      expect(treeCompleteSpy).toHaveBeenCalled();
      expect(nodeStartSpy).toHaveBeenCalled();
      expect(nodeCompleteSpy).toHaveBeenCalled();
      expect(actionExecuteSpy).toHaveBeenCalled();
      expect(actionResultSpy).toHaveBeenCalled();
    });
  });

  describe('countNodes', () => {
    test('should count single action node', () => {
      const config = {
        type: 'action',
        id: 'single-action',
        tool: 'test_tool'
      };

      const count = executor.countNodes(config);
      expect(count).toBe(1);
    });

    test('should count sequence with multiple children', () => {
      const config = {
        type: 'sequence',
        id: 'test-sequence',
        children: [
          { type: 'action', id: 'action1', tool: 'test_tool' },
          { type: 'action', id: 'action2', tool: 'test_tool' },
          {
            type: 'sequence',
            id: 'nested-sequence',
            children: [
              { type: 'action', id: 'action3', tool: 'test_tool' }
            ]
          }
        ]
      };

      const count = executor.countNodes(config);
      expect(count).toBe(5); // root + 2 actions + nested sequence + 1 nested action
    });

    test('should count retry node with child', () => {
      const config = {
        type: 'retry',
        id: 'test-retry',
        child: {
          type: 'action',
          id: 'retry-action',
          tool: 'test_tool'
        }
      };

      const count = executor.countNodes(config);
      expect(count).toBe(2); // retry node + child action
    });
  });

  describe('validateNodeConfiguration', () => {
    test('should validate valid action node', () => {
      const config = {
        type: 'action',
        id: 'valid-action',
        tool: 'test_tool'
      };

      const errors = [];
      const warnings = [];
      executor.validateNodeConfiguration(config, errors, warnings);

      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    test('should detect missing tool in action node', () => {
      const config = {
        type: 'action',
        id: 'invalid-action'
        // Missing tool
      };

      const errors = [];
      const warnings = [];
      executor.validateNodeConfiguration(config, errors, warnings);

      expect(errors).toContain('Action nodes must specify tool');
    });

    test('should validate sequence node with children', () => {
      const config = {
        type: 'sequence',
        id: 'valid-sequence',
        children: [
          { type: 'action', id: 'child1', tool: 'test_tool' }
        ]
      };

      const errors = [];
      const warnings = [];
      executor.validateNodeConfiguration(config, errors, warnings);

      expect(errors).toHaveLength(0);
    });

    test('should detect invalid children array', () => {
      const config = {
        type: 'sequence',
        id: 'invalid-sequence',
        children: 'not-an-array'
      };

      const errors = [];
      const warnings = [];
      executor.validateNodeConfiguration(config, errors, warnings);

      expect(errors).toContain('Node children must be an array');
    });
  });

  describe('getAvailableNodeTypes', () => {
    test('should return all registered node types', () => {
      const nodeTypes = executor.getAvailableNodeTypes();
      
      expect(nodeTypes).toContain('action');
      expect(nodeTypes).toContain('sequence');
      expect(nodeTypes).toContain('selector');
      expect(nodeTypes).toContain('retry');
      expect(nodeTypes).toContain('condition');
    });
  });
});