import { LLMClient, MaxRetriesExceededError } from '../src/index';
import { Anthropic } from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

describe('LLMClient Retry Logic', () => {
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

  describe('Rate Limit Handling (429)', () => {
    it('should retry with exponential backoff on rate limit', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      
      const successResponse = {
        content: [{
          type: 'text',
          text: 'Success after retry'
        }]
      };

      // First call fails with rate limit, second succeeds
      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(successResponse);

      const client = new LLMClient({ apiKey: 'test-key', baseDelay: 1000 });
      
      // Start the completion
      const completionPromise = client.complete('Test prompt');
      
      // Fast-forward through the first backoff delay (1000ms)
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await completionPromise;
      
      expect(result).toBe('Success after retry');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should calculate correct exponential backoff delays', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      
      // Fail 3 times, then succeed
      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Final success' }]
        });

      const client = new LLMClient({ 
        apiKey: 'test-key', 
        baseDelay: 100,
        maxRetries: 4
      });
      
      const completionPromise = client.complete('Test prompt');
      
      // First retry: 100ms (baseDelay * 2^0)
      await jest.advanceTimersByTimeAsync(100);
      
      // Second retry: 200ms (baseDelay * 2^1)
      await jest.advanceTimersByTimeAsync(200);
      
      // Third retry: 400ms (baseDelay * 2^2)
      await jest.advanceTimersByTimeAsync(400);
      
      const result = await completionPromise;
      
      expect(result).toBe('Final success');
      expect(mockCreate).toHaveBeenCalledTimes(4);
    });

    it('should throw MaxRetriesExceededError after exhausting retries', async () => {
      // Use real timers for this test to avoid fake timer issues
      jest.useRealTimers();
      
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      
      mockCreate.mockRejectedValue(rateLimitError);

      const client = new LLMClient({ 
        apiKey: 'test-key', 
        maxRetries: 2,
        baseDelay: 1 // Use very short delay for real timers
      });
      
      // Use try/catch to properly handle the error
      try {
        await client.complete('Test prompt');
        fail('Expected MaxRetriesExceededError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MaxRetriesExceededError);
        expect((error as Error).message).toBe('Failed after 2 attempts');
      }
      
      expect(mockCreate).toHaveBeenCalledTimes(2);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });
  });

  describe('Server Error Handling (5xx)', () => {
    it('should retry with fixed delay on server errors', async () => {
      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;
      
      const successResponse = {
        content: [{
          type: 'text',
          text: 'Success after server recovery'
        }]
      };

      mockCreate
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce(successResponse);

      const client = new LLMClient({ apiKey: 'test-key' });
      
      const completionPromise = client.complete('Test prompt');
      
      // Server errors use fixed 5-second delay
      await jest.advanceTimersByTimeAsync(5000);
      
      const result = await completionPromise;
      
      expect(result).toBe('Success after server recovery');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle different 5xx error codes', async () => {
      const testCases = [500, 502, 503, 504];
      
      for (const statusCode of testCases) {
        jest.clearAllMocks();
        
        const serverError = new Error(`Server Error ${statusCode}`);
        (serverError as any).status = statusCode;
        
        const successResponse = {
          content: [{ type: 'text', text: `Recovered from ${statusCode}` }]
        };

        mockCreate
          .mockRejectedValueOnce(serverError)
          .mockResolvedValueOnce(successResponse);

        const client = new LLMClient({ apiKey: 'test-key' });
        
        const completionPromise = client.complete('Test prompt');
        await jest.advanceTimersByTimeAsync(5000);
        
        const result = await completionPromise;
        
        expect(result).toBe(`Recovered from ${statusCode}`);
        expect(mockCreate).toHaveBeenCalledTimes(2);
      }
    });

    it('should exhaust retries on persistent server errors', async () => {
      // Use real timers for this test to avoid fake timer issues
      jest.useRealTimers();
      
      const serverError = new Error('Persistent Server Error');
      (serverError as any).status = 503;
      
      mockCreate.mockRejectedValue(serverError);

      const client = new LLMClient({ 
        apiKey: 'test-key', 
        maxRetries: 2,
        serverErrorDelay: 1 // Use very short delay for fast test execution
      });
      
      // Use try/catch to properly handle the error
      try {
        await client.complete('Test prompt');
        fail('Expected MaxRetriesExceededError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MaxRetriesExceededError);
        expect((error as Error).message).toBe('Failed after 2 attempts');
      }
      
      expect(mockCreate).toHaveBeenCalledTimes(2);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });
  });

  describe('Mixed Error Scenarios', () => {
    it('should handle rate limit followed by server error', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      
      const serverError = new Error('Server Error');
      (serverError as any).status = 500;
      
      const successResponse = {
        content: [{ type: 'text', text: 'Success after mixed errors' }]
      };

      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce(successResponse);

      const client = new LLMClient({ 
        apiKey: 'test-key', 
        baseDelay: 100,
        maxRetries: 3
      });
      
      const completionPromise = client.complete('Test prompt');
      
      // First retry: exponential backoff (100ms)
      await jest.advanceTimersByTimeAsync(100);
      
      // Second retry: server error fixed delay (5000ms)
      await jest.advanceTimersByTimeAsync(5000);
      
      const result = await completionPromise;
      
      expect(result).toBe('Success after mixed errors');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should not retry on final attempt for rate limits', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      
      mockCreate.mockRejectedValue(rateLimitError);

      const client = new LLMClient({ 
        apiKey: 'test-key', 
        maxRetries: 1
      });
      
      await expect(client.complete('Test prompt')).rejects.toThrow(MaxRetriesExceededError);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should not retry on final attempt for server errors', async () => {
      const serverError = new Error('Server Error');
      (serverError as any).status = 500;
      
      mockCreate.mockRejectedValue(serverError);

      const client = new LLMClient({ 
        apiKey: 'test-key', 
        maxRetries: 1
      });
      
      await expect(client.complete('Test prompt')).rejects.toThrow(MaxRetriesExceededError);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry Configuration', () => {
    it('should respect custom maxRetries setting', async () => {
      // Use real timers for this test to avoid fake timer issues
      jest.useRealTimers();
      
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      
      mockCreate.mockRejectedValue(rateLimitError);

      const client = new LLMClient({ 
        apiKey: 'test-key', 
        maxRetries: 5,
        baseDelay: 1 // Use very short delay for real timers
      });
      
      // Use try/catch to properly handle the error
      try {
        await client.complete('Test prompt');
        fail('Expected MaxRetriesExceededError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MaxRetriesExceededError);
        expect((error as Error).message).toBe('Failed after 5 attempts');
      }
      
      expect(mockCreate).toHaveBeenCalledTimes(5);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });

    it('should respect custom baseDelay setting', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      
      const successResponse = {
        content: [{ type: 'text', text: 'Success with custom delay' }]
      };

      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(successResponse);

      const client = new LLMClient({ 
        apiKey: 'test-key', 
        baseDelay: 2000
      });
      
      const completionPromise = client.complete('Test prompt');
      
      // Should use custom base delay of 2000ms
      await jest.advanceTimersByTimeAsync(2000);
      
      const result = await completionPromise;
      
      expect(result).toBe('Success with custom delay');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle zero maxRetries', async () => {
      // Use real timers for this test to avoid fake timer issues
      jest.useRealTimers();
      
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      
      mockCreate.mockRejectedValue(rateLimitError);

      const client = new LLMClient({ 
        apiKey: 'test-key', 
        maxRetries: 0
      });
      
      // Use try/catch to properly handle the error
      try {
        await client.complete('Test prompt');
        fail('Expected MaxRetriesExceededError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MaxRetriesExceededError);
        expect((error as Error).message).toBe('Failed after 0 attempts');
      }
      
      // With maxRetries: 0, no API calls should be made
      expect(mockCreate).toHaveBeenCalledTimes(0);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });
  });
});
