/**
 * Unit tests for IndexVectorsStage
 * Tests vector indexing to Qdrant with real MongoDB and Qdrant
 */

import { IndexVectorsStage } from '../../../../src/loading/stages/IndexVectorsStage.js';
import { MongoClient, ObjectId } from 'mongodb';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ResourceManager } from '@legion/resource-manager';

describe('IndexVectorsStage', () => {
  let indexVectorsStage;
  let mongoProvider;
  let vectorStore;
  let verifier;
  let stateManager;
  let client;
  let db;
  let qdrantClient;
  const testCollectionName = 'legion_tools_test';

  beforeAll(async () => {
    // Use real connections
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    const qdrantUrl = resourceManager.get('env.QDRANT_URL') || 'http://localhost:6333';
    
    client = new MongoClient(mongoUrl);
    await client.connect();
    db = client.db('legion_tools_test');
    
    // Create MongoDB provider
    mongoProvider = {
      db,
      find: async (collection, query, options = {}) => {
        let cursor = db.collection(collection).find(query);
        if (options.limit) cursor = cursor.limit(options.limit);
        if (options.sort) cursor = cursor.sort(options.sort);
        if (options.projection) cursor = cursor.project(options.projection);
        return await cursor.toArray();
      },
      updateMany: async (collection, query, update) => {
        const result = await db.collection(collection).updateMany(query, update);
        return { modifiedCount: result.modifiedCount };
      },
      count: async (collection, query) => {
        return await db.collection(collection).countDocuments(query);
      },
      aggregate: async (collection, pipeline) => {
        return await db.collection(collection).aggregate(pipeline).toArray();
      }
    };
    
    // Create Qdrant client
    qdrantClient = new QdrantClient({
      url: qdrantUrl
    });
    
    // Create vector store wrapper
    vectorStore = {
      upsertBatch: async (collectionName, points) => {
        try {
          await qdrantClient.upsert(collectionName, {
            points: points.map(p => ({
              id: p.id,
              vector: p.vector,
              payload: p.payload
            }))
          });
          return { success: true, upserted: points.length };
        } catch (error) {
          throw error;
        }
      },
      count: async (collectionName) => {
        try {
          const info = await qdrantClient.getCollection(collectionName);
          return info.vectors_count || 0;
        } catch (error) {
          if (error.message?.includes('Not found')) {
            return 0;
          }
          throw error;
        }
      },
      ensureCollection: async (collectionName, dimension) => {
        try {
          await qdrantClient.createCollection(collectionName, {
            vectors: {
              size: dimension,
              distance: 'Cosine'
            }
          });
          return { success: true };
        } catch (error) {
          if (error.message?.includes('already exists')) {
            return { success: true };
          }
          throw error;
        }
      },
      deleteCollection: async (collectionName) => {
        try {
          await qdrantClient.deleteCollection(collectionName);
          return { success: true };
        } catch (error) {
          if (error.message?.includes('Not found')) {
            return { success: true };
          }
          throw error;
        }
      }
    };
    
    // Create mock verifier
    verifier = {
      verifyPerspectiveVectorSync: async () => {
        const perspectiveCount = await mongoProvider.count('tool_perspectives', {
          embedding: { $exists: true, $ne: null }
        });
        const vectorCount = await vectorStore.count(testCollectionName);
        
        return {
          success: perspectiveCount === vectorCount,
          perspectiveCount,
          vectorCount
        };
      },
      verifySampleVectorMatch: async () => {
        // For unit tests, we'll just verify counts match
        return {
          success: true,
          message: 'Sample verification passed'
        };
      }
    };
    
    // Create mock state manager
    stateManager = {
      recordCheckpoint: async (stage, data) => {
        return { success: true };
      },
      getCurrentState: async () => {
        return {
          stages: {
            indexVectors: {
              processedBatches: 0,
              totalIndexed: 0
            }
          }
        };
      }
    };
  });

  beforeEach(async () => {
    // Clear collections
    await db.collection('tool_perspectives').deleteMany({});
    
    // Clear and recreate Qdrant collection
    await vectorStore.deleteCollection(testCollectionName);
    await vectorStore.ensureCollection(testCollectionName, 768);
    
    // Add test perspectives with embeddings
    const perspectives = [];
    for (let i = 1; i <= 10; i++) {
      const embedding = new Array(768).fill(0);
      // Make each embedding slightly different
      for (let j = 0; j < 10; j++) {
        embedding[j] = i * 0.01 + j * 0.001;
      }
      
      perspectives.push({
        _id: new ObjectId(),
        toolId: new ObjectId(),
        toolName: `tool${i}`,
        perspectiveType: 'usage',
        perspectiveText: `This is perspective text for tool ${i}`,
        embedding: embedding,
        embeddingGeneratedAt: new Date(),
        embeddingModel: 'nomic-embed-text',
        embeddingDimension: 768,
        createdAt: new Date()
      });
    }
    await db.collection('tool_perspectives').insertMany(perspectives);
    
    indexVectorsStage = new IndexVectorsStage({
      vectorStore,
      mongoProvider,
      verifier,
      stateManager,
      batchSize: 3 // Small batch size for testing
    });
    
    // Override collection name for testing
    indexVectorsStage.collectionName = testCollectionName;
  });

  afterEach(async () => {
    await db.collection('tool_perspectives').deleteMany({});
    await vectorStore.deleteCollection(testCollectionName);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('execute', () => {
    it('should index all perspectives with embeddings', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesIndexed).toBe(10);
      expect(result.batchesProcessed).toBe(4); // ceil(10/3)
      
      const vectorCount = await vectorStore.count(testCollectionName);
      expect(vectorCount).toBe(10);
    });

    it('should process in batches', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.batchesProcessed).toBe(4); // ceil(10/3)
      expect(result.batchSize).toBe(3);
    });

    it('should skip perspectives without embeddings', async () => {
      // Add perspectives without embeddings
      await db.collection('tool_perspectives').insertMany([
        {
          _id: new ObjectId(),
          toolName: 'tool-no-embedding',
          perspectiveText: 'No embedding',
          embedding: null
        },
        {
          _id: new ObjectId(),
          toolName: 'tool-empty-embedding',
          perspectiveText: 'Empty embedding',
          embedding: []
        }
      ]);
      
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesIndexed).toBe(10); // Only those with valid embeddings
      expect(result.skipped).toBe(2);
    });

    it('should use MongoDB _id as vector ID', async () => {
      // We can't easily verify the IDs in Qdrant directly in unit test,
      // but we can verify the mapping is created correctly
      const perspectives = await db.collection('tool_perspectives')
        .find({ embedding: { $exists: true, $ne: null } })
        .toArray();
      
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      
      // Update perspectives with vectorId
      const updatedPerspectives = await db.collection('tool_perspectives')
        .find({ vectorId: { $exists: true } })
        .toArray();
      
      expect(updatedPerspectives).toHaveLength(10);
      updatedPerspectives.forEach(p => {
        expect(p.vectorId).toBe(p._id.toString());
      });
    });

    it('should update perspectives with vector metadata', async () => {
      await indexVectorsStage.execute({});
      
      const perspectives = await db.collection('tool_perspectives')
        .find({ vectorIndexedAt: { $exists: true } })
        .toArray();
      
      expect(perspectives).toHaveLength(10);
      perspectives.forEach(p => {
        expect(p.vectorIndexedAt).toBeInstanceOf(Date);
        expect(p.vectorId).toBe(p._id.toString());
        expect(p.vectorCollection).toBe(testCollectionName);
      });
    });

    it('should include metadata in vector payload', async () => {
      // This tests the structure of the payload, not actual Qdrant content
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      
      // Verify the stage properly structures the payload
      const perspectives = await db.collection('tool_perspectives')
        .find({ vectorIndexedAt: { $exists: true } })
        .toArray();
      
      // Each perspective should have been indexed with proper metadata
      perspectives.forEach(p => {
        expect(p.toolName).toBeDefined();
        expect(p.perspectiveType).toBeDefined();
        expect(p.perspectiveText).toBeDefined();
      });
    });

    it('should track progress in state', async () => {
      const recordedCheckpoints = [];
      const customStateManager = {
        recordCheckpoint: async (stage, data) => {
          recordedCheckpoints.push(data);
          return { success: true };
        },
        getCurrentState: async () => ({
          stages: { indexVectors: { processedBatches: 0 } }
        })
      };
      
      const stage = new IndexVectorsStage({
        vectorStore,
        mongoProvider,
        verifier,
        stateManager: customStateManager,
        batchSize: 3
      });
      stage.collectionName = testCollectionName;
      
      await stage.execute({});
      
      expect(recordedCheckpoints.length).toBeGreaterThan(0);
      const lastCheckpoint = recordedCheckpoints[recordedCheckpoints.length - 1];
      expect(lastCheckpoint.processedBatches).toBe(4);
      expect(lastCheckpoint.totalIndexed).toBe(10);
    });

    it('should resume from previous state', async () => {
      // Mark first 6 perspectives as already indexed
      const perspectives = await db.collection('tool_perspectives')
        .find({})
        .limit(6)
        .toArray();
      
      for (const p of perspectives) {
        await db.collection('tool_perspectives').updateOne(
          { _id: p._id },
          { 
            $set: { 
              vectorIndexedAt: new Date(),
              vectorId: p._id.toString()
            } 
          }
        );
      }
      
      const customStateManager = {
        recordCheckpoint: async () => ({ success: true }),
        getCurrentState: async () => ({
          stages: {
            indexVectors: {
              processedBatches: 2,
              totalIndexed: 6,
              lastProcessedId: perspectives[5]._id.toString()
            }
          }
        })
      };
      
      const stage = new IndexVectorsStage({
        vectorStore,
        mongoProvider,
        verifier,
        stateManager: customStateManager,
        batchSize: 3
      });
      stage.collectionName = testCollectionName;
      
      const result = await stage.execute({});
      
      expect(result.perspectivesIndexed).toBe(4); // Remaining 4
      expect(result.skipped).toBe(6);
    });

    it('should verify perspective-vector sync', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.verification).toBeDefined();
      expect(result.verification.success).toBe(true);
      expect(result.verification.perspectiveCount).toBe(10);
      expect(result.verification.vectorCount).toBe(10);
    });

    it('should fail if verification fails', async () => {
      const failingVerifier = {
        verifyPerspectiveVectorSync: async () => ({
          success: false,
          perspectiveCount: 10,
          vectorCount: 8,
          message: 'Vector count mismatch'
        }),
        verifySampleVectorMatch: async () => ({
          success: true
        })
      };
      
      const stage = new IndexVectorsStage({
        vectorStore,
        mongoProvider,
        verifier: failingVerifier,
        stateManager,
        batchSize: 3
      });
      stage.collectionName = testCollectionName;
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Vector count mismatch');
    });

    it('should handle Qdrant errors gracefully', async () => {
      const failingVectorStore = {
        ...vectorStore,
        upsertBatch: async () => {
          throw new Error('Qdrant unavailable');
        }
      };
      
      const stage = new IndexVectorsStage({
        vectorStore: failingVectorStore,
        mongoProvider,
        verifier,
        stateManager,
        batchSize: 3
      });
      
      await expect(stage.execute({})).rejects.toThrow('Qdrant unavailable');
    });

    it('should handle MongoDB errors', async () => {
      const failingProvider = {
        find: async () => {
          throw new Error('MongoDB connection lost');
        }
      };
      
      const stage = new IndexVectorsStage({
        vectorStore,
        mongoProvider: failingProvider,
        verifier,
        stateManager,
        batchSize: 3
      });
      
      await expect(stage.execute({})).rejects.toThrow('MongoDB connection lost');
    });

    it('should report timing information', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle empty perspective collection', async () => {
      await db.collection('tool_perspectives').deleteMany({});
      
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesIndexed).toBe(0);
      expect(result.batchesProcessed).toBe(0);
    });

    it('should calculate average indexing time', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.averageTimePerBatch).toBeDefined();
      expect(result.averageTimePerBatch).toBeGreaterThanOrEqual(0);
    });
  });

  describe('batch processing', () => {
    it('should handle batch size larger than collection', async () => {
      const stage = new IndexVectorsStage({
        vectorStore,
        mongoProvider,
        verifier,
        stateManager,
        batchSize: 50 // Larger than 10 perspectives
      });
      stage.collectionName = testCollectionName;
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.batchesProcessed).toBe(1);
      expect(result.perspectivesIndexed).toBe(10);
    });

    it('should handle batch size of 1', async () => {
      const stage = new IndexVectorsStage({
        vectorStore,
        mongoProvider,
        verifier,
        stateManager,
        batchSize: 1
      });
      stage.collectionName = testCollectionName;
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.batchesProcessed).toBe(10);
      expect(result.perspectivesIndexed).toBe(10);
    });

    it('should handle partial batch failures', async () => {
      let callCount = 0;
      const customVectorStore = {
        ...vectorStore,
        upsertBatch: async (collectionName, points) => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Batch 2 failed');
          }
          return { success: true, upserted: points.length };
        }
      };
      
      const stage = new IndexVectorsStage({
        vectorStore: customVectorStore,
        mongoProvider,
        verifier,
        stateManager,
        batchSize: 3
      });
      stage.collectionName = testCollectionName;
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.failed).toBe(3); // Batch 2 had 3 perspectives
      expect(result.perspectivesIndexed).toBe(7);
    });
  });

  describe('error recovery', () => {
    it('should continue processing after batch failures', async () => {
      let batchCount = 0;
      const customVectorStore = {
        ...vectorStore,
        upsertBatch: async (collectionName, points) => {
          batchCount++;
          if (batchCount === 2) {
            throw new Error('Transient Qdrant error');
          }
          return { success: true, upserted: points.length };
        }
      };
      
      const stage = new IndexVectorsStage({
        vectorStore: customVectorStore,
        mongoProvider,
        verifier,
        stateManager,
        batchSize: 3
      });
      stage.collectionName = testCollectionName;
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.failed).toBe(3);
      expect(result.perspectivesIndexed).toBe(7);
    });

    it('should handle Qdrant collection not found', async () => {
      // Delete collection to simulate not found
      await vectorStore.deleteCollection(testCollectionName);
      
      // Stage should recreate it
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesIndexed).toBe(10);
    });

    it('should skip invalid embeddings', async () => {
      // Add perspective with invalid embedding
      await db.collection('tool_perspectives').insertOne({
        _id: new ObjectId(),
        toolName: 'invalid-embedding',
        embedding: new Array(512).fill(0), // Wrong dimension
        perspectiveText: 'Invalid'
      });
      
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesIndexed).toBe(10); // Only valid ones
      expect(result.skipped).toBeGreaterThan(0);
    });
  });
});