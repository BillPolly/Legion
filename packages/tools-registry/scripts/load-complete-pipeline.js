#!/usr/bin/env node

/**
 * Complete Pipeline Script - Load All Modules with Real Nomic Embeddings
 * 
 * This is the comprehensive production pipeline that:
 * 1. Loads ALL modules from tools-collection using ToolRegistry singleton
 * 2. Generates real Nomic embeddings (768-dimensional) for all tool perspectives
 * 3. Indexes embeddings in Qdrant vector database for semantic search
 * 4. Provides verification of the complete pipeline end-to-end
 * 
 * Usage:
 *   node scripts/load-complete-pipeline.js                    # Load all modules
 *   node scripts/load-complete-pipeline.js --clear           # Clear before loading
 *   node scripts/load-complete-pipeline.js --modules File,Json # Load specific modules
 *   node scripts/load-complete-pipeline.js --skip-vectors    # Skip vector indexing
 *   node scripts/load-complete-pipeline.js --batch-size 100  # Custom batch size
 *   node scripts/load-complete-pipeline.js --verify          # Only verify existing data
 *   node scripts/load-complete-pipeline.js --verbose         # Detailed output
 */

import toolRegistry from '../src/index.js';

async function runCompletePipeline(options = {}) {
  const { 
    modules = [], 
    clear = false, 
    skipVectors = false,
    batchSize = 50,
    verify = false, 
    verbose = false 
  } = options;
  
  try {
    // toolRegistry is already the initialized singleton instance
    
    console.log('🚀 Starting Complete Pipeline...\n');
    
    // Run complete pipeline through the singleton with enhanced options
    const result = await toolRegistry.runCompletePipeline({
      modules: modules.length > 0 ? modules : null,
      clear,
      skipVectors,
      batchSize,
      verify,
      verbose
    });
    
    // Display results
    console.log('\n🎉 Complete Pipeline Summary:');
    console.log(`  ⏱️  Total time: ${(result.totalTime / 1000).toFixed(2)}s`);
    console.log(`  📦 Modules processed: ${result.modulesLoaded}/${result.modulesLoaded + result.modulesFailed}`);
    console.log(`  🔧 Tools loaded: ${result.toolsLoaded}`);
    console.log(`  🧠 Perspectives: ${result.perspectives}`);
    console.log(`  🔍 Vectors indexed: ${result.vectors}`);
    console.log(`  ✅ Pipeline status: ${result.searchWorking ? 'WORKING' : 'FAILED'}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${result.errors.length}`);
      if (verbose) {
        result.errors.forEach((error, i) => {
          console.log(`  ${i + 1}. ${error.module || 'Unknown'}: ${error.error}`);
        });
      }
    }
    
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
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
  clear: false,
  skipVectors: false,
  batchSize: 50,
  verify: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--module' && args[i + 1]) {
    options.modules.push(args[i + 1]);
    i++;
  } else if (args[i] === '--modules' && args[i + 1]) {
    options.modules = args[i + 1].split(',').map(m => m.trim());
    i++;
  } else if (args[i] === '--clear') {
    options.clear = true;
  } else if (args[i] === '--skip-vectors') {
    options.skipVectors = true;
  } else if (args[i] === '--batch-size' && args[i + 1]) {
    options.batchSize = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--verify') {
    options.verify = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Complete Pipeline Script - Load All Modules with Real Nomic Embeddings

Usage:
  node scripts/load-complete-pipeline.js [options]

Options:
  --module <name>     Load specific module
  --modules <list>    Load multiple modules (comma-separated)
  --clear             Clear existing data before loading
  --skip-vectors      Skip vector indexing step
  --batch-size <n>    Embedding batch size (default: 50)
  --verify            Only verify existing data, don't load
  --verbose, -v       Show detailed output
  --help, -h          Show this help message

Examples:
  node scripts/load-complete-pipeline.js
  node scripts/load-complete-pipeline.js --clear --verbose
  node scripts/load-complete-pipeline.js --module Calculator
  node scripts/load-complete-pipeline.js --modules File,Json,Calculator
  node scripts/load-complete-pipeline.js --skip-vectors
  node scripts/load-complete-pipeline.js --batch-size 100
  node scripts/load-complete-pipeline.js --verify
    `);
    process.exit(0);
  }
}

// Run the pipeline
runCompletePipeline(options).catch(console.error);