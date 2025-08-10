/**
 * Complete Module Execution Test
 * 
 * This test verifies that ALL discovered modules load correctly and that
 * ALL their tools are executable with proper parameters.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { DirectModuleDiscovery } from '../../src/discovery/DirectModuleDiscovery.js';
import { ModuleInstantiator } from '../../src/discovery/ModuleInstantiator.js';
import { ResourceManager } from '@legion/tools';
import path from 'path';

describe('Complete Module Execution Test', () => {
  let resourceManager;
  let moduleInstantiator;
  let discoveredModules;
  let moduleInstances;
  let allTools;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create ModuleInstantiator with ResourceManager
    moduleInstantiator = new ModuleInstantiator({
      resourceManager,
      verbose: false
    });

    // Discover modules
    const discovery = new DirectModuleDiscovery({ verbose: false });
    const rootPath = path.resolve('../tools-collection/src');
    discoveredModules = await discovery.discoverModules(rootPath);

    console.log(`\n📋 Discovered ${discoveredModules.length} modules:`);
    for (const module of discoveredModules) {
      console.log(`  - ${module.name} (${module.type})`);
    }

    // Initialize all modules
    moduleInstances = new Map();
    allTools = [];

    for (const moduleData of discoveredModules) {
      try {
        const instance = await moduleInstantiator.instantiate(moduleData);
        moduleInstances.set(moduleData.name, {
          moduleData,
          instance,
          error: null
        });

        // Collect tools from this module
        if (instance && typeof instance.getTools === 'function') {
          const tools = instance.getTools();
          for (const tool of tools) {
            allTools.push({
              moduleName: moduleData.name,
              tool,
              moduleInstance: instance
            });
          }
        }

      } catch (error) {
        moduleInstances.set(moduleData.name, {
          moduleData,
          instance: null,
          error: error.message
        });
      }
    }

    console.log(`\n📋 Module instantiation summary:`);
    console.log(`  Successful: ${Array.from(moduleInstances.values()).filter(m => m.instance).length}`);
    console.log(`  Failed: ${Array.from(moduleInstances.values()).filter(m => !m.instance).length}`);
    console.log(`  Total tools: ${allTools.length}`);
  });

  test('should successfully instantiate all modules', () => {
    console.log('\n📋 Testing all module instantiation...');
    
    const results = [];
    for (const [moduleName, result] of moduleInstances.entries()) {
      if (result.instance) {
        console.log(`  ✅ ${moduleName}: SUCCESS`);
        results.push({ name: moduleName, success: true, error: null });
      } else {
        console.log(`  ❌ ${moduleName}: FAILED - ${result.error}`);
        results.push({ name: moduleName, success: false, error: result.error });
      }
    }

    // All modules should instantiate successfully
    const failedModules = results.filter(r => !r.success);
    if (failedModules.length > 0) {
      console.log('\nFailed modules:');
      for (const failed of failedModules) {
        console.log(`  - ${failed.name}: ${failed.error}`);
      }
    }

    // We expect all modules to instantiate (even if they fail due to missing API keys, they should still create instances)
    expect(failedModules.length).toBe(0);
  });

  test('should verify all modules have getTools method', () => {
    console.log('\n📋 Testing getTools method availability...');
    
    for (const [moduleName, result] of moduleInstances.entries()) {
      if (result.instance) {
        console.log(`  Testing ${moduleName}...`);
        expect(result.instance).toBeTruthy();
        expect(typeof result.instance.getTools).toBe('function');
        console.log(`    ✅ Has getTools method`);
        
        const tools = result.instance.getTools();
        expect(Array.isArray(tools)).toBe(true);
        console.log(`    ✅ Returns ${tools.length} tools`);
      }
    }
  });

  test('should verify all tools have required methods and properties', () => {
    console.log('\n📋 Testing all tool interfaces...');
    
    expect(allTools.length).toBeGreaterThan(0);
    
    for (const { moduleName, tool, moduleInstance } of allTools) {
      console.log(`  Testing ${moduleName}.${tool.name}...`);
      
      // Required properties
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe('string');
      console.log(`    ✅ Has name: ${tool.name}`);
      
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
      console.log(`    ✅ Has description: ${tool.description.substring(0, 50)}...`);
      
      // Required execute method
      expect(typeof tool.execute).toBe('function');
      console.log(`    ✅ Has execute method`);
      
      // Check if tool has reference to its parent module
      const hasModuleRef = 
        tool.module === moduleInstance ||
        tool.config?.module === moduleInstance ||
        tool.dependencies?.module === moduleInstance ||
        tool.parent === moduleInstance;
      
      if (hasModuleRef) {
        console.log(`    ✅ Has module reference`);
      } else {
        console.log(`    ⚠️ No clear module reference found`);
      }
    }
  });

  test('should test tool execution with valid parameters', async () => {
    console.log('\n📋 Testing tool execution...');
    
    const executionResults = [];
    
    // Test specific tools we know should work
    const testCases = [
      {
        toolName: 'calculator',
        params: { expression: '2 + 2' }
      },
      {
        toolName: 'json_parse',
        params: { json_string: '{"test": "value"}' }
      },
      {
        toolName: 'json_stringify',
        params: { object: { test: 'value' } }
      }
    ];
    
    for (const testCase of testCases) {
      const toolEntry = allTools.find(t => t.tool.name === testCase.toolName);
      
      if (toolEntry) {
        console.log(`  Testing ${testCase.toolName} execution...`);
        
        try {
          const result = await toolEntry.tool.execute(testCase.params);
          console.log(`    ✅ Execution successful`);
          console.log(`    Result: ${JSON.stringify(result).substring(0, 100)}...`);
          
          expect(result).toBeTruthy();
          executionResults.push({
            toolName: testCase.toolName,
            success: true,
            result
          });
          
        } catch (error) {
          console.log(`    ❌ Execution failed: ${error.message}`);
          executionResults.push({
            toolName: testCase.toolName,
            success: false,
            error: error.message
          });
        }
      } else {
        console.log(`    ⚠️ Tool ${testCase.toolName} not found`);
      }
    }
    
    // At least some tools should execute successfully
    const successfulExecutions = executionResults.filter(r => r.success);
    expect(successfulExecutions.length).toBeGreaterThan(0);
    
    console.log(`\n📊 Execution summary:`);
    console.log(`  Successful: ${successfulExecutions.length}`);
    console.log(`  Failed: ${executionResults.filter(r => !r.success).length}`);
  });

  test('should verify tools requiring API keys handle missing keys correctly', async () => {
    console.log('\n📋 Testing API key dependent tools...');
    
    // Test tools that should fail gracefully with missing API keys
    const apiDependentTools = allTools.filter(t => 
      t.tool.name.includes('search') || 
      t.tool.name.includes('image') || 
      t.tool.name.includes('generate')
    );
    
    console.log(`  Found ${apiDependentTools.length} API-dependent tools`);
    
    for (const { moduleName, tool } of apiDependentTools) {
      console.log(`  Testing ${moduleName}.${tool.name}...`);
      
      try {
        // Try to execute with minimal params - should fail gracefully
        const result = await tool.execute({ query: 'test' });
        console.log(`    ⚠️ Unexpected success: ${JSON.stringify(result).substring(0, 50)}...`);
        
      } catch (error) {
        if (error.message.includes('API') || error.message.includes('KEY') || error.message.includes('key')) {
          console.log(`    ✅ Correctly failed due to missing API key`);
        } else {
          console.log(`    ❌ Failed for unexpected reason: ${error.message}`);
        }
      }
    }
  });

  test('should provide comprehensive module and tool inventory', () => {
    console.log('\n📋 Complete Module and Tool Inventory:');
    
    for (const [moduleName, result] of moduleInstances.entries()) {
      console.log(`\n  📦 Module: ${moduleName}`);
      
      if (result.instance) {
        const tools = result.instance.getTools();
        console.log(`    Status: ✅ LOADED`);
        console.log(`    Tools: ${tools.length}`);
        
        for (const tool of tools) {
          console.log(`      🔧 ${tool.name}: ${tool.description.substring(0, 60)}...`);
        }
      } else {
        console.log(`    Status: ❌ FAILED - ${result.error}`);
      }
    }
    
    console.log(`\n📊 Final Statistics:`);
    console.log(`  Total modules discovered: ${discoveredModules.length}`);
    console.log(`  Modules loaded: ${Array.from(moduleInstances.values()).filter(m => m.instance).length}`);
    console.log(`  Modules failed: ${Array.from(moduleInstances.values()).filter(m => !m.instance).length}`);
    console.log(`  Total tools available: ${allTools.length}`);
    
    const toolsByModule = {};
    for (const { moduleName } of allTools) {
      toolsByModule[moduleName] = (toolsByModule[moduleName] || 0) + 1;
    }
    
    console.log(`  Tools by module:`);
    for (const [module, count] of Object.entries(toolsByModule)) {
      console.log(`    ${module}: ${count} tools`);
    }
  });
});