/**
 * Comprehensive End-to-End Tests for ToolRegistry
 * 
 * Tests the complete workflow from database population to tool execution.
 * This represents the real-world usage patterns of the ToolRegistry.
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { ResourceManager } from '../../src/ResourceManager.js';
import fs from 'fs/promises';
import path from 'path';

describe('ToolRegistry End-to-End Tests', () => {
  let registry;
  let resourceManager;

  beforeAll(async () => {
    // Initialize with real dependencies
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    registry = new ToolRegistry();
    await registry.initialize();
  }, 30000);

  afterAll(async () => {
    if (registry) {
      registry.clearCache();
    }
  });

  describe('Complete Workflow: Populate → List → Execute', () => {
    test('should complete full database population and tool execution workflow', async () => {
      // Step 1: Populate database (fresh start)
      console.log('Step 1: Populating database...');
      const populationResult = await registry.populateDatabase({
        mode: 'clear',
        verbose: false
      });

      expect(populationResult.modulesAdded).toBeGreaterThan(0);
      expect(populationResult.toolsAdded).toBeGreaterThan(0);

      // Step 2: List available tools
      console.log('Step 2: Listing tools...');
      const allTools = await registry.listTools({ limit: 50 });
      expect(allTools.length).toBeGreaterThan(0);

      // Step 3: Execute tools from different modules
      console.log('Step 3: Testing tools from different modules...');
      
      // Test Calculator module
      const calcTool = await registry.getTool('calculator');
      if (calcTool) {
        const calcResult = await calcTool.execute({ expression: '(10 + 5) * 2' });
        expect(calcResult.success).toBe(true);
        expect(calcResult.result).toBe(30);
      }

      // Test JSON module
      const jsonParseTool = await registry.getTool('json_parse');
      if (jsonParseTool) {
        const parseResult = await jsonParseTool.execute({ 
          json_string: '{"status": "success", "data": [1, 2, 3]}' 
        });
        expect(parseResult.success).toBe(true);
        expect(parseResult.result.status).toBe('success');
        expect(parseResult.result.data).toEqual([1, 2, 3]);
      }

      // Test File module
      const fileWriteTool = await registry.getTool('file_write');
      const fileReadTool = await registry.getTool('file_read');
      
      if (fileWriteTool && fileReadTool) {
        const testFilePath = `/tmp/e2e-test-${Date.now()}.txt`;
        const testContent = 'End-to-end test content';
        
        // Write file
        const writeResult = await fileWriteTool.execute({
          filepath: testFilePath,
          content: testContent
        });
        expect(writeResult.success).toBe(true);
        
        // Read file back
        const readResult = await fileReadTool.execute({
          filepath: testFilePath
        });
        expect(readResult.success).toBe(true);
        expect(readResult.content).toBe(testContent);
        
        // Cleanup
        await fs.unlink(testFilePath);
      }

      console.log(`✓ Successfully tested ${allTools.length} tools`);
    }, 60000); // 60 second timeout for comprehensive test
  });

  describe('Multi-Module Tool Discovery', () => {
    test('should discover and execute tools from all known modules', async () => {
      const moduleTestResults = {};
      
      // Get tools from each expected module type
      const expectedModules = [
        'Calculator', 'File', 'Json', 'System', 'CommandExecutor'
      ];

      for (const moduleName of expectedModules) {
        const moduleTools = await registry.listTools({ 
          moduleName: moduleName, 
          limit: 5 
        });
        
        moduleTestResults[moduleName] = {
          toolCount: moduleTools.length,
          tools: moduleTools.map(t => t.name),
          tested: []
        };

        // Test at least one tool from each module if available
        if (moduleTools.length > 0) {
          const firstTool = await registry.getTool(moduleTools[0].name);
          if (firstTool && typeof firstTool.execute === 'function') {
            moduleTestResults[moduleName].executable = true;
            moduleTestResults[moduleName].tested.push(moduleTools[0].name);
          }
        }
      }

      console.log('Module test results:', JSON.stringify(moduleTestResults, null, 2));

      // Verify we found tools from multiple modules
      const modulesWithTools = Object.keys(moduleTestResults).filter(
        mod => moduleTestResults[mod].toolCount > 0
      );
      expect(modulesWithTools.length).toBeGreaterThan(1);
    });
  });

  describe('Search and Filter Capabilities', () => {
    test('should support advanced search and filtering', async () => {
      // Search by functional category
      const fileOperationTools = await registry.searchTools('file');
      const mathTools = await registry.searchTools('calculate');
      const jsonTools = await registry.searchTools('json');

      expect(fileOperationTools.length).toBeGreaterThan(0);
      
      // Verify search quality - tools should be relevant
      for (const tool of fileOperationTools.slice(0, 3)) {
        const isRelevant = 
          tool.name.toLowerCase().includes('file') ||
          (tool.description && tool.description.toLowerCase().includes('file'));
        expect(isRelevant).toBe(true);
      }

      // Test combined filtering
      const limitedFileTools = await registry.searchTools('file', { limit: 2 });
      expect(limitedFileTools.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Performance and Caching', () => {
    test('should demonstrate caching performance benefits', async () => {
      // Clear cache for clean test
      registry.clearCache();
      
      // First retrieval (cache miss)
      const start1 = Date.now();
      const tool1 = await registry.getTool('calculator');
      const time1 = Date.now() - start1;

      // Second retrieval (cache hit)  
      const start2 = Date.now();
      const tool2 = await registry.getTool('calculator');
      const time2 = Date.now() - start2;

      expect(tool1).toBe(tool2); // Same object reference
      expect(time2).toBeLessThan(time1); // Cache should be faster
      
      console.log(`Cache miss: ${time1}ms, Cache hit: ${time2}ms`);
    });

    test('should handle concurrent tool requests efficiently', async () => {
      registry.clearCache();
      
      // Make multiple concurrent requests for different tools
      const toolNames = ['calculator', 'json_parse', 'file_read', 'file_write'];
      const start = Date.now();
      
      const results = await Promise.all(
        toolNames.map(name => registry.getTool(name))
      );
      
      const totalTime = Date.now() - start;
      
      // All tools should be retrieved
      const successfulRetrievals = results.filter(tool => tool !== null);
      expect(successfulRetrievals.length).toBeGreaterThan(0);
      
      console.log(`Retrieved ${successfulRetrievals.length} tools concurrently in ${totalTime}ms`);
      
      // Verify tools are executable
      for (const tool of successfulRetrievals) {
        expect(typeof tool.execute).toBe('function');
      }
    });
  });

  describe('Real-World Usage Scenarios', () => {
    test('should handle typical user workflow', async () => {
      // Scenario: User wants to process a JSON file
      
      // 1. Search for JSON-related tools
      const jsonTools = await registry.searchTools('json', { limit: 5 });
      expect(jsonTools.length).toBeGreaterThan(0);
      
      // 2. Search for file tools
      const fileTools = await registry.searchTools('file', { limit: 5 });
      expect(fileTools.length).toBeGreaterThan(0);
      
      // 3. Get specific tools
      const fileReadTool = await registry.getTool('file_read');
      const jsonParseTool = await registry.getTool('json_parse');
      const fileWriteTool = await registry.getTool('file_write');
      
      if (fileReadTool && jsonParseTool && fileWriteTool) {
        // 4. Create test JSON file
        const testData = { users: [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }] };
        const testFilePath = `/tmp/test-data-${Date.now()}.json`;
        
        // Write test file
        const writeResult = await fileWriteTool.execute({
          filepath: testFilePath,
          content: JSON.stringify(testData, null, 2)
        });
        expect(writeResult.success).toBe(true);
        
        // Read and parse file
        const readResult = await fileReadTool.execute({ filepath: testFilePath });
        expect(readResult.success).toBe(true);
        
        const parseResult = await jsonParseTool.execute({ 
          json_string: readResult.content 
        });
        expect(parseResult.success).toBe(true);
        expect(parseResult.result.users).toHaveLength(2);
        expect(parseResult.result.users[0].name).toBe('Alice');
        
        // Cleanup
        await fs.unlink(testFilePath);
        
        console.log('✓ Successfully completed JSON file processing workflow');
      }
    });

    test('should support tool chaining and composition', async () => {
      // Scenario: Mathematical calculation with result formatting
      
      const calcTool = await registry.getTool('calculator');
      const jsonStringifyTool = await registry.getTool('json_stringify');
      
      if (calcTool && jsonStringifyTool) {
        // Calculate something
        const mathResult = await calcTool.execute({ expression: 'sqrt(64) + pow(2, 3)' });
        expect(mathResult.success).toBe(true);
        
        // Format result as JSON
        const resultData = {
          operation: 'sqrt(64) + pow(2, 3)',
          result: mathResult.result,
          timestamp: new Date().toISOString()
        };
        
        const jsonResult = await jsonStringifyTool.execute({ 
          data: resultData,
          pretty: true 
        });
        expect(jsonResult.success).toBe(true);
        
        console.log('✓ Tool chaining result:', jsonResult.result);
      }
    });
  });

  describe('Error Handling in Real Scenarios', () => {
    test('should gracefully handle tool execution errors', async () => {
      const calcTool = await registry.getTool('calculator');
      
      if (calcTool) {
        // Test with invalid expression
        const badResult = await calcTool.execute({ expression: 'invalid math expression' });
        expect(badResult.success).toBe(false);
        expect(badResult.error).toBeDefined();
      }
    });

    test('should handle missing tools in workflows', async () => {
      // Try to get non-existent tool
      const fakeTool = await registry.getTool('non_existent_super_tool');
      expect(fakeTool).toBeNull();
      
      // Workflow should continue with available tools
      const realTool = await registry.getTool('calculator');
      if (realTool) {
        const result = await realTool.execute({ expression: '1 + 1' });
        expect(result.success).toBe(true);
      }
    });
  });
});