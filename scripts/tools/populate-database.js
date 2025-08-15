#!/usr/bin/env node

/**
 * Populate Tool Database Script
 * 
 * Discovers and populates the tool database with all modules and tools
 * in the Legion framework. Supports both clear and update modes.
 */

import { ComprehensiveToolDiscovery } from '../../packages/tools/src/discovery/ComprehensiveToolDiscovery.js';
import { MongoDBToolRegistryProvider } from '../../packages/tools/src/providers/MongoDBToolRegistryProvider.js';
import { ToolRegistry } from '../../packages/tools/src/integration/ToolRegistry.js';
import { ResourceManager } from '@legion/tools-registry';

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.includes('--update') ? 'update' : 'clear';
const verbose = !args.includes('--quiet');
const includeEmbeddings = args.includes('--embeddings');
const testExecution = args.includes('--test');
const clearOnly = args.includes('--clear-only');

// Get module name from first argument if provided
const moduleFilter = args.find(arg => !arg.startsWith('--')) || args.find(arg => arg.startsWith('--module='))?.split('=')[1];

async function main() {
  console.log('🔧 Legion Tool Database Population');
  console.log(`📍 Mode: ${mode.toUpperCase()}`);
  console.log(`🔊 Verbose: ${verbose ? 'ON' : 'OFF'}`);
  if (moduleFilter) console.log(`🎯 Module Filter: ${moduleFilter}`);
  if (includeEmbeddings) console.log('🤖 Embeddings: ENABLED');
  if (testExecution) console.log('🧪 Tool Testing: ENABLED');
  if (clearOnly) console.log('🗑️ Clear Only Mode');
  console.log('');

  try {
    // Initialize ResourceManager first for clear operations
    const rm = new ResourceManager();
    await rm.initialize();
    
    const provider = await MongoDBToolRegistryProvider.create(rm, { 
      enableSemanticSearch: false 
    });

    // Clear database if requested
    if (clearOnly) {
      console.log('🗑️ Clearing database only...\n');
      await provider.databaseService.mongoProvider.delete('modules', {});
      await provider.databaseService.mongoProvider.delete('tools', {});
      console.log('✅ Database cleared');
      
      const stats = await provider.getStats();
      console.log(`Database now has ${stats.modules} modules and ${stats.tools} tools`);
      return;
    }

    // Step 1: Populate database
    console.log('📦 Step 1: Discovering and populating tools...\n');
    
    const discovery = new ComprehensiveToolDiscovery();
    const results = await discovery.populateDatabase({
      mode,
      verbose,
      includeEmbeddings,
      moduleFilter
    });

    console.log('\n📊 Population Summary:');
    console.log(`  Modules discovered: ${results.modulesDiscovered}`);
    console.log(`  Modules added: ${results.modulesAdded}`);
    console.log(`  Tools discovered: ${results.toolsDiscovered}`);
    console.log(`  Tools added: ${results.toolsAdded}`);
    
    if (results.modulesFailed || results.toolsFailed) {
      console.log(`  Modules failed: ${results.modulesFailed || 0}`);
      console.log(`  Tools failed: ${results.toolsFailed || 0}`);
    }

    // Step 2: Verify database
    if (verbose) {
      console.log('\n📋 Step 2: Verifying database contents...\n');
      
      const stats = await provider.getStats();
      console.log(`Database contains ${stats.modules} modules and ${stats.tools} tools`);
      
      // List actual tools in database
      const tools = await provider.listTools({ limit: 10 });
      if (tools.length > 0) {
        console.log('\n🔧 Sample tools in database:');
        for (const tool of tools) {
          console.log(`  - ${tool.name} (from ${tool.moduleName})`);
        }
      }
    }

    // Step 3: Test tool execution
    if (testExecution && results.toolsAdded > 0) {
      console.log('\n🧪 Step 3: Testing tool execution...\n');
      
      const toolRegistry = new ToolRegistry({ provider });
      await toolRegistry.initialize();
      
      // Get the first few actual tools from the database instead of hardcoded names
      const tools = await provider.listTools({ limit: 5 });
      const testTools = tools.map(t => t.name);
      
      console.log(`Testing ${testTools.length} tools: ${testTools.join(', ')}\n`);
      
      for (const toolName of testTools) {
        try {
          const tool = await toolRegistry.getTool(toolName);
          if (tool && typeof tool.execute === 'function') {
            console.log(`✅ ${toolName}: Available and executable`);
          } else {
            console.log(`❌ ${toolName}: ${tool ? 'Not executable' : 'Not found'}`);
          }
        } catch (error) {
          console.log(`❌ ${toolName}: Error - ${error.message}`);
        }
      }
    }

    console.log('\n✅ Database population completed successfully!');
    
  } catch (error) {
    console.error('❌ Population failed:', error.message);
    if (verbose) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Show usage if --help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Legion Tool Database Population Script

Usage:
  node scripts/tools/populate-database.js [module-name] [options]

Arguments:
  module-name     Optional module name to process only that module (e.g., json, calculator)

Options:
  --update        Use update mode (incremental) instead of clear mode
  --quiet         Suppress verbose output
  --embeddings    Generate embeddings for semantic search
  --test          Test tool execution after population
  --clear-only    Only clear the database, don't populate
  --help, -h      Show this help message

Examples:
  node scripts/tools/populate-database.js              # Clear and repopulate all modules
  node scripts/tools/populate-database.js json         # Load only json module
  node scripts/tools/populate-database.js calculator --test # Load calculator module and test
  node scripts/tools/populate-database.js --clear-only # Clear database only
  node scripts/tools/populate-database.js --update     # Incremental update all modules
`);
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
});