#!/usr/bin/env node

/**
 * Fix Perspective Issues
 * 
 * 1. Remove inappropriate "synonyms" perspectives (tools have fixed names!)
 * 2. Check for tools with empty input schemas more thoroughly
 * 3. Remove "inputs" perspectives for tools with no actual input properties
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function fixPerspectiveIssues() {
  console.log('🔧 Fixing perspective generation issues...\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
    enableSemanticSearch: true 
  });
  
  try {
    // First, let's check tools with empty or minimal input schemas more thoroughly
    console.log('🔍 Checking for tools with empty or minimal input schemas...');
    
    const allTools = await provider.databaseService.mongoProvider.find('tools', {}, { limit: 1000 });
    
    const emptySchemaTools = [];
    const minimalSchemaTools = [];
    
    for (const tool of allTools) {
      if (tool.inputSchema) {
        const props = tool.inputSchema.properties;
        if (!props || Object.keys(props).length === 0) {
          emptySchemaTools.push(tool);
        } else if (Object.keys(props).length === 1 && !tool.inputSchema.required?.length) {
          minimalSchemaTools.push(tool);
        }
      }
    }
    
    console.log(`\n📊 Schema Analysis:`);
    console.log(`  Tools with NO input properties: ${emptySchemaTools.length}`);
    console.log(`  Tools with minimal schemas (1 optional prop): ${minimalSchemaTools.length}`);
    
    if (emptySchemaTools.length > 0) {
      console.log('\n📋 Tools with NO input properties:');
      for (const tool of emptySchemaTools.slice(0, 10)) {
        console.log(`  - ${tool.name} (${tool.moduleName})`);
      }
      if (emptySchemaTools.length > 10) {
        console.log(`  ... and ${emptySchemaTools.length - 10} more`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Remove inappropriate "synonyms" perspectives
    console.log('\n🗑️  Removing inappropriate "synonyms" perspectives...');
    console.log('   (Tools have fixed names and don\'t need name variations!)\n');
    
    // Count before deletion
    const synonymCount = await provider.databaseService.mongoProvider.count(
      'tool_perspectives',
      { perspectiveType: 'synonyms' }
    );
    
    console.log(`   Found ${synonymCount} synonym perspectives to remove`);
    
    if (synonymCount > 0) {
      // Also need to remove from Qdrant
      console.log('   Removing from Qdrant vector database...');
      
      // Get all synonym perspective IDs
      const synonymPerspectives = await provider.databaseService.mongoProvider.find(
        'tool_perspectives',
        { perspectiveType: 'synonyms' },
        { projection: { embeddingId: 1 } }
      );
      
      const embeddingIds = synonymPerspectives
        .map(p => p.embeddingId)
        .filter(id => id); // Filter out null/undefined
      
      if (embeddingIds.length > 0) {
        try {
          // Delete from Qdrant
          const deleteResult = await provider.vectorStore.deleteVectors(embeddingIds);
          console.log(`   ✅ Deleted ${embeddingIds.length} vectors from Qdrant`);
        } catch (error) {
          console.log(`   ⚠️  Error deleting from Qdrant: ${error.message}`);
        }
      }
      
      // Delete from MongoDB
      const deleteResult = await provider.databaseService.mongoProvider.db
        .collection('tool_perspectives')
        .deleteMany({ perspectiveType: 'synonyms' });
      
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} synonym perspectives from MongoDB`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Disable the "synonyms" perspective type
    console.log('\n🔧 Disabling "synonyms" perspective type...');
    
    const updateResult = await provider.databaseService.mongoProvider.update(
      'perspective_types',
      { type: 'synonyms' },
      { 
        $set: { 
          enabled: false,
          updatedAt: new Date(),
          disabledReason: 'Tools have fixed names and do not need name variations'
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log('   ✅ Disabled "synonyms" perspective type');
    } else {
      console.log('   ⚠️  Could not find or disable "synonyms" perspective type');
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Check for tools that have "inputs" perspectives but no actual inputs
    if (emptySchemaTools.length > 0) {
      console.log('\n🔍 Checking for inappropriate "inputs" perspectives on no-arg tools...');
      
      const toolIds = emptySchemaTools.map(t => t._id);
      
      const inappropriateInputsPerspectives = await provider.databaseService.mongoProvider.find(
        'tool_perspectives',
        {
          toolId: { $in: toolIds },
          perspectiveType: 'inputs'
        }
      );
      
      console.log(`   Found ${inappropriateInputsPerspectives.length} "inputs" perspectives for no-arg tools`);
      
      if (inappropriateInputsPerspectives.length > 0) {
        console.log('\n   Sample inappropriate perspectives:');
        for (const persp of inappropriateInputsPerspectives.slice(0, 3)) {
          console.log(`     - ${persp.toolName}: "${persp.perspectiveText}"`);
        }
        
        console.log('\n   🗑️  Removing these inappropriate perspectives...');
        
        // Get embedding IDs
        const embeddingIds = inappropriateInputsPerspectives
          .map(p => p.embeddingId)
          .filter(id => id);
        
        if (embeddingIds.length > 0) {
          try {
            await provider.vectorStore.deleteVectors(embeddingIds);
            console.log(`   ✅ Deleted ${embeddingIds.length} vectors from Qdrant`);
          } catch (error) {
            console.log(`   ⚠️  Error deleting from Qdrant: ${error.message}`);
          }
        }
        
        // Delete from MongoDB
        const deleteResult = await provider.databaseService.mongoProvider.db
          .collection('tool_perspectives')
          .deleteMany({
            toolId: { $in: toolIds },
            perspectiveType: 'inputs'
          });
        
        console.log(`   ✅ Deleted ${deleteResult.deletedCount} inappropriate "inputs" perspectives`);
      }
    }
    
    // Final status check
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL STATUS');
    console.log('='.repeat(60));
    
    const totalTools = await provider.databaseService.mongoProvider.count('tools', {});
    const totalPerspectives = await provider.databaseService.mongoProvider.count('tool_perspectives', {});
    const enabledTypes = await provider.databaseService.mongoProvider.count('perspective_types', { enabled: true });
    
    console.log(`Total Tools: ${totalTools}`);
    console.log(`Total Perspectives: ${totalPerspectives}`);
    console.log(`Enabled Perspective Types: ${enabledTypes}`);
    console.log(`Average Perspectives per Tool: ${(totalPerspectives / totalTools).toFixed(2)}`);
    
    // Check perspective type distribution
    const typeStats = await provider.databaseService.mongoProvider.aggregate('tool_perspectives', [
      {
        $group: {
          _id: '$perspectiveType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    console.log('\n📈 Perspective type distribution:');
    for (const stat of typeStats) {
      const percentage = ((stat.count / totalTools) * 100).toFixed(1);
      console.log(`   ${stat._id}: ${stat.count} (${percentage}% of tools)`);
    }
    
    console.log('\n✅ Perspective issues fixed!');
    console.log('   - Removed inappropriate "synonyms" perspectives');
    console.log('   - Disabled "synonyms" perspective type');
    if (emptySchemaTools.length > 0) {
      console.log('   - Identified tools with no input properties');
    }
    
  } catch (error) {
    console.error('❌ Error during fix:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.disconnect();
  }
}

fixPerspectiveIssues().catch(console.error);