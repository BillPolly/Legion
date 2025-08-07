/**
 * Unit tests for BehaviorTreeNode
 * Tests base node functionality, parameter resolution, child management
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BehaviorTreeNode, NodeStatus } from '../../src/core/BehaviorTreeNode.js';
import { MessageBus } from '../../src/core/MessageBus.js';
import { MockToolRegistry } from '../utils/MockToolFactory.js';

// Concrete test implementation of BehaviorTreeNode
class TestBehaviorTreeNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'test-node';
  }

  async executeNode(context) {
    return {
      status: NodeStatus.SUCCESS,
      data: { message: 'Test node executed', context }
    };
  }
}

// Simple mock executor
class MockExecutor {
  constructor() {
    this.messageBus = new MessageBus();
    this.nodeTypes = new Map();
    this.nodeTypes.set('test-node', TestBehaviorTreeNode);
  }

  createNode(config) {
    const NodeClass = this.nodeTypes.get(config.type);
    return new NodeClass(config, new MockToolRegistry(), this);
  }
}

describe('BehaviorTreeNode Unit Tests', () => {
  let mockExecutor;
  let toolRegistry;
  let node;

  beforeEach(() => {
    mockExecutor = new MockExecutor();
    toolRegistry = new MockToolRegistry();
    
    const config = {
      id: 'test-node-1',
      type: 'test-node',
      description: 'Test node for unit testing',
      debugMode: true
    };
    
    node = new TestBehaviorTreeNode(config, toolRegistry, mockExecutor);
  });

  describe('Node Creation and Configuration', () => {
    test('should create node with correct properties', () => {
      expect(node.config.id).toBe('test-node-1');
      expect(node.config.type).toBe('test-node');
      expect(node.id).toBe('test-node-1');
      expect(node.toolRegistry).toBe(toolRegistry);
      expect(node.executor).toBe(mockExecutor);
      expect(node.messageBus).toBe(mockExecutor.messageBus);
    });

    test('should generate ID if not provided', () => {
      const nodeWithoutId = new TestBehaviorTreeNode({}, toolRegistry, mockExecutor);
      expect(nodeWithoutId.id).toMatch(/test-node_\d+_[a-z0-9]+/);
    });

    test('should initialize with empty children array', () => {
      expect(node.children).toEqual([]);
      expect(node.parent).toBeNull();
      expect(node.isRunning).toBe(false);
    });

    test('should initialize children from config', () => {
      const configWithChildren = {
        type: 'test-node',
        children: [
          { type: 'test-node', id: 'child1' },
          { type: 'test-node', id: 'child2' }
        ]
      };

      const parentNode = new TestBehaviorTreeNode(configWithChildren, toolRegistry, mockExecutor);
      
      expect(parentNode.children).toHaveLength(2);
      expect(parentNode.children[0].id).toBe('child1');
      expect(parentNode.children[1].id).toBe('child2');
      expect(parentNode.children[0].parent).toBe(parentNode);
    });
  });

  describe('Execution Interface', () => {
    test('should execute successfully', async () => {
      const input = { testData: 'hello world' };
      const result = await node.execute(input);
      
      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.message).toBe('Test node executed');
      expect(result.data.context.testData).toBe('hello world');
    });

    test('should handle execution errors', async () => {
      const errorNode = new (class extends BehaviorTreeNode {
        static getTypeName() { return 'error-node'; }
        async executeNode(context) {
          throw new Error('Test error');
        }
      })({}, toolRegistry, mockExecutor);

      const result = await errorNode.execute({});
      
      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.error).toBe('Test error');
      expect(result.data.errorMessage).toBe('Test error');
    });

    test('should set running state during execution', async () => {
      let wasRunning = false;
      
      const slowNode = new (class extends BehaviorTreeNode {
        static getTypeName() { return 'slow-node'; }
        async executeNode(context) {
          wasRunning = this.isRunning;
          await new Promise(resolve => setTimeout(resolve, 10));
          return { status: NodeStatus.SUCCESS, data: {} };
        }
      })({}, toolRegistry, mockExecutor);

      await slowNode.execute({});
      
      expect(wasRunning).toBe(true);
      expect(slowNode.isRunning).toBe(false);
    });
  });

  describe('Metadata', () => {
    test('should provide metadata', () => {
      const metadata = node.getMetadata();
      
      expect(metadata.name).toBe('test-node');
      expect(metadata.type).toBe('test-node');
      expect(metadata.children).toBe(0);
      expect(metadata.nodeId).toBe('test-node-1');
      expect(metadata.specialist).toBe(false);
    });

    test('should include parameters in metadata', () => {
      const nodeWithParams = new TestBehaviorTreeNode({
        parameters: { param1: 'value1', param2: 42 }
      }, toolRegistry, mockExecutor);

      const metadata = nodeWithParams.getMetadata();
      expect(metadata.parameters.param1).toBe('value1');
      expect(metadata.parameters.param2).toBe(42);
    });
  });

  describe('Child Management', () => {
    test('should add child nodes', () => {
      const child = new TestBehaviorTreeNode({ id: 'child' }, toolRegistry, mockExecutor);
      
      node.addChild(child);
      
      expect(node.children).toHaveLength(1);
      expect(node.children[0]).toBe(child);
      expect(child.parent).toBe(node);
    });

    test('should remove child nodes', () => {
      const child1 = new TestBehaviorTreeNode({ id: 'child1' }, toolRegistry, mockExecutor);
      const child2 = new TestBehaviorTreeNode({ id: 'child2' }, toolRegistry, mockExecutor);
      
      node.addChild(child1);
      node.addChild(child2);
      
      node.removeChild(child1);
      
      expect(node.children).toHaveLength(1);
      expect(node.children[0]).toBe(child2);
      expect(child1.parent).toBeNull();
    });

    test('should remove child by index', () => {
      const child1 = new TestBehaviorTreeNode({ id: 'child1' }, toolRegistry, mockExecutor);
      const child2 = new TestBehaviorTreeNode({ id: 'child2' }, toolRegistry, mockExecutor);
      
      node.addChild(child1);
      node.addChild(child2);
      
      node.removeChildAt(0);
      
      expect(node.children).toHaveLength(1);
      expect(node.children[0]).toBe(child2);
    });

    test('should clear all children', () => {
      const child1 = new TestBehaviorTreeNode({ id: 'child1' }, toolRegistry, mockExecutor);
      const child2 = new TestBehaviorTreeNode({ id: 'child2' }, toolRegistry, mockExecutor);
      
      node.addChild(child1);
      node.addChild(child2);
      
      node.clearChildren();
      
      expect(node.children).toHaveLength(0);
      expect(child1.parent).toBeNull();
      expect(child2.parent).toBeNull();
    });

    test('should create child from config', () => {
      const childConfig = { type: 'test-node', id: 'created-child' };
      const child = node.createChild(childConfig);
      
      expect(child).toBeInstanceOf(TestBehaviorTreeNode);
      expect(child.id).toBe('created-child');
      expect(child.parent).toBe(node);
    });

    test('should execute child by index', async () => {
      const child = new TestBehaviorTreeNode({ id: 'child' }, toolRegistry, mockExecutor);
      node.addChild(child);
      
      const result = await node.executeChild(0, { test: 'data' });
      
      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.context.test).toBe('data');
    });

    test('should execute all children in parallel', async () => {
      const child1 = new TestBehaviorTreeNode({ id: 'child1' }, toolRegistry, mockExecutor);
      const child2 = new TestBehaviorTreeNode({ id: 'child2' }, toolRegistry, mockExecutor);
      
      node.addChild(child1);
      node.addChild(child2);
      
      const results = await node.executeAllChildren({ test: 'data' });
      
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe(NodeStatus.SUCCESS);
      expect(results[1].status).toBe(NodeStatus.SUCCESS);
    });
  });

  describe('Message Handling', () => {
    test('should send messages to other nodes', async () => {
      const targetNode = new TestBehaviorTreeNode({ id: 'target' }, toolRegistry, mockExecutor);
      const receivedMessages = [];
      
      targetNode.handleMessage = jest.fn((from, message) => {
        receivedMessages.push({ from: from.id, message });
      });
      
      node.send(targetNode, { type: 'TEST', data: 'hello' });
      
      // Wait for async message processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(targetNode.handleMessage).toHaveBeenCalled();
    });

    test('should send messages to parent', async () => {
      const parent = new TestBehaviorTreeNode({ id: 'parent' }, toolRegistry, mockExecutor);
      node.parent = parent;
      
      parent.handleParentMessage = jest.fn();
      parent.handleMessage = jest.fn((from, message) => {
        if (from === node) {
          parent.handleParentMessage(message);
        }
      });
      
      node.sendToParent({ type: 'CHILD_MESSAGE' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(parent.handleMessage).toHaveBeenCalled();
    });

    test('should send messages to all children', async () => {
      const child1 = new TestBehaviorTreeNode({ id: 'child1' }, toolRegistry, mockExecutor);
      const child2 = new TestBehaviorTreeNode({ id: 'child2' }, toolRegistry, mockExecutor);
      
      child1.handleMessage = jest.fn();
      child2.handleMessage = jest.fn();
      
      node.addChild(child1);
      node.addChild(child2);
      
      node.sendToChildren({ type: 'PARENT_MESSAGE' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(child1.handleMessage).toHaveBeenCalled();
      expect(child2.handleMessage).toHaveBeenCalled();
    });

    test('should handle messages based on relationship', () => {
      const parent = new TestBehaviorTreeNode({ id: 'parent' }, toolRegistry, mockExecutor);
      const child = new TestBehaviorTreeNode({ id: 'child' }, toolRegistry, mockExecutor);
      const peer = new TestBehaviorTreeNode({ id: 'peer' }, toolRegistry, mockExecutor);
      
      node.parent = parent;
      node.addChild(child);
      
      node.handleParentMessage = jest.fn();
      node.handleChildMessage = jest.fn();
      node.handlePeerMessage = jest.fn();
      
      node.handleMessage(parent, { type: 'FROM_PARENT' });
      node.handleMessage(child, { type: 'FROM_CHILD' });
      node.handleMessage(peer, { type: 'FROM_PEER' });
      
      expect(node.handleParentMessage).toHaveBeenCalledWith({ type: 'FROM_PARENT' });
      expect(node.handleChildMessage).toHaveBeenCalledWith(child, { type: 'FROM_CHILD' });
      expect(node.handlePeerMessage).toHaveBeenCalledWith(peer, { type: 'FROM_PEER' });
    });
  });

  describe('Parameter Resolution', () => {
    test('should resolve simple placeholder substitution', () => {
      const params = {
        greeting: 'Hello {{name}}',
        age: '{{userAge}}',
        static: 'unchanged'
      };
      
      const context = {
        name: 'World',
        userAge: 25
      };
      
      const resolved = node.resolveParams(params, context);
      
      expect(resolved.greeting).toBe('Hello World');
      expect(resolved.age).toBe('25');
      expect(resolved.static).toBe('unchanged');
    });

    test('should handle array parameter resolution', () => {
      const params = {
        items: ['{{item1}}', 'static', '{{item2}}'],
        mixed: ['hello', '{{name}}']
      };
      
      const context = {
        item1: 'dynamic1',
        item2: 'dynamic2',
        name: 'test'
      };
      
      const resolved = node.resolveParams(params, context);
      
      expect(resolved.items).toEqual(['dynamic1', 'static', 'dynamic2']);
      expect(resolved.mixed).toEqual(['hello', 'test']);
    });

    test('should handle nested object resolution', () => {
      const params = {
        config: {
          name: '{{userName}}',
          settings: {
            enabled: true,
            value: '{{configValue}}'
          }
        }
      };
      
      const context = {
        userName: 'testUser',
        configValue: 'testValue'
      };
      
      const resolved = node.resolveParams(params, context);
      
      expect(resolved.config.name).toBe('testUser');
      expect(resolved.config.settings.value).toBe('testValue');
      expect(resolved.config.settings.enabled).toBe(true);
    });

    test('should handle nested value extraction', () => {
      const context = {
        user: {
          profile: {
            name: 'John Doe',
            settings: {
              theme: 'dark'
            }
          }
        }
      };
      
      expect(node.getNestedValue(context, 'user.profile.name')).toBe('John Doe');
      expect(node.getNestedValue(context, 'user.profile.settings.theme')).toBe('dark');
      expect(node.getNestedValue(context, 'nonexistent.path')).toBeUndefined();
    });
  });

  describe('Utility Methods', () => {
    test('should detect leaf nodes', () => {
      expect(node.isLeaf()).toBe(true);
      
      const child = new TestBehaviorTreeNode({ id: 'child' }, toolRegistry, mockExecutor);
      node.addChild(child);
      
      expect(node.isLeaf()).toBe(false);
    });

    test('should get all descendants', () => {
      const child1 = new TestBehaviorTreeNode({ id: 'child1' }, toolRegistry, mockExecutor);
      const child2 = new TestBehaviorTreeNode({ id: 'child2' }, toolRegistry, mockExecutor);
      const grandchild = new TestBehaviorTreeNode({ id: 'grandchild' }, toolRegistry, mockExecutor);
      
      node.addChild(child1);
      node.addChild(child2);
      child1.addChild(grandchild);
      
      const descendants = node.getAllDescendants();
      
      expect(descendants).toHaveLength(3);
      expect(descendants).toContain(child1);
      expect(descendants).toContain(child2);
      expect(descendants).toContain(grandchild);
    });

    test('should get path from root', () => {
      const root = new TestBehaviorTreeNode({ id: 'root' }, toolRegistry, mockExecutor);
      const parent = new TestBehaviorTreeNode({ id: 'parent' }, toolRegistry, mockExecutor);
      const child = new TestBehaviorTreeNode({ id: 'child' }, toolRegistry, mockExecutor);
      
      root.addChild(parent);
      parent.addChild(child);
      
      const path = child.getPathFromRoot();
      
      expect(path).toHaveLength(3);
      expect(path[0]).toBe(root);
      expect(path[1]).toBe(parent);
      expect(path[2]).toBe(child);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources', async () => {
      const child1 = new TestBehaviorTreeNode({ id: 'child1' }, toolRegistry, mockExecutor);
      const child2 = new TestBehaviorTreeNode({ id: 'child2' }, toolRegistry, mockExecutor);
      
      child1.cleanup = jest.fn();
      child2.cleanup = jest.fn();
      
      node.addChild(child1);
      node.addChild(child2);
      node.isRunning = true;
      
      await node.cleanup();
      
      expect(node.isRunning).toBe(false);
      expect(node.parent).toBeNull();
      expect(node.children).toHaveLength(0);
      expect(child1.cleanup).toHaveBeenCalled();
      expect(child2.cleanup).toHaveBeenCalled();
    });
  });
});