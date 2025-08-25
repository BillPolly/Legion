#!/usr/bin/env node

/**
 * Clear Database Script
 * 
 * Clears all data from the tool registry system including:
 * - MongoDB collections (tools, modules, perspectives, etc.)
 * - Qdrant vector store
 * - Any cached data
 * 
 * Usage:
 *   node scripts/clear-database.js           # Clear with confirmation prompt
 *   node scripts/clear-database.js --force   # Clear without confirmation
 */

import toolRegistry from '../src/index.js';
import readline from 'readline';

async function clearDatabase(options = {}) {
  const { force = false, verbose = false, includeRegistry = false } = options;
  
  try {
    // Get ToolRegistry singleton
    // toolRegistry is already the initialized singleton instance
    
    // Get current status before clearing
    const statusBefore = await toolRegistry.getSystemStatus();
    
    console.log('\n⚠️  WARNING: This will clear data from the tool registry!');
    console.log('\nCurrent data that will be deleted:');
    console.log(`  • ${statusBefore.collections.modules || 0} loaded modules`);
    console.log(`  • ${statusBefore.collections.tools || 0} tools`);
    console.log(`  • ${statusBefore.collections.toolPerspectives || 0} tool perspectives`);
    console.log(`  • ${statusBefore.collections.perspectiveTypes || 0} perspective types`);
    if (includeRegistry) {
      console.log(`  • ${statusBefore.collections.moduleRegistry || 0} discovered modules (registry)`);
    }
    
    // Ask for confirmation unless --force is used
    if (!force) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('\nAre you sure you want to clear all data? (yes/no): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('❌ Clear operation cancelled');
        process.exit(0);
      }
    }
    
    console.log('\n🗑️  Clearing data...');
    
    // Clear all data using the ToolRegistry method
    const result = await toolRegistry.clearAllData({ 
      verbose, 
      includeRegistry 
    });
    
    // Show results
    console.log('\n✅ Data cleared successfully!');
    console.log('\nDeleted:');
    if (result.mongodb) {
      console.log(`  • MongoDB collections: ${Object.keys(result.mongodb).length}`);
      for (const [collection, count] of Object.entries(result.mongodb)) {
        console.log(`    - ${collection}: ${count} documents`);
      }
    }
    if (result.qdrant) {
      console.log(`  • Qdrant collections: ${result.qdrant.collections?.length || 0}`);
    }
    if (result.cache) {
      console.log(`  • Cached items: ${result.cache.cleared || 0}`);
    }
    
    // Verify everything is cleared
    const statusAfter = await toolRegistry.getSystemStatus();
    console.log('\nVerification:');
    console.log(`  • Modules remaining: ${statusAfter.collections.modules || 0}`);
    console.log(`  • Tools remaining: ${statusAfter.collections.tools || 0}`);
    console.log(`  • Perspectives remaining: ${statusAfter.collections.toolPerspectives || 0}`);
    
    if ((statusAfter.collections.modules || 0) === 0 && 
        (statusAfter.collections.tools || 0) === 0 && 
        (statusAfter.collections.toolPerspectives || 0) === 0) {
      console.log('\n✅ All data successfully cleared!');
    } else {
      console.log('\n⚠️  Some data may not have been cleared completely');
    }
    
    // Exit successfully
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  force: false,
  verbose: false,
  includeRegistry: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--force' || args[i] === '-f') {
    options.force = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--include-registry' || args[i] === '-r') {
    options.includeRegistry = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Clear Database Script

Usage:
  node scripts/clear-database.js [options]

Options:
  --force, -f            Skip confirmation prompt
  --include-registry, -r Include module-registry (discovered modules) in clear
  --verbose, -v          Show detailed output
  --help, -h             Show this help message

Examples:
  node scripts/clear-database.js
  node scripts/clear-database.js --force
  node scripts/clear-database.js --force --include-registry
  node scripts/clear-database.js --force --verbose
    `);
    process.exit(0);
  }
}

// Run the script
clearDatabase(options).catch(console.error);