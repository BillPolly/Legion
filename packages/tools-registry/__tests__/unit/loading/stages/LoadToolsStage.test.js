/**
 * Unit tests for LoadToolsStage
 * Tests tool loading from modules with real MongoDB
 */

import { LoadToolsStage } from '../../../../src/loading/stages/LoadToolsStage.js';
import { MongoClient, ObjectId } from 'mongodb';
import { ResourceManager } from '@legion/resource-manager';

describe('LoadToolsStage', () => {
  let loadToolsStage;
  let mongoProvider;
  let moduleLoader;
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
        return await cursor.toArray();
      },
      insertMany: async (collection, docs) => {
        const result = await db.collection(collection).insertMany(docs);
        return { insertedCount: result.insertedCount };
      },
      count: async (collection, query) => {
        return await db.collection(collection).countDocuments(query);
      }
    };
    
    // Create mock module loader
    moduleLoader = {
      loadModule: async (moduleDoc) => {
        // Simulate loading a module
        if (moduleDoc.name === 'failing-module') {
          throw new Error('Module load failed');
        }
        
        return {
          name: moduleDoc.name,
          getTools: () => {
            if (moduleDoc.name === 'empty-module') {
              return [];
            }
            
            // Return mock tools based on module name
            return [
              {
                name: `${moduleDoc.name}_tool1`,
                description: `Tool 1 from ${moduleDoc.name}`,
                execute: async () => ({ success: true })
              },
              {
                name: `${moduleDoc.name}_tool2`,
                description: `Tool 2 from ${moduleDoc.name}`,
                execute: async () => ({ success: true })
              }
            ];
          }
        };
      }
    };
    
    // Create mock verifier
    verifier = {
      verifyToolCount: async (expectedCount) => {
        const actualCount = await mongoProvider.count('tools', {});
        return {
          success: actualCount === expectedCount,
          actualCount,
          expectedCount
        };
      }
    };
    
    // Create mock state manager
    stateManager = {
      recordCheckpoint: async (stage, data) => {
        // Store checkpoint data
        return { success: true };
      },
      getCurrentState: async () => {
        return {
          stages: {
            loadTools: {
              processedModules: []
            }
          }
        };
      }
    };
  });

  beforeEach(async () => {
    // Clear collections
    await db.collection('modules').deleteMany({});
    await db.collection('tools').deleteMany({});
    
    // Add test modules
    await db.collection('modules').insertMany([
      { _id: new ObjectId(), name: 'module1', path: '/path/to/module1', type: 'class' },
      { _id: new ObjectId(), name: 'module2', path: '/path/to/module2', type: 'class' },
      { _id: new ObjectId(), name: 'module3', path: '/path/to/module3', type: 'class' }
    ]);
    
    loadToolsStage = new LoadToolsStage({
      moduleLoader,
      mongoProvider,
      verifier,
      stateManager
    });
  });

  afterEach(async () => {
    await db.collection('modules').deleteMany({});
    await db.collection('tools').deleteMany({});
  });

  afterAll(async () => {
    await client.close();
  });

  describe('execute', () => {
    it('should load tools from all modules', async () => {
      const result = await loadToolsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.modulesProcessed).toBe(3);
      expect(result.toolsAdded).toBe(6); // 3 modules × 2 tools each
      
      const toolCount = await db.collection('tools').countDocuments();
      expect(toolCount).toBe(6);
    });

    it('should filter by module name', async () => {
      const result = await loadToolsStage.execute({ module: 'module1' });
      
      expect(result.success).toBe(true);
      expect(result.modulesProcessed).toBe(1);
      expect(result.toolsAdded).toBe(2);
      
      const tools = await db.collection('tools').find({}).toArray();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toContain('module1');
    });

    it('should handle modules with no tools', async () => {
      await db.collection('modules').insertOne({
        _id: new ObjectId(),
        name: 'empty-module',
        path: '/path/to/empty'
      });
      
      const result = await loadToolsStage.execute({ module: 'empty-module' });
      
      expect(result.success).toBe(true);
      expect(result.modulesProcessed).toBe(1);
      expect(result.toolsAdded).toBe(0);
      expect(result.modulesSkipped).toBe(1);
    });

    it('should continue on module load failures', async () => {
      await db.collection('modules').insertOne({
        _id: new ObjectId(),
        name: 'failing-module',
        path: '/path/to/failing'
      });
      
      const result = await loadToolsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.modulesFailed).toBe(1);
      expect(result.modulesProcessed).toBe(3); // Other modules should still load
    });

    it('should save tools with proper structure', async () => {
      await loadToolsStage.execute({ module: 'module1' });
      
      const tools = await db.collection('tools').find({}).toArray();
      expect(tools).toHaveLength(2);
      
      const tool = tools[0];
      expect(tool).toHaveProperty('_id');
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('moduleName', 'module1');
      expect(tool).toHaveProperty('moduleId');
      expect(tool).toHaveProperty('createdAt');
    });

    it('should batch insert tools', async () => {
      // Override batch size for testing
      loadToolsStage.batchSize = 2;
      
      const result = await loadToolsStage.execute({ module: 'module1' });
      
      expect(result.success).toBe(true);
      expect(result.toolsAdded).toBe(2);
      expect(result.batches).toBe(1);
    });

    it('should track processed modules in state', async () => {
      const recordedCheckpoints = [];
      const customStateManager = {
        recordCheckpoint: async (stage, data) => {
          recordedCheckpoints.push(data);
          return { success: true };
        },
        getCurrentState: async () => ({
          stages: { loadTools: { processedModules: [] } }
        })
      };
      
      const stage = new LoadToolsStage({
        moduleLoader,
        mongoProvider,
        verifier,
        stateManager: customStateManager
      });
      
      await stage.execute({ module: 'module1' });
      
      expect(recordedCheckpoints).toHaveLength(1);
      expect(recordedCheckpoints[0].processedModule).toBe('module1');
    });

    it('should resume from previous state', async () => {
      // Simulate previous run that processed module1
      const customStateManager = {
        recordCheckpoint: async () => ({ success: true }),
        getCurrentState: async () => ({
          stages: {
            loadTools: {
              processedModules: ['module1']
            }
          }
        })
      };
      
      const stage = new LoadToolsStage({
        moduleLoader,
        mongoProvider,
        verifier,
        stateManager: customStateManager
      });
      
      const result = await stage.execute({});
      
      // Should skip module1 and process module2 and module3
      expect(result.modulesProcessed).toBe(2);
      expect(result.modulesSkipped).toBe(1);
      expect(result.toolsAdded).toBe(4);
    });

    it('should verify tool count after loading', async () => {
      const result = await loadToolsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.verification).toBeDefined();
      expect(result.verification.success).toBe(true);
      expect(result.verification.actualCount).toBe(6);
    });

    it('should fail if verification fails', async () => {
      const failingVerifier = {
        verifyToolCount: async () => ({
          success: false,
          actualCount: 5,
          expectedCount: 6,
          message: 'Tool count mismatch'
        })
      };
      
      const stage = new LoadToolsStage({
        moduleLoader,
        mongoProvider,
        verifier: failingVerifier,
        stateManager
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Tool count mismatch');
    });

    it('should handle MongoDB errors', async () => {
      const failingProvider = {
        find: async () => {
          throw new Error('MongoDB connection lost');
        }
      };
      
      const stage = new LoadToolsStage({
        moduleLoader,
        mongoProvider: failingProvider,
        verifier,
        stateManager
      });
      
      await expect(stage.execute({})).rejects.toThrow('MongoDB connection lost');
    });

    it('should report timing information', async () => {
      const result = await loadToolsStage.execute({});
      
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle empty module collection', async () => {
      await db.collection('modules').deleteMany({});
      
      const result = await loadToolsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.modulesProcessed).toBe(0);
      expect(result.toolsAdded).toBe(0);
    });

    it('should enrich tools with metadata', async () => {
      await loadToolsStage.execute({ module: 'module1' });
      
      const tools = await db.collection('tools').find({}).toArray();
      const tool = tools[0];
      
      expect(tool.metadata).toBeDefined();
      expect(tool.metadata.source).toBe('module_loader');
      expect(tool.hasExecute).toBe(true);
      expect(tool.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('error recovery', () => {
    it('should continue processing after individual tool failures', async () => {
      // Create a module loader that fails for specific tools
      const customLoader = {
        loadModule: async (moduleDoc) => ({
          name: moduleDoc.name,
          getTools: () => {
            if (moduleDoc.name === 'module2') {
              throw new Error('getTools failed');
            }
            return [{
              name: `${moduleDoc.name}_tool`,
              description: 'Test tool'
            }];
          }
        })
      };
      
      const stage = new LoadToolsStage({
        moduleLoader: customLoader,
        mongoProvider,
        verifier,
        stateManager
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.modulesFailed).toBe(1);
      expect(result.modulesProcessed).toBe(2); // module1 and module3
    });

    it('should handle partial batch failures', async () => {
      // Simulate a batch insert that partially fails
      const customProvider = {
        ...mongoProvider,
        insertMany: async (collection, docs) => {
          if (docs.length > 2) {
            // Simulate partial failure
            return { insertedCount: 2 };
          }
          return { insertedCount: docs.length };
        }
      };
      
      const stage = new LoadToolsStage({
        moduleLoader,
        mongoProvider: customProvider,
        verifier,
        stateManager
      });
      
      const result = await stage.execute({});
      
      // Should still complete but with fewer tools
      expect(result.success).toBe(true);
      expect(result.toolsAdded).toBeLessThan(6);
    });
  });
});