#!/usr/bin/env node

/**
 * Populate the modules collection in MongoDB
 */

import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { ResourceManager } from '@legion/resource-manager';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';

async function populateModules() {
  console.log('📋 Populating modules collection...\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  // Create database storage
  const databaseStorage = new DatabaseStorage({ resourceManager });
  await databaseStorage.connect();
  
  // Create module discovery with database storage
  const discovery = new ModuleDiscovery({ 
    verbose: false,
    databaseStorage 
  });
  
  // Discover all modules
  const modules = await discovery.discoverInMonorepo();
  console.log(`Discovered ${modules.length} modules`);
  
  // Validate modules
  const validModules = [];
  for (const module of modules) {
    const isValid = await discovery.validateModule(module.path);
    if (isValid) {
      validModules.push(module);
      console.log(`  ✅ ${module.name}`);
    } else {
      console.log(`  ❌ ${module.name}`);
    }
  }
  
  console.log(`\n${validModules.length} valid modules found`);
  
  // Save to module-registry
  const savedCount = await discovery.saveToModuleRegistry(validModules);
  console.log(`\n✅ Saved ${savedCount} modules to module-registry`);
  
  // Verify
  const registryCount = await databaseStorage.db.collection('module-registry').countDocuments();
  const modulesCount = await databaseStorage.db.collection('modules').countDocuments();
  console.log(`📊 Total modules in module-registry: ${registryCount}`);
  console.log(`📊 Total modules in modules collection: ${modulesCount}`);
  
  await databaseStorage.disconnect();
}

populateModules().catch(console.error);