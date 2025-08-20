#!/usr/bin/env node

/**
 * Analyze Perspective Generation
 * 
 * This script analyzes why we're not generating all expected perspectives
 * and shows which perspective types are being skipped for which tools.
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function analyzePerspectiveGeneration() {
  console.log('🔍 Analyzing perspective generation patterns...\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
    enableSemanticSearch: false 
  });
  
  try {
    // Get all perspective types
    const perspectiveTypes = await provider.databaseService.mongoProvider.find(
      'perspective_types',
      { enabled: true },
      { sort: { priority: 1 } }
    );
    
    console.log(`📋 Found ${perspectiveTypes.length} enabled perspective types:\n`);
    
    // Analyze each perspective type
    const typeAnalysis = {};
    
    for (const pType of perspectiveTypes) {
      console.log(`\n🔍 Analyzing perspective type: "${pType.type}"`);
      console.log(`   Name: ${pType.name}`);
      console.log(`   Condition: ${pType.condition}`);
      console.log(`   Template: ${pType.textTemplate}`);
      
      // Count how many perspectives of this type exist
      const count = await provider.databaseService.mongoProvider.count(
        'tool_perspectives',
        { perspectiveType: pType.type }
      );
      
      console.log(`   Generated: ${count} perspectives`);
      
      typeAnalysis[pType.type] = {
        name: pType.name,
        condition: pType.condition,
        count: count,
        expectedMax: 768, // Total tools
        coverage: ((count / 768) * 100).toFixed(1) + '%'
      };
    }
    
    // Get total tools and perspectives
    const toolCount = await provider.databaseService.mongoProvider.count('tools', {});
    const perspectiveCount = await provider.databaseService.mongoProvider.count('tool_perspectives', {});
    
    // Sample some tools to see what they're missing
    console.log('\n📊 Sampling tools to check their properties...\n');
    
    const sampleTools = await provider.databaseService.mongoProvider.find(
      'tools',
      {},
      { limit: 10 }
    );
    
    for (const tool of sampleTools) {
      console.log(`\n🔧 Tool: ${tool.name}`);
      console.log(`   Has description: ${!!(tool.description && tool.description.trim())}`);
      console.log(`   Has capabilities: ${!!(tool.capabilities && Array.isArray(tool.capabilities) && tool.capabilities.length > 0)}`);
      console.log(`   Has examples: ${!!(tool.examples && Array.isArray(tool.examples) && tool.examples.length > 0)}`);
      console.log(`   Has inputSchema: ${!!(tool.inputSchema && tool.inputSchema.properties)}`);
      
      // Count perspectives for this tool
      const toolPerspectives = await provider.databaseService.mongoProvider.find(
        'tool_perspectives',
        { toolId: tool._id }
      );
      
      console.log(`   Perspectives generated: ${toolPerspectives.length}`);
      console.log(`   Types: ${toolPerspectives.map(p => p.perspectiveType).join(', ')}`);
    }
    
    // Summary report
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERSPECTIVE GENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tools: ${toolCount}`);
    console.log(`Total Perspective Types: ${perspectiveTypes.length}`);
    console.log(`Expected Max Perspectives: ${toolCount * perspectiveTypes.length}`);
    console.log(`Actual Perspectives: ${perspectiveCount}`);
    console.log(`Coverage: ${((perspectiveCount / (toolCount * perspectiveTypes.length)) * 100).toFixed(1)}%`);
    
    console.log('\n📈 Perspective Type Coverage:');
    console.log('Type'.padEnd(20) + 'Condition'.padEnd(25) + 'Count'.padEnd(10) + 'Coverage');
    console.log('-'.repeat(70));
    
    for (const [type, analysis] of Object.entries(typeAnalysis)) {
      console.log(
        type.padEnd(20) + 
        analysis.condition.padEnd(25) + 
        analysis.count.toString().padEnd(10) + 
        analysis.coverage
      );
    }
    
    // Identify the problem
    console.log('\n⚠️  ISSUES IDENTIFIED:');
    
    const alwaysTypes = Object.entries(typeAnalysis)
      .filter(([_, a]) => a.condition === 'always')
      .map(([type, _]) => type);
    
    const expectedAlwaysCount = alwaysTypes.length * toolCount;
    const actualAlwaysCount = alwaysTypes.reduce((sum, type) => sum + typeAnalysis[type].count, 0);
    
    if (actualAlwaysCount < expectedAlwaysCount) {
      console.log(`❌ "always" condition perspectives are missing!`);
      console.log(`   Expected: ${expectedAlwaysCount} (${alwaysTypes.length} types × ${toolCount} tools)`);
      console.log(`   Actual: ${actualAlwaysCount}`);
      console.log(`   Missing: ${expectedAlwaysCount - actualAlwaysCount}`);
    }
    
    // Check for tools without any perspectives
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
      },
      {
        $project: {
          name: 1,
          moduleName: 1
        }
      }
    ]);
    
    if (toolsWithoutPerspectives.length > 0) {
      console.log(`\n❌ Found ${toolsWithoutPerspectives.length} tools with NO perspectives:`);
      for (const tool of toolsWithoutPerspectives.slice(0, 10)) {
        console.log(`   - ${tool.name} (module: ${tool.moduleName})`);
      }
      if (toolsWithoutPerspectives.length > 10) {
        console.log(`   ... and ${toolsWithoutPerspectives.length - 10} more`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.disconnect();
  }
}

// Run the analysis
analyzePerspectiveGeneration().catch(console.error);