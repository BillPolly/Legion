#!/usr/bin/env node

/**
 * Regenerate Missing Perspectives
 * 
 * This script identifies tools without perspectives and regenerates them.
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolIndexer } from './src/search/ToolIndexer.js';

async function regenerateMissingPerspectives() {
  console.log('🔧 Regenerating missing perspectives...\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
    enableSemanticSearch: true 
  });
  
  try {
    // Create ToolIndexer
    const toolIndexer = await ToolIndexer.createForTools(resourceManager);
    
    // Find tools without perspectives
    console.log('🔍 Finding tools without perspectives...');
    const toolsWithoutPerspectives = await provider.databaseService.mongoProvider.aggregate('tools', [
      {
        $lookup: {
          from: 'tool_perspectives',
          localField: '_id',
          foreignField: 'toolId',
          as: 'perspectives'
        }
      },
      {
        $match: {
          'perspectives': { $size: 0 }
        }
      }
    ]);
    
    console.log(`📋 Found ${toolsWithoutPerspectives.length} tools without perspectives\n`);
    
    if (toolsWithoutPerspectives.length === 0) {
      console.log('✅ All tools have perspectives!');
      return;
    }
    
    // Group by module for better visibility
    const byModule = {};
    for (const tool of toolsWithoutPerspectives) {
      const moduleName = tool.moduleName || 'unknown';
      if (!byModule[moduleName]) {
        byModule[moduleName] = [];
      }
      byModule[moduleName].push(tool);
    }
    
    console.log('📊 Tools without perspectives by module:');
    for (const [moduleName, tools] of Object.entries(byModule)) {
      console.log(`   ${moduleName}: ${tools.length} tools`);
    }
    
    console.log('\n🔄 Regenerating perspectives for these tools...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const tool of toolsWithoutPerspectives) {
      try {
        console.log(`   Processing: ${tool.name} (${tool._id.toString().slice(-6)}...)`);
        
        // Create minimal metadata for the tool
        const metadata = {
          category: tool.category || 'general',
          tags: tool.tags || [],
          module: tool.moduleName
        };
        
        // Index the tool (this generates perspectives)
        const result = await toolIndexer.indexTool(tool, metadata, tool._id);
        
        if (result.success) {
          console.log(`   ✅ Generated ${result.perspectivesIndexed} perspectives for ${tool.name}`);
          successCount++;
        } else {
          console.log(`   ❌ Failed to generate perspectives for ${tool.name}`);
          failCount++;
        }
        
      } catch (error) {
        console.log(`   ❌ Error processing ${tool.name}: ${error.message}`);
        failCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 REGENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully processed: ${successCount} tools`);
    console.log(`❌ Failed: ${failCount} tools`);
    
    // Check final status
    console.log('\n🔍 Checking final perspective counts...');
    
    const totalTools = await provider.databaseService.mongoProvider.count('tools', {});
    const totalPerspectives = await provider.databaseService.mongoProvider.count('tool_perspectives', {});
    const perspectiveTypes = await provider.databaseService.mongoProvider.count('perspective_types', { enabled: true });
    
    console.log(`\n📊 Final Database State:`);
    console.log(`   Total Tools: ${totalTools}`);
    console.log(`   Total Perspectives: ${totalPerspectives}`);
    console.log(`   Perspective Types: ${perspectiveTypes}`);
    console.log(`   Average Perspectives per Tool: ${(totalPerspectives / totalTools).toFixed(2)}`);
    console.log(`   Coverage: ${((totalPerspectives / (totalTools * perspectiveTypes)) * 100).toFixed(1)}%`);
    
    // Check if any tools still missing perspectives
    const stillMissing = await provider.databaseService.mongoProvider.aggregate('tools', [
      {
        $lookup: {
          from: 'tool_perspectives',
          localField: '_id',
          foreignField: 'toolId',
          as: 'perspectives'
        }
      },
      {
        $match: {
          'perspectives': { $size: 0 }
        }
      },
      {
        $count: 'count'
      }
    ]);
    
    const missingCount = stillMissing[0]?.count || 0;
    
    if (missingCount > 0) {
      console.log(`\n⚠️  Still ${missingCount} tools without perspectives`);
    } else {
      console.log(`\n✅ All tools now have perspectives!`);
    }
    
  } catch (error) {
    console.error('❌ Error during regeneration:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.disconnect();
  }
}

// Run the regeneration
regenerateMissingPerspectives().catch(console.error);