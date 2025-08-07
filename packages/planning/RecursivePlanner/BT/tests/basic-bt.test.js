/**
 * Basic Behavior Tree Test
 * Tests core BT functionality with simple mock tools
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { BehaviorTreeExecutor } from '../src/core/BehaviorTreeExecutor.js';
import { SequenceNode } from '../src/nodes/SequenceNode.js';
import { ActionNode } from '../src/nodes/ActionNode.js';
import { SelectorNode } from '../src/nodes/SelectorNode.js';
import { NodeStatus } from '../src/core/BehaviorTreeNode.js';

// Mock ToolRegistry
class MockToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  async getTool(toolName) {
    return this.tools.get(toolName);
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
  }
}

// Mock tools with schema support
const createMockTool = (name, behavior = 'success', schema = null) => ({
  name,
  async execute(params) {
    console.log(`[MockTool:${name}] Executing with params:`, params);
    
    if (behavior === 'success') {
      return {
        success: true,
        data: { 
          result: `${name} completed successfully`,
          params,
          toolName: name
        }
      };
    } else if (behavior === 'failure') {
      return {
        success: false,
        data: { 
          error: `${name} failed`,
          toolName: name
        }
      };
    }
  },
  getMetadata() {
    return {
      name,
      description: `Mock tool ${name}`,
      input: schema?.input,
      output: schema?.output
    };
  }
});

describe('Behavior Tree Core Implementation', () => {
  let executor;
  let toolRegistry;

  beforeEach(() => {
    toolRegistry = new MockToolRegistry();
    executor = new BehaviorTreeExecutor(toolRegistry);

    // Register built-in node types
    executor.registerNodeType('sequence', SequenceNode);
    executor.registerNodeType('selector', SelectorNode);
    executor.registerNodeType('action', ActionNode);

    // Register mock tools
    toolRegistry.registerTool('codeGenerator', createMockTool('codeGenerator', 'success', {
      input: {
        className: { type: 'string', required: true },
        methods: { type: 'array', default: [] }
      },
      output: {
        code: { type: 'string' },
        status: { type: 'string' }
      }
    }));

    toolRegistry.registerTool('testRunner', createMockTool('testRunner', 'success'));
    toolRegistry.registerTool('unreliableTool', createMockTool('unreliableTool', 'failure'));
  });

  describe('BehaviorTreeExecutor', () => {
    test('should create and register node types', () => {
      const availableTypes = executor.getAvailableNodeTypes();
      expect(availableTypes).toContain('sequence');
      expect(availableTypes).toContain('selector');
      expect(availableTypes).toContain('action');
    });

    test('should create nodes from configuration', () => {
      const nodeConfig = {
        type: 'action',
        tool: 'codeGenerator',
        params: { className: 'TestClass' }
      };

      const node = executor.createNode(nodeConfig);
      expect(node).toBeInstanceOf(ActionNode);
      expect(node.toolName).toBe('codeGenerator');
    });

    test('should validate tree configuration', () => {
      const validConfig = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator' }
        ]
      };

      const result = executor.validateTreeConfiguration(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid tree configuration', () => {
      const invalidConfig = {
        type: 'action'
        // Missing required 'tool' property
      };

      const result = executor.validateTreeConfiguration(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Action nodes must specify tool');
    });
  });

  describe('ActionNode', () => {
    test('should execute tool successfully', async () => {
      const nodeConfig = {
        type: 'action',
        tool: 'codeGenerator',
        params: { className: 'TestClass', methods: ['test1', 'test2'] }
      };

      const node = executor.createNode(nodeConfig);
      const result = await node.execute({ artifacts: {} });

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.toolResult.success).toBe(true);
      expect(result.toolResult.data.result).toContain('codeGenerator completed');
    });

    test('should handle missing tool', async () => {
      const nodeConfig = {
        type: 'action',
        tool: 'nonexistentTool'
      };

      const node = executor.createNode(nodeConfig);
      const result = await node.execute({});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.error).toContain('Tool not found');
    });

    test('should validate tool input schema', async () => {
      const nodeConfig = {
        type: 'action',
        tool: 'codeGenerator',
        // Missing required className parameter
        params: { methods: ['test1'] }
      };

      const node = executor.createNode(nodeConfig);
      const result = await node.execute({});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.error).toContain('Missing required tool inputs');
      expect(result.data.missingInputs).toContain('className');
    });

    test('should transform context to tool parameters', async () => {
      const nodeConfig = {
        type: 'action',
        tool: 'codeGenerator',
        params: { className: '{{userClass}}', methods: ['{{method1}}', 'test2'] }
      };

      const node = executor.createNode(nodeConfig);
      const result = await node.execute({ 
        userClass: 'UserManager',
        method1: 'authenticate'
      });

      expect(result.status).toBe(NodeStatus.SUCCESS);
      const executedParams = result.toolResult.data.params;
      expect(executedParams.className).toBe('UserManager');
      expect(executedParams.methods[0]).toBe('authenticate');
    });
  });

  describe('SequenceNode', () => {
    test('should execute children in sequence successfully', async () => {
      const treeConfig = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator', params: { className: 'Test' } },
          { type: 'action', tool: 'testRunner', params: {} }
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.success).toBe(true);
      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.results).toHaveLength(2);
      expect(result.data.completedSteps).toBe(2);
    });

    test('should fail fast on first child failure', async () => {
      const treeConfig = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'unreliableTool' },
          { type: 'action', tool: 'testRunner' }
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.success).toBe(false);
      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.failedAt).toBe(0);
      expect(result.data.completedSteps).toBe(1);
    });

    test('should pass context between steps', async () => {
      const treeConfig = {
        type: 'sequence',
        stepNames: ['generate', 'test'],
        children: [
          { type: 'action', tool: 'codeGenerator', params: { className: 'Test' } },
          { type: 'action', tool: 'testRunner', params: { code: '{{generate.result}}' } }
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.success).toBe(true);
      expect(result.context.generate).toBeDefined();
      expect(result.context.stepResults).toHaveLength(2);
    });
  });

  describe('SelectorNode', () => {
    test('should succeed with first working option', async () => {
      const treeConfig = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'codeGenerator', params: { className: 'Test' } },
          { type: 'action', tool: 'testRunner' }
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.success).toBe(true);
      expect(result.data.successfulOption).toBe(0);
      expect(result.data.attemptedOptions).toBe(1);
    });

    test('should try fallback options on failure', async () => {
      const treeConfig = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'unreliableTool' },
          { type: 'action', tool: 'codeGenerator', params: { className: 'Fallback' } }
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.success).toBe(true);
      expect(result.data.successfulOption).toBe(1);
      expect(result.data.attemptedOptions).toBe(2);
    });

    test('should fail when all options fail', async () => {
      const treeConfig = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'unreliableTool' },
          { type: 'action', tool: 'unreliableTool' }
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.success).toBe(false);
      expect(result.data.allOptionsFailed).toBe(true);
      expect(result.data.attemptedOptions).toBe(2);
    });
  });

  describe('Complex Tree Execution', () => {
    test('should execute nested coordination patterns', async () => {
      const treeConfig = {
        type: 'sequence',
        children: [
          {
            type: 'selector',
            children: [
              { type: 'action', tool: 'codeGenerator', params: { className: 'Preferred' } },
              { type: 'action', tool: 'codeGenerator', params: { className: 'Fallback' } }
            ]
          },
          { type: 'action', tool: 'testRunner' }
        ]
      };

      const result = await executor.executeTree(treeConfig, {});

      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(2);
      // First result should be from selector
      expect(result.data.results[0].data.successfulOption).toBe(0);
    });

    test('should handle execution with context flow', async () => {
      const initialContext = {
        projectName: 'MyProject',
        requirements: ['auth', 'validation']
      };

      const treeConfig = {
        type: 'sequence',
        children: [
          { 
            type: 'action', 
            tool: 'codeGenerator',
            params: { 
              className: '{{projectName}}Manager',
              methods: '{{requirements}}'
            }
          }
        ]
      };

      const result = await executor.executeTree(treeConfig, initialContext);

      expect(result.success).toBe(true);
      const toolParams = result.data.results[0].toolResult.data.params;
      expect(toolParams.className).toBe('MyProjectManager');
      expect(toolParams.methods).toEqual(['auth', 'validation']);
    });
  });
});