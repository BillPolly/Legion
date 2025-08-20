#!/usr/bin/env node

/**
 * Debug Tool Insertion
 * 
 * Tests tool insertion to identify exact validation issues
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function debugToolInsertion() {
  console.log('🔍 Debug Tool Insertion\n');
  
  try {
    const rm = new ResourceManager();
    await rm.initialize();
    
    const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
    
    // Clear data
    await provider.databaseService.mongoProvider.delete('modules', {});
    await provider.databaseService.mongoProvider.delete('tools', {});
    console.log('✅ Cleared existing data');
    
    // Insert a working module first
    const moduleData = {
      name: 'Calculator',
      type: 'class',
      path: 'packages/tools-collection/src/calculator',
      description: 'Calculator module provides mathematical computation tools and operations'
    };
    
    const moduleResult = await provider.databaseService.mongoProvider.insert('modules', moduleData);
    const moduleId = moduleResult.insertedIds[0];
    console.log('✅ Module inserted successfully, ID:', moduleId);
    
    // Now test tool insertion with minimum required fields
    const basicTool = {
      name: 'calculator',
      moduleId: moduleId,
      description: 'Calculator tool that performs basic mathematical operations like addition, subtraction, multiplication'
    };
    
    console.log('\n🧪 Testing basic tool (minimal required fields):');
    console.log('  Fields provided:', Object.keys(basicTool));
    
    try {
      const result1 = await provider.databaseService.mongoProvider.insert('tools', basicTool);
      console.log('✅ Basic tool insertion succeeded!');
      console.log('  ID:', result1.insertedIds[0]);
    } catch (error) {
      console.error('❌ Basic tool insertion failed:', error.message);
      console.error('  Code:', error.code);
      if (error.errInfo) {
        console.error('  Details:', JSON.stringify(error.errInfo, null, 2));
      }
    }
    
    // Clear and test with complete structure
    await provider.databaseService.mongoProvider.delete('tools', {});
    
    const completeTool = {
      name: 'calculator',
      moduleId: moduleId,
      moduleName: 'Calculator',
      description: 'Calculator tool that performs basic mathematical operations like addition, subtraction, multiplication and division'
    };
    
    console.log('\n🧪 Testing complete tool (with moduleName):');
    console.log('  Fields provided:', Object.keys(completeTool));
    
    try {
      const result2 = await provider.databaseService.mongoProvider.insert('tools', completeTool);
      console.log('✅ Complete tool insertion succeeded!');
      console.log('  ID:', result2.insertedIds[0]);
    } catch (error) {
      console.error('❌ Complete tool insertion failed:', error.message);
      console.error('  Code:', error.code);
      if (error.errInfo) {
        console.error('  Details:', JSON.stringify(error.errInfo, null, 2));
      }
    }
    
    await provider.disconnect();
    
  } catch (error) {
    console.error('\n❌ Critical error:', error.message);
    console.error('  Stack:', error.stack);
  }
}

debugToolInsertion().catch(console.error);