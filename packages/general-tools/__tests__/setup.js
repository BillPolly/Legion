/**
 * Jest setup file for @jsenvoy/tools tests
 */

import { jest } from '@jest/globals';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
const rootEnvPath = path.resolve(__dirname, '../../../.env');
config({ path: rootEnvPath });

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.TEST_TIMEOUT = 30000;
global.INTEGRATION_TEST_TIMEOUT = 60000;

// Mock console methods in tests to reduce noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Reset console mocks
  console.log = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Export for use in tests
export {
  __dirname,
  __filename
};