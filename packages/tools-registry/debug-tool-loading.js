#!/usr/bin/env node

/**
 * Debug Tool Loading Issues
 * 
 * Tests the complete pipeline: modules -> tools to identify validation errors
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { LoadingManager } from './src/loading/LoadingManager.js';
import { ResourceManager } from '@legion/resource-manager';

async function debugToolLoading() {
  console.log('🔍 Debug Tool Loading Issues\n');
  
  const rm = new ResourceManager();
  await rm.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
  const loadingManager = new LoadingManager(provider.databaseService.mongoProvider, { verbose: true });
  
  try {
    // Step 1: Clear and populate Calculator module
    console.log('📋 Step 1: Clear and populate Calculator module');
    console.log('-'.repeat(50));
    
    await provider.databaseService.mongoProvider.delete('modules', {});
    await provider.databaseService.mongoProvider.delete('tools', {});
    
    const moduleResult = await loadingManager.populateModulesFromRegistry('Calculator');
    console.log('Module population result:', {
      populated: moduleResult.populated,
      skipped: moduleResult.skipped,
      failed: moduleResult.failed
    });
    
    // Verify module is there
    const modules = await provider.databaseService.mongoProvider.find('modules', {});
    console.log(`✅ ${modules.length} modules now in database`);
    
    if (modules.length === 0) {
      console.error('❌ No modules populated, cannot continue');
      return;
    }
    
    const calcModule = modules[0];
    console.log('\n📦 Calculator module loaded:');
    console.log('  Name:', calcModule.name);
    console.log('  ID:', calcModule._id);
    console.log('  Type:', calcModule.type);
    console.log('  Path:', calcModule.path);
    console.log('  FilePath:', calcModule.filePath);
    
    // Step 2: Try to load tools from this module using loadModules
    console.log('\n📋 Step 2: Load tools from Calculator module');
    console.log('-'.repeat(50));
    
    const toolResult = await loadingManager.loadModules({
      module: 'Calculator',
      verbose: true,
      clearExisting: false
    });
    
    console.log('\n📊 Tool loading result:');
    console.log('  Tools loaded:', toolResult.toolsLoaded || 0);
    console.log('  Modules processed:', toolResult.modulesProcessed || 0);
    console.log('  Errors:', toolResult.errors?.length || 0);
    
    if (toolResult.errors?.length > 0) {
      console.log('\n❌ Tool loading errors:');
      for (const error of toolResult.errors) {
        console.log(`  - ${error}`);
      }
    }
    
    // Check what's actually in tools collection
    const tools = await provider.databaseService.mongoProvider.find('tools', {});
    console.log(`\n📊 Final count: ${tools.length} tools in database`);
    
    if (tools.length > 0) {
      console.log('\n✅ Tools successfully loaded:');
      for (const tool of tools.slice(0, 3)) {
        console.log(`  - ${tool.name}: ${tool.description?.substring(0, 50)}...`);
      }
    } else {
      console.log('❌ No tools loaded - investigating validation issues...');
      
      // Step 3: Try manual tool loading to see validation errors
      console.log('\n📋 Step 3: Manual tool loading test');
      console.log('-'.repeat(50));
      
      try {
        // Import the Calculator module directly
        const { default: CalculatorModule } = await import('../tools-collection/src/calculator/CalculatorModule.js');
        const calculatorInstance = new CalculatorModule();
        
        console.log('✅ Calculator module imported and instantiated');
        
        if (calculatorInstance.getTools) {
          const moduleTools = calculatorInstance.getTools();
          console.log(`✅ Found ${moduleTools.length} tools from module`);
          
          // Try to save the first tool manually
          if (moduleTools.length > 0) {
            const firstTool = moduleTools[0];
            console.log(`\n🔧 Testing manual insertion of '${firstTool.name}':`);
            
            const toolDoc = {
              name: firstTool.name,
              moduleId: calcModule._id,
              moduleName: calcModule.name,
              description: firstTool.description || 'Calculator tool for mathematical operations',
              summary: firstTool.summary || 'Mathematical calculator',
              tags: firstTool.tags || ['math', 'calculator'],
              category: firstTool.category || 'generate',
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            console.log('Tool document structure:');
            console.log('  name:', toolDoc.name, '(type:', typeof toolDoc.name, ')');
            console.log('  moduleId:', toolDoc.moduleId, '(type:', typeof toolDoc.moduleId, ')');
            console.log('  description length:', toolDoc.description.length);
            console.log('  description valid:', toolDoc.description.length >= 10 && toolDoc.description.length <= 1000);
            
            // Test pattern matching for name
            const namePattern = /^[a-z0-9_]+$/;
            console.log('  name pattern match:', namePattern.test(toolDoc.name));
            
            try {
              const result = await provider.databaseService.mongoProvider.insert('tools', toolDoc);
              console.log('✅ Manual tool insertion succeeded!');
              console.log('  Inserted ID:', result.insertedIds[0]);
            } catch (error) {
              console.error('❌ Manual tool insertion failed:');
              console.error('  Error:', error.message);
              console.error('  Code:', error.code);
              
              if (error.errInfo) {
                console.error('  Details:', JSON.stringify(error.errInfo, null, 2));
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Manual loading failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Critical error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.disconnect();
  }
}

debugToolLoading().catch(console.error);