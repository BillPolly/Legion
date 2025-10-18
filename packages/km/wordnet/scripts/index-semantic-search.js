#!/usr/bin/env node

/**
 * Index Semantic Search - Populate Qdrant collections from WordNet MongoDB
 *
 * This script indexes all WordNet synsets from MongoDB into Qdrant collections
 * organized by part of speech for semantic similarity search:
 * - wordnet_nouns: All noun synsets (~82K)
 * - wordnet_verbs: All verb synsets (~13K)
 * - wordnet_adjectives: All adjective synsets (~18K)
 * - wordnet_adverbs: All adverb synsets (~3.6K)
 *
 * Usage:
 *   npm run index-semantic
 *   node scripts/index-semantic-search.js
 */

import { ResourceManager } from '@legion/resource-manager';
import { WordNetSemanticIndexer } from '../src/semantic/WordNetSemanticIndexer.js';

async function main() {
  console.log('============================================');
  console.log('WordNet Semantic Search Indexing');
  console.log('============================================\n');

  const resourceManager = await ResourceManager.getInstance();
  const indexer = new WordNetSemanticIndexer(resourceManager);

  try {
    await indexer.initialize();
    console.log('Indexer initialized\n');

    const startTime = Date.now();
    const stats = await indexer.indexAllSynsets();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\nIndexing completed in ${duration} seconds`);
    console.log('\nSUCCESS! All WordNet synsets indexed for semantic search');
    process.exit(0);
  } catch (error) {
    console.error('\nFAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await indexer.close();
  }
}

// Run main function
main();
