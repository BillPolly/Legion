/**
 * Test to verify collection dimensions are correctly set
 */

import { createToolIndexer } from '../../src/search/index.js';
import { ResourceManager } from '@legion/core';

describe('Collection Dimensions Test', () => {
  let resourceManager;
  let toolIndexer;

  beforeAll(async () => {
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }
    toolIndexer = await createToolIndexer(resourceManager);
  });

  test('should verify legion_tools collection has correct dimensions', async () => {
    const client = toolIndexer.vectorStore.client;
    
    // Get collection info
    const collectionInfo = await client.getCollection('legion_tools');
    console.log('Collection dimensions:', collectionInfo.config.params.vectors.size);
    console.log('Expected dimensions: 384 (ONNX)');
    
    expect(collectionInfo.config.params.vectors.size).toBe(384);
  });

  test('should test vector upsert with 384D vector', async () => {
    const testVector = {
      id: Date.now(),
      vector: new Array(384).fill(0.1), // 384 dimensions
      payload: { test: 'value' }
    };

    console.log('Testing 384D vector upsert...');
    
    try {
      await toolIndexer.vectorStore.upsert('legion_tools', [testVector]);
      console.log('✅ 384D vector upsert successful!');
    } catch (error) {
      console.error('❌ 384D vector upsert failed:', error.message);
      throw error;
    }
  });
});