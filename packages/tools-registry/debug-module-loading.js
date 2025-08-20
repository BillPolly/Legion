#!/usr/bin/env node

/**
 * Debug Module Loading
 * 
 * Tests the actual module loading process to see where it fails
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { LoadingManager } from './src/loading/LoadingManager.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';

async function debugModuleLoading() {
  console.log('🔍 Debug Module Loading\n');
  
  try {
    const rm = new ResourceManager();
    await rm.initialize();
    
    const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
    
    // Clear data
    await provider.databaseService.mongoProvider.delete('modules', {});
    await provider.databaseService.mongoProvider.delete('tools', {});
    console.log('✅ Cleared existing data');
    
    // Insert the Calculator module with correct path
    const moduleData = {
      name: 'Calculator',
      type: 'class',
      className: 'CalculatorModule',
      path: 'packages/tools-collection/src/calculator',
      filePath: 'packages/tools-collection/src/calculator/CalculatorModule.js',
      description: 'Calculator module provides mathematical computation tools and operations',
      package: '@legion/tools-collection',
      tags: ['math', 'calculator'],
      category: 'utility',
      config: {},
      status: 'active',
      maintainer: {},
      loadingStatus: 'pending',
      indexingStatus: 'pending',
      validationStatus: 'pending',
      toolCount: parseInt(0),
      perspectiveCount: parseInt(0),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const moduleResult = await provider.databaseService.mongoProvider.insert('modules', moduleData);
    const moduleId = moduleResult.insertedIds[0];
    console.log('✅ Module inserted successfully, ID:', moduleId);
    
    // Now try to directly import the module to test if it can be loaded
    console.log('\n🧪 Testing direct module import...');
    
    try {
      // Get the absolute path to the module
      const monorepoRoot = rm.get('env.MONOREPO_ROOT') || '/Users/maxximus/Documents/max/pocs/Legion';
      const modulePath = path.resolve(monorepoRoot, 'packages/tools-collection/src/calculator/CalculatorModule.js');
      
      console.log('  Module path:', modulePath);
      
      // Import the module dynamically
      const { default: CalculatorModule } = await import(modulePath);
      console.log('✅ Module imported successfully');
      
      // Test instantiation
      const moduleInstance = new CalculatorModule();
      console.log('✅ Module instantiated successfully');
      console.log('  Module name:', moduleInstance.name);
      console.log('  Module description:', moduleInstance.description);
      
      // Check tools
      if (moduleInstance.getTools) {
        const tools = moduleInstance.getTools();
        console.log('  Tools found:', tools.length);
        for (const tool of tools) {
          console.log(`    - ${tool.name}: ${tool.description}`);
        }
      } else {
        console.log('  ❌ No getTools method found');
      }
      
    } catch (importError) {
      console.error('❌ Module import failed:', importError.message);
      console.error('  Stack:', importError.stack);
    }
    
    // Now test loading through LoadingManager
    console.log('\n🔧 Testing LoadingManager...');
    const loadingManager = new LoadingManager(provider.databaseService.mongoProvider, { verbose: true });
    
    const loadResult = await loadingManager.loadModules({
      module: 'Calculator',
      verbose: true
    });
    
    console.log('\n📊 Load Results:');
    console.log('  Modules loaded:', loadResult.modulesLoaded || 0);
    console.log('  Tools loaded:', loadResult.toolsLoaded || 0);
    console.log('  Errors:', loadResult.errors?.length || 0);
    
    if (loadResult.errors?.length > 0) {
      console.log('\n❌ Load errors:');
      for (const error of loadResult.errors) {
        console.log(`  - ${error}`);
      }
    }
    
    // Check final database state
    const finalTools = await provider.databaseService.mongoProvider.find('tools', {});
    console.log(`\n📊 Final count: ${finalTools.length} tools in database`);
    
    if (finalTools.length > 0) {
      console.log('\n✅ Success! Tools loaded:');
      for (const tool of finalTools) {
        console.log(`  - ${tool.name}: ${tool.description.substring(0, 60)}...`);
      }
    }
    
    await provider.disconnect();
    
  } catch (error) {
    console.error('\n❌ Critical error:', error.message);
    console.error('  Stack:', error.stack);
  }
}

debugModuleLoading().catch(console.error);