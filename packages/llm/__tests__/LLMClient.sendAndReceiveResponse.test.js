import { jest } from '@jest/globals';
import { LLMClient, MaxRetriesExceededError } from '../src/LLMClient.js';

describe('LLMClient sendAndReceiveResponse', () => {
  let client;
  let originalConsoleLog;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console.log during tests
    originalConsoleLog = console.log;
    console.log = jest.fn();
    
    client = new LLMClient({
      provider: 'mock',
      maxRetries: 3,
      baseDelay: 10 // Short delay for tests
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('successful responses', () => {
    it('should successfully send messages and receive response', async () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' }
      ];
      
      const response = await client.sendAndReceiveResponse(messages);
      
      expect(typeof response).toBe('string');
      expect(response).toContain('Hello');
    });

    it('should handle single message', async () => {
      const messages = [{ role: 'user', content: 'Test message' }];
      
      const response = await client.sendAndReceiveResponse(messages);
      
      expect(typeof response).toBe('string');
      expect(response).toContain('Test message');
    });

    it('should pass through options', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const options = {
        model: 'quantum-nexus-v7',
        temperature: 0.5,
        maxTokens: 2000
      };
      
      const response = await client.sendAndReceiveResponse(messages, options);
      
      expect(response).toContain('Quantum Nexus v7');
    });
  });

  describe('event emission', () => {
    it('should emit events for successful requests', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const events = [];
      
      client.on('interaction', event => events.push(event));
      
      await client.sendAndReceiveResponse(messages);
      
      expect(events.length).toBeGreaterThanOrEqual(2);
      const requestEvent = events.find(e => e.type === 'chat_request');
      const responseEvent = events.find(e => e.type === 'chat_response');
      
      expect(requestEvent).toBeDefined();
      expect(requestEvent.messages).toEqual(messages);
      expect(responseEvent).toBeDefined();
      expect(typeof responseEvent.response).toBe('string');
    });
  });

  describe('zero retries configuration', () => {
    beforeEach(() => {
      client = new LLMClient({
        provider: 'mock',
        maxRetries: 0
      });
    });

    it('should throw immediately with zero retries', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      
      await expect(client.sendAndReceiveResponse(messages))
        .rejects.toThrow(MaxRetriesExceededError);
    });
  });

  describe('provider support', () => {
    it('should work with DeepSeek provider configuration', () => {
      const deepseekClient = new LLMClient({
        provider: 'deepseek',
        apiKey: 'test-key',
        model: 'deepseek-chat'
      });
      
      expect(deepseekClient.getProviderName()).toBe('deepseek');
    });

    it('should work with OpenRouter provider configuration', () => {
      const openrouterClient = new LLMClient({
        provider: 'openrouter',
        apiKey: 'test-key',
        model: 'anthropic/claude-3-sonnet'
      });
      
      expect(openrouterClient.getProviderName()).toBe('openrouter');
    });
  });
});