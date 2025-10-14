import { jest } from '@jest/globals';
import { VoiceChatBot } from '../../src/VoiceChatBot.js';

// Mock LLMClient
jest.unstable_mockModule('@legion/llm-client', () => ({
  LLMClient: class MockLLMClient {
    constructor(config) {
      this.config = config;
      this.mockResponses = [];
      this.mockResponseIndex = 0;
    }

    _setMockResponses(responses) {
      this.mockResponses = responses;
      this.mockResponseIndex = 0;
    }

    async request() {
      const response = this.mockResponses[this.mockResponseIndex] || 'Mock response';
      this.mockResponseIndex++;
      return { content: response };
    }

    getProviderName() {
      return this.config.provider || 'zai';
    }

    get currentModel() {
      return this.config.model || 'glm-4.6';
    }
  }
}));

describe('VoiceChatBot', () => {
  let chatbot;

  beforeEach(() => {
    chatbot = new VoiceChatBot({
      provider: 'zai',
      apiKey: 'test-key',
      model: 'glm-4.6',
      systemPrompt: 'You are a test assistant.',
      maxHistoryLength: 5
    });
  });

  describe('initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(chatbot.systemPrompt).toBe('You are a test assistant.');
      expect(chatbot.maxHistoryLength).toBe(5);
      expect(chatbot.history).toEqual([]);
    });

    test('should use default values when not provided', () => {
      const defaultBot = new VoiceChatBot({
        apiKey: 'test-key'
      });

      expect(defaultBot.systemPrompt).toBe('You are a helpful assistant.');
      expect(defaultBot.maxHistoryLength).toBe(20);
    });
  });

  describe('sendMessage', () => {
    test('should add user message to history', async () => {
      chatbot.llmClient._setMockResponses(['Hello!']);

      await chatbot.sendMessage('Hi there');

      expect(chatbot.history).toHaveLength(2);
      expect(chatbot.history[0]).toEqual({
        role: 'user',
        content: 'Hi there'
      });
    });

    test('should add assistant response to history', async () => {
      chatbot.llmClient._setMockResponses(['Hello! How can I help?']);

      const response = await chatbot.sendMessage('Hi');

      expect(response).toBe('Hello! How can I help?');
      expect(chatbot.history[1]).toEqual({
        role: 'assistant',
        content: 'Hello! How can I help?'
      });
    });

    test('should handle multiple messages', async () => {
      chatbot.llmClient._setMockResponses([
        'Response 1',
        'Response 2',
        'Response 3'
      ]);

      await chatbot.sendMessage('Message 1');
      await chatbot.sendMessage('Message 2');
      await chatbot.sendMessage('Message 3');

      expect(chatbot.history).toHaveLength(6); // 3 user + 3 assistant
    });
  });

  describe('history management', () => {
    test('should trim history when exceeds max length', async () => {
      chatbot.llmClient._setMockResponses([
        'R1', 'R2', 'R3', 'R4', 'R5', 'R6'
      ]);

      // Send 6 messages (12 entries total: 6 user + 6 assistant)
      for (let i = 1; i <= 6; i++) {
        await chatbot.sendMessage(`Message ${i}`);
      }

      // Should be trimmed to max length of 5
      expect(chatbot.history.length).toBeLessThanOrEqual(5);
    });

    test('should keep most recent messages when trimming', async () => {
      chatbot.llmClient._setMockResponses([
        'R1', 'R2', 'R3', 'R4', 'R5', 'R6'
      ]);

      for (let i = 1; i <= 6; i++) {
        await chatbot.sendMessage(`Message ${i}`);
      }

      // Most recent message should be in history
      const lastMessage = chatbot.history[chatbot.history.length - 1];
      expect(lastMessage.content).toBe('R6');
    });
  });

  describe('clearHistory', () => {
    test('should clear conversation history', async () => {
      chatbot.llmClient._setMockResponses(['Response']);

      await chatbot.sendMessage('Test');
      expect(chatbot.history).toHaveLength(2);

      chatbot.clearHistory();
      expect(chatbot.history).toEqual([]);
    });
  });

  describe('getHistory', () => {
    test('should return copy of history', async () => {
      chatbot.llmClient._setMockResponses(['Response']);

      await chatbot.sendMessage('Test');
      const history = chatbot.getHistory();

      expect(history).toEqual(chatbot.history);
      expect(history).not.toBe(chatbot.history); // Should be a copy
    });
  });

  describe('getHistoryText', () => {
    test('should format history as text', async () => {
      chatbot.llmClient._setMockResponses(['Hello!', 'Fine thanks!']);

      await chatbot.sendMessage('Hi');
      await chatbot.sendMessage('How are you?');

      const text = chatbot.getHistoryText();

      expect(text).toContain('You: Hi');
      expect(text).toContain('Assistant: Hello!');
      expect(text).toContain('You: How are you?');
      expect(text).toContain('Assistant: Fine thanks!');
    });

    test('should return empty string for empty history', () => {
      const text = chatbot.getHistoryText();
      expect(text).toBe('');
    });
  });

  describe('setSystemPrompt', () => {
    test('should update system prompt', () => {
      chatbot.setSystemPrompt('New system prompt');
      expect(chatbot.systemPrompt).toBe('New system prompt');
    });
  });

  describe('getProviderInfo', () => {
    test('should return provider information', () => {
      const info = chatbot.getProviderInfo();

      expect(info).toEqual({
        provider: 'zai',
        model: 'glm-4.6'
      });
    });
  });
});
