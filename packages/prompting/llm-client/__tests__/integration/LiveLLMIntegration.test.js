/**
 * Live LLM Integration Tests
 * Tests the unified interface with real LLM providers
 */

import { jest } from '@jest/globals';
import { LLMClient } from '../../src/LLMClient.js';

describe('Live LLM Integration Tests', () => {
  let anthropicClient;
  let openaiClient;
  
  beforeAll(async () => {
    // Get ResourceManager for real API keys
    try {
      const { ResourceManager } = await import('@legion/resource-manager');
      const resourceManager = await ResourceManager.getInstance();
      
      const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
      const openaiKey = resourceManager.get('env.OPENAI_API_KEY');
      
      if (anthropicKey) {
        anthropicClient = new LLMClient({
          provider: 'anthropic',
          apiKey: anthropicKey,
          model: 'claude-3-sonnet-20240229',
          maxRetries: 1
        });
        console.log('✅ Anthropic client initialized');
      }
      
      if (openaiKey) {
        openaiClient = new LLMClient({
          provider: 'openai', 
          apiKey: openaiKey,
          model: 'gpt-3.5-turbo',
          maxRetries: 1
        });
        console.log('✅ OpenAI client initialized');
      }
      
    } catch (error) {
      console.warn('⚠️  Could not initialize live clients:', error.message);
    }
  });

  describe('Anthropic Provider Live Tests', () => {
    beforeEach(() => {
      if (!anthropicClient) {
        pending('Anthropic API key not available');
      }
    });

    it('should handle simple unified request with Anthropic', async () => {
      const response = await anthropicClient.request({
        systemPrompt: "You are a helpful assistant. Respond briefly.",
        prompt: "What is 2+2?"
      });
      
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('metadata');
      expect(response.metadata.provider).toBe('anthropic');
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
    });

    it('should adapt tools to XML format for Anthropic', async () => {
      const response = await anthropicClient.request({
        systemPrompt: "You are a helpful assistant with access to tools",
        tools: [
          {
            name: 'calculator',
            description: 'Perform mathematical calculations',
            parameters: {
              type: 'object',
              properties: {
                expression: {
                  type: 'string',
                  description: 'Mathematical expression to evaluate'
                }
              },
              required: ['expression']
            }
          }
        ],
        prompt: "Calculate 15 * 7 using the calculator tool"
      });
      
      expect(response.content).toBeDefined();
      expect(response.metadata.adaptations).toContain('tools_as_xml');
      
      // Check if response contains tool usage
      const toolCalls = anthropicClient.extractToolCalls(response.content);
      if (toolCalls && toolCalls.length > 0) {
        expect(toolCalls[0]).toHaveProperty('name');
        expect(toolCalls[0]).toHaveProperty('args');
        console.log('🔧 Tool calls extracted from Anthropic response:', toolCalls.length);
      }
    });

    it('should handle chat history with Anthropic', async () => {
      const response = await anthropicClient.request({
        systemPrompt: "Continue this conversation naturally",
        chatHistory: [
          {role: 'user', content: 'Hello, my name is Alex'},
          {role: 'assistant', content: 'Nice to meet you Alex! How can I help you today?'}
        ],
        prompt: "What was my name again?"
      });
      
      expect(response.content).toBeDefined();
      expect(response.content.toLowerCase()).toContain('alex');
    });

    it('should handle files by injecting content', async () => {
      const response = await anthropicClient.request({
        systemPrompt: "Analyze the provided code file",
        files: [
          {
            name: 'example.js',
            content: 'function greet(name) { return "Hello " + name; }',
            type: 'text'
          }
        ],
        prompt: "What does this function do?"
      });
      
      expect(response.content).toBeDefined();
      expect(response.metadata.adaptations).toContain('files_as_text');
      expect(response.content.toLowerCase()).toContain('greet');
    });
  });

  describe('OpenAI Provider Live Tests', () => {
    beforeEach(() => {
      if (!openaiClient) {
        pending('OpenAI API key not available');
      }
    });

    it('should handle simple unified request with OpenAI', async () => {
      const response = await openaiClient.request({
        systemPrompt: "You are a helpful assistant. Be brief.",
        prompt: "What is the capital of France?"
      });
      
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('metadata');
      expect(response.metadata.provider).toBe('openai');
      expect(typeof response.content).toBe('string');
      expect(response.content.toLowerCase()).toContain('paris');
    });

    it('should use native OpenAI features without adaptation', async () => {
      const response = await openaiClient.request({
        systemPrompt: "You are a helpful assistant",
        chatHistory: [
          {role: 'user', content: 'I need help with math'},
          {role: 'assistant', content: 'I can help you with mathematical problems'}
        ],
        prompt: "What's 25 * 4?",
        temperature: 0.1
      });
      
      expect(response.content).toBeDefined();
      expect(response.metadata.provider).toBe('openai');
      
      // OpenAI should have minimal adaptations since it supports most features natively
      const adaptations = response.metadata.adaptations || [];
      expect(adaptations.length).toBeLessThanOrEqual(1); // Maybe files_as_text at most
    });

    it('should handle complex request with all features', async () => {
      const response = await openaiClient.request({
        systemPrompt: "You are a coding assistant with access to tools",
        chatHistory: [
          {role: 'user', content: 'I want to write a function'},
          {role: 'assistant', content: 'I can help you write functions. What should it do?'}
        ],
        tools: [
          {
            name: 'execute_code',
            description: 'Execute JavaScript code',
            parameters: {
              type: 'object',
              properties: {
                code: {type: 'string', description: 'JavaScript code to execute'}
              },
              required: ['code']
            }
          }
        ],
        files: [
          {
            name: 'utils.js',
            content: 'function add(a, b) { return a + b; }',
            type: 'text'
          }
        ],
        prompt: "Create a test for the add function",
        temperature: 0.3,
        maxTokens: 500
      });
      
      expect(response.content).toBeDefined();
      expect(response.metadata.provider).toBe('openai');
      
      // Check that the response mentions the add function
      expect(response.content.toLowerCase()).toContain('add');
    });
  });

  describe('Provider Adaptation Verification', () => {
    it('should demonstrate different adaptations for same request', async () => {
      const universalRequest = {
        systemPrompt: "You are helpful",
        tools: [{
          name: 'test_tool',
          description: 'A test tool',
          parameters: {type: 'object', properties: {input: {type: 'string'}}}
        }],
        chatHistory: [{role: 'user', content: 'Hi'}, {role: 'assistant', content: 'Hello'}],
        prompt: "Use the tool to process 'test data'",
        temperature: 0.5
      };

      const adaptationResults = {};

      // Test mock provider adaptation
      const mockClient = new LLMClient({provider: 'mock', maxRetries: 1});
      const mockCapabilities = mockClient.getProviderCapabilities();
      const mockAdapted = mockClient.adaptRequestToProvider(universalRequest, mockCapabilities);
      adaptationResults.mock = {
        adaptations: mockAdapted.adaptations,
        hasPrompt: !!mockAdapted.prompt,
        hasMessages: !!mockAdapted.messages
      };

      // Test anthropic adaptation (simulated)
      const anthropicCapabilities = {
        tools: false, chatHistory: true, systemPrompts: true,
        files: {text: true}, parameters: ['temperature', 'maxTokens']
      };
      const anthropicAdapted = mockClient.adaptForAnthropic(universalRequest, anthropicCapabilities, {model: 'claude', maxTokens: 1000, adaptations: []});
      adaptationResults.anthropic = {
        adaptations: anthropicAdapted.adaptations,
        hasSystem: !!anthropicAdapted.system,
        hasMessages: !!anthropicAdapted.messages,
        systemIncludesTools: anthropicAdapted.system?.includes('<tool') || false
      };

      // Test openai adaptation (simulated)
      const openaiCapabilities = {
        tools: true, chatHistory: true, systemPrompts: true,
        files: {text: true}, parameters: ['temperature', 'topP', 'maxTokens']
      };
      const openaiAdapted = mockClient.adaptForOpenAI(universalRequest, openaiCapabilities, {model: 'gpt-4', maxTokens: 1000, adaptations: []});
      adaptationResults.openai = {
        adaptations: openaiAdapted.adaptations,
        hasTools: !!openaiAdapted.tools,
        hasMessages: !!openaiAdapted.messages,
        toolCount: openaiAdapted.tools?.length || 0
      };

      console.log('🔄 Adaptation Results:', JSON.stringify(adaptationResults, null, 2));

      // Verify different providers handle the same request differently
      expect(adaptationResults.mock.adaptations).toContain('tools_as_descriptions');
      expect(adaptationResults.anthropic.systemIncludesTools).toBe(true);
      expect(adaptationResults.openai.toolCount).toBe(1);
      
      // All should handle the request successfully but differently
      expect(adaptationResults.mock.hasPrompt).toBe(true);
      expect(adaptationResults.anthropic.hasSystem).toBe(true);
      expect(adaptationResults.openai.hasTools).toBe(true);
    });
  });
});