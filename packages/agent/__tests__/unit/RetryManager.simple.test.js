/**
 * Simplified unit tests for RetryManager class
 */

import { jest } from '@jest/globals';

describe('RetryManager Simple Tests', () => {
  it('should be able to import RetryManager', async () => {
    // Mock dependencies first
    jest.doMock('@jsenvoy/response-parser', () => ({
      ResponseParser: jest.fn(() => ({
        parse: jest.fn()
      })),
      ResponseValidator: jest.fn(() => ({
        validateResponse: jest.fn(),
        validateToolUse: jest.fn()
      }))
    }));

    const { RetryManager } = await import('../../src/RetryManager.js');
    expect(RetryManager).toBeDefined();
    
    const retryManager = new RetryManager();
    expect(retryManager).toBeDefined();
    expect(retryManager.maxRetries).toBe(3);
    expect(retryManager.backoffMultiplier).toBe(1000);
  });

  it('should handle configuration options', async () => {
    jest.doMock('@jsenvoy/response-parser', () => ({
      ResponseParser: jest.fn(() => ({
        parse: jest.fn()
      })),
      ResponseValidator: jest.fn(() => ({
        validateResponse: jest.fn(),
        validateToolUse: jest.fn()
      }))
    }));

    const { RetryManager } = await import('../../src/RetryManager.js');
    
    const retryManager = new RetryManager({
      maxRetries: 5,
      backoffMultiplier: 2000,
      tools: []
    });
    
    expect(retryManager.maxRetries).toBe(5);
    expect(retryManager.backoffMultiplier).toBe(2000);
    expect(retryManager.tools).toEqual([]);
  });
});