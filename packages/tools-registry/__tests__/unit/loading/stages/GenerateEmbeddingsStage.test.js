/**
 * Unit tests for GenerateEmbeddingsStage
 * Tests embedding generation with real MongoDB
 */

import { GenerateEmbeddingsStage } from '../../../../src/loading/stages/GenerateEmbeddingsStage.js';
import { MongoClient, ObjectId } from 'mongodb';
import { ResourceManager } from '@legion/resource-manager';

describe('GenerateEmbeddingsStage', () => {
  let generateEmbeddingsStage;
  let mongoProvider;
  let embeddingService;
  let verifier;
  let stateManager;
  let client;
  let db;

  beforeAll(async () => {
    // Use real MongoDB connection
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
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
    
    // Create mock embedding service
    embeddingService = {
      generateEmbeddings: async (texts) => {
        // Return 768-dimension embeddings
        return texts.map(text => {
          if (text.includes('fail')) {
            throw new Error('Embedding generation failed');
          }
          
          // Generate deterministic fake embedding based on text
          const embedding = new Array(768).fill(0);
          for (let i = 0; i < Math.min(text.length, 768); i++) {
            embedding[i] = text.charCodeAt(i % text.length) / 255;
          }
          return embedding;
        });
      }
    };
    
    // Create mock verifier
    verifier = {
      verifyAllPerspectivesHaveEmbeddings: async () => {
        const withoutEmbeddings = await db.collection('tool_perspectives').countDocuments({
          $or: [
            { embedding: null },
            { embedding: { $exists: false } }
          ]
        });
        
        return {
          success: withoutEmbeddings === 0,
          withoutEmbeddings,
          totalPerspectives: await db.collection('tool_perspectives').countDocuments()
        };
      },
      verifyEmbeddingDimensions: async (expectedDimension) => {
        const wrongDimensions = await db.collection('tool_perspectives')
          .find({ embedding: { $exists: true, $ne: null } })
          .toArray()
          .then(perspectives => 
            perspectives.filter(p => p.embedding && p.embedding.length !== expectedDimension)
              .map(p => ({
                id: p._id,
                dimension: p.embedding.length
              }))
          );
        
        return {
          success: wrongDimensions.length === 0,
          wrongDimensions
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
            generateEmbeddings: {
              processedBatches: 0,
              totalProcessed: 0
            }
          }
        };
      }
    };
  });

  beforeEach(async () => {
    // Clear collections
    await db.collection('tool_perspectives').deleteMany({});
    
    // Add test perspectives
    const perspectives = [];
    for (let i = 1; i <= 10; i++) {
      perspectives.push({
        _id: new ObjectId(),
        toolId: new ObjectId(),
        toolName: `tool${i}`,
        perspectiveType: 'usage',
        perspectiveText: `This is perspective text for tool ${i}`,
        embedding: null,
        createdAt: new Date()
      });
    }
    await db.collection('tool_perspectives').insertMany(perspectives);
    
    generateEmbeddingsStage = new GenerateEmbeddingsStage({
      embeddingService,
      mongoProvider,
      verifier,
      stateManager,
      batchSize: 3 // Small batch size for testing
    });
  });

  afterEach(async () => {
    await db.collection('tool_perspectives').deleteMany({});
  });

  afterAll(async () => {
    await client.close();
  });

  describe('execute', () => {
    it('should generate embeddings for all perspectives', async () => {
      const result = await generateEmbeddingsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesProcessed).toBe(10);
      expect(result.batchesProcessed).toBe(4); // 10 perspectives / 3 batch size = 4 batches
      
      const withEmbeddings = await db.collection('tool_perspectives')
        .countDocuments({ embedding: { $ne: null } });
      expect(withEmbeddings).toBe(10);
    });

    it('should process in batches', async () => {
      const result = await generateEmbeddingsStage.execute({});
      
      expect(result.batchesProcessed).toBe(4); // ceil(10/3)
      expect(result.batchSize).toBe(3);
    });

    it('should skip perspectives that already have embeddings', async () => {
      // Add embeddings to first 5 perspectives
      const embedding = new Array(768).fill(0.1);
      await db.collection('tool_perspectives').updateMany(
        { toolName: { $in: ['tool1', 'tool2', 'tool3', 'tool4', 'tool5'] } },
        { $set: { embedding } }
      );
      
      const result = await generateEmbeddingsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesProcessed).toBe(5);
      expect(result.skipped).toBe(5);
    });

    it('should handle embedding generation failures gracefully', async () => {
      // Add perspective with text that triggers failure
      await db.collection('tool_perspectives').insertOne({
        _id: new ObjectId(),
        toolName: 'failing-tool',
        perspectiveText: 'This will fail embedding generation',
        embedding: null
      });
      
      const result = await generateEmbeddingsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.failed).toBe(1);
      expect(result.perspectivesProcessed).toBe(10); // Others should still process
    });

    it('should save embeddings with correct dimensions', async () => {
      await generateEmbeddingsStage.execute({});
      
      const perspectives = await db.collection('tool_perspectives')
        .find({ embedding: { $ne: null } })
        .toArray();
      
      perspectives.forEach(p => {
        expect(p.embedding).toHaveLength(768);
        expect(Array.isArray(p.embedding)).toBe(true);
        expect(p.embedding.every(v => typeof v === 'number')).toBe(true);
      });
    });

    it('should update embedding metadata', async () => {
      await generateEmbeddingsStage.execute({});
      
      const perspectives = await db.collection('tool_perspectives')
        .find({ embedding: { $ne: null } })
        .toArray();
      
      perspectives.forEach(p => {
        expect(p.embeddingGeneratedAt).toBeInstanceOf(Date);
        expect(p.embeddingModel).toBe('nomic-embed-text');
        expect(p.embeddingDimension).toBe(768);
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
          stages: { generateEmbeddings: { processedBatches: 0 } }
        })
      };
      
      const stage = new GenerateEmbeddingsStage({
        embeddingService,
        mongoProvider,
        verifier,
        stateManager: customStateManager,
        batchSize: 3
      });
      
      await stage.execute({});
      
      expect(recordedCheckpoints.length).toBeGreaterThan(0);
      const lastCheckpoint = recordedCheckpoints[recordedCheckpoints.length - 1];
      expect(lastCheckpoint.processedBatches).toBe(4);
      expect(lastCheckpoint.totalProcessed).toBe(10);
    });

    it('should resume from previous state', async () => {
      // Simulate previous run that processed 2 batches (6 perspectives)
      const processedIds = [];
      const perspectives = await db.collection('tool_perspectives')
        .find({})
        .limit(6)
        .toArray();
      
      // Mark first 6 as processed
      const embedding = new Array(768).fill(0.1);
      for (const p of perspectives) {
        processedIds.push(p._id.toString());
        await db.collection('tool_perspectives').updateOne(
          { _id: p._id },
          { $set: { embedding } }
        );
      }
      
      const customStateManager = {
        recordCheckpoint: async () => ({ success: true }),
        getCurrentState: async () => ({
          stages: {
            generateEmbeddings: {
              processedBatches: 2,
              totalProcessed: 6,
              lastProcessedId: processedIds[5]
            }
          }
        })
      };
      
      const stage = new GenerateEmbeddingsStage({
        embeddingService,
        mongoProvider,
        verifier,
        stateManager: customStateManager,
        batchSize: 3
      });
      
      const result = await stage.execute({});
      
      expect(result.perspectivesProcessed).toBe(4); // Remaining 4
      expect(result.skipped).toBe(6);
    });

    it('should verify all perspectives have embeddings', async () => {
      const result = await generateEmbeddingsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.verification).toBeDefined();
      expect(result.verification.success).toBe(true);
      expect(result.verification.withoutEmbeddings).toBe(0);
    });

    it('should verify embedding dimensions', async () => {
      const result = await generateEmbeddingsStage.execute({});
      
      expect(result.dimensionVerification).toBeDefined();
      expect(result.dimensionVerification.success).toBe(true);
      expect(result.dimensionVerification.wrongDimensions).toHaveLength(0);
    });

    it('should fail if verification fails', async () => {
      const failingVerifier = {
        verifyAllPerspectivesHaveEmbeddings: async () => ({
          success: false,
          withoutEmbeddings: 2,
          message: 'Some perspectives lack embeddings'
        }),
        verifyEmbeddingDimensions: async () => ({
          success: true,
          wrongDimensions: []
        })
      };
      
      const stage = new GenerateEmbeddingsStage({
        embeddingService,
        mongoProvider,
        verifier: failingVerifier,
        stateManager,
        batchSize: 3
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Some perspectives lack embeddings');
    });

    it('should handle MongoDB errors', async () => {
      const failingProvider = {
        find: async () => {
          throw new Error('MongoDB connection lost');
        }
      };
      
      const stage = new GenerateEmbeddingsStage({
        embeddingService,
        mongoProvider: failingProvider,
        verifier,
        stateManager,
        batchSize: 3
      });
      
      await expect(stage.execute({})).rejects.toThrow('MongoDB connection lost');
    });

    it('should report timing information', async () => {
      const result = await generateEmbeddingsStage.execute({});
      
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle empty perspective collection', async () => {
      await db.collection('tool_perspectives').deleteMany({});
      
      const result = await generateEmbeddingsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesProcessed).toBe(0);
      expect(result.batchesProcessed).toBe(0);
    });

    it('should calculate average embedding time', async () => {
      const result = await generateEmbeddingsStage.execute({});
      
      expect(result.averageTimePerBatch).toBeDefined();
      expect(result.averageTimePerBatch).toBeGreaterThan(0);
    });
  });

  describe('batch processing', () => {
    it('should handle batch size larger than collection', async () => {
      const stage = new GenerateEmbeddingsStage({
        embeddingService,
        mongoProvider,
        verifier,
        stateManager,
        batchSize: 50 // Larger than 10 perspectives
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.batchesProcessed).toBe(1);
      expect(result.perspectivesProcessed).toBe(10);
    });

    it('should handle batch size of 1', async () => {
      const stage = new GenerateEmbeddingsStage({
        embeddingService,
        mongoProvider,
        verifier,
        stateManager,
        batchSize: 1
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.batchesProcessed).toBe(10);
      expect(result.perspectivesProcessed).toBe(10);
    });

    it('should process batches in order', async () => {
      const processedBatches = [];
      
      const customEmbeddingService = {
        generateEmbeddings: async (texts) => {
          processedBatches.push(texts.length);
          return texts.map(() => new Array(768).fill(0.1));
        }
      };
      
      const stage = new GenerateEmbeddingsStage({
        embeddingService: customEmbeddingService,
        mongoProvider,
        verifier,
        stateManager,
        batchSize: 3
      });
      
      await stage.execute({});
      
      expect(processedBatches).toEqual([3, 3, 3, 1]); // 10 perspectives in batches of 3
    });
  });

  describe('error recovery', () => {
    it('should continue processing after batch failures', async () => {
      let callCount = 0;
      const customEmbeddingService = {
        generateEmbeddings: async (texts) => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Batch 2 failed');
          }
          return texts.map(() => new Array(768).fill(0.1));
        }
      };
      
      const stage = new GenerateEmbeddingsStage({
        embeddingService: customEmbeddingService,
        mongoProvider,
        verifier,
        stateManager,
        batchSize: 3
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.failed).toBe(3); // Batch 2 had 3 perspectives
      expect(result.perspectivesProcessed).toBe(7);
    });

    it('should handle embedding service unavailability', async () => {
      const failingEmbeddingService = {
        generateEmbeddings: async () => {
          throw new Error('Embedding service unavailable');
        }
      };
      
      const stage = new GenerateEmbeddingsStage({
        embeddingService: failingEmbeddingService,
        mongoProvider,
        verifier,
        stateManager,
        batchSize: 3
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.failed).toBe(10);
      expect(result.perspectivesProcessed).toBe(0);
    });
  });
});