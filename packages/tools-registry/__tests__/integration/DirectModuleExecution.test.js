/**
 * Direct Module Execution Tests
 * 
 * This test suite loads each module directly using the ModuleLoader and tests all their tools.
 * This isolates module loading from the ToolRegistry to identify where issues occur.
 */

import { ModuleLoader } from '../../src/loading/ModuleLoader.js';
import fs from 'fs/promises';
import path from 'path';

describe('Direct Module Execution Tests', () => {
  let moduleLoader;
  let loadedModules = [];
  let allModuleConfigs = [];

  beforeAll(async () => {
    // Initialize ModuleLoader
    moduleLoader = new ModuleLoader({ verbose: false });
    await moduleLoader.initialize();

    // Read the module registry to get all module configurations
    const registryPath = path.resolve('src/loading/module-registry.json');
    const registryContent = await fs.readFile(registryPath, 'utf-8');
    allModuleConfigs = JSON.parse(registryContent);

    console.log(`📦 Found ${allModuleConfigs.length} modules in registry`);
  });

  describe('Module Loading', () => {
    test('should load all modules from registry', async () => {
      const loadingResults = [];

      for (const moduleConfig of allModuleConfigs) {
        try {
          console.log(`\n🔄 Loading module: ${moduleConfig.name} (${moduleConfig.type})`);
          
          const moduleInstance = await moduleLoader.loadModule(moduleConfig);
          
          if (moduleInstance) {
            // Get tools from the module
            let tools = [];
            if (typeof moduleInstance.getTools === 'function') {
              tools = moduleInstance.getTools() || [];
            }

            loadedModules.push({
              config: moduleConfig,
              instance: moduleInstance,
              tools: tools
            });

            loadingResults.push({
              name: moduleConfig.name,
              success: true,
              toolCount: tools.length,
              hasGetTools: typeof moduleInstance.getTools === 'function',
              tools: tools.map(t => ({
                name: t.name,
                description: t.description,
                hasExecute: typeof t.execute === 'function'
              }))
            });

            console.log(`✅ ${moduleConfig.name}: loaded with ${tools.length} tools`);
            if (tools.length > 0) {
              tools.forEach(tool => {
                const status = typeof tool.execute === 'function' ? '✅' : '❌';
                console.log(`  ${status} ${tool.name}`);
              });
            }
          } else {
            loadingResults.push({
              name: moduleConfig.name,
              success: false,
              error: 'Module instance is null'
            });
            console.log(`❌ ${moduleConfig.name}: failed to load (null instance)`);
          }
        } catch (error) {
          loadingResults.push({
            name: moduleConfig.name,
            success: false,
            error: error.message
          });
          console.log(`❌ ${moduleConfig.name}: failed with error - ${error.message}`);
        }
      }

      // Analyze results
      const successful = loadingResults.filter(r => r.success);
      const failed = loadingResults.filter(r => !r.success);

      console.log(`\n📊 Module Loading Summary:`);
      console.log(`✅ Successfully loaded: ${successful.length}/${allModuleConfigs.length}`);
      console.log(`❌ Failed to load: ${failed.length}/${allModuleConfigs.length}`);

      if (failed.length > 0) {
        console.log(`\nFailed modules:`);
        failed.forEach(f => {
          console.log(`  - ${f.name}: ${f.error}`);
        });
      }

      const totalTools = successful.reduce((sum, r) => sum + r.toolCount, 0);
      console.log(`\n🔧 Total tools found: ${totalTools}`);

      // Expectations
      expect(successful.length).toBeGreaterThan(10); // At least 10 modules should load
      expect(totalTools).toBeGreaterThan(30); // Should have plenty of tools
    });
  });

  describe('Tool Execution from Loaded Modules', () => {
    beforeEach(async () => {
      // Ensure modules are loaded before executing tools
      if (loadedModules.length === 0) {
        const loadingResults = [];

        for (const moduleConfig of allModuleConfigs) {
          try {
            const moduleInstance = await moduleLoader.loadModule(moduleConfig);
            
            if (moduleInstance) {
              // Get tools from the module
              let tools = [];
              if (typeof moduleInstance.getTools === 'function') {
                tools = moduleInstance.getTools() || [];
              }

              loadedModules.push({
                config: moduleConfig,
                instance: moduleInstance,
                tools: tools
              });
            }
          } catch (error) {
            // Skip failed modules
          }
        }
      }
    });
    
    // Test parameters for different tool types
    const testParameters = {
      // File tools
      file_read: { filepath: '/tmp/test-file-' + Date.now() + '.txt' },
      file_write: { 
        filepath: '/tmp/test-file-' + Date.now() + '.txt', 
        content: 'Test content for direct module test' 
      },
      directory_create: { dirpath: '/tmp/test-dir-' + Date.now() },
      directory_current: {},
      directory_list: { dirpath: '/tmp' },
      directory_change: { dirpath: '/tmp' },

      // Calculator tools
      calculator: { expression: '10 + 5' },

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
        prompt: 'A simple test image',
        width: 256,
        height: 256
      },

      // Search tools
      google_search: { query: 'test search', limit: 3 },

      // System tools
      module_load: { moduleName: 'Calculator' },
      module_unload: { moduleName: 'TestModule' },
      module_list: {},
      module_info: { moduleName: 'Calculator' },
      module_tools: { moduleName: 'Calculator' },

      // JSON module tools
      greet: { name: 'Test User' },
      add_numbers: { a: 10, b: 20 }
    };

    test('should execute tools from each loaded module', async () => {
      const executionResults = [];
      const createdFiles = [];
      const createdDirs = [];

      // Pre-create test file for reading
      const testReadFile = '/tmp/test-read-' + Date.now() + '.txt';
      await fs.writeFile(testReadFile, 'Test content for reading');
      createdFiles.push(testReadFile);
      testParameters.file_read.filepath = testReadFile;

      for (const { config, instance, tools } of loadedModules) {
        console.log(`\n🧪 Testing module: ${config.name} (${tools.length} tools)`);
        
        for (const tool of tools) {
          try {
            if (typeof tool.execute !== 'function') {
              executionResults.push({
                module: config.name,
                tool: tool.name,
                success: false,
                error: 'No execute method'
              });
              console.log(`  ❌ ${tool.name}: No execute method`);
              continue;
            }

            // Get test parameters for this tool
            const params = testParameters[tool.name] || {};
            
            // Execute the tool
            const startTime = Date.now();
            let result;
            
            try {
              result = await tool.execute(params);
              const duration = Date.now() - startTime;

              // Track created files/dirs for cleanup
              if (tool.name === 'file_write' && result?.success) {
                createdFiles.push(params.filepath);
              }
              if (tool.name === 'directory_create' && result?.success) {
                createdDirs.push(params.dirpath);
              }

              executionResults.push({
                module: config.name,
                tool: tool.name,
                success: true,
                result,
                duration,
                hasResult: result !== undefined
              });

              const status = result?.success !== false ? '✅' : '⚠️';
              console.log(`  ${status} ${tool.name}: ${duration}ms`);

            } catch (executionError) {
              // Some tools may fail due to missing dependencies or API keys
              const expectedFailures = [
                'railway_deploy', 'railway_status', 'railway_logs', 
                'railway_update_env', 'railway_remove', 'railway_list_projects',
                'transcribe_audio', 'generate_voice', 'generate_image',
                'google_search' // May fail without API key
              ];
              
              const isExpectedFailure = expectedFailures.includes(tool.name);
              
              executionResults.push({
                module: config.name,
                tool: tool.name,
                success: false,
                error: executionError.message,
                expectedFailure: isExpectedFailure,
                duration: Date.now() - startTime
              });

              const status = isExpectedFailure ? '⚠️' : '❌';
              console.log(`  ${status} ${tool.name}: ${executionError.message.substring(0, 50)}`);
            }

          } catch (error) {
            executionResults.push({
              module: config.name,
              tool: tool.name,
              success: false,
              error: error.message
            });
            console.log(`  ❌ ${tool.name}: Setup error - ${error.message}`);
          }
        }
      }

      // Cleanup created files and directories
      for (const file of createdFiles) {
        try {
          await fs.unlink(file);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      for (const dir of createdDirs) {
        try {
          await fs.rmdir(dir);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Analyze results
      const successful = executionResults.filter(r => r.success);
      const failed = executionResults.filter(r => !r.success);
      const expectedFailures = failed.filter(r => r.expectedFailure);
      const unexpectedFailures = failed.filter(r => !r.expectedFailure);

      console.log(`\n📊 Direct Tool Execution Results:`);
      console.log(`✅ Successful executions: ${successful.length}`);
      console.log(`⚠️  Expected failures (API keys/deps): ${expectedFailures.length}`);
      console.log(`❌ Unexpected failures: ${unexpectedFailures.length}`);

      // Group by module
      const moduleResults = {};
      executionResults.forEach(r => {
        if (!moduleResults[r.module]) {
          moduleResults[r.module] = { total: 0, successful: 0, failed: 0 };
        }
        moduleResults[r.module].total++;
        if (r.success) {
          moduleResults[r.module].successful++;
        } else {
          moduleResults[r.module].failed++;
        }
      });

      console.log(`\n📋 Results by Module:`);
      Object.entries(moduleResults).forEach(([module, stats]) => {
        console.log(`  ${module}: ${stats.successful}/${stats.total} successful`);
      });

      if (unexpectedFailures.length > 0) {
        console.log(`\n❌ Unexpected failures:`);
        unexpectedFailures.forEach(f => {
          console.log(`  - ${f.module}.${f.tool}: ${f.error}`);
        });
      }

      // Expectations
      expect(executionResults.length).toBeGreaterThan(30); // Should have many tool executions
      expect(successful.length).toBeGreaterThan(15); // Many should succeed
      expect(unexpectedFailures.length).toBeLessThan(10); // Few unexpected failures

      // Basic tools should work
      const basicToolResults = executionResults.filter(r => 
        ['json_parse', 'json_stringify', 'calculator', 'directory_current'].includes(r.tool)
      );
      const successfulBasicTools = basicToolResults.filter(r => r.success);
      expect(successfulBasicTools.length).toBeGreaterThan(2);
    });

    test('should have consistent tool interfaces', () => {
      const interfaceAnalysis = [];

      for (const { config, tools } of loadedModules) {
        for (const tool of tools) {
          interfaceAnalysis.push({
            module: config.name,
            tool: tool.name,
            hasName: !!tool.name,
            hasDescription: !!tool.description,
            hasExecute: typeof tool.execute === 'function',
            hasInputSchema: !!tool.inputSchema,
            hasParameters: !!tool.parameters,
            descriptionLength: tool.description?.length || 0
          });
        }
      }

      console.log(`\n🔍 Tool Interface Analysis:`);
      
      const toolsWithExecute = interfaceAnalysis.filter(t => t.hasExecute);
      const toolsWithDescription = interfaceAnalysis.filter(t => t.hasDescription && t.descriptionLength > 5);
      const toolsWithSchema = interfaceAnalysis.filter(t => t.hasInputSchema || t.hasParameters);

      console.log(`  Tools with execute method: ${toolsWithExecute.length}/${interfaceAnalysis.length}`);
      console.log(`  Tools with good descriptions: ${toolsWithDescription.length}/${interfaceAnalysis.length}`);
      console.log(`  Tools with input schema: ${toolsWithSchema.length}/${interfaceAnalysis.length}`);

      // Most tools should have proper interfaces
      expect(toolsWithExecute.length).toBe(interfaceAnalysis.length); // All should have execute
      expect(toolsWithDescription.length).toBeGreaterThan(interfaceAnalysis.length * 0.8); // Most should have descriptions
    });
  });
});