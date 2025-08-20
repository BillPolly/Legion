#!/usr/bin/env node

/**
 * Debug DatabasePopulator
 * 
 * Tests DatabasePopulator directly to verify it works correctly
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { DatabasePopulator } from './src/loading/DatabasePopulator.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';

async function debugDatabasePopulator() {
  console.log('🔍 Debug DatabasePopulator\n');
  
  try {
    const rm = new ResourceManager();
    await rm.initialize();
    
    // Create provider 
    const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
    
    // Clear data
    await provider.databaseService.mongoProvider.delete('modules', {});
    await provider.databaseService.mongoProvider.delete('tools', {});
    console.log('✅ Cleared existing data');
    
    // Create a DatabasePopulator with verbose logging
    const populator = new DatabasePopulator({
      verbose: true
    });
    await populator.initialize();
    console.log('✅ DatabasePopulator initialized');
    
    // Manually create a loaded module with instance (similar to what ModuleLoader would produce)
    const monorepoRoot = rm.get('env.MONOREPO_ROOT') || '/Users/maxximus/Documents/max/pocs/Legion';
    const modulePath = path.resolve(monorepoRoot, 'packages/tools-collection/src/calculator/CalculatorModule.js');
    
    console.log('\n🔧 Importing module...');
    const { default: CalculatorModule } = await import(modulePath);
    const moduleInstance = new CalculatorModule();
    console.log('✅ Module imported and instantiated');
    console.log('  Module name:', moduleInstance.name);
    console.log('  Tools available:', moduleInstance.getTools().length);
    
    // Create the module data structure that would come from ModuleLoader
    const modulesToPopulate = [{
      config: {
        name: 'Calculator',
        type: 'class',
        path: 'packages/tools-collection/src/calculator',
        className: 'CalculatorModule'
      },
      instance: moduleInstance
    }];
    
    console.log('\n📦 Testing DatabasePopulator.populate()...');
    
    const result = await populator.populate(modulesToPopulate, {
      clearExisting: false
    });
    
    console.log('\n📊 Populate Results:');
    console.log('  Modules saved:', result.modules.saved);
    console.log('  Modules failed:', result.modules.failed);
    console.log('  Tools saved:', result.tools.saved);
    console.log('  Tools failed:', result.tools.failed);
    
    // Check database state
    const finalModules = await provider.databaseService.mongoProvider.find('modules', {});
    const finalTools = await provider.databaseService.mongoProvider.find('tools', {});
    
    console.log('\n📊 Final Database State:');
    console.log(`  Modules: ${finalModules.length}`);
    console.log(`  Tools: ${finalTools.length}`);
    
    if (finalTools.length > 0) {
      console.log('\n✅ Success! Tools in database:');
      for (const tool of finalTools) {
        console.log(`  - ${tool.name}: ${tool.description.substring(0, 60)}...`);
      }
    } else {
      console.log('\n❌ No tools found in database');
    }
    
    await provider.disconnect();
    
  } catch (error) {
    console.error('\n❌ Critical error:', error.message);
    console.error('  Stack:', error.stack);
  }
}

debugDatabasePopulator().catch(console.error);