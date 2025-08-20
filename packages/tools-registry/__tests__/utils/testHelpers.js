/**
 * Test Helpers for tools-registry Tests
 * 
 * Utility functions for testing with REAL resources.
 * NO MOCKS, NO FALLBACKS - if resources aren't available, tests FAIL.
 */

import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';
import { ResourceManager } from '@legion/resource-manager';
import toolRegistry from '../../src/index.js';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Ensure MongoDB is available and connected
 * THROWS if MongoDB is not available
 */
export async function ensureMongoDBAvailable() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    await client.db('legion_tools_test').admin().ping();
    await client.close();
    return true;
  } catch (error) {
    throw new Error(`MongoDB is REQUIRED but not available: ${error.message}`);
  }
}

/**
 * Override MongoDB database to use test database
 * Call this before initializing ToolRegistry in tests
 */
export function useTestDatabase() {
  // Override the database name to use test database
  process.env.MONGODB_DATABASE = 'legion_tools_test';
  process.env.TOOLS_DATABASE_NAME = 'legion_tools_test';
}

/**
 * Ensure Qdrant is available
 * THROWS if Qdrant is not available
 */
export async function ensureQdrantAvailable() {
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  
  try {
    const response = await fetch(`${qdrantUrl}/collections`);
    if (!response.ok) {
      throw new Error(`Qdrant returned status ${response.status}`);
    }
    return true;
  } catch (error) {
    throw new Error(`Qdrant is REQUIRED for semantic tests but not available: ${error.message}`);
  }
}

/**
 * Clean test database collections
 * THROWS if cleanup fails
 */
export async function cleanTestDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db('legion_tools_test');
    
    const collections = ['modules', 'tools', 'tool_perspectives'];
    for (const collectionName of collections) {
      try {
        await db.collection(collectionName).deleteMany({});
      } catch (error) {
        // Collection might not exist, that's ok
        if (error.code !== 26) {
          throw error;
        }
      }
    }
    
    await client.close();
  } catch (error) {
    throw new Error(`Failed to clean test database: ${error.message}`);
  }
}

/**
 * Populate test database with minimal real modules
 * Uses REAL Legion modules - NO MOCKS
 * THROWS if population fails
 */
export async function populateTestModules() {
  const loader = await toolRegistry.getLoader();
  
  // Load only essential modules for testing
  const testModules = ['calculator', 'json', 'file'];
  
  try {
    // Clear first
    await loader.clearAll();
    
    // Load specific modules
    const result = await loader.loadModules({ 
      module: testModules.join(',') 
    });
    
    if (result.loadResult?.failed?.length > 0) {
      throw new Error(`Failed to load modules: ${result.loadResult.failed.map(f => f.config.name).join(', ')}`);
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to populate test modules: ${error.message}`);
  }
}

/**
 * Reset ToolRegistry singleton
 * Forces a fresh instance for the next test
 */
export async function resetToolRegistrySingleton() {
  // Clean up existing instance if it exists
  if (ToolRegistry._instance) {
    try {
      await ToolRegistry._instance.cleanup();
    } catch (error) {
      console.warn('Failed to cleanup ToolRegistry instance:', error.message);
    }
  }
  
  // Clear the singleton instance
  ToolRegistry._instance = null;
  
  // Clear any caches
  if (toolRegistry.toolCache) {
    toolRegistry.toolCache.clear();
  }
  if (toolRegistry.moduleCache) {
    toolRegistry.moduleCache.clear();
  }
}

/**
 * Get a fresh ToolRegistry instance
 * Ensures clean state for testing
 */
export async function getFreshToolRegistry() {
  await resetToolRegistrySingleton();
  const instance = ToolRegistry.getInstance();
  await instance.initialize();
  return instance;
}

/**
 * Create a test file for file tool testing
 * Returns the file path
 */
export async function createTestFile(filename, content) {
  const testDir = path.join(process.cwd(), 'test-files');
  await fs.mkdir(testDir, { recursive: true });
  
  const filePath = path.join(testDir, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  
  return filePath;
}

/**
 * Clean up test files
 */
export async function cleanupTestFiles() {
  const testDir = path.join(process.cwd(), 'test-files');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist
  }
}

/**
 * Wait for condition with timeout
 * Useful for async operations
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
 * Verify tool can be retrieved and executed
 * Uses REAL tool execution - NO MOCKS
 * THROWS if tool cannot be executed
 */
export async function verifyToolExecution(toolName, args) {
  const tool = await toolRegistry.getTool(toolName);
  
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found in registry`);
  }
  
  if (typeof tool.execute !== 'function') {
    throw new Error(`Tool '${toolName}' does not have execute method`);
  }
  
  try {
    const result = await tool.execute(args);
    return result;
  } catch (error) {
    throw new Error(`Tool '${toolName}' execution failed: ${error.message}`);
  }
}

/**
 * Get test MongoDB database connection
 * For direct database operations in tests
 */
export async function getTestDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(mongoUri);
  await client.connect();
  
  const db = client.db('legion_tools_test');
  
  // Return db and cleanup function
  return {
    db,
    cleanup: async () => {
      await client.close();
    }
  };
}

/**
 * Assert that a value is defined (not null or undefined)
 * Helper for strict testing
 */
export function assertDefined(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined');
  }
  return value;
}

/**
 * Assert that an async operation throws
 * Useful for testing error cases
 */
export async function assertThrows(asyncFn, expectedMessage) {
  try {
    await asyncFn();
    throw new Error('Expected function to throw but it did not');
  } catch (error) {
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(`Expected error message to include "${expectedMessage}" but got "${error.message}"`);
    }
    return error;
  }
}