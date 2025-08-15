/**
 * ResourceManager Instance Debug Test
 * 
 * This test debugs why modules receive ResourceManager instances with no environment variables
 * even though the original ResourceManager has them loaded correctly.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { DirectModuleDiscovery } from '../../src/discovery/DirectModuleDiscovery.js';
import { ModuleInstantiator } from '../../src/discovery/ModuleInstantiator.js';
import { ResourceManager } from '@legion/core';
import path from 'path';

describe('ResourceManager Instance Debug', () => {
  let resourceManager;
  let moduleInstantiator;
  let discoveredModules;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }

    // Create ModuleInstantiator with ResourceManager
    moduleInstantiator = new ModuleInstantiator({
      resourceManager,
      verbose: false
    });

    // Discover modules
    const discovery = new DirectModuleDiscovery({ verbose: false });
    const rootPath = path.resolve('../tools-collection/src');
    discoveredModules = await discovery.discoverModules(rootPath);

    console.log(`Found ${discoveredModules.length} modules for testing:`);
    for (const module of discoveredModules) {
      console.log(`  - ${module.name} (${module.type})`);
    }
  });

  test('should verify ResourceManager has required API keys', () => {
    console.log('📋 Testing ResourceManager API key access...');
    
    expect(resourceManager).toBeTruthy();
    
    // Test accessing required API keys
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    const githubPat = resourceManager.get('env.GITHUB_PAT');
    const serperKey = resourceManager.get('env.SERPER_API_KEY');
    
    console.log(`  ANTHROPIC_API_KEY: ${!!anthropicKey ? 'EXISTS' : 'MISSING'}`);
    console.log(`  GITHUB_PAT: ${!!githubPat ? 'EXISTS' : 'MISSING'}`);
    console.log(`  SERPER_API_KEY: ${!!serperKey ? 'EXISTS' : 'MISSING'}`);
    console.log(`  OPENAI_API_KEY: ${!!resourceManager.get('env.OPENAI_API_KEY') ? 'EXISTS' : 'MISSING'}`);
    
    expect(anthropicKey).toBeTruthy();
    expect(githubPat).toBeTruthy();
    expect(serperKey).toBeTruthy();
  });

  test('should verify ModuleInstantiator has access to ResourceManager with API keys', () => {
    console.log('\n📋 Testing ModuleInstantiator ResourceManager access...');
    
    expect(moduleInstantiator.resourceManager).toBeTruthy();
    expect(moduleInstantiator.resourceManager).toBe(resourceManager);
    
    const instantiatorRM = moduleInstantiator.resourceManager;
    
    console.log(`  Same instance: ${instantiatorRM === resourceManager}`);
    console.log(`  ANTHROPIC_API_KEY accessible: ${!!instantiatorRM.get('env.ANTHROPIC_API_KEY')}`);
    console.log(`  GITHUB_PAT accessible: ${!!instantiatorRM.get('env.GITHUB_PAT')}`);
    console.log(`  SERPER_API_KEY accessible: ${!!instantiatorRM.get('env.SERPER_API_KEY')}`);
    
    expect(instantiatorRM).toBe(resourceManager);
    expect(instantiatorRM.get('env.ANTHROPIC_API_KEY')).toBeTruthy();
  });

  test('should verify ModuleInstantiator passes ResourceManager with API keys to modules', async () => {
    console.log('\n📋 Testing module instantiation with API key access...');
    
    const aiModule = discoveredModules.find(m => m.name === 'AIGeneration');
    expect(aiModule).toBeTruthy();
    
    console.log(`  Found AIGenerationModule: ${aiModule.name}`);
    console.log(`  Has factory: ${aiModule.hasFactory}`);

    // Import the module to intercept its create method
    const { default: AIGenerationModule } = await import('../../../tools-collection/src/ai-generation/AIGenerationModule.js');
    
    const originalCreate = AIGenerationModule.create;
    let interceptedRM = null;
    let apiKeyFound = false;
    
    // Override to check ResourceManager
    AIGenerationModule.create = async function(receivedRM) {
      interceptedRM = receivedRM;
      console.log(`    Received ResourceManager: ${!!receivedRM}`);
      console.log(`    Is same instance: ${receivedRM === resourceManager}`);
      console.log(`    Can access ANTHROPIC_API_KEY: ${!!receivedRM.get('env.ANTHROPIC_API_KEY')}`);
      console.log(`    Can access OPENAI_API_KEY: ${!!receivedRM.get('env.OPENAI_API_KEY')}`);
      
      apiKeyFound = !!receivedRM.get('env.OPENAI_API_KEY');
      
      // Call original (expected to fail due to missing OPENAI_API_KEY)
      return originalCreate.call(this, receivedRM);
    };
    
    try {
      await moduleInstantiator.instantiate(aiModule);
      console.log('  ✅ Module instantiated successfully');
    } catch (error) {
      if (error.message.includes('OPENAI_API_KEY')) {
        console.log(`  ✅ Module correctly failed due to missing OPENAI_API_KEY`);
      } else {
        console.log(`  ❌ Module failed for different reason: ${error.message}`);
      }
    }
    
    AIGenerationModule.create = originalCreate;
    
    expect(interceptedRM).toBeTruthy();
    expect(interceptedRM).toBe(resourceManager);
    expect(interceptedRM.get('env.ANTHROPIC_API_KEY')).toBeTruthy();
  });

  test('should test SerperModule instantiation to verify API key handling', async () => {
    console.log('\n📋 Testing SerperModule with SERPER_API_KEY...');
    
    const serperModule = discoveredModules.find(m => m.name === 'Serper');
    expect(serperModule).toBeTruthy();
    
    console.log(`  Found SerperModule: ${serperModule.name}`);
    console.log(`  Module type: ${serperModule.type}`);
    console.log(`  Has factory: ${serperModule.hasFactory}`);
    console.log(`  ModuleInstantiator has resourceManager: ${!!moduleInstantiator.resourceManager}`);
    console.log(`  ResourceManager has SERPER_API_KEY: ${!!resourceManager.get('env.SERPER_API_KEY')}`);
    
    try {
      const result = await moduleInstantiator.instantiate(serperModule);
      console.log('  ✅ SerperModule instantiated successfully');
      
      // Check if it has getTools method
      if (typeof result.getTools === 'function') {
        const tools = result.getTools();
        console.log(`    Module has ${tools.length} tools`);
      }
      
    } catch (error) {
      console.log(`  ❌ SerperModule failed: ${error.message}`);
      
      if (error.message.includes('SERPER_API_KEY')) {
        console.log('    (Expected - means ResourceManager was used correctly)');
      }
    }
  });

  test('should verify modules can instantiate and access their tools correctly', async () => {
    console.log('\n📋 Testing module tool instantiation...');
    
    // Test a simple module that doesn't need API keys
    const calculatorModule = discoveredModules.find(m => m.name.includes('Calculator'));
    expect(calculatorModule).toBeTruthy();
    console.log(`  Testing Calculator module: ${calculatorModule.name}`);
    
    const result = await moduleInstantiator.instantiate(calculatorModule);
    console.log('    ✅ Calculator instantiated successfully');
    
    expect(result).toBeTruthy();
    expect(typeof result.getTools).toBe('function');
    
    const tools = result.getTools();
    console.log(`    Has ${tools.length} tools`);
    expect(tools.length).toBeGreaterThan(0);
    
    for (const tool of tools) {
      console.log(`      Tool: ${tool.name} - ${typeof tool.execute === 'function' ? 'executable' : 'not executable'}`);
      expect(typeof tool.execute).toBe('function');
    }
    
    // Test a module with ResourceManager dependency
    const fileModule = discoveredModules.find(m => m.name === 'File');
    expect(fileModule).toBeTruthy();
    console.log(`  Testing File module: ${fileModule.name}`);
    
    const fileResult = await moduleInstantiator.instantiate(fileModule);
    console.log('    ✅ File module instantiated successfully');
    
    expect(fileResult).toBeTruthy();
    expect(typeof fileResult.getTools).toBe('function');
    
    const fileTools = fileResult.getTools();
    console.log(`    Has ${fileTools.length} tools`);
    expect(fileTools.length).toBeGreaterThan(0);
  });
});