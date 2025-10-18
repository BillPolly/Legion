#!/usr/bin/env node

/**
 * Simple WordNet Loader Script
 * Loads WordNet synsets as proper MongoDB documents (fast!)
 */

import { SimpleWordNetLoader } from '../src/loader/SimpleWordNetLoader.js';

async function main() {
  console.log('============================================');
  console.log('Simple WordNet Loader');
  console.log('============================================\n');

  const loader = new SimpleWordNetLoader({
    mongodb: {
      connectionString: 'mongodb://localhost:27017',
      dbName: 'wordnet',
      collectionName: 'synsets'
    },
    wordnet: {
      maxSynsets: null, // Load all
      includedPos: ['n', 'v', 'a', 'r'] // Skip 's' - satellite adjectives are in 'a'
    },
    loading: {
      batchSize: 1000
    }
  });

  try {
    const results = await loader.loadWordNet();
    console.log('SUCCESS!');
    process.exit(0);
  } catch (error) {
    console.error('FAILED:', error);
    process.exit(1);
  }
}

main();
