/**
 * PromptManager Unified Request Integration Tests
 * Tests the complete pipeline with the new unified interface
 */

import { jest } from '@jest/globals';
import { PromptManager } from '../../src/PromptManager.js';
import { LLMClient } from '../../../llm-client/src/LLMClient.js';

describe('PromptManager Unified Request Integration', () => {
  let promptManager;
  let llmClient;
  let originalConsoleLog;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console.log during tests
    originalConsoleLog = console.log;
    console.log = jest.fn();

    // Create LLM client with mock provider
    llmClient = new LLMClient({
      provider: 'mock',
      maxRetries: 1,
      baseDelay: 10
    });

    // Create PromptManager with minimal configuration
    promptManager = new PromptManager({
      llmClient: llmClient,
      
      objectQuery: {
        bindings: {
          prompt: { path: 'prompt' }
        }
      },
      
      promptBuilder: {
        template: "{{prompt}}"
      },
      
      outputSchema: {
        type: "object",
        properties: {
          content: { type: "string" }
        },
        required: ["content"]
      },
      
      retryConfig: {
        maxAttempts: 2,
        errorFeedback: { enabled: true }
      }
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('Basic Unified Request', () => {
    it('should process simple unified request through complete pipeline', async () => {
      const response = await promptManager.request({
        systemPrompt: "You are a helpful assistant",
        prompt: "What is the capital of France?",
        maxTokens: 100,
        outputSchema: false // Explicitly disable validation
      });

      expect(response.success).toBe(true);
      expect(response.stage).toBe('completed');
      expect(response).toHaveProperty('content');
      expect(response.metadata).toHaveProperty('interface', 'unified_request');
      expect(response.metadata).toHaveProperty('executionTimeMs');
      expect(response.metadata.llmCall).toHaveProperty('provider', 'mock');
    });

    it('should handle rich request with all features', async () => {
      const response = await promptManager.request({
        systemPrompt: "You are a coding assistant with access to tools",
        chatHistory: [
          {role: 'user', content: 'I need help coding'},
          {role: 'assistant', content: 'I can help with that'}
        ],
        tools: [
          {
            name: 'execute_code',
            description: 'Execute JavaScript code',
            parameters: {
              type: 'object',
              properties: {
                code: {type: 'string'}
              }
            }
          },
          {
            name: 'search_docs',
            description: 'Search documentation',
            parameters: {
              type: 'object',
              properties: {
                query: {type: 'string'}
              }
            }
          }
        ],
        files: [
          {
            name: 'app.js',
            content: 'function main() { console.log("Hello World"); }',
            type: 'text'
          }
        ],
        prompt: "Help me understand this code and suggest improvements",
        temperature: 0.3,
        maxTokens: 500,
        outputSchema: false
      });

      expect(response.success).toBe(true);
      expect(response).toHaveProperty('content');
      expect(response.metadata.llmCall.adaptations).toEqual(
        expect.arrayContaining(['chat_history_as_text', 'files_as_text', 'tools_as_descriptions'])
      );
    });
  });

  describe('Provider Adaptation Through PromptManager', () => {
    it('should show different adaptations for different providers', async () => {
      const testRequest = {
        systemPrompt: "You are helpful",
        tools: [{name: 'calc', description: 'Calculate', parameters: {type: 'object'}}],
        prompt: "Help me",
        outputSchema: false
      };

      // Test with mock provider
      const mockResponse = await promptManager.request(testRequest);
      expect(mockResponse.metadata.llmCall.adaptations).toContain('tools_as_descriptions');

      // Simulate different providers by changing the client's provider name
      const originalGetProviderName = llmClient.provider.getProviderName;

      // Test Anthropic adaptation
      llmClient.provider.getProviderName = () => 'anthropic';
      const anthropicResponse = await promptManager.request(testRequest);
      expect(anthropicResponse.metadata.llmCall.adaptations).toContain('tools_as_xml');

      // Test OpenAI adaptation  
      llmClient.provider.getProviderName = () => 'openai';
      const openaiResponse = await promptManager.request(testRequest);
      expect(openaiResponse.metadata.llmCall.adaptations).toEqual([]);

      // Restore original provider
      llmClient.provider.getProviderName = originalGetProviderName;
    });
  });

  describe('Error Handling and Retry', () => {
    it('should maintain retry functionality with unified requests', async () => {
      // Create a client that will fail initially
      const flakyClient = new LLMClient({
        provider: 'mock',
        maxRetries: 2
      });
      
      // Mock the complete method to fail once then succeed
      let callCount = 0;
      const originalComplete = flakyClient.complete.bind(flakyClient);
      flakyClient.complete = async (...args) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary failure');
        }
        return originalComplete(...args);
      };

      const flakyPromptManager = new PromptManager({
        llmClient: flakyClient,
        objectQuery: { 
          bindings: {
            prompt: { path: 'prompt' }
          }
        },
        promptBuilder: { template: "{{prompt}}" },
        outputSchema: {
          type: "object",
          properties: {
            content: { type: "string" }
          },
          required: ["content"]
        },
        retryConfig: { maxAttempts: 2 }
      });

      const response = await flakyPromptManager.request({
        prompt: "Test retry functionality",
        outputSchema: false
      });

      expect(response.success).toBe(true);
      expect(response.metadata.attempts).toBe(2);
      expect(callCount).toBe(2);
    });
  });

  describe('Tool Call Processing', () => {
    it('should extract and process tool calls from responses', async () => {
      // Mock a response that contains tool usage
      const originalComplete = llmClient.complete.bind(llmClient);
      llmClient.complete = async () => {
        return 'I need to calculate: <tool_use name="calculator" parameters=\'{"expression": "10 + 5"}\'></tool_use> The result would be 15.';
      };

      const response = await promptManager.request({
        systemPrompt: "You have access to tools",
        tools: [{
          name: 'calculator',
          description: 'Perform calculations',
          parameters: {type: 'object', properties: {expression: {type: 'string'}}}
        }],
        prompt: "What is 10 + 5?",
        outputSchema: false
      });

      expect(response.success).toBe(true);
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls[0]).toEqual({
        name: 'calculator',
        args: {expression: '10 + 5'},
        id: expect.stringMatching(/^tool_\d+_[a-z0-9]+$/)
      });

      // Restore original method
      llmClient.complete = originalComplete;
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing PromptManager.execute() functionality', async () => {
      const sourceObject = {
        userInput: "Hello world"
      };

      // This should still work with the original interface
      const response = await promptManager.execute(sourceObject);

      expect(response).toHaveProperty('success');
      expect(response.metadata).not.toHaveProperty('interface');
    });

    it('should maintain existing LLMClient.complete() functionality', async () => {
      const response = await llmClient.complete("Simple prompt", 100);

      expect(typeof response).toBe('string');
      expect(response).toContain('Simple prompt');
    });
  });

  describe('Performance and Metadata', () => {
    it('should provide comprehensive metadata about the execution', async () => {
      const startTime = Date.now();
      
      const response = await promptManager.request({
        systemPrompt: "You are helpful",
        prompt: "Quick response please",
        maxTokens: 50,
        outputSchema: false
      });

      const endTime = Date.now();

      expect(response.metadata).toEqual(
        expect.objectContaining({
          interface: 'unified_request',
          executionId: expect.stringMatching(/^exec_\d+_[a-z0-9]+$/),
          executionTimeMs: expect.any(Number),
          attempts: expect.any(Number),
          llmCall: expect.objectContaining({
            durationMs: expect.any(Number),
            provider: 'mock',
            adaptations: expect.any(Array)
          })
        })
      );

      expect(response.metadata.executionTimeMs).toBeLessThan(endTime - startTime + 100); // Some tolerance
    });
  });
});