/**
 * Test setup file for agent package
 * This file runs before all tests to set up common configurations
 */

import { jest } from '@jest/globals';

// Create mock functions lazily to avoid creating them until actually used
global.mockTool = (overrides = {}) => ({
  identifier: 'test_tool',
  name: 'Test Tool',
  abilities: ['test'],
  instructions: ['Test instruction'],
  functions: [
    {
      name: 'testFunction',
      purpose: 'Test function',
      arguments: [],
      response: 'string'
    }
  ],
  functionMap: {
    testFunction: () => Promise.resolve('test result')
  },
  setExecutingAgent: () => {},
  ...overrides
});

global.mockModel = (overrides = {}) => ({
  sendAndReceiveResponse: () => Promise.resolve('{"task_completed": true, "response": {"type": "string", "message": "Test response"}}'),
  initializeModel: () => {},
  ...overrides
});

global.mockModelConfig = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  apiKey: 'test-api-key'
};

// Helper to create mock messages
global.createMockMessages = (count = 1) => {
  const messages = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      role: i === 0 ? 'system' : 'user',
      content: `Test message ${i + 1}`
    });
  }
  return messages;
};