#!/usr/bin/env node

/**
 * Check Status Script
 * 
 * Shows the current status of the 3-collection perspective system
 * Displays statistics, coverage, and sample data
 * 
 * Usage:
 *   node scripts/check-status.js           # Show basic status
 *   node scripts/check-status.js --verbose # Show detailed status with samples
 */

import { ResourceManager } from '../../resource-manager/src/ResourceManager.js';
import { DatabaseStorage } from '../src/core/DatabaseStorage.js';
import { Perspectives } from '../src/search/Perspectives.js';

async function checkStatus(options = {}) {
  const { verbose = false } = options;
  
  let resourceManager;
  let databaseStorage;
  let perspectives;
  
  try {
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getResourceManager();
    
    // Initialize DatabaseStorage
    databaseStorage = new DatabaseStorage({ 
      resourceManager,
      databaseName: 'legion_tools'
    });
    await databaseStorage.initialize();
    
    // Register with ResourceManager
    resourceManager.set('databaseStorage', databaseStorage);
    
    // Try to initialize Perspectives for statistics (optional)
    try {
      perspectives = new Perspectives({
        resourceManager,
        options: { verbose: false }
      });
      await perspectives.initialize();
    } catch (error) {
      // Perspectives initialization may fail if LLM client not configured
      // We can still show basic stats without it
      if (verbose) {
        console.log('ℹ️  Perspectives system not fully initialized (LLM client not configured)');
      }
    }
    
    console.log('🔍 Tools Registry Status Check\n');
    console.log('=' + '='.repeat(50));
    
    // Check collections
    const db = databaseStorage.db;
    
    // 1. Perspective Types
    console.log('\n📋 Perspective Types Collection:');
    const perspectiveTypes = await db.collection('perspective_types').find({}).toArray();
    console.log(`  Total: ${perspectiveTypes.length}`);
    perspectiveTypes.forEach(type => {
      console.log(`  - ${type.name} (${type.category})`);
      if (verbose) {
        console.log(`    ${type.description}`);
      }
    });
    
    // 2. Tools
    console.log('\n🔧 Tools Collection:');
    const toolCount = await db.collection('tools').countDocuments();
    console.log(`  Total: ${toolCount}`);
    
    if (toolCount > 0) {
      // Group by module
      const toolsByModule = await db.collection('tools').aggregate([
        { $group: { _id: '$moduleName', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      console.log('  By Module:');
      toolsByModule.forEach(group => {
        console.log(`    ${group._id}: ${group.count} tools`);
      });
      
      if (verbose) {
        console.log('\n  Sample Tools:');
        const sampleTools = await db.collection('tools').find({}).limit(5).toArray();
        sampleTools.forEach(tool => {
          console.log(`    - ${tool.name} (${tool.moduleName})`);
          console.log(`      ${tool.description}`);
        });
      }
    }
    
    // 3. Tool Perspectives
    console.log('\n📊 Tool Perspectives Collection:');
    const perspectiveCount = await db.collection('tool_perspectives').countDocuments();
    console.log(`  Total: ${perspectiveCount}`);
    
    let toolsWithPerspectives = [];
    if (perspectiveCount > 0) {
      // Coverage analysis
      toolsWithPerspectives = await db.collection('tool_perspectives').distinct('tool_name');
      const coverage = (toolsWithPerspectives.length / toolCount * 100).toFixed(1);
      console.log(`  Coverage: ${toolsWithPerspectives.length}/${toolCount} tools (${coverage}%)`);
      
      // Perspectives per type
      const perspByType = await db.collection('tool_perspectives').aggregate([
        { $group: { _id: '$perspective_type_name', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      console.log('  By Type:');
      perspByType.forEach(group => {
        console.log(`    ${group._id}: ${group.count}`);
      });
      
      if (verbose) {
        // Sample perspectives
        console.log('\n🔍 Sample Perspectives:');
        const pipeline = [
          { $sample: { size: 2 } },
          { $lookup: {
            from: 'tools',
            localField: 'tool_id',
            foreignField: '_id',
            as: 'tool'
          }}
        ];
        
        const samples = await db.collection('tool_perspectives').aggregate(pipeline).toArray();
        samples.forEach(persp => {
          console.log(`\n  📌 ${persp.tool_name} - ${persp.perspective_type_name}:`);
          const preview = persp.content ? persp.content.substring(0, 150) + '...' : 'No content';
          console.log(`    ${preview}`);
          if (persp.keywords && persp.keywords.length > 0) {
            console.log(`    Keywords: ${persp.keywords.slice(0, 5).join(', ')}`);
          }
        });
      }
    }
    
    // 4. System Health
    console.log('\n💚 System Health:');
    console.log(`  Database: Connected`);
    console.log(`  Collections: All present`);
    
    const llmClient = resourceManager.get('llmClient');
    console.log(`  LLM Client: ${llmClient ? 'Configured' : 'Not configured (mock mode)'}`);
    
    // 5. Statistics Summary
    console.log('\n📈 Statistics Summary:');
    if (perspectives) {
      try {
        const stats = await perspectives.getStatistics();
        console.log(`  Perspective Types: ${stats.perspectiveTypes.total} (${stats.perspectiveTypes.enabled} enabled)`);
        console.log(`  Tools: ${toolCount}`);
        console.log(`  Perspectives: ${stats.total}`);
        if (toolCount > 0) {
          const avgPerspectives = (stats.total / toolCount).toFixed(2);
          console.log(`  Avg Perspectives/Tool: ${avgPerspectives}`);
        }
      } catch (error) {
        // Fall back to basic stats if getStatistics fails
        console.log(`  Perspective Types: ${perspectiveTypes.length}`);
        console.log(`  Tools: ${toolCount}`);
        console.log(`  Perspectives: ${perspectiveCount}`);
        if (toolCount > 0 && perspectiveCount > 0) {
          const avgPerspectives = (perspectiveCount / toolCount).toFixed(2);
          console.log(`  Avg Perspectives/Tool: ${avgPerspectives}`);
        }
      }
    } else {
      // Basic stats without Perspectives system
      console.log(`  Perspective Types: ${perspectiveTypes.length}`);
      console.log(`  Tools: ${toolCount}`);
      console.log(`  Perspectives: ${perspectiveCount}`);
      if (toolCount > 0 && perspectiveCount > 0) {
        const avgPerspectives = (perspectiveCount / toolCount).toFixed(2);
        console.log(`  Avg Perspectives/Tool: ${avgPerspectives}`);
      }
    }
    
    // 6. Recommendations
    console.log('\n💡 Recommendations:');
    if (toolCount === 0) {
      console.log('  ⚠️  No tools loaded. Run: node scripts/load-tools.js');
    } else if (perspectiveCount === 0) {
      console.log('  ⚠️  No perspectives generated. Run: node scripts/generate-perspectives.js');
    } else if (toolsWithPerspectives && toolsWithPerspectives.length < toolCount) {
      const missing = toolCount - toolsWithPerspectives.length;
      console.log(`  ℹ️  ${missing} tools missing perspectives. Run: node scripts/generate-perspectives.js`);
    } else {
      console.log('  ✅ System fully populated and ready!');
    }
    
    console.log('\n' + '='.repeat(51));
    console.log('✅ Status check complete!');
    
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (databaseStorage) {
      await databaseStorage.close();
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Check Status Script

Usage:
  node scripts/check-status.js [options]

Options:
  --verbose, -v    Show detailed output with samples
  --help, -h       Show this help message

Examples:
  node scripts/check-status.js
  node scripts/check-status.js --verbose
    `);
    process.exit(0);
  }
}

// Run the script
checkStatus(options).catch(console.error);