/**
 * Integration test for loading and validating a single module - Calculator
 * This test verifies the complete workflow for a single real module
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';

describe('Single Module Calculator Integration Test', () => {
  let resourceManager;
  let moduleDiscovery;
  let moduleLoader;
  
  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
  });
  
  it('should load and validate the Calculator module', async () => {
    // Create ModuleDiscovery and ModuleLoader
    moduleDiscovery = new ModuleDiscovery({ 
      resourceManager,
      verbose: false 
    });
    moduleLoader = new ModuleLoader({ resourceManager });
    
    // Path to Calculator module
    const calculatorPath = path.resolve(process.cwd(), '../../packages/modules/tools-collection/src/calculator/CalculatorModule.js');
    
    console.log('📁 Loading Calculator module from:', calculatorPath);
    
    // Step 1: Load the module
    const moduleObject = await moduleLoader.loadModule(calculatorPath);
    expect(moduleObject).toBeDefined();
    expect(typeof moduleObject.getTools).toBe('function');
    console.log('✅ Module loaded successfully');
    
    // Step 2: Get module name
    expect(moduleObject.name).toBe('calculator');
    console.log('✅ Module name:', moduleObject.name);
    
    // Step 3: Get tools
    const tools = moduleObject.getTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    console.log('✅ Module has', tools.length, 'tools');
    
    // Step 4: Validate the module
    const validation = await moduleDiscovery.validateModule(moduleObject);
    expect(validation.valid).toBe(true);
    expect(validation.toolsCount).toBe(tools.length);
    console.log('✅ Module validation passed');
    
    // Step 5: Check tool names
    const toolNames = tools.map(t => t.name);
    console.log('📋 Available tools:', toolNames.join(', '));
    
    // Step 6: Test executing a tool
    const calculatorTool = tools.find(t => t.name === 'calculator');
    if (calculatorTool) {
      // Calculator tool expects an expression string
      const result = await calculatorTool.execute({ expression: '5 + 3' });
      console.log('✅ Tool execution test - calculator("5 + 3") =', result);
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(8);
    }
    
    console.log('\n🎉 Calculator module loaded and validated successfully!');
    console.log('   - Module name:', moduleObject.name);
    console.log('   - Tools count:', validation.toolsCount);
    console.log('   - Validation valid:', validation.valid);
    console.log('   - Errors:', validation.errors.length);
  });
});