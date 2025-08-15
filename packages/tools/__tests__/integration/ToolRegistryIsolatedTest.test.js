/**
 * Isolated ToolRegistry Test
 * 
 * This test isolates the issue with tool extraction from modules
 * to identify and fix the root cause.
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { ModuleLoader } from '../../src/loading/ModuleLoader.js';
import { ResourceManager } from '@legion/core';

describe('ToolRegistry Isolated Test', () => {
  let resourceManager;
  let provider;
  let toolRegistry;

  beforeAll(async () => {
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }

    provider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });

    toolRegistry = new ToolRegistry({ provider });
    await toolRegistry.initialize();
  });

  afterAll(async () => {
    if (provider) {
      await provider.disconnect();
    }
  });

  test('should load Calculator module and extract calculator tool', async () => {
    console.log('\n🔬 Testing Calculator Module Loading\n');
    
    // Step 1: Load module directly to verify it works
    console.log('Step 1: Load Calculator module directly');
    const moduleLoader = new ModuleLoader({ verbose: false });
    await moduleLoader.initialize();
    
    const calculatorConfig = {
      name: 'Calculator',
      type: 'class',
      path: 'packages/tools-collection/src/calculator',
      className: 'CalculatorModule',
      description: 'Mathematical calculations and operations'
    };
    
    const calculatorModule = await moduleLoader.loadModule(calculatorConfig);
    expect(calculatorModule).toBeTruthy();
    console.log('  ✅ Module loaded');
    
    // Step 2: Get tools from module
    console.log('Step 2: Get tools from module');
    const tools = calculatorModule.getTools();
    console.log(`  Found ${tools.length} tools: [${tools.map(t => t.name).join(', ')}]`);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('calculator');
    
    // Step 3: Test tool execution
    console.log('Step 3: Test direct tool execution');
    const calculatorTool = tools[0];
    const result = await calculatorTool.execute({ expression: '2 + 2' });
    console.log(`  Result: ${result.result}`);
    expect(result.result).toBe(4);
    
    // Step 4: Now test via ToolRegistry
    console.log('\nStep 4: Test via ToolRegistry');
    const registryTool = await toolRegistry.getTool('calculator');
    
    if (registryTool) {
      console.log('  ✅ Tool retrieved from ToolRegistry');
      const registryResult = await registryTool.execute({ expression: '3 + 3' });
      console.log(`  Result: ${registryResult.result}`);
      expect(registryResult.result).toBe(6);
    } else {
      console.log('  ❌ Tool NOT retrieved from ToolRegistry');
      
      // Debug: Check what's in the cache
      console.log('\nDebug Info:');
      console.log(`  Tool cache size: ${toolRegistry.toolCache.size}`);
      console.log(`  Module cache size: ${toolRegistry.moduleCache.size}`);
      
      // Try to manually trace the issue
      const dbTool = await provider.getTool('calculator');
      console.log(`  Tool in database: ${!!dbTool}`);
      if (dbTool) {
        console.log(`    Module name: ${dbTool.moduleName || dbTool.module}`);
      }
    }
    
    expect(registryTool).toBeTruthy();
  });

  test('should load System module and extract all its tools', async () => {
    console.log('\n🔬 Testing System Module Loading\n');
    
    // Load System module directly
    console.log('Step 1: Load System module directly');
    const moduleLoader = new ModuleLoader({ verbose: false });
    await moduleLoader.initialize();
    
    const systemConfig = {
      name: 'System',
      type: 'class',
      path: 'packages/tools-collection/src/system',
      className: 'SystemModule',
      description: 'System information and operations'
    };
    
    const systemModule = await moduleLoader.loadModule(systemConfig);
    expect(systemModule).toBeTruthy();
    
    const tools = systemModule.getTools();
    console.log(`  Found ${tools.length} tools: [${tools.map(t => t.name).join(', ')}]`);
    
    // Test each tool via ToolRegistry
    console.log('\nStep 2: Test each System tool via ToolRegistry');
    for (const tool of tools) {
      const registryTool = await toolRegistry.getTool(tool.name);
      if (registryTool) {
        console.log(`  ✅ ${tool.name}: Retrieved`);
      } else {
        console.log(`  ❌ ${tool.name}: Failed`);
      }
    }
  });

  test('should verify module caching works', async () => {
    console.log('\n🔬 Testing Module Caching\n');
    
    // Clear cache
    toolRegistry.clearCache();
    console.log('Cache cleared');
    
    // First retrieval
    console.log('\nFirst retrieval of json_parse:');
    const start1 = Date.now();
    const tool1 = await toolRegistry.getTool('json_parse');
    const time1 = Date.now() - start1;
    console.log(`  Time: ${time1}ms`);
    console.log(`  Success: ${!!tool1}`);
    console.log(`  Module cache size: ${toolRegistry.moduleCache.size}`);
    console.log(`  Tool cache size: ${toolRegistry.toolCache.size}`);
    
    // Second retrieval of same tool (should use cached module)
    console.log('\nSecond retrieval of json_stringify (same module):');
    const start2 = Date.now();
    const tool2 = await toolRegistry.getTool('json_stringify');
    const time2 = Date.now() - start2;
    console.log(`  Time: ${time2}ms`);
    console.log(`  Success: ${!!tool2}`);
    console.log(`  Module cache size: ${toolRegistry.moduleCache.size}`);
    console.log(`  Tool cache size: ${toolRegistry.toolCache.size}`);
    
    // Module should be cached
    expect(toolRegistry.moduleCache.size).toBe(1);
    expect(toolRegistry.toolCache.size).toBe(2);
  });
});