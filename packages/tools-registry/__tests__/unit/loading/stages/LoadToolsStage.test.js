/**
 * Unit tests for LoadToolsStage
 * Tests tool loading from modules using mocked dependencies
 */

import { LoadToolsStage } from '../../../../src/loading/stages/LoadToolsStage.js';
import { ObjectId } from 'mongodb';

describe('LoadToolsStage', () => {
  let loadToolsStage;
  let mockMongoProvider;
  let mockModuleLoader;
  let mockVerifier;
  let mockStateManager;
  let mockModules;
  let mockTools;

  beforeAll(async () => {
    // Mock MongoDB provider - NO REAL CONNECTIONS
    mockModules = [
      { _id: new ObjectId(), name: 'module1', path: '/path/to/module1', type: 'class' },
      { _id: new ObjectId(), name: 'module2', path: '/path/to/module2', type: 'class' },
      { _id: new ObjectId(), name: 'module3', path: '/path/to/module3', type: 'class' }
    ];
    
    mockTools = [];
    
    mockMongoProvider = {
      find: jest.fn(async (collection, query, options = {}) => {
        if (collection === 'modules') {
          if (query.name) {
            return mockModules.filter(m => m.name === query.name);
          }
          return mockModules;
        }
        return [];
      }),
      insertMany: jest.fn(async (collection, docs) => {
        if (collection === 'tools') {
          mockTools.push(...docs);
        }
        return { insertedCount: docs.length };
      }),
      count: jest.fn(async (collection, query) => {
        if (collection === 'tools') {
          return mockTools.length;
        }
        return 0;
      })
    };
    
    // Create mock module loader
    mockModuleLoader = {
      loadModule: jest.fn(async (moduleDoc) => {
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
      })
    };
    
    // Create mock verifier
    mockVerifier = {
      verifyToolCount: jest.fn(async (expectedCount) => {
        const actualCount = mockTools.length;
        return {
          success: actualCount === expectedCount,
          actualCount,
          expectedCount
        };
      })
    };
    
    // Create mock state manager
    mockStateManager = {
      recordCheckpoint: jest.fn(async (stage, data) => {
        return { success: true };
      }),
      getCurrentState: jest.fn(async () => {
        return {
          stages: {
            loadTools: {
              processedModules: []
            }
          }
        };
      })
    };
  });

  beforeEach(async () => {
    // Reset mock data and calls
    mockTools = [];
    jest.clearAllMocks();
    
    loadToolsStage = new LoadToolsStage({
      moduleLoader: mockModuleLoader,
      mongoProvider: mockMongoProvider,
      verifier: mockVerifier,
      stateManager: mockStateManager
    });
  });

  afterEach(async () => {
    // No cleanup needed for mocks
  });

  afterAll(async () => {
    // No cleanup needed for mocks
  });

  describe('execute', () => {
    it('should load tools from all modules', async () => {
      const result = await loadToolsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.modulesProcessed).toBe(3);
      expect(result.toolsAdded).toBe(6); // 3 modules × 2 tools each
      
      expect(mockTools).toHaveLength(6);
    });

    it('should filter by module name', async () => {
      const result = await loadToolsStage.execute({ module: 'module1' });
      
      expect(result.success).toBe(true);
      expect(result.modulesProcessed).toBe(1);
      expect(result.toolsAdded).toBe(2);
      
      expect(mockTools).toHaveLength(2);
      expect(mockTools[0].name).toContain('module1');
    });

    it('should handle modules with no tools', async () => {
      // Add empty module to mock data
      mockModules.push({
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
      // Add failing module to mock data
      mockModules.push({
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
      
      expect(mockTools).toHaveLength(2);
      
      const tool = mockTools[0];
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
        recordCheckpoint: jest.fn(async (stage, data) => {
          recordedCheckpoints.push(data);
          return { success: true };
        }),
        getCurrentState: jest.fn(async () => ({
          stages: { loadTools: { processedModules: [] } }
        }))
      };
      
      const stage = new LoadToolsStage({
        moduleLoader: mockModuleLoader,
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
        stateManager: customStateManager
      });
      
      await stage.execute({ module: 'module1' });
      
      expect(recordedCheckpoints).toHaveLength(1);
      expect(recordedCheckpoints[0].processedModule).toBe('module1');
    });

    it('should resume from previous state', async () => {
      // Simulate previous run that processed module1
      const customStateManager = {
        recordCheckpoint: jest.fn(async () => ({ success: true })),
        getCurrentState: jest.fn(async () => ({
          stages: {
            loadTools: {
              processedModules: ['module1']
            }
          }
        }))
      };
      
      const stage = new LoadToolsStage({
        moduleLoader: mockModuleLoader,
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
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
        verifyToolCount: jest.fn(async () => ({
          success: false,
          actualCount: 5,
          expectedCount: 6,
          message: 'Tool count mismatch'
        }))
      };
      
      const stage = new LoadToolsStage({
        moduleLoader: mockModuleLoader,
        mongoProvider: mockMongoProvider,
        verifier: failingVerifier,
        stateManager: mockStateManager
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Tool count mismatch');
    });

    it('should handle MongoDB errors', async () => {
      const failingProvider = {
        find: jest.fn(async () => {
          throw new Error('MongoDB connection lost');
        })
      };
      
      const stage = new LoadToolsStage({
        moduleLoader: mockModuleLoader,
        mongoProvider: failingProvider,
        verifier: mockVerifier,
        stateManager: mockStateManager
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
      // Clear mock modules
      mockModules = [];
      
      const result = await loadToolsStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.modulesProcessed).toBe(0);
      expect(result.toolsAdded).toBe(0);
    });

    it('should enrich tools with metadata', async () => {
      await loadToolsStage.execute({ module: 'module1' });
      
      const tool = mockTools[0];
      
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
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
        stateManager: mockStateManager
      });
      
      const result = await stage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.modulesFailed).toBe(1);
      expect(result.modulesProcessed).toBe(2); // module1 and module3
    });

    it('should handle partial batch failures', async () => {
      // Simulate a batch insert that partially fails
      const customProvider = {
        ...mockMongoProvider,
        insertMany: jest.fn(async (collection, docs) => {
          if (docs.length > 2) {
            // Simulate partial failure - only insert first 2
            mockTools.push(...docs.slice(0, 2));
            return { insertedCount: 2 };
          }
          mockTools.push(...docs);
          return { insertedCount: docs.length };
        })
      };
      
      const stage = new LoadToolsStage({
        moduleLoader: mockModuleLoader,
        mongoProvider: customProvider,
        verifier: mockVerifier,
        stateManager: mockStateManager
      });
      
      const result = await stage.execute({});
      
      // Should still complete but with fewer tools
      expect(result.success).toBe(true);
      expect(result.toolsAdded).toBeLessThan(6);
    });
  });
});