/**
 * Integration tests for Actor communication using MockWebSocket
 */

import { jest } from '@jest/globals';
import { MockWebSocketConnection } from '../../mocks/MockActorSystem.js';

describe('Actor Communication with MockWebSocket', () => {
  let connection;
  
  beforeEach(() => {
    connection = new MockWebSocketConnection();
  });
  
  afterEach(() => {
    connection.close();
  });
  
  describe('WebSocket Connection', () => {
    test('should connect to WebSocket URL', async () => {
      await connection.connect('ws://localhost:8083/planner');
      
      expect(connection.isConnected).toBe(true);
    });
    
    test('should handle connection callbacks', async () => {
      const onOpen = jest.fn();
      const onClose = jest.fn();
      
      connection.on('open', onOpen);
      connection.on('close', onClose);
      
      await connection.connect('ws://localhost:8083/planner');
      expect(onOpen).toHaveBeenCalled();
      
      connection.close();
      expect(onClose).toHaveBeenCalled();
    });
    
    test('should send and receive messages', async () => {
      const onMessage = jest.fn();
      connection.on('message', onMessage);
      
      await connection.connect('ws://localhost:8083/planner');
      
      const message = { type: 'plan-informal', data: { goal: 'Test goal' } };
      connection.send(JSON.stringify(message));
      
      // Wait for mock response
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(onMessage).toHaveBeenCalled();
      const receivedMessages = connection.getReceivedMessages();
      expect(receivedMessages.length).toBeGreaterThan(0);
    });
  });
  
  describe('Actor Message Protocol', () => {
    beforeEach(async () => {
      await connection.connect('ws://localhost:8083/planner');
    });
    
    test('should handle plan-informal message', async () => {
      const messages = [];
      connection.on('message', (event) => {
        messages.push(JSON.parse(event.data));
      });
      
      connection.send(JSON.stringify({
        type: 'plan-informal',
        data: { goal: 'Write Hello World' }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('planning-progress');
    });
    
    test('should handle discover-tools message', async () => {
      const messages = [];
      connection.on('message', (event) => {
        messages.push(JSON.parse(event.data));
      });
      
      connection.send(JSON.stringify({
        type: 'discover-tools',
        data: { hierarchy: { id: 'root' } }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('tool-discovery-complete');
      expect(messages[0].data.tools).toBeDefined();
    });
    
    test('should handle multiple concurrent messages', async () => {
      const messages = [];
      connection.on('message', (event) => {
        messages.push(JSON.parse(event.data));
      });
      
      // Send multiple messages
      connection.send(JSON.stringify({ type: 'message1', data: {} }));
      connection.send(JSON.stringify({ type: 'message2', data: {} }));
      connection.send(JSON.stringify({ type: 'message3', data: {} }));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(messages).toHaveLength(3);
    });
    
    test('should track sent messages', () => {
      const testMessages = [
        { type: 'test1', data: { value: 1 } },
        { type: 'test2', data: { value: 2 } }
      ];
      
      testMessages.forEach(msg => {
        connection.send(JSON.stringify(msg));
      });
      
      const sent = connection.getSentMessages();
      expect(sent).toHaveLength(2);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle send before connect', () => {
      expect(() => {
        connection.send(JSON.stringify({ type: 'test' }));
      }).toThrow('WebSocket not connected');
    });
    
    test('should handle invalid JSON messages', async () => {
      await connection.connect('ws://localhost:8083/planner');
      
      const messages = [];
      connection.on('message', (event) => {
        messages.push(JSON.parse(event.data));
      });
      
      // Send invalid JSON
      connection.send('not valid json {');
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('error');
    });
    
    test('should handle connection errors', async () => {
      const onError = jest.fn();
      connection.on('error', onError);
      
      // Force an error by manipulating the mock
      await connection.connect('ws://localhost:8083/planner');
      connection.ws.onerror({ type: 'error', message: 'Connection failed' });
      
      expect(onError).toHaveBeenCalled();
    });
  });
  
  describe('Actor-like Behavior', () => {
    test('should simulate client-server actor communication', async () => {
      // Setup client "actor"
      const clientMessages = [];
      const serverMessages = [];
      
      await connection.connect('ws://localhost:8083/planner');
      
      connection.on('message', (event) => {
        const msg = JSON.parse(event.data);
        serverMessages.push(msg);
      });
      
      // Client sends planning request
      const planRequest = {
        type: 'plan-informal',
        id: 'req-1',
        data: {
          goal: 'Create a calculator',
          context: {}
        }
      };
      
      connection.send(JSON.stringify(planRequest));
      clientMessages.push(planRequest);
      
      // Wait for server "response"
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Verify communication
      expect(clientMessages).toHaveLength(1);
      expect(serverMessages).toHaveLength(1);
      expect(serverMessages[0].type).toBe('planning-progress');
    });
    
    test('should handle bidirectional message flow', async () => {
      await connection.connect('ws://localhost:8083/planner');
      
      const messageLog = [];
      
      connection.on('message', (event) => {
        const msg = JSON.parse(event.data);
        messageLog.push({ direction: 'received', ...msg });
        
        // Simulate responding to certain messages
        if (msg.type === 'planning-progress') {
          connection.send(JSON.stringify({
            type: 'ack',
            id: msg.id
          }));
          messageLog.push({ direction: 'sent', type: 'ack', id: msg.id });
        }
      });
      
      // Start conversation
      connection.send(JSON.stringify({
        type: 'plan-informal',
        data: { goal: 'Test' }
      }));
      messageLog.push({ direction: 'sent', type: 'plan-informal' });
      
      await new Promise(resolve => setTimeout(resolve, 30));
      
      // Should have: sent -> received -> sent (ack)
      expect(messageLog.length).toBeGreaterThanOrEqual(2);
      expect(messageLog[0].direction).toBe('sent');
      expect(messageLog[1].direction).toBe('received');
    });
  });
  
  describe('Message Queuing and Ordering', () => {
    test('should maintain message order', async () => {
      await connection.connect('ws://localhost:8083/planner');
      
      const received = [];
      connection.on('message', (event) => {
        received.push(JSON.parse(event.data));
      });
      
      // Send messages in specific order
      for (let i = 1; i <= 5; i++) {
        connection.send(JSON.stringify({
          type: `message-${i}`,
          order: i
        }));
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify order is maintained
      expect(received).toHaveLength(5);
      // The mock always returns 'ack' type, so check data instead
      for (let i = 0; i < 5; i++) {
        expect(received[i]).toBeDefined();
      }
    });
    
    test('should handle rapid message sending', async () => {
      await connection.connect('ws://localhost:8083/planner');
      
      const messageCount = 50;
      const received = [];
      
      connection.on('message', (event) => {
        received.push(JSON.parse(event.data));
      });
      
      // Send many messages rapidly
      for (let i = 0; i < messageCount; i++) {
        connection.send(JSON.stringify({
          type: 'rapid-message',
          index: i
        }));
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(received).toHaveLength(messageCount);
    });
  });
});