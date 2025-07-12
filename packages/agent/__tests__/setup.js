/**
 * Test setup file for agent package
 * This file runs before all tests to set up common configurations
 */

import { jest } from '@jest/globals';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../../.env');
config({ path: envPath });

// Verify API key is loaded for integration tests
if (process.env.NODE_ENV !== 'test' || process.env.TEST_INTEGRATION) {
  console.log('Loaded .env from:', envPath);
  console.log('API Key available:', !!process.env.OPENAI_API_KEY);
}

// Mock console methods to reduce noise during tests unless specifically needed
const originalConsole = { ...console };

beforeEach(() => {
  // Suppress console.log, console.error etc. by default
  // Individual tests can restore these if needed
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
});

afterEach(() => {
  // Restore console methods after each test
  Object.assign(console, originalConsole);
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Global test utilities
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
    testFunction: jest.fn().mockResolvedValue('test result')
  },
  setExecutingAgent: jest.fn(),
  ...overrides
});

global.mockModel = (overrides = {}) => ({
  sendAndReceiveResponse: jest.fn().mockResolvedValue('{"task_completed": true, "response": {"type": "string", "message": "Test response"}}'),
  initializeModel: jest.fn(),
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

// Helper to wait for async operations
global.waitFor = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));