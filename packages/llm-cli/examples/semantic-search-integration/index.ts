import { createInterface } from 'readline';
import { LLMCLIFramework } from '../../src';
import { MockLLMProvider } from '../../src/core/providers/MockLLMProvider';
import { MongoDocumentStorage } from '@search-demo/semantic-search';
import { VectorStorage } from '@search-demo/semantic-search';
import { EmbeddingService } from '@search-demo/semantic-search';
import { SearchService } from '@search-demo/semantic-search';
import { SyncService } from '@search-demo/semantic-search';
import { MockProvider } from '@search-demo/llm';

// Initialize the LLM provider for embeddings
const llmProvider = new MockProvider();

// Initialize storage
const mongoStorage = new MongoDocumentStorage();
const vectorStorage = new VectorStorage();

// Initialize services
const embeddingService = new EmbeddingService({ llmProvider });
const searchService = new SearchService({
  mongoStorage,
  vectorStorage,
  embeddingService
});
const syncService = new SyncService({
  mongoStorage,
  vectorStorage,
  embeddingService
});

// Initialize LLM CLI Framework
const framework = new LLMCLIFramework({
  llmProvider: new MockLLMProvider(),
  config: {
    name: 'semantic-search-cli',
    version: '1.0.0',
    description: 'Natural language interface for semantic search'
  }
});

// Register search command
framework.registerCommand({
  name: 'search',
  description: 'Search for documents using semantic search',
  aliases: ['find', 'query', 'look for'],
  parameters: {
    query: {
      type: 'string',
      description: 'The search query',
      required: true
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results',
      required: false,
      default: 10
    },
    threshold: {
      type: 'number',
      description: 'Minimum similarity score (0-1)',
      required: false,
      default: 0.7
    }
  },
  handler: async (args) => {
    try {
      const results = await searchService.semanticSearch(args.query as string, {
        limit: args.limit as number,
        threshold: args.threshold as number
      });

      if (!results.success) {
        return {
          success: false,
          error: results.error || 'Search failed'
        };
      }

      if (!results.results || results.results.length === 0) {
        return {
          success: true,
          output: 'No results found for your query.'
        };
      }

      const output = results.results
        .map((result, index) => {
          const doc = result.document;
          return `${index + 1}. ${doc.title || 'Untitled'} (Score: ${(result.score * 100).toFixed(1)}%)
   Content: ${doc.content ? doc.content.substring(0, 200) : 'No content'}...
   ID: ${doc._id}`;
        })
        .join('\n\n');

      return {
        success: true,
        output: `Found ${results.results.length} results:\n\n${output}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
});

// Register sync command
framework.registerCommand({
  name: 'sync',
  description: 'Synchronize the search index',
  aliases: ['rebuild', 'reindex'],
  handler: async () => {
    try {
      const result = await syncService.rebuildIndex();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Sync failed'
        };
      }

      return {
        success: true,
        output: `Index rebuild completed:
- Total documents: ${result.totalDocuments}
- Processed: ${result.processedDocuments}
- Failed: ${result.failedDocuments}
${result.errors && result.errors.length > 0 ? `\nErrors:\n${result.errors.join('\n')}` : ''}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
});

// Register stats command
framework.registerCommand({
  name: 'stats',
  description: 'Show index statistics',
  aliases: ['status', 'info'],
  handler: async () => {
    try {
      const stats = await syncService.getStats();
      
      return {
        success: true,
        output: `Index Statistics:
- MongoDB documents: ${stats.totalMongoDocuments}
- Vector documents: ${stats.totalVectorDocuments}
- Synced documents: ${stats.syncedDocuments}
- Unsynced documents: ${stats.unsyncedDocuments}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
});

// Create readline interface
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'semantic-search> '
});

// Main function
async function main() {
  console.log('\n🔍 Welcome to the Semantic Search CLI (Integrated Version)!');
  console.log('\nThis uses the REAL semantic search services with MongoDB and Qdrant.');
  console.log('\nMake sure MongoDB and Qdrant are running:');
  console.log('  • MongoDB: default connection');
  console.log('  • Qdrant: http://localhost:6333');
  console.log('\nTry commands like:');
  console.log('  • "Find documents about machine learning"');
  console.log('  • "Search for papers with limit 5"');
  console.log('  • "Show me statistics"');
  console.log('  • "Rebuild the index"');
  console.log('\nType "help" for more commands or "exit" to quit.\n');

  try {
    // Connect to MongoDB
    await mongoStorage.connect();
    console.log('✅ Connected to MongoDB');
    
    // Initialize the framework
    await framework.initialize();
    console.log('✅ Framework initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    process.exit(1);
  }

  // Show prompt
  rl.prompt();

  // Handle user input
  rl.on('line', async (input: string) => {
    const trimmedInput = input.trim();
    
    if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
      console.log('\nClosing connections...');
      await mongoStorage.disconnect();
      console.log('Goodbye! 👋\n');
      rl.close();
      process.exit(0);
    }
    
    if (trimmedInput === '') {
      rl.prompt();
      return;
    }
    
    try {
      // Process the input
      const result = await framework.processInput(trimmedInput);
      console.log('\n' + result.response + '\n');
    } catch (error) {
      console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
      console.log('');
    }
    
    rl.prompt();
  });

  // Handle Ctrl+C
  rl.on('SIGINT', async () => {
    console.log('\n\nClosing connections...');
    await mongoStorage.disconnect();
    console.log('Goodbye! 👋\n');
    process.exit(0);
  });
}

// Run the CLI
main().catch(error => {
  console.error('Failed to start CLI:', error);
  process.exit(1);
});