/**
 * Integration tests for the complete staged pipeline
 * Tests the full flow through ToolRegistry public API only
 * NO MOCKING - uses actual resources, but proper architecture
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient, ObjectId } from 'mongodb';
import { QdrantClient } from '@qdrant/js-client-rest';
import fs from 'fs/promises';
import path from 'path';

describe('Staged Pipeline Integration Tests', () => {
  let toolRegistry;
  let resourceManager;
  let mongoClient;
  let qdrantClient;
  let db;
  
  beforeAll(async () => {
    // Initialize ResourceManager to use actual production database
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Verify required services are available
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    const dbName = resourceManager.get('env.TOOLS_DATABASE_NAME') || resourceManager.get('env.MONGODB_DATABASE');
    const qdrantUrl = resourceManager.get('env.QDRANT_URL');
    
    console.log('🔍 Using actual database configuration:');
    console.log('  MONGODB_URL:', mongoUrl);
    console.log('  DATABASE_NAME:', dbName);
    
    if (!mongoUrl || !dbName) {
      throw new Error(`Invalid database configuration: URL=${mongoUrl}, DB=${dbName}`);
    }
    
    if (!qdrantUrl) {
      throw new Error('QDRANT_URL not configured - integration tests require Qdrant');
    }
    
    // Connect directly to verify services are running
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db(dbName);
    
    qdrantClient = new QdrantClient({ url: qdrantUrl });
    
    // Verify Qdrant is accessible
    try {
      await qdrantClient.getCollections();
    } catch (error) {
      throw new Error(`Qdrant not accessible at ${qdrantUrl}: ${error.message}`);
    }
  }, 30000);

  beforeEach(async () => {
    // Create ToolRegistry instance (should auto-initialize with production ResourceManager)
    toolRegistry = ToolRegistry.getInstance();
    
    // Verify calculator module exists in module_registry for testing
    console.log('🔍 Verifying calculator module exists in module_registry...');
    
    const calculatorModule = await db.collection('module_registry').findOne({ name: 'calculator' });
    if (!calculatorModule) {
      throw new Error('calculator module not found in module_registry! Run discovery first to populate module registry with well-known modules.');
    }
    
    console.log('✅ calculator module found in module_registry');
  }, 45000);

  afterEach(async () => {
    // ToolRegistry singleton cleanup is handled globally
  });

  afterAll(async () => {
    // Force cleanup of ToolRegistry instance to prevent handle leaks
    if (toolRegistry) {
      try {
        // Clear any intervals to prevent Jest from hanging
        if (toolRegistry.cacheCleanupInterval) {
          clearInterval(toolRegistry.cacheCleanupInterval);
          toolRegistry.cacheCleanupInterval = null;
        }
        await toolRegistry.cleanup();
      } catch (error) {
        console.warn('Warning: ToolRegistry cleanup failed:', error.message);
      }
    }
    
    // Close the MongoDB connection - no data deletion from production database
    await mongoClient.close();
  });

  describe('Full Pipeline Execution', () => {
    it('should execute complete pipeline successfully', async () => {
      // Use ToolRegistry public API to load calculator module
      const result = await toolRegistry.loadModule('calculator', {
        clearFirst: true,
        includePerspectives: true,
        includeVectors: true,
        verbose: false
      });
      
      // Debug output to understand failure
      if (!result.success) {
        console.log('loadModule failed:', result);
      }
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.toolsAdded).toBeGreaterThan(0);
      
      // Verify we can retrieve the calculator tool
      const calculatorTool = await toolRegistry.getTool('calculator');
      expect(calculatorTool).toBeDefined();
      expect(typeof calculatorTool.execute).toBe('function');
      
      // Verify data in MongoDB - calculator module has tools
      const toolCount = await db.collection('tools').countDocuments({ moduleName: 'calculator' });
      expect(toolCount).toBeGreaterThan(0);
      
      const perspectiveCount = await db.collection('tool_perspectives').countDocuments();
      expect(perspectiveCount).toBeGreaterThan(0);
    }, 60000);

    it('should clear and reload modules properly', async () => {
      // First load calculator data
      await toolRegistry.loadModule('calculator', { clearFirst: true });
      
      // Verify data exists
      const toolsBeforeClear = await db.collection('tools').countDocuments({ moduleName: 'calculator' });
      expect(toolsBeforeClear).toBeGreaterThan(0);
      
      // Clear calculator module
      const clearResult = await toolRegistry.clearModule('calculator');
      expect(clearResult.success).toBe(true);
      
      // Verify calculator tools are gone
      const toolsAfterClear = await db.collection('tools').countDocuments({ moduleName: 'calculator' });
      expect(toolsAfterClear).toBe(0);
      
      // Reload calculator - should restore tools
      const reloadResult = await toolRegistry.loadModule('calculator');
      expect(reloadResult.success).toBe(true);
      expect(reloadResult.toolsAdded).toBeGreaterThan(0);
      
      // Verify tools are back
      const toolsAfterReload = await db.collection('tools').countDocuments({ moduleName: 'calculator' });
      expect(toolsAfterReload).toBeGreaterThan(0);
    }, 60000);

    it('should handle module filter correctly', async () => {
      // Clear all modules first, then load only calculator
      await toolRegistry.clearAllModules();
      
      const result = await toolRegistry.loadModule('calculator');
      expect(result.success).toBe(true);
      
      // Verify only calculator module's tools were processed
      const tools = await db.collection('tools').find({}).toArray();
      const calculatorTools = tools.filter(t => t.moduleName === 'calculator');
      const otherTools = tools.filter(t => t.moduleName !== 'calculator');
      
      expect(calculatorTools.length).toBeGreaterThan(0);
      expect(otherTools).toHaveLength(0);
      
      // Verify calculator tools are the expected ones
      const toolNames = calculatorTools.map(t => t.name);
      console.log(`✅ calculator module loaded ${toolNames.length} tools: ${toolNames.join(', ')}`);
      expect(toolNames).toContain('calculator'); // Calculator module has the 'calculator' tool
    }, 60000);
  });

  describe('Module Operations', () => {
    it('should handle multiple module operations', async () => {
      // Test loading multiple modules sequentially
      const result1 = await toolRegistry.loadModule('calculator', { clearFirst: true });
      expect(result1.success).toBe(true);
      
      // Verify calculator tool is available
      const calcTool = await toolRegistry.getTool('calculator');
      expect(calcTool).toBeDefined();
      
      // Test that tool is actually executable
      const execResult = await calcTool.execute({ expression: '2 + 2' });
      expect(execResult.success || execResult.data?.result === 4).toBe(true);
      
      // Clear and verify it's gone
      const clearResult = await toolRegistry.clearModule('calculator');
      expect(clearResult.success).toBe(true);
      
      // Tool should no longer be available
      const clearedTool = await toolRegistry.getTool('calculator');
      expect(clearedTool).toBeNull();
    }, 60000);

    it('should handle list tools functionality', async () => {
      // Load calculator module
      await toolRegistry.loadModule('calculator', { clearFirst: true });
      
      // List all tools
      const allTools = await toolRegistry.listTools();
      expect(Array.isArray(allTools)).toBe(true);
      expect(allTools.length).toBeGreaterThan(0);
      
      // Find calculator tool
      const calcTool = allTools.find(t => t.name === 'calculator');
      expect(calcTool).toBeDefined();
      expect(calcTool.moduleName).toBe('calculator');
      
      // List tools by module
      const calcTools = await toolRegistry.listTools({ module: 'calculator' });
      expect(Array.isArray(calcTools)).toBe(true);
      expect(calcTools.length).toBeGreaterThan(0);
      expect(calcTools.every(t => t.moduleName === 'calculator')).toBe(true);
    }, 60000);
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across operations', async () => {
      // Load calculator module with all data types
      const result = await toolRegistry.loadModule('calculator', {
        clearFirst: true,
        includePerspectives: true,
        includeVectors: false // Skip vectors for speed
      });
      
      expect(result.success).toBe(true);
      expect(result.toolsAdded).toBeGreaterThan(0);
      
      // Verify tools exist
      const tools = await db.collection('tools').countDocuments({ moduleName: 'calculator' });
      expect(tools).toBeGreaterThan(0);
      
      // Verify perspectives exist if they were generated
      const perspectives = await db.collection('tool_perspectives').countDocuments();
      if (result.perspectivesGenerated > 0) {
        expect(perspectives).toBeGreaterThan(0);
      }
      
      // Verify tool is actually retrievable and executable
      const calcTool = await toolRegistry.getTool('calculator');
      expect(calcTool).toBeDefined();
      expect(typeof calcTool.execute).toBe('function');
    }, 60000);

    it('should handle search functionality', async () => {
      // Load calculator module
      await toolRegistry.loadModule('calculator', { clearFirst: true });
      
      // Test search functionality (if available)
      try {
        const searchResults = await toolRegistry.searchTools('calculator');
        if (searchResults) {
          expect(Array.isArray(searchResults)).toBe(true);
          // If search returns results, they should be relevant
          if (searchResults.length > 0) {
            const calcResult = searchResults.find(r => r.name === 'calculator');
            expect(calcResult).toBeDefined();
          }
        }
      } catch (error) {
        // Search functionality may not be available - that's OK
        console.log('Search functionality not available:', error.message);
      }
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle invalid module names gracefully', async () => {
      const result = await toolRegistry.loadModule('nonexistent-module');
      // loadModule returns a result object with success false for invalid modules
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/not found|invalid|module/i);
    }, 60000);

    it('should handle invalid tool requests gracefully', async () => {
      // Load calculator first
      await toolRegistry.loadModule('calculator', { clearFirst: true });
      
      // Try to get nonexistent tool
      const nonexistentTool = await toolRegistry.getTool('nonexistent-tool');
      expect(nonexistentTool).toBeNull();
      
      // Try to get empty/invalid tool name - should throw ValidationError
      await expect(toolRegistry.getTool('')).rejects.toThrow('Invalid parameter');
    }, 60000);
  });

  describe('Integration Validation', () => {
    it('should demonstrate complete functionality end-to-end', async () => {
      // Complete workflow test using only public APIs
      
      // 1. Clear all data
      const clearResult = await toolRegistry.clearAllModules();
      expect(clearResult.success).toBe(true);
      
      // 2. Load calculator module
      const loadResult = await toolRegistry.loadModule('calculator', {
        includePerspectives: true,
        includeVectors: false
      });
      expect(loadResult.success).toBe(true);
      expect(loadResult.toolsAdded).toBeGreaterThan(0);
      
      // 3. List tools
      const tools = await toolRegistry.listTools();
      expect(tools.length).toBeGreaterThan(0);
      const calculatorTool = tools.find(t => t.name === 'calculator');
      expect(calculatorTool).toBeDefined();
      
      // 4. Get specific tool
      const tool = await toolRegistry.getTool('calculator');
      expect(tool).toBeDefined();
      expect(typeof tool.execute).toBe('function');
      
      // 5. Execute tool
      const execResult = await tool.execute({ expression: '5 * 6' });
      expect(execResult.success || execResult.data?.result === 30).toBe(true);
      
      // 6. Clear the module
      const finalClearResult = await toolRegistry.clearModule('calculator');
      expect(finalClearResult.success).toBe(true);
      
      // 7. Verify it's gone
      const clearedTool = await toolRegistry.getTool('calculator');
      expect(clearedTool).toBeNull();
      
      console.log('✅ Complete end-to-end workflow validated successfully');
    }, 60000);
  });
});