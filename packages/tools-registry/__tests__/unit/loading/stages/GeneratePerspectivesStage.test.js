/**
 * Unit tests for GeneratePerspectivesStage
 * Tests perspective generation with real MongoDB
 */

import { GeneratePerspectivesStage } from '../../../../src/loading/stages/GeneratePerspectivesStage.js';
import { MongoClient, ObjectId } from 'mongodb';
import { ResourceManager } from '@legion/resource-manager';

describe('GeneratePerspectivesStage', () => {
  let generatePerspectivesStage;
  let mongoProvider;
  let perspectiveGenerator;
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
      insertMany: async (collection, docs) => {
        const result = await db.collection(collection).insertMany(docs);
        return { insertedCount: result.insertedCount };
      },
      count: async (collection, query) => {
        return await db.collection(collection).countDocuments(query);
      },
      aggregate: async (collection, pipeline) => {
        return await db.collection(collection).aggregate(pipeline).toArray();
      }
    };
    
    // Create mock perspective generator
    perspectiveGenerator = {
      generatePerspectives: async (tool) => {
        if (tool.name === 'failing-tool') {
          throw new Error('Perspective generation failed');
        }
        
        if (tool.name === 'empty-tool') {
          return [];
        }
        
        // Generate mock perspectives
        return [
          {
            perspectiveType: 'usage',
            perspectiveText: `Use ${tool.name} to ${tool.description}`,
            metadata: { type: 'usage' }
          },
          {
            perspectiveType: 'search',
            perspectiveText: `Find ${tool.name} when you need ${tool.description}`,
            metadata: { type: 'search' }
          },
          {
            perspectiveType: 'context',
            perspectiveText: `${tool.name} is useful for ${tool.description}`,
            metadata: { type: 'context' }
          }
        ];
      }
    };
    
    // Create mock verifier
    verifier = {
      verifyAllToolsHavePerspectives: async () => {
        const toolsWithoutPerspectives = await db.collection('tools').aggregate([
          {
            $lookup: {
              from: 'tool_perspectives',
              localField: '_id',
              foreignField: 'toolId',
              as: 'perspectives'
            }
          },
          {
            $match: {
              perspectives: { $size: 0 }
            }
          },
          {
            $project: {
              name: 1
            }
          }
        ]).toArray();
        
        return {
          success: toolsWithoutPerspectives.length === 0,
          toolsWithoutPerspectives: toolsWithoutPerspectives.map(t => t.name)
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
            generatePerspectives: {
              processedTools: []
            }
          }
        };
      }
    };
  });

  beforeEach(async () => {
    // Clear collections
    await db.collection('tools').deleteMany({});
    await db.collection('tool_perspectives').deleteMany({});
    
    // Add test tools
    const tools = [
      { _id: new ObjectId(), name: 'tool1', description: 'Test tool 1', moduleName: 'module1' },
      { _id: new ObjectId(), name: 'tool2', description: 'Test tool 2', moduleName: 'module1' },
      { _id: new ObjectId(), name: 'tool3', description: 'Test tool 3', moduleName: 'module2' }
    ];
    await db.collection('tools').insertMany(tools);
    
    generatePerspectivesStage = new GeneratePerspectivesStage({
      perspectiveGenerator,
      mongoProvider,
      verifier,
      stateManager
    });
  });

  afterEach(async () => {
    await db.collection('tools').deleteMany({});
    await db.collection('tool_perspectives').deleteMany({});
  });

  afterAll(async () => {
    await client.close();
  });

  describe('execute', () => {
    it('should generate perspectives for all tools', async () => {
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsProcessed).toBe(3);
      expect(result.perspectivesGenerated).toBe(9); // 3 tools × 3 perspectives each
      
      const perspectiveCount = await db.collection('tool_perspectives').countDocuments();
      expect(perspectiveCount).toBe(9);
    });

    it('should filter by module name', async () => {
      const result = await generatePerspectivesStage.execute({ module: 'module1' });
      
      expect(result.success).toBe(true);
      expect(result.toolsProcessed).toBe(2);
      expect(result.perspectivesGenerated).toBe(6);
      
      const perspectives = await db.collection('tool_perspectives').find({}).toArray();
      expect(perspectives).toHaveLength(6);
      perspectives.forEach(p => {
        expect(['tool1', 'tool2']).toContain(p.toolName);
      });
    });

    it('should handle tools that generate no perspectives', async () => {
      await db.collection('tools').insertOne({
        _id: new ObjectId(),
        name: 'empty-tool',
        description: 'Tool with no perspectives'
      });
      
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsProcessed).toBe(4);
      expect(result.toolsSkipped).toBe(1);
      expect(result.perspectivesGenerated).toBe(9); // Only from the 3 normal tools
    });

    it('should continue on perspective generation failures', async () => {
      await db.collection('tools').insertOne({
        _id: new ObjectId(),
        name: 'failing-tool',
        description: 'Tool that fails'
      });
      
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsFailed).toBe(1);
      expect(result.toolsProcessed).toBe(3); // Other tools should still process
    });

    it('should save perspectives with proper structure', async () => {
      await generatePerspectivesStage.execute({});
      
      const perspectives = await db.collection('tool_perspectives').find({}).toArray();
      const perspective = perspectives[0];
      
      expect(perspective).toHaveProperty('_id');
      expect(perspective).toHaveProperty('toolId');
      expect(perspective).toHaveProperty('toolName');
      expect(perspective).toHaveProperty('perspectiveType');
      expect(perspective).toHaveProperty('perspectiveText');
      expect(perspective).toHaveProperty('metadata');
      expect(perspective).toHaveProperty('createdAt');
      expect(perspective.embedding).toBeNull();
    });

    it('should batch insert perspectives', async () => {
      // Override batch size for testing
      generatePerspectivesStage.batchSize = 2;
      
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesGenerated).toBe(9);
      expect(result.batches).toBeGreaterThan(1);
    });

    it('should track processed tools in state', async () => {
      const recordedCheckpoints = [];
      const customStateManager = {
        recordCheckpoint: async (stage, data) => {
          recordedCheckpoints.push(data);
          return { success: true };
        },
        getCurrentState: async () => ({
          stages: { generatePerspectives: { processedTools: [] } }
        })
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator,
        mongoProvider,
        verifier,
        stateManager: customStateManager
      });
      
      await stage.execute({});
      
      expect(recordedCheckpoints.length).toBeGreaterThan(0);
      expect(recordedCheckpoints[0].processedTool).toBeDefined();
    });

    it('should resume from previous state', async () => {
      const tools = await db.collection('tools').find({}).toArray();
      const firstToolId = tools[0]._id.toString();
      
      // Simulate previous run that processed first tool
      const customStateManager = {
        recordCheckpoint: async () => ({ success: true }),
        getCurrentState: async () => ({
          stages: {
            generatePerspectives: {
              processedTools: [firstToolId]
            }
          }
        })
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator,
        mongoProvider,
        verifier,
        stateManager: customStateManager
      });
      
      const result = await stage.execute({});
      
      // Should skip first tool and process remaining 2
      expect(result.toolsProcessed).toBe(2);
      expect(result.toolsSkipped).toBe(1);
      expect(result.perspectivesGenerated).toBe(6);
    });

    it('should verify all tools have perspectives', async () => {
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.verification).toBeDefined();
      expect(result.verification.success).toBe(true);
      expect(result.verification.toolsWithoutPerspectives).toHaveLength(0);
    });

    it('should fail if verification fails', async () => {
      const failingVerifier = {
        verifyAllToolsHavePerspectives: async () => ({
          success: false,
          toolsWithoutPerspectives: ['tool1'],
          message: 'Some tools lack perspectives'
        })
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator,
        mongoProvider,
        verifier: failingVerifier,
        stateManager
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Some tools lack perspectives');
    });

    it('should handle MongoDB errors', async () => {
      const failingProvider = {
        find: async () => {
          throw new Error('MongoDB connection lost');
        }
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator,
        mongoProvider: failingProvider,
        verifier,
        stateManager
      });
      
      await expect(stage.execute({})).rejects.toThrow('MongoDB connection lost');
    });

    it('should report timing information', async () => {
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle empty tool collection', async () => {
      await db.collection('tools').deleteMany({});
      
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsProcessed).toBe(0);
      expect(result.perspectivesGenerated).toBe(0);
    });

    it('should calculate perspectives per tool', async () => {
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.perspectivesPerTool).toBeDefined();
      expect(result.perspectivesPerTool).toBe(3);
    });

    it('should link perspectives to tools correctly', async () => {
      await generatePerspectivesStage.execute({});
      
      const tools = await db.collection('tools').find({}).toArray();
      
      for (const tool of tools) {
        const perspectives = await db.collection('tool_perspectives')
          .find({ toolId: tool._id })
          .toArray();
        
        expect(perspectives).toHaveLength(3);
        perspectives.forEach(p => {
          expect(p.toolName).toBe(tool.name);
          expect(p.toolId.toString()).toBe(tool._id.toString());
        });
      }
    });
  });

  describe('error recovery', () => {
    it('should continue processing after individual tool failures', async () => {
      // Add a mix of normal and failing tools
      await db.collection('tools').insertOne({
        _id: new ObjectId(),
        name: 'failing-tool',
        description: 'Will fail'
      });
      
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsFailed).toBe(1);
      expect(result.toolsProcessed).toBe(3);
      expect(result.perspectivesGenerated).toBe(9);
    });

    it('should handle partial batch insert failures gracefully', async () => {
      const customProvider = {
        ...mongoProvider,
        insertMany: async (collection, docs) => {
          // Simulate partial success
          if (docs.length > 2) {
            return { insertedCount: Math.floor(docs.length / 2) };
          }
          return { insertedCount: docs.length };
        }
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator,
        mongoProvider: customProvider,
        verifier,
        stateManager
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesGenerated).toBeLessThan(9);
    });

    it('should handle perspective generator errors gracefully', async () => {
      const failingGenerator = {
        generatePerspectives: async () => {
          throw new Error('LLM service unavailable');
        }
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator: failingGenerator,
        mongoProvider,
        verifier,
        stateManager
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsFailed).toBe(3);
      expect(result.perspectivesGenerated).toBe(0);
    });
  });
});