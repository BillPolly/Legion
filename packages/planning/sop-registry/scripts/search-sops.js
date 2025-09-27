#!/usr/bin/env node

import SOPRegistry from '../src/index.js';

const query = process.argv.slice(2).join(' ');

if (!query) {
  console.log('Usage: node scripts/search-sops.js <query>');
  console.log('Example: node scripts/search-sops.js booking train');
  process.exit(1);
}

async function searchSOPs() {
  try {
    const sopRegistry = await SOPRegistry.getInstance();
    
    console.log(`\nSearching for: "${query}"\n`);
    
    const results = await sopRegistry.searchSOPs(query);
    
    console.log(`Found ${results.length} SOPs:\n`);
    
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.sop.title}`);
      console.log(`   Score: ${r.score.toFixed(3)}`);
      console.log(`   Steps: ${r.sop.steps.length}`);
      console.log(`   Matched: ${r.matchedPerspectives.length} perspectives`);
      console.log('');
    });
    
    await sopRegistry.cleanup();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

searchSOPs();