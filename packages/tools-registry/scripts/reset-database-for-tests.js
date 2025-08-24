#!/usr/bin/env node

/**
 * Reset Database for Tests Script
 * 
 * Resets the database for integration testing by clearing tools and perspectives
 * but preserving the module registry (perspective_types collection).
 * This ensures a clean test environment while keeping the canonical perspective types.
 * 
 * Usage:
 *   node scripts/reset-database-for-tests.js           # Reset with confirmation
 *   node scripts/reset-database-for-tests.js --confirm # Reset without confirmation
 *   node scripts/reset-database-for-tests.js --verbose # Show detailed output
 */

import { ResourceManager } from '../../resource-manager/src/ResourceManager.js';
import { DatabaseStorage } from '../src/core/DatabaseStorage.js';

async function resetDatabaseForTests(options = {}) {
  const { confirm = false, verbose = false } = options;
  
  let resourceManager;
  let databaseStorage;
  
  try {
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getResourceManager();
    
    // Initialize DatabaseStorage
    databaseStorage = new DatabaseStorage({ 
      resourceManager,
      databaseName: 'legion_tools'
    });
    await databaseStorage.initialize();
    
    console.log('🧪 Database Reset for Integration Tests\n');
    console.log('=' + '='.repeat(50));
    
    // Show current state
    const db = databaseStorage.db;
    const perspectiveTypesCount = await db.collection('perspective_types').countDocuments();
    const toolsCount = await db.collection('tools').countDocuments();
    const perspectivesCount = await db.collection('tool_perspectives').countDocuments();
    
    console.log('\n📊 Current State:');
    console.log(`  Perspective Types: ${perspectiveTypesCount}`);
    console.log(`  Tools: ${toolsCount}`);
    console.log(`  Tool Perspectives: ${perspectivesCount}`);
    
    // Show what will be reset
    console.log('\n⚠️  This will reset:');
    console.log('  ✅ tools collection (will be cleared)');
    console.log('  ✅ tool_perspectives collection (will be cleared)');
    console.log('  ❌ perspective_types collection (will be PRESERVED)');
    
    if (perspectiveTypesCount === 0) {
      console.log('\n❌ ERROR: No perspective types found in database!');
      console.log('   Run: node scripts/reset-database.js --all');
      console.log('   to initialize the perspective types first.');
      process.exit(1);
    }
    
    // Confirm if not explicitly confirmed
    if (!confirm) {
      console.log('\n⏳ Press Ctrl+C to cancel, or wait 3 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Perform reset
    console.log('\n🧹 Resetting test collections...');
    
    // Clear tool perspectives
    const perspectivesResult = await db.collection('tool_perspectives').deleteMany({});
    console.log(`  ✅ Deleted ${perspectivesResult.deletedCount} tool perspectives`);
    
    // Clear tools
    const toolsResult = await db.collection('tools').deleteMany({});
    console.log(`  ✅ Deleted ${toolsResult.deletedCount} tools`);
    
    // Verify perspective types are intact
    const finalPerspectiveTypes = await db.collection('perspective_types').countDocuments();
    if (finalPerspectiveTypes !== perspectiveTypesCount) {
      console.log('  ❌ ERROR: Perspective types were unexpectedly modified!');
      process.exit(1);
    }
    console.log(`  ✅ Preserved ${finalPerspectiveTypes} perspective types`);
    
    // Show final state
    console.log('\n📊 Final State:');
    const finalToolsCount = await db.collection('tools').countDocuments();
    const finalPerspectivesCount = await db.collection('tool_perspectives').countDocuments();
    
    console.log(`  Perspective Types: ${finalPerspectiveTypes} (preserved)`);
    console.log(`  Tools: ${finalToolsCount} (cleared)`);
    console.log(`  Tool Perspectives: ${finalPerspectivesCount} (cleared)`);
    
    if (verbose) {
      console.log('\n🔍 Preserved Perspective Types:');
      const types = await db.collection('perspective_types').find({}).toArray();
      types.forEach(type => {
        console.log(`  - ${type.name} (${type.category})`);
      });
    }
    
    console.log('\n✅ Database reset for tests complete!');
    
    // Suggest next steps
    console.log('\n💡 Next Steps for Integration Testing:');
    console.log('  1. Load calculator module: node scripts/load-calculator-module.js');
    console.log('  2. Generate perspectives: node scripts/generate-real-perspectives.js');
    console.log('  3. Verify results: node scripts/verify-perspectives.js');
    
  } catch (error) {
    console.error('❌ Error resetting database for tests:', error.message);
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
  confirm: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--confirm' || args[i] === '-y') {
    options.confirm = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Reset Database for Tests Script

Usage:
  node scripts/reset-database-for-tests.js [options]

Options:
  --confirm, -y    Skip confirmation prompt
  --verbose, -v    Show detailed output
  --help, -h       Show this help message

Description:
  Resets the database for integration testing by clearing tools and perspectives
  but preserving the module registry (perspective_types collection).
  
  This ensures a clean test environment while keeping the canonical perspective 
  types needed for testing.

Examples:
  node scripts/reset-database-for-tests.js
  node scripts/reset-database-for-tests.js --confirm --verbose
    `);
    process.exit(0);
  }
}

// Run the script
resetDatabaseForTests(options).catch(console.error);