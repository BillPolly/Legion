#!/usr/bin/env node

/**
 * Tool Registry Population CLI
 * 
 * Simple command-line script to populate the tool registry database.
 * 
 * Usage:
 *   node populate.js                    # Update existing data
 *   node populate.js --clear            # Clear and repopulate
 *   node populate.js --verbose          # Show detailed output
 *   node populate.js --module Calculator # Load specific module
 */

import { ModuleLoader } from './ModuleLoader.js';
import { DatabasePopulator } from './DatabasePopulator.js';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    clear: !args.includes('--no-clear'),  // Default to clear unless --no-clear is specified
    verbose: args.includes('--verbose') || args.includes('-v'),
    module: null
  };
  
  // Check for module filter
  const moduleIndex = args.indexOf('--module');
  if (moduleIndex !== -1 && args[moduleIndex + 1]) {
    options.module = args[moduleIndex + 1];
  }
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Tool Registry Population Script

Usage:
  node populate.js [options]

Options:
  --no-clear        Skip clearing existing data (default clears all data)
  --verbose, -v     Show detailed output
  --module <name>   Load only specific module
  --help, -h        Show this help message

Examples:
  node populate.js --verbose
  node populate.js --module Calculator
  node populate.js --no-clear
`);
    process.exit(0);
  }
  
  console.log('🚀 Tool Registry Population');
  console.log('═'.repeat(50));
  
  if (options.clear) {
    console.log('Mode: CLEAR AND POPULATE (default)');
  } else {
    console.log('Mode: UPDATE (--no-clear specified)');
  }
  
  if (options.module) {
    console.log(`Filter: ${options.module}`);
  }
  
  console.log('');
  
  try {
    // Create module loader
    const loader = new ModuleLoader({
      verbose: options.verbose
    });
    
    // Load modules
    console.log('📦 Loading modules...');
    const startLoadTime = Date.now();
    const loadResult = await loader.loadModules(options.module);
    const loadTime = Date.now() - startLoadTime;
    
    console.log(`✅ Loaded ${loadResult.summary.loaded} modules in ${(loadTime / 1000).toFixed(2)}s`);
    
    if (loadResult.summary.failed > 0) {
      console.log(`⚠️  ${loadResult.summary.failed} modules failed to load`);
      if (options.verbose) {
        console.log('\nFailed modules:');
        for (const failed of loadResult.failed) {
          console.log(`  - ${failed.config.name}: ${failed.error}`);
        }
      }
    }
    
    // Populate database
    console.log('\n🗄️ Populating database...');
    const startPopTime = Date.now();
    
    const populator = new DatabasePopulator({
      verbose: options.verbose
    });
    
    const popResult = await populator.populate(loadResult.loaded, {
      clearExisting: options.clear
    });
    
    const popTime = Date.now() - startPopTime;
    
    // Close database connection
    await populator.close();
    
    // Final summary
    console.log('\n' + '═'.repeat(50));
    console.log('✅ Population Complete!');
    console.log(`   Total time: ${((loadTime + popTime) / 1000).toFixed(2)}s`);
    console.log(`   Modules saved: ${popResult.modules.saved}`);
    console.log(`   Tools saved: ${popResult.tools.saved}`);
    
    if (popResult.modules.failed > 0 || popResult.tools.failed > 0) {
      console.log(`   ⚠️ Failures: ${popResult.modules.failed} modules, ${popResult.tools.failed} tools`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Population failed:', error.message);
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