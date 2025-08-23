/**
 * User Acceptance Tests
 * 
 * Tests typical user workflows, various module types,
 * search scenarios, and error conditions from user perspective
 * 
 * Follows strict TDD approach with no mocks - real end-to-end testing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('User Acceptance Tests', () => {
  let resourceManager;
  let mongoClient;
  let testDbName;
  let toolRegistry;
  let testModulePath;

  beforeEach(async () => {
    // Create unique test database
    testDbName = `test_uat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create MongoDB connection
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    
    // Set test database
    resourceManager.set('test.database.name', testDbName);
    resourceManager.set('test.database.client', mongoClient);

    // Create test module directory
    testModulePath = path.join(__dirname, `../test-modules-${Date.now()}`);
    await fs.mkdir(testModulePath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up tool registry
    if (toolRegistry) {
      await toolRegistry.cleanup();
      toolRegistry = null;
    }

    // Drop test database
    if (mongoClient) {
      try {
        await mongoClient.db(testDbName).dropDatabase();
      } catch (error) {
        console.warn('Failed to drop test database:', error.message);
      }
      await mongoClient.close();
    }

    // Clean up test modules
    if (testModulePath) {
      try {
        await fs.rm(testModulePath, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean test modules:', error.message);
      }
    }
  });

  describe('User Story: Developer discovers and uses tools', () => {
    it('should allow developer to discover available tools', async () => {
      // Given: A developer wants to find available tools
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      // And: Some tools exist in the system
      const db = mongoClient.db(testDbName);
      await db.collection('modules').insertMany([
        { name: 'FileModule', description: 'File operations' },
        { name: 'NetworkModule', description: 'Network utilities' }
      ]);
      
      await db.collection('tools').insertMany([
        { name: 'readFile', description: 'Read file contents', moduleName: 'FileModule' },
        { name: 'writeFile', description: 'Write file contents', moduleName: 'FileModule' },
        { name: 'httpGet', description: 'Make HTTP GET request', moduleName: 'NetworkModule' }
      ]);

      // When: Developer lists all tools
      const tools = await toolRegistry.listTools();

      // Then: All tools are returned with clear information
      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toContain('readFile');
      expect(tools.map(t => t.name)).toContain('writeFile');
      expect(tools.map(t => t.name)).toContain('httpGet');

      // And: Each tool has necessary metadata
      tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.moduleName).toBeDefined();
      });
    });

    it('should allow developer to search for specific tools', async () => {
      // Given: Developer needs file-related tools
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);
      await db.collection('tools').insertMany([
        { name: 'readFile', description: 'Read file from filesystem', moduleName: 'FileModule' },
        { name: 'writeFile', description: 'Write file to filesystem', moduleName: 'FileModule' },
        { name: 'deleteFile', description: 'Delete file from filesystem', moduleName: 'FileModule' },
        { name: 'parseJson', description: 'Parse JSON string', moduleName: 'JsonModule' },
        { name: 'httpGet', description: 'HTTP GET request', moduleName: 'NetworkModule' }
      ]);

      // When: Developer searches for "file"
      const fileTools = await toolRegistry.searchTools('file');

      // Then: Only file-related tools are returned
      expect(fileTools.length).toBeGreaterThanOrEqual(3);
      expect(fileTools.every(t => 
        t.name.toLowerCase().includes('file') || 
        t.description.toLowerCase().includes('file')
      )).toBe(true);

      // When: Developer searches for "json"
      const jsonTools = await toolRegistry.searchTools('json');

      // Then: JSON tools are found
      expect(jsonTools.length).toBeGreaterThanOrEqual(1);
      expect(jsonTools.some(t => t.name === 'parseJson')).toBe(true);
    });

    it('should allow developer to get and use a specific tool', async () => {
      // Given: Developer wants to use the calculator tool
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      // Create a mock calculator module
      const calculatorModule = `
        export default class CalculatorModule {
          getName() { return 'CalculatorModule'; }
          getDescription() { return 'Basic math operations'; }
          getTools() {
            return [{
              name: 'add',
              description: 'Add two numbers',
              execute: async ({ a, b }) => ({ result: a + b })
            }];
          }
        }
      `;
      
      const modulePath = path.join(testModulePath, 'calculator.js');
      await fs.writeFile(modulePath, calculatorModule);

      // Register the module
      const db = mongoClient.db(testDbName);
      await db.collection('module_registry').insertOne({
        name: 'CalculatorModule',
        path: modulePath,
        type: 'class'
      });

      await db.collection('modules').insertOne({
        name: 'CalculatorModule',
        description: 'Basic math operations',
        path: modulePath
      });

      await db.collection('tools').insertOne({
        name: 'add',
        description: 'Add two numbers',
        moduleName: 'CalculatorModule',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['a', 'b']
        }
      });

      // When: Developer gets the tool
      const addTool = await toolRegistry.getTool('add');

      // Then: Tool is retrieved with execution capability
      expect(addTool).toBeDefined();
      expect(addTool.name).toBe('add');
      expect(addTool.description).toBe('Add two numbers');
      expect(typeof addTool.execute).toBe('function');

      // When: Developer executes the tool
      const result = await addTool.execute({ a: 5, b: 3 });

      // Then: Tool executes correctly
      expect(result).toBeDefined();
      expect(result.result).toBe(8);
    });
  });

  describe('User Story: Administrator manages tool registry', () => {
    it('should allow admin to load new modules', async () => {
      // Given: Admin wants to add a new module
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      // Create a new module file
      const newModule = `
        export default class DataModule {
          getName() { return 'DataModule'; }
          getDescription() { return 'Data processing utilities'; }
          getTools() {
            return [
              {
                name: 'sortArray',
                description: 'Sort an array',
                execute: async ({ array }) => ({ result: array.sort() })
              },
              {
                name: 'reverseArray',
                description: 'Reverse an array',
                execute: async ({ array }) => ({ result: array.reverse() })
              }
            ];
          }
        }
      `;

      const modulePath = path.join(testModulePath, 'data-module.js');
      await fs.writeFile(modulePath, newModule);

      // When: Admin loads the module
      await toolRegistry.loadModule('DataModule', {
        path: modulePath,
        type: 'class'
      });

      // Then: Module and its tools are available
      const tools = await toolRegistry.listTools({ moduleName: 'DataModule' });
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toContain('sortArray');
      expect(tools.map(t => t.name)).toContain('reverseArray');

      // And: Tools can be executed
      const sortTool = await toolRegistry.getTool('sortArray');
      const sortResult = await sortTool.execute({ array: [3, 1, 2] });
      expect(sortResult.result).toEqual([1, 2, 3]);
    });

    it('should allow admin to clear specific modules', async () => {
      // Given: Multiple modules are loaded
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);
      await db.collection('modules').insertMany([
        { name: 'Module1', description: 'First module' },
        { name: 'Module2', description: 'Second module' },
        { name: 'Module3', description: 'Third module' }
      ]);

      await db.collection('tools').insertMany([
        { name: 'tool1', moduleName: 'Module1' },
        { name: 'tool2', moduleName: 'Module1' },
        { name: 'tool3', moduleName: 'Module2' },
        { name: 'tool4', moduleName: 'Module3' }
      ]);

      // When: Admin clears Module1
      await toolRegistry.clearModule('Module1');

      // Then: Only Module1 tools are removed
      const remainingTools = await toolRegistry.listTools();
      expect(remainingTools).toHaveLength(2);
      expect(remainingTools.map(t => t.name)).not.toContain('tool1');
      expect(remainingTools.map(t => t.name)).not.toContain('tool2');
      expect(remainingTools.map(t => t.name)).toContain('tool3');
      expect(remainingTools.map(t => t.name)).toContain('tool4');

      // And: Module1 is removed from modules
      const modules = await toolRegistry.listModules();
      expect(modules.map(m => m.name)).not.toContain('Module1');
    });

    it('should allow admin to get system statistics', async () => {
      // Given: System has various components
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);
      await db.collection('modules').insertMany([
        { name: 'Module1', description: 'Module 1' },
        { name: 'Module2', description: 'Module 2' }
      ]);

      await db.collection('tools').insertMany([
        { name: 'tool1', moduleName: 'Module1' },
        { name: 'tool2', moduleName: 'Module1' },
        { name: 'tool3', moduleName: 'Module2' }
      ]);

      // When: Admin requests statistics
      const stats = await toolRegistry.getStatistics();

      // Then: Comprehensive statistics are provided
      expect(stats).toBeDefined();
      expect(stats.modules).toBe(2);
      expect(stats.tools).toBe(3);
      expect(stats.toolsByModule).toBeDefined();
      expect(stats.toolsByModule['Module1']).toBe(2);
      expect(stats.toolsByModule['Module2']).toBe(1);
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
      expect(stats.databaseConnected).toBe(true);
    });
  });

  describe('User Story: System integrator uses semantic search', () => {
    it('should find tools by use case description', async () => {
      // Given: Tools with semantic perspectives exist
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);
      await db.collection('tools').insertMany([
        { 
          name: 'readFile', 
          description: 'Read file from disk',
          moduleName: 'FileModule'
        },
        { 
          name: 'httpGet', 
          description: 'Make HTTP GET request',
          moduleName: 'NetworkModule'
        },
        { 
          name: 'parseJson', 
          description: 'Parse JSON string to object',
          moduleName: 'JsonModule'
        }
      ]);

      // Add perspectives for semantic search
      await db.collection('perspectives').insertMany([
        {
          toolName: 'readFile',
          perspective: 'Use when you need to load configuration files, read data files, or access local file content',
          category: 'file-operations',
          useCases: ['load config', 'read data', 'access files']
        },
        {
          toolName: 'httpGet',
          perspective: 'Use when you need to fetch data from APIs, download web content, or retrieve remote resources',
          category: 'network',
          useCases: ['fetch API data', 'download content', 'remote access']
        },
        {
          toolName: 'parseJson',
          perspective: 'Use when you need to convert JSON strings to JavaScript objects, parse API responses, or read JSON config files',
          category: 'data-processing',
          useCases: ['parse API response', 'read JSON config', 'convert data']
        }
      ]);

      // When: User searches for "need to load configuration"
      const configTools = await toolRegistry.searchTools('load configuration', {
        useSemanticSearch: true
      });

      // Then: Relevant tools are found
      expect(configTools.length).toBeGreaterThan(0);
      expect(configTools.some(t => t.name === 'readFile')).toBe(true);

      // When: User searches for "fetch API data"
      const apiTools = await toolRegistry.searchTools('fetch API data', {
        useSemanticSearch: true
      });

      // Then: Network tools are found
      expect(apiTools.length).toBeGreaterThan(0);
      expect(apiTools.some(t => t.name === 'httpGet')).toBe(true);
    });

    it('should find related tools', async () => {
      // Given: Tools with relationships exist
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);
      await db.collection('tools').insertMany([
        { name: 'readFile', moduleName: 'FileModule' },
        { name: 'writeFile', moduleName: 'FileModule' },
        { name: 'deleteFile', moduleName: 'FileModule' },
        { name: 'parseJson', moduleName: 'JsonModule' },
        { name: 'stringifyJson', moduleName: 'JsonModule' }
      ]);

      await db.collection('perspectives').insertMany([
        {
          toolName: 'readFile',
          category: 'file-operations',
          relatedTools: ['writeFile', 'deleteFile']
        },
        {
          toolName: 'parseJson',
          category: 'json-operations',
          relatedTools: ['stringifyJson', 'readFile']
        }
      ]);

      // When: User finds related tools for readFile
      const relatedToRead = await toolRegistry.getRelatedTools('readFile');

      // Then: Related file operations are found
      expect(relatedToRead).toContain('writeFile');
      expect(relatedToRead).toContain('deleteFile');

      // When: User finds related tools for parseJson
      const relatedToParse = await toolRegistry.getRelatedTools('parseJson');

      // Then: Related JSON operations are found
      expect(relatedToParse).toContain('stringifyJson');
      expect(relatedToParse).toContain('readFile');
    });
  });

  describe('User Story: Error handling and recovery', () => {
    it('should handle missing tool gracefully', async () => {
      // Given: System is initialized
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      // When: User requests non-existent tool
      const tool = await toolRegistry.getTool('nonExistentTool');

      // Then: Null is returned without crashing
      expect(tool).toBeNull();

      // When: User searches for non-existent pattern
      const results = await toolRegistry.searchTools('xyzabc123');

      // Then: Empty results are returned
      expect(results).toEqual([]);
    });

    it('should handle malformed module gracefully', async () => {
      // Given: A malformed module exists
      const malformedModule = `
        // This module is intentionally broken
        export default class BrokenModule {
          // Missing required methods
        }
      `;

      const modulePath = path.join(testModulePath, 'broken.js');
      await fs.writeFile(modulePath, malformedModule);

      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      // When: Admin tries to load the broken module
      const loadResult = await toolRegistry.loadModule('BrokenModule', {
        path: modulePath,
        type: 'class'
      });

      // Then: Error is returned with clear message
      expect(loadResult.success).toBe(false);
      expect(loadResult.error).toBeDefined();
      expect(loadResult.error).toContain('validation');

      // And: System continues to work
      const tools = await toolRegistry.listTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should handle database connection issues', async () => {
      // Given: Database connection is lost after initialization
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      // Add some tools to cache
      const db = mongoClient.db(testDbName);
      await db.collection('tools').insertOne({
        name: 'cachedTool',
        description: 'Tool in cache',
        moduleName: 'TestModule'
      });

      // Get tool to cache it
      await toolRegistry.getTool('cachedTool');

      // Simulate connection loss
      await mongoClient.close();

      // When: User requests cached tool
      const cachedTool = await toolRegistry.getTool('cachedTool');

      // Then: Cached tool is still available
      expect(cachedTool).toBeDefined();
      expect(cachedTool.name).toBe('cachedTool');

      // When: User requests non-cached tool
      const newTool = await toolRegistry.getTool('nonCachedTool');

      // Then: Null is returned (no crash)
      expect(newTool).toBeNull();

      // Restore connection for cleanup
      mongoClient = new MongoClient(resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017');
      await mongoClient.connect();
    });

    it('should validate tool inputs', async () => {
      // Given: Tool with input schema exists
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      const validatorModule = `
        export default class ValidatorModule {
          getName() { return 'ValidatorModule'; }
          getTools() {
            return [{
              name: 'divide',
              description: 'Divide two numbers',
              inputSchema: {
                type: 'object',
                properties: {
                  numerator: { type: 'number' },
                  denominator: { type: 'number', minimum: 0.001 }
                },
                required: ['numerator', 'denominator']
              },
              execute: async ({ numerator, denominator }) => {
                if (denominator === 0) throw new Error('Division by zero');
                return { result: numerator / denominator };
              }
            }];
          }
        }
      `;

      const modulePath = path.join(testModulePath, 'validator.js');
      await fs.writeFile(modulePath, validatorModule);

      const db = mongoClient.db(testDbName);
      await db.collection('module_registry').insertOne({
        name: 'ValidatorModule',
        path: modulePath,
        type: 'class'
      });

      await db.collection('tools').insertOne({
        name: 'divide',
        description: 'Divide two numbers',
        moduleName: 'ValidatorModule'
      });

      // When: User provides invalid input
      const divideTool = await toolRegistry.getTool('divide');
      
      // Missing required field
      await expect(
        divideTool.execute({ numerator: 10 })
      ).rejects.toThrow();

      // Invalid type
      await expect(
        divideTool.execute({ numerator: '10', denominator: 2 })
      ).rejects.toThrow();

      // When: User provides valid input
      const result = await divideTool.execute({ numerator: 10, denominator: 2 });

      // Then: Tool executes successfully
      expect(result.result).toBe(5);
    });
  });

  describe('User Story: Performance and scalability', () => {
    it('should handle large number of tools efficiently', async () => {
      // Given: System has many tools
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);
      const tools = [];

      // Create 500 tools across 50 modules
      for (let m = 0; m < 50; m++) {
        await db.collection('modules').insertOne({
          name: `Module${m}`,
          description: `Test module ${m}`
        });

        for (let t = 0; t < 10; t++) {
          tools.push({
            name: `tool_${m}_${t}`,
            description: `Tool ${t} in module ${m}`,
            moduleName: `Module${m}`
          });
        }
      }

      await db.collection('tools').insertMany(tools);

      // When: User lists all tools
      const startList = Date.now();
      const allTools = await toolRegistry.listTools();
      const listTime = Date.now() - startList;

      // Then: All tools are returned quickly
      expect(allTools).toHaveLength(500);
      expect(listTime).toBeLessThan(2000); // Should complete within 2 seconds

      // When: User searches for specific pattern
      const startSearch = Date.now();
      const searchResults = await toolRegistry.searchTools('module 25');
      const searchTime = Date.now() - startSearch;

      // Then: Search completes quickly
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(500); // Should complete within 500ms

      // When: User gets specific tool
      const startGet = Date.now();
      const tool = await toolRegistry.getTool('tool_25_5');
      const getTime = Date.now() - startGet;

      // Then: Tool retrieval is fast
      expect(tool).toBeDefined();
      expect(getTime).toBeLessThan(200); // Should complete within 200ms
    });

    it('should cache frequently used tools', async () => {
      // Given: System with caching enabled
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        maxCacheSize: 10
      });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);
      await db.collection('tools').insertOne({
        name: 'frequentTool',
        description: 'Frequently used tool',
        moduleName: 'TestModule'
      });

      // When: Tool is accessed multiple times
      const times = [];
      
      // First access (from database)
      let start = Date.now();
      await toolRegistry.getTool('frequentTool');
      times.push(Date.now() - start);

      // Subsequent accesses (from cache)
      for (let i = 0; i < 5; i++) {
        start = Date.now();
        await toolRegistry.getTool('frequentTool');
        times.push(Date.now() - start);
      }

      // Then: Cached accesses are faster
      const firstAccessTime = times[0];
      const avgCachedTime = times.slice(1).reduce((a, b) => a + b, 0) / (times.length - 1);
      
      expect(avgCachedTime).toBeLessThan(firstAccessTime);
      expect(avgCachedTime).toBeLessThan(10); // Cached access should be very fast
    });
  });
});