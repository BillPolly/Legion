#!/usr/bin/env node

/**
 * Debug Incremental Validation
 * 
 * Adds fields one by one to identify which field causes validation failure
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function debugIncrementalValidation() {
  console.log('🔍 Debug Incremental Validation\n');
  
  try {
    const rm = new ResourceManager();
    await rm.initialize();
    
    const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
    
    // Start with the basic working module
    let testModule = {
      name: 'TestCalculator',
      type: 'class',
      path: 'packages/tools-collection/src/calculator',
      description: 'Test calculator module for validation testing - provides mathematical operations'
    };
    
    // Fields to add incrementally
    const fieldsToTest = [
      { field: 'className', value: 'CalculatorModule' },
      { field: 'filePath', value: 'packages/tools-collection/src/calculator/CalculatorModule.js' },
      { field: 'package', value: '@legion/tools-collection' },
      { field: 'tags', value: ['math', 'calculator'] },
      { field: 'category', value: 'utility' },
      { field: 'config', value: {} },
      { field: 'status', value: 'active' },
      { field: 'maintainer', value: { name: 'Test', email: 'test@example.com' } },
      { field: 'loadingStatus', value: 'pending' },
      { field: 'indexingStatus', value: 'pending' },
      { field: 'validationStatus', value: 'pending' },
      { field: 'toolCount', value: parseInt(0) },
      { field: 'perspectiveCount', value: parseInt(0) },
      { field: 'lastLoadedAt', value: null },
      { field: 'lastIndexedAt', value: null },
      { field: 'loadingError', value: null },
      { field: 'indexingError', value: null },
      { field: 'createdAt', value: new Date() },
      { field: 'updatedAt', value: new Date() }
    ];
    
    console.log('✅ Starting with basic module that works...\n');
    
    for (let i = 0; i < fieldsToTest.length; i++) {
      const { field, value } = fieldsToTest[i];
      
      // Clear collection
      await provider.databaseService.mongoProvider.delete('modules', {});
      
      // Add the next field
      testModule[field] = value;
      
      console.log(`🧪 Test ${i + 1}: Adding field '${field}' (${typeof value})`);
      console.log(`  Total fields: ${Object.keys(testModule).length}`);
      
      try {
        const result = await provider.databaseService.mongoProvider.insert('modules', testModule);
        console.log(`  ✅ SUCCESS - Field '${field}' is valid`);
      } catch (error) {
        console.error(`  ❌ FAILED - Field '${field}' causes validation error:`);
        console.error(`    Error: ${error.message}`);
        console.error(`    Code: ${error.code}`);
        if (error.errInfo) {
          console.error(`    Details:`, JSON.stringify(error.errInfo, null, 2));
        }
        
        // Remove the problematic field and continue
        delete testModule[field];
        console.error(`  🔄 Removed problematic field and continuing...`);
      }
      
      console.log();
    }
    
    console.log('📊 Final working module structure:');
    console.log('  Fields:', Object.keys(testModule));
    console.log('  Field count:', Object.keys(testModule).length);
    
    await provider.disconnect();
    
  } catch (error) {
    console.error('\n❌ Critical error:', error.message);
    console.error('  Stack:', error.stack);
  }
}

debugIncrementalValidation().catch(console.error);