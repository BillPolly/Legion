/**
 * Debug test to get detailed Qdrant error information
 */

import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { createToolIndexer } from '../../src/search/index.js';
import { ResourceManager } from '@legion/tools';

describe('Qdrant Error Detail Debug', () => {
  let resourceManager;
  let mongoProvider;
  let toolIndexer;
  let loadingManager;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    mongoProvider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });

    toolIndexer = await createToolIndexer(resourceManager);
    
    // Generate test data with embeddings using LoadingManager
    const { LoadingManager } = await import('../../src/loading/LoadingManager.js');
    loadingManager = new LoadingManager({ 
      verbose: false,
      resourceManager 
    });
    
    await loadingManager.initialize();
    await loadingManager.clearAll();
    await loadingManager.loadModules('Calculator');
    await loadingManager.generatePerspectives('Calculator');
    
    console.log('✅ Test data generated with embeddings');
  }, 60000); // 60 second timeout for data generation

  afterAll(async () => {
    if (loadingManager) {
      await loadingManager.close();
    }
    if (mongoProvider) {
      await mongoProvider.disconnect();
    }
  });

  test('should get detailed Qdrant error information', async () => {
    // Get a perspective with valid embedding
    const perspectives = await mongoProvider.databaseService.mongoProvider.find('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    }, { limit: 1 });

    expect(perspectives.length).toBeGreaterThan(0);
    const perspective = perspectives[0];

    // Create minimal test vector
    const testVector = {
      id: 12345, // Use simple numeric ID
      vector: perspective.embedding.slice(0, 384), // Ensure exactly 384 dimensions
      payload: {
        toolName: perspective.toolName
      }
    };

    console.log('Test vector details:');
    console.log('- ID:', testVector.id, typeof testVector.id);
    console.log('- Vector length:', testVector.vector.length);
    console.log('- Vector sample:', testVector.vector.slice(0, 3));
    console.log('- All values finite:', testVector.vector.every(v => isFinite(v)));

    try {
      // Get the Qdrant client directly for detailed error handling
      const qdrantClient = toolIndexer.vectorStore.client;
      
      // Try the upsert with direct error handling
      const result = await qdrantClient.upsert(toolIndexer.collectionName, {
        wait: true,
        points: [testVector]
      });
      
      console.log('✅ Upsert successful:', result);
      
    } catch (error) {
      console.error('❌ Detailed error information:');
      console.error('- Error message:', error.message);
      console.error('- Error name:', error.name);
      console.error('- Error stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
      
      if (error.response) {
        console.error('- Response status:', error.response.status);
        console.error('- Response statusText:', error.response.statusText);
        
        try {
          const responseBody = await error.response.text();
          console.error('- Response body:', responseBody);
          
          // Try to parse JSON error
          try {
            const jsonError = JSON.parse(responseBody);
            console.error('- Parsed error:', JSON.stringify(jsonError, null, 2));
          } catch (parseError) {
            console.error('- Could not parse response as JSON');
          }
        } catch (textError) {
          console.error('- Could not read response text');
        }
      }
      
      // Check if it's a network/connection issue
      if (error.code) {
        console.error('- Error code:', error.code);
      }
      
      throw error;
    }
  });

  test('should verify Qdrant collection configuration', async () => {
    const client = toolIndexer.vectorStore.client;
    
    // Get collection info
    const collections = await client.getCollections();
    console.log('Available collections:', collections.collections.map(c => c.name));
    
    const targetCollection = collections.collections.find(c => c.name === toolIndexer.collectionName);
    if (targetCollection) {
      console.log('Target collection config:', targetCollection);
      
      // Get detailed collection info
      try {
        const collectionInfo = await client.getCollection(toolIndexer.collectionName);
        console.log('Detailed collection info:', JSON.stringify(collectionInfo, null, 2));
      } catch (error) {
        console.error('Could not get detailed collection info:', error.message);
      }
    } else {
      console.error('Target collection not found!');
    }
  });

  test('should test Qdrant connection and basic operations', async () => {
    const client = toolIndexer.vectorStore.client;
    
    // Test basic connection
    try {
      const collections = await client.getCollections();
      console.log('✅ Connection test passed, found', collections.collections.length, 'collections');
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      throw error;
    }
    
    // Test if we can create a simple test collection
    const testCollectionName = `test_collection_${Date.now()}`;
    try {
      await client.createCollection(testCollectionName, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      console.log('✅ Can create collections');
      
      // Try to insert a simple vector
      const simpleVector = {
        id: 999,
        vector: new Array(384).fill(0.1),
        payload: { test: 'value' }
      };
      
      await client.upsert(testCollectionName, {
        wait: true,
        points: [simpleVector]
      });
      console.log('✅ Can insert vectors');
      
      // Cleanup
      await client.deleteCollection(testCollectionName);
      console.log('✅ Test collection cleaned up');
      
    } catch (error) {
      console.error('❌ Basic operations test failed:', error.message);
      throw error;
    }
  });
});