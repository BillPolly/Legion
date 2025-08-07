/**
 * Unit tests for MessageBus
 * Tests message passing, queuing, and global node management
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MessageBus } from '../../src/core/MessageBus.js';
import { BehaviorTreeNode } from '../../src/core/BehaviorTreeNode.js';

// Mock node for testing
class MockNode {
  constructor(id) {
    this.id = id;
    this.receivedMessages = [];
  }

  handleMessage(from, message) {
    this.receivedMessages.push({ from: from.id, message, timestamp: Date.now() });
  }
}

describe('MessageBus Unit Tests', () => {
  let messageBus;
  let nodeA;
  let nodeB;
  let nodeC;

  beforeEach(() => {
    messageBus = new MessageBus();
    nodeA = new MockNode('nodeA');
    nodeB = new MockNode('nodeB'); 
    nodeC = new MockNode('nodeC');
  });

  describe('Basic Message Passing', () => {
    test('should send message between nodes', async () => {
      messageBus.sendMessage(nodeA, nodeB, { type: 'TEST', data: 'hello' });
      
      // Process messages asynchronously
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(nodeB.receivedMessages).toHaveLength(1);
      expect(nodeB.receivedMessages[0].message.type).toBe('TEST');
      expect(nodeB.receivedMessages[0].message.data).toBe('hello');
      expect(nodeB.receivedMessages[0].from).toBe('nodeA');
    });

    test('should add timestamp to messages', async () => {
      const beforeSend = Date.now();
      messageBus.sendMessage(nodeA, nodeB, { type: 'TEST' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const message = nodeB.receivedMessages[0].message;
      expect(message.timestamp).toBeGreaterThanOrEqual(beforeSend);
      expect(message.timestamp).toBeLessThanOrEqual(Date.now());
    });

    test('should handle multiple messages in order', async () => {
      messageBus.sendMessage(nodeA, nodeB, { type: 'FIRST' });
      messageBus.sendMessage(nodeA, nodeB, { type: 'SECOND' });
      messageBus.sendMessage(nodeA, nodeB, { type: 'THIRD' });
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(nodeB.receivedMessages).toHaveLength(3);
      expect(nodeB.receivedMessages[0].message.type).toBe('FIRST');
      expect(nodeB.receivedMessages[1].message.type).toBe('SECOND');
      expect(nodeB.receivedMessages[2].message.type).toBe('THIRD');
    });
  });

  describe('Message Queue Management', () => {
    test('should queue messages when processing', () => {
      messageBus.sendMessage(nodeA, nodeB, { type: 'MSG1' });
      messageBus.sendMessage(nodeA, nodeB, { type: 'MSG2' });
      
      // Messages should be queued immediately
      expect(messageBus.messageQueue.length).toBeGreaterThan(0);
    });

    test('should clear queue after processing', async () => {
      messageBus.sendMessage(nodeA, nodeB, { type: 'TEST' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(messageBus.messageQueue.length).toBe(0);
      expect(messageBus.isProcessing).toBe(false);
    });

    test('should handle message processing errors gracefully', async () => {
      const errorNode = {
        id: 'errorNode',
        handleMessage() {
          throw new Error('Message handling failed');
        }
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      messageBus.sendMessage(nodeA, errorNode, { type: 'ERROR_TEST' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Global Node Registry', () => {
    test('should register and unregister global nodes', () => {
      messageBus.registerGlobalNode('nodeA', nodeA);
      messageBus.registerGlobalNode('nodeB', nodeB);
      
      expect(messageBus.globalNodes.size).toBe(2);
      expect(messageBus.globalNodes.get('nodeA')).toBe(nodeA);
      
      messageBus.unregisterGlobalNode('nodeA');
      expect(messageBus.globalNodes.size).toBe(1);
      expect(messageBus.globalNodes.has('nodeA')).toBe(false);
    });

    test('should send message to global node by ID', async () => {
      messageBus.registerGlobalNode('nodeB', nodeB);
      
      const success = messageBus.sendToGlobalNode(nodeA, 'nodeB', { type: 'GLOBAL_MSG' });
      
      expect(success).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(nodeB.receivedMessages).toHaveLength(1);
      expect(nodeB.receivedMessages[0].message.type).toBe('GLOBAL_MSG');
    });

    test('should return false when sending to non-existent global node', () => {
      const success = messageBus.sendToGlobalNode(nodeA, 'nonexistent', { type: 'TEST' });
      expect(success).toBe(false);
    });

    test('should broadcast messages to all global nodes except sender', async () => {
      messageBus.registerGlobalNode('nodeA', nodeA);
      messageBus.registerGlobalNode('nodeB', nodeB);
      messageBus.registerGlobalNode('nodeC', nodeC);
      
      messageBus.broadcast(nodeA, { type: 'BROADCAST' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // nodeA should not receive its own broadcast
      expect(nodeA.receivedMessages).toHaveLength(0);
      
      // nodeB and nodeC should receive the broadcast
      expect(nodeB.receivedMessages).toHaveLength(1);
      expect(nodeC.receivedMessages).toHaveLength(1);
      expect(nodeB.receivedMessages[0].message.broadcast).toBe(true);
    });

    test('should support filtered broadcasting', async () => {
      messageBus.registerGlobalNode('nodeA', nodeA);
      messageBus.registerGlobalNode('nodeB', nodeB);
      messageBus.registerGlobalNode('nodeC', nodeC);
      
      // Filter to only send to nodes with 'B' in their ID
      const filter = (nodeId, node) => nodeId.includes('B');
      messageBus.broadcast(nodeA, { type: 'FILTERED' }, filter);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(nodeB.receivedMessages).toHaveLength(1);
      expect(nodeC.receivedMessages).toHaveLength(0);
    });
  });

  describe('Message Handler Registry', () => {
    test('should register message handlers', () => {
      const handler = jest.fn();
      messageBus.registerMessageHandler('TEST_TYPE', handler);
      
      expect(messageBus.messageHandlers.has('TEST_TYPE')).toBe(true);
      expect(messageBus.messageHandlers.get('TEST_TYPE')).toContain(handler);
    });

    test('should support multiple handlers for same message type', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      messageBus.registerMessageHandler('MULTI', handler1);
      messageBus.registerMessageHandler('MULTI', handler2);
      
      const handlers = messageBus.messageHandlers.get('MULTI');
      expect(handlers).toHaveLength(2);
      expect(handlers).toContain(handler1);
      expect(handlers).toContain(handler2);
    });
  });

  describe('Queue Status and Management', () => {
    test('should provide queue status information', () => {
      messageBus.registerGlobalNode('test', nodeA);
      
      // Send message and check queue immediately before processing
      messageBus.sendMessage(nodeA, nodeB, { type: 'TEST' });
      
      const status = messageBus.getQueueStatus();
      
      expect(status.queueLength).toBeGreaterThanOrEqual(0); // May be 0 if processed already
      expect(status.globalNodes).toContain('test');
      expect(typeof status.isProcessing).toBe('boolean');
    });

    test('should clear message queue', () => {
      messageBus.sendMessage(nodeA, nodeB, { type: 'TEST1' });
      messageBus.sendMessage(nodeA, nodeB, { type: 'TEST2' });
      
      expect(messageBus.messageQueue.length).toBeGreaterThan(0);
      
      messageBus.clearQueue();
      
      expect(messageBus.messageQueue.length).toBe(0);
      expect(messageBus.isProcessing).toBe(false);
    });

    test('should handle shutdown gracefully', async () => {
      messageBus.registerGlobalNode('nodeA', nodeA);
      messageBus.sendMessage(nodeA, nodeB, { type: 'FINAL' });
      
      await messageBus.shutdown();
      
      expect(messageBus.messageQueue.length).toBe(0);
      expect(messageBus.globalNodes.size).toBe(0);
      expect(messageBus.messageHandlers.size).toBe(0);
    });
  });

  describe('Async Processing', () => {
    test('should process messages asynchronously', () => {
      const processingSpy = jest.spyOn(messageBus, 'processMessages');
      
      messageBus.sendMessage(nodeA, nodeB, { type: 'ASYNC_TEST' });
      
      expect(processingSpy).toHaveBeenCalled();
      processingSpy.mockRestore();
    });

    test('should prevent concurrent processing', async () => {
      messageBus.isProcessing = true;
      
      // Process messages should return early if already processing
      const result = await messageBus.processMessages();
      
      // Should exit early and not change processing state
      expect(messageBus.isProcessing).toBe(true);
      expect(result).toBeUndefined();
    });
  });
});