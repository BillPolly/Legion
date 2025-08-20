#!/usr/bin/env node

/**
 * Debug Module Validation Issues
 * 
 * Tests module validation to identify the exact issue
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function debugModuleValidation() {
  console.log('🔍 Debug Module Validation\n');
  
  try {
    const rm = new ResourceManager();
    await rm.initialize();
    
    const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
    
    // Clear modules
    await provider.databaseService.mongoProvider.delete('modules', {});
    console.log('✅ Cleared existing modules');
    
    // Test basic module structure that should pass validation
    const basicModule = {
      name: 'TestCalculator',
      type: 'class',
      path: 'packages/tools-collection/src/calculator',
      description: 'Test calculator module for validation testing - provides mathematical operations'
    };
    
    console.log('\n🧪 Testing basic module (minimal required fields):');
    console.log('  Fields provided:', Object.keys(basicModule));
    
    try {
      const result1 = await provider.databaseService.mongoProvider.insert('modules', basicModule);
      console.log('✅ Basic module insertion succeeded!');
      console.log('  ID:', result1.insertedIds[0]);
    } catch (error) {
      console.error('❌ Basic module insertion failed:', error.message);
      console.error('  Code:', error.code);
      if (error.errInfo) {
        console.error('  Details:', JSON.stringify(error.errInfo, null, 2));
      }
    }
    
    // Clear and test with more complete structure
    await provider.databaseService.mongoProvider.delete('modules', {});
    
    const completeModule = {
      name: 'TestCalculator',
      type: 'class', 
      path: 'packages/tools-collection/src/calculator',
      description: 'Test calculator module for validation testing - provides mathematical operations and calculations',
      className: 'CalculatorModule',
      filePath: 'packages/tools-collection/src/calculator/CalculatorModule.js',
      package: '@legion/tools-collection',
      tags: ['math', 'calculator'],
      category: 'utility',
      config: {},
      status: 'active',
      maintainer: { name: 'Test', email: 'test@example.com' },
      loadingStatus: 'pending',
      indexingStatus: 'pending', 
      validationStatus: 'pending',
      toolCount: parseInt(0),
      perspectiveCount: parseInt(0),
      lastLoadedAt: null,
      lastIndexedAt: null,
      loadingError: null,
      indexingError: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('\n🧪 Testing complete module (all fields):');
    console.log('  Fields provided:', Object.keys(completeModule).length);
    
    try {
      const result2 = await provider.databaseService.mongoProvider.insert('modules', completeModule);
      console.log('✅ Complete module insertion succeeded!');
      console.log('  ID:', result2.insertedIds[0]);
      
      // Now test tool with this module
      const toolData = {
        name: 'test_calculator',
        moduleId: result2.insertedIds[0],
        moduleName: 'TestCalculator', 
        description: 'Test calculator tool that performs mathematical operations'
      };
      
      console.log('\n🧪 Testing tool with valid module:');
      try {
        const toolResult = await provider.databaseService.mongoProvider.insert('tools', toolData);
        console.log('✅ Tool insertion succeeded!');
        console.log('  ID:', toolResult.insertedIds[0]);
      } catch (toolError) {
        console.error('❌ Tool insertion failed:', toolError.message);
        console.error('  Code:', toolError.code);
        if (toolError.errInfo) {
          console.error('  Details:', JSON.stringify(toolError.errInfo, null, 2));
        }
      }
      
    } catch (error) {
      console.error('❌ Complete module insertion failed:', error.message);
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

debugModuleValidation().catch(console.error);