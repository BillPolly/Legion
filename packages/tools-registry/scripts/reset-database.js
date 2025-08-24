#!/usr/bin/env node

/**
 * Reset Database Script
 * 
 * Resets the database to a clean state
 * Can reset all collections or specific ones
 * 
 * Usage:
 *   node scripts/reset-database.js                  # Reset everything
 *   node scripts/reset-database.js --perspectives   # Reset only perspectives
 *   node scripts/reset-database.js --tools         # Reset only tools
 */

import { ResourceManager } from '../../resource-manager/src/ResourceManager.js';
import { DatabaseStorage } from '../src/core/DatabaseStorage.js';
import { DatabaseInitializer } from '../src/core/DatabaseInitializer.js';

async function resetDatabase(options = {}) {
  const { perspectives = false, tools = false, all = false, confirm = false } = options;
  
  let resourceManager;
  let databaseStorage;
  let databaseInitializer;
  
  try {
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getResourceManager();
    
    // Initialize DatabaseStorage
    databaseStorage = new DatabaseStorage({ 
      resourceManager,
      databaseName: 'legion_tools'
    });
    await databaseStorage.initialize();
    
    console.log('🔄 Database Reset\n');
    console.log('=' + '='.repeat(50));
    
    // Determine what to reset
    const resetAll = all || (!perspectives && !tools);
    
    // Show what will be reset
    console.log('\n⚠️  This will reset:');
    if (resetAll || perspectives) {
      console.log('  - tool_perspectives collection');
    }
    if (resetAll || tools) {
      console.log('  - tools collection');
    }
    if (resetAll) {
      console.log('  - perspective_types collection (will be re-seeded)');
    }
    
    // Confirm if not explicitly confirmed
    if (!confirm) {
      console.log('\nPress Ctrl+C to cancel, or wait 3 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const db = databaseStorage.db;
    
    // Perform reset
    console.log('\n🧹 Resetting...');
    
    if (resetAll || perspectives) {
      const result = await db.collection('tool_perspectives').deleteMany({});
      console.log(`  ✅ Deleted ${result.deletedCount} perspectives`);
    }
    
    if (resetAll || tools) {
      const result = await db.collection('tools').deleteMany({});
      console.log(`  ✅ Deleted ${result.deletedCount} tools`);
    }
    
    if (resetAll) {
      // Reset and re-seed perspective types
      const result = await db.collection('perspective_types').deleteMany({});
      console.log(`  ✅ Deleted ${result.deletedCount} perspective types`);
      
      // Re-initialize to seed defaults
      console.log('\n🌱 Re-seeding default perspective types...');
      databaseInitializer = new DatabaseInitializer({
        db: db,
        resourceManager: resourceManager,
        options: {
          verbose: true,
          seedData: true,
          createIndexes: true
        }
      });
      
      await databaseInitializer.seedPerspectiveTypes();
      const newTypes = await db.collection('perspective_types').countDocuments();
      console.log(`  ✅ Seeded ${newTypes} perspective types`);
    }
    
    // Show final state
    console.log('\n📊 Final State:');
    const perspectiveTypesCount = await db.collection('perspective_types').countDocuments();
    const toolsCount = await db.collection('tools').countDocuments();
    const perspectivesCount = await db.collection('tool_perspectives').countDocuments();
    
    console.log(`  Perspective Types: ${perspectiveTypesCount}`);
    console.log(`  Tools: ${toolsCount}`);
    console.log(`  Tool Perspectives: ${perspectivesCount}`);
    
    console.log('\n✅ Database reset complete!');
    
    // Suggest next steps
    console.log('\n💡 Next Steps:');
    if (toolsCount === 0) {
      console.log('  1. Load tools: node scripts/load-tools.js');
    }
    if (perspectivesCount === 0 && toolsCount > 0) {
      console.log('  2. Generate perspectives: node scripts/generate-perspectives.js');
    }
    if (toolsCount === 0) {
      console.log('  2. Generate perspectives: node scripts/generate-perspectives.js');
    }
    
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
    console.error(error.stack);
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
  perspectives: false,
  tools: false,
  all: false,
  confirm: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--perspectives') {
    options.perspectives = true;
  } else if (args[i] === '--tools') {
    options.tools = true;
  } else if (args[i] === '--all') {
    options.all = true;
  } else if (args[i] === '--confirm' || args[i] === '-y') {
    options.confirm = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Reset Database Script

Usage:
  node scripts/reset-database.js [options]

Options:
  --perspectives   Reset only tool_perspectives collection
  --tools          Reset only tools collection
  --all            Reset all collections (default if no options)
  --confirm, -y    Skip confirmation prompt
  --help, -h       Show this help message

Examples:
  node scripts/reset-database.js
  node scripts/reset-database.js --perspectives
  node scripts/reset-database.js --tools --confirm
  node scripts/reset-database.js --all -y
    `);
    process.exit(0);
  }
}

// Run the script
resetDatabase(options).catch(console.error);