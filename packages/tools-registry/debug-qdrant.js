import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import { LoadingManager } from './src/loading/LoadingManager.js';

async function debugQdrantIndexing() {
  console.log('🔍 Debugging Qdrant vector indexing...\n');
  
  const rm = new ResourceManager();
  await rm.initialize();
  
  const loadingManager = new LoadingManager({
    resourceManager: rm,
    verbose: true
  });
  
  await loadingManager.initialize();
  
  // Load modules first, then initialize semantic search
  console.log('📦 Loading modules first...');
  await loadingManager.loadModules({ module: 'json' }); // Load a small module
  console.log('✅ Modules loaded');
  
  // Ensure semantic search (toolIndexer) is initialized
  console.log('🔧 Initializing semantic search components...');
  await loadingManager.generatePerspectives({ module: 'json' }); // This will initialize toolIndexer
  console.log('✅ Semantic search initialized');
  
  // Get first few perspectives to test indexing
  const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
  const perspectives = await provider.databaseService.mongoProvider.find('tool_perspectives', { 
    embedding: { $exists: true, $ne: null } 
  }, { limit: 3 });
  
  console.log('Found', perspectives.length, 'perspectives with embeddings');
  
  if (perspectives.length === 0) {
    console.log('❌ No perspectives with embeddings found');
    return;
  }
  
  console.log('\n📋 Sample perspective data:');
  const sample = perspectives[0];
  console.log('  ID:', sample._id.toString());
  console.log('  Tool:', sample.toolName);
  console.log('  Type:', sample.perspectiveType);
  console.log('  Embedding length:', sample.embedding.length);
  console.log('  Embedding type:', typeof sample.embedding);
  console.log('  Is array:', Array.isArray(sample.embedding));
  console.log('  First 3 values:', sample.embedding.slice(0, 3));
  
  // Transform to vector format (same as LoadingManager)
  const vectors = perspectives.map((perspective, index) => ({
    id: perspective._id?.toString() || `tool_${perspective.toolName}_${perspective.perspectiveType}_${index}`,
    vector: Array.from(perspective.embedding), // Ensure it's a regular array
    payload: {
      perspectiveId: perspective._id?.toString(),
      toolId: perspective.toolId?.toString(),
      toolName: perspective.toolName,
      perspectiveType: perspective.perspectiveType
    }
  }));
  
  console.log('\n🔍 Transformed vector data:');
  console.log('  Vector count:', vectors.length);
  console.log('  Sample vector ID:', vectors[0].id);
  console.log('  Sample vector length:', vectors[0].vector.length);
  console.log('  Sample vector type:', typeof vectors[0].vector);
  console.log('  Sample vector is array:', Array.isArray(vectors[0].vector));
  console.log('  Sample vector first 3:', vectors[0].vector.slice(0, 3));
  console.log('  Sample payload:', vectors[0].payload);
  
  try {
    // Test vector store upsert
    console.log('\n🚀 Testing vector store upsert...');
    await loadingManager.toolIndexer.vectorStore.upsert(loadingManager.toolIndexer.collectionName, vectors);
    console.log('✅ Vector upsert successful');
    
    // Check count in Qdrant
    const count = await loadingManager.toolIndexer.vectorStore.count(loadingManager.toolIndexer.collectionName);
    console.log('📊 Vectors in Qdrant:', count);
    
    // Test search with first vector
    const searchVector = vectors[0].vector;
    console.log('\n🔍 Testing vector search...');
    const results = await loadingManager.toolIndexer.vectorStore.search(
      loadingManager.toolIndexer.collectionName, 
      searchVector,
      { limit: 3, includeVectors: true }
    );
    
    console.log('Search results:', results.length);
    if (results.length > 0) {
      console.log('  First result score:', results[0].score);
      console.log('  First result payload:', results[0].payload);
      console.log('  First result vector length:', results[0].vector?.length || 'no vector');
    }
    
  } catch (error) {
    console.error('❌ Vector indexing failed:', error.message);
    console.error('Stack:', error.stack);
  }
  
  await loadingManager.close();
  await provider.disconnect();
}

debugQdrantIndexing().catch(console.error);