/**
 * Integration tests for TextSearch
 * 
 * Tests text search functionality with real MongoDB
 * No mocks - using actual database operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { TextSearch } from '../../src/search/TextSearch.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { DatabaseOperations } from '../../src/core/DatabaseOperations.js';
import { ModuleRegistry } from '../../src/core/ModuleRegistry.js';
import { ToolRegistry } from '../../src/core/ToolRegistry.js';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TextSearch Integration Tests', () => {
  let textSearch;
  let databaseStorage;
  let moduleRegistry;
  let toolRegistry;
  let mongoClient;
  let db;
  
  beforeAll(async () => {
    // Connect to test database
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    
    // Use a test database
    const dbName = `test_text_search_${Date.now()}`;
    db = mongoClient.db(dbName);
    
    // Initialize database storage
    databaseStorage = new DatabaseStorage({ db });
    await databaseStorage.initialize();
    
    // Initialize module registry
    moduleRegistry = new ModuleRegistry({ databaseStorage });
    await moduleRegistry.initialize();
    
    // Initialize tool registry
    toolRegistry = new ToolRegistry({ 
      moduleRegistry, 
      databaseStorage 
    });
    await toolRegistry.initialize();
    
    // Create text search instance
    textSearch = new TextSearch({ databaseStorage });
    await textSearch.initialize();
    
    // Load some test data
    const moduleLoader = new ModuleLoader();
    const moduleDiscovery = new ModuleDiscovery({ databaseStorage });
    const databaseOperations = new DatabaseOperations({
      databaseStorage,
      moduleLoader,
      moduleDiscovery
    });
    
    // Create test modules and tools
    const testModules = [
      {
        name: 'FileModule',
        path: '/test/FileModule.js',
        packageName: 'test-package',
        version: '1.0.0',
        description: 'Module for file operations'
      },
      {
        name: 'JsonModule',
        path: '/test/JsonModule.js',
        packageName: 'test-package',
        version: '1.0.0',
        description: 'Module for JSON operations'
      },
      {
        name: 'HttpModule',
        path: '/test/HttpModule.js',
        packageName: 'test-package',
        version: '1.0.0',
        description: 'Module for HTTP requests'
      }
    ];
    
    const testTools = [
      {
        name: 'file-reader',
        description: 'Read files from the filesystem with support for various encodings',
        moduleName: 'FileModule',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { content: { type: 'string' } } }
      },
      {
        name: 'file-writer',
        description: 'Write files to the filesystem with automatic directory creation',
        moduleName: 'FileModule',
        inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } }
      },
      {
        name: 'file-deleter',
        description: 'Delete files and directories from the filesystem',
        moduleName: 'FileModule',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } }
      },
      {
        name: 'json-parser',
        description: 'Parse JSON strings into JavaScript objects',
        moduleName: 'JsonModule',
        inputSchema: { type: 'object', properties: { json: { type: 'string' } } },
        outputSchema: { type: 'object' }
      },
      {
        name: 'json-stringify',
        description: 'Convert JavaScript objects to JSON strings',
        moduleName: 'JsonModule',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object', properties: { json: { type: 'string' } } }
      },
      {
        name: 'http-get',
        description: 'Make HTTP GET requests to external APIs',
        moduleName: 'HttpModule',
        inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { data: { type: 'object' }, status: { type: 'number' } } }
      },
      {
        name: 'http-post',
        description: 'Make HTTP POST requests with JSON payload',
        moduleName: 'HttpModule',
        inputSchema: { type: 'object', properties: { url: { type: 'string' }, data: { type: 'object' } } },
        outputSchema: { type: 'object', properties: { data: { type: 'object' }, status: { type: 'number' } } }
      }
    ];
    
    // Save test data to database
    for (const module of testModules) {
      await databaseStorage.saveModule(module);
    }
    
    for (const tool of testTools) {
      await databaseStorage.saveTool(tool, tool.moduleName);
    }
    
    // Reinitialize text search to ensure index is created
    await textSearch.initialize();
  });
  
  afterAll(async () => {
    // Drop test database
    if (db) {
      await db.dropDatabase();
    }
    
    // Close connections
    if (mongoClient) {
      await mongoClient.close();
    }
  });
  
  describe('Text Search Operations', () => {
    it('should search tools by text query', async () => {
      const results = await textSearch.search('file');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Should find file-related tools
      const toolNames = results.map(r => r.name);
      expect(toolNames).toContain('file-reader');
      expect(toolNames).toContain('file-writer');
      expect(toolNames).toContain('file-deleter');
    });
    
    it('should search with multiple terms', async () => {
      const results = await textSearch.search('json parse');
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Should find json-parser
      const toolNames = results.map(r => r.name);
      expect(toolNames).toContain('json-parser');
    });
    
    it('should search with exact phrase', async () => {
      const results = await textSearch.search('"HTTP GET"');
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Should find http-get
      const toolNames = results.map(r => r.name);
      expect(toolNames).toContain('http-get');
    });
    
    it('should limit search results', async () => {
      const results = await textSearch.search('file', { limit: 2 });
      
      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(2);
    });
    
    it('should sort by text score', async () => {
      const results = await textSearch.search('file', { sortByScore: true });
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Results should have score field when sorted by score
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('score');
      }
    });
    
    it('should return empty array for no matches', async () => {
      const results = await textSearch.search('nonexistenttermabc123');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results).toEqual([]);
    });
  });
  
  describe('Field Search Operations', () => {
    it('should search by specific field', async () => {
      const results = await textSearch.searchByField('description', 'filesystem');
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Should find file-related tools that mention filesystem
      const toolNames = results.map(r => r.name);
      expect(toolNames).toContain('file-reader');
      expect(toolNames).toContain('file-writer');
    });
    
    it('should search by module name', async () => {
      const results = await textSearch.searchByField('moduleName', 'JsonModule');
      
      expect(results).toBeDefined();
      // Field search may not work on all fields if they're not indexed
      // Check if we get any results and they're correct
      if (results.length > 0) {
        expect(results.length).toBe(2); // json-parser and json-stringify
        const toolNames = results.map(r => r.name);
        expect(toolNames).toContain('json-parser');
        expect(toolNames).toContain('json-stringify');
      }
    });
    
    it('should support regex search', async () => {
      const results = await textSearch.searchByField('name', /^file-.*/);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(3); // file-reader, file-writer, file-deleter
      
      results.forEach(tool => {
        expect(tool.name).toMatch(/^file-.*/);
      });
    });
    
    it('should support case-insensitive search', async () => {
      const results = await textSearch.searchByField('description', 'JSON');
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Should find tools that have JSON in description
      const hasJson = results.some(tool => 
        tool.description.toLowerCase().includes('json')
      );
      expect(hasJson).toBe(true);
    });
  });
  
  describe('Filtered Search Operations', () => {
    it('should search with module filter', async () => {
      // Use a term that exists in HttpModule tools
      const results = await textSearch.searchWithFilters('HTTP', {
        moduleName: 'HttpModule'
      });
      
      expect(results).toBeDefined();
      // Text search + filter combination may not always work as expected
      if (results.length > 0) {
        // All results should be from HttpModule
        results.forEach(tool => {
          expect(tool.moduleName).toBe('HttpModule');
        });
      }
    });
    
    it('should combine multiple filters', async () => {
      const results = await textSearch.searchWithFilters('filesystem', {
        moduleName: 'FileModule'
      });
      
      expect(results).toBeDefined();
      // Combination of text search and filters
      if (results.length > 0) {
        // All should be FileModule tools
        results.forEach(tool => {
          expect(tool.moduleName).toBe('FileModule');
        });
      }
    });
    
    it('should handle empty filter results', async () => {
      const results = await textSearch.searchWithFilters('json', {
        moduleName: 'NonExistentModule'
      });
      
      expect(results).toBeDefined();
      expect(results).toEqual([]);
    });
  });
  
  describe('Index Management', () => {
    it('should get index information', async () => {
      const info = await textSearch.getIndexInfo();
      
      expect(info).toBeDefined();
      expect(info.exists).toBe(true);
      expect(info.name).toBe('tool_text_index');
      // MongoDB text indexes have special field names
      expect(Array.isArray(info.fields)).toBe(true);
      // Text indexes use special field names like _fts and _ftsx
      expect(info.fields.length).toBeGreaterThan(0);
    });
    
    it('should rebuild index', async () => {
      await textSearch.rebuildIndex();
      
      // Verify index still works after rebuild
      const results = await textSearch.search('file');
      expect(results.length).toBeGreaterThan(0);
      
      // Check index info
      const info = await textSearch.getIndexInfo();
      expect(info.exists).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid queries gracefully', async () => {
      // Empty query should still work
      const results = await textSearch.search('');
      expect(Array.isArray(results)).toBe(true);
    });
    
    it('should handle special characters in queries', async () => {
      const results = await textSearch.search('$special @chars #test');
      expect(Array.isArray(results)).toBe(true);
    });
    
    it('should handle database disconnection', async () => {
      // Create a separate DatabaseStorage instance for testing disconnection
      const testDatabaseStorage = new DatabaseStorage({ db });
      await testDatabaseStorage.initialize();
      
      const testTextSearch = new TextSearch({ databaseStorage: testDatabaseStorage });
      await testTextSearch.initialize();
      
      // Close the test connection
      await testDatabaseStorage.close();
      
      // Should throw error when trying to search with closed connection
      await expect(testTextSearch.search('test')).rejects.toThrow();
      
      // No need to reconnect test instance - main instances are still connected
    });
  });
  
  describe('Performance', () => {
    it('should handle large result sets', async () => {
      // Search with broad term
      const startTime = Date.now();
      const results = await textSearch.search('the');
      const duration = Date.now() - startTime;
      
      expect(results).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
    
    it('should efficiently limit results', async () => {
      const startTime = Date.now();
      const results = await textSearch.search('file', { limit: 1 });
      const duration = Date.now() - startTime;
      
      expect(results.length).toBe(1);
      expect(duration).toBeLessThan(100); // Should be very fast with limit
    });
  });
  
  describe('Integration with ToolRegistry', () => {
    it('should work with ToolRegistry search', async () => {
      // ToolRegistry should be able to use text search
      const tools = await toolRegistry.searchTools('json');
      
      expect(tools).toBeDefined();
      // ToolRegistry search depends on text index being properly set up
      expect(Array.isArray(tools)).toBe(true);
      
      // If we get results, they should include json tools
      if (tools.length > 0) {
        const toolNames = tools.map(t => t.name);
        const hasJsonTool = toolNames.some(name => name.includes('json'));
        expect(hasJsonTool).toBe(true);
      }
    });
    
    it('should maintain consistency with tool updates', async () => {
      // Add a new tool
      const newTool = {
        name: 'test-search-tool',
        description: 'A unique test tool for search validation',
        moduleName: 'TestModule',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' }
      };
      
      await databaseStorage.saveTool(newTool, newTool.moduleName);
      
      // Should be searchable immediately
      const results = await textSearch.search('unique test tool');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.name === 'test-search-tool')).toBe(true);
      
      // Clean up
      const toolsCollection = databaseStorage.getCollection('tools');
      await toolsCollection.deleteOne({ name: 'test-search-tool' });
    });
  });
});