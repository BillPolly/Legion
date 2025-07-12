import { LLMClient, ValidationError, ResponseValidator } from '../src/index';
import { Anthropic } from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

describe('LLMClient Validation', () => {
  let mockAnthropicInstance: jest.Mocked<Anthropic>;
  let mockCreate: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
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

  describe('Custom Validation', () => {
    it('should succeed when validator returns true', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'Valid response content'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const validator: ResponseValidator = (response) => response.includes('Valid');
      const client = new LLMClient({ apiKey: 'test-key' });
      
      const result = await client.completeWithValidation('Test prompt', validator);
      
      expect(result).toBe('Valid response content');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should retry when validator returns false', async () => {
      const invalidResponse = {
        content: [{
          type: 'text',
          text: 'Invalid response'
        }]
      };
      
      const validResponse = {
        content: [{
          type: 'text',
          text: 'Valid response content'
        }]
      };
      
      mockCreate
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse);
      
      const validator: ResponseValidator = (response) => response.includes('Valid');
      const client = new LLMClient({ apiKey: 'test-key' });
      
      const result = await client.completeWithValidation('Test prompt', validator);
      
      expect(result).toBe('Valid response content');
      expect(mockCreate).toHaveBeenCalledTimes(2);
      
      // Check that the second call includes feedback about the invalid response
      const secondCall = mockCreate.mock.calls[1][0];
      expect(secondCall.messages[0].content).toContain('Previous response was invalid');
      expect(secondCall.messages[0].content).toContain('Invalid response');
    });

    it('should throw ValidationError after max retries', async () => {
      const invalidResponse = {
        content: [{
          type: 'text',
          text: 'Always invalid'
        }]
      };
      
      mockCreate.mockResolvedValue(invalidResponse);
      
      const validator: ResponseValidator = () => false; // Always fails
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 2 });
      
      await expect(
        client.completeWithValidation('Test prompt', validator)
      ).rejects.toThrow(ValidationError);
      
      await expect(
        client.completeWithValidation('Test prompt', validator)
      ).rejects.toThrow('Failed to get valid response after 2 attempts');
      
      expect(mockCreate).toHaveBeenCalledTimes(4); // 2 attempts × 2 calls = 4
    });

    it('should enhance prompt with validation feedback', async () => {
      const responses = [
        { content: [{ type: 'text', text: 'First invalid' }] },
        { content: [{ type: 'text', text: 'Second invalid' }] },
        { content: [{ type: 'text', text: 'Valid response' }] }
      ];
      
      mockCreate
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2]);
      
      const validator: ResponseValidator = (response) => response.includes('Valid');
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 3 });
      
      const result = await client.completeWithValidation('Original prompt', validator);
      
      expect(result).toBe('Valid response');
      expect(mockCreate).toHaveBeenCalledTimes(3);
      
      // Check progressive prompt enhancement
      const calls = mockCreate.mock.calls;
      expect(calls[0][0].messages[0].content).toBe('Original prompt');
      expect(calls[1][0].messages[0].content).toContain('Previous response was invalid: First invalid');
      expect(calls[2][0].messages[0].content).toContain('Previous response was invalid: Second invalid');
    });
  });

  describe('JSON Validation', () => {
    it('should succeed with valid JSON response', async () => {
      const jsonResponse = {
        content: [{
          type: 'text',
          text: 'Here is the JSON: {"name": "test", "value": 42}'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(jsonResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation('Generate JSON');
      
      expect(result).toBe('Here is the JSON: {"name": "test", "value": 42}');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should succeed with JSON object only', async () => {
      const jsonResponse = {
        content: [{
          type: 'text',
          text: '{"users": [{"id": 1, "name": "Alice"}], "total": 1}'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(jsonResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation('Generate user data');
      
      expect(result).toBe('{"users": [{"id": 1, "name": "Alice"}], "total": 1}');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should retry on invalid JSON', async () => {
      const invalidJsonResponse = {
        content: [{
          type: 'text',
          text: 'This is not JSON at all'
        }]
      };
      
      const validJsonResponse = {
        content: [{
          type: 'text',
          text: '{"corrected": true, "message": "Now valid JSON"}'
        }]
      };
      
      mockCreate
        .mockResolvedValueOnce(invalidJsonResponse)
        .mockResolvedValueOnce(validJsonResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation('Generate JSON');
      
      expect(result).toBe('{"corrected": true, "message": "Now valid JSON"}');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should retry on malformed JSON', async () => {
      const malformedJsonResponse = {
        content: [{
          type: 'text',
          text: '{"name": "test", "value": 42,}' // Trailing comma
        }]
      };
      
      const validJsonResponse = {
        content: [{
          type: 'text',
          text: '{"name": "test", "value": 42}'
        }]
      };
      
      mockCreate
        .mockResolvedValueOnce(malformedJsonResponse)
        .mockResolvedValueOnce(validJsonResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation('Generate JSON');
      
      expect(result).toBe('{"name": "test", "value": 42}');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle nested JSON objects', async () => {
      const nestedJsonResponse = {
        content: [{
          type: 'text',
          text: '{"user": {"profile": {"name": "Alice", "settings": {"theme": "dark"}}}}'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(nestedJsonResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation('Generate nested JSON');
      
      expect(result).toBe('{"user": {"profile": {"name": "Alice", "settings": {"theme": "dark"}}}}');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle JSON arrays', async () => {
      const jsonArrayResponse = {
        content: [{
          type: 'text',
          text: '[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(jsonArrayResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation('Generate JSON array');
      
      expect(result).toBe('[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should extract JSON from mixed content', async () => {
      const mixedContentResponse = {
        content: [{
          type: 'text',
          text: 'Here is your JSON data:\n\n{"result": "success", "data": [1, 2, 3]}\n\nHope this helps!'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mixedContentResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithJsonValidation('Generate JSON with explanation');
      
      expect(result).toContain('{"result": "success", "data": [1, 2, 3]}');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should fail when no JSON is found', async () => {
      const noJsonResponse = {
        content: [{
          type: 'text',
          text: 'I cannot provide JSON for this request.'
        }]
      };
      
      mockCreate.mockResolvedValue(noJsonResponse);
      
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 2 });
      
      await expect(
        client.completeWithJsonValidation('Generate JSON')
      ).rejects.toThrow(ValidationError);
      
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should handle email validation', async () => {
      const invalidEmailResponse = {
        content: [{ type: 'text', text: 'invalid-email' }]
      };
      
      const validEmailResponse = {
        content: [{ type: 'text', text: 'user@example.com' }]
      };
      
      mockCreate
        .mockResolvedValueOnce(invalidEmailResponse)
        .mockResolvedValueOnce(validEmailResponse);
      
      const emailValidator: ResponseValidator = (response) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(response.trim());
      };
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithValidation('Generate email', emailValidator);
      
      expect(result).toBe('user@example.com');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle code validation', async () => {
      const invalidCodeResponse = {
        content: [{ type: 'text', text: 'This is not code' }]
      };
      
      const validCodeResponse = {
        content: [{ type: 'text', text: 'function hello() { return "world"; }' }]
      };
      
      mockCreate
        .mockResolvedValueOnce(invalidCodeResponse)
        .mockResolvedValueOnce(validCodeResponse);
      
      const codeValidator: ResponseValidator = (response) => {
        return response.includes('function') && response.includes('{') && response.includes('}');
      };
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithValidation('Generate JavaScript function', codeValidator);
      
      expect(result).toBe('function hello() { return "world"; }');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle length validation', async () => {
      const tooShortResponse = {
        content: [{ type: 'text', text: 'Short' }]
      };
      
      const validLengthResponse = {
        content: [{ type: 'text', text: 'This is a response with sufficient length for validation' }]
      };
      
      mockCreate
        .mockResolvedValueOnce(tooShortResponse)
        .mockResolvedValueOnce(validLengthResponse);
      
      const lengthValidator: ResponseValidator = (response) => response.length >= 20;
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.completeWithValidation('Generate long response', lengthValidator);
      
      expect(result).toBe('This is a response with sufficient length for validation');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple validation criteria', async () => {
      const responses = [
        { content: [{ type: 'text', text: 'Short' }] }, // Too short
        { content: [{ type: 'text', text: 'This is long enough but has no numbers' }] }, // No numbers
        { content: [{ type: 'text', text: 'This response is long enough and contains 42 numbers' }] } // Valid
      ];
      
      mockCreate
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2]);
      
      const multiValidator: ResponseValidator = (response) => {
        return response.length >= 20 && /\d+/.test(response);
      };
      
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 3 });
      const result = await client.completeWithValidation('Generate response with numbers', multiValidator);
      
      expect(result).toBe('This response is long enough and contains 42 numbers');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Validation with Custom Token Limits', () => {
    it('should respect custom token limits in validation retries', async () => {
      const invalidResponse = {
        content: [{ type: 'text', text: 'Invalid' }]
      };
      
      const validResponse = {
        content: [{ type: 'text', text: 'Valid response' }]
      };
      
      mockCreate
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse);
      
      const validator: ResponseValidator = (response) => response.includes('Valid');
      const client = new LLMClient({ apiKey: 'test-key' });
      
      await client.completeWithValidation('Test prompt', validator, 500);
      
      // Both calls should use the custom token limit
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(500);
      expect(mockCreate.mock.calls[1][0].max_tokens).toBe(500);
    });
  });
});
