import { LLMClient, LLMClientConfig, MaxRetriesExceededError, ValidationError } from '../src/index';
import { Anthropic } from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

describe('LLMClient', () => {
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

  describe('Configuration', () => {
    it('should create client with valid configuration', () => {
      const config: LLMClientConfig = {
        apiKey: 'test-api-key'
      };
      
      const client = new LLMClient(config);
      
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
      expect(client.currentModel).toBe('claude-3-sonnet-20240229');
      expect(client.maxRetriesConfigured).toBe(3);
    });

    it('should apply custom configuration values', () => {
      const config: LLMClientConfig = {
        apiKey: 'test-api-key',
        model: 'claude-3-opus-20240229',
        maxRetries: 5,
        baseDelay: 2000
      };
      
      const client = new LLMClient(config);
      
      expect(client.currentModel).toBe('claude-3-opus-20240229');
      expect(client.maxRetriesConfigured).toBe(5);
    });

    it('should handle missing optional parameters with defaults', () => {
      const config: LLMClientConfig = {
        apiKey: 'test-api-key'
      };
      
      const client = new LLMClient(config);
      
      expect(client.currentModel).toBe('claude-3-sonnet-20240229');
      expect(client.maxRetriesConfigured).toBe(3);
    });
  });

  describe('Basic Completion', () => {
    it('should complete successfully with text response', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'This is a test response'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.complete('Test prompt');
      
      expect(result).toBe('This is a test response');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Test prompt' }]
      });
    });

    it('should handle custom max tokens', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'Short response'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      await client.complete('Test prompt', 500);
      
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 500,
        messages: [{ role: 'user', content: 'Test prompt' }]
      });
    });

    it('should throw error for unexpected content type', async () => {
      const mockResponse = {
        content: [{
          type: 'tool_use',
          id: 'tool_123'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      
      await expect(client.complete('Test prompt')).rejects.toThrow('Unexpected response content type');
    });

    it('should handle empty content array', async () => {
      const mockResponse = {
        content: []
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      
      await expect(client.complete('Test prompt')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw client errors immediately (4xx except 429)', async () => {
      const clientError = new Error('Bad Request');
      (clientError as any).status = 400;
      
      mockCreate.mockRejectedValueOnce(clientError);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      
      await expect(client.complete('Test prompt')).rejects.toThrow('Bad Request');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should throw authentication errors immediately', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).status = 401;
      
      mockCreate.mockRejectedValueOnce(authError);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      
      await expect(client.complete('Test prompt')).rejects.toThrow('Unauthorized');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should throw network errors without status immediately', async () => {
      const networkError = new Error('Network error');
      
      mockCreate.mockRejectedValueOnce(networkError);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      
      await expect(client.complete('Test prompt')).rejects.toThrow('Network error');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Model Configuration', () => {
    it('should use custom model in requests', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'Response from custom model'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const client = new LLMClient({ 
        apiKey: 'test-key',
        model: 'claude-3-opus-20240229'
      });
      
      await client.complete('Test prompt');
      
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Test prompt' }]
      });
    });
  });

  describe('Prompt Handling', () => {
    it('should handle empty prompts', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'Empty prompt response'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.complete('');
      
      expect(result).toBe('Empty prompt response');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: '' }]
      });
    });

    it('should handle very long prompts', async () => {
      const longPrompt = 'A'.repeat(10000);
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'Long prompt response'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.complete(longPrompt);
      
      expect(result).toBe('Long prompt response');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: longPrompt }]
      });
    });

    it('should handle prompts with special characters', async () => {
      const specialPrompt = 'Test with "quotes", \n newlines, and émojis 🚀';
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'Special characters handled'
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.complete(specialPrompt);
      
      expect(result).toBe('Special characters handled');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: specialPrompt }]
      });
    });
  });
});
