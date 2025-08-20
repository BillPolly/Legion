/**
 * Unit tests for PipelineVerifier
 * Tests verification logic with real MongoDB and Qdrant
 */

import { PipelineVerifier } from '../../../src/loading/PipelineVerifier.js';
import { MongoClient, ObjectId } from 'mongodb';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ResourceManager } from '@legion/resource-manager';

describe('PipelineVerifier', () => {
  let verifier;
  let mongoProvider;
  let vectorStore;
  let client;
  let db;
  let qdrantClient;
  const testCollectionName = 'legion_tools_test';

  beforeAll(async () => {
    // Use real MongoDB connection
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
      count: async (collection, query) => {
        return await db.collection(collection).countDocuments(query);
      },
      find: async (collection, query, options = {}) => {
        let cursor = db.collection(collection).find(query);
        if (options.limit) cursor = cursor.limit(options.limit);
        if (options.sort) cursor = cursor.sort(options.sort);
        return await cursor.toArray();
      },
      findOne: async (collection, query) => {
        return await db.collection(collection).findOne(query);
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
      get: async (collectionName, ids) => {
        try {
          const points = await qdrantClient.retrieve(collectionName, {
            ids: ids,
            with_vector: true,
            with_payload: true
          });
          return points;
        } catch (error) {
          if (error.message?.includes('Not found')) {
            return [];
          }
          throw error;
        }
      },
      createCollection: async (collectionName, config) => {
        try {
          await qdrantClient.createCollection(collectionName, {
            vectors: {
              size: config.dimension,
              distance: config.distance || 'Cosine'
            }
          });
        } catch (error) {
          // Collection might already exist
          if (!error.message?.includes('already exists')) {
            throw error;
          }
        }
      },
      deleteCollection: async (collectionName) => {
        try {
          await qdrantClient.deleteCollection(collectionName);
        } catch (error) {
          // Ignore if collection doesn't exist
          if (!error.message?.includes('Not found')) {
            throw error;
          }
        }
      }
    };
  });

  beforeEach(async () => {
    // Clear test collections
    await db.collection('modules').deleteMany({});
    await db.collection('tools').deleteMany({});
    await db.collection('tool_perspectives').deleteMany({});
    
    // Clear Qdrant test collection
    await vectorStore.deleteCollection(testCollectionName);
    await vectorStore.createCollection(testCollectionName, {
      dimension: 768,
      distance: 'Cosine'
    });
    
    verifier = new PipelineVerifier(mongoProvider, vectorStore);
  });

  afterAll(async () => {
    // Clean up
    await db.collection('modules').deleteMany({});
    await db.collection('tools').deleteMany({});
    await db.collection('tool_perspectives').deleteMany({});
    await vectorStore.deleteCollection(testCollectionName);
    await client.close();
  });

  describe('verifyCleared', () => {
    it('should verify all collections are empty', async () => {
      const result = await verifier.verifyCleared();
      
      expect(result.success).toBe(true);
      expect(result.counts.modules).toBe(0);
      expect(result.counts.tools).toBe(0);
      expect(result.counts.perspectives).toBe(0);
      expect(result.counts.vectors).toBe(0);
    });

    it('should fail if tools exist', async () => {
      await db.collection('tools').insertOne({ name: 'test-tool' });
      
      const result = await verifier.verifyCleared();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('tools collection is not empty');
    });

    it('should fail if perspectives exist', async () => {
      await db.collection('tool_perspectives').insertOne({ 
        toolName: 'test',
        perspectiveText: 'test perspective'
      });
      
      const result = await verifier.verifyCleared();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('tool_perspectives collection is not empty');
    });
  });

  describe('verifyToolCount', () => {
    it('should verify exact tool count', async () => {
      const tools = [
        { name: 'tool1', description: 'Test tool 1' },
        { name: 'tool2', description: 'Test tool 2' },
        { name: 'tool3', description: 'Test tool 3' }
      ];
      
      await db.collection('tools').insertMany(tools);
      
      const result = await verifier.verifyToolCount(3);
      expect(result.success).toBe(true);
      expect(result.actualCount).toBe(3);
    });

    it('should fail on count mismatch', async () => {
      await db.collection('tools').insertOne({ name: 'tool1' });
      
      const result = await verifier.verifyToolCount(5);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Tool count mismatch');
      expect(result.actualCount).toBe(1);
    });
  });

  describe('verifyAllToolsHavePerspectives', () => {
    beforeEach(async () => {
      // Insert test tools
      await db.collection('tools').insertMany([
        { _id: new ObjectId(), name: 'tool1' },
        { _id: new ObjectId(), name: 'tool2' }
      ]);
    });

    it('should verify all tools have perspectives', async () => {
      const tools = await db.collection('tools').find({}).toArray();
      
      // Add perspectives for all tools
      for (const tool of tools) {
        await db.collection('tool_perspectives').insertOne({
          toolId: tool._id,
          toolName: tool.name,
          perspectiveText: `${tool.name} perspective`
        });
      }
      
      const result = await verifier.verifyAllToolsHavePerspectives();
      expect(result.success).toBe(true);
      expect(result.toolsWithoutPerspectives).toHaveLength(0);
    });

    it('should detect tools without perspectives', async () => {
      const tools = await db.collection('tools').find({}).toArray();
      
      // Only add perspective for first tool
      await db.collection('tool_perspectives').insertOne({
        toolId: tools[0]._id,
        toolName: tools[0].name,
        perspectiveText: 'perspective'
      });
      
      const result = await verifier.verifyAllToolsHavePerspectives();
      expect(result.success).toBe(false);
      expect(result.toolsWithoutPerspectives).toContain('tool2');
    });
  });

  describe('verifyAllPerspectivesHaveEmbeddings', () => {
    it('should verify all perspectives have embeddings', async () => {
      const embedding = new Array(768).fill(0.1);
      
      await db.collection('tool_perspectives').insertMany([
        { toolName: 'tool1', perspectiveText: 'text1', embedding: embedding },
        { toolName: 'tool2', perspectiveText: 'text2', embedding: embedding }
      ]);
      
      const result = await verifier.verifyAllPerspectivesHaveEmbeddings();
      expect(result.success).toBe(true);
      expect(result.withoutEmbeddings).toBe(0);
    });

    it('should detect perspectives without embeddings', async () => {
      const embedding = new Array(768).fill(0.1);
      
      await db.collection('tool_perspectives').insertMany([
        { toolName: 'tool1', perspectiveText: 'text1', embedding: embedding },
        { toolName: 'tool2', perspectiveText: 'text2', embedding: null },
        { toolName: 'tool3', perspectiveText: 'text3' }
      ]);
      
      const result = await verifier.verifyAllPerspectivesHaveEmbeddings();
      expect(result.success).toBe(false);
      expect(result.withoutEmbeddings).toBe(2);
    });
  });

  describe('verifyEmbeddingDimensions', () => {
    it('should verify correct embedding dimensions', async () => {
      const correctEmbedding = new Array(768).fill(0.1);
      
      await db.collection('tool_perspectives').insertMany([
        { toolName: 'tool1', embedding: correctEmbedding },
        { toolName: 'tool2', embedding: correctEmbedding }
      ]);
      
      const result = await verifier.verifyEmbeddingDimensions(768);
      expect(result.success).toBe(true);
      expect(result.wrongDimensions).toHaveLength(0);
    });

    it('should detect wrong embedding dimensions', async () => {
      const wrongEmbedding = new Array(512).fill(0.1);
      const correctEmbedding = new Array(768).fill(0.1);
      
      await db.collection('tool_perspectives').insertMany([
        { _id: new ObjectId(), toolName: 'tool1', embedding: correctEmbedding },
        { _id: new ObjectId(), toolName: 'tool2', embedding: wrongEmbedding }
      ]);
      
      const result = await verifier.verifyEmbeddingDimensions(768);
      expect(result.success).toBe(false);
      expect(result.wrongDimensions).toHaveLength(1);
      expect(result.wrongDimensions[0].dimension).toBe(512);
    });
  });

  describe('verifyPerspectiveVectorSync', () => {
    it('should verify 1:1 perspective to vector ratio', async () => {
      // For this test, we need to simulate having the same count
      // Since we can't easily insert into Qdrant in unit test,
      // we'll test the logic by checking counts
      
      const embedding = new Array(768).fill(0.1);
      await db.collection('tool_perspectives').insertMany([
        { embedding: embedding },
        { embedding: embedding }
      ]);
      
      const result = await verifier.verifyPerspectiveVectorSync();
      
      // Since Qdrant is empty, this should fail
      expect(result.success).toBe(false);
      expect(result.perspectiveCount).toBe(2);
      expect(result.vectorCount).toBe(0);
    });
  });

  describe('verifySampleVectorMatch', () => {
    it('should handle no perspectives gracefully', async () => {
      const result = await verifier.verifySampleVectorMatch();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('No perspectives to verify');
    });

    it('should verify vector samples match MongoDB data', async () => {
      // This test would need actual vector insertion
      // For unit test, we verify the logic works
      const perspectiveId = new ObjectId();
      const embedding = new Array(768).fill(0.1);
      
      await db.collection('tool_perspectives').insertOne({
        _id: perspectiveId,
        toolName: 'test-tool',
        perspectiveText: 'test',
        embedding: embedding
      });
      
      const result = await verifier.verifySampleVectorMatch();
      
      // Will fail since no vectors in Qdrant
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found in Qdrant');
    });
  });

  describe('runFinalVerification', () => {
    it('should run all verification checks', async () => {
      const result = await verifier.runFinalVerification();
      
      expect(result).toBeDefined();
      expect(result.checks).toBeInstanceOf(Array);
      expect(result.checks.length).toBeGreaterThan(0);
      
      // Find specific checks
      const toolCheck = result.checks.find(c => c.name === 'Tool count');
      const perspectiveCheck = result.checks.find(c => c.name === 'Perspective coverage');
      const embeddingCheck = result.checks.find(c => c.name === 'Embedding completeness');
      
      expect(toolCheck).toBeDefined();
      expect(perspectiveCheck).toBeDefined();
      expect(embeddingCheck).toBeDefined();
    });

    it('should detect issues in final verification', async () => {
      // Add a tool without perspectives
      await db.collection('tools').insertOne({
        name: 'orphan-tool'
      });
      
      const result = await verifier.runFinalVerification();
      
      expect(result.success).toBe(false);
      expect(result.failedChecks).toContain('Perspective coverage');
    });
  });

  describe('error handling', () => {
    it('should handle MongoDB connection errors', async () => {
      const failingProvider = {
        count: async () => {
          throw new Error('Connection timeout');
        }
      };
      
      const failingVerifier = new PipelineVerifier(failingProvider, vectorStore);
      
      await expect(failingVerifier.verifyCleared()).rejects.toThrow('Connection timeout');
    });

    it('should handle Qdrant connection errors', async () => {
      const failingVectorStore = {
        count: async () => {
          throw new Error('Qdrant unavailable');
        }
      };
      
      const failingVerifier = new PipelineVerifier(mongoProvider, failingVectorStore);
      
      await expect(failingVerifier.verifyCleared()).rejects.toThrow('Qdrant unavailable');
    });
  });
});