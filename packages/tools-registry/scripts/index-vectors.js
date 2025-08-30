#!/usr/bin/env node

/**
 * Index Vectors Script
 * 
 * Indexes embeddings into Qdrant vector database
 * Can rebuild collections or update existing
 * 
 * Usage:
 *   node scripts/index-vectors.js                         # Index all
 *   node scripts/index-vectors.js --module Calculator     # Specific module
 *   node scripts/index-vectors.js --rebuild              # Rebuild collection
 *   node scripts/index-vectors.js --verify               # Verify after indexing
 */

import { getToolRegistry } from '../src/index.js';

async function indexVectors(options = {}) {
  const { module, rebuild = false, verify = false, verbose = false } = options;
  
  try {
    // Get ToolRegistry singleton
    const toolRegistry = await getToolRegistry();
    
    console.log('🔍 Indexing vectors into Qdrant...\n');
    
    // Rebuild collection if requested
    if (rebuild) {
      console.log('🔨 Rebuilding vector collection...');
      const rebuildResult = await toolRegistry.rebuildVectorCollection({
        verbose
      });
      console.log(`✅ Collection rebuilt: ${rebuildResult.collection}`);
      console.log(`   Dimension: ${rebuildResult.dimension}`);
      console.log(`   Metric: ${rebuildResult.metric}\n`);
    }
    
    // Index vectors through the singleton
    const result = await toolRegistry.indexVectorsEnhanced({
      moduleName: module,
      verbose
    });
    
    // Display results
    console.log('\n📊 Vector Indexing Results:');
    console.log(`  Total perspectives: ${result.total || 0}`);
    console.log(`  Points indexed: ${result.indexed || 0}`);
    console.log(`  Points failed: ${result.failed || 0}`);
    console.log(`  Points skipped: ${result.skipped || (result.total - result.indexed - result.failed) || 0}`);
    
    // Show errors if any
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.slice(0, 5).forEach(err => {
        if (typeof err === 'string') {
          console.log(`  - ${err}`);
        } else {
          console.log(`  - ${err.tool}: ${err.error}`);
        }
      });
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }
    
    if (result.collections) {
      console.log('\n📦 Collections:');
      Object.entries(result.collections).forEach(([name, count]) => {
        console.log(`  ${name}: ${count} points`);
      });
    }
    
    // Verify if requested
    if (verify) {
      console.log('\n🔎 Verifying vector index...');
      const verifyResult = await toolRegistry.verifyVectorIndex({
        moduleName: module,
        verbose
      });
      
      console.log(`\n✅ Verification Results:`);
      console.log(`  Total points: ${verifyResult.totalPoints}`);
      console.log(`  Valid points: ${verifyResult.validPoints}`);
      console.log(`  Missing embeddings: ${verifyResult.missingEmbeddings}`);
      
      if (verifyResult.sampleSearch) {
        console.log(`\n  Sample search returned ${verifyResult.sampleSearch.length} results`);
      }
    }
    
    if (result.duration) {
      console.log(`\n⏱️  Duration: ${(result.duration / 1000).toFixed(2)} seconds`);
    }
    
    console.log('\n✅ Vector indexing complete!');
    
    // Exit successfully
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error indexing vectors:', error.message);
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
  rebuild: false,
  verify: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--module' && args[i + 1]) {
    options.module = args[i + 1];
    i++;
  } else if (args[i] === '--rebuild') {
    options.rebuild = true;
  } else if (args[i] === '--verify') {
    options.verify = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Index Vectors Script

Usage:
  node scripts/index-vectors.js [options]

Options:
  --module <name>    Process specific module only
  --rebuild         Rebuild vector collection from scratch
  --verify          Verify index after completion
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Examples:
  node scripts/index-vectors.js
  node scripts/index-vectors.js --module Calculator
  node scripts/index-vectors.js --rebuild --verify
  node scripts/index-vectors.js --verbose
    `);
    process.exit(0);
  }
}

// Run the script
indexVectors(options).catch(console.error);