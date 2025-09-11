/**
 * SimplePromptClient Tests
 * Tests the user-friendly SimplePromptClient wrapper
 */

import { jest } from '@jest/globals';
import { SimplePromptClient } from '../src/SimplePromptClient.js';
import { LLMClient } from '../src/LLMClient.js';

describe('SimplePromptClient', () => {
  let simpleClient;
  let mockLLMClient;
  let originalConsoleLog;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console.log during tests
    originalConsoleLog = console.log;
    console.log = jest.fn();

    // Create mock LLMClient
    mockLLMClient = {
      request: jest.fn().mockResolvedValue({
        content: 'Mock response',
        toolCalls: [],
        metadata: { provider: 'mock', adaptations: [] }
      }),
      getProviderCapabilities: jest.fn().mockReturnValue({
        tools: false,
        chatHistory: false,
        systemPrompts: false
      })
    };

    simpleClient = new SimplePromptClient({
      llmClient: mockLLMClient
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('Basic Chat Methods', () => {
    it('should handle simple chat', async () => {
      const response = await simpleClient.chat('Hello');
      
      expect(response).toBe('Mock response');
      expect(mockLLMClient.request).toHaveBeenCalledWith({
        prompt: 'Hello',
        systemPrompt: undefined,
        chatHistory: [],
        tools: [],
        files: [],
        maxTokens: 1000,
        temperature: 0.7
      });
    });

    it('should handle chat with system prompt', async () => {
      const response = await simpleClient.chatWith('Hello', 'You are helpful');
      
      expect(response).toBe('Mock response');
      expect(mockLLMClient.request).toHaveBeenCalledWith({
        prompt: 'Hello',
        systemPrompt: 'You are helpful',
        chatHistory: [],
        tools: [],
        files: [],
        maxTokens: 1000,
        temperature: 0.7
      });
    });

    it('should continue chat with history', async () => {
      const chatHistory = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' }
      ];

      const response = await simpleClient.continueChat('How are you?', chatHistory);
      
      expect(response.content).toBe('Mock response');
      expect(response.chatHistory).toHaveLength(4);
      expect(response.chatHistory[2]).toEqual({ role: 'user', content: 'How are you?' });
      expect(response.chatHistory[3]).toEqual({ role: 'assistant', content: 'Mock response' });
      
      expect(mockLLMClient.request).toHaveBeenCalledWith({
        prompt: 'How are you?',
        chatHistory: chatHistory,
        systemPrompt: undefined,
        tools: [],
        files: [],
        maxTokens: 1000,
        temperature: 0.7
      });
    });
  });

  describe('Advanced Features', () => {
    it('should handle tools', async () => {
      const tools = [{
        name: 'calculator',
        description: 'Does math',
        parameters: { type: 'object', properties: { expression: { type: 'string' }}}
      }];

      await simpleClient.useTools('Calculate 2+2', tools, 'You can use tools');
      
      expect(mockLLMClient.request).toHaveBeenCalledWith({
        prompt: 'Calculate 2+2',
        tools: tools,
        systemPrompt: 'You can use tools',
        chatHistory: [],
        files: [],
        maxTokens: 1000,
        temperature: 0.7
      });
    });

    it('should handle file analysis', async () => {
      const files = [{
        name: 'test.txt',
        content: 'Hello world',
        type: 'text'
      }];

      await simpleClient.analyzeFiles(files, 'What does this say?');
      
      expect(mockLLMClient.request).toHaveBeenCalledWith({
        prompt: 'What does this say?',
        files: files,
        tools: [],
        systemPrompt: 'You are a helpful assistant that analyzes files and provides insights.',
        chatHistory: [],
        maxTokens: 1000,
        temperature: 0.7
      });
    });

    it('should handle rich request with all features', async () => {
      const requestOptions = {
        prompt: 'Help me',
        systemPrompt: 'You are helpful',
        chatHistory: [{ role: 'user', content: 'Hi' }],
        tools: [{ name: 'test', description: 'Test tool', parameters: {} }],
        files: [{ name: 'file.txt', content: 'content' }],
        maxTokens: 2000,
        temperature: 0.5
      };

      const response = await simpleClient.request(requestOptions);
      
      expect(response.content).toBe('Mock response');
      expect(mockLLMClient.request).toHaveBeenCalledWith({
        prompt: 'Help me',
        systemPrompt: 'You are helpful', 
        chatHistory: [{ role: 'user', content: 'Hi' }],
        tools: [{ name: 'test', description: 'Test tool', parameters: {} }],
        files: [{ name: 'file.txt', content: 'content' }],
        maxTokens: 2000,
        temperature: 0.5
      });
    });
  });

  describe('Configuration', () => {
    it('should use default options', async () => {
      await simpleClient.chat('Hello');
      
      expect(mockLLMClient.request).toHaveBeenCalledWith({
        prompt: 'Hello',
        systemPrompt: undefined,
        chatHistory: [],
        tools: [],
        files: [],
        maxTokens: 1000,
        temperature: 0.7
      });
    });

    it('should allow override of default options', async () => {
      const customClient = new SimplePromptClient({
        llmClient: mockLLMClient,
        defaultOptions: {
          maxTokens: 500,
          temperature: 0.3
        }
      });

      await customClient.chat('Hello');
      
      expect(mockLLMClient.request).toHaveBeenCalledWith({
        prompt: 'Hello',
        systemPrompt: undefined,
        chatHistory: [],
        tools: [],
        files: [],
        maxTokens: 500,
        temperature: 0.3
      });
    });

    it('should provide access to capabilities', () => {
      const capabilities = simpleClient.getCapabilities();
      expect(capabilities.tools).toBe(false);
      expect(mockLLMClient.getProviderCapabilities).toHaveBeenCalled();
    });

    it('should provide access to underlying LLMClient', () => {
      const llmClient = simpleClient.getLLMClient();
      expect(llmClient).toBe(mockLLMClient);
    });
  });

  describe('LLMClient Integration', () => {
    it('should create its own LLMClient if not provided', () => {
      const standalone = new SimplePromptClient({
        provider: 'mock',
        apiKey: 'test'
      });

      expect(standalone.llmClient).toBeInstanceOf(LLMClient);
    });
  });
});