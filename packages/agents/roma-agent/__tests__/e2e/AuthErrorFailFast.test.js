/**
 * Test to verify fail-fast behavior for authentication errors
 */

import { jest } from '@jest/globals';
import { LLMClient } from '../../../../prompting/llm-client/src/LLMClient.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Authentication Error Fail-Fast Tests', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
  });

  test('should fail immediately on authentication error without retries', async () => {
    // Create LLMClient with invalid API key
    const client = new LLMClient({
      provider: 'anthropic',
      apiKey: 'invalid-api-key-test-123',
      maxRetries: 3 // Should NOT retry despite this setting
    });

    // Mock the provider to simulate auth error
    const originalComplete = client.provider.complete.bind(client.provider);
    client.provider.complete = jest.fn().mockRejectedValue({
      status: 401,
      message: 'Invalid API key provided',
      type: 'authentication_error'
    });

    const startTime = Date.now();
    
    try {
      await client.complete('Test prompt');
      fail('Should have thrown an error');
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Verify it failed fast (should be < 1 second, not retrying)
      expect(duration).toBeLessThan(1000);
      
      // Verify error details
      expect(error.status).toBe(401);
      expect(error.message).toContain('Invalid API key');
      
      // Verify it was only called once (no retries)
      expect(client.provider.complete).toHaveBeenCalledTimes(1);
    }
  });

  test('should fail immediately on quota exceeded error without retries', async () => {
    // Create LLMClient
    const client = new LLMClient({
      provider: 'anthropic',
      apiKey: 'test-api-key',
      maxRetries: 3 // Should NOT retry despite this setting
    });

    // Mock the provider to simulate quota error
    client.provider.complete = jest.fn().mockRejectedValue({
      status: 402,
      message: 'Quota exceeded. Please upgrade your plan.',
      type: 'quota_error'
    });

    const startTime = Date.now();
    
    try {
      await client.complete('Test prompt');
      fail('Should have thrown an error');
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Verify it failed fast (should be < 1 second, not retrying)
      expect(duration).toBeLessThan(1000);
      
      // Verify error details
      expect(error.status).toBe(402);
      expect(error.message).toContain('Quota exceeded');
      
      // Verify it was only called once (no retries)
      expect(client.provider.complete).toHaveBeenCalledTimes(1);
    }
  });

  test('should retry on rate limit errors', async () => {
    // Create LLMClient with shorter delays for testing
    const client = new LLMClient({
      provider: 'anthropic',
      apiKey: 'test-api-key',
      maxRetries: 3,
      baseDelay: 100, // Short delay for testing
      serverErrorDelay: 100
    });

    let callCount = 0;
    client.provider.complete = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        // First two calls fail with rate limit
        return Promise.reject({
          status: 429,
          message: 'Rate limit exceeded'
        });
      }
      // Third call succeeds
      return Promise.resolve('Success response');
    });

    const result = await client.complete('Test prompt');
    
    // Verify it retried and eventually succeeded
    expect(result).toBe('Success response');
    expect(client.provider.complete).toHaveBeenCalledTimes(3);
  });

  test('should retry on transient network errors', async () => {
    // Create LLMClient with shorter delays for testing
    const client = new LLMClient({
      provider: 'anthropic',
      apiKey: 'test-api-key',
      maxRetries: 3,
      baseDelay: 100
    });

    let callCount = 0;
    client.provider.complete = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 2) {
        // First call fails with network error
        return Promise.reject({
          code: 'ECONNRESET',
          message: 'socket hang up'
        });
      }
      // Second call succeeds
      return Promise.resolve('Success response');
    });

    const result = await client.complete('Test prompt');
    
    // Verify it retried and eventually succeeded
    expect(result).toBe('Success response');
    expect(client.provider.complete).toHaveBeenCalledTimes(2);
  });

  test('should fail immediately on permission denied errors', async () => {
    const client = new LLMClient({
      provider: 'anthropic',
      apiKey: 'test-api-key',
      maxRetries: 3
    });

    client.provider.complete = jest.fn().mockRejectedValue({
      status: 403,
      message: 'Permission denied: Model access not allowed',
      type: 'permission_error'
    });

    const startTime = Date.now();
    
    try {
      await client.complete('Test prompt');
      fail('Should have thrown an error');
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Verify it failed fast
      expect(duration).toBeLessThan(1000);
      expect(error.status).toBe(403);
      expect(client.provider.complete).toHaveBeenCalledTimes(1);
    }
  });

  test('should fail immediately on invalid model errors', async () => {
    const client = new LLMClient({
      provider: 'anthropic',
      apiKey: 'test-api-key',
      maxRetries: 3
    });

    client.provider.complete = jest.fn().mockRejectedValue({
      status: 404,
      message: 'Model not found: invalid-model-name',
      type: 'not_found_error'
    });

    const startTime = Date.now();
    
    try {
      await client.complete('Test prompt');
      fail('Should have thrown an error');
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Verify it failed fast
      expect(duration).toBeLessThan(1000);
      expect(error.message).toContain('Model not found');
      expect(client.provider.complete).toHaveBeenCalledTimes(1);
    }
  });
});