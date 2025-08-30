#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import { ModuleDiscovery } from '../src/core/ModuleDiscovery.js';
import { ResourceManager } from '@legion/resource-manager';

async function testModuleValidation() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('legion_tools');

  // Get a sample module with its path
  const module = await db.collection('module-registry').findOne({name: 'FileOperationsModule'});
  if (!module) {
    console.log('Module not found');
    return;
  }
  
  console.log('Testing module validation for:', module.name);
  console.log('Path:', module.path);
  console.log();
  
  try {
    // Get ResourceManager singleton
    const resourceManager = await ResourceManager.getInstance();
    console.log('✅ ResourceManager initialized');
    
    // Create ModuleDiscovery with ResourceManager
    const discovery = new ModuleDiscovery({ 
      resourceManager: resourceManager,
      verbose: true
    });
    
    // Test the validation directly
    console.log('🔍 Testing module validation...');
    
    // Also test ModuleLoader directly to see why it might fail
    console.log('🔍 Testing ModuleLoader directly...');
    const { ModuleLoader } = await import('../src/core/ModuleLoader.js');
    const moduleLoader = new ModuleLoader({ resourceManager: resourceManager });
    
    try {
      const moduleInstance = await moduleLoader.loadModule(module.path);
      console.log('✅ ModuleLoader succeeded');
      console.log('Module name:', moduleInstance.name);
      console.log('Has getTools:', typeof moduleInstance.getTools);
      
      if (typeof moduleInstance.getTools === 'function') {
        const tools = moduleInstance.getTools();
        console.log('Tools count:', Array.isArray(tools) ? tools.length : 'not array');
      }
    } catch (moduleLoaderError) {
      console.log('❌ ModuleLoader failed:', moduleLoaderError.message);
      console.log('This is why validation falls back to direct import');
    }
    
    console.log();
    console.log('🔍 Running full validation...');
    const validationResult = await discovery.validateModule(module.path);
    
    console.log('✅ Validation completed');
    console.log('Valid:', validationResult.valid);
    console.log('Score:', validationResult.score);
    console.log('ToolsCount:', validationResult.toolsCount);
    console.log('Errors:', validationResult.errors);
    console.log('Warnings:', validationResult.warnings);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack.split('\n').slice(0, 8));
  }
  
  await client.close();
}

testModuleValidation().catch(console.error);