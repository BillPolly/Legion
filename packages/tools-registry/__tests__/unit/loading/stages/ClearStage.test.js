/**
 * Unit tests for ClearStage
 * Tests database clearing with real MongoDB and Qdrant
 */

import { ClearStage } from '../../../../src/loading/stages/ClearStage.js';
import { MongoClient } from 'mongodb';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ResourceManager } from '@legion/resource-manager';

describe('ClearStage', () => {
  let clearStage;
  let mongoProvider;
  let vectorStore;
  let verifier;
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
      deleteMany: async (collection, query) => {
        const result = await db.collection(collection).deleteMany(query);
        return { deletedCount: result.deletedCount };
      },
      count: async (collection, query) => {
        return await db.collection(collection).countDocuments(query);
      }
    };
    
    // Create Qdrant client
    qdrantClient = new QdrantClient({
      url: qdrantUrl
    });
    
    // Create vector store wrapper
    vectorStore = {
      deleteCollection: async (collectionName) => {
        try {
          await qdrantClient.deleteCollection(collectionName);
          return { success: true };
        } catch (error) {
          if (error.message?.includes('Not found')) {
            return { success: true }; // Collection doesn't exist
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
          return { success: true };
        } catch (error) {
          if (!error.message?.includes('already exists')) {
            throw error;
          }
          return { success: true };
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
      }
    };
    
    // Create mock verifier
    verifier = {
      verifyCleared: async () => {
        const toolCount = await mongoProvider.count('tools', {});
        const perspectiveCount = await mongoProvider.count('tool_perspectives', {});
        const vectorCount = await vectorStore.count(testCollectionName);
        
        return {
          success: toolCount === 0 && perspectiveCount === 0 && vectorCount === 0,
          counts: {
            tools: toolCount,
            perspectives: perspectiveCount,
            vectors: vectorCount
          }
        };
      }
    };
  });

  beforeEach(async () => {
    // Populate test data
    await db.collection('tools').insertMany([
      { name: 'tool1', description: 'Test tool 1' },
      { name: 'tool2', description: 'Test tool 2' }
    ]);
    
    await db.collection('tool_perspectives').insertMany([
      { toolName: 'tool1', perspectiveText: 'perspective 1' },
      { toolName: 'tool2', perspectiveText: 'perspective 2' }
    ]);
    
    // Create Qdrant collection
    await vectorStore.createCollection(testCollectionName, {
      dimension: 768,
      distance: 'Cosine'
    });
    
    clearStage = new ClearStage({
      mongoProvider,
      vectorStore,
      verifier
    });
  });

  afterEach(async () => {
    // Clean up
    await db.collection('modules').deleteMany({});
    await db.collection('tools').deleteMany({});
    await db.collection('tool_perspectives').deleteMany({});
    await vectorStore.deleteCollection(testCollectionName);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('execute', () => {
    it('should clear tools and perspectives by default', async () => {
      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsCleared).toBe(2);
      expect(result.perspectivesCleared).toBe(2);
      
      // Verify collections are empty
      const toolCount = await db.collection('tools').countDocuments();
      const perspectiveCount = await db.collection('tool_perspectives').countDocuments();
      
      expect(toolCount).toBe(0);
      expect(perspectiveCount).toBe(0);
    });

    it('should clear modules when clearModules option is set', async () => {
      // Add modules
      await db.collection('modules').insertMany([
        { name: 'module1', path: '/path/to/module1' },
        { name: 'module2', path: '/path/to/module2' }
      ]);
      
      const result = await clearStage.execute({ clearModules: true });
      
      expect(result.success).toBe(true);
      expect(result.modulesCleared).toBe(2);
      
      const moduleCount = await db.collection('modules').countDocuments();
      expect(moduleCount).toBe(0);
    });

    it('should not clear modules by default', async () => {
      // Add modules
      await db.collection('modules').insertMany([
        { name: 'module1', path: '/path/to/module1' }
      ]);
      
      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.modulesCleared).toBeUndefined();
      
      const moduleCount = await db.collection('modules').countDocuments();
      expect(moduleCount).toBe(1);
    });

    it('should clear vector collection', async () => {
      // Note: We can't easily insert vectors in unit test, but we test deletion
      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.vectorsCleared).toBeDefined();
      
      // Collection should be recreated
      const vectorCount = await vectorStore.count('legion_tools');
      expect(vectorCount).toBe(0);
    });

    it('should handle clearing when collections are already empty', async () => {
      // Clear first
      await db.collection('tools').deleteMany({});
      await db.collection('tool_perspectives').deleteMany({});
      
      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsCleared).toBe(0);
      expect(result.perspectivesCleared).toBe(0);
    });

    it('should fail verification if clear is incomplete', async () => {
      // Override verifier to always fail
      const failingVerifier = {
        verifyCleared: async () => ({
          success: false,
          message: 'Tools still exist',
          counts: { tools: 1, perspectives: 0, vectors: 0 }
        })
      };
      
      const failingStage = new ClearStage({
        mongoProvider,
        vectorStore,
        verifier: failingVerifier
      });
      
      const result = await failingStage.execute({});
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Tools still exist');
    });

    it('should handle MongoDB errors gracefully', async () => {
      const failingProvider = {
        deleteMany: async () => {
          throw new Error('MongoDB connection lost');
        }
      };
      
      const failingStage = new ClearStage({
        mongoProvider: failingProvider,
        vectorStore,
        verifier
      });
      
      await expect(failingStage.execute({})).rejects.toThrow('MongoDB connection lost');
    });

    it('should handle Qdrant errors gracefully', async () => {
      const failingVectorStore = {
        deleteCollection: async () => {
          throw new Error('Qdrant unavailable');
        }
      };
      
      const failingStage = new ClearStage({
        mongoProvider,
        vectorStore: failingVectorStore,
        verifier
      });
      
      await expect(failingStage.execute({})).rejects.toThrow('Qdrant unavailable');
    });

    it('should report timing information', async () => {
      const result = await clearStage.execute({});
      
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should provide detailed clear statistics', async () => {
      const result = await clearStage.execute({ clearModules: true });
      
      expect(result).toMatchObject({
        success: true,
        toolsCleared: expect.any(Number),
        perspectivesCleared: expect.any(Number),
        vectorsCleared: expect.any(String),
        duration: expect.any(Number)
      });
      
      expect(result.modulesCleared).toBeDefined();
    });
  });

  describe('verification', () => {
    it('should verify all collections are empty after clear', async () => {
      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.verification).toBeDefined();
      expect(result.verification.counts.tools).toBe(0);
      expect(result.verification.counts.perspectives).toBe(0);
      expect(result.verification.counts.vectors).toBe(0);
    });

    it('should detect incomplete clear', async () => {
      // Manually mess with verifier to simulate incomplete clear
      const customVerifier = {
        verifyCleared: async () => ({
          success: false,
          message: 'Clear incomplete: tools=1',
          counts: { tools: 1, perspectives: 0, vectors: 0 }
        })
      };
      
      const stage = new ClearStage({
        mongoProvider,
        vectorStore,
        verifier: customVerifier
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Clear incomplete');
    });
  });
});