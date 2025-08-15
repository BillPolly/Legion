/**
 * Test to manually recreate collection with correct dimensions
 */

import { createToolIndexer } from '../../src/search/index.js';
import { ResourceManager } from '@legion/core';

describe('Recreate Collection Test', () => {
  let resourceManager;
  let toolIndexer;

  beforeAll(async () => {
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }
    toolIndexer = await createToolIndexer(resourceManager);
  });

  test('should manually recreate legion_tools collection with 384 dimensions', async () => {
    const client = toolIndexer.vectorStore.client;
    const collectionName = 'legion_tools';
    
    console.log('🧹 Deleting existing collection...');
    try {
      await client.deleteCollection(collectionName);
      console.log('✅ Collection deleted');
    } catch (error) {
      console.log('⚠️ Collection might not exist:', error.message);
    }

    console.log('📝 Creating collection with 384 dimensions...');
    await client.createCollection(collectionName, {
      vectors: {
        size: 384, // ONNX embedding dimensions
        distance: 'Cosine'
      }
    });
    console.log('✅ Collection created with 384 dimensions');

    // Verify the collection has correct dimensions
    const collectionInfo = await client.getCollection(collectionName);
    console.log('Collection dimensions:', collectionInfo.config.params.vectors.size);
    
    expect(collectionInfo.config.params.vectors.size).toBe(768);
  });

  test('should test vector upsert with 768D vector after recreation', async () => {
    const testVector = {
      id: Date.now(),
      vector: new Array(768).fill(0.1), // 768 dimensions
      payload: { test: 'recreated' }
    };

    console.log('Testing 768D vector upsert on recreated collection...');
    
    try {
      await toolIndexer.vectorStore.upsert('legion_tools', [testVector]);
      console.log('✅ 768D vector upsert successful on recreated collection!');
      
      // Verify the vector was stored
      const count = await toolIndexer.vectorStore.count('legion_tools');
      console.log('✅ Collection now has', count, 'vectors');
      
    } catch (error) {
      console.error('❌ 384D vector upsert failed:', error.message);
      throw error;
    }
  });
});