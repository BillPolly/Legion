/**
 * Test that BehaviorTreeNode properly extends Actor
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BehaviorTreeNode, NodeStatus } from '../../src/core/BehaviorTreeNode.js';
import { MessageBus } from '../../src/core/MessageBus.js';
import { Actor } from '@legion/actors';

// Simple test node
class TestNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'test-node';
  }

  async executeNode(context) {
    return {
      status: NodeStatus.SUCCESS,
      data: { message: 'Test executed' }
    };
  }
}

// Mock executor
class MockExecutor {
  constructor() {
    this.messageBus = new MessageBus();
  }

  createNode(config) {
    return new TestNode(config, null, this);
  }
}

describe('Actor-BT Integration Tests', () => {
  let executor;
  let node1;
  let node2;

  beforeEach(() => {
    executor = new MockExecutor();
    node1 = new TestNode({ id: 'node1' }, null, executor);
    node2 = new TestNode({ id: 'node2' }, null, executor);
  });

  test('BehaviorTreeNode should extend Actor', () => {
    expect(node1).toBeInstanceOf(Actor);
    expect(node1).toBeInstanceOf(BehaviorTreeNode);
  });

  test('BehaviorTreeNode should have Actor properties', () => {
    expect(node1.isActor).toBe(true);
    expect(typeof node1.receive).toBe('function');
  });

  test('should handle actor-style receive messages', async () => {
    const messageReceived = jest.fn();
    
    // Override handleMessage to track calls
    node2.handleMessage = messageReceived;
    
    // Send actor-style message
    node2.receive({ from: node1, message: { type: 'TEST', data: 'hello' } });
    
    expect(messageReceived).toHaveBeenCalledWith(node1, { type: 'TEST', data: 'hello' });
  });

  test('should send messages through MessageBus with actor protocol', async () => {
    const receivedMessages = [];
    
    // Track messages received by node2
    node2.handleMessage = (from, message) => {
      receivedMessages.push({ from: from.id, message });
    };
    
    // Send message from node1 to node2
    node1.send(node2, { type: 'HELLO', content: 'world' });
    
    // Wait for async message processing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].from).toBe('node1');
    expect(receivedMessages[0].message.type).toBe('HELLO');
    expect(receivedMessages[0].message.content).toBe('world');
  });

  test('MessageBus should use actor receive method', async () => {
    const receiveSpy = jest.spyOn(node2, 'receive');
    
    // Send message through MessageBus
    executor.messageBus.sendMessage(node1, node2, { type: 'TEST' });
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(receiveSpy).toHaveBeenCalledWith({
      from: node1,
      message: expect.objectContaining({ type: 'TEST' })
    });
  });

  test('should maintain async queue behavior to prevent stack overflow', async () => {
    let messageCount = 0;
    
    node2.handleMessage = () => {
      messageCount++;
      // If this was synchronous, sending 1000 messages would overflow the stack
      if (messageCount < 100) {
        node1.send(node2, { type: 'RECURSIVE' });
      }
    };
    
    // Start the recursive message chain
    node1.send(node2, { type: 'START' });
    
    // Wait for all messages to process
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have processed many messages without stack overflow
    // The exact count may vary due to async timing
    expect(messageCount).toBeGreaterThan(50);
    expect(messageCount).toBeLessThanOrEqual(100);
  });
});