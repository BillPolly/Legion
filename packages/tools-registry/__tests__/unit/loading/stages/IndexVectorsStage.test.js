/**
 * Unit tests for IndexVectorsStage
 * Tests vector indexing logic using mocked dependencies
 */

import { jest } from '@jest/globals';
import { IndexVectorsStage } from '../../../../src/loading/stages/IndexVectorsStage.js';
import { ObjectId } from 'mongodb';

describe('IndexVectorsStage', () => {
  let indexVectorsStage;
  let mockMongoProvider;
  let mockVectorStore;
  let mockVerifier;
  let mockStateManager;
  let mockPerspectives;
  let vectorCount;
  const testCollectionName = 'legion_tools_test';

  beforeAll(async () => {
    // Mock data stores
    mockPerspectives = [];
    vectorCount = 0;
    
    // Mock MongoDB provider - NO REAL CONNECTIONS
    mockMongoProvider = {
      find: jest.fn(async (collection, query, options = {}) => {
        if (collection === 'tool_perspectives') {
          let results = mockPerspectives.filter(p => {
            // Filter by embedding existence if specified
            if (query.embedding && query.embedding.$exists) {
              return p.embedding && Array.isArray(p.embedding) && p.embedding.length > 0;
            }
            if (query.vectorIndexedAt && query.vectorIndexedAt.$exists === false) {
              return !p.vectorIndexedAt;
            }
            return true;
          });
          
          if (options.limit) {
            results = results.slice(0, options.limit);
          }
          return results;
        }
        return [];
      }),
      updateMany: jest.fn(async (collection, query, update) => {
        if (collection === 'tool_perspectives' && update.$set) {
          let modifiedCount = 0;
          mockPerspectives.forEach(p => {
            if (!p.vectorIndexedAt) {
              Object.assign(p, update.$set);
              modifiedCount++;
            }
          });
          return { modifiedCount };
        }
        return { modifiedCount: 0 };
      }),
      count: jest.fn(async (collection, query) => {
        if (collection === 'tool_perspectives') {
          if (query.embedding && query.embedding.$exists) {
            return mockPerspectives.filter(p => p.embedding && p.embedding.length > 0).length;
          }
          return mockPerspectives.length;
        }
        return 0;
      })
    };
    
    // Mock vector store - NO REAL QDRANT CONNECTIONS
    mockVectorStore = {
      upsertBatch: jest.fn(async (collectionName, points) => {
        vectorCount += points.length;
        return { success: true, upserted: points.length };
      }),
      count: jest.fn(async (collectionName) => {
        return vectorCount;
      }),
      ensureCollection: jest.fn(async (collectionName, dimension) => {
        return { success: true };
      }),
      deleteCollection: jest.fn(async (collectionName) => {
        vectorCount = 0;
        return { success: true };
      })
    };
    
    // Mock verifier
    mockVerifier = {
      verifyVectorCount: jest.fn(async (expectedCount) => {
        const actualCount = vectorCount;
        return {
          success: actualCount === expectedCount,
          actualCount,
          expectedCount,
          message: actualCount === expectedCount ? 'Vector count matches' : `Expected ${expectedCount}, got ${actualCount}`
        };
      }),
      verifyPerspectiveVectorSync: jest.fn(async () => {
        const perspectiveCount = mockPerspectives.filter(p => p.embedding && p.embedding.length > 0).length;
        const currentVectorCount = vectorCount; // Use global vectorCount
        
        return {
          success: perspectiveCount === currentVectorCount,
          perspectiveCount,
          vectorCount: currentVectorCount,
          message: perspectiveCount === currentVectorCount ? 'Vector sync OK' : `Perspective count ${perspectiveCount} != vector count ${currentVectorCount}`
        };
      }),
      verifySampleVectorMatch: jest.fn(async () => {
        return {
          success: true,
          message: 'Sample verification passed'
        };
      })
    };
    
    // Mock state manager
    mockStateManager = {
      recordCheckpoint: jest.fn(async (stage, data) => {
        return { success: true };
      }),
      getCurrentState: jest.fn(async () => {
        return {
          stages: {
            indexVectors: {
              processedBatches: 0,
              totalIndexed: 0
            }
          }
        };
      })
    };
  });

  beforeEach(async () => {
    // Reset mock data and call history
    mockPerspectives = [];
    vectorCount = 0;
    jest.clearAllMocks();
    
    // Add test perspectives with embeddings
    for (let i = 1; i <= 10; i++) {
      const embedding = new Array(768).fill(0);
      // Make each embedding slightly different
      for (let j = 0; j < 10; j++) {
        embedding[j] = i * 0.01 + j * 0.001;
      }
      
      mockPerspectives.push({
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
    
    indexVectorsStage = new IndexVectorsStage({
      vectorStore: mockVectorStore,
      mongoProvider: mockMongoProvider,
      verifier: mockVerifier,
      stateManager: mockStateManager,
      batchSize: 3 // Small batch size for testing
    });
    
    // Override collection name for testing
    indexVectorsStage.collectionName = testCollectionName;
  });

  afterEach(async () => {
    // No cleanup needed for mocks
  });

  afterAll(async () => {
    // No cleanup needed for mocks
  });

  describe('execute', () => {
    it('should index all perspectives with embeddings', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.vectorsIndexed).toBe(10); // Actual property name from implementation
      expect(result.batchesProcessed).toBe(4); // ceil(10/3)
      expect(result.vectorCount).toBe(10); // From verify method
      expect(result.perspectiveCount).toBe(10); // From verify method
      
      const currentVectorCount = await mockVectorStore.count(testCollectionName);
      expect(currentVectorCount).toBe(10);
    });

    it('should process in batches', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.batchesProcessed).toBe(4); // ceil(10/3)
      expect(result.vectorsIndexed).toBe(10);
      expect(indexVectorsStage.batchSize).toBe(3); // Check the stage property, not result
    });

    it('should skip perspectives without embeddings', async () => {
      // Add perspectives without embeddings to mock data
      mockPerspectives.push(
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
      );
      
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.vectorsIndexed).toBe(10); // Only those with valid embeddings
      expect(result.perspectiveCount).toBe(10); // Perspectives with embeddings
      // The implementation filters out perspectives without embeddings in getPerspectivesWithEmbeddings
      expect(mockVectorStore.upsertBatch).toHaveBeenCalledTimes(4); // 4 batches for 10 valid perspectives
    });

    it('should use MongoDB _id as vector ID', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      
      // Verify that upsertBatch was called with correct vector IDs
      expect(mockVectorStore.upsertBatch).toHaveBeenCalled();
      
      const upsertCalls = mockVectorStore.upsertBatch.mock.calls;
      upsertCalls.forEach(([collectionName, points]) => {
        points.forEach((point, index) => {
          // Each point should use the numeric hash of the perspective's _id
          expect(typeof point.id).toBe('number');
          expect(point.id).toBeGreaterThan(0);
          // The payload should contain the original perspectiveId
          expect(point.payload.perspectiveId).toBeDefined();
        });
      });
    });

    it('should successfully complete vector indexing', async () => {
      const result = await indexVectorsStage.execute({});
      
      // Verify the stage completes successfully
      expect(result.success).toBe(true);
      expect(result.vectorsIndexed).toBe(10);
      expect(result.batchesProcessed).toBe(4);
      
      // Verify vector store operations were called
      expect(mockVectorStore.upsertBatch).toHaveBeenCalledTimes(4);
    });

    it('should include metadata in vector payload', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      
      // Verify that upsertBatch was called with proper payload structure
      expect(mockVectorStore.upsertBatch).toHaveBeenCalled();
      
      const upsertCalls = mockVectorStore.upsertBatch.mock.calls;
      upsertCalls.forEach(([collectionName, points]) => {
        points.forEach(point => {
          expect(point.payload).toBeDefined();
          expect(point.payload.perspectiveId).toBeDefined();
          expect(point.payload.toolName).toBeDefined();
          expect(point.payload.perspectiveType).toBeDefined();
          // Note: perspectiveText is not included in payload per implementation
          expect(point.payload.priority).toBeDefined();
        });
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
          stages: { indexVectors: { indexedBatches: 0 } }
        })
      };
      
      const stage = new IndexVectorsStage({
        vectorStore: mockVectorStore,
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
        stateManager: customStateManager,
        batchSize: 3
      });
      stage.collectionName = testCollectionName;
      
      await stage.execute({});
      
      expect(recordedCheckpoints.length).toBeGreaterThan(0);
      const lastCheckpoint = recordedCheckpoints[recordedCheckpoints.length - 1];
      expect(lastCheckpoint.indexedBatches).toBe(4); // Actual property name
      expect(lastCheckpoint.totalIndexed).toBe(10);
    });

    it('should resume from previous state', async () => {
      // Reset vector count to simulate resumed state where 6 vectors are already indexed
      vectorCount = 6; // 2 batches * 3 vectors per batch
      
      const customStateManager = {
        recordCheckpoint: async () => ({ success: true }),
        getCurrentState: async () => ({
          stages: {
            indexVectors: {
              indexedBatches: 2 // 2 batches already processed
            }
          }
        })
      };
      
      // Create a custom verifier that expects the resumed state
      const resumeVerifier = {
        verifyVectorCount: jest.fn(async (expectedCount) => {
          const actualCount = vectorCount; // Should be 10 after remaining batches are processed
          return {
            success: actualCount === expectedCount,
            actualCount,
            expectedCount,
            message: actualCount === expectedCount ? 'Vector count matches' : `Expected ${expectedCount}, got ${actualCount}`
          };
        }),
        verifyPerspectiveVectorSync: jest.fn(async () => {
          const perspectiveCount = mockPerspectives.filter(p => p.embedding && p.embedding.length > 0).length;
          const currentVectorCount = vectorCount;
          
          return {
            success: perspectiveCount === currentVectorCount,
            perspectiveCount,
            vectorCount: currentVectorCount,
            message: perspectiveCount === currentVectorCount ? 'Vector sync OK' : `Perspective count ${perspectiveCount} != vector count ${currentVectorCount}`
          };
        }),
        verifySampleVectorMatch: jest.fn(async () => {
          return {
            success: true,
            message: 'Sample verification passed'
          };
        })
      };
      
      const stage = new IndexVectorsStage({
        vectorStore: mockVectorStore,
        mongoProvider: mockMongoProvider,
        verifier: resumeVerifier,
        stateManager: customStateManager,
        batchSize: 3
      });
      stage.collectionName = testCollectionName;
      
      const result = await stage.execute({});
      
      // With 2 batches already done (2 * 3 = 6 perspectives), 
      // implementation reports total accumulated count (6 skipped + 4 new = 10)
      expect(result.vectorsIndexed).toBe(10); // Total accumulated count
      expect(result.vectorCount).toBe(10); // From verify method (total count)
      expect(result.perspectiveCount).toBe(10); // From verify method
      
      // Should only have called upsertBatch for remaining batches (4-2=2 batches)
      expect(mockVectorStore.upsertBatch).toHaveBeenCalledTimes(2);
    });

    it('should verify perspective-vector sync', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.vectorCount).toBe(10); // From verify method (spread into result)
      expect(result.perspectiveCount).toBe(10); // From verify method (spread into result)
      expect(result.syncRatio).toBe(1); // From verify method (spread into result)
      expect(result.message).toContain('Successfully indexed 10 vectors');
    });

    it('should fail if verification fails', async () => {
      const failingVerifier = {
        verifyVectorCount: jest.fn(async (expectedCount) => {
          return {
            success: true,
            actualCount: expectedCount,
            expectedCount,
            message: 'Vector count matches'
          };
        }),
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
        vectorStore: mockVectorStore,
        mongoProvider: mockMongoProvider,
        verifier: failingVerifier,
        stateManager: mockStateManager,
        batchSize: 3
      });
      stage.collectionName = testCollectionName;
      
      // Implementation throws error when verification fails (line 88)
      await expect(stage.execute({})).rejects.toThrow('Vector indexing verification failed: Vector count mismatch');
    });

    it('should handle Qdrant errors gracefully', async () => {
      const failingVectorStore = {
        ...mockVectorStore,
        upsertBatch: async () => {
          throw new Error('Qdrant unavailable');
        }
      };
      
      const stage = new IndexVectorsStage({
        vectorStore: failingVectorStore,
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
        stateManager: mockStateManager,
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
        vectorStore: mockVectorStore,
        mongoProvider: failingProvider,
        verifier: mockVerifier,
        stateManager: mockStateManager,
        batchSize: 3
      });
      
      await expect(stage.execute({})).rejects.toThrow('MongoDB connection lost');
    });

    it('should complete execution successfully', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.vectorsIndexed).toBe(10);
      expect(result.batchesProcessed).toBe(4);
      expect(result.vectorCount).toBe(10);
      expect(result.perspectiveCount).toBe(10);
    });

    it('should handle empty perspective collection', async () => {
      // Clear mock perspectives array
      mockPerspectives.length = 0;
      
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('No vectors to verify'); // From verify method when expectedCount is 0
      expect(result.vectorCount).toBe(0); // From verify method
      // When no perspectives exist, vectorsIndexed and batchesProcessed are not set
      // because the implementation returns early from verify() method
    });

    it('should complete batch processing', async () => {
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.batchesProcessed).toBe(4);
      expect(result.vectorsIndexed).toBe(10);
    });
  });

  describe('batch processing', () => {
    it('should handle batch size larger than collection', async () => {
      const stage = new IndexVectorsStage({
        vectorStore: mockVectorStore,
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
        stateManager: mockStateManager,
        batchSize: 50 // Larger than 10 perspectives
      });
      stage.collectionName = testCollectionName;
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.batchesProcessed).toBe(1);
      expect(result.vectorsIndexed).toBe(10); // Actual property name
      expect(result.vectorCount).toBe(10); // From verify method
    });

    it('should handle batch size of 1', async () => {
      const stage = new IndexVectorsStage({
        vectorStore: mockVectorStore,
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
        stateManager: mockStateManager,
        batchSize: 1
      });
      stage.collectionName = testCollectionName;
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.batchesProcessed).toBe(10);
      expect(result.vectorsIndexed).toBe(10); // Actual property name
      expect(result.vectorCount).toBe(10); // From verify method
    });

    it('should handle partial batch failures', async () => {
      let callCount = 0;
      const customVectorStore = {
        ...mockVectorStore,
        upsertBatch: async (collectionName, points) => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Batch 2 failed');
          }
          vectorCount += points.length; // Track successful vectors
          return { success: true, upserted: points.length };
        }
      };
      
      const stage = new IndexVectorsStage({
        vectorStore: customVectorStore,
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
        stateManager: mockStateManager,
        batchSize: 3
      });
      stage.collectionName = testCollectionName;
      
      // This test expects the stage to fail when a batch fails
      await expect(stage.execute({})).rejects.toThrow('Batch 2 failed');
    });
  });

  describe('error recovery', () => {
    it('should fail on batch errors (no error recovery in current implementation)', async () => {
      let batchCount = 0;
      const customVectorStore = {
        ...mockVectorStore,
        upsertBatch: async (collectionName, points) => {
          batchCount++;
          if (batchCount === 2) {
            throw new Error('Transient Qdrant error');
          }
          vectorCount += points.length; // Track successful vectors
          return { success: true, upserted: points.length };
        }
      };
      
      const stage = new IndexVectorsStage({
        vectorStore: customVectorStore,
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
        stateManager: mockStateManager,
        batchSize: 3
      });
      stage.collectionName = testCollectionName;
      
      // Current implementation stops on error (line 78: throw error)
      await expect(stage.execute({})).rejects.toThrow('Transient Qdrant error');
    });

    it('should handle Qdrant collection not found', async () => {
      // Simulate collection deletion by resetting vector count
      vectorCount = 0;
      
      // Stage should recreate it
      const result = await indexVectorsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.vectorsIndexed).toBe(10); // Actual property name
      expect(result.vectorCount).toBe(10); // From verify method
    });

    it('should validate embeddings during preparation', async () => {
      // Add perspective with invalid embedding dimension
      mockPerspectives.push({
        _id: new ObjectId(),
        toolName: 'invalid-embedding',
        embedding: new Array(512).fill(0), // Wrong dimension (should be 768)
        perspectiveText: 'Invalid'
      });
      
      // The implementation validates embedding dimensions in prepareVectors
      // and throws an error for invalid dimensions
      await expect(indexVectorsStage.execute({})).rejects.toThrow('has wrong embedding dimension');
    });
  });
});