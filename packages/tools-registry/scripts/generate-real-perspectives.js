#!/usr/bin/env node

/**
 * Generate Real Perspectives Script
 * 
 * Generates perspectives using a REAL LLM client (not mock mode) for integration testing.
 * This script requires ANTHROPIC_API_KEY to be configured in the environment.
 * 
 * Usage:
 *   node scripts/generate-real-perspectives.js           # Generate for all tools
 *   node scripts/generate-real-perspectives.js --verbose # Show detailed output
 *   node scripts/generate-real-perspectives.js --tool calculator # Generate for specific tool
 */

import { ResourceManager } from '../../resource-manager/src/ResourceManager.js';
import { DatabaseStorage } from '../src/core/DatabaseStorage.js';
import { Perspectives } from '../src/search/Perspectives.js';

async function generateRealPerspectives(options = {}) {
  const { verbose = false, toolName = null } = options;
  
  let resourceManager;
  let databaseStorage;
  let perspectives;
  let llmClient;
  
  try {
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getResourceManager();
    
    // Check for ANTHROPIC_API_KEY
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      console.error('❌ ERROR: ANTHROPIC_API_KEY not found!');
      console.error('');
      console.error('This script requires a real LLM client for integration testing.');
      console.error('Please ensure ANTHROPIC_API_KEY is set in your .env file.');
      console.error('');
      console.error('Example:');
      console.error('  ANTHROPIC_API_KEY=sk-ant-api03-...');
      process.exit(1);
    }
    
    // Create LLM client
    console.log('🤖 Creating LLM client...');
    try {
      llmClient = await resourceManager.createLLMClient();
      console.log('  ✅ LLM client configured successfully');
    } catch (error) {
      console.error('❌ ERROR: Failed to create LLM client:', error.message);
      process.exit(1);
    }
    
    // Register LLM client with ResourceManager
    resourceManager.set('llmClient', llmClient);
    
    // Initialize DatabaseStorage
    databaseStorage = new DatabaseStorage({ 
      resourceManager,
      databaseName: 'legion_tools'
    });
    await databaseStorage.initialize();
    
    // Register with ResourceManager
    resourceManager.set('databaseStorage', databaseStorage);
    
    console.log('🚀 Generate Real Perspectives for Integration Tests\n');
    console.log('=' + '='.repeat(60));
    
    // Initialize Perspectives system (NOT in mock mode)
    perspectives = new Perspectives({
      resourceManager,
      options: { verbose, mockMode: false } // Explicitly disable mock mode
    });
    await perspectives.initialize();
    
    // Verify we're not in mock mode
    if (perspectives.mockMode) {
      console.error('❌ ERROR: Perspectives system is in mock mode!');
      console.error('This should not happen with a configured LLM client.');
      process.exit(1);
    }
    
    console.log('  ✅ Perspectives system initialized in REAL LLM mode');
    
    // Check current state
    const stats = await perspectives.getStatistics();
    console.log('\n📊 Current Statistics:');
    console.log(`  Perspective Types: ${stats.perspectiveTypes.total} (${stats.perspectiveTypes.enabled} enabled)`);
    console.log(`  Tools: ${await databaseStorage.db.collection('tools').countDocuments()}`);
    console.log(`  Existing Perspectives: ${stats.total}`);
    
    // Verify we have tools to work with
    const db = databaseStorage.db;
    const toolsQuery = toolName ? { name: toolName } : {};
    const availableTools = await db.collection('tools').find(toolsQuery).toArray();
    
    if (availableTools.length === 0) {
      console.error(`❌ ERROR: No tools found${toolName ? ` matching '${toolName}'` : ''}!`);
      console.error('');
      if (toolName) {
        console.error('Available tools:');
        const allTools = await db.collection('tools').find({}).toArray();
        allTools.forEach(tool => {
          console.error(`  - ${tool.name}`);
        });
      } else {
        console.error('Run: node scripts/load-calculator-module.js');
      }
      process.exit(1);
    }
    
    console.log(`\n🎯 Generating perspectives for ${availableTools.length} tool(s) using REAL LLM...`);
    
    // Generate perspectives
    let results = [];
    let totalGenerated = 0;
    
    for (const tool of availableTools) {
      console.log(`\n📝 Processing tool: ${tool.name}`);
      
      // Check if perspectives already exist
      const existingPerspectives = await db.collection('tool_perspectives')
        .find({ tool_name: tool.name })
        .toArray();
      
      if (existingPerspectives.length > 0) {
        console.log(`  ⚠️  Found ${existingPerspectives.length} existing perspectives`);
        console.log('  🔄 Regenerating with force option...');
      }
      
      try {
        // Generate perspectives with real LLM
        if (verbose) {
          console.log('  🤖 Calling LLM to generate all perspective types...');
        }
        
        const toolPerspectives = await perspectives.generatePerspectivesForTool(tool.name, {
          forceRegenerate: true // Always regenerate for testing
        });
        
        results.push(...toolPerspectives);
        totalGenerated += toolPerspectives.length;
        
        console.log(`  ✅ Generated ${toolPerspectives.length} perspectives`);
        
        if (verbose) {
          toolPerspectives.forEach(p => {
            console.log(`    - ${p.perspective_type_name}: ${p.content.substring(0, 80)}...`);
          });
        }
        
      } catch (error) {
        console.error(`  ❌ Failed to generate perspectives for ${tool.name}: ${error.message}`);
        if (verbose) {
          console.error(`    ${error.stack}`);
        }
      }
    }
    
    console.log(`\n📈 Generation Complete:`);
    console.log(`  Total Generated: ${totalGenerated} perspectives`);
    console.log(`  Tools Processed: ${availableTools.length}`);
    
    // Show sample generated content
    if (results.length > 0 && verbose) {
      console.log('\n🔍 Sample Generated Content:');
      const sample = results.slice(0, 2);
      sample.forEach(persp => {
        console.log(`\n📌 ${persp.tool_name} - ${persp.perspective_type_name}:`);
        console.log(`  Content: ${persp.content.substring(0, 200)}...`);
        if (persp.keywords && persp.keywords.length > 0) {
          console.log(`  Keywords: ${persp.keywords.join(', ')}`);
        }
        console.log(`  Batch ID: ${persp.batch_id}`);
        console.log(`  Generated: ${persp.generated_at}`);
      });
    }
    
    // Final statistics
    const finalStats = await perspectives.getStatistics();
    console.log('\n📊 Final Statistics:');
    console.log(`  Total Perspectives: ${finalStats.total}`);
    console.log(`  Coverage: ${JSON.stringify(finalStats.coverage)}`);
    
    if (finalStats.byModule && Object.keys(finalStats.byModule).length > 0) {
      console.log('\n  By Module:');
      Object.entries(finalStats.byModule).forEach(([module, count]) => {
        console.log(`    ${module}: ${count} perspectives`);
      });
    }
    
    console.log('\n✅ Real LLM perspective generation complete!');
    
    // Suggest next steps
    console.log('\n💡 Next Steps:');
    console.log('  1. Verify results: node scripts/verify-perspectives.js --verbose');
    console.log('  2. Check status: node scripts/check-status.js --verbose');
    
  } catch (error) {
    console.error('❌ Error generating real perspectives:', error.message);
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
  verbose: false,
  toolName: null
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--tool' && args[i + 1]) {
    options.toolName = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Generate Real Perspectives Script

Usage:
  node scripts/generate-real-perspectives.js [options]

Options:
  --verbose, -v    Show detailed output including sample content
  --tool <name>    Generate perspectives for specific tool (default: all tools)
  --help, -h       Show this help message

Description:
  Generates perspectives using a REAL LLM client for integration testing.
  
  Requirements:
  - ANTHROPIC_API_KEY must be configured in .env file
  - Tools must be loaded in database (run load-calculator-module.js first)
  - Perspective types must be initialized in database
  
  This script will:
  - Create a real Anthropic LLM client
  - Generate ALL perspective types in a single LLM call per tool
  - Store perspectives with proper batch IDs and metadata
  - Provide detailed verification of generated content

Examples:
  node scripts/generate-real-perspectives.js
  node scripts/generate-real-perspectives.js --verbose
  node scripts/generate-real-perspectives.js --tool calculator --verbose
    `);
    process.exit(0);
  }
}

// Run the script
generateRealPerspectives(options).catch(console.error);