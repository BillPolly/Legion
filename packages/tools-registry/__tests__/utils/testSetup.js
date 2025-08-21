/**
 * Test Setup - Runs before each test file
 * 
 * Handles singleton cleanup and state reset between test files
 * to prevent test interference.
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';

// Reset singleton state before each test file
beforeAll(() => {
  // Use production database - no overrides
  
  // Clear the singleton instance to ensure fresh state
  ToolRegistry._instance = null;
  
  // Clear any module caches
  if (global.testModuleCache) {
    global.testModuleCache.clear();
  }
});

// Clean up after each test file
afterAll(async () => {
  // If a ToolRegistry instance exists, clean it up
  if (ToolRegistry._instance) {
    // Clear caches
    ToolRegistry._instance.clearCache();
    
    // Close any loader connections
    if (ToolRegistry._instance._loader) {
      if (ToolRegistry._instance._loader.cleanup) {
        await ToolRegistry._instance._loader.cleanup();
      } else if (ToolRegistry._instance._loader.close) {
        await ToolRegistry._instance._loader.close();
      }
    }
    
    // Reset the singleton
    ToolRegistry._instance = null;
  }
});