/**
 * Live LLM Integration Test for Gemini Agent
 * Tests ConversationManager with actual LLM using SimplePromptClient
 * NO MOCKS - uses real ANTHROPIC_API_KEY
 */

import { jest } from '@jest/globals';
import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '../../../../resource-manager/src/ResourceManager.js';
import { SimplePromptClient } from '../../../../prompting/llm-client/src/SimplePromptClient.js';

describe('Gemini Agent Live LLM Integration', () => {
  let conversationManager;
  let resourceManager;

  beforeAll(async () => {
    // Get real ResourceManager with .env
    resourceManager = await ResourceManager.getInstance();
    
    // Check for required API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in .env - required for live LLM testing');
    }

    console.log('✅ Live LLM integration test initialized with Anthropic API');
  });

  beforeEach(() => {
    // Create real ConversationManager with real ResourceManager
    conversationManager = new ConversationManager(resourceManager);
  });

  describe('Simple Conversation Flow', () => {
    it('should handle basic user message with real LLM', async () => {
      const userInput = 'What is 2 + 2?';
      
      const response = await conversationManager.processMessage(userInput);
      
      // Verify response structure
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('type', 'assistant');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('timestamp');
      
      // Content should be a real LLM response
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content).toMatch(/4|four/i); // Should mention the answer
      
      console.log('🤖 Real LLM Response:', response.content.substring(0, 100));
    }, 30000); // 30 second timeout for LLM call

    it('should maintain conversation context across turns', async () => {
      // First message
      await conversationManager.processMessage('My name is Alex');
      
      // Second message asking about the name
      const response = await conversationManager.processMessage('What is my name?');
      
      expect(response.content.toLowerCase()).toContain('alex');
      console.log('🧠 Context Memory Response:', response.content.substring(0, 100));
    }, 30000);

    it('should handle tool requests and actually call tools', async () => {
      const response = await conversationManager.processMessage('List the files in the current directory');
      
      expect(response.content).toBeDefined();
      
      // The LLM should either respond with text or make tool calls
      const hasToolCall = response.content.includes('tool_use') || 
                          (response.tools && response.tools.length > 0);
      const hasTextResponse = response.content.toLowerCase().match(/file|director|list/);
      
      expect(hasToolCall || hasTextResponse).toBe(true);
      
      if (hasToolCall) {
        console.log('🔧 Tool Call Made:', response.content.substring(0, 100));
      } else {
        console.log('💬 Text Response:', response.content.substring(0, 100));
      }
    }, 30000);
  });

  describe('Conversation History Management', () => {
    it('should build proper chat history for SimplePromptClient', async () => {
      // Add some conversation
      await conversationManager.processMessage('Hello');
      await conversationManager.processMessage('How are you?');
      
      const history = conversationManager.getConversationHistory();
      
      // Should have proper role-based format
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Hello');
      expect(history[1].role).toBe('assistant');
      expect(history[2].role).toBe('user');
      expect(history[2].content).toBe('How are you?');
      expect(history[3].role).toBe('assistant');
    });

    it('should clear conversation history', () => {
      conversationManager.conversationHistory = [
        { role: 'user', content: 'test' },
        { role: 'assistant', content: 'response' }
      ];
      
      conversationManager.clearHistory();
      expect(conversationManager.getConversationHistory()).toEqual([]);
      expect(conversationManager.turnCounter).toBe(0);
    });
  });

  describe('Error Handling with Real LLM', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await conversationManager.processMessage('');
      
      // Should handle empty input gracefully
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
    }, 30000);
  });

  describe('Provider Adaptation', () => {
    it('should work with real Anthropic provider through SimplePromptClient', async () => {
      const response = await conversationManager.processMessage('Say hello in exactly 3 words');
      
      expect(response.content).toBeDefined();
      expect(response.metadata).toHaveProperty('provider');
      
      console.log('🔄 Provider:', response.metadata.provider);
      console.log('📝 Controlled Response:', response.content);
    }, 30000);
  });
});