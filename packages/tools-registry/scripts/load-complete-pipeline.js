#!/usr/bin/env node

/**
 * Load Complete Pipeline Script
 * 
 * Executes the complete tool registry pipeline:
 * 1. Discover modules in configured paths
 * 2. Load all discovered modules
 * 3. Generate perspectives for tools
 * 4. Generate embeddings for perspectives
 * 5. Index vectors for semantic search
 * 
 * Usage:
 *   node scripts/load-complete-pipeline.js           # Run complete pipeline
 *   node scripts/load-complete-pipeline.js --clear   # Clear all data first, then run pipeline
 *   node scripts/load-complete-pipeline.js --verbose # Show detailed output
 */

import { getToolRegistry } from '../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadCompletePipeline(options = {}) {
  const { clear = false, verbose = false } = options;
  
  try {
    // Get ToolRegistry singleton
    const toolRegistry = await getToolRegistry();
    
    // Clear all data first if requested
    if (clear) {
      console.log('\n🗑️  Clearing all existing data...');
      const clearResult = await toolRegistry.clearAllData({
        clearVectors: true,
        includeRegistry: true
      });
      console.log('✅ Data cleared:', {
        database: clearResult.steps?.find(s => s.name === 'database-clear-all')?.success || false,
        vectors: clearResult.steps?.find(s => s.name === 'vectors-clear')?.success || false,
        cache: clearResult.steps?.find(s => s.name === 'cache-clear')?.success || false
      });
    }
    
    // Step 1: Discover modules
    console.log('\n🔍 Step 1: Discovering modules...');
    const discoveryPaths = [
      path.join(__dirname, '../__tests__/fixtures')  // Default to test fixtures
    ];
    
    const discoveryResult = await toolRegistry.discoverModules(discoveryPaths);
    console.log(`✅ Discovered ${discoveryResult.discovered} modules`);
    if (verbose && discoveryResult.modules) {
      console.log('  Modules:', discoveryResult.modules.map(m => m.name).join(', '));
    }
    
    // Step 2: Load modules
    console.log('\n📦 Step 2: Loading modules...');
    const loadResult = await toolRegistry.loadModules();
    console.log(`✅ Loaded ${loadResult.successful} modules with ${loadResult.tools} tools`);
    if (verbose && loadResult.loadedModules) {
      console.log('  Loaded:', loadResult.loadedModules.join(', '));
    }
    if (loadResult.failed > 0) {
      console.log(`⚠️  Failed to load ${loadResult.failed} modules`);
      if (verbose && loadResult.errors) {
        loadResult.errors.forEach(err => {
          console.log(`    - ${err.module}: ${err.error}`);
        });
      }
    }
    
    // Step 3: Generate perspectives
    console.log('\n📝 Step 3: Generating perspectives...');
    const perspectiveResult = await toolRegistry.generatePerspectives({
      limit: 50,  // Limit for testing
      verbose
    });
    console.log(`✅ Generated ${perspectiveResult.generated} perspectives`);
    if (perspectiveResult.failed > 0) {
      console.log(`⚠️  Failed to generate ${perspectiveResult.failed} perspectives`);
    }
    
    // Step 4: Generate embeddings
    console.log('\n🧮 Step 4: Generating embeddings...');
    const embeddingResult = await toolRegistry.generateEmbeddings({
      batchSize: 10,
      verbose
    });
    console.log(`✅ Generated embeddings for ${embeddingResult.embedded} perspectives`);
    if (embeddingResult.failed > 0) {
      console.log(`⚠️  Failed to generate ${embeddingResult.failed} embeddings`);
    }
    
    // Step 5: Index vectors
    console.log('\n🔗 Step 5: Indexing vectors...');
    const indexResult = await toolRegistry.indexVectors({
      verbose
    });
    console.log(`✅ Indexed ${indexResult.indexed} vectors in Qdrant`);
    if (indexResult.failed > 0) {
      console.log(`⚠️  Failed to index ${indexResult.failed} vectors`);
    }
    
    // Get final statistics
    console.log('\n📊 Pipeline Complete - Final Statistics:');
    const stats = await toolRegistry.getStatistics();
    console.log('  Modules:', {
      discovered: stats.modules.totalDiscovered || 0,
      loaded: stats.modules.totalLoaded || 0
    });
    console.log('  Tools:', {
      total: stats.tools.total || 0,
      withMetadata: stats.tools.withMetadata || 0
    });
    console.log('  Search:', {
      perspectives: stats.search.perspectivesGenerated || 0,
      embeddings: stats.search.perspectivesWithEmbeddings || 0,
      vectors: stats.search.vectorsIndexed || 0
    });
    
    // Test semantic search
    console.log('\n🔍 Testing semantic search...');
    const testQueries = ['calculate', 'math operations', 'arithmetic'];
    const searchResult = await toolRegistry.testSemanticSearch(testQueries, {
      limit: 3,
      threshold: 0.3
    });
    console.log(`  Tested ${searchResult.totalQueries} queries`);
    console.log(`  Successful queries: ${searchResult.successfulQueries}`);
    if (verbose && searchResult.results) {
      searchResult.results.forEach(r => {
        console.log(`  Query: "${r.query}" - Found ${r.resultCount} results`);
        if (r.topResult) {
          console.log(`    Top result: ${r.topResult.toolName} (${(r.topResult.similarity * 100).toFixed(1)}%)`);
        }
      });
    }
    
    console.log('\n✅ Complete pipeline executed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Pipeline failed:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  clear: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--clear' || args[i] === '-c') {
    options.clear = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Load Complete Pipeline Script

Usage:
  node scripts/load-complete-pipeline.js [options]

Options:
  --clear, -c    Clear all data before running pipeline
  --verbose, -v  Show detailed output
  --help, -h     Show this help message

Examples:
  node scripts/load-complete-pipeline.js
  node scripts/load-complete-pipeline.js --clear
  node scripts/load-complete-pipeline.js --clear --verbose
    `);
    process.exit(0);
  }
}

// Run the script
loadCompletePipeline(options).catch(console.error);