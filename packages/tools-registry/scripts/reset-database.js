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

import { ToolRegistry } from '../src/index.js';

async function resetDatabase(options = {}) {
  const { perspectives = false, tools = false, all = false, confirm = false } = options;
  
  try {
    // Get ToolRegistry singleton
    const toolRegistry = await ToolRegistry.getInstance();
    
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
    
    // Perform reset through the singleton
    console.log('\n🧹 Resetting...');
    
    if (resetAll) {
      await toolRegistry.clearAllData();
      console.log('  ✅ All data cleared and perspective types re-seeded');
    } else {
      // Partial clear - use the singleton's database storage
      const db = toolRegistry.databaseStorage.db;
      
      if (perspectives) {
        const result = await db.collection('tool_perspectives').deleteMany({});
        console.log(`  ✅ Deleted ${result.deletedCount} perspectives`);
      }
      
      if (tools) {
        const result = await db.collection('tools').deleteMany({});
        console.log(`  ✅ Deleted ${result.deletedCount} tools`);
      }
    }
    
    // Show final state
    const status = await toolRegistry.getSystemStatus({ verbose: false });
    console.log('\n📊 Final State:');
    console.log(`  Perspective Types: ${status.perspectiveTypes}`);
    console.log(`  Tools: ${status.tools}`);
    console.log(`  Perspectives: ${status.perspectives}`);
    
    console.log('\n✅ Database reset complete!');
    
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
    process.exit(1);
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
  --perspectives   Reset only perspectives
  --tools         Reset only tools
  --all           Reset everything (default if no options)
  --confirm, -y   Skip confirmation prompt
  --help, -h      Show this help message

Examples:
  node scripts/reset-database.js
  node scripts/reset-database.js --perspectives
  node scripts/reset-database.js --tools --confirm
    `);
    process.exit(0);
  }
}

// Run the script
resetDatabase(options).catch(console.error);