#!/usr/bin/env node

/**
 * Quick validation of all discovered modules
 */

import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { ResourceManager } from '@legion/resource-manager';

async function main() {
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const discovery = new ModuleDiscovery({ verbose: false });
  const modules = await discovery.discoverInMonorepo();
  
  console.log(`Found ${modules.length} modules\n`);
  
  const validModules = [];
  const invalidModules = [];
  
  for (const module of modules) {
    try {
      // Try to import
      const ModuleClass = await import(module.path);
      const ActualClass = ModuleClass.default || ModuleClass[module.name] || ModuleClass;
      
      if (typeof ActualClass !== 'function') {
        throw new Error(`Not a constructor`);
      }
      
      // Try to create instance
      let instance;
      if (typeof ActualClass.create === 'function') {
        instance = await ActualClass.create(resourceManager);
      } else {
        instance = new ActualClass();
        if (typeof instance.initialize === 'function') {
          instance.resourceManager = resourceManager;
          await instance.initialize();
        }
      }
      
      // Check interface
      if (typeof instance.getTools === 'function') {
        const tools = instance.getTools();
        console.log(`✅ ${module.name}: valid (${Array.isArray(tools) ? tools.length : 0} tools)`);
        validModules.push(module);
      } else {
        throw new Error('No getTools method');
      }
      
      // Cleanup
      if (typeof instance.cleanup === 'function') {
        await instance.cleanup();
      }
    } catch (error) {
      console.log(`❌ ${module.name}: ${error.message}`);
      invalidModules.push({ module, error: error.message });
    }
  }
  
  console.log(`\nSummary: ${validModules.length} valid, ${invalidModules.length} invalid`);
  
  if (invalidModules.length > 0) {
    console.log('\nInvalid modules:');
    for (const { module, error } of invalidModules) {
      console.log(`  - ${module.name}: ${error}`);
    }
  }
  
  process.exit(invalidModules.length > 0 ? 1 : 0);
}

main().catch(console.error);