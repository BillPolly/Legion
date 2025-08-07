/**
 * Jest setup file for planning integration tests
 * Configures global test environment and utilities
 */

import { jest } from '@jest/globals';

// Increase timeout for integration tests with LLM calls
jest.setTimeout(60000);

// Global test configuration
global.testConfig = {
  workspaceBasePath: '/tmp/legion-integration-tests',
  defaultTimeout: 30000,
  llmTimeout: 45000,
  maxRetries: 2
};

// Mock console methods to reduce noise unless explicitly needed
const originalConsole = { ...console };
global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error // Keep errors visible
};

// Restore console for specific tests that need it
global.enableConsole = () => {
  global.console = originalConsole;
};

global.disableConsole = () => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: originalConsole.error
  };
};

// Test result tracking
global.testResults = {
  llmCalls: 0,
  btExecutions: 0,
  filesCreated: 0,
  executionTime: 0
};

global.trackLLMCall = () => {
  global.testResults.llmCalls++;
};

global.trackBTExecution = () => {
  global.testResults.btExecutions++;
};

global.trackFileCreation = () => {
  global.testResults.filesCreated++;
};

global.trackExecutionTime = (startTime) => {
  global.testResults.executionTime += Date.now() - startTime;
};

// Reset tracking between tests
beforeEach(() => {
  global.testResults = {
    llmCalls: 0,
    btExecutions: 0,
    filesCreated: 0,
    executionTime: 0
  };
});