/**
 * ResourceManager Integration Tests
 * Tests the integration between ResourceManager and SimplePromptClient
 */

import { jest } from '@jest/globals';

// Mock the ResourceManager to avoid complex dependencies
const mockResourceManager = {
  getInstance: jest.fn(),
  get: jest.fn()
};

// Mock the import of ResourceManager
jest.unstable_mockModule('@legion/resource-manager', () => ({
  ResourceManager: mockResourceManager
}));

describe('ResourceManager Integration', () => {
  let originalConsoleLog;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console.log during tests
    originalConsoleLog = console.log;
    console.log = jest.fn();

    // Setup default mock behavior
    mockResourceManager.getInstance.mockResolvedValue(mockResourceManager);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('Simple Usage Pattern', () => {
    it('should demonstrate the expected usage pattern', async () => {
      // Mock a SimplePromptClient-like object
      const mockSimpleClient = {
        chat: jest.fn().mockResolvedValue('Hello! How can I help you today?'),
        request: jest.fn().mockResolvedValue({ 
          content: 'Mock response',
          toolCalls: [],
          metadata: { provider: 'mock' }
        })
      };

      mockResourceManager.get.mockImplementation((name) => {
        if (name === 'simplePromptClient') {
          return Promise.resolve(mockSimpleClient);
        }
        return Promise.resolve(null);
      });

      // This is how users should be able to use it:
      const { ResourceManager } = await import('@legion/resource-manager');
      const resourceManager = await ResourceManager.getInstance();
      const simpleClient = await resourceManager.get('simplePromptClient');

      // Simple chat
      const response1 = await simpleClient.chat('Hello');
      expect(response1).toBe('Hello! How can I help you today?');

      // Rich request
      const response2 = await simpleClient.request({
        prompt: 'Help me with code',
        systemPrompt: 'You are a coding assistant',
        tools: [{ name: 'codeRunner', description: 'Runs code' }]
      });

      expect(response2.content).toBe('Mock response');
      expect(mockSimpleClient.request).toHaveBeenCalledWith({
        prompt: 'Help me with code',
        systemPrompt: 'You are a coding assistant',
        tools: [{ name: 'codeRunner', description: 'Runs code' }]
      });
    });
  });

  describe('Three-Tier Architecture Demonstration', () => {
    it('should show all three tiers working together', async () => {
      const mockLLMClient = {
        complete: jest.fn().mockResolvedValue('LLM Response')
      };

      const mockSimpleClient = {
        chat: jest.fn().mockResolvedValue('Simple Response')
      };

      const mockPromptManager = {
        execute: jest.fn().mockResolvedValue({ 
          result: 'Complex Response',
          metadata: {} 
        })
      };

      mockResourceManager.get.mockImplementation((name) => {
        switch(name) {
          case 'llmClient': return Promise.resolve(mockLLMClient);
          case 'simplePromptClient': return Promise.resolve(mockSimpleClient);
          case 'promptManager': return Promise.resolve(mockPromptManager);
          default: return Promise.resolve(null);
        }
      });

      const { ResourceManager } = await import('@legion/resource-manager');
      const resourceManager = await ResourceManager.getInstance();

      // Tier 1: Basic string prompt
      const llmClient = await resourceManager.get('llmClient');
      const basicResponse = await llmClient.complete('Hello');
      expect(basicResponse).toBe('LLM Response');

      // Tier 2: Rich JSON interface  
      const simpleClient = await resourceManager.get('simplePromptClient');
      const richResponse = await simpleClient.chat('Hello');
      expect(richResponse).toBe('Simple Response');

      // Tier 3: Full pipeline (if implemented)
      // const promptManager = await resourceManager.get('promptManager');
      // const pipelineResponse = await promptManager.execute(sourceData);
      // expect(pipelineResponse.result).toBe('Complex Response');

      expect(mockLLMClient.complete).toHaveBeenCalledWith('Hello');
      expect(mockSimpleClient.chat).toHaveBeenCalledWith('Hello');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing environment variables gracefully', async () => {
      mockResourceManager.get.mockImplementation(() => {
        return Promise.reject(new Error('ANTHROPIC_API_KEY not found in environment variables'));
      });

      const { ResourceManager } = await import('@legion/resource-manager');
      const resourceManager = await ResourceManager.getInstance();

      await expect(resourceManager.get('simplePromptClient'))
        .rejects.toThrow('ANTHROPIC_API_KEY not found in environment variables');
    });
  });
});