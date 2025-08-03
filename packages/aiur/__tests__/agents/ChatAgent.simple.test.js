/**
 * Simple integration test for ChatAgent
 * Tests the basic functionality without complex mocking
 */

import { ChatAgent } from '../../src/agents/ChatAgent.js';

describe('ChatAgent Simple Tests', () => {
  let chatAgent;
  
  beforeEach(() => {
    // Set a dummy API key for testing
    process.env.ANTHROPIC_API_KEY = 'test-api-key-12345';
    
    chatAgent = new ChatAgent({
      sessionId: 'test-session',
      apiKey: 'test-api-key-12345'
    });
  });
  
  afterEach(() => {
    if (chatAgent) {
      chatAgent.destroy();
    }
  });
  
  describe('Basic Functionality', () => {
    test('should initialize correctly', () => {
      expect(chatAgent).toBeDefined();
      expect(chatAgent.sessionId).toBe('test-session');
      expect(chatAgent.conversationHistory).toEqual([]);
      expect(chatAgent.isProcessing).toBe(false);
    });
    
    test('should have correct ID format', () => {
      expect(chatAgent.id).toMatch(/^chat-agent-\d+-[a-z0-9]+$/);
    });
    
    test('should store configuration correctly', () => {
      expect(chatAgent.llmConfig.provider).toBe('anthropic');
      expect(chatAgent.llmConfig.apiKey).toBe('test-api-key-12345');
      expect(chatAgent.llmConfig.model).toBe('claude-3-sonnet-20240229');
      expect(chatAgent.llmConfig.maxTokens).toBe(2000);
    });
  });
  
  describe('History Management', () => {
    test('should start with empty history', () => {
      expect(chatAgent.getHistory()).toEqual([]);
    });
    
    test('should clear history', () => {
      // Manually add some history
      chatAgent.conversationHistory.push(
        { role: 'user', content: 'Test message' },
        { role: 'assistant', content: 'Test response' }
      );
      
      expect(chatAgent.getHistory()).toHaveLength(2);
      
      chatAgent.clearHistory();
      
      expect(chatAgent.getHistory()).toHaveLength(0);
    });
    
    test('should emit history_cleared event', (done) => {
      chatAgent.on('history_cleared', (event) => {
        expect(event.type).toBe('chat_history_cleared');
        expect(event.sessionId).toBe('test-session');
        done();
      });
      
      chatAgent.clearHistory();
    });
  });
  
  describe('Prompt Building', () => {
    test('should build prompt with system message', () => {
      const prompt = chatAgent.buildPrompt('Hello');
      
      expect(prompt).toContain('You are a helpful AI assistant');
      expect(prompt).toContain('Human: Hello');
      expect(prompt).toContain('Assistant:');
    });
    
    test('should include conversation history', () => {
      // Add some history
      chatAgent.conversationHistory.push(
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' }
      );
      
      const prompt = chatAgent.buildPrompt('New question');
      
      expect(prompt).toContain('Human: Previous question');
      expect(prompt).toContain('Assistant: Previous answer');
      expect(prompt).toContain('Human: New question');
    });
    
    test('should limit history to recent messages', () => {
      // Add 25 messages (more than 20 limit)
      for (let i = 0; i < 25; i++) {
        chatAgent.conversationHistory.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`
        });
      }
      
      const prompt = chatAgent.buildPrompt('Latest');
      
      // Should not include earliest messages
      expect(prompt).not.toContain('Message 0');
      expect(prompt).not.toContain('Message 1');
      expect(prompt).not.toContain('Message 2');
      expect(prompt).not.toContain('Message 3');
      expect(prompt).not.toContain('Message 4');
      
      // Should include recent messages
      expect(prompt).toContain('Message 23');
      expect(prompt).toContain('Message 24');
      expect(prompt).toContain('Human: Latest');
    });
  });
  
  describe('Message Handling', () => {
    test('should handle clear_history message', () => {
      chatAgent.conversationHistory.push({ role: 'user', content: 'test' });
      
      chatAgent.handleMessage({
        type: 'clear_history'
      });
      
      expect(chatAgent.getHistory()).toHaveLength(0);
    });
    
    test('should handle get_history message', (done) => {
      chatAgent.conversationHistory.push(
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' }
      );
      
      chatAgent.on('history', (event) => {
        expect(event.type).toBe('chat_history');
        expect(event.history).toHaveLength(2);
        expect(event.sessionId).toBe('test-session');
        done();
      });
      
      chatAgent.handleMessage({
        type: 'get_history'
      });
    });
    
    test('should handle unknown message types', () => {
      // Should not throw
      expect(() => {
        chatAgent.handleMessage({
          type: 'unknown_type',
          data: 'test'
        });
      }).not.toThrow();
    });
  });
  
  describe('Event Emitter', () => {
    test('should be an EventEmitter', () => {
      expect(chatAgent.on).toBeDefined();
      expect(chatAgent.emit).toBeDefined();
      expect(chatAgent.removeAllListeners).toBeDefined();
    });
    
    test('should emit custom events', (done) => {
      chatAgent.on('test_event', (data) => {
        expect(data).toBe('test_data');
        done();
      });
      
      chatAgent.emit('test_event', 'test_data');
    });
  });
  
  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      chatAgent.conversationHistory.push({ role: 'user', content: 'test' });
      const listenerCount = chatAgent.listenerCount('response');
      
      chatAgent.destroy();
      
      expect(chatAgent.conversationHistory).toHaveLength(0);
      expect(chatAgent.llmClient).toBeNull();
      expect(chatAgent.listenerCount('response')).toBe(0);
    });
    
    test('should handle multiple destroy calls', () => {
      expect(() => {
        chatAgent.destroy();
        chatAgent.destroy();
      }).not.toThrow();
    });
  });
  
  describe('Configuration', () => {
    test('should accept custom configuration', () => {
      const customAgent = new ChatAgent({
        sessionId: 'custom-session',
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        maxTokens: 1000,
        temperature: 0.5,
        systemPrompt: 'Custom system prompt'
      });
      
      expect(customAgent.llmConfig.model).toBe('claude-3-haiku-20240307');
      expect(customAgent.llmConfig.maxTokens).toBe(1000);
      expect(customAgent.llmConfig.temperature).toBe(0.5);
      expect(customAgent.systemPrompt).toBe('Custom system prompt');
      
      customAgent.destroy();
    });
    
    test('should use environment variable if no API key provided', () => {
      process.env.ANTHROPIC_API_KEY = 'env-api-key';
      
      const envAgent = new ChatAgent({
        sessionId: 'env-session'
      });
      
      expect(envAgent.llmConfig.apiKey).toBe('env-api-key');
      
      envAgent.destroy();
    });
  });
});