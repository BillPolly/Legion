#!/usr/bin/env node

/**
 * Clear Tools Database Script
 * 
 * Clears all data from the tools database collections.
 * 
 * Usage:
 *   node scripts/clear-database.js                    # Clear all collections
 *   node scripts/clear-database.js --confirm          # Skip confirmation prompt
 *   node scripts/clear-database.js --collection tools # Clear specific collection
 */

import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';
import { SemanticSearchProvider } from '../../semantic-search/src/SemanticSearchProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import readline from 'readline';

async function askConfirmation(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

/**
 * Clear all databases (MongoDB and Qdrant) programmatically
 * @param {Object} options - Options for clearing
 * @param {boolean} options.verbose - Show detailed output
 * @returns {Promise<Object>} - Result with counts and collections cleared
 */
export async function clearAllDatabases(options = {}) {
  const { verbose = true } = options;
  
  if (verbose) {
    console.log('🗑️  CLEARING ALL DATABASE RECORDS');
    console.log('═'.repeat(50));
  }

  // Use LoadingManager for coordinated clearing
  const { LoadingManager } = await import('../src/loading/LoadingManager.js');
  const loadingManager = new LoadingManager({
    verbose: verbose
  });

  const result = await loadingManager.clearAll();
  
  // Clean up
  await loadingManager.close();

  return result;
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    confirm: args.includes('--confirm'),
    collection: null,
    verbose: args.includes('--verbose') || args.includes('-v')
  };
  
  // Check for specific collection
  const collectionIndex = args.indexOf('--collection');
  if (collectionIndex !== -1 && args[collectionIndex + 1]) {
    options.collection = args[collectionIndex + 1];
  }
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Tools Database Clear Script

Usage:
  node scripts/clear-database.js [options]

Options:
  --confirm              Skip confirmation prompt
  --collection <name>    Clear specific collection (modules, tools, tool_perspectives)
  --verbose, -v          Show detailed output
  --help, -h             Show this help message

Examples:
  node scripts/clear-database.js
  node scripts/clear-database.js --confirm
  node scripts/clear-database.js --collection tools
`);
    process.exit(0);
  }
  
  console.log('🧹 Tools Database Clear Script');
  console.log('═'.repeat(50));
  
  if (options.collection) {
    console.log(`Target: ${options.collection} collection only`);
  } else {
    console.log('Target: ALL collections (modules, tools, tool_perspectives)');
  }
  console.log('');
  
  // Confirmation prompt unless --confirm flag is used
  if (!options.confirm) {
    const confirmed = await askConfirmation('⚠️  This will permanently delete data. Continue? (y/N): ');
    if (!confirmed) {
      console.log('Operation cancelled.');
      process.exit(0);
    }
  }
  
  try {
    if (options.collection) {
      // Original single collection logic for backward compatibility
      console.log('🔧 Initializing database connection...');
      const rm = new ResourceManager();
      await rm.initialize();
      
      const provider = await MongoDBToolRegistryProvider.create(rm, { 
        enableSemanticSearch: false 
      });
      
      const db = provider.databaseService.mongoProvider.db;
      
      console.log('✅ Connected to database\n');
      console.log(`🗑️  Clearing ${options.collection} collection...`);
      
      const result = await db.collection(options.collection).deleteMany({});
      console.log(`   ✅ Deleted ${result.deletedCount} documents`);
      
      await provider.disconnect();
      
      console.log('\n' + '═'.repeat(50));
      console.log('✅ Database clear completed!');
      console.log(`   Total documents deleted: ${result.deletedCount}`);
      
      process.exit(0);
    } else {
      // Use the comprehensive clearAllDatabases function
      await clearAllDatabases({ verbose: true });
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Clear operation failed:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});