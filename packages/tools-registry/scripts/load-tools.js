#!/usr/bin/env node

/**
 * Load Tools Script
 * 
 * Loads tools from modules into the tools collection
 * Supports batch loading, validation, and path specification
 * 
 * Usage:
 *   node scripts/load-tools.js                          # Load all tools
 *   node scripts/load-tools.js --module Calculator      # Load specific module
 *   node scripts/load-tools.js --modules File,Json      # Load multiple modules
 *   node scripts/load-tools.js --path ../tools          # Custom module path
 *   node scripts/load-tools.js --clear                  # Clear before loading
 *   node scripts/load-tools.js --validate               # Validate after loading
 */

import { getToolRegistry } from '../src/index.js';

async function loadTools(options = {}) {
  const { modules, path, clear = false, validate = false, verbose = false } = options;
  
  try {
    // Get ToolRegistry singleton
    const toolRegistry = await getToolRegistry();
    
    console.log('🔧 Tool Loading Pipeline\n');
    
    // Clear if requested
    if (clear) {
      console.log('🧹 Clearing existing data...');
      const clearResult = await toolRegistry.clearAllData();
      console.log(`   Cleared ${clearResult.tools} tools, ${clearResult.modules} modules\n`);
    }
    
    // Determine what to load
    let loadResult;
    if (modules && modules.length > 0) {
      // Load specific modules
      console.log(`📦 Loading ${modules.length} module(s): ${modules.join(', ')}`);
      loadResult = await toolRegistry.loadMultipleModules(modules, { path, verbose });
    } else {
      // Load all modules
      console.log('📦 Loading all available modules...');
      loadResult = await toolRegistry.loadAllModules({ path, verbose });
    }
    
    // Display results
    console.log('\n📊 Loading Results:');
    console.log(`  Modules loaded: ${loadResult.loaded || 0}`);
    const totalTools = loadResult.modules?.reduce((sum, m) => sum + (m.toolCount || 0), 0) || 0;
    console.log(`  Tools loaded: ${totalTools}`);
    console.log(`  Errors: ${loadResult.errors?.length || 0}`);
    
    if (loadResult.errors?.length > 0 && verbose) {
      console.log('\n⚠️  Errors encountered:');
      loadResult.errors.forEach(err => {
        console.log(`    - ${err}`);
      });
    }
    
    // Validate if requested
    if (validate) {
      console.log('\n🔍 Validating loaded tools...');
      const validationResult = await toolRegistry.verifyModules({ verbose });
      console.log(`  Valid modules: ${validationResult.verified}`);
      console.log(`  Issues found: ${validationResult.issues}`);
    }
    
    console.log('\n✅ Tool loading complete!');
    
    // Exit successfully
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error loading tools:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  modules: [],
  path: null,
  clear: false,
  validate: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--module' && args[i + 1]) {
    options.modules.push(args[i + 1]);
    i++;
  } else if (args[i] === '--modules' && args[i + 1]) {
    options.modules = args[i + 1].split(',').map(m => m.trim());
    i++;
  } else if (args[i] === '--path' && args[i + 1]) {
    options.path = args[i + 1];
    i++;
  } else if (args[i] === '--clear') {
    options.clear = true;
  } else if (args[i] === '--validate') {
    options.validate = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Load Tools Script

Usage:
  node scripts/load-tools.js [options]

Options:
  --module <name>    Load specific module
  --modules <list>   Load multiple modules (comma-separated)
  --path <path>      Custom path to search for modules
  --clear            Clear existing tools before loading
  --validate         Validate tools after loading
  --verbose, -v      Show detailed output
  --help, -h         Show this help message

Examples:
  node scripts/load-tools.js
  node scripts/load-tools.js --module Calculator
  node scripts/load-tools.js --modules File,Json,Calculator
  node scripts/load-tools.js --path ../tools-collection
  node scripts/load-tools.js --clear --validate
  node scripts/load-tools.js --verbose
    `);
    process.exit(0);
  }
}

// Run the script
loadTools(options).catch(console.error);