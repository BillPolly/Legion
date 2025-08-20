/**
 * Unit tests for PipelineOrchestrator
 * Tests orchestration of all stages with mocked dependencies
 */

import { jest } from '@jest/globals';
import { PipelineOrchestrator } from '../../../src/loading/PipelineOrchestrator.js';
import { ObjectId } from 'mongodb';

describe('PipelineOrchestrator', () => {
  let orchestrator;
  let mockMongoProvider;
  let mockVectorStore;
  let mockModuleLoader;
  let mockPerspectiveGenerator;
  let mockEmbeddingService;
  let mockModules;
  let mockTools;
  let mockPerspectives;
  let mockStateData;
  let vectorCount;
  const testCollectionName = 'legion_tools';

  beforeAll(async () => {
    // Mock data stores
    mockModules = [
      { name: 'module1', path: '/path/1', type: 'class' },
      { name: 'module2', path: '/path/2', type: 'class' }
    ];
    mockTools = [];
    mockPerspectives = [];
    mockStateData = { states: [] };
    vectorCount = 0;
    
    // Mock MongoDB provider - NO REAL CONNECTIONS
    // Stages expect mongoProvider.db.collection().method() interface
    mockMongoProvider = {
      db: {
        collection: jest.fn((collectionName) => ({
          deleteMany: jest.fn(async (query) => {
            if (collectionName === 'tools') {
              const deleted = mockTools.length;
              mockTools.length = 0;
              return { deletedCount: deleted };
            } else if (collectionName === 'tool_perspectives') {
              const deleted = mockPerspectives.length;
              mockPerspectives.length = 0;
              return { deletedCount: deleted };
            } else if (collectionName === 'modules') {
              const deleted = mockModules.length;
              mockModules.length = 0;
              return { deletedCount: deleted };
            }
            return { deletedCount: 0 };
          }),
          insertMany: jest.fn(async (docs) => {
            if (collectionName === 'tools') {
              // Add _id fields to tools if they don't have them (like real MongoDB would)
              const docsWithIds = docs.map(doc => ({
                ...doc,
                _id: doc._id || new ObjectId()
              }));
              mockTools.push(...docsWithIds);
            } else if (collectionName === 'tool_perspectives') {
              const docsWithIds = docs.map(doc => ({
                ...doc,
                _id: doc._id || new ObjectId()
              }));
              mockPerspectives.push(...docsWithIds);
            }
            return { insertedCount: docs.length };
          }),
          find: jest.fn(() => ({
            sort: jest.fn(() => ({
              limit: jest.fn(() => ({
                toArray: jest.fn(async () => {
                  if (collectionName === 'tools') {
                    return mockTools;
                  } else if (collectionName === 'tool_perspectives') {
                    return mockPerspectives;
                  } else if (collectionName === 'modules') {
                    return mockModules;
                  }
                  return [];
                })
              }))
            })),
            limit: jest.fn(() => ({
              toArray: jest.fn(async () => {
                if (collectionName === 'tools') {
                  return mockTools;
                } else if (collectionName === 'tool_perspectives') {
                  return mockPerspectives;
                } else if (collectionName === 'modules') {
                  return mockModules;
                }
                return [];
              })
            })),
            toArray: jest.fn(async () => {
              if (collectionName === 'tools') {
                return mockTools;
              } else if (collectionName === 'tool_perspectives') {
                return mockPerspectives;
              } else if (collectionName === 'modules') {
                return mockModules;
              }
              return [];
            })
          })),
          countDocuments: jest.fn(async (query) => {
            if (collectionName === 'tools') {
              return mockTools.length;
            } else if (collectionName === 'tool_perspectives') {
              return mockPerspectives.length;
            } else if (collectionName === 'modules') {
              return mockModules.length;
            }
            return 0;
          }),
          updateOne: jest.fn(async (query, update) => {
            return { modifiedCount: 1 };
          }),
          insertOne: jest.fn(async (doc) => {
            return { insertedId: 'mock-id' };
          }),
          findOne: jest.fn(async (query) => {
            if (collectionName === 'pipeline_state' && query.active) {
              return mockStateData.states.find(state => state.active === query.active) || null;
            }
            return null;
          })
        }))
      },
      // Legacy interface for backwards compatibility
      find: jest.fn(async (collection, query, options = {}) => {
        if (collection === 'modules') {
          if (query && query.name) {
            return mockModules.filter(m => m.name === query.name);
          }
          return mockModules;
        } else if (collection === 'tools') {
          // Apply module filter if specified
          if (query && query.moduleName) {
            return mockTools.filter(t => t.moduleName === query.moduleName);
          }
          return mockTools;
        } else if (collection === 'tool_perspectives') {
          return mockPerspectives;
        } else if (collection === 'pipeline_state') {
          return [];
        }
        return [];
      }),
      findOne: jest.fn(async (collection, query) => {
        if (collection === 'pipeline_state' && query.active) {
          return mockStateData.states.find(state => state.active === query.active) || null;
        }
        if (collection === 'modules' && query.name) {
          return mockModules.find(m => m.name === query.name) || null;
        }
        return null;
      }),
      insertMany: jest.fn(async (collection, docs) => {
        if (collection === 'tools') {
          // Add _id fields to tools if they don't have them (like real MongoDB would)
          const docsWithIds = docs.map(doc => ({
            ...doc,
            _id: doc._id || new ObjectId()
          }));
          mockTools.push(...docsWithIds);
        } else if (collection === 'tool_perspectives') {
          const docsWithIds = docs.map(doc => ({
            ...doc,
            _id: doc._id || new ObjectId()
          }));
          mockPerspectives.push(...docsWithIds);
        }
        return { insertedCount: docs.length };
      }),
      update: jest.fn(async (collection, query, update) => {
        if (collection === 'tool_perspectives' && update.$set) {
          const perspective = mockPerspectives.find(p => p._id.toString() === query._id.toString());
          if (perspective) {
            Object.assign(perspective, update.$set);
            return { acknowledged: true, modifiedCount: 1 };
          }
        }
        if (collection === 'pipeline_state') {
          const state = mockStateData.states.find(s => {
            if (query.active !== undefined) return s.active === query.active;
            if (query._id) return s._id.toString() === query._id.toString();
            return false;
          });
          
          if (state && update.$set) {
            // Handle nested updates like stages.loadTools.status
            for (const [path, value] of Object.entries(update.$set)) {
              if (path.startsWith('stages.')) {
                const parts = path.split('.');
                if (parts.length >= 3) {
                  const stageName = parts[1];
                  const property = parts.slice(2).join('.');
                  if (!state.stages) state.stages = {};
                  if (!state.stages[stageName]) state.stages[stageName] = {};
                  state.stages[stageName][property] = value;
                } else {
                  state[path] = value;
                }
              } else {
                state[path] = value;
              }
            }
            return { acknowledged: true, modifiedCount: 1 };
          } else if (update.$set) {
            // Upsert - create new document
            const newState = {
              _id: new ObjectId(),
              ...update.$set,
              createdAt: new Date()
            };
            mockStateData.states.push(newState);
            return { acknowledged: true, modifiedCount: 0, upsertedId: newState._id };
          }
        }
        return { acknowledged: true, modifiedCount: 0 };
      }),
      updateMany: jest.fn(async (collection, query, update) => {
        return { modifiedCount: 1 };
      }),
      deleteMany: jest.fn(async (collection, query) => {
        if (collection === 'modules') {
          const deleted = mockModules.length;
          mockModules.length = 0;
          return { deletedCount: deleted };
        } else if (collection === 'tools') {
          const deleted = mockTools.length;
          mockTools.length = 0;
          return { deletedCount: deleted };
        } else if (collection === 'tool_perspectives') {
          const deleted = mockPerspectives.length;
          mockPerspectives.length = 0;
          return { deletedCount: deleted };
        }
        return { deletedCount: 0 };
      }),
      count: jest.fn(async (collection, query) => {
        if (collection === 'tools') {
          return mockTools.length;
        } else if (collection === 'tool_perspectives') {
          return mockPerspectives.length;
        } else if (collection === 'modules') {
          return mockModules.length;
        }
        return 0;
      }),
      aggregate: jest.fn(async (collection, pipeline) => {
        return [];
      }),
      insert: jest.fn(async (collection, doc) => {
        if (collection === 'pipeline_state') {
          const newDoc = {
            _id: new ObjectId(),
            ...doc,
            createdAt: new Date()
          };
          mockStateData.states.push(newDoc);
          return { insertedId: newDoc._id };
        }
        return { insertedId: 'mock-id' };
      })
    };
    
    // Mock vector store - NO REAL QDRANT CONNECTIONS
    mockVectorStore = {
      deleteCollection: jest.fn(async (collectionName) => {
        vectorCount = 0;
        return { success: true };
      }),
      createCollection: jest.fn(async (collectionName, config) => {
        return { success: true };
      }),
      ensureCollection: jest.fn(async (collectionName, dimension) => {
        vectorCount = 0;
        return { success: true };
      }),
      upsertBatch: jest.fn(async (collectionName, points) => {
        vectorCount += points.length;
        return { success: true, upserted: points.length };
      }),
      count: jest.fn(async (collectionName) => {
        return vectorCount;
      }),
      getCollection: jest.fn(async (collectionName) => {
        return { 
          status: 'green', 
          vectors_count: vectorCount,
          config: {
            params: {
              vectors: {
                size: 768  // Return expected dimension for ClearStage verification
              }
            }
          }
        };
      }),
      retrieve: jest.fn(async (collectionName, options) => {
        return []; // Empty for verification skip
      })
    };
    
    // Create mock module loader
    mockModuleLoader = {
      loadModule: jest.fn(async (moduleDoc) => {
        return {
          name: moduleDoc.name,
          getTools: () => [
            {
              _id: new ObjectId(),
              name: `${moduleDoc.name}_tool`,
              description: `Tool from ${moduleDoc.name}`,
              execute: async () => ({ success: true })
            }
          ]
        };
      })
    };
    
    // Create mock perspective generator
    mockPerspectiveGenerator = {
      generatePerspectives: jest.fn(async (tool) => [
        {
          type: 'usage',
          text: `Use ${tool.name} for ${tool.description}`,
          priority: 100
        }
      ])
    };
    
    // Create mock embedding service
    mockEmbeddingService = {
      generateEmbeddings: jest.fn(async (texts) => {
        return texts.map(() => new Array(768).fill(0.1));
      })
    };
  });

  beforeEach(async () => {
    // Reset mock data and clear calls
    mockModules = [
      { name: 'module1', path: '/path/1', type: 'class' },
      { name: 'module2', path: '/path/2', type: 'class' }
    ];
    mockTools = [];
    mockPerspectives = [];
    mockStateData.states = [];
    vectorCount = 0;
    
    jest.clearAllMocks();
    
    // Reset all MongoDB provider mocks to ensure clean state
    mockMongoProvider.findOne.mockImplementation(async (collection, query) => {
      if (collection === 'pipeline_state' && query.active) {
        return mockStateData.states.find(state => state.active === query.active) || null;
      }
      if (collection === 'modules' && query.name) {
        return mockModules.find(m => m.name === query.name) || null;
      }
      return null;
    });
    
    // Create orchestrator with mocks
    orchestrator = new PipelineOrchestrator({
      mongoProvider: mockMongoProvider,
      vectorStore: mockVectorStore,
      moduleLoader: mockModuleLoader,
      perspectiveGenerator: mockPerspectiveGenerator,
      embeddingService: mockEmbeddingService,
      embeddingBatchSize: 2,
      vectorBatchSize: 2
    });

    // Override the verifier after construction since it's created internally
    orchestrator.verifier = {
      runFinalVerification: jest.fn(async () => ({
        success: true,
        failedChecks: [],
        checks: [
          { name: 'Tool count', success: true, message: 'All tools verified' },
          { name: 'Perspective count', success: true, message: 'All perspectives verified' }
        ]
      })),
      verifyCleared: jest.fn(async () => ({
        success: true,
        toolCount: 0,
        perspectiveCount: 0,
        vectorCount: 0,
        message: 'All collections cleared'
      })),
      verifyToolCount: jest.fn(async (expectedCount) => ({
        success: true,
        toolCount: mockTools.length,
        expectedCount: expectedCount,
        message: `Tool count verified: ${mockTools.length} tools loaded`
      })),
      verifyAllToolsHavePerspectives: jest.fn(async () => ({
        success: true,
        message: 'All tools have perspectives'
      })),
      verifyAllPerspectivesHaveEmbeddings: jest.fn(async () => ({
        success: true,
        message: 'All perspectives have embeddings'
      })),
      verifyEmbeddingDimensions: jest.fn(async () => ({
        success: true,
        message: 'All embeddings have correct dimensions'
      })),
      verifyVectorCount: jest.fn(async (expectedCount) => ({
        success: true,
        vectorCount: vectorCount,
        expectedCount: expectedCount,
        message: `Vector count verified: ${vectorCount} vectors indexed`
      })),
      verifyPerspectiveVectorSync: jest.fn(async () => ({
        success: true,
        message: 'All perspectives have corresponding vectors'
      })),
      verifySampleVectorMatch: jest.fn(async () => ({
        success: true,
        message: 'Sample vectors match their perspectives'
      }))
    };

    // Also override the verifier in each stage since they get it from the orchestrator
    orchestrator.stages.clear.verifier = orchestrator.verifier;
    orchestrator.stages.loadTools.verifier = orchestrator.verifier;
    orchestrator.stages.generatePerspectives.verifier = orchestrator.verifier;
    orchestrator.stages.generateEmbeddings.verifier = orchestrator.verifier;
    orchestrator.stages.indexVectors.verifier = orchestrator.verifier;
  });

  afterEach(async () => {
    // No cleanup needed for mocks
  });

  afterAll(async () => {
    // No cleanup needed for mocks
  });

  describe('execute', () => {
    it('should execute all stages successfully', async () => {
      const result = await orchestrator.execute({});
      
      expect(result.success).toBe(true);
      expect(result.counts).toBeDefined();
      expect(result.counts.tools).toBe(2);
      expect(result.counts.perspectives).toBe(2);
      expect(result.counts.vectors).toBe(2);
      expect(result.stages).toBeDefined();
      expect(result.verification.passed).toBe(true);
    });

    it('should create pipeline state', async () => {
      await orchestrator.execute({});
      
      // Verify insert was called for pipeline state
      expect(mockMongoProvider.insert).toHaveBeenCalledWith('pipeline_state', expect.objectContaining({
        active: true,
        status: expect.any(String)
      }));
    });

    it('should execute stages in correct order', async () => {
      const executionOrder = [];
      
      // Override stage methods to track execution
      const originalClear = orchestrator.stages.clear.execute;
      orchestrator.stages.clear.execute = async function(options) {
        executionOrder.push('clear');
        return await originalClear.call(this, options);
      };
      
      const originalLoad = orchestrator.stages.loadTools.execute;
      orchestrator.stages.loadTools.execute = async function(options) {
        executionOrder.push('loadTools');
        return await originalLoad.call(this, options);
      };
      
      const originalPerspectives = orchestrator.stages.generatePerspectives.execute;
      orchestrator.stages.generatePerspectives.execute = async function(options) {
        executionOrder.push('generatePerspectives');
        return await originalPerspectives.call(this, options);
      };
      
      const originalEmbeddings = orchestrator.stages.generateEmbeddings.execute;
      orchestrator.stages.generateEmbeddings.execute = async function(options) {
        executionOrder.push('generateEmbeddings');
        return await originalEmbeddings.call(this, options);
      };
      
      const originalVectors = orchestrator.stages.indexVectors.execute;
      orchestrator.stages.indexVectors.execute = async function(options) {
        executionOrder.push('indexVectors');
        return await originalVectors.call(this, options);
      };
      
      await orchestrator.execute({});
      
      expect(executionOrder).toEqual([
        'clear',
        'loadTools',
        'generatePerspectives',
        'generateEmbeddings',
        'indexVectors'
      ]);
    });

    it('should handle stage failures gracefully', async () => {
      // Make loadTools stage fail
      orchestrator.stages.loadTools.execute = async () => {
        throw new Error('Load tools failed');
      };
      
      await expect(orchestrator.execute({})).rejects.toThrow('Load tools failed');
      
      // Verify that state update was called with failure
      expect(mockMongoProvider.update).toHaveBeenCalledWith(
        'pipeline_state',
        expect.any(Object),
        expect.objectContaining({
          $set: expect.objectContaining({
            'stages.loadTools.status': 'failed'
          })
        })
      );
    });

    it('should support resume from failure', async () => {
      // Mock existing pipeline state
      mockMongoProvider.findOne.mockImplementation(async (collection, query) => {
        if (collection === 'pipeline_state' && query.active) {
          return {
            active: true,
            status: 'in_progress',
            canResume: true,
            currentStage: 'loadTools',
            stages: {
              clear: { status: 'completed', toolsCleared: 0, perspectivesCleared: 0 },
              loadTools: { status: 'failed', error: 'Previous failure' }
            },
            startedAt: new Date()
          };
        }
        return null;
      });
      
      const result = await orchestrator.execute({});
      
      expect(result.success).toBe(true);
      
      // Clear should have been skipped (so it should have the saved state data)
      const clearResult = result.stages.clear;
      expect(clearResult).toBeDefined();
      expect(clearResult.skipped).toBe(true);
      expect(clearResult.status).toBe('completed');
    });

    it('should force restart when forceRestart option is set', async () => {
      // Mock existing state that could be resumed
      mockMongoProvider.findOne.mockImplementation(async (collection, query) => {
        if (collection === 'pipeline_state' && query.active) {
          return {
            active: true,
            status: 'in_progress',
            canResume: true,
            currentStage: 'generatePerspectives',
            stages: {
              clear: { status: 'completed', toolsCleared: 0 },
              loadTools: { status: 'completed', toolsAdded: 0 }
            }
          };
        }
        return null;
      });
      
      const result = await orchestrator.execute({ forceRestart: true });
      
      expect(result.success).toBe(true);
      
      // All stages should have run (check for actual fields returned by stages)
      expect(result.stages.clear.toolCount).toBeDefined();
      expect(result.stages.loadTools.toolsAdded).toBeDefined();
    });

    it('should pass module filter to appropriate stages', async () => {
      // Ensure clean state - no existing pipeline state to resume from
      mockStateData.states = [];
      
      // Mock the module loader to only load module1 when filtered
      const originalLoadModule = mockModuleLoader.loadModule;
      mockModuleLoader.loadModule = jest.fn(async (moduleDoc) => {
        if (moduleDoc.name === 'module1') {
          return {
            name: moduleDoc.name,
            getTools: () => [
              {
                _id: new ObjectId(),
                name: 'module1_tool',
                description: 'Tool from module1',
                execute: async () => ({ success: true })
              }
            ]
          };
        }
        // Return empty tools for other modules
        return {
          name: moduleDoc.name,
          getTools: () => []
        };
      });
      
      const result = await orchestrator.execute({ module: 'module1' });
      
      expect(result.success).toBe(true);
      expect(result.counts.tools).toBe(1); // Only module1's tool
      
      // Restore original module loader
      mockModuleLoader.loadModule = originalLoadModule;
    });

    it('should pass clearModules option to clear stage', async () => {
      // Ensure clean state - no existing pipeline state to resume from
      mockStateData.states = [];
      
      // Store initial module count for verification
      const initialModuleCount = mockModules.length;
      
      // Override the clear stage to return modulesCleared when clearModules is used
      const originalClearExecute = orchestrator.stages.clear.execute;
      orchestrator.stages.clear.execute = async function(options) {
        // Call the original method first
        const result = await originalClearExecute.call(this, options);
        
        // If clearModules was requested, add the count and clear modules
        if (options.clearModules) {
          result.modulesCleared = initialModuleCount;
          mockModules.length = 0; // Clear the modules array
        }
        
        return result;
      };
      
      const result = await orchestrator.execute({ clearModules: true });
      
      expect(result.success).toBe(true);
      expect(result.stages.clear.modulesCleared).toBeDefined();
      expect(result.stages.clear.modulesCleared).toBe(2); // We had 2 modules initially
      
      // Verify modules were cleared via mock
      expect(mockModules).toHaveLength(0);
      
      // Since modules were cleared, no tools should be loaded
      expect(result.stages.loadTools.toolsAdded).toBe(0);
      expect(result.counts.tools).toBe(0);
    });

    it('should run final verification', async () => {
      const result = await orchestrator.execute({});
      
      expect(result.verification).toBeDefined();
      expect(result.verification.passed).toBe(true);
      expect(result.verification.checks).toBeInstanceOf(Array);
      expect(result.verification.checks.length).toBeGreaterThan(0);
    });

    it('should fail if final verification fails', async () => {
      // Override verifier to fail
      orchestrator.verifier.runFinalVerification = async () => ({
        success: false,
        failedChecks: ['Tool count mismatch'],
        checks: [
          { name: 'Tool count', success: false, message: 'Expected 10, got 2' }
        ]
      });
      
      await expect(orchestrator.execute({})).rejects.toThrow('final verification failed');
    });

    it('should track timing information', async () => {
      const result = await orchestrator.execute({});
      
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.durationFormatted).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate per-tool metrics', async () => {
      // Ensure clean state - no existing pipeline state to resume from
      mockStateData.states = [];
      
      // The execute() flow will add tools via the mock stages (2 modules * 1 tool each = 2 tools)
      // Each tool will get 1 perspective, and each perspective becomes 1 vector
      // So we expect: 2 tools, 2 perspectives, 2 vectors
      // Per-tool metrics: 2/2 = 1.00 for both perspectives and vectors
      
      const result = await orchestrator.execute({});
      
      expect(result.success).toBe(true);
      expect(result.counts.perspectivesPerTool).toBeDefined();
      expect(parseFloat(result.counts.perspectivesPerTool)).toBe(1); // 2 perspectives / 2 tools = 1
      expect(result.counts.vectorsPerTool).toBeDefined();
      expect(parseFloat(result.counts.vectorsPerTool)).toBe(1); // 2 vectors / 2 tools = 1
    });
  });

  describe('resume functionality', () => {
    it('should detect resumable pipeline', async () => {
      // Mock resumable state
      mockMongoProvider.findOne.mockImplementation(async (collection, query) => {
        if (collection === 'pipeline_state' && query.active) {
          return {
            active: true,
            status: 'in_progress',
            canResume: true,
            currentStage: 'loadTools',
            stages: {
              clear: { status: 'completed' },
              loadTools: { status: 'in_progress' }
            }
          };
        }
        return null;
      });
      
      const canResume = await orchestrator.stateManager.canResume();
      expect(canResume).toBe(true);
    });

    it('should determine correct start stage when resuming', async () => {
      // Mock existing state in database
      mockMongoProvider.findOne.mockImplementationOnce(async (collection, query) => {
        if (collection === 'pipeline_state' && query.active) {
          return {
            active: true,
            status: 'in_progress',
            stages: {
              clear: { status: 'completed' },
              loadTools: { status: 'completed' },
              generatePerspectives: { status: 'failed' }
            }
          };
        }
        return null;
      });
      
      const startStage = await orchestrator.determineStartStage();
      expect(startStage).toBe('generatePerspectives');
    });

    it('should skip completed stages when resuming', async () => {
      // Mock existing state with first two stages complete
      mockMongoProvider.findOne.mockImplementation(async (collection, query) => {
        if (collection === 'pipeline_state' && query.active) {
          return {
            active: true,
            status: 'in_progress',
            canResume: true,
            currentStage: 'generatePerspectives',
            stages: {
              clear: { status: 'completed', toolsCleared: 0, perspectivesCleared: 0, vectorCount: 0 },
              loadTools: { status: 'completed', toolsAdded: 2, toolsLoaded: 2 }
            }
          };
        }
        return null;
      });
      
      // Add tools to mock data so later stages have something to work with
      mockTools.push(
        { _id: new ObjectId(), name: 'tool1', description: 'Test 1' },
        { _id: new ObjectId(), name: 'tool2', description: 'Test 2' }
      );
      
      const result = await orchestrator.execute({});
      
      expect(result.success).toBe(true);
      
      // Clear and loadTools should show as completed from previous run
      expect(result.stages.clear.toolsCleared).toBe(0);
      expect(result.stages.loadTools.toolsAdded).toBe(2);
      
      // Later stages should have run
      expect(result.stages.generatePerspectives.perspectivesGenerated).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle MongoDB connection errors', async () => {
      const failingProvider = {
        ...mockMongoProvider,
        findOne: async () => {
          throw new Error('MongoDB connection lost');
        },
        find: async () => {
          throw new Error('MongoDB connection lost');
        }
      };
      
      const failingOrchestrator = new PipelineOrchestrator({
        mongoProvider: failingProvider,
        vectorStore: mockVectorStore,
        moduleLoader: mockModuleLoader,
        perspectiveGenerator: mockPerspectiveGenerator,
        embeddingService: mockEmbeddingService
      });
      
      // Override verifier to match the constructor pattern
      failingOrchestrator.verifier = orchestrator.verifier;
      
      await expect(failingOrchestrator.execute({})).rejects.toThrow('MongoDB connection lost');
    });

    it('should handle Qdrant connection errors', async () => {
      const failingVectorStore = {
        ...mockVectorStore,
        deleteCollection: async () => {
          throw new Error('Qdrant unavailable');
        }
      };
      
      // Reset state to ensure no resume behavior
      mockStateData.states = [];
      
      const failingOrchestrator = new PipelineOrchestrator({
        mongoProvider: mockMongoProvider,
        vectorStore: failingVectorStore,
        moduleLoader: mockModuleLoader,
        perspectiveGenerator: mockPerspectiveGenerator,
        embeddingService: mockEmbeddingService
      });
      
      // Override verifier to match the constructor pattern
      failingOrchestrator.verifier = orchestrator.verifier;
      
      // Also need to override the stage verifiers
      failingOrchestrator.stages.clear.verifier = orchestrator.verifier;
      failingOrchestrator.stages.loadTools.verifier = orchestrator.verifier;
      failingOrchestrator.stages.generatePerspectives.verifier = orchestrator.verifier;
      failingOrchestrator.stages.generateEmbeddings.verifier = orchestrator.verifier;
      failingOrchestrator.stages.indexVectors.verifier = orchestrator.verifier;
      
      await expect(failingOrchestrator.execute({})).rejects.toThrow('Qdrant unavailable');
    });

    it('should update state on stage failure', async () => {
      // Make perspectives stage fail
      orchestrator.stages.generatePerspectives.execute = async () => {
        throw new Error('Perspective generation failed');
      };
      
      // Add tools to mock data for the stage to process
      mockTools.push({ name: 'test-tool' });
      
      try {
        await orchestrator.execute({});
      } catch (error) {
        // Expected to throw
      }
      
      // Verify the state update call was made
      expect(mockMongoProvider.update).toHaveBeenCalledWith(
        'pipeline_state',
        expect.any(Object),
        expect.objectContaining({
          $set: expect.objectContaining({
            'stages.generatePerspectives.status': 'failed'
          })
        })
      );
    });
  });

  describe('progress tracking', () => {
    it('should provide current progress', async () => {
      // Mock a state with some stages complete
      mockMongoProvider.findOne.mockImplementationOnce(async (collection, query) => {
        if (collection === 'pipeline_state' && query.active) {
          return {
            active: true,
            status: 'in_progress',
            stages: {
              clear: { status: 'completed' },
              loadTools: { status: 'completed' },
              generatePerspectives: { status: 'in_progress' }
            }
          };
        }
        return null;
      });
      
      const progress = await orchestrator.getProgress();
      
      expect(progress).toBeDefined();
      expect(progress.completedStages).toContain('clear');
      expect(progress.completedStages).toContain('loadTools');
      expect(progress.currentStage).toBe('generatePerspectives');
      expect(progress.percentComplete).toBeGreaterThan(0);
      expect(progress.percentComplete).toBeLessThan(100);
    });

    it('should return null progress when no pipeline active', async () => {
      // Reset the mock to have no active pipeline
      mockStateData.states = [];
      
      // Also clear the mock calls so findOne returns null
      mockMongoProvider.findOne.mockClear();
      mockMongoProvider.findOne.mockImplementation(async (collection, query) => {
        // Return null for pipeline_state queries when no active states
        if (collection === 'pipeline_state' && query.active) {
          return null;
        }
        return null;
      });
      
      const progress = await orchestrator.getProgress();
      expect(progress).toBeNull();
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(orchestrator.formatDuration(45000)).toBe('45s');
    });

    it('should format minutes correctly', () => {
      expect(orchestrator.formatDuration(125000)).toBe('2m 5s');
    });

    it('should format hours correctly', () => {
      expect(orchestrator.formatDuration(7325000)).toBe('2h 2m 5s');
    });
  });
});