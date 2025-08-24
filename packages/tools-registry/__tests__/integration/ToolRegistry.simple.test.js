/**
 * Simple ToolRegistry Integration Test
 * 
 * Basic functionality test to verify the fixes work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';

describe('ToolRegistry Simple Integration', () => {
  let resourceManager;
  let mongoClient;
  let testDbName;
  let toolRegistry;

  beforeEach(async () => {
    // Create unique test database
    testDbName = `test_simple_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getResourceManager();
    
    // Create MongoDB connection
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    
    // Set test database using correct nested object structure
    resourceManager.set('test', { 
      database: { 
        name: testDbName,
        client: mongoClient
      }
    });

    // Drop test database to ensure clean state
    await mongoClient.db(testDbName).dropDatabase();
  });

  afterEach(async () => {
    // Clean up
    if (toolRegistry) {
      await toolRegistry.cleanup();
      toolRegistry = null;
    }

    if (mongoClient) {
      try {
        await mongoClient.db(testDbName).dropDatabase();
        await mongoClient.close();
      } catch (error) {
        console.warn('Cleanup error:', error.message);
      }
    }
  });

  it('should initialize ToolRegistry with database isolation', async () => {
    // Create ToolRegistry with minimal configuration
    toolRegistry = new ToolRegistry({ 
      resourceManager,
      options: {
        enablePerspectives: false,
        enableVectorSearch: false
      }
    });

    // Initialize should succeed
    await toolRegistry.initialize();
    expect(toolRegistry.initialized).toBe(true);

    // Should be using test database
    expect(toolRegistry.databaseStorage.options.databaseName).toBe(testDbName);
  });

  it('should handle basic tool operations', async () => {
    toolRegistry = new ToolRegistry({ 
      resourceManager,
      options: {
        enablePerspectives: false,
        enableVectorSearch: false
      }
    });

    await toolRegistry.initialize();

    // Create test data directly in database
    const db = mongoClient.db(testDbName);
    await db.collection('modules').insertOne({
      name: 'TestModule',
      description: 'Test module'
    });

    await db.collection('tools').insertMany([
      {
        name: 'testTool1',
        description: 'First test tool',
        moduleName: 'TestModule'
      },
      {
        name: 'testTool2', 
        description: 'Second test tool',
        moduleName: 'TestModule'
      }
    ]);

    // List tools should work
    const tools = await toolRegistry.listTools();
    expect(tools).toHaveLength(2);
    expect(tools.map(t => t.name)).toContain('testTool1');
    expect(tools.map(t => t.name)).toContain('testTool2');

    // Search should work (now that TextSearch is initialized)
    const searchResults = await toolRegistry.searchTools('test');
    expect(searchResults).toHaveLength(2);

    // Statistics should work
    const stats = await toolRegistry.getStatistics();
    expect(stats.modules).toBe(1);
    expect(stats.tools).toBe(2);
  });

  it('should handle cleanup properly', async () => {
    toolRegistry = new ToolRegistry({ 
      resourceManager,
      options: {
        enablePerspectives: false,
        enableVectorSearch: false
      }
    });

    await toolRegistry.initialize();

    // Add some test data
    const db = mongoClient.db(testDbName);
    await db.collection('tools').insertOne({
      name: 'cleanupTest',
      description: 'Tool for cleanup test',
      moduleName: 'CleanupModule'
    });

    // Verify data exists
    let toolCount = await db.collection('tools').countDocuments();
    expect(toolCount).toBe(1);

    // Clear all should work
    await toolRegistry.clearAll();

    // Verify data is gone
    toolCount = await db.collection('tools').countDocuments();
    expect(toolCount).toBe(0);

    // Health check should still work
    const health = await toolRegistry.healthCheck();
    expect(health.initialized).toBe(true);
    expect(health.database).toBe(true);
  });
});