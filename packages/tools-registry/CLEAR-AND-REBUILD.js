#!/usr/bin/env node

/**
 * CLEAR AND REBUILD DATABASE PROPERLY
 * 
 * This script:
 * 1. Completely drops all collections
 * 2. Clears Qdrant
 * 3. Rebuilds with REAL tools only (no duplicates, no test data)
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import { LoadingManager } from './src/loading/LoadingManager.js';

async function clearAndRebuild() {
  console.log('🚨 COMPLETE DATABASE CLEAR AND REBUILD\n');
  console.log('This will:');
  console.log('  1. DROP all tool registry collections');
  console.log('  2. CLEAR Qdrant vector database');
  console.log('  3. Rebuild with REAL tools only\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
    enableSemanticSearch: true 
  });
  
  try {
    console.log('Step 1: DROPPING ALL COLLECTIONS');
    console.log('=' + '='.repeat(50));
    
    const db = provider.databaseService.mongoProvider.db;
    
    // Drop all tool registry collections
    const collections = ['modules', 'tools', 'tool_perspectives', 'perspective_types'];
    
    for (const collName of collections) {
      try {
        await db.dropCollection(collName);
        console.log(`  ✅ Dropped collection: ${collName}`);
      } catch (error) {
        if (error.codeName === 'NamespaceNotFound') {
          console.log(`  ⚠️  Collection ${collName} doesn't exist`);
        } else {
          console.log(`  ❌ Error dropping ${collName}: ${error.message}`);
        }
      }
    }
    
    console.log('\nStep 2: CLEARING QDRANT');
    console.log('=' + '='.repeat(50));
    
    try {
      // Clear Qdrant if it exists
      if (provider.vectorStore) {
        const collections = await provider.vectorStore.listCollections();
        if (collections.includes('tool_vectors')) {
          await provider.vectorStore.deleteCollection('tool_vectors');
          console.log('  ✅ Deleted Qdrant collection: tool_vectors');
        }
        
        // Recreate it
        await provider.vectorStore.createCollection('tool_vectors', {
          size: 768,
          distance: 'Cosine'
        });
        console.log('  ✅ Recreated Qdrant collection with proper dimensions');
      } else {
        console.log('  ⚠️  Vector store not available');
      }
    } catch (error) {
      console.log(`  ⚠️  Qdrant clear: ${error.message}`);
    }
    
    console.log('\nStep 3: REINITIALIZING COLLECTIONS');
    console.log('=' + '='.repeat(50));
    
    // Create a new provider to reinitialize collections
    await provider.disconnect();
    const newProvider = await MongoDBToolRegistryProvider.create(resourceManager, { 
      enableSemanticSearch: true 
    });
    
    console.log('  ✅ Collections recreated with proper schemas');
    
    // The collections are created automatically, now seed perspective types
    const perspectiveTypes = await newProvider.databaseService.mongoProvider.count('perspective_types', {});
    if (perspectiveTypes === 0) {
      // Manually seed perspective types
      const defaultTypes = [
        {
          type: 'name',
          name: 'Tool Name',
          description: 'The exact name of the tool for direct lookup',
          condition: 'always',
          textTemplate: '${name}',
          priority: 1,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'description',
          name: 'Tool Description',
          description: 'The detailed description of what the tool does',
          condition: 'has_description',
          textTemplate: '${description}',
          priority: 2,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'task',
          name: 'Task-oriented',
          description: 'What task or job this tool can accomplish',
          condition: 'always',
          textTemplate: 'Tool ${name} that ${description}',
          priority: 3,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'category',
          name: 'Category-based',
          description: 'Tool categorized by its primary operation type',
          condition: 'always',
          textTemplate: '${category} tool ${name}',
          priority: 4,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'inputs',
          name: 'Input-focused',
          description: 'Tool described by its input parameters',
          condition: 'has_input_schema',
          textTemplate: '${name} tool that takes ${inputDescription}',
          priority: 5,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'capabilities',
          name: 'Capabilities',
          description: 'Tool described by its capabilities',
          condition: 'has_capabilities',
          textTemplate: '${name} can ${capabilities}',
          priority: 6,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'capability_single',
          name: 'Single Capability',
          description: 'Individual capability perspective',
          condition: 'has_capabilities',
          textTemplate: '${name} ${capability}',
          priority: 7,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'gloss',
          name: 'Natural Language Gloss',
          description: 'Natural language description of the tool',
          condition: 'always',
          textTemplate: '${glossDescription}',
          priority: 8,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'examples',
          name: 'Usage Examples',
          description: 'Tool described through usage examples',
          condition: 'has_examples',
          textTemplate: '${name} example: ${exampleDescription}',
          priority: 9,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      for (const type of defaultTypes) {
        await newProvider.databaseService.mongoProvider.insert('perspective_types', type);
      }
      console.log(`  ✅ Seeded ${defaultTypes.length} perspective types`);
    }
    
    // Use the new provider for the rest
    provider = newProvider;
    console.log('  ✅ Perspective types seeded');
    
    console.log('\nStep 4: LOADING REAL TOOLS ONLY');
    console.log('=' + '='.repeat(50));
    
    // Use LoadingManager to load tools properly
    const loadingManager = new LoadingManager(provider);
    
    // Load tools from the filesystem (no duplicates!)
    const result = await loadingManager.loadAllModules({
      clearExisting: false, // We already cleared
      verbose: false,
      skipTest: true, // Skip test modules
      includeEmbeddings: true,
      includePerspectives: true
    });
    
    console.log('\n📊 LOADING RESULTS:');
    console.log(`  Modules loaded: ${result.modulesLoaded}`);
    console.log(`  Tools loaded: ${result.toolsLoaded}`);
    console.log(`  Perspectives generated: ${result.perspectivesGenerated || 0}`);
    console.log(`  Vectors indexed: ${result.vectorsIndexed || 0}`);
    
    // Final verification
    console.log('\nStep 5: FINAL VERIFICATION');
    console.log('=' + '='.repeat(50));
    
    const finalCounts = {
      modules: await provider.databaseService.mongoProvider.count('modules', {}),
      tools: await provider.databaseService.mongoProvider.count('tools', {}),
      perspectives: await provider.databaseService.mongoProvider.count('tool_perspectives', {}),
      perspectiveTypes: await provider.databaseService.mongoProvider.count('perspective_types', { enabled: true })
    };
    
    console.log('📊 Final Database State:');
    console.log(`  Modules: ${finalCounts.modules}`);
    console.log(`  Tools: ${finalCounts.tools}`);
    console.log(`  Perspectives: ${finalCounts.perspectives}`);
    console.log(`  Enabled Perspective Types: ${finalCounts.perspectiveTypes}`);
    
    if (finalCounts.tools > 0) {
      console.log(`  Average perspectives per tool: ${(finalCounts.perspectives / finalCounts.tools).toFixed(2)}`);
    }
    
    // Check for duplicates
    const duplicateCheck = await provider.databaseService.mongoProvider.aggregate('tools', [
      {
        $group: {
          _id: '$name',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    if (duplicateCheck.length > 0) {
      console.log('\n⚠️  WARNING: Still have duplicate tools!');
      for (const dup of duplicateCheck) {
        console.log(`  - ${dup._id}: ${dup.count} copies`);
      }
    } else {
      console.log('\n✅ No duplicate tools - database is clean!');
    }
    
    console.log('\n🎉 DATABASE REBUILD COMPLETE!\n');
    
  } catch (error) {
    console.error('❌ Error during rebuild:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.disconnect();
  }
}

// Run with confirmation
console.log('⚠️  WARNING: This will DELETE all data and rebuild from scratch!');
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
  clearAndRebuild().catch(console.error);
}, 3000);