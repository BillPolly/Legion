/**
 * Module Instance Validation Test
 * Tests that problematic modules properly extend Module base class
 * Reproduces "Provided module is not an instance of Module" errors
 * NO MOCKS - Real module loading tests
 */

import { ResourceManager } from '@legion/resource-manager';
import { Module } from '../../src/core/Module.js';

describe('Module Instance Validation', () => {
  let resourceManager;
  
  beforeAll(async () => {
    console.log('\n🚀 Setting up Module Instance Validation tests');
    resourceManager = await ResourceManager.getInstance();
    console.log('✅ ResourceManager initialized');
  });

  const problematicModules = [
    {
      name: 'ClaudeToolsModule',
      path: '/Users/williampearson/Documents/p/agents/Legion/packages/modules/claude-tools/src/ClaudeToolsModule.js'
    },
    {
      name: 'JSGeneratorModule', 
      path: '/Users/williampearson/Documents/p/agents/Legion/packages/modules/js-generator/src/JSGeneratorModule.js'
    },
    {
      name: 'CodeAgentModule',
      path: '/Users/williampearson/Documents/p/agents/Legion/packages/modules/code-agent/src/CodeAgentModule.js'
    }
  ];

  test.each(problematicModules)('should verify $name is proper Module instance', async ({ name, path }) => {
    console.log(`\n🔍 Testing module: ${name}`);
    console.log(`📁 Path: ${path}`);
    
    try {
      // Import the module class
      console.log('📦 Importing module...');
      const moduleImport = await import(path);
      const ModuleClass = moduleImport.default || moduleImport[name];
      
      console.log(`✅ Module imported successfully`);
      console.log(`🏗️  Module class name: ${ModuleClass?.name}`);
      console.log(`📱 Has static create: ${typeof ModuleClass?.create === 'function'}`);
      
      // Verify static create method exists
      expect(typeof ModuleClass.create).toBe('function');
      
      // Create instance using static method
      console.log('🚀 Creating module instance...');
      const moduleInstance = await ModuleClass.create(resourceManager);
      
      console.log(`✅ Module instance created`);
      console.log(`🏗️  Instance constructor: ${moduleInstance.constructor.name}`);
      console.log(`📱 Is Module instance: ${moduleInstance instanceof Module}`);
      console.log(`🔧 Has getTools method: ${typeof moduleInstance.getTools === 'function'}`);
      console.log(`📝 Module name: ${moduleInstance.name}`);
      console.log(`📋 Module initialized: ${moduleInstance.initialized}`);
      
      // CRITICAL: Verify instanceof Module check
      expect(moduleInstance instanceof Module).toBe(true);
      
      // Verify required methods
      expect(typeof moduleInstance.getTools).toBe('function');
      expect(moduleInstance.name).toBeDefined();
      expect(moduleInstance.initialized).toBe(true);
      
      // Test getTools method
      console.log('🔧 Testing getTools method...');
      const tools = moduleInstance.getTools();
      expect(Array.isArray(tools)).toBe(true);
      console.log(`✅ getTools returned ${tools.length} tools`);
      
      // Verify tools are proper Tool instances
      const toolAnalysis = tools.map(tool => ({
        name: tool?.name || 'UNNAMED',
        isToolInstance: tool?.constructor?.name === 'Tool' || false,
        hasExecute: typeof tool?.execute === 'function'
      }));
      
      console.log('\n🔧 Tool Analysis:');
      toolAnalysis.forEach((analysis, idx) => {
        console.log(`   ${idx + 1}. ${analysis.name}: Tool=${analysis.isToolInstance}, Execute=${analysis.hasExecute}`);
      });
      
      console.log(`🎉 ${name} validation PASSED!`);
      
    } catch (error) {
      console.log(`❌ ${name} validation FAILED: ${error.message}`);
      console.log(`🔍 Error stack: ${error.stack}`);
      
      // Log the specific error for debugging
      if (error.message.includes('not an instance of Module')) {
        console.log('🚨 FOUND THE INSTANCEOF MODULE ERROR!');
      }
      
      throw error;
    }
  }, 60000);

  test('should identify specific Module inheritance issues', async () => {
    console.log('\n🔍 Deep Module Inheritance Analysis');
    
    const moduleTests = [
      'ClaudeToolsModule',
      'JSGeneratorModule', 
      'CodeAgentModule'
    ];
    
    for (const moduleName of moduleTests) {
      console.log(`\n--- Analyzing ${moduleName} inheritance ---`);
      
      try {
        let modulePath;
        switch (moduleName) {
          case 'ClaudeToolsModule':
            modulePath = '/Users/williampearson/Documents/p/agents/Legion/packages/modules/claude-tools/src/ClaudeToolsModule.js';
            break;
          case 'JSGeneratorModule':
            modulePath = '/Users/williampearson/Documents/p/agents/Legion/packages/modules/js-generator/src/JSGeneratorModule.js';
            break;
          case 'CodeAgentModule':
            modulePath = '/Users/williampearson/Documents/p/agents/Legion/packages/modules/code-agent/src/CodeAgentModule.js';
            break;
        }
        
        const moduleImport = await import(modulePath);
        const ModuleClass = moduleImport.default || moduleImport[moduleName];
        
        console.log(`Class name: ${ModuleClass.name}`);
        console.log(`Prototype chain: ${Object.getPrototypeOf(ModuleClass).name}`);
        console.log(`Extends Module: ${Object.getPrototypeOf(ModuleClass) === Module}`);
        
        const instance = await ModuleClass.create(resourceManager);
        console.log(`Instance constructor: ${instance.constructor.name}`);
        console.log(`Instance prototype: ${Object.getPrototypeOf(instance).constructor.name}`);
        console.log(`Instance of Module: ${instance instanceof Module}`);
        
        // Check prototype chain
        let current = instance;
        let depth = 0;
        console.log('Prototype chain:');
        while (current && depth < 10) {
          console.log(`   ${depth}: ${current.constructor.name}`);
          current = Object.getPrototypeOf(current);
          depth++;
          if (current.constructor === Module) {
            console.log('   ✅ Found Module in prototype chain');
            break;
          }
        }
        
      } catch (error) {
        console.log(`❌ Error analyzing ${moduleName}: ${error.message}`);
      }
    }
  }, 90000);
});