#!/usr/bin/env node

/**
 * Debug Loading Issues
 * 
 * Simple test to identify why modules aren't being populated from registry
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { LoadingManager } from './src/loading/LoadingManager.js';
import { ResourceManager } from '@legion/resource-manager';

async function debugLoading() {
  console.log('🔍 Debug Loading Issues\n');
  
  const rm = new ResourceManager();
  await rm.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
  
  // Clear modules first
  await provider.databaseService.mongoProvider.delete('modules', {});
  console.log('✅ Cleared existing modules');
  
  // Check what's in module_registry
  const registryModules = await provider.databaseService.mongoProvider.find('module_registry', {});
  console.log(`📋 Found ${registryModules.length} modules in registry`);
  
  // Find Calculator specifically
  const calcModule = registryModules.find(m => 
    m.name.toLowerCase().includes('calculator') || 
    (m.className && m.className.toLowerCase().includes('calculator'))
  );
  
  if (calcModule) {
    console.log('\n📦 Calculator module in registry:');
    console.log('  Name:', calcModule.name);
    console.log('  ClassName:', calcModule.className);
    console.log('  Type:', calcModule.type);
    console.log('  Path:', calcModule.path);
    console.log('  FilePath:', calcModule.filePath);
    console.log('  Loadable:', calcModule.loadable);
  } else {
    console.log('❌ No Calculator module found in registry');
    console.log('\nAvailable modules:');
    registryModules.slice(0, 5).forEach(m => {
      console.log(`  - ${m.name} (${m.className})`);
    });
    await provider.disconnect();
    return;
  }
  
  // Try to populate just this one module manually
  console.log('\n🔧 Manually populating Calculator module...');
  
  const runtimeModule = {
    name: calcModule.name,
    type: calcModule.type,
    path: calcModule.path,
    className: calcModule.className,
    filePath: calcModule.filePath,
    package: calcModule.package,
    dependencies: calcModule.dependencies || [],
    description: calcModule.description && calcModule.description.length >= 10 
      ? calcModule.description
      : `${calcModule.name} module provides mathematical computation tools`,
    tags: [],
    category: 'utility',
    config: {},
    status: 'active',
    maintainer: {},
    loadingStatus: 'pending',
    lastLoadedAt: null,
    loadingError: null,
    indexingStatus: 'pending',
    lastIndexedAt: null,
    indexingError: null,
    toolCount: parseInt(0),
    perspectiveCount: parseInt(0),
    validationStatus: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  console.log('\n📋 Runtime module structure:');
  console.log('  Required fields present:');
  console.log('    name:', !!runtimeModule.name);
  console.log('    description:', !!runtimeModule.description, `(${runtimeModule.description.length} chars)`);
  console.log('    type:', !!runtimeModule.type);
  console.log('    path:', !!runtimeModule.path);
  
  try {
    console.log('\n🚀 Attempting manual insertion...');
    const result = await provider.databaseService.mongoProvider.insert('modules', runtimeModule);
    console.log('✅ SUCCESS! Manual insertion worked');
    console.log('  Inserted ID:', result.insertedIds[0]);
    
    // Verify it's there
    const modules = await provider.databaseService.mongoProvider.find('modules', {});
    console.log(`✅ Verification: ${modules.length} modules now in runtime collection`);
    
  } catch (error) {
    console.error('❌ Manual insertion failed:');
    console.error('  Error:', error.message);
    console.error('  Code:', error.code);
    
    if (error.errInfo) {
      console.error('  Details:', JSON.stringify(error.errInfo, null, 2));
    }
  }
  
  // Now try with LoadingManager
  console.log('\n🔧 Testing LoadingManager.populateModulesFromRegistry...');
  
  // Clear again
  await provider.databaseService.mongoProvider.delete('modules', {});
  
  const loadingManager = new LoadingManager(provider.databaseService.mongoProvider, { verbose: true });
  
  try {
    const result = await loadingManager.populateModulesFromRegistry('Calculator');
    console.log('\n📊 LoadingManager Result:');
    console.log('  Populated:', result.populated);
    console.log('  Skipped:', result.skipped);
    console.log('  Failed:', result.failed);
    
  } catch (error) {
    console.error('❌ LoadingManager failed:', error.message);
  }
  
  await provider.disconnect();
}

debugLoading().catch(console.error);