#!/usr/bin/env node

/**
 * Discover Modules Script
 * 
 * Discovers available modules without loading them
 * Can search in custom paths and filter by patterns
 * 
 * Usage:
 *   node scripts/discover-modules.js                          # Discover all
 *   node scripts/discover-modules.js --path ../tools-collection  # Custom path
 *   node scripts/discover-modules.js --pattern "File*"        # Pattern matching
 *   node scripts/discover-modules.js --save                   # Save to registry
 */

import toolRegistryExport from '../src/index.js';

async function discoverModules(options = {}) {
  const { path, pattern, save = false, verbose = false } = options;
  
  try {
    // Get ToolRegistry singleton instance
    const toolRegistry = await toolRegistryExport.getToolRegistry();
    
    console.log('🔍 Discovering modules...\n');
    
    // Discover modules through the singleton
    const result = await toolRegistry.discoverModules({
      path,
      pattern,
      save,
      verbose
    });
    
    // Display results
    console.log(`\n📦 Discovered ${result.discovered} modules`);
    
    if (!verbose && result.modules.length > 0) {
      console.log('\nModules found:');
      result.modules.forEach(m => {
        console.log(`  - ${m.name} (${m.type})`);
      });
    }
    
    if (save && result.saved) {
      console.log(`\n✅ Saved ${result.saved} modules to registry`);
    }
    
    console.log('\n✅ Discovery complete!');
    
    // Exit successfully
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error discovering modules:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  path: null,
  pattern: null,
  save: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--path' && args[i + 1]) {
    options.path = args[i + 1];
    i++;
  } else if (args[i] === '--pattern' && args[i + 1]) {
    options.pattern = args[i + 1];
    i++;
  } else if (args[i] === '--save') {
    options.save = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Discover Modules Script

Usage:
  node scripts/discover-modules.js [options]

Options:
  --path <path>     Custom path to search for modules
  --pattern <glob>  Pattern to filter module names (e.g., "File*")
  --save           Save discovered modules to registry
  --verbose, -v    Show detailed output
  --help, -h       Show this help message

Examples:
  node scripts/discover-modules.js
  node scripts/discover-modules.js --path ../tools-collection
  node scripts/discover-modules.js --pattern "File*" --save
  node scripts/discover-modules.js --verbose
    `);
    process.exit(0);
  }
}

// Run the script
discoverModules(options).catch(console.error);