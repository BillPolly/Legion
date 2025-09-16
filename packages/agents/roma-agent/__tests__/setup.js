/**
 * Test setup for ROMA-Agent
 * Initializes ResourceManager and other shared resources
 * NO MOCKS - using real resources as per CLAUDE.md
 */

import { ResourceManager } from '@legion/resource-manager';

// Initialize ResourceManager once for all tests
let resourceManager;

global.beforeAll(async () => {
  // Get singleton ResourceManager instance
  resourceManager = await ResourceManager.getInstance();
  
  // Make it globally available for tests
  global.resourceManager = resourceManager;
});

// Clean up after all tests
global.afterAll(async () => {
  // Cleanup if needed
  if (global.resourceManager) {
    // ResourceManager is a singleton, don't destroy it
    global.resourceManager = null;
  }
});