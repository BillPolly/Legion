/**
 * Unit tests for ChatAgent with mocked dependencies
 */

import { jest } from '@jest/globals';
import { ChatAgent } from '../../src/agents/ChatAgent.js';
import { EventEmitter } from 'events';

// Mock the LLMClient module
jest.mock('@legion/llm', () => {
  class MockLLMClient extends EventEmitter {
    constructor(config) {
      super();
      this.config = config;
      this.mockResponses = [];
      this.callCount = 0;
    }
    
    async complete(prompt, maxTokens) {
      this.callCount++;
      
      // Simulate async behavior
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Return mock response or default
      const response = this.mockResponses.shift() || 'This is a mock response from the LLM.';
      
      // Emit stream events if configured
      if (this.config.streaming) {
        const chunks = response.split(' ');
        for (const chunk of chunks) {
          this.emit('stream', chunk + ' ');
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }
      
      return response;
    }
    
    setMockResponse(response) {
      this.mockResponses.push(response);
    }
  }
  
  return {
    LLMClient: MockLLMClient
  };
});

describe('ChatAgent Unit Tests', () => {
  let chatAgent;
  let mockLLMClient;
  
  beforeEach(() => {
    // Reset environment
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    
    // Create agent
    chatAgent = new ChatAgent({
      sessionId: 'test-session-123',
      apiKey: 'test-api-key'
    });
    
    // Get reference to mock LLM client
    mockLLMClient = chatAgent.llmClient;
  });
  
  afterEach(() => {
    if (chatAgent) {
      chatAgent.destroy();
    }
  });
  
  describe('Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(chatAgent.id).toMatch(/^chat-agent-\d+-[a-z0-9]+$/);
      expect(chatAgent.sessionId).toBe('test-session-123');
      expect(chatAgent.conversationHistory).toEqual([]);
      expect(chatAgent.isProcessing).toBe(false);
    });
    
    test('should initialize LLM client with correct config', () => {
      expect(mockLLMClient).toBeDefined();
      expect(mockLLMClient.config.provider).toBe('anthropic');
      expect(mockLLMClient.config.apiKey).toBe('test-api-key');
    });
    
    test('should use custom configuration when provided', () => {
      const customAgent = new ChatAgent({
        sessionId: 'custom-session',
        provider: 'openai',
        model: 'gpt-4',
        maxTokens: 4000,
        temperature: 0.5
      });
      
      expect(customAgent.llmConfig.provider).toBe('openai');
      expect(customAgent.llmConfig.model).toBe('gpt-4');
      expect(customAgent.llmConfig.maxTokens).toBe(4000);
      expect(customAgent.llmConfig.temperature).toBe(0.5);
      
      customAgent.destroy();
    });
  });
  
  describe('Message Processing', () => {
    test('should process a simple message', async () => {
      const responsePromise = new Promise(resolve => {
        chatAgent.on('response', resolve);
      });
      
      mockLLMClient.setMockResponse('Hello! How can I help you?');
      
      await chatAgent.processMessage('Hello');
      
      const response = await responsePromise;
      
      expect(response.type).toBe('chat_response');
      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.isComplete).toBe(true);
      expect(response.sessionId).toBe('test-session-123');
    });
    
    test('should add messages to conversation history', async () => {
      mockLLMClient.setMockResponse('Response 1');
      await chatAgent.processMessage('Message 1');
      
      mockLLMClient.setMockResponse('Response 2');
      await chatAgent.processMessage('Message 2');
      
      const history = chatAgent.getHistory();
      
      expect(history).toHaveLength(4);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Message 1');
      expect(history[1].role).toBe('assistant');
      expect(history[1].content).toBe('Response 1');
      expect(history[2].role).toBe('user');
      expect(history[2].content).toBe('Message 2');
      expect(history[3].role).toBe('assistant');
      expect(history[3].content).toBe('Response 2');
    });
    
    test('should emit processing events', async () => {
      const events = [];
      
      chatAgent.on('processing_started', (e) => events.push({ type: 'started', data: e }));
      chatAgent.on('processing_complete', (e) => events.push({ type: 'complete', data: e }));
      
      mockLLMClient.setMockResponse('Test response');
      await chatAgent.processMessage('Test message');
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('started');
      expect(events[0].data.type).toBe('chat_processing');
      expect(events[1].type).toBe('complete');
      expect(events[1].data.type).toBe('chat_complete');
    });
    
    test('should prevent concurrent message processing', async () => {
      const errorPromise = new Promise(resolve => {
        chatAgent.on('error', resolve);
      });
      
      // Start first message
      mockLLMClient.setMockResponse('Response 1');
      const promise1 = chatAgent.processMessage('Message 1');
      
      // Try to send second message immediately
      await chatAgent.processMessage('Message 2');
      
      const error = await errorPromise;
      expect(error.type).toBe('processing_error');
      expect(error.message).toBe('Already processing a message');
      
      // Wait for first message to complete
      await promise1;
    });
  });
  
  describe('Prompt Building', () => {
    test('should build prompt with system message', async () => {
      mockLLMClient.setMockResponse('Response');
      
      // Spy on LLM client to capture prompt
      let capturedPrompt;
      mockLLMClient.complete = jest.fn(async (prompt) => {
        capturedPrompt = prompt;
        return 'Response';
      });
      
      await chatAgent.processMessage('Hello');
      
      expect(capturedPrompt).toContain('You are a helpful AI assistant');
      expect(capturedPrompt).toContain('Human: Hello');
      expect(capturedPrompt).toContain('Assistant:');
    });
    
    test('should include conversation history in prompt', async () => {
      // Add some history
      chatAgent.conversationHistory.push(
        { role: 'user', content: 'Previous question', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Previous answer', timestamp: new Date().toISOString() }
      );
      
      let capturedPrompt;
      mockLLMClient.complete = jest.fn(async (prompt) => {
        capturedPrompt = prompt;
        return 'New response';
      });
      
      await chatAgent.processMessage('New question');
      
      expect(capturedPrompt).toContain('Human: Previous question');
      expect(capturedPrompt).toContain('Assistant: Previous answer');
      expect(capturedPrompt).toContain('Human: New question');
    });
    
    test('should limit conversation history to recent messages', async () => {
      // Add 25 messages to history (more than the 20 limit)
      for (let i = 0; i < 25; i++) {
        chatAgent.conversationHistory.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: new Date().toISOString()
        });
      }
      
      let capturedPrompt;
      mockLLMClient.complete = jest.fn(async (prompt) => {
        capturedPrompt = prompt;
        return 'Response';
      });
      
      await chatAgent.processMessage('Latest message');
      
      // Should include messages starting from index 6 (25 - 19 to leave room for new message)
      expect(capturedPrompt).toContain('Message 6');
      expect(capturedPrompt).not.toContain('Message 4');
      expect(capturedPrompt).toContain('Message 24');
      expect(capturedPrompt).toContain('Human: Latest message');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle LLM client errors', async () => {
      const errorPromise = new Promise(resolve => {
        chatAgent.on('error', resolve);
      });
      
      // Make LLM client throw an error
      mockLLMClient.complete = jest.fn().mockRejectedValue(new Error('LLM API error'));
      
      await chatAgent.processMessage('Test message');
      
      const error = await errorPromise;
      expect(error.type).toBe('processing_error');
      expect(error.message).toContain('Failed to process message: LLM API error');
      expect(chatAgent.isProcessing).toBe(false);
    });
    
    test('should emit error when LLM client not initialized', async () => {
      chatAgent.llmClient = null;
      
      const errorPromise = new Promise(resolve => {
        chatAgent.on('error', resolve);
      });
      
      await chatAgent.processMessage('Test message');
      
      const error = await errorPromise;
      expect(error.type).toBe('processing_error');
      expect(error.message).toContain('Failed to process message');
    });
  });
  
  describe('History Management', () => {
    test('should clear conversation history', async () => {
      // Add some messages
      mockLLMClient.setMockResponse('Response 1');
      await chatAgent.processMessage('Message 1');
      
      expect(chatAgent.getHistory()).toHaveLength(2);
      
      // Clear history
      chatAgent.clearHistory();
      
      expect(chatAgent.getHistory()).toHaveLength(0);
    });
    
    test('should emit event when history is cleared', (done) => {
      chatAgent.on('history_cleared', (event) => {
        expect(event.type).toBe('chat_history_cleared');
        expect(event.sessionId).toBe('test-session-123');
        done();
      });
      
      chatAgent.clearHistory();
    });
  });
  
  describe('Message Handling', () => {
    test('should handle chat_message type', async () => {
      const responsePromise = new Promise(resolve => {
        chatAgent.on('response', resolve);
      });
      
      mockLLMClient.setMockResponse('Handled response');
      
      await chatAgent.handleMessage({
        type: 'chat_message',
        content: 'Test message'
      });
      
      const response = await responsePromise;
      expect(response.content).toBe('Handled response');
    });
    
    test('should handle clear_history type', () => {
      chatAgent.conversationHistory.push({ role: 'user', content: 'test' });
      
      chatAgent.handleMessage({
        type: 'clear_history'
      });
      
      expect(chatAgent.getHistory()).toHaveLength(0);
    });
    
    test('should handle get_history type', (done) => {
      chatAgent.conversationHistory.push(
        { role: 'user', content: 'Test 1' },
        { role: 'assistant', content: 'Response 1' }
      );
      
      chatAgent.on('history', (event) => {
        expect(event.type).toBe('chat_history');
        expect(event.history).toHaveLength(2);
        expect(event.sessionId).toBe('test-session-123');
        done();
      });
      
      chatAgent.handleMessage({
        type: 'get_history'
      });
    });
    
    test('should handle unknown message types gracefully', () => {
      // Should not throw
      expect(() => {
        chatAgent.handleMessage({
          type: 'unknown_type',
          data: 'some data'
        });
      }).not.toThrow();
    });
  });
  
  describe('Cleanup', () => {
    test('should clean up resources on destroy', () => {
      chatAgent.conversationHistory.push({ role: 'user', content: 'test' });
      
      chatAgent.destroy();
      
      expect(chatAgent.conversationHistory).toHaveLength(0);
      expect(chatAgent.llmClient).toBeNull();
      expect(chatAgent.listenerCount('response')).toBe(0);
    });
  });
});