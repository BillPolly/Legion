#!/usr/bin/env node

/**
 * Semantic Search Script
 * 
 * Performs semantic search for tools using natural language queries
 * Searches through tool perspectives using vector similarity
 * 
 * Usage:
 *   node scripts/semantic-search.js "find tools for reading files"
 *   node scripts/semantic-search.js "how to parse JSON" --limit 5
 *   node scripts/semantic-search.js "create a web server" --verbose
 *   node scripts/semantic-search.js "file manipulation" --show-details
 */

import { getToolRegistry } from '../src/index.js';

async function semanticSearch(query, options = {}) {
  const { limit = 10, verbose = false, showDetails = true } = options;
  
  if (!query) {
    console.error('❌ Please provide a search query');
    console.log('\nUsage:');
    console.log('  node scripts/semantic-search.js "your search query"');
    console.log('\nExamples:');
    console.log('  node scripts/semantic-search.js "find tools for reading files"');
    console.log('  node scripts/semantic-search.js "how to parse JSON" --limit 5');
    console.log('  node scripts/semantic-search.js "create a web server" --verbose');
    process.exit(1);
  }
  
  try {
    // Get ToolRegistry singleton
    const toolRegistry = await getToolRegistry();
    
    console.log(`🔍 Searching for: "${query}"\n`);
    
    // Ensure modules are discovered and loaded
    if (verbose) {
      console.log('📦 Ensuring modules are loaded...');
    }
    
    // Check if modules need to be loaded
    const moduleCount = toolRegistry.moduleCache?.size || 0;
    if (moduleCount === 0) {
      if (verbose) {
        console.log('📦 Discovering modules...');
      }
      await toolRegistry.discoverModules();
      
      if (verbose) {
        console.log('📦 Loading modules...');
      }
      await toolRegistry.loadModules();
      
      if (verbose) {
        console.log(`📦 Loaded modules into cache\n`);
      }
    }
    
    // Check if vector store is initialized
    if (!toolRegistry.vectorStore || !toolRegistry.vectorStore.vectorDatabase) {
      console.error('❌ Vector store not initialized. Please run:');
      console.log('  npm run vectors');
      process.exit(1);
    }
    
    // Generate embedding for the query
    if (verbose) {
      console.log('📊 Generating query embedding...');
    }
    
    const queryEmbedding = await toolRegistry.embeddingService.generateEmbedding(query);
    
    if (!queryEmbedding || queryEmbedding.length === 0) {
      console.error('❌ Failed to generate query embedding');
      process.exit(1);
    }
    
    // Search in Qdrant
    if (verbose) {
      console.log('🔎 Searching vector database...\n');
    }
    
    const searchResults = await toolRegistry.vectorStore.vectorDatabase.search(
      'tool_perspectives',
      queryEmbedding,  // Pass vector as second argument
      {
        limit: limit,
        withPayload: true  // Note: camelCase for options
      }
    );
    
    if (!searchResults || searchResults.length === 0) {
      console.log('No results found for your query.');
      process.exit(0);
    }
    
    // Use vector search results to find and load actual tools
    const db = toolRegistry.databaseStorage.db;
    const { ObjectId } = await import('mongodb');
    
    // Get perspective IDs from vector search metadata (not the vector ID itself)
    const perspectiveIds = [];
    
    for (const result of searchResults) {
      if (result.metadata && result.metadata.perspectiveId) {
        try {
          // Try to convert perspectiveId to ObjectId
          const perspectiveId = ObjectId.isValid(result.metadata.perspectiveId) 
            ? new ObjectId(result.metadata.perspectiveId) 
            : result.metadata.perspectiveId;
          perspectiveIds.push(perspectiveId);
        } catch {
          // If conversion fails, use as-is
          perspectiveIds.push(result.metadata.perspectiveId);
        }
      }
    }
    
    if (verbose) {
      console.log(`Found ${perspectiveIds.length} perspective IDs from vector results`);
    }
    
    // Lookup perspectives from MongoDB
    const perspectives = await db.collection('tool_perspectives')
      .find({ _id: { $in: perspectiveIds } })
      .toArray();
    
    // Group by tool name and find best confidence per tool
    const toolScores = new Map();
    
    for (const perspective of perspectives) {
      // Find the corresponding vector result by matching perspectiveId in metadata
      const vectorResult = searchResults.find(r => 
        r.metadata && r.metadata.perspectiveId === perspective._id.toString()
      );
      const score = vectorResult?.score || 0;
      const toolName = perspective.tool_name;
      
      if (!toolScores.has(toolName) || score > toolScores.get(toolName).confidence) {
        toolScores.set(toolName, {
          toolName,
          confidence: score,
          matchingPerspective: perspective
        });
      }
    }
    
    // Load actual tool objects from ToolRegistry with confidence scores
    const toolResults = [];
    
    for (const [toolName, { confidence, matchingPerspective }] of toolScores) {
      try {
        if (verbose) {
          console.log(`Loading tool: ${toolName} (confidence: ${(confidence * 100).toFixed(1)}%)`);
        }
        
        // Use ToolRegistry to get the actual tool (loads and caches module if needed)
        const tool = await toolRegistry.getTool(toolName);
        
        if (tool) {
          toolResults.push({
            tool: tool,                    // Actual tool object from ToolRegistry
            confidence: confidence,        // Confidence score from vector search
            matchingPerspective: {         // Info about what matched
              type: matchingPerspective.perspective_type_name,
              content: matchingPerspective.content,
              keywords: matchingPerspective.keywords || []
            }
          });
        } else if (verbose) {
          console.log(`  ⚠️  Tool ${toolName} found in search but not loadable`);
        }
      } catch (error) {
        if (verbose) {
          console.log(`  ❌ Failed to load tool ${toolName}: ${error.message}`);
        }
      }
    }
    
    // Sort by confidence
    const sortedTools = toolResults.sort((a, b) => b.confidence - a.confidence);
    
    // Display results
    console.log(`📊 Found ${sortedTools.length} relevant tools:\n`);
    
    sortedTools.forEach((result, index) => {
      console.log(`${index + 1}. ${result.tool.name} (Score: ${(result.confidence * 100).toFixed(1)}%)`);
      console.log(`   Module: ${result.tool.moduleName || 'Unknown'}`);
      console.log(`   Description: ${result.tool.description || 'No description available'}`);
      
      if (result.matchingPerspective.keywords.length > 0) {
        console.log(`   Keywords: ${result.matchingPerspective.keywords.slice(0, 5).join(', ')}`);
      }
      
      if (showDetails) {
        console.log('   Matching Perspective:');
        console.log(`     Type: ${result.matchingPerspective.type}`);
        console.log(`     Content: ${result.matchingPerspective.content}`);
      } else {
        // Show best matching perspective
        console.log(`   Best match: ${result.matchingPerspective.content.substring(0, 150)}...`);
      }
      
      if (verbose && result.tool.inputSchema) {
        console.log('   Input Schema:');
        const params = result.tool.inputSchema.properties || {};
        Object.entries(params).slice(0, 3).forEach(([key, schema]) => {
          const required = result.tool.inputSchema.required?.includes(key) ? ' (required)' : '';
          console.log(`     - ${key}: ${schema.type}${required}`);
        });
      }
      
      console.log();
    });
    
    // Show search statistics
    if (verbose) {
      console.log('📈 Search Statistics:');
      console.log(`  Query length: ${query.length} characters`);
      console.log(`  Embedding dimensions: ${queryEmbedding.length}`);
      console.log(`  Vector results returned: ${searchResults.length}`);
      console.log(`  Perspectives found: ${perspectives.length}`);
      console.log(`  Unique tools loaded: ${sortedTools.length}`);
      console.log(`  Best match score: ${(sortedTools[0]?.confidence * 100).toFixed(1)}%`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error performing semantic search:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

// Extract query (everything that's not a flag)
const queryParts = [];
const options = {
  limit: 10,
  verbose: false,
  showDetails: true
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    options.limit = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--show-details' || args[i] === '--details') {
    options.showDetails = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Semantic Search Script

Usage:
  node scripts/semantic-search.js <query> [options]

Options:
  --limit <n>       Maximum number of results (default: 10)
  --show-details    Show all perspective matches for each tool
  --verbose, -v     Show detailed output and statistics
  --help, -h        Show this help message

Examples:
  node scripts/semantic-search.js "find tools for reading files"
  node scripts/semantic-search.js "how to parse JSON" --limit 5
  node scripts/semantic-search.js "create a web server" --verbose
  node scripts/semantic-search.js "file manipulation" --show-details
  node scripts/semantic-search.js "calculate math expressions" --limit 3 --verbose
    `);
    process.exit(0);
  } else if (!args[i].startsWith('--')) {
    queryParts.push(args[i]);
  }
}

const query = queryParts.join(' ');

// Run the search
semanticSearch(query, options).catch(console.error);