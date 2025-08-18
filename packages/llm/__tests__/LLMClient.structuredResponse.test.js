/**
 * Tests for LLMClient structured response methods
 */

import { jest } from '@jest/globals';
import { LLMClient } from '../src/LLMClient.js';
import { MockProvider } from '../src/providers/MockProvider.js';

describe('LLMClient Structured Response Methods', () => {
  let client;
  let mockProvider;

  beforeEach(() => {
    mockProvider = new MockProvider();
    client = new LLMClient({
      provider: 'mock',
      model: 'test-model'
    });
    // Replace the provider with our mock
    client.provider = mockProvider;
  });

  describe('completeWithStructuredResponse', () => {
    it('should parse and return structured JSON response', async () => {
      // Mock the provider to return JSON
      mockProvider.complete = jest.fn().mockResolvedValue(
        '{"name": "John", "age": 30, "city": "New York"}'
      );

      const result = await client.completeWithStructuredResponse('Get user info');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'John',
        age: 30,
        city: 'New York'
      });
      expect(result.raw).toBe('{"name": "John", "age": 30, "city": "New York"}');
      expect(result.errors).toBeUndefined();
    });

    it('should handle JSON embedded in text', async () => {
      mockProvider.complete = jest.fn().mockResolvedValue(
        'Here is the response: {"status": "success", "value": 42}'
      );

      const result = await client.completeWithStructuredResponse('Calculate something');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        status: 'success',
        value: 42
      });
    });

    it('should validate against schema', async () => {
      mockProvider.complete = jest.fn().mockResolvedValue(
        '{"name": "John", "age": "thirty"}' // age should be number
      );

      const schema = {
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };

      const result = await client.completeWithStructuredResponse('Get user', { schema });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Field 'age' must be of type number");
    });

    it('should validate task_completed response format', async () => {
      mockProvider.complete = jest.fn().mockResolvedValue(
        '{"task_completed": true, "response": {"type": "success", "message": "Done"}}'
      );

      const result = await client.completeWithStructuredResponse('Do something', {
        expectedFields: ['task_completed', 'response']
      });

      expect(result.success).toBe(true);
      expect(result.data.task_completed).toBe(true);
      expect(result.data.response.type).toBe('success');
    });

    it('should validate valid tool usage', async () => {
      const mockTools = [{
        identifier: 'calculator',
        functions: [
          { name: 'add', arguments: [{ name: 'a', required: true }, { name: 'b', required: true }] }
        ]
      }];

      // Use named arguments to avoid array extraction issue
      mockProvider.complete = jest.fn().mockResolvedValue(
        JSON.stringify({
          task_completed: true,
          response: { type: "success", message: "Calculated" },
          use_tool: {
            identifier: "calculator",
            function_name: "add",
            args: [1, 2]
          }
        })
      );

      const result = await client.completeWithStructuredResponse('Calculate 1+2', {
        expectedFields: ['task_completed'],
        tools: mockTools
      });


      expect(result.success).toBe(true);
      expect(result.data.use_tool.identifier).toBe('calculator');
    });

    it('should handle parse errors gracefully', async () => {
      mockProvider.complete = jest.fn().mockResolvedValue(
        'This is not JSON at all'
      );

      const result = await client.completeWithStructuredResponse('Get data');

      expect(result.success).toBe(false);
      expect(result.raw).toBe('This is not JSON at all');
      expect(result.errors[0]).toContain('Failed to parse JSON');
    });

    it('should pass maxTokens to complete method', async () => {
      mockProvider.complete = jest.fn().mockResolvedValue('{"result": true}');

      await client.completeWithStructuredResponse('Test', { maxTokens: 500 });

      expect(mockProvider.complete).toHaveBeenCalledWith('Test', 'test-model', 500);
    });
  });

  describe('sendAndReceiveStructuredResponse', () => {
    it('should handle non-JSON string responses', async () => {
      // For MockProvider, it returns the mock response string
      mockProvider.sendAndReceiveResponse = jest.fn().mockResolvedValue(
        'Mock LLM response: The request "Get data" has been processed successfully by test-model.'
      );

      const messages = [{ role: 'user', content: 'Get data' }];
      const result = await client.sendAndReceiveStructuredResponse(messages);

      // Should fail to parse as JSON
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to parse JSON');
    });

    it('should parse clean JSON string responses', async () => {
      // Override sendAndReceiveResponse to return actual JSON string
      mockProvider.sendAndReceiveResponse = jest.fn().mockResolvedValue(
        '{"status": "ok", "message": "Success", "code": 200}'
      );

      const messages = [{ role: 'user', content: 'Get data' }];
      const result = await client.sendAndReceiveStructuredResponse(messages);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        status: 'ok',
        message: 'Success',
        code: 200
      });
      expect(mockProvider.sendAndReceiveResponse).toHaveBeenCalledWith(
        messages,
        expect.objectContaining({ model: 'test-model' })
      );
    });

    it('should handle object responses directly', async () => {
      const responseObj = { status: 'ok', data: [1, 2, 3] };
      mockProvider.sendAndReceiveResponse = jest.fn().mockResolvedValue(responseObj);

      const messages = [{ role: 'user', content: 'Get data' }];
      const result = await client.sendAndReceiveStructuredResponse(messages);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(responseObj);
    });

    it('should validate with custom schema', async () => {
      mockProvider.sendAndReceiveResponse = jest.fn().mockResolvedValue({
        items: ['a', 'b', 'c'],
        count: 3
      });

      const schema = {
        required: ['items', 'count', 'total'], // total is missing
        properties: {
          items: { type: 'array' },
          count: { type: 'number' },
          total: { type: 'number' }
        }
      };

      const messages = [{ role: 'user', content: 'List items' }];
      const result = await client.sendAndReceiveStructuredResponse(messages, { schema });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required field: total');
    });

    it('should pass through LLM options', async () => {
      mockProvider.sendAndReceiveResponse = jest.fn().mockResolvedValue('{"ok": true}');

      const messages = [{ role: 'user', content: 'Test' }];
      const options = {
        temperature: 0.5,
        maxTokens: 100,
        model: 'specific-model'
      };

      await client.sendAndReceiveStructuredResponse(messages, options);

      expect(mockProvider.sendAndReceiveResponse).toHaveBeenCalledWith(
        messages,
        expect.objectContaining({
          temperature: 0.5,
          maxTokens: 100,
          model: 'specific-model'
        })
      );
    });

    it('should handle parse errors for string responses', async () => {
      mockProvider.sendAndReceiveResponse = jest.fn().mockResolvedValue(
        'Invalid JSON {broken'
      );

      const messages = [{ role: 'user', content: 'Get data' }];
      const result = await client.sendAndReceiveStructuredResponse(messages);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to parse JSON');
    });

    it('should validate tool response with fuzzy matching', async () => {
      const mockTools = [{
        identifier: 'string_tools',
        functions: [
          { name: 'reverse', arguments: [{ required: true }] },
          { name: 'uppercase', arguments: [{ required: true }] }
        ]
      }];

      mockProvider.sendAndReceiveResponse = jest.fn().mockResolvedValue({
        task_completed: true,
        response: { type: 'success', message: 'Done' },
        use_tool: {
          identifier: 'string_tool', // Typo - missing 's'
          function_name: 'revers', // Typo - missing 'e'
          args: ['hello']
        }
      });

      const messages = [{ role: 'user', content: 'Reverse hello' }];
      const result = await client.sendAndReceiveStructuredResponse(messages, {
        expectedFields: ['task_completed'],
        tools: mockTools
      });

      // Should fail but provide suggestions
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.includes('Unknown tool identifier'))).toBe(true);
    });
  });

  describe('integration with retry logic', () => {
    it('should use retry logic from complete method', async () => {
      let callCount = 0;
      mockProvider.complete = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          const error = new Error('Temporary failure');
          error.status = 500; // Server error to trigger retry
          throw error;
        }
        return '{"success": true}';
      });

      // Use a client with retries and fast server error delay
      const retryClient = new LLMClient({
        provider: 'mock',
        model: 'test-model',
        maxRetries: 2,
        serverErrorDelay: 10 // Fast retry for testing
      });
      retryClient.provider = mockProvider;

      const result = await retryClient.completeWithStructuredResponse('Test');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockProvider.complete).toHaveBeenCalledTimes(2);
    }, 10000);
  });
});