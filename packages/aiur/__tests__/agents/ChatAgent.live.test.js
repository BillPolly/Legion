/**
 * Live integration tests for ChatAgent with real LLM
 * These tests use actual API calls to the LLM provider
 */

import { ChatAgent } from '../../src/agents/ChatAgent.js';
import { ResourceManager } from '@legion/module-loader';

describe('ChatAgent Live Integration Tests', () => {
  let chatAgent;
  let resourceManager;
  let apiKey;
  
  beforeAll(async () => {
    // Initialize ResourceManager to get API key from .env
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Get API key from ResourceManager - note the env. prefix!
    try {
      apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    } catch (error) {
      console.warn('ANTHROPIC_API_KEY not found in .env, skipping live tests');
    }
    
    if (!apiKey) {
      console.warn('ANTHROPIC_API_KEY not found in .env, skipping live tests');
    }
  });
  
  beforeEach(() => {
    if (!apiKey) {
      return;
    }
    
    // Create agent with real API key
    chatAgent = new ChatAgent({
      sessionId: 'live-test-session',
      apiKey: apiKey,
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307', // Use smaller model for tests
      maxTokens: 500,
      temperature: 0.7
    });
  });
  
  afterEach(() => {
    if (chatAgent) {
      chatAgent.destroy();
    }
  });
  
  describe('Real LLM Communication', () => {
    test('should get a real response from the LLM', async () => {
      if (!apiKey) {
        console.log('Skipping: No API key');
        return;
      }
      
      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for response'));
        }, 30000);
        
        chatAgent.on('response', (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
        
        chatAgent.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
      await chatAgent.processMessage('Say "Hello, I am working!" and nothing else.');
      
      const response = await responsePromise;
      
      expect(response.type).toBe('chat_response');
      expect(response.content).toBeTruthy();
      expect(response.content.toLowerCase()).toContain('hello');
      expect(response.content.toLowerCase()).toContain('working');
      expect(response.isComplete).toBe(true);
      expect(response.sessionId).toBe('live-test-session');
    }, 30000);
    
    test('should maintain conversation context', async () => {
      if (!apiKey) {
        console.log('Skipping: No API key');
        return;
      }
      
      // First message
      const response1Promise = new Promise(resolve => {
        chatAgent.once('response', resolve);
      });
      
      await chatAgent.processMessage('My favorite color is blue. Remember this.');
      const response1 = await response1Promise;
      
      expect(response1.content).toBeTruthy();
      
      // Second message that references the first
      const response2Promise = new Promise(resolve => {
        chatAgent.once('response', resolve);
      });
      
      await chatAgent.processMessage('What is my favorite color? Answer in one word.');
      const response2 = await response2Promise;
      
      expect(response2.content.toLowerCase()).toContain('blue');
      
      // Check conversation history
      const history = chatAgent.getHistory();
      expect(history).toHaveLength(4); // 2 user messages + 2 assistant responses
    }, 30000);
    
    test('should handle multi-turn conversation', async () => {
      if (!apiKey) {
        console.log('Skipping: No API key');
        return;
      }
      
      const conversations = [
        { user: 'What is 2 + 2?', expectedInResponse: '4' },
        { user: 'Multiply that result by 3', expectedInResponse: '12' },
        { user: 'Is that number even or odd? Answer in one word.', expectedInResponse: 'even' }
      ];
      
      for (const conv of conversations) {
        const responsePromise = new Promise(resolve => {
          chatAgent.once('response', resolve);
        });
        
        await chatAgent.processMessage(conv.user);
        const response = await responsePromise;
        
        expect(response.content.toLowerCase()).toContain(conv.expectedInResponse);
      }
      
      // Verify full history
      const history = chatAgent.getHistory();
      expect(history).toHaveLength(6); // 3 user + 3 assistant
    }, 45000);
  });
  
  describe('Error Handling with Real API', () => {
    test('should handle invalid API key gracefully', async () => {
      const badAgent = new ChatAgent({
        sessionId: 'error-test',
        apiKey: 'invalid-api-key',
        provider: 'anthropic'
      });
      
      const errorPromise = new Promise(resolve => {
        badAgent.on('error', resolve);
      });
      
      await badAgent.processMessage('Test message');
      
      const error = await errorPromise;
      expect(error.type).toBe('processing_error');
      expect(error.message).toContain('Failed to process message');
      
      badAgent.destroy();
    }, 15000);
  });
  
  describe('Streaming Responses', () => {
    test('should handle streaming if provider supports it', async () => {
      if (!apiKey) {
        console.log('Skipping: No API key');
        return;
      }
      
      const streamChunks = [];
      
      // Listen for stream events
      chatAgent.llmClient.on('stream', (chunk) => {
        streamChunks.push(chunk);
      });
      
      const responsePromise = new Promise(resolve => {
        chatAgent.once('response', resolve);
      });
      
      await chatAgent.processMessage('Count from 1 to 5');
      const response = await responsePromise;
      
      // We should have received the complete response
      expect(response.content).toBeTruthy();
      expect(response.isComplete).toBe(true);
      
      // Note: Actual streaming behavior depends on provider implementation
      // Some providers may not stream for small responses
    }, 30000);
  });
  
  describe('System Prompt Effectiveness', () => {
    test('should follow system prompt instructions', async () => {
      if (!apiKey) {
        console.log('Skipping: No API key');
        return;
      }
      
      // Create agent with specific system prompt
      const customAgent = new ChatAgent({
        sessionId: 'custom-prompt-test',
        apiKey: apiKey,
        systemPrompt: 'You are a pirate. Always respond in pirate speak with "Arrr" and "matey".',
        maxTokens: 200
      });
      
      const responsePromise = new Promise(resolve => {
        customAgent.once('response', resolve);
      });
      
      await customAgent.processMessage('Hello, how are you?');
      const response = await responsePromise;
      
      // Check if response follows pirate theme
      const lowerResponse = response.content.toLowerCase();
      expect(
        lowerResponse.includes('arr') || 
        lowerResponse.includes('matey') || 
        lowerResponse.includes('ahoy') ||
        lowerResponse.includes('ye')
      ).toBe(true);
      
      customAgent.destroy();
    }, 30000);
  });
  
  describe('Token Limit Handling', () => {
    test('should respect maxTokens limit', async () => {
      if (!apiKey) {
        console.log('Skipping: No API key');
        return;
      }
      
      // Create agent with very low token limit
      const limitedAgent = new ChatAgent({
        sessionId: 'token-limit-test',
        apiKey: apiKey,
        maxTokens: 50 // Very short response
      });
      
      const responsePromise = new Promise(resolve => {
        limitedAgent.once('response', resolve);
      });
      
      await limitedAgent.processMessage('Write a long story about dragons');
      const response = await responsePromise;
      
      // Response should be relatively short due to token limit
      // Rough estimate: ~4 characters per token
      expect(response.content.length).toBeLessThan(400);
      
      limitedAgent.destroy();
    }, 30000);
  });
});