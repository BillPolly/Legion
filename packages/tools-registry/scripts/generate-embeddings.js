#!/usr/bin/env node

/**
 * Generate Embeddings Script
 * 
 * Generates embeddings for tools and perspectives using Nomic AI
 * Can process all modules or specific ones
 * 
 * Usage:
 *   node scripts/generate-embeddings.js                    # Generate for all
 *   node scripts/generate-embeddings.js --module Calculator  # Specific module
 *   node scripts/generate-embeddings.js --batch-size 100   # Custom batch size
 *   node scripts/generate-embeddings.js --force            # Regenerate existing
 */

import { ToolRegistry } from '../src/index.js';

async function generateEmbeddings(options = {}) {
  const { module, batchSize = 50, force = false, verbose = false } = options;
  
  try {
    // Get ToolRegistry singleton
    const toolRegistry = await ToolRegistry.getInstance();
    
    console.log('🧬 Generating embeddings...\n');
    
    // Generate embeddings through the singleton
    const result = await toolRegistry.generateEmbeddings({
      moduleName: module,
      batchSize,
      force,
      verbose
    });
    
    // Display results
    console.log('\n📊 Embedding Generation Results:');
    console.log(`  Tools processed: ${result.tools.processed}`);
    console.log(`  Tools with embeddings: ${result.tools.withEmbeddings}`);
    console.log(`  Tools failed: ${result.tools.failed}`);
    
    console.log(`\n  Perspectives processed: ${result.perspectives.processed}`);
    console.log(`  Perspectives with embeddings: ${result.perspectives.withEmbeddings}`);
    console.log(`  Perspectives failed: ${result.perspectives.failed}`);
    
    if (result.duration) {
      console.log(`\n⏱️  Duration: ${(result.duration / 1000).toFixed(2)} seconds`);
    }
    
    console.log('\n✅ Embedding generation complete!');
    
  } catch (error) {
    console.error('❌ Error generating embeddings:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  module: null,
  batchSize: 50,
  force: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--module' && args[i + 1]) {
    options.module = args[i + 1];
    i++;
  } else if (args[i] === '--batch-size' && args[i + 1]) {
    options.batchSize = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--force') {
    options.force = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Generate Embeddings Script

Usage:
  node scripts/generate-embeddings.js [options]

Options:
  --module <name>      Process specific module only
  --batch-size <n>     Number of items to process in batch (default: 50)
  --force             Regenerate embeddings even if they exist
  --verbose, -v       Show detailed output
  --help, -h          Show this help message

Examples:
  node scripts/generate-embeddings.js
  node scripts/generate-embeddings.js --module Calculator
  node scripts/generate-embeddings.js --batch-size 100 --force
  node scripts/generate-embeddings.js --verbose
    `);
    process.exit(0);
  }
}

// Run the script
generateEmbeddings(options).catch(console.error);