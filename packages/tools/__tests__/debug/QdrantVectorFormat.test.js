/**
 * Debug test for Qdrant vector format issues in ToolIndexer
 * 
 * This test examines the exact vector format being sent to Qdrant
 * to identify why upserts are failing with "Bad Request" errors.
 */

import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { createToolIndexer } from '../../src/search/index.js';
import { ResourceManager } from '@legion/core';

describe('Qdrant Vector Format Debug', () => {
  let resourceManager;
  let mongoProvider;
  let toolIndexer;
  let loadingManager;

  beforeAll(async () => {
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }

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

  test('should examine perspective data format in MongoDB', async () => {
    // Get a perspective with embedding from MongoDB
    const perspectives = await mongoProvider.databaseService.mongoProvider.find('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    }, { limit: 1 });

    expect(perspectives.length).toBeGreaterThan(0);

    const perspective = perspectives[0];
    console.log('MongoDB perspective structure:');
    console.log('- embeddingId:', perspective.embeddingId);
    console.log('- embedding type:', Array.isArray(perspective.embedding) ? 'array' : typeof perspective.embedding);
    console.log('- embedding length:', perspective.embedding?.length);
    console.log('- toolId type:', typeof perspective.toolId);
    console.log('- perspectiveType:', perspective.perspectiveType);

    // Check if embedding values are valid numbers
    if (perspective.embedding) {
      const sample = perspective.embedding.slice(0, 5);
      console.log('- first 5 embedding values:', sample);
      console.log('- all values are numbers:', sample.every(v => typeof v === 'number'));
      console.log('- any NaN values:', sample.some(v => isNaN(v)));
      console.log('- any infinite values:', sample.some(v => !isFinite(v)));
    }

    expect(perspective.embedding).toBeDefined();
    expect(Array.isArray(perspective.embedding)).toBe(true);
    expect(perspective.embedding.length).toBe(384); // ONNX model output size
  });

  test('should examine vector format created by LoadingManager', async () => {
    // Get perspectives from MongoDB (same as LoadingManager does)
    const perspectives = await mongoProvider.databaseService.mongoProvider.find('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    }, { limit: 2 });

    expect(perspectives.length).toBeGreaterThan(0);

    // Transform to Qdrant format (same as LoadingManager does)
    const vectors = perspectives.map((perspective, index) => ({
      id: perspective.embeddingId || `tool_${perspective.toolName}_${perspective.perspectiveType}_${Date.now() + index}`,
      vector: Array.from(perspective.embedding),
      payload: {
        perspectiveId: perspective._id?.toString(),
        toolId: perspective.toolId?.toString(),
        toolName: perspective.toolName,
        perspectiveType: perspective.perspectiveType
      }
    }));

    console.log('Vector format for Qdrant:');
    const firstVector = vectors[0];
    console.log('- id type:', typeof firstVector.id);
    console.log('- id length:', firstVector.id?.length);
    console.log('- vector type:', Array.isArray(firstVector.vector) ? 'array' : typeof firstVector.vector);
    console.log('- vector length:', firstVector.vector?.length);
    console.log('- payload keys:', Object.keys(firstVector.payload));
    console.log('- payload.toolId type:', typeof firstVector.payload.toolId);

    // Validate vector format requirements
    expect(firstVector.id).toBeDefined();
    expect(typeof firstVector.id).toBe('string');
    expect(Array.isArray(firstVector.vector)).toBe(true);
    expect(firstVector.vector.length).toBe(384);
    expect(firstVector.vector.every(v => typeof v === 'number')).toBe(true);
    expect(firstVector.vector.every(v => isFinite(v))).toBe(true);
    expect(typeof firstVector.payload).toBe('object');
  });

  test('should test direct Qdrant upsert with proper format', async () => {
    // Get a single perspective
    const perspectives = await mongoProvider.databaseService.mongoProvider.find('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    }, { limit: 1 });

    const perspective = perspectives[0];
    
    // Create a properly formatted vector
    const testVector = {
      id: `test_${Date.now()}`, // Simple string ID
      vector: Array.from(perspective.embedding), // Ensure it's a regular array
      payload: {
        toolName: perspective.toolName,
        perspectiveType: perspective.perspectiveType
      }
    };

    console.log('Testing direct Qdrant upsert...');
    console.log('- Vector ID:', testVector.id);
    console.log('- Vector dimensions:', testVector.vector.length);
    console.log('- Payload:', testVector.payload);

    // Test if this single vector can be upserted
    try {
      await toolIndexer.vectorStore.upsert(toolIndexer.collectionName, [testVector]);
      console.log('✅ Direct upsert successful');
    } catch (error) {
      console.error('❌ Direct upsert failed:', error.message);
      if (error.response) {
        const responseText = await error.response.text();
        console.error('Response body:', responseText);
      }
      throw error;
    }
  });

  test('should identify the exact cause of Qdrant Bad Request', async () => {
    // Test various potential issues with vector format

    const perspective = await mongoProvider.databaseService.mongoProvider.findOne('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    });

    // Test 1: ID format issues
    const testCases = [
      {
        name: 'String ID with underscores',
        vector: {
          id: 'tool_json_parse_name_123456',
          vector: Array.from(perspective.embedding),
          payload: { test: 'value' }
        }
      },
      {
        name: 'Simple numeric string ID',
        vector: {
          id: String(Date.now()),
          vector: Array.from(perspective.embedding),
          payload: { test: 'value' }
        }
      },
      {
        name: 'Numeric ID',
        vector: {
          id: Date.now(),
          vector: Array.from(perspective.embedding),
          payload: { test: 'value' }
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`Testing: ${testCase.name}`);
      try {
        await toolIndexer.vectorStore.upsert(toolIndexer.collectionName, [testCase.vector]);
        console.log(`✅ ${testCase.name} - SUCCESS`);
      } catch (error) {
        console.log(`❌ ${testCase.name} - FAILED: ${error.message}`);
      }
    }
  });
});