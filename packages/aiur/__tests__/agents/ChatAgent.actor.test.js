/**
 * Actor interface tests for ChatAgent with mock WebSocket
 * Tests the full actor communication flow
 */

import { jest } from '@jest/globals';
import { ChatAgent } from '../../src/agents/ChatAgent.js';
import { EventEmitter } from 'events';

// Mock WebSocket for testing
class MockWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    // Simulate connection after a delay
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.emit('open');
    }, 10);
  }
  
  send(data) {
    const message = typeof data === 'string' ? JSON.parse(data) : data;
    this.emit('message-sent', message);
    
    // Simulate server response
    setTimeout(() => {
      this.simulateServerResponse(message);
    }, 10);
  }
  
  simulateServerResponse(clientMessage) {
    // Override in tests to simulate specific responses
  }
  
  close() {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }
}

// Mock Actor Space
class MockActorSpace extends EventEmitter {
  constructor() {
    super();
    this.actors = new Map();
    this.messages = [];
    this.sessionId = 'mock-session-123';
  }
  
  register(name, actor) {
    const guid = `mock-space:${name}`;
    this.actors.set(name, { actor, guid });
    return guid;
  }
  
  unregister(guid) {
    const name = guid.split(':')[1];
    this.actors.delete(name);
  }
  
  send(target, message, from) {
    this.messages.push({ target, message, from });
    this.emit('message-sent', { target, message, from });
    
    // Simulate server processing
    if (target === 'server' && message.type === 'chat_message') {
      setTimeout(() => {
        this.simulateChatResponse(message);
      }, 20);
    }
  }
  
  simulateChatResponse(message) {
    const chatActor = this.actors.get('chat');
    if (chatActor) {
      // Send processing started
      chatActor.actor.receive({
        type: 'chat_processing',
        sessionId: this.sessionId
      }, { from: 'server' });
      
      // Send response
      setTimeout(() => {
        chatActor.actor.receive({
          type: 'chat_response',
          content: `Mock response to: ${message.content}`,
          isComplete: true,
          sessionId: this.sessionId
        }, { from: 'server' });
        
        // Send complete
        chatActor.actor.receive({
          type: 'chat_complete',
          sessionId: this.sessionId
        }, { from: 'server' });
      }, 10);
    }
  }
}

// Mock the LLMClient
jest.mock('@legion/llm', () => {
  class MockLLMClient extends EventEmitter {
    constructor(config) {
      super();
      this.config = config;
    }
    
    async complete(prompt, maxTokens) {
      return `Mock LLM response for: ${prompt.substring(0, 50)}...`;
    }
  }
  
  return {
    LLMClient: MockLLMClient
  };
});

describe('ChatAgent Actor Interface Tests', () => {
  let chatAgent;
  let mockActorSpace;
  
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    
    // Create mock actor space
    mockActorSpace = new MockActorSpace();
    
    // Create chat agent
    chatAgent = new ChatAgent({
      sessionId: mockActorSpace.sessionId,
      apiKey: 'test-key'
    });
  });
  
  afterEach(() => {
    if (chatAgent) {
      chatAgent.destroy();
    }
  });
  
  describe('Actor Registration', () => {
    test('should register with actor space', () => {
      const guid = mockActorSpace.register('chat', chatAgent);
      
      expect(guid).toBe('mock-space:chat');
      expect(mockActorSpace.actors.has('chat')).toBe(true);
      expect(mockActorSpace.actors.get('chat').actor).toBe(chatAgent);
    });
    
    test('should unregister from actor space', () => {
      const guid = mockActorSpace.register('chat', chatAgent);
      mockActorSpace.unregister(guid);
      
      expect(mockActorSpace.actors.has('chat')).toBe(false);
    });
  });
  
  describe('Message Routing through Actor Space', () => {
    test('should send chat messages through actor space', (done) => {
      mockActorSpace.register('chat', chatAgent);
      
      mockActorSpace.on('message-sent', ({ target, message, from }) => {
        expect(target).toBe('server');
        expect(message.type).toBe('chat_message');
        expect(message.content).toBe('Test message');
        expect(message.sessionId).toBe('mock-session-123');
        expect(from).toBe('mock-space:chat');
        done();
      });
      
      // Simulate sending message through actor interface
      chatAgent.handleMessage({
        type: 'chat_message',
        content: 'Test message'
      });
    });
    
    test('should receive and process server responses', (done) => {
      mockActorSpace.register('chat', chatAgent);
      
      // Listen for chat agent's response event
      chatAgent.on('response', (response) => {
        expect(response.type).toBe('chat_response');
        expect(response.content).toContain('Mock response to: Hello');
        expect(response.isComplete).toBe(true);
        expect(response.sessionId).toBe('mock-session-123');
        done();
      });
      
      // Send message through actor space
      mockActorSpace.send('server', {
        type: 'chat_message',
        content: 'Hello',
        sessionId: mockActorSpace.sessionId
      }, 'mock-space:chat');
    });
    
    test('should handle chat processing notifications', (done) => {
      mockActorSpace.register('chat', chatAgent);
      
      const events = [];
      
      chatAgent.on('processing_started', () => events.push('started'));
      chatAgent.on('processing_complete', () => events.push('complete'));
      
      chatAgent.on('response', () => {
        // Check that we received processing events
        expect(events).toContain('started');
        expect(events).toContain('complete');
        done();
      });
      
      // Trigger chat flow
      mockActorSpace.send('server', {
        type: 'chat_message',
        content: 'Test',
        sessionId: mockActorSpace.sessionId
      }, 'mock-space:chat');
    });
  });
  
  describe('Streaming Support', () => {
    test('should handle streaming messages from server', (done) => {
      mockActorSpace.register('chat', chatAgent);
      
      const chunks = [];
      
      // Override simulateChatResponse to send streaming chunks
      mockActorSpace.simulateChatResponse = function(message) {
        const chatActor = this.actors.get('chat');
        if (chatActor) {
          // Send streaming chunks
          const words = ['Hello', 'from', 'streaming', 'response'];
          words.forEach((word, index) => {
            setTimeout(() => {
              chatActor.actor.receive({
                type: 'chat_stream',
                content: word + ' ',
                sessionId: this.sessionId
              }, { from: 'server' });
              
              // Send complete after last chunk
              if (index === words.length - 1) {
                setTimeout(() => {
                  chatActor.actor.receive({
                    type: 'chat_response',
                    content: words.join(' '),
                    isComplete: true,
                    sessionId: this.sessionId
                  }, { from: 'server' });
                }, 10);
              }
            }, index * 10);
          });
        }
      };
      
      // Listen for streaming events
      chatAgent.on('stream', (chunk) => {
        chunks.push(chunk.content);
      });
      
      chatAgent.on('response', (response) => {
        expect(chunks).toHaveLength(4);
        expect(chunks.join('')).toBe('Hello from streaming response ');
        expect(response.content).toBe('Hello from streaming response');
        done();
      });
      
      // Trigger chat
      mockActorSpace.send('server', {
        type: 'chat_message',
        content: 'Stream test',
        sessionId: mockActorSpace.sessionId
      }, 'mock-space:chat');
    });
  });
  
  describe('Error Handling through Actor Interface', () => {
    test('should handle error messages from server', (done) => {
      mockActorSpace.register('chat', chatAgent);
      
      chatAgent.on('error', (error) => {
        expect(error.type).toBe('processing_error');
        expect(error.message).toBe('Server error occurred');
        done();
      });
      
      // Simulate error from server
      chatAgent.receive({
        type: 'chat_error',
        message: 'Server error occurred',
        errorType: 'processing_error',
        sessionId: mockActorSpace.sessionId
      }, { from: 'server' });
    });
    
    test('should handle connection errors', (done) => {
      mockActorSpace.register('chat', chatAgent);
      
      // Override to simulate connection error
      mockActorSpace.send = function(target, message, from) {
        throw new Error('Connection lost');
      };
      
      chatAgent.on('error', (error) => {
        expect(error.message).toContain('Failed to process message');
        done();
      });
      
      chatAgent.handleMessage({
        type: 'chat_message',
        content: 'Test'
      });
    });
  });
  
  describe('History Management through Actor Interface', () => {
    test('should handle clear history command', () => {
      mockActorSpace.register('chat', chatAgent);
      
      // Add some history
      chatAgent.conversationHistory.push(
        { role: 'user', content: 'Test 1' },
        { role: 'assistant', content: 'Response 1' }
      );
      
      // Send clear command
      chatAgent.receive({
        type: 'clear_history',
        sessionId: mockActorSpace.sessionId
      }, { from: 'server' });
      
      expect(chatAgent.getHistory()).toHaveLength(0);
    });
    
    test('should handle get history command', (done) => {
      mockActorSpace.register('chat', chatAgent);
      
      // Add some history
      chatAgent.conversationHistory.push(
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' }
      );
      
      chatAgent.on('history', (event) => {
        expect(event.type).toBe('chat_history');
        expect(event.history).toHaveLength(2);
        expect(event.history[0].content).toBe('Question');
        expect(event.history[1].content).toBe('Answer');
        done();
      });
      
      // Request history
      chatAgent.receive({
        type: 'get_history',
        sessionId: mockActorSpace.sessionId
      }, { from: 'server' });
    });
  });
  
  describe('Full Chat Flow Simulation', () => {
    test('should handle complete chat interaction flow', async () => {
      mockActorSpace.register('chat', chatAgent);
      
      const events = [];
      const responses = [];
      
      // Track all events
      chatAgent.on('processing_started', () => events.push('start'));
      chatAgent.on('response', (r) => {
        events.push('response');
        responses.push(r);
      });
      chatAgent.on('processing_complete', () => events.push('complete'));
      
      // Send multiple messages
      for (let i = 1; i <= 3; i++) {
        const responsePromise = new Promise(resolve => {
          chatAgent.once('response', resolve);
        });
        
        mockActorSpace.send('server', {
          type: 'chat_message',
          content: `Message ${i}`,
          sessionId: mockActorSpace.sessionId
        }, 'mock-space:chat');
        
        await responsePromise;
      }
      
      // Verify flow
      expect(events).toHaveLength(9); // 3 * (start + response + complete)
      expect(responses).toHaveLength(3);
      expect(responses[0].content).toContain('Message 1');
      expect(responses[1].content).toContain('Message 2');
      expect(responses[2].content).toContain('Message 3');
      
      // Check conversation history is maintained
      expect(chatAgent.getHistory()).toHaveLength(0); // Mock doesn't update history
    });
  });
  
  describe('Actor Lifecycle', () => {
    test('should handle actor destruction gracefully', () => {
      const guid = mockActorSpace.register('chat', chatAgent);
      
      // Add some state
      chatAgent.conversationHistory.push({ role: 'user', content: 'test' });
      
      // Destroy agent
      chatAgent.destroy();
      
      // Verify cleanup
      expect(chatAgent.conversationHistory).toHaveLength(0);
      expect(chatAgent.llmClient).toBeNull();
      
      // Unregister from space
      mockActorSpace.unregister(guid);
      expect(mockActorSpace.actors.has('chat')).toBe(false);
    });
    
    test('should handle reconnection scenario', () => {
      // First connection
      let guid = mockActorSpace.register('chat', chatAgent);
      mockActorSpace.unregister(guid);
      
      // Reconnection
      guid = mockActorSpace.register('chat', chatAgent);
      
      expect(mockActorSpace.actors.has('chat')).toBe(true);
      expect(guid).toBe('mock-space:chat');
    });
  });
});