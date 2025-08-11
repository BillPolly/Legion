/**
 * ToolRegistry Diagnostics Test
 * 
 * This test diagnoses issues with tool retrieval by comparing:
 * 1. Tools available directly from modules
 * 2. Tools retrievable via ToolRegistry
 * 3. Tools stored in the database
 * 
 * It identifies mismatches and provides detailed debugging information.
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { ModuleLoader } from '../../src/loading/ModuleLoader.js';
import { ResourceManager } from '@legion/tools';
import fs from 'fs/promises';
import path from 'path';

describe('ToolRegistry Diagnostics', () => {
  let resourceManager;
  let provider;
  let toolRegistry;
  let moduleLoader;
  let registryContent;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create database provider
    provider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });

    // Create ToolRegistry
    toolRegistry = new ToolRegistry({ provider });
    await toolRegistry.initialize();

    // Create ModuleLoader for direct module loading
    moduleLoader = new ModuleLoader({ verbose: false });
    await moduleLoader.initialize();

    // Load module registry
    const registryPath = path.resolve('src/loading/module-registry.json');
    registryContent = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
  });

  afterAll(async () => {
    if (provider) {
      await provider.disconnect();
    }
  });

  describe('Module vs Database vs Registry Comparison', () => {
    test('should compare tools from all three sources', async () => {
      const diagnostics = [];
      
      console.log('\n🔍 DIAGNOSTIC REPORT: Tool Retrieval Analysis\n');
      console.log('=' + '='.repeat(79));

      for (const moduleConfig of registryContent) {
        const moduleDiagnostic = {
          moduleName: moduleConfig.name,
          moduleTools: [],
          databaseTools: [],
          registryRetrievable: [],
          issues: []
        };

        console.log(`\n📦 Module: ${moduleConfig.name}`);
        console.log('-'.repeat(40));

        // 1. Load module directly and get its tools
        try {
          const moduleInstance = await moduleLoader.loadModule(moduleConfig);
          if (moduleInstance && typeof moduleInstance.getTools === 'function') {
            const tools = moduleInstance.getTools() || [];
            moduleDiagnostic.moduleTools = tools.map(t => ({
              name: t.name,
              hasExecute: typeof t.execute === 'function'
            }));
            console.log(`  Direct loading: ${tools.length} tools found`);
            if (tools.length > 0) {
              console.log(`    Tools: [${tools.map(t => t.name).join(', ')}]`);
            }
          } else {
            console.log(`  Direct loading: No getTools method or failed to load`);
            moduleDiagnostic.issues.push('Module has no getTools method');
          }
        } catch (error) {
          console.log(`  Direct loading: Failed - ${error.message}`);
          moduleDiagnostic.issues.push(`Module loading failed: ${error.message}`);
        }

        // 2. Get tools from database for this module
        try {
          const dbTools = await provider.listTools({ 
            moduleName: moduleConfig.name,
            limit: 100 
          });
          moduleDiagnostic.databaseTools = dbTools.map(t => t.name);
          console.log(`  Database: ${dbTools.length} tools stored`);
          if (dbTools.length > 0) {
            console.log(`    Tools: [${dbTools.map(t => t.name).join(', ')}]`);
          }
        } catch (error) {
          console.log(`  Database: Failed to query - ${error.message}`);
          moduleDiagnostic.issues.push(`Database query failed: ${error.message}`);
        }

        // 3. Try to retrieve each database tool via ToolRegistry
        if (moduleDiagnostic.databaseTools.length > 0) {
          console.log(`  ToolRegistry retrieval:`);
          for (const toolName of moduleDiagnostic.databaseTools) {
            try {
              const tool = await toolRegistry.getTool(toolName);
              if (tool && typeof tool.execute === 'function') {
                moduleDiagnostic.registryRetrievable.push(toolName);
                console.log(`    ✅ ${toolName}: Retrieved successfully`);
              } else {
                console.log(`    ❌ ${toolName}: Retrieved but no execute method`);
                moduleDiagnostic.issues.push(`${toolName}: No execute method`);
              }
            } catch (error) {
              console.log(`    ❌ ${toolName}: Failed - ${error.message}`);
              moduleDiagnostic.issues.push(`${toolName}: ${error.message}`);
            }
          }
        }

        // 4. Analyze mismatches
        const moduleToolNames = moduleDiagnostic.moduleTools.map(t => t.name);
        const dbToolNames = moduleDiagnostic.databaseTools;
        const registryToolNames = moduleDiagnostic.registryRetrievable;

        // Tools in module but not in database
        const missingInDb = moduleToolNames.filter(t => !dbToolNames.includes(t));
        if (missingInDb.length > 0) {
          console.log(`  ⚠️ Tools in module but not in database: [${missingInDb.join(', ')}]`);
          moduleDiagnostic.issues.push(`Missing in DB: ${missingInDb.join(', ')}`);
        }

        // Tools in database but not retrievable
        const notRetrievable = dbToolNames.filter(t => !registryToolNames.includes(t));
        if (notRetrievable.length > 0) {
          console.log(`  ⚠️ Tools in database but not retrievable: [${notRetrievable.join(', ')}]`);
          moduleDiagnostic.issues.push(`Not retrievable: ${notRetrievable.join(', ')}`);
        }

        // Tools in database but not in module
        const extraInDb = dbToolNames.filter(t => !moduleToolNames.includes(t));
        if (extraInDb.length > 0) {
          console.log(`  ⚠️ Tools in database but not in module: [${extraInDb.join(', ')}]`);
          moduleDiagnostic.issues.push(`Extra in DB: ${extraInDb.join(', ')}`);
        }

        diagnostics.push(moduleDiagnostic);
      }

      // Summary statistics
      console.log('\n' + '='.repeat(80));
      console.log('📊 SUMMARY STATISTICS');
      console.log('='.repeat(80));

      const totalModuleTools = diagnostics.reduce((sum, d) => sum + d.moduleTools.length, 0);
      const totalDbTools = diagnostics.reduce((sum, d) => sum + d.databaseTools.length, 0);
      const totalRetrievable = diagnostics.reduce((sum, d) => sum + d.registryRetrievable.length, 0);

      console.log(`Total tools in modules: ${totalModuleTools}`);
      console.log(`Total tools in database: ${totalDbTools}`);
      console.log(`Total tools retrievable: ${totalRetrievable}`);
      console.log(`Retrieval success rate: ${((totalRetrievable / totalDbTools) * 100).toFixed(1)}%`);

      // List all problematic modules
      const problematicModules = diagnostics.filter(d => d.issues.length > 0);
      if (problematicModules.length > 0) {
        console.log('\n⚠️ MODULES WITH ISSUES:');
        problematicModules.forEach(m => {
          console.log(`  ${m.moduleName}:`);
          m.issues.forEach(issue => {
            console.log(`    - ${issue}`);
          });
        });
      }

      // Expectations
      expect(totalModuleTools).toBeGreaterThan(40);
      expect(totalDbTools).toBeGreaterThan(40);
      expect(totalRetrievable).toBe(totalDbTools); // All database tools should be retrievable
    });
  });

  describe('Individual Tool Diagnostics', () => {
    test('should diagnose specific failing tools', async () => {
      // Test specific tools that are known to have issues
      const problematicTools = [
        'module_list',
        'module_info', 
        'module_tools',
        'module_load',
        'module_unload'
      ];

      console.log('\n🔬 DETAILED DIAGNOSTICS FOR PROBLEMATIC TOOLS\n');
      console.log('=' + '='.repeat(79));

      for (const toolName of problematicTools) {
        console.log(`\n🔧 Tool: ${toolName}`);
        console.log('-'.repeat(40));

        // Check database
        const dbTool = await provider.getTool(toolName);
        if (dbTool) {
          console.log(`  ✅ Found in database`);
          console.log(`    Module: ${dbTool.moduleName || dbTool.module}`);
          console.log(`    Description: ${dbTool.description?.substring(0, 60)}...`);
        } else {
          console.log(`  ❌ Not found in database`);
          continue;
        }

        // Try to load the module
        const moduleName = dbTool.moduleName || dbTool.module;
        console.log(`  Loading module: ${moduleName}`);
        
        // Get module config
        const moduleConfig = registryContent.find(m => m.name === moduleName);
        if (!moduleConfig) {
          console.log(`    ❌ Module config not found in registry`);
          continue;
        }

        try {
          const moduleInstance = await moduleLoader.loadModule(moduleConfig);
          if (moduleInstance) {
            console.log(`    ✅ Module loaded successfully`);
            
            // Check for tools
            if (typeof moduleInstance.getTools === 'function') {
              const tools = moduleInstance.getTools() || [];
              const toolNames = tools.map(t => t.name);
              console.log(`    Module has ${tools.length} tools: [${toolNames.join(', ')}]`);
              
              const foundTool = tools.find(t => t.name === toolName);
              if (foundTool) {
                console.log(`    ✅ Tool '${toolName}' found in module`);
                console.log(`       Has execute: ${typeof foundTool.execute === 'function'}`);
              } else {
                console.log(`    ❌ Tool '${toolName}' NOT found in module`);
                console.log(`       Available: [${toolNames.join(', ')}]`);
              }
            } else {
              console.log(`    ❌ Module has no getTools method`);
            }
          } else {
            console.log(`    ❌ Module instance is null`);
          }
        } catch (error) {
          console.log(`    ❌ Failed to load module: ${error.message}`);
        }

        // Try ToolRegistry retrieval
        console.log(`  Attempting ToolRegistry retrieval:`);
        try {
          const tool = await toolRegistry.getTool(toolName);
          if (tool) {
            console.log(`    ✅ Retrieved via ToolRegistry`);
            console.log(`       Has execute: ${typeof tool.execute === 'function'}`);
          } else {
            console.log(`    ❌ ToolRegistry returned null`);
          }
        } catch (error) {
          console.log(`    ❌ ToolRegistry error: ${error.message}`);
        }
      }
    });
  });

  describe('Cache Behavior', () => {
    test('should verify ToolRegistry caching works correctly', async () => {
      console.log('\n🗄️ CACHE BEHAVIOR TEST\n');
      console.log('=' + '='.repeat(79));

      // Clear cache first
      toolRegistry.clearCache();
      console.log('Cache cleared');

      // Test tool retrieval and caching
      const testTool = 'calculator';
      
      console.log(`\nFirst retrieval of '${testTool}':`);
      const start1 = Date.now();
      const tool1 = await toolRegistry.getTool(testTool);
      const time1 = Date.now() - start1;
      console.log(`  Time: ${time1}ms`);
      console.log(`  Success: ${!!tool1}`);
      console.log(`  Cache size: ${toolRegistry.toolCache.size}`);

      console.log(`\nSecond retrieval of '${testTool}' (should be cached):`);
      const start2 = Date.now();
      const tool2 = await toolRegistry.getTool(testTool);
      const time2 = Date.now() - start2;
      console.log(`  Time: ${time2}ms`);
      console.log(`  Success: ${!!tool2}`);
      console.log(`  Cache size: ${toolRegistry.toolCache.size}`);
      console.log(`  Same instance: ${tool1 === tool2}`);

      expect(tool1).toBeTruthy();
      expect(tool2).toBeTruthy();
      expect(tool1).toBe(tool2); // Should be same cached instance
      expect(time2).toBeLessThan(time1); // Cached retrieval should be faster
    });
  });
});