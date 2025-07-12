/**
 * Test helper utilities for @jsenvoy/model-providers
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock OpenAI client for testing
 */
export function createMockOpenAIClient() {
  return {
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  };
}

/**
 * Creates mock model configurations for testing
 */
export function createMockConfigs() {
  return {
    openai: {
      provider: 'OPEN_AI',
      model: 'gpt-4o',
      apiKey: 'test-openai-key'
    },
    deepseek: {
      provider: 'DEEP_SEEK',
      model: 'deepseek-chat',
      apiKey: 'test-deepseek-key'
    },
    openrouter: {
      provider: 'OPEN_ROUTER',
      model: 'openai/gpt-4o',
      apiKey: 'test-openrouter-key'
    }
  };
}

/**
 * Creates test messages in the expected format
 */
export function createTestMessages() {
  return [
    {
      role: 'system',
      content: 'You are a helpful assistant.'
    },
    {
      role: 'user',
      content: 'Hello, how are you?'
    }
  ];
}

/**
 * Creates mock API responses
 */
export function createMockResponses() {
  return {
    openai: {
      choices: [{
        message: {
          content: 'Hello! I am doing well, thank you for asking.'
        }
      }]
    },
    deepseek: {
      choices: [{
        message: {
          content: '{"response": "Hello! I am doing well, thank you for asking."}'
        }
      }]
    },
    openrouter: {
      choices: [{
        message: {
          content: '{"response": "Hello! I am doing well, thank you for asking."}'
        }
      }]
    }
  };
}

/**
 * Creates mock API error responses
 */
export function createMockErrors() {
  return {
    authError: new Error('Authentication failed'),
    networkError: new Error('Network timeout'),
    apiError: new Error('API rate limit exceeded'),
    parseError: new Error('Invalid JSON response')
  };
}

/**
 * Validates that a provider instance has required methods
 */
export function validateProviderInterface(provider) {
  expect(provider).toHaveProperty('sendAndReceiveResponse');
  expect(typeof provider.sendAndReceiveResponse).toBe('function');
  expect(provider).toHaveProperty('model');
  expect(provider).toHaveProperty('client');
}

/**
 * Validates message format
 */
export function validateMessageFormat(messages) {
  expect(Array.isArray(messages)).toBe(true);
  messages.forEach(message => {
    expect(message).toHaveProperty('role');
    expect(message).toHaveProperty('content');
    expect(['system', 'user', 'assistant']).toContain(message.role);
    expect(typeof message.content === 'string' || Array.isArray(message.content)).toBe(true);
  });
}

/**
 * Creates test environment check helper
 */
export function hasLiveAPIKeys() {
  return {
    openai: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key',
    anthropic: !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'test-key',
    deepseek: !!process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'test-key'
  };
}

/**
 * Creates integration test configuration from environment
 */
export function createIntegrationTestConfigs() {
  const configs = {};
  
  if (process.env.OPENAI_API_KEY) {
    configs.openai = {
      provider: 'OPEN_AI',
      model: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY
    };
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    configs.anthropic = {
      provider: 'ANTHROPIC',
      model: 'claude-3-haiku-20240307',
      apiKey: process.env.ANTHROPIC_API_KEY
    };
  }

  if (process.env.DEEPSEEK_API_KEY) {
    configs.deepseek = {
      provider: 'DEEP_SEEK',
      model: 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY
    };
  }

  return configs;
}

/**
 * Measures response time for performance testing
 */
export async function measureResponseTime(provider, messages) {
  const startTime = performance.now();
  const response = await provider.sendAndReceiveResponse(messages);
  const endTime = performance.now();
  
  return {
    response,
    timeMs: endTime - startTime
  };
}

/**
 * Creates mock network delay for testing
 */
export function mockNetworkDelay(ms = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates API response format
 */
export function validateAPIResponse(response) {
  expect(response).toBeDefined();
  expect(response).not.toBeNull();
  
  if (typeof response === 'string') {
    expect(response.length).toBeGreaterThan(0);
  } else if (typeof response === 'object') {
    expect(Object.keys(response).length).toBeGreaterThan(0);
  }
}

/**
 * Creates multimodal test messages with images
 */
export function createMultimodalTestMessages() {
  return [
    {
      role: 'system',
      content: 'You are a helpful assistant that can analyze images.'
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What do you see in this image?'
        },
        {
          type: 'image_url',
          image_url: {
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          }
        }
      ]
    }
  ];
}

/**
 * Creates stress test scenarios
 */
export function createStressTestScenarios() {
  return {
    largeMessage: {
      role: 'user',
      content: 'Analyze this text: ' + 'word '.repeat(1000)
    },
    manyMessages: Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}: This is a test message for stress testing.`
    })),
    complexContent: {
      role: 'user',
      content: [
        { type: 'text', text: 'Complex multimodal content with ' },
        { type: 'text', text: 'multiple text segments and special characters: éñ中文🌟' }
      ]
    }
  };
}