/**
 * Test utilities for Claude Tools testing
 */

import { Tool, Module } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

/**
 * Create a test ResourceManager with default configuration
 */
export async function createTestResourceManager(config = {}) {
  const resourceManager = await ResourceManager.getInstance();
  
  // Set test configuration
  const testConfig = {
    BASE_PATH: process.cwd(),
    COMMAND_TIMEOUT: 5000,
    MAX_FILE_SIZE: 1024 * 1024, // 1MB for tests
    CACHE_TTL: 60,
    ...config
  };
  
  // Apply configuration to ResourceManager
  for (const [key, value] of Object.entries(testConfig)) {
    resourceManager.set(key, value);
  }
  
  return resourceManager;
}

/**
 * Validate tool result structure
 * With modern error handling, successful results return data directly,
 * and errors are thrown as exceptions
 */
export function validateToolResult(result) {
  expect(result).toBeDefined();
  expect(typeof result).toBe('object');
  
  // Modern tools return data directly on success
  // Errors are thrown as exceptions and should be caught in tests
  
  return result;
}

/**
 * Assert successful tool result
 */
export function assertSuccess(result) {
  validateToolResult(result);
  if (!result.success) {
    console.error('Tool failed with error:', result.error);
  }
  expect(result.success).toBe(true);
  expect(result.data).toBeDefined();
  return result.data;
}

/**
 * Assert failed tool result with specific error code
 */
export function assertFailure(result, expectedErrorCode = null) {
  validateToolResult(result);
  expect(result.success).toBe(false);
  
  // Handle both error formats (string or object)
  const error = result.error || result.data;
  expect(error).toBeDefined();
  
  if (expectedErrorCode) {
    // Check for code in either format - handle string errors and result-level errorCode
    const code = error.code || error.errorCode || result.errorCode;
    expect(code).toBe(expectedErrorCode);
  }
  
  // Return error object that works with both string and object formats
  return {
    message: typeof error === 'string' ? error : (error.message || error.errorMessage),
    errorMessage: typeof error === 'string' ? error : (error.errorMessage || error.message),
    code: error.code || error.errorCode || result.errorCode
  };
}

/**
 * Create a mock tool for testing
 */
export function createMockTool(name, executeFunc) {
  return new Tool({
    name,
    description: `Mock tool: ${name}`,
    execute: executeFunc || (async (input) => ({ input })),
    getMetadata: () => ({
      name,
      description: `Mock tool: ${name}`,
      input: {},
      output: {}
    })
  });
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Execute a tool and measure performance
 */
export async function measureToolPerformance(tool, input) {
  const startTime = Date.now();
  const result = await tool.execute(input);
  const executionTime = Date.now() - startTime;
  
  return {
    result,
    executionTime,
    success: result.success
  };
}

/**
 * Validate module structure
 */
export function validateModule(module) {
  expect(module).toBeDefined();
  expect(module).toBeInstanceOf(Module);
  expect(typeof module.listTools).toBe('function');
  expect(typeof module.getTool).toBe('function');
  expect(typeof module.executeTool).toBe('function');
  
  const tools = module.listTools();
  expect(Array.isArray(tools)).toBe(true);
  
  return module;
}

/**
 * Validate tool metadata structure
 */
export function validateToolMetadata(metadata) {
  expect(metadata).toBeDefined();
  expect(typeof metadata).toBe('object');
  expect(typeof metadata.name).toBe('string');
  expect(typeof metadata.description).toBe('string');
  expect(metadata.input).toBeDefined();
  expect(metadata.output).toBeDefined();
  
  return metadata;
}

/**
 * Create test data of specified size
 */
export function createTestData(size) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\n';
  let result = '';
  for (let i = 0; i < size; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Compare file contents ignoring line endings
 */
export function compareFileContents(actual, expected) {
  const normalizeLineEndings = (str) => str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  expect(normalizeLineEndings(actual)).toBe(normalizeLineEndings(expected));
}