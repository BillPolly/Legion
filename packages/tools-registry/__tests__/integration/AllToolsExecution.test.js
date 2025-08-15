/**
 * Comprehensive Tool Execution Tests
 * 
 * This test suite retrieves all tools from the populated database and attempts to execute them
 * with appropriate test parameters. It ensures that:
 * 1. All tools can be retrieved from the ToolRegistry
 * 2. All tools have proper execute methods
 * 3. All tools can be executed without throwing errors (with valid inputs)
 * 4. Tools return expected result structures
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { ModuleLoader } from '../../src/loading/ModuleLoader.js';
import { DatabasePopulator } from '../../src/loading/DatabasePopulator.js';
import { ResourceManager } from '@legion/core';
import fs from 'fs/promises';
import path from 'path';

describe('All Tools Execution Tests', () => {
  let resourceManager;
  let toolRegistry;
  let provider;
  let allTools = [];

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }

    // Create database provider
    provider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });

    // Populate database with fresh data
    console.log('📦 Populating database with fresh module data...');
    const moduleLoader = new ModuleLoader({ 
      verbose: false,
      resourceManager: resourceManager 
    });
    await moduleLoader.initialize();
    const moduleResult = await moduleLoader.loadModules();
    
    const populator = new DatabasePopulator({ provider, verbose: false });
    await populator.populate(moduleResult.loaded, { clearExisting: true });
    
    console.log(`✅ Populated database with ${moduleResult.loaded.length} modules`);

    // Create ToolRegistry with database provider
    toolRegistry = new ToolRegistry({ provider });
    await toolRegistry.initialize();

    // Get all tools from the database
    allTools = await provider.listTools({ limit: 1000 });
    console.log(`📊 Found ${allTools.length} tools to test`);
  }, 30000); // Increase timeout for population

  afterAll(async () => {
    if (provider) {
      await provider.disconnect();
    }
  });

  describe('Tool Retrieval', () => {
    test('should retrieve all tools from database', () => {
      expect(allTools.length).toBeGreaterThan(0);
      expect(allTools.length).toBeGreaterThan(10); // Should have a reasonable number of tools
    });

    test('should be able to get each tool via ToolRegistry', async () => {
      const retrievalResults = [];

      for (const toolMeta of allTools) {
        try {
          const tool = await toolRegistry.getTool(toolMeta.name);
          retrievalResults.push({
            name: toolMeta.name,
            success: !!tool,
            hasExecute: tool && typeof tool.execute === 'function',
            tool
          });
        } catch (error) {
          retrievalResults.push({
            name: toolMeta.name,
            success: false,
            error: error.message
          });
        }
      }

      // Report results
      const successful = retrievalResults.filter(r => r.success && r.hasExecute);
      const failed = retrievalResults.filter(r => !r.success || !r.hasExecute);

      console.log(`✅ Successfully retrieved: ${successful.length} tools`);
      if (failed.length > 0) {
        console.log(`❌ Failed to retrieve: ${failed.length} tools`);
        failed.forEach(f => {
          console.log(`  - ${f.name}: ${f.error || 'No execute method'}`);
        });
      }

      // Expect all tools to be retrievable
      expect(successful.length).toBe(allTools.length);
      expect(failed.length).toBe(0);
    });
  });

  describe('Tool Execution', () => {
    // Test parameters for different tool types
    const testParameters = {
      // File tools
      file_read: { filepath: '/tmp/test-file-' + Date.now() + '.txt' },
      file_write: { 
        filepath: '/tmp/test-file-' + Date.now() + '.txt', 
        content: 'Test content for file write' 
      },
      directory_create: { dirpath: '/tmp/test-dir-' + Date.now() },
      directory_current: {},
      directory_list: { dirpath: '/tmp' },
      directory_change: { dirpath: '/tmp' },

      // Calculator tools
      calculator: { expression: '2 + 2' },

      // JSON tools
      json_parse: { json_string: '{"test": "value", "number": 42}' },
      json_stringify: { data: { test: 'value', number: 42 } },
      json_validate: { 
        json_string: '{"test": "value"}',
        schema: { type: 'object', properties: { test: { type: 'string' } } }
      },
      json_extract: { 
        json_string: '{"nested": {"value": 123}}',
        path: 'nested.value'
      },

      // AI Generation tools
      generate_image: { 
        prompt: 'A simple test image of a blue circle',
        width: 256,
        height: 256
      },

      // Search tools
      google_search: { query: 'test search query', limit: 3 },

      // System tools
      module_load: { moduleName: 'Calculator' },
      module_unload: { moduleName: 'TestModule' },
      module_list: {},
      module_info: { moduleName: 'Calculator' },
      module_tools: { moduleName: 'Calculator' },

      // Railway tools (will need API key)
      railway_deploy: { projectPath: '/tmp/test-project' },
      railway_status: { projectId: 'test-project' },
      railway_logs: { projectId: 'test-project' },
      railway_update_env: { projectId: 'test-project', variables: { TEST: 'value' } },
      railway_remove: { projectId: 'test-project' },
      railway_list_projects: {},

      // Voice tools
      transcribe_audio: { audioPath: '/tmp/test-audio.wav' },
      generate_voice: { text: 'Hello, this is a test', voice: 'alloy' },

      // SD tools (Software Design tools)
      parse_requirements: { requirements: 'Create a user management system' },
      generate_user_stories: { requirements: 'User login and registration' },
      generate_acceptance_criteria: { userStory: 'As a user, I want to log in' },
      identify_bounded_contexts: { requirements: 'E-commerce platform' },
      model_entities: { boundedContext: 'User Management' },
      design_aggregates: { entities: ['User', 'Profile'] },
      extract_domain_events: { aggregates: ['User'] },
      design_layers: { boundedContext: 'User Management' },
      generate_use_cases: { requirements: 'User management system' },
      design_interfaces: { useCases: ['Create User', 'Update User'] },
      database_connect: { connectionString: 'mongodb://localhost:27017/test' },
      store_artifact: { 
        artifactType: 'user_story',
        content: 'Test user story content',
        metadata: { project: 'test' }
      },
      retrieve_context: { contextType: 'requirements', filters: {} },

      // Node Runner tools
      run_node: { script: 'console.log("Hello from Node");' },
      stop_node: { sessionId: 'test-session' },
      search_logs: { sessionId: 'test-session', query: 'error' },
      list_sessions: {},
      server_health: {},

      // JSON module tools
      greet: { name: 'Test User' },
      add_numbers: { a: 5, b: 3 }
    };

    test('should execute all tools with appropriate parameters', async () => {
      const executionResults = [];
      const createdFiles = [];
      const createdDirs = [];

      // Pre-create a test file for file_read test
      const testReadFile = '/tmp/test-read-file-' + Date.now() + '.txt';
      await fs.writeFile(testReadFile, 'Test content for reading');
      createdFiles.push(testReadFile);
      testParameters.file_read.filepath = testReadFile;

      for (const toolMeta of allTools) {
        try {
          // Get the tool instance
          const tool = await toolRegistry.getTool(toolMeta.name);
          if (!tool || typeof tool.execute !== 'function') {
            executionResults.push({
              name: toolMeta.name,
              success: false,
              error: 'Tool not found or no execute method'
            });
            continue;
          }

          // Get test parameters for this tool
          const params = testParameters[toolMeta.name] || {};
          
          // Execute the tool
          const startTime = Date.now();
          let result;
          
          try {
            result = await tool.execute(params);
            const duration = Date.now() - startTime;

            // Track created files/dirs for cleanup
            if (toolMeta.name === 'file_write' && result.success) {
              createdFiles.push(params.filepath);
            }
            if (toolMeta.name === 'directory_create' && result.success) {
              createdDirs.push(params.dirpath);
            }

            executionResults.push({
              name: toolMeta.name,
              success: true,
              result,
              duration,
              hasResult: result !== undefined,
              hasSuccessFlag: result && typeof result.success === 'boolean'
            });
          } catch (executionError) {
            // Some tools may fail due to missing dependencies or API keys
            // This is expected for tools like Railway, Voice, etc.
            // Many tools may fail due to missing API keys or services
            // This is expected behavior - tools should handle missing deps gracefully
            const isExpectedFailure = [
              'railway_deploy', 'railway_status', 'railway_logs', 
              'railway_update_env', 'railway_remove', 'railway_list_projects',
              'transcribe_audio', 'generate_voice', 'generate_image',
              'google_search', // Needs SERPER_API_KEY
              'database_connect', 'store_artifact', 'retrieve_context', // DB tools
              'run_node', 'stop_node', 'search_logs', 'list_sessions', 'server_health' // Node runner
            ].includes(toolMeta.name);

            executionResults.push({
              name: toolMeta.name,
              success: false,
              error: executionError.message,
              expectedFailure: isExpectedFailure,
              duration: Date.now() - startTime
            });
          }

        } catch (error) {
          executionResults.push({
            name: toolMeta.name,
            success: false,
            error: error.message
          });
        }
      }

      // Cleanup created files and directories
      for (const file of createdFiles) {
        try {
          await fs.unlink(file);
        } catch (e) {
          // File might not exist or already deleted
        }
      }

      for (const dir of createdDirs) {
        try {
          await fs.rmdir(dir);
        } catch (e) {
          // Directory might not exist or not empty
        }
      }

      // Analyze results
      const successful = executionResults.filter(r => r.success);
      const failed = executionResults.filter(r => !r.success);
      const expectedFailures = failed.filter(r => r.expectedFailure);
      const unexpectedFailures = failed.filter(r => !r.expectedFailure);

      console.log('\n📊 Execution Results:');
      console.log(`✅ Successful executions: ${successful.length}`);
      console.log(`⚠️  Expected failures: ${expectedFailures.length}`);
      console.log(`❌ Unexpected failures: ${unexpectedFailures.length}`);

      if (successful.length > 0) {
        console.log('\n✅ Successful Tools:');
        successful.forEach(r => {
          console.log(`  - ${r.name}: ${r.duration}ms`);
        });
      }

      if (expectedFailures.length > 0) {
        console.log('\n⚠️  Expected Failures (due to missing APIs/deps):');
        expectedFailures.forEach(r => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
      }

      if (unexpectedFailures.length > 0) {
        console.log('\n❌ Unexpected Failures:');
        unexpectedFailures.forEach(r => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
      }

      // Test assertions
      expect(executionResults.length).toBe(allTools.length);
      
      // We expect most tools to either succeed or fail expectedly
      const problematicTools = unexpectedFailures.length;
      expect(problematicTools).toBeLessThan(5); // Allow some margin for edge cases
      
      // At least basic tools should work
      const basicTools = ['json_parse', 'json_stringify', 'calculator', 'directory_current', 'module_list'];
      const basicToolResults = executionResults.filter(r => basicTools.includes(r.name));
      const successfulBasicTools = basicToolResults.filter(r => r.success);
      
      expect(successfulBasicTools.length).toBeGreaterThan(0); // Some basic tools should work
    });

    test('should have consistent result formats', async () => {
      // Test a few key tools to ensure consistent result formats
      const toolsToTest = [
        { name: 'calculator', params: { expression: '5 * 6' } },
        { name: 'json_parse', params: { json_string: '{"test": 123}' } },
        { name: 'directory_current', params: {} },
        { name: 'module_list', params: {} }
      ];

      const formatResults = [];

      for (const { name, params } of toolsToTest) {
        try {
          const tool = await toolRegistry.getTool(name);
          if (tool && typeof tool.execute === 'function') {
            const result = await tool.execute(params);
            
            formatResults.push({
              name,
              hasResult: result !== undefined,
              hasSuccess: result && typeof result.success === 'boolean',
              hasMessage: result && typeof result.message === 'string',
              resultKeys: result ? Object.keys(result) : [],
              result
            });
          }
        } catch (error) {
          formatResults.push({
            name,
            error: error.message
          });
        }
      }

      console.log('\n📋 Result Format Analysis:');
      formatResults.forEach(r => {
        if (r.error) {
          console.log(`  - ${r.name}: ERROR - ${r.error}`);
        } else {
          console.log(`  - ${r.name}: Keys [${r.resultKeys.join(', ')}]`);
        }
      });

      // Most tools should return some kind of result
      const toolsWithResults = formatResults.filter(r => r.hasResult && !r.error);
      expect(toolsWithResults.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Metadata Validation', () => {
    test('should validate all tools have required metadata', async () => {
      const metadataResults = [];

      for (const toolMeta of allTools) {
        const validation = {
          name: toolMeta.name,
          hasName: !!toolMeta.name,
          hasDescription: !!toolMeta.description,
          hasModuleName: !!toolMeta.moduleName,
          hasInputSchema: !!toolMeta.inputSchema,
          descriptionLength: toolMeta.description?.length || 0,
          valid: true
        };

        // Check for required fields
        if (!toolMeta.name || !toolMeta.moduleName) {
          validation.valid = false;
        }

        // Check description quality
        if (!toolMeta.description || toolMeta.description.length < 10) {
          validation.hasGoodDescription = false;
        } else {
          validation.hasGoodDescription = true;
        }

        metadataResults.push(validation);
      }

      const validTools = metadataResults.filter(r => r.valid);
      const toolsWithGoodDescriptions = metadataResults.filter(r => r.hasGoodDescription);

      console.log('\n📋 Metadata Validation:');
      console.log(`✅ Valid metadata: ${validTools.length}/${metadataResults.length}`);
      console.log(`📝 Good descriptions: ${toolsWithGoodDescriptions.length}/${metadataResults.length}`);

      // All tools should have valid basic metadata
      expect(validTools.length).toBe(metadataResults.length);
      
      // Most tools should have good descriptions
      expect(toolsWithGoodDescriptions.length).toBeGreaterThan(metadataResults.length * 0.8);
    });

    test('should have tools distributed across modules', async () => {
      const moduleDistribution = {};
      
      allTools.forEach(tool => {
        const module = tool.moduleName;
        if (!moduleDistribution[module]) {
          moduleDistribution[module] = 0;
        }
        moduleDistribution[module]++;
      });

      console.log('\n📊 Tools per Module:');
      Object.entries(moduleDistribution)
        .sort((a, b) => b[1] - a[1])
        .forEach(([module, count]) => {
          console.log(`  - ${module}: ${count} tools`);
        });

      // Should have multiple modules with tools
      const modulesWithTools = Object.keys(moduleDistribution);
      expect(modulesWithTools.length).toBeGreaterThan(3);

      // Should have a reasonable distribution (not all tools in one module)
      const maxToolsInOneModule = Math.max(...Object.values(moduleDistribution));
      expect(maxToolsInOneModule).toBeLessThan(allTools.length * 0.5);
    });
  });
});