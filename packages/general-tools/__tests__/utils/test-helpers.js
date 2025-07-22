/**
 * Test helper utilities for @legion/tools
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock tool call object
 */
export function createMockToolCall(functionName, args = {}, id = 'test-call-id') {
  return {
    id,
    type: 'function',
    function: {
      name: functionName,
      arguments: typeof args === 'string' ? args : JSON.stringify(args)
    }
  };
}

/**
 * Creates a mock successful ToolResult
 */
export function createMockSuccessResult(data) {
  return {
    success: true,
    data,
    error: null
  };
}

/**
 * Creates a mock failed ToolResult
 */
export function createMockFailureResult(error, data = null) {
  return {
    success: false,
    data,
    error: error instanceof Error ? error.message : error
  };
}

/**
 * Validates that a result matches the ToolResult format
 */
export function validateToolResult(result) {
  expect(result).toHaveProperty('success');
  expect(typeof result.success).toBe('boolean');
  
  if (result.success) {
    expect(result).toHaveProperty('data');
    expect(result.error).toBeNull();
  } else {
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  }
}

/**
 * Creates a mock HTTP response
 */
export function createMockHttpResponse(statusCode = 200, data = {}, headers = {}) {
  return {
    statusCode,
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    headers,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    data
  };
}

/**
 * Creates a mock child process result
 */
export function createMockExecResult(stdout = '', stderr = '', code = 0) {
  return {
    stdout,
    stderr,
    code
  };
}

/**
 * Waits for a specified amount of time
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a test file path within the testdata directory
 */
export function createTempFilePath(filename = 'test-file.txt') {
  return `__tests__/testdata/jsenvoy-test-${Date.now()}-${filename}`;
}

/**
 * Validates environment variables for integration tests
 */
export function validateTestEnvironment() {
  const required = ['SERPER', 'GITHUB_PAT'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for integration tests: ${missing.join(', ')}`);
  }
}

/**
 * Skips test if environment variables are missing
 */
export function skipIfMissingEnv(envVars) {
  const missing = envVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`Skipping test - missing env vars: ${missing.join(', ')}`);
    return true;
  }
  return false;
}

/**
 * Creates a mock ResourceManager
 */
export function createMockResourceManager() {
  return {
    initialize: jest.fn().mockResolvedValue(true),
    get: jest.fn(),
    set: jest.fn(),
    getEnvVar: jest.fn((key) => process.env[key])
  };
}