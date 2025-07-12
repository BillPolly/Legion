import { LLMClient, MaxRetriesExceededError, ValidationError, ResponseValidator } from '../src/index';
import { Anthropic } from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

describe('LLMClient Integration Tests', () => {
  let mockAnthropicInstance: jest.Mocked<Anthropic>;
  let mockCreate: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Create mock instance
    mockCreate = jest.fn();
    mockAnthropicInstance = {
      messages: {
        create: mockCreate
      }
    } as any;
    
    // Mock the Anthropic constructor
    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropicInstance);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle knowledge graph entity extraction', async () => {
      const entityResponse = {
        content: [{
          type: 'text',
          text: '{"entities": [{"name": "User", "attributes": ["id", "name", "email"]}, {"name": "Order", "attributes": ["id", "userId", "total"]}]}'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(entityResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation(`
        Extract entities and their attributes from this description:
        "A user can place multiple orders. Each user has an ID, name, and email.
        Each order has an ID, user ID, and total amount."
        
        Return as JSON with entities array.
      `);
      
      const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)![0]);
      expect(parsed.entities).toHaveLength(2);
      expect(parsed.entities[0].name).toBe('User');
      expect(parsed.entities[1].name).toBe('Order');
    });

    it('should handle task hierarchy generation', async () => {
      const taskResponse = {
        content: [{
          type: 'text',
          text: '{"tasks": [{"id": "1", "name": "Setup Database", "level": 1}, {"id": "2", "name": "Create User Table", "level": 2, "parent": "1"}, {"id": "3", "name": "Create Order Table", "level": 2, "parent": "1"}]}'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(taskResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation(`
        Break down "Build e-commerce system" into a task hierarchy.
        Return as JSON with tasks array including id, name, level, and parent fields.
      `);
      
      const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)![0]);
      expect(parsed.tasks).toHaveLength(3);
      expect(parsed.tasks[0].level).toBe(1);
      expect(parsed.tasks[1].parent).toBe('1');
    });

    it('should handle constraint generation with validation', async () => {
      const invalidConstraintResponse = {
        content: [{
          type: 'text',
          text: 'Here are some constraints but not in proper format'
        }]
      };
      
      const validConstraintResponse = {
        content: [{
          type: 'text',
          text: '{"constraints": [{"entity": "User", "attribute": "email", "operator": "matches", "values": ["email_pattern"]}, {"entity": "Order", "attribute": "total", "operator": "greater_than", "values": ["0"]}]}'
        }]
      };
      
      mockCreate
        .mockResolvedValueOnce(invalidConstraintResponse)
        .mockResolvedValueOnce(validConstraintResponse);
      
      const constraintValidator: ResponseValidator = (response) => {
        try {
          const json = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '');
          return json.constraints && Array.isArray(json.constraints) && 
                 json.constraints.every((c: any) => c.entity && c.attribute && c.operator);
        } catch {
          return false;
        }
      };
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithValidation(
        'Generate validation constraints for User and Order entities',
        constraintValidator
      );
      
      const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)![0]);
      expect(parsed.constraints).toHaveLength(2);
      expect(parsed.constraints[0].entity).toBe('User');
      expect(parsed.constraints[1].entity).toBe('Order');
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from rate limits during complex operations', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      
      const partialResponse = {
        content: [{
          type: 'text',
          text: '{"entities": [{"name": "User"'  // Incomplete JSON
        }]
      };
      
      const completeResponse = {
        content: [{
          type: 'text',
          text: '{"entities": [{"name": "User", "attributes": ["id", "name"]}, {"name": "Product", "attributes": ["id", "name", "price"]}]}'
        }]
      };
      
      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(partialResponse)
        .mockResolvedValueOnce(completeResponse);
      
      const client = new LLMClient({ 
        apiKey: 'test-key', 
        baseDelay: 100,
        maxRetries: 3
      });
      
      const completionPromise = client.completeWithJsonValidation(
        'Extract entities from e-commerce domain'
      );
      
      // Advance through rate limit backoff
      await jest.advanceTimersByTimeAsync(100);
      
      const result = await completionPromise;
      const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)![0]);
      
      expect(parsed.entities).toHaveLength(2);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should handle server errors during validation retries', async () => {
      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;
      
      const invalidResponse = {
        content: [{ type: 'text', text: 'Invalid response format' }]
      };
      
      const validResponse = {
        content: [{ type: 'text', text: 'user@example.com' }]
      };
      
      mockCreate
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse);
      
      const emailValidator: ResponseValidator = (response) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(response.trim());
      };
      
      const client = new LLMClient({ 
        apiKey: 'test-key',
        maxRetries: 3
      });
      
      const completionPromise = client.completeWithValidation(
        'Generate a valid email address',
        emailValidator
      );
      
      // Advance through server error delay
      await jest.advanceTimersByTimeAsync(5000);
      
      const result = await completionPromise;
      
      expect(result).toBe('user@example.com');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance and Load Scenarios', () => {
    it('should handle concurrent requests efficiently', async () => {
      const responses = Array.from({ length: 5 }, (_, i) => ({
        content: [{
          type: 'text',
          text: `{"result": "Response ${i + 1}", "id": ${i + 1}}`
        }]
      }));
      
      responses.forEach(response => {
        mockCreate.mockResolvedValueOnce(response);
      });
      
      const client = new LLMClient({ apiKey: 'test-key' });
      
      const promises = Array.from({ length: 5 }, (_, i) =>
        client.completeWithJsonValidation(`Generate response ${i + 1}`)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)![0]);
        expect(parsed.id).toBe(i + 1);
      });
      
      expect(mockCreate).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed success and failure in concurrent requests', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      
      const successResponse = {
        content: [{ type: 'text', text: '{"status": "success"}' }]
      };
      
      const retrySuccessResponse = {
        content: [{ type: 'text', text: '{"status": "retry_success"}' }]
      };
      
      // Setup: 2 immediate successes, 1 rate limit then success, 2 more successes
      mockCreate
        .mockResolvedValueOnce(successResponse)
        .mockResolvedValueOnce(successResponse)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(successResponse)
        .mockResolvedValueOnce(successResponse)
        .mockResolvedValueOnce(retrySuccessResponse); // For the retry
      
      const client = new LLMClient({ 
        apiKey: 'test-key',
        baseDelay: 50
      });
      
      const promises = Array.from({ length: 5 }, (_, i) =>
        client.completeWithJsonValidation(`Request ${i + 1}`)
      );
      
      // Start all requests
      const resultsPromise = Promise.all(promises);
      
      // Advance time for the rate limit retry
      await jest.advanceTimersByTimeAsync(50);
      
      const results = await resultsPromise;
      
      expect(results).toHaveLength(5);
      expect(mockCreate).toHaveBeenCalledTimes(6); // 5 initial + 1 retry
    });
  });

  describe('Complex Validation Workflows', () => {
    it('should handle multi-step validation with progressive enhancement', async () => {
      const responses = [
        { content: [{ type: 'text', text: 'function incomplete(' }] }, // Missing closing
        { content: [{ type: 'text', text: 'function test() { console.log("hello"); }' }] }, // No return
        { content: [{ type: 'text', text: 'function calculate(a, b) { return a + b; }' }] } // Valid
      ];
      
      mockCreate
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2]);
      
      const codeValidator: ResponseValidator = (response) => {
        return response.includes('function') && 
               response.includes('{') && 
               response.includes('}') &&
               response.includes('return');
      };
      
      const client = new LLMClient({ 
        apiKey: 'test-key',
        maxRetries: 3
      });
      
      const result = await client.completeWithValidation(
        'Generate a JavaScript function that takes parameters and returns a value',
        codeValidator
      );
      
      expect(result).toBe('function calculate(a, b) { return a + b; }');
      expect(mockCreate).toHaveBeenCalledTimes(3);
      
      // Verify progressive prompt enhancement
      const calls = mockCreate.mock.calls;
      expect(calls[1][0].messages[0].content).toContain('Previous response was invalid');
      expect(calls[2][0].messages[0].content).toContain('Previous response was invalid');
    });

    it('should handle nested validation with JSON and custom rules', async () => {
      const invalidJsonResponse = {
        content: [{ type: 'text', text: 'Not JSON at all' }]
      };
      
      const validJsonInvalidDataResponse = {
        content: [{ type: 'text', text: '{"users": []}' }] // Empty array
      };
      
      const validResponse = {
        content: [{ type: 'text', text: '{"users": [{"id": 1, "name": "Alice", "email": "alice@example.com"}]}' }]
      };
      
      mockCreate
        .mockResolvedValueOnce(invalidJsonResponse)
        .mockResolvedValueOnce(validJsonInvalidDataResponse)
        .mockResolvedValueOnce(validResponse);
      
      const complexValidator: ResponseValidator = (response) => {
        try {
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (!jsonMatch) return false;
          
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.users && 
                 Array.isArray(parsed.users) && 
                 parsed.users.length > 0 &&
                 parsed.users.every((user: any) => 
                   user.id && user.name && user.email && user.email.includes('@')
                 );
        } catch {
          return false;
        }
      };
      
      const client = new LLMClient({ 
        apiKey: 'test-key',
        maxRetries: 3
      });
      
      const result = await client.completeWithValidation(
        'Generate JSON with user data including valid emails',
        complexValidator
      );
      
      const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)![0]);
      expect(parsed.users).toHaveLength(1);
      expect(parsed.users[0].email).toContain('@');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle extremely long responses', async () => {
      const longContent = 'A'.repeat(50000);
      const longResponse = {
        content: [{
          type: 'text',
          text: `{"content": "${longContent}", "length": ${longContent.length}}`
        }]
      };
      
      mockCreate.mockResolvedValueOnce(longResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation('Generate long content');
      
      const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)![0]);
      expect(parsed.content).toHaveLength(50000);
      expect(parsed.length).toBe(50000);
    });

    it('should handle unicode and special characters', async () => {
      const unicodeResponse = {
        content: [{
          type: 'text',
          text: '{"message": "Hello 世界! 🌍 Café naïve résumé", "emoji": "🚀🎉💻", "math": "∑∞≠≤≥"}'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(unicodeResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation('Generate unicode content');
      
      const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)![0]);
      expect(parsed.message).toContain('世界');
      expect(parsed.emoji).toContain('🚀');
      expect(parsed.math).toContain('∑');
    });

    it('should handle rapid successive requests with different configurations', async () => {
      const responses = Array.from({ length: 3 }, (_, i) => ({
        content: [{ type: 'text', text: `Response ${i + 1}` }]
      }));
      
      responses.forEach(response => {
        mockCreate.mockResolvedValueOnce(response);
      });
      
      const client1 = new LLMClient({ apiKey: 'test-key', model: 'claude-3-sonnet-20240229' });
      const client2 = new LLMClient({ apiKey: 'test-key', model: 'claude-3-opus-20240229' });
      const client3 = new LLMClient({ apiKey: 'test-key', maxRetries: 5 });
      
      const [result1, result2, result3] = await Promise.all([
        client1.complete('Request 1'),
        client2.complete('Request 2'),
        client3.complete('Request 3')
      ]);
      
      expect(result1).toBe('Response 1');
      expect(result2).toBe('Response 2');
      expect(result3).toBe('Response 3');
      
      // Verify different models were used
      expect(mockCreate.mock.calls[0][0].model).toBe('claude-3-sonnet-20240229');
      expect(mockCreate.mock.calls[1][0].model).toBe('claude-3-opus-20240229');
      expect(mockCreate.mock.calls[2][0].model).toBe('claude-3-sonnet-20240229');
    });
  });

  describe('Failure Scenarios', () => {
    it('should fail gracefully when all retries exhausted', async () => {
      // Use real timers for this test to avoid timing issues
      jest.useRealTimers();
      
      const persistentError = new Error('Persistent failure');
      (persistentError as any).status = 500;
      
      mockCreate.mockRejectedValue(persistentError);
      
      // Use a client with zero retries to avoid timing issues
      const client = new LLMClient({ 
        apiKey: 'test-key',
        maxRetries: 0
      });
      
      await expect(client.complete('This will fail')).rejects.toThrow(MaxRetriesExceededError);
      await expect(client.complete('This will fail')).rejects.toThrow('Failed after 0 attempts');
      
      // The client should not even attempt to call the API with zero retries
      expect(mockCreate).toHaveBeenCalledTimes(0);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });

    it('should fail validation after exhausting retries', async () => {
      const invalidResponse = {
        content: [{ type: 'text', text: 'Always invalid response' }]
      };
      
      mockCreate.mockResolvedValue(invalidResponse);
      
      const strictValidator: ResponseValidator = () => false; // Always fails
      
      const client = new LLMClient({ 
        apiKey: 'test-key',
        maxRetries: 2
      });
      
      await expect(
        client.completeWithValidation('Generate valid response', strictValidator)
      ).rejects.toThrow(ValidationError);
      
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });
});
