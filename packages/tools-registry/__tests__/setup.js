/**
 * Global test setup for tools-registry
 * 
 * Minimal setup - ToolRegistry handles its own cleanup via reset()
 */

import { afterEach, beforeEach, jest } from '@jest/globals';
import { ToolRegistry } from '../src/index.js';

// Clean up state before and after each test to prevent interference
beforeEach(async () => {
  // Reset ToolRegistry singleton
  ToolRegistry.reset();
  
  // Clear any module caches to prevent state leakage
  jest.clearAllMocks();
  
  // Set a unique test identifier to prevent database name collisions
  process.env.TEST_RUN_ID = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
});

afterEach(async () => {
  // Reset ToolRegistry singleton
  ToolRegistry.reset();
  
  // Clear any module caches
  jest.clearAllMocks();
  
  // Force garbage collection if available (helps with MongoDB cleanup)
  if (global.gc) {
    global.gc();
  }
  
  // Clean up test environment variable
  delete process.env.TEST_RUN_ID;
});

// Set default test timeout to prevent hanging
jest.setTimeout(30000);