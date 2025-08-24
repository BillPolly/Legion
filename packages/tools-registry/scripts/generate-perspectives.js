#!/usr/bin/env node

/**
 * Generate Perspectives Script
 * 
 * Generates perspectives for tools using the 3-collection architecture
 * Generates ALL perspective types for each tool in a single LLM call
 * 
 * Usage:
 *   node scripts/generate-perspectives.js                     # Generate for all tools
 *   node scripts/generate-perspectives.js --tool read_file    # Generate for specific tool
 *   node scripts/generate-perspectives.js --module FileModule # Generate for module
 *   node scripts/generate-perspectives.js --force            # Force regeneration
 */

import { ResourceManager } from '../../resource-manager/src/ResourceManager.js';
import { DatabaseStorage } from '../src/core/DatabaseStorage.js';
import { Perspectives } from '../src/search/Perspectives.js';

async function generatePerspectives(options = {}) {
  const { toolName, moduleName, force = false, verbose = false, dryRun = false } = options;
  
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
    
    // Check if LLM client is available
    const llmClient = resourceManager.get('llmClient');
    if (!llmClient && !dryRun) {
      console.warn('⚠️  No LLM client configured. Using mock generation mode.');
    }
    
    // Initialize Perspectives
    perspectives = new Perspectives({
      resourceManager,
      options: { verbose }
    });
    await perspectives.initialize();
    
    console.log('🚀 Starting perspective generation...\n');
    
    // Check current state
    const stats = await perspectives.getStatistics();
    console.log('📊 Current Statistics:');
    console.log(`  Perspective Types: ${stats.perspectiveTypes.total}`);
    console.log(`  Tools: ${await databaseStorage.db.collection('tools').countDocuments()}`);
    console.log(`  Existing Perspectives: ${stats.total}`);
    console.log('');
    
    let results = [];
    
    if (toolName) {
      // Generate for specific tool
      console.log(`🎯 Generating perspectives for tool: ${toolName}`);
      
      if (dryRun) {
        console.log('  [DRY RUN] Would generate perspectives');
      } else {
        const toolPerspectives = await perspectives.generatePerspectivesForTool(toolName, {
          forceRegenerate: force
        });
        results = toolPerspectives;
        console.log(`  ✅ Generated ${toolPerspectives.length} perspectives`);
      }
      
    } else if (moduleName) {
      // Generate for module
      console.log(`📦 Generating perspectives for module: ${moduleName}`);
      
      if (dryRun) {
        const tools = await databaseStorage.findTools({ moduleName });
        console.log(`  [DRY RUN] Would generate perspectives for ${tools.length} tools`);
      } else {
        const modulePerspectives = await perspectives.generateForModule(moduleName, {
          forceRegenerate: force,
          useBatch: true
        });
        results = modulePerspectives;
        console.log(`  ✅ Generated ${modulePerspectives.length} perspectives`);
      }
      
    } else {
      // Generate for all tools
      console.log('🌐 Generating perspectives for all tools...');
      
      if (dryRun) {
        const toolCount = await databaseStorage.db.collection('tools').countDocuments();
        const perspectiveTypes = await databaseStorage.db.collection('perspective_types').countDocuments();
        console.log(`  [DRY RUN] Would generate ${toolCount * perspectiveTypes} perspectives`);
      } else {
        const allResults = await perspectives.generateAll({
          forceRegenerate: force
        });
        console.log(`\n📈 Generation Complete:`);
        console.log(`  Generated: ${allResults.generated}`);
        console.log(`  Skipped: ${allResults.skipped}`);
        console.log(`  Failed: ${allResults.failed}`);
        
        if (allResults.failures && allResults.failures.length > 0) {
          console.log('\n⚠️  Failures:');
          allResults.failures.forEach(f => {
            console.log(`  - ${f.toolName}: ${f.error}`);
          });
        }
      }
    }
    
    // Show sample perspectives if any were generated
    if (results.length > 0 && verbose) {
      console.log('\n🔍 Sample Generated Perspectives:');
      const sample = results.slice(0, 2);
      sample.forEach(persp => {
        console.log(`\n📌 ${persp.tool_name} - ${persp.perspective_type_name}:`);
        console.log(`  ${persp.content.substring(0, 200)}...`);
        if (persp.keywords && persp.keywords.length > 0) {
          console.log(`  Keywords: ${persp.keywords.join(', ')}`);
        }
      });
    }
    
    // Final statistics
    if (!dryRun) {
      const finalStats = await perspectives.getStatistics();
      console.log('\n📊 Final Statistics:');
      console.log(`  Total Perspectives: ${finalStats.total}`);
      console.log(`  Coverage: ${JSON.stringify(finalStats.coverage)}`);
      
      if (finalStats.byModule && Object.keys(finalStats.byModule).length > 0) {
        console.log('\n  By Module:');
        Object.entries(finalStats.byModule).forEach(([module, count]) => {
          console.log(`    ${module}: ${count}`);
        });
      }
    }
    
    console.log('\n✅ Perspective generation complete!');
    
  } catch (error) {
    console.error('❌ Error generating perspectives:', error.message);
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
  toolName: null,
  moduleName: null,
  force: false,
  verbose: false,
  dryRun: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tool' && args[i + 1]) {
    options.toolName = args[i + 1];
    i++;
  } else if (args[i] === '--module' && args[i + 1]) {
    options.moduleName = args[i + 1];
    i++;
  } else if (args[i] === '--force') {
    options.force = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--dry-run') {
    options.dryRun = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Generate Perspectives Script

Usage:
  node scripts/generate-perspectives.js [options]

Options:
  --tool <name>    Generate perspectives for specific tool
  --module <name>  Generate perspectives for all tools in module
  --force          Force regeneration even if perspectives exist
  --verbose, -v    Show detailed output
  --dry-run        Show what would be generated without doing it
  --help, -h       Show this help message

Examples:
  node scripts/generate-perspectives.js
  node scripts/generate-perspectives.js --tool read_file
  node scripts/generate-perspectives.js --module FileModule --force
  node scripts/generate-perspectives.js --verbose --dry-run
    `);
    process.exit(0);
  }
}

// Run the script
generatePerspectives(options).catch(console.error);