/**
 * Tests for LLM Client wrapper
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LLMClient } from '../../src/core/LLMClient.js';

// Mock LLM response
const mockLLMResponse = (content) => ({
  choices: [{
    message: {
      content: typeof content === 'string' ? content : JSON.stringify(content)
    }
  }]
});

describe('LLMClient', () => {
  let client;
  let mockProvider;

  beforeEach(() => {
    // Create mock provider
    mockProvider = {
      complete: jest.fn(),
      completeStreaming: jest.fn(),
      name: 'mock-provider',
      maxTokens: 4096
    };

    client = new LLMClient({ provider: mockProvider });
  });

  describe('Constructor and Configuration', () => {
    test('should create client with provider', () => {
      expect(client.provider).toBe(mockProvider);
      expect(client.config.maxRetries).toBe(3);
      expect(client.config.timeout).toBe(30000);
    });

    test('should create client with custom config', () => {
      const customClient = new LLMClient({
        provider: mockProvider,
        maxRetries: 5,
        timeout: 60000,
        temperature: 0.5
      });

      expect(customClient.config.maxRetries).toBe(5);
      expect(customClient.config.timeout).toBe(60000);
      expect(customClient.config.temperature).toBe(0.5);
    });

    test('should throw error without provider', () => {
      expect(() => new LLMClient({})).toThrow('Provider is required');
    });
  });

  describe('Basic Completion', () => {
    test('should complete simple prompt', async () => {
      const expectedResponse = 'Hello! How can I help you?';
      mockProvider.complete.mockResolvedValue(mockLLMResponse(expectedResponse));

      const result = await client.complete('Hello');

      expect(mockProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Hello' }]
        })
      );
      expect(result).toBe(expectedResponse);
    });

    test('should complete with system message', async () => {
      mockProvider.complete.mockResolvedValue(mockLLMResponse('Response'));

      await client.complete('User message', {
        systemPrompt: 'You are a helpful assistant'
      });

      expect(mockProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'User message' }
          ]
        })
      );
    });

    test('should complete with message array', async () => {
      const messages = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'User' },
        { role: 'assistant', content: 'Assistant' },
        { role: 'user', content: 'User 2' }
      ];

      mockProvider.complete.mockResolvedValue(mockLLMResponse('Final response'));

      const result = await client.complete(messages);

      expect(mockProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ messages })
      );
      expect(result).toBe('Final response');
    });
  });

  describe('Structured Output', () => {
    test('should complete with JSON output', async () => {
      const expectedData = { name: 'Test Plan', steps: ['Step 1', 'Step 2'] };
      mockProvider.complete.mockResolvedValue(mockLLMResponse(expectedData));

      const result = await client.completeJSON('Create a plan', {
        schema: {
          name: { type: 'string', required: true },
          steps: { type: 'array', required: true }
        }
      });

      expect(result).toEqual(expectedData);
    });

    test('should validate JSON response against schema', async () => {
      const invalidResponse = { name: 'Test' }; // Missing required 'steps'
      mockProvider.complete.mockResolvedValue(mockLLMResponse(invalidResponse));

      await expect(
        client.completeJSON('Create a plan', {
          schema: {
            name: { type: 'string', required: true },
            steps: { type: 'array', required: true }
          }
        })
      ).rejects.toThrow('Validation failed');
    });

    test('should extract JSON from markdown', async () => {
      const markdownResponse = `Here's the plan:
\`\`\`json
{
  "name": "My Plan",
  "version": "1.0.0"
}
\`\`\``;

      mockProvider.complete.mockResolvedValue(mockLLMResponse(markdownResponse));

      const result = await client.completeJSON('Create a plan');

      expect(result.name).toBe('My Plan');
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('Retry Logic', () => {
    test('should retry on failure', async () => {
      // Add error listener to prevent unhandled error warnings
      const errorListener = jest.fn();
      client.on('error', errorListener);
      
      mockProvider.complete
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(mockLLMResponse('Success'));

      const result = await client.complete('Test prompt');

      expect(mockProvider.complete).toHaveBeenCalledTimes(3);
      expect(result).toBe('Success');
    });

    test('should throw after max retries', async () => {
      // Add error listener to prevent unhandled error warnings
      const errorListener = jest.fn();
      client.on('error', errorListener);
      
      mockProvider.complete.mockRejectedValue(new Error('Persistent error'));

      await expect(client.complete('Test prompt')).rejects.toThrow('Persistent error');
      expect(mockProvider.complete).toHaveBeenCalledTimes(3);
    });

    test('should use exponential backoff', async () => {
      // Add error listener to prevent unhandled error warnings
      const errorListener = jest.fn();
      client.on('error', errorListener);
      
      const startTime = Date.now();
      mockProvider.complete
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce(mockLLMResponse('Success'));

      await client.complete('Test', { backoffMultiplier: 10 });

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(10); // At least one backoff
    });
  });

  describe('Streaming', () => {
    test('should handle streaming responses', async () => {
      const chunks = ['Hello', ' there', '!'];
      let chunkIndex = 0;

      mockProvider.completeStreaming.mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield { content: chunk, index: chunkIndex++ };
        }
      });

      const collected = [];
      const stream = client.completeStreaming('Test');

      for await (const chunk of stream) {
        collected.push(chunk.content);
      }

      expect(collected).toEqual(chunks);
    });

    test('should handle streaming with callback', async () => {
      const chunks = ['Chunk 1', 'Chunk 2'];
      mockProvider.completeStreaming.mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield { content: chunk };
        }
      });

      const collected = [];
      await client.complete('Test', {
        streaming: true,
        onChunk: (chunk) => collected.push(chunk.content)
      });

      expect(collected).toEqual(chunks);
    });
  });

  describe('Token Management', () => {
    test('should estimate tokens', () => {
      const text = 'This is a test prompt with several words';
      const estimate = client.estimateTokens(text);

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(text.length);
    });

    test('should track token usage', async () => {
      mockProvider.complete.mockResolvedValue({
        ...mockLLMResponse('Response'),
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      });

      await client.complete('Test');
      const usage = client.getTokenUsage();

      expect(usage.total).toBe(15);
      expect(usage.prompt).toBe(10);
      expect(usage.completion).toBe(5);
    });

    test('should truncate to fit token limit', async () => {
      const longPrompt = 'x'.repeat(10000);
      mockProvider.complete.mockResolvedValue(mockLLMResponse('Response'));

      await client.complete(longPrompt, { maxTokens: 100 });

      const calledPrompt = mockProvider.complete.mock.calls[0][0].messages[0].content;
      expect(calledPrompt.length).toBeLessThan(longPrompt.length);
    });
  });

  describe('Planning-Specific Methods', () => {
    test('should create plan', async () => {
      const planResponse = {
        name: 'Todo App',
        steps: [
          { id: '1', name: 'Setup', type: 'setup' },
          { id: '2', name: 'Implementation', type: 'implementation' }
        ]
      };

      mockProvider.complete.mockResolvedValue(mockLLMResponse(planResponse));

      const result = await client.createPlan({
        task: 'Create a todo app',
        requirements: ['CRUD operations', 'Local storage']
      });

      expect(result.name).toBe('Todo App');
      expect(result.steps).toHaveLength(2);
    });

    test('should refine plan', async () => {
      const originalPlan = {
        name: 'Basic Plan',
        steps: [{ id: '1', name: 'Step 1' }]
      };

      const refinedPlan = {
        ...originalPlan,
        steps: [
          { id: '1', name: 'Step 1', description: 'Added description' },
          { id: '2', name: 'Step 2' }
        ]
      };

      mockProvider.complete.mockResolvedValue(mockLLMResponse(refinedPlan));

      const result = await client.refinePlan(originalPlan, {
        feedback: 'Add more detail and another step'
      });

      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].description).toBeDefined();
    });

    test('should validate plan', async () => {
      const plan = {
        name: 'Test Plan',
        steps: [{ id: '1', name: 'Step 1', dependencies: ['2'] }]
      };

      const validationResponse = {
        isValid: false,
        issues: ['Circular dependency detected'],
        suggestions: ['Remove dependency from step 1']
      };

      mockProvider.complete.mockResolvedValue(mockLLMResponse(validationResponse));

      const result = await client.validatePlan(plan);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Circular dependency detected');
    });
  });

  describe('Error Handling', () => {
    test('should handle provider errors gracefully', async () => {
      mockProvider.complete.mockRejectedValue(new Error('Provider unavailable'));

      await expect(client.complete('Test')).rejects.toThrow('Provider unavailable');
    });

    test('should handle malformed responses', async () => {
      mockProvider.complete.mockResolvedValue({
        // Missing expected structure
        data: 'unexpected'
      });

      await expect(client.complete('Test')).rejects.toThrow();
    });

    test('should timeout long requests', async () => {
      mockProvider.complete.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      await expect(
        client.complete('Test', { timeout: 100 })
      ).rejects.toThrow('timeout');
    });
  });

  describe('Middleware and Hooks', () => {
    test('should support request middleware', async () => {
      const middleware = jest.fn((request) => ({
        ...request,
        temperature: 0.5
      }));

      client.use('request', middleware);
      mockProvider.complete.mockResolvedValue(mockLLMResponse('Response'));

      await client.complete('Test');

      expect(middleware).toHaveBeenCalled();
      expect(mockProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.5 })
      );
    });

    test('should support response middleware', async () => {
      const middleware = jest.fn((response) => ({
        ...response,
        modified: true
      }));

      client.use('response', middleware);
      mockProvider.complete.mockResolvedValue(mockLLMResponse('Response'));

      const result = await client.complete('Test');

      expect(middleware).toHaveBeenCalled();
      expect(result).toBe('Response');
    });

    test('should support error hooks', async () => {
      const errorHook = jest.fn();
      client.on('error', errorHook);

      mockProvider.complete.mockRejectedValue(new Error('Test error'));

      await expect(client.complete('Test')).rejects.toThrow();
      
      // Wait a bit for error event to be emitted
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(errorHook).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test error'
      }));
    });
  });

  describe('Caching', () => {
    test('should cache responses', async () => {
      client.enableCache({ ttl: 1000 });
      mockProvider.complete.mockResolvedValue(mockLLMResponse('Cached response'));

      // First call
      const result1 = await client.complete('Test prompt');
      // Second call (should use cache)
      const result2 = await client.complete('Test prompt');

      expect(mockProvider.complete).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2);
    });

    test('should invalidate cache after TTL', async () => {
      client.enableCache({ ttl: 50 });
      mockProvider.complete
        .mockResolvedValueOnce(mockLLMResponse('Response 1'))
        .mockResolvedValueOnce(mockLLMResponse('Response 2'));

      const result1 = await client.complete('Test');
      await new Promise(resolve => setTimeout(resolve, 100));
      const result2 = await client.complete('Test');

      expect(mockProvider.complete).toHaveBeenCalledTimes(2);
      expect(result1).not.toBe(result2);
    });
  });
});