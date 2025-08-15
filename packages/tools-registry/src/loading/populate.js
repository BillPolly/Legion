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

import { LoadingManager } from './LoadingManager.js';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    clear: !args.includes('--no-clear'),  // Default to clear unless --no-clear is specified
    verbose: args.includes('--verbose') || args.includes('-v'),
    module: null,
    perspectives: args.includes('--perspectives'),
    vectors: args.includes('--vectors')
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
  --perspectives    Generate perspectives for tools
  --vectors         Index vectors to Qdrant (requires perspectives)
  --help, -h        Show this help message

Examples:
  node populate.js --verbose
  node populate.js --module Calculator
  node populate.js --no-clear
  node populate.js --module json --perspectives --vectors
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
  
  if (options.perspectives) {
    console.log('Include: Perspectives generation');
  }
  
  if (options.vectors) {
    console.log('Include: Vector indexing');
  }
  
  console.log('');
  
  try {
    // Create loading manager
    const loadingManager = new LoadingManager({
      verbose: options.verbose
    });
    
    // Execute full pipeline
    console.log('📦 Starting loading pipeline...');
    const startTime = Date.now();
    
    const result = await loadingManager.fullPipeline({
      moduleFilter: options.module,
      clearFirst: options.clear,
      includePerspectives: options.perspectives,
      includeVectors: options.vectors
    });
    
    const totalTime = Date.now() - startTime;
    
    // Close connections
    await loadingManager.close();
    
    // Final summary
    console.log('\n' + '═'.repeat(50));
    console.log('✅ Population Complete!');
    console.log(`   Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`   Modules loaded: ${result.loadResult?.modulesLoaded || 0}`);
    console.log(`   Tools added: ${result.loadResult?.toolsAdded || 0}`);
    
    if (options.perspectives && result.perspectiveResult) {
      console.log(`   Perspectives generated: ${result.perspectiveResult.perspectivesGenerated}`);
    }
    
    if (options.vectors && result.vectorResult) {
      console.log(`   Vectors indexed: ${result.vectorResult.perspectivesIndexed}`);
    }
    
    if (result.clearResult) {
      console.log(`   Records cleared: ${result.clearResult.totalCleared}`);
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