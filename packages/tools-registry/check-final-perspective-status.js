#!/usr/bin/env node

/**
 * Check Final Perspective Status
 * 
 * Quick check to see how many tools still lack perspectives and why.
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function checkFinalStatus() {
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
    enableSemanticSearch: false 
  });
  
  try {
    // Check tools without perspectives
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
    
    const totalTools = await provider.databaseService.mongoProvider.count('tools', {});
    const totalPerspectives = await provider.databaseService.mongoProvider.count('tool_perspectives', {});
    const perspectiveTypes = await provider.databaseService.mongoProvider.count('perspective_types', { enabled: true });
    
    console.log('📊 PERSPECTIVE GENERATION STATUS');
    console.log('=' + '='.repeat(40));
    console.log(`Total Tools: ${totalTools}`);
    console.log(`Total Perspectives: ${totalPerspectives}`);
    console.log(`Perspective Types: ${perspectiveTypes}`);
    console.log(`\nTools without perspectives: ${toolsWithoutPerspectives.length}`);
    
    if (toolsWithoutPerspectives.length > 0) {
      console.log('\nTools still missing perspectives:');
      const byModule = {};
      for (const tool of toolsWithoutPerspectives) {
        const moduleName = tool.moduleName || 'unknown';
        if (!byModule[moduleName]) {
          byModule[moduleName] = 0;
        }
        byModule[moduleName]++;
      }
      
      for (const [moduleName, count] of Object.entries(byModule)) {
        console.log(`   ${moduleName}: ${count} tools`);
      }
    }
    
    console.log(`\nAverage perspectives per tool: ${(totalPerspectives / totalTools).toFixed(2)}`);
    console.log(`Theoretical maximum: ${totalTools * perspectiveTypes}`);
    console.log(`Coverage: ${((totalPerspectives / (totalTools * perspectiveTypes)) * 100).toFixed(1)}%`);
    
    // Check perspective type distribution
    console.log('\n📈 Perspective type distribution:');
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
    
    for (const stat of typeStats) {
      const percentage = ((stat.count / totalTools) * 100).toFixed(1);
      console.log(`   ${stat._id}: ${stat.count} (${percentage}% of tools)`);
    }
    
  } finally {
    await provider.disconnect();
  }
}

checkFinalStatus().catch(console.error);