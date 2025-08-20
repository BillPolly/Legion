#!/usr/bin/env node

/**
 * Fix Schema Validation Issues
 * 
 * This script identifies and fixes the MongoDB schema validation issues
 * found in the tool registry collections.
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function fixSchemaValidationIssues() {
  console.log('🔧 Fixing MongoDB schema validation issues...\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
    enableSemanticSearch: false 
  });
  
  const results = {
    modulesFixed: 0,
    toolsFixed: 0,
    errors: []
  };
  
  try {
    // Fix modules collection issues - names not matching pattern ^[a-z0-9-]+$
    console.log('🔍 Finding modules with invalid names...');
    const invalidModules = await provider.databaseService.mongoProvider.find(
      'modules', 
      { name: { $not: /^[a-z0-9-]+$/ } }
    );
    
    console.log(`📋 Found ${invalidModules.length} modules with invalid names:`);
    for (const module of invalidModules) {
      console.log(`  - "${module.name}" (${module._id.toString().slice(-6)}...)`);
    }
    
    // Fix each invalid module name
    for (const module of invalidModules) {
      const originalName = module.name;
      // Convert to valid kebab-case: lowercase, replace underscores/spaces with hyphens
      let fixedName = originalName
        .toLowerCase()
        .replace(/[_\s]+/g, '-')  // Replace underscores and spaces with hyphens
        .replace(/[^a-z0-9-]/g, '') // Remove any other invalid characters
        .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '');    // Remove leading/trailing hyphens
      
      console.log(`🔧 Fixing module name: "${originalName}" → "${fixedName}"`);
      
      try {
        await provider.databaseService.mongoProvider.update(
          'modules',
          { _id: module._id },
          { 
            $set: { 
              name: fixedName,
              updatedAt: new Date()
            }
          }
        );
        
        // Also update any tools that reference this module by name
        const toolsToUpdate = await provider.databaseService.mongoProvider.find(
          'tools',
          { moduleName: originalName }
        );
        
        for (const tool of toolsToUpdate) {
          await provider.databaseService.mongoProvider.update(
            'tools',
            { _id: tool._id },
            { 
              $set: { 
                moduleName: fixedName,
                updatedAt: new Date()
              }
            }
          );
        }
        
        console.log(`  ✅ Fixed module and ${toolsToUpdate.length} associated tools`);
        results.modulesFixed++;
        
      } catch (error) {
        console.log(`  ❌ Failed to fix module "${originalName}": ${error.message}`);
        results.errors.push(`Module ${originalName}: ${error.message}`);
      }
    }
    
    console.log('');
    
    // Fix tools collection issues - invalid category values
    console.log('🔍 Finding tools with invalid categories...');
    const validCategories = ['read', 'write', 'create', 'delete', 'update', 'search', 'transform', 'validate', 'execute', 'generate', 'analyze'];
    
    const invalidTools = await provider.databaseService.mongoProvider.find(
      'tools',
      { category: { $nin: validCategories } }
    );
    
    console.log(`📋 Found ${invalidTools.length} tools with invalid categories:`);
    
    // Group by category to see what invalid categories exist
    const categoryGroups = {};
    for (const tool of invalidTools) {
      const category = tool.category || 'undefined';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(tool);
    }
    
    for (const [category, tools] of Object.entries(categoryGroups)) {
      console.log(`  - "${category}": ${tools.length} tools`);
    }
    
    // Map invalid categories to valid ones
    const categoryMapping = {
      'data-processing': 'transform',
      'data': 'transform',
      'utility': 'execute',
      'general': 'execute',
      'ai': 'generate',
      'filesystem': 'read',
      'network': 'read',
      'integration': 'execute',
      'development': 'generate',
      'testing': 'validate',
      'deployment': 'execute',
      'storage': 'write',
      'undefined': 'execute'
    };
    
    // Fix each tool with invalid category
    for (const tool of invalidTools) {
      const originalCategory = tool.category || 'undefined';
      const fixedCategory = categoryMapping[originalCategory] || 'execute'; // Default fallback
      
      console.log(`🔧 Fixing tool category: "${tool.name}" "${originalCategory}" → "${fixedCategory}"`);
      
      try {
        await provider.databaseService.mongoProvider.update(
          'tools',
          { _id: tool._id },
          { 
            $set: { 
              category: fixedCategory,
              updatedAt: new Date()
            }
          }
        );
        
        results.toolsFixed++;
        console.log(`  ✅ Fixed tool "${tool.name}"`);
        
      } catch (error) {
        console.log(`  ❌ Failed to fix tool "${tool.name}": ${error.message}`);
        results.errors.push(`Tool ${tool.name}: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('📊 RESULTS SUMMARY');
    console.log('=' + '='.repeat(30));
    console.log(`✅ Modules fixed: ${results.modulesFixed}`);
    console.log(`✅ Tools fixed: ${results.toolsFixed}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\nErrors encountered:');
      for (const error of results.errors) {
        console.log(`  - ${error}`);
      }
    }
    
    if (results.modulesFixed + results.toolsFixed > 0) {
      console.log('\n🎉 Schema validation issues have been fixed!');
      console.log('You can now run the debug script again to verify all issues are resolved.');
    } else {
      console.log('\n❓ No issues found to fix (they may have been fixed already).');
    }
    
  } catch (error) {
    console.error('❌ Error during schema validation fix:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.disconnect();
  }
  
  return results;
}

// Run the fix script
fixSchemaValidationIssues().catch(console.error);