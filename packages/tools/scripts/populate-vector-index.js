#!/usr/bin/env node

/**
 * Vector Index Population Script
 * 
 * Populates the Qdrant vector index with tool perspectives from MongoDB.
 * Uses LoadingManager for coordinated operations.
 * 
 * Usage:
 *   node scripts/populate-vector-index.js                    # Load all modules
 *   node scripts/populate-vector-index.js --clear           # Clear and rebuild index
 *   node scripts/populate-vector-index.js --module json     # Load specific module
 */

import { LoadingManager } from '../src/loading/LoadingManager.js';

async function populateVectorIndex() {
  console.log('🚀 Vector Index Population Script\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const moduleFilter = args.includes('--module') ? args[args.indexOf('--module') + 1] : null;
  const clearFirst = args.includes('--clear');
  const verbose = args.includes('--verbose') || args.includes('-v');
  const help = args.includes('--help') || args.includes('-h');
  
  if (help) {
    console.log(`Usage:
  node scripts/populate-vector-index.js                     # Process all modules
  node scripts/populate-vector-index.js --module ModuleName # Process specific module
  node scripts/populate-vector-index.js --clear             # Clear all and repopulate
  node scripts/populate-vector-index.js --module json --clear # Clear module and repopulate
  
Options:
  --module <name>  Filter to specific module (e.g., json, calculator)
  --clear          Clear existing vectors before populating
  --verbose, -v    Show detailed output
  --help, -h       Show this help message`);
    process.exit(0);
  }
  
  console.log('📋 Configuration:');
  console.log('  Target:', moduleFilter ? `Module: ${moduleFilter}` : 'All modules');
  console.log('  Clear first:', clearFirst ? 'Yes' : 'No');
  console.log('  Verbose:', verbose ? 'Yes' : 'No');
  console.log();
  
  try {
    // Create loading manager
    const loadingManager = new LoadingManager({
      verbose: verbose
    });
    
    // Execute vector indexing pipeline
    console.log('🚀 Starting vector indexing pipeline...');
    const startTime = Date.now();
    
    const result = await loadingManager.fullPipeline({
      moduleFilter: moduleFilter,
      clearFirst: clearFirst,
      includePerspectives: false, // Assume perspectives already exist
      includeVectors: true // Only do vector indexing
    });
    
    const totalTime = Date.now() - startTime;
    
    // Clean up
    await loadingManager.close();
    
    // Final summary
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 SUCCESS: Vector index population completed!');
    console.log(`   Total time: ${(totalTime / 1000).toFixed(2)}s`);
    
    if (result.vectorResult) {
      console.log(`   Vectors indexed: ${result.vectorResult.perspectivesIndexed}`);
      console.log(`   Tools processed: ${result.vectorResult.toolsProcessed}`);
    }
    
    if (result.clearResult && clearFirst) {
      console.log(`   Records cleared: ${result.clearResult.totalCleared}`);
    }
    
    console.log('\n💡 Next steps:');
    console.log('  - Test semantic search: node scripts/test-semantic-tool-search.js');
    console.log('  - Query specific tools: Use ToolRegistry.semanticToolSearch()');
    console.log('  - Update incrementally: Re-run with --module flag for specific updates');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Vector index population failed:', error.message);
    if (verbose) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
populateVectorIndex().catch(console.error);