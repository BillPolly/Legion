/**
 * Jest test setup for plan executor tests
 */

import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Jest globals should be available automatically in the test environment

// Set up global test environment
global.TEST_TIMEOUT = 30000;
global.TEST_TMPDIR = path.join(tmpdir(), 'plan-executor-tests');

// Ensure test temp directory exists
beforeAll(async () => {
  await fs.mkdir(global.TEST_TMPDIR, { recursive: true });
});

// Clean up after all tests
afterAll(async () => {
  try {
    await fs.rm(global.TEST_TMPDIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Mock console methods to reduce noise in tests unless explicitly testing them
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Restore original console methods for each test
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global test utilities
global.createTempDir = async (prefix = 'test-') => {
  return await fs.mkdtemp(path.join(global.TEST_TMPDIR, prefix));
};

global.mockConsole = () => {
  console.log = jest.fn();
  console.error = jest.fn();
};

global.restoreConsole = () => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
};

// Set up NODE_OPTIONS for ES modules
process.env.NODE_OPTIONS = '--experimental-vm-modules';