#!/usr/bin/env node

/**
 * Audit Database Contents
 * 
 * Shows what's actually in the database and identifies duplicates/test data
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function auditDatabase() {
  console.log('🔍 Auditing database contents...\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
    enableSemanticSearch: false 
  });
  
  try {
    // Get all tools grouped by module
    const toolsByModule = await provider.databaseService.mongoProvider.aggregate('tools', [
      {
        $group: {
          _id: '$moduleName',
          count: { $sum: 1 },
          tools: { $push: '$name' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    console.log('📊 TOOLS BY MODULE:');
    console.log('=' + '='.repeat(50));
    
    let totalTools = 0;
    for (const module of toolsByModule) {
      console.log(`\n${module._id}: ${module.count} tools`);
      totalTools += module.count;
      
      // Show first few tool names
      if (module.count <= 5) {
        for (const toolName of module.tools) {
          console.log(`  - ${toolName}`);
        }
      } else {
        for (const toolName of module.tools.slice(0, 3)) {
          console.log(`  - ${toolName}`);
        }
        console.log(`  ... and ${module.count - 3} more`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`TOTAL TOOLS: ${totalTools}`);
    console.log('='.repeat(50));
    
    // Check for duplicate tool names
    console.log('\n🔍 Checking for duplicate tool names...');
    const duplicates = await provider.databaseService.mongoProvider.aggregate('tools', [
      {
        $group: {
          _id: '$name',
          count: { $sum: 1 },
          modules: { $push: '$moduleName' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} duplicate tool names:`);
      for (const dup of duplicates) {
        console.log(`  - "${dup._id}" appears ${dup.count} times in modules: ${dup.modules.join(', ')}`);
      }
    } else {
      console.log('✅ No duplicate tool names found');
    }
    
    // Check for test modules
    console.log('\n🔍 Checking for test/example modules...');
    const testModules = await provider.databaseService.mongoProvider.find('modules', {
      $or: [
        { name: { $regex: 'test', $options: 'i' } },
        { name: { $regex: 'example', $options: 'i' } },
        { name: { $regex: 'demo', $options: 'i' } },
        { name: { $regex: 'sample', $options: 'i' } }
      ]
    });
    
    if (testModules.length > 0) {
      console.log(`\n⚠️  Found ${testModules.length} potential test/example modules:`);
      for (const module of testModules) {
        const toolCount = await provider.databaseService.mongoProvider.count('tools', { moduleName: module.name });
        console.log(`  - ${module.name}: ${toolCount} tools`);
      }
    }
    
    // Show actual file system check
    console.log('\n🔍 Let me check how many actual tool modules exist in the filesystem...');
    console.log('   (This would need to scan packages/tools/src/* directories)');
    
    // Get unique counts
    const uniqueModules = await provider.databaseService.mongoProvider.count('modules', {});
    const uniqueTools = await provider.databaseService.mongoProvider.count('tools', {});
    const perspectives = await provider.databaseService.mongoProvider.count('tool_perspectives', {});
    
    console.log('\n📊 DATABASE SUMMARY:');
    console.log('=' + '='.repeat(50));
    console.log(`Modules: ${uniqueModules}`);
    console.log(`Tools: ${uniqueTools}`);
    console.log(`Perspectives: ${perspectives}`);
    console.log(`Average perspectives per tool: ${(perspectives / uniqueTools).toFixed(2)}`);
    
    if (uniqueTools > 200) {
      console.log('\n⚠️  WARNING: ${uniqueTools} tools seems excessive!');
      console.log('   The database likely contains:');
      console.log('   - Duplicate entries from multiple runs');
      console.log('   - Test data that wasn\'t cleaned');
      console.log('   - Old data from previous schema versions');
      console.log('\n   🔧 Recommendation: Clear and rebuild the database with only real tools');
    }
    
  } catch (error) {
    console.error('❌ Error during audit:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.disconnect();
  }
}

auditDatabase().catch(console.error);