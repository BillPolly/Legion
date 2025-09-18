/**
 * Test setup for ROMA-Agent
 * Initializes ResourceManager and ToolRegistry singletons at the beginning
 * NO MOCKS - using real resources as per CLAUDE.md
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

// Initialize singletons once for all tests
let resourceManager;
let toolRegistry;

global.beforeAll(async () => {
  // Get singleton ResourceManager instance
  resourceManager = await ResourceManager.getInstance();
  
  // Get singleton ToolRegistry instance  
  toolRegistry = await ToolRegistry.getInstance();
  
  // Make them globally available for tests
  global.resourceManager = resourceManager;
  global.toolRegistry = toolRegistry;
});

// Clean up after all tests
global.afterAll(async () => {
  // Cleanup if needed
  if (global.resourceManager) {
    // ResourceManager is a singleton, don't destroy it
    global.resourceManager = null;
  }
  
  if (global.toolRegistry) {
    // ToolRegistry is a singleton, don't destroy it
    global.toolRegistry = null;
  }
});

// Set default test timeout to prevent hanging
jest.setTimeout(30000);