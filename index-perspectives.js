#!/usr/bin/env node

/**
 * Index tool perspectives into Qdrant for semantic search
 */

import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { MongoClient } from 'mongodb';

async function indexPerspectives() {
  console.log('🚀 Starting perspective indexing...');
  
  let client;
  let semanticProvider;
  
  try {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    console.log('✅ ResourceManager initialized');
    
    // Connect to MongoDB
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    client = new MongoClient(mongoUrl);
    await client.connect();
    console.log('✅ MongoDB connected');
    
    const db = client.db('legion_tools');
    
    // Get all perspectives from MongoDB
    const perspectives = await db.collection('tool_perspectives').find({}).toArray();
    console.log(`📊 Found ${perspectives.length} perspectives in MongoDB`);
    
    // Initialize semantic search provider
    semanticProvider = await SemanticSearchProvider.create(resourceManager);
    console.log('✅ Semantic search provider created');
    
    // Create collection in Qdrant with correct dimensions
    console.log('📦 Creating collection in Qdrant...');
    await semanticProvider.createCollection('tool_perspectives', {
      dimension: 768  // Dimension for local embeddings
    });
    
    // Index perspectives in batches
    const batchSize = 100;
    let indexed = 0;
    
    for (let i = 0; i < perspectives.length; i += batchSize) {
      const batch = perspectives.slice(i, i + batchSize);
      
      console.log(`📝 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(perspectives.length/batchSize)}...`);
      
      // Prepare documents for indexing
      const documents = batch.map(perspective => ({
        id: perspective._id.toString(),
        toolName: perspective.toolName,
        perspectiveType: perspective.perspectiveType,
        content: perspective.content,
        searchText: `${perspective.toolName} ${perspective.content}`,
        metadata: {
          toolName: perspective.toolName,
          moduleName: perspective.moduleName,
          perspectiveType: perspective.perspectiveType,
          category: perspective.category,
          tags: perspective.tags || []
        }
      }));
      
      // Insert into semantic search
      await semanticProvider.insert('tool_perspectives', documents);
      indexed += batch.length;
      
      console.log(`  ✅ Indexed ${indexed}/${perspectives.length} perspectives`);
    }
    
    // Verify the collection
    const count = await semanticProvider.count('tool_perspectives');
    console.log(`\n✅ Successfully indexed ${count} perspectives in Qdrant!`);
    
    // Test a sample search
    console.log('\n🧪 Testing semantic search...');
    const testQuery = 'how to read files from disk';
    const results = await semanticProvider.semanticSearch('tool_perspectives', testQuery, {
      limit: 5
    });
    
    console.log(`Found ${results.length} results for "${testQuery}":`);
    results.forEach((result, i) => {
      const metadata = result.document || result.payload || result;
      console.log(`  ${i+1}. ${metadata.toolName || metadata.metadata?.toolName || 'Unknown'}`);
    });
    
  } catch (error) {
    console.error('❌ Indexing failed:', error);
  } finally {
    if (semanticProvider) {
      await semanticProvider.disconnect();
    }
    if (client) {
      await client.close();
    }
  }
}

// Run the indexing
indexPerspectives().catch(console.error);