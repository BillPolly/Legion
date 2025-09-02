#!/usr/bin/env node

/**
 * Tool Search Script
 * Search for tools using semantic search and display formatted results
 * 
 * Usage:
 *   node scripts/search-tools.js "database operations"
 *   node scripts/search-tools.js "file handling" --limit 10
 *   node scripts/search-tools.js "mongodb" --verbose
 */

import { getToolRegistry } from '../src/index.js';

async function searchTools(query, options = {}) {
  const { limit = 5, verbose = false, threshold = 0.3 } = options;
  
  if (!query) {
    console.error('❌ Please provide a search query');
    console.error('Usage: node scripts/search-tools.js "your search query"');
    process.exit(1);
  }
  
  try {
    console.log(`🔍 Searching for tools: "${query}"\n`);
    
    const registry = await getToolRegistry();
    const results = await registry.searchTools(query, { limit, threshold });
    
    if (results.length === 0) {
      console.log('❌ No tools found matching your query');
      console.log('\n💡 Try:');
      console.log('  - Using different keywords');
      console.log('  - Reducing specificity');
      console.log('  - Lowering the threshold with --threshold 0.2');
      return;
    }
    
    console.log(`✅ Found ${results.length} matching tools:\n`);
    
    results.forEach((result, index) => {
      const tool = result.tool;
      const similarity = ((result.similarity || result.confidence || 0) * 100).toFixed(1);
      const stars = '★'.repeat(Math.ceil((result.similarity || result.confidence || 0) * 5));
      
      console.log(`${index + 1}. ${tool?.name || result.name || 'Unknown'}`);
      console.log(`   ${stars} ${similarity}% match`);
      console.log(`   ${tool?.description || 'No description available'}`);
      
      if (verbose) {
        console.log(`   Module: ${tool?.module?.name || 'Unknown'}`);
        console.log(`   Category: ${tool?.category || 'Uncategorized'}`);
        if (tool?.tags?.length > 0) {
          console.log(`   Tags: ${tool.tags.join(', ')}`);
        }
        if (result.perspectiveText) {
          const truncated = result.perspectiveText.length > 80 
            ? result.perspectiveText.substring(0, 80) + '...' 
            : result.perspectiveText;
          console.log(`   Matched on: "${truncated}"`);
        }
        if (result.perspectiveType) {
          console.log(`   Perspective type: ${result.perspectiveType}`);
        }
      }
      console.log('');
    });
    
    console.log(`📊 Search completed in ${results.length} results`);
    
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const query = args.find(arg => !arg.startsWith('--'));

const options = {
  limit: 5,
  verbose: false,
  threshold: 0.3
};

// Parse options
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    options.limit = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--threshold' && args[i + 1]) {
    options.threshold = parseFloat(args[i + 1]);
    i++;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Tool Search Script

Usage:
  node scripts/search-tools.js "query" [options]

Arguments:
  query                Search query for tools

Options:
  --limit <n>          Maximum number of results (default: 5)
  --threshold <n>      Minimum similarity threshold 0-1 (default: 0.3)
  --verbose, -v        Show detailed information
  --help, -h           Show this help message

Examples:
  node scripts/search-tools.js "database operations"
  node scripts/search-tools.js "file handling" --limit 10
  node scripts/search-tools.js "mongodb" --verbose
  node scripts/search-tools.js "text processing" --threshold 0.2
    `);
    process.exit(0);
  }
}

// Run the search
searchTools(query, options).catch(console.error);