/**
 * Simple integration test for ToolRegistry
 * NO complex setup, NO hanging - just test the basics
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { StorageProvider } from '@legion/storage';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';

describe('ToolRegistry Simple Integration', () => {
  let resourceManager;
  let storageProvider;
  let toolRegistry;
  let testDbName;

  beforeAll(async () => {
    // Create isolated test database
    testDbName = `test_simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Override database name for testing
    resourceManager.set('testDbName', testDbName);
    
    storageProvider = await StorageProvider.create(resourceManager);
    
    toolRegistry = new ToolRegistry(storageProvider, null); // No semantic search
    await toolRegistry.initialize();
  }, 30000);

  afterAll(async () => {
    // Clean up - drop test database
    if (storageProvider && testDbName) {
      const mongoProvider = storageProvider.getProvider('mongodb');
      await mongoProvider.db.dropDatabase();
      await mongoProvider.disconnect();
    }
  }, 10000);

  test('should initialize ToolRegistry without hanging', async () => {
    expect(toolRegistry).toBeDefined();
    expect(toolRegistry.isInitialized()).toBe(true);
  });

  test('should handle empty tool list initially', async () => {
    const tools = await toolRegistry.listTools();
    expect(Array.isArray(tools)).toBe(true);
    // May be empty initially, that's fine
  });

  test('should return null for non-existent tool', async () => {
    const tool = await toolRegistry.getTool('nonexistent_tool_xyz');
    expect(tool).toBeNull();
  });

  test('should handle search with no results', async () => {
    const results = await toolRegistry.searchTools('nonexistent_search_xyz');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });
});