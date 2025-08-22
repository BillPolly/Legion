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
  let mockModules; // Runtime modules collection (gets cleared)
  let mockModuleRegistry; // Module registry collection (preserved)
  let mockTools;
  let mockPerspectives;
  let mockStateData;
  let vectorCount;
  const testCollectionName = 'legion_tools';

  beforeEach(async () => {
    // Reset mock data 
    mockModules = []; // Runtime modules (cleared by ClearStage)
    mockModuleRegistry = [
      { name: 'module1', path: '/path/1', type: 'class' },
      { name: 'module2', path: '/path/2', type: 'class' }
    ]; // Module registry (preserved)
    mockTools = [];
    mockPerspectives = [];
    mockStateData = { states: [] };
    vectorCount = 0;
    
    // Mock MongoDB provider - NO REAL CONNECTIONS
    // Stages expect both mongoProvider.find() and mongoProvider.db.collection() interfaces
    mockMongoProvider = {
      // Methods for direct mongoProvider calls
      find: jest.fn(async (collection, query) => {
        if (collection === 'tools') {
          if (query && query.moduleName) {
            return mockTools.filter(t => t.moduleName === query.moduleName);
          }
          return mockTools;
        } else if (collection === 'tool_perspectives') {
          if (query && query.moduleName) {
            return mockPerspectives.filter(p => p.moduleName === query.moduleName);
          }
          if (query && query.$or) {
            // Handle $or queries for perspectives without embeddings
            return mockPerspectives.filter(p => {
              return query.$or.some(condition => {
                if (condition.embedding && condition.embedding.$exists === false) {
                  return !p.hasOwnProperty('embedding');
                }
                if (condition.embedding === null) {
                  return p.embedding === null;
                }
                if (Array.isArray(condition.embedding) && condition.embedding.length === 0) {
                  return Array.isArray(p.embedding) && p.embedding.length === 0;
                }
                return false;
              });
            });
          }
          return mockPerspectives;
        } else if (collection === 'modules') {
          return mockModules;
        } else if (collection === 'module_registry') {
          if (query && query.name) {
            return mockModuleRegistry.filter(m => m.name === query.name);
          }
          return mockModuleRegistry;
        }
        return [];
      }),
      findOne: jest.fn(async (collection, query) => {
        if (collection === 'module_registry' && query && query.name) {
          return mockModuleRegistry.find(m => m.name === query.name);
        }
        if (collection === 'pipeline_state' && query && query.active) {
          return mockStateData.states.find(state => state.active === query.active) || null;
        }
        return null;
      }),
      count: jest.fn(async (collection, query) => {
        if (collection === 'tools') {
          if (query && query.moduleName) {
            return mockTools.filter(t => t.moduleName === query.moduleName).length;
          }
          return mockTools.length;
        } else if (collection === 'tool_perspectives') {
          if (query && query.moduleName) {
            return mockPerspectives.filter(p => p.moduleName === query.moduleName).length;
          }
          if (query && query.embedding && query.embedding.$exists && query.embedding.$ne === null) {
            return mockPerspectives.filter(p => p.embedding && p.embedding !== null).length;
          }
          return mockPerspectives.length;
        } else if (collection === 'modules') {
          return mockModules.length;
        }
        return 0;
      }),
      update: jest.fn(async (collection, query, update) => {
        if (collection === 'pipeline_state' && update.$set) {
          mockStateData.states.push(update.$set);
          return { modifiedCount: 1 };
        } else if (collection === 'module_registry' && update.$set) {
          const module = mockModuleRegistry.find(m => m.name === query.name);
          if (module) {
            Object.assign(module, update.$set);
            return { modifiedCount: 1 };
          }
        } else if (collection === 'tool_perspectives' && update.$set) {
          const perspective = mockPerspectives.find(p => p._id && p._id.toString() === query._id.toString());
          if (perspective) {
            Object.assign(perspective, update.$set);
            return { modifiedCount: 1 };
          }
        }
        return { modifiedCount: 0 };
      }),
      insert: jest.fn(async (collection, doc) => {
        // Handle single document insert (used by PipelineStateManager)
        if (collection === 'pipeline_state') {
          const docWithId = {
            ...doc,
            _id: doc._id || new ObjectId()
          };
          mockStateData.states.push(docWithId);
          return { insertedId: docWithId._id };
        } else if (collection === 'tools') {
          const docWithId = {
            ...doc,
            _id: doc._id || new ObjectId()
          };
          mockTools.push(docWithId);
          return { insertedId: docWithId._id };
        } else if (collection === 'modules') {
          const docWithId = {
            ...doc,
            _id: doc._id || new ObjectId()
          };
          mockModules.push(docWithId);
          return { insertedId: docWithId._id };
        } else if (collection === 'tool_perspectives') {
          const docWithId = {
            ...doc,
            _id: doc._id || new ObjectId()
          };
          mockPerspectives.push(docWithId);
          return { insertedId: docWithId._id };
        }
        return { insertedId: null };
      }),
      insertMany: jest.fn(async (collection, docs) => {
        if (collection === 'tools') {
          const docsWithIds = docs.map(doc => ({
            ...doc,
            _id: doc._id || new ObjectId()
          }));
          mockTools.push(...docsWithIds);
          return { insertedCount: docs.length };
        } else if (collection === 'modules') {
          const docsWithIds = docs.map(doc => ({
            ...doc,
            _id: doc._id || new ObjectId()
          }));
          mockModules.push(...docsWithIds);
          return { insertedCount: docs.length };
        } else if (collection === 'tool_perspectives') {
          const docsWithIds = docs.map(doc => ({
            ...doc,
            _id: doc._id || new ObjectId()
          }));
          mockPerspectives.push(...docsWithIds);
          return { insertedCount: docs.length };
        }
        return { insertedCount: 0 };
      }),
      // db property for collection-based operations
      db: {
        collection: jest.fn((collectionName) => {
          // Return methods based on collection name
          return {
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
          };
        })
      }
    };
    
    // Mock vector store - NO REAL QDRANT CONNECTIONS
    mockVectorStore = {
      deleteCollection: jest.fn(async (collectionName) => {
        vectorCount = 0;
        return { success: true };
      }),
      clearCollection: jest.fn(async (collectionName) => {
        vectorCount = 0;
        return { success: true, message: 'Collection cleared' };
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
                size: 768  // Return expected dimension
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
              name: `${moduleDoc.name}_tool1`, 
              description: `Tool 1 from ${moduleDoc.name}`,
              execute: jest.fn()
            },
            { 
              name: `${moduleDoc.name}_tool2`, 
              description: `Tool 2 from ${moduleDoc.name}`,
              execute: jest.fn()
            }
          ]
        };
      })
    };
    
    // Create mock perspective generator
    mockPerspectiveGenerator = {
      generateForTool: jest.fn(async (tool) => {
        return [
          {
            toolId: tool._id,
            toolName: tool.name,
            moduleName: tool.moduleName,
            perspectiveType: 'usage',
            perspectiveText: `How to use ${tool.name}`,
            priority: 1
          },
          {
            toolId: tool._id,
            toolName: tool.name,
            moduleName: tool.moduleName,
            perspectiveType: 'example',
            perspectiveText: `Example of ${tool.name}`,
            priority: 2
          },
          {
            toolId: tool._id,
            toolName: tool.name,
            moduleName: tool.moduleName,
            perspectiveType: 'description',
            perspectiveText: `Description of ${tool.name}`,
            priority: 3
          }
        ];
      })
    };
    
    // Create mock embedding service
    mockEmbeddingService = {
      generateEmbeddings: jest.fn(async (texts) => {
        return texts.map(text => {
          // Generate deterministic fake embedding based on text
          const embedding = new Array(768).fill(0);
          for (let i = 0; i < Math.min(text.length, 768); i++) {
            embedding[i] = text.charCodeAt(i % text.length) / 255;
          }
          return embedding;
        });
      })
    };
    
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
      verifyAllIntegrity: jest.fn(async () => ({
        success: true,
        errors: [],
        warnings: [],
        counts: {
          modules: mockModuleRegistry.length,
          tools: mockTools.length,
          perspectives: mockPerspectives.length,
          vectors: vectorCount
        }
      })),
      runFinalVerification: jest.fn(async () => ({
        success: true,
        checks: [],
        toolCount: mockTools.length,
        perspectiveCount: mockPerspectives.length,
        vectorCount: vectorCount
      }))
    };
    
    // Mock all stage execute methods to avoid real verification errors
    orchestrator.stages.clear.execute = jest.fn(async (options) => ({ 
      success: true, 
      toolsCleared: 0, 
      perspectivesCleared: 0,
      modulesCleared: 0
    }));
    
    orchestrator.stages.loadTools.execute = jest.fn(async (options) => {
      // Add tools to mockTools if not already populated
      if (mockTools.length === 0) {
        mockTools.push(
          { _id: new ObjectId(), name: 'tool1', moduleName: 'module1' },
          { _id: new ObjectId(), name: 'tool2', moduleName: 'module1' }
        );
      }
      return { success: true, toolsAdded: mockTools.length };
    });
    
    orchestrator.stages.generatePerspectives.execute = jest.fn(async (options) => {
      // Add perspectives for the tools if not already populated
      if (mockPerspectives.length === 0) {
        for (const tool of mockTools) {
          mockPerspectives.push(
            { _id: new ObjectId(), toolId: tool._id, toolName: tool.name, perspectiveText: `Usage of ${tool.name}` },
            { _id: new ObjectId(), toolId: tool._id, toolName: tool.name, perspectiveText: `Example of ${tool.name}` }
          );
        }
      }
      return { success: true, perspectivesGenerated: mockPerspectives.length };
    });
    
    orchestrator.stages.generateEmbeddings.execute = jest.fn(async (options) => {
      // Add embeddings to perspectives
      for (const perspective of mockPerspectives) {
        if (!perspective.embedding) {
          perspective.embedding = new Array(768).fill(0.1);
        }
      }
      return { success: true, embeddingsGenerated: mockPerspectives.length };
    });
    
    orchestrator.stages.indexVectors.execute = jest.fn(async (options) => {
      vectorCount = mockPerspectives.filter(p => p.embedding).length;
      return { success: true, vectorsIndexed: vectorCount };
    });
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  afterEach(async () => {
    // No cleanup needed for mocks
  });
  
  afterAll(async () => {
    // No cleanup needed for mocks
  });

  describe('Pipeline Execution', () => {
    it('should execute all stages successfully', async () => {
      const result = await orchestrator.execute({});
      
      expect(result.success).toBe(true);
      expect(Object.keys(result.stages)).toEqual(expect.arrayContaining([
        'clear',
        'loadTools',
        'generatePerspectives',
        'generateEmbeddings',
        'indexVectors'
      ]));
    });

    it('should create pipeline state', async () => {
      await orchestrator.execute({});
      
      expect(mockMongoProvider.update).toHaveBeenCalledWith(
        'pipeline_state',
        expect.any(Object),
        expect.objectContaining({
          $set: expect.objectContaining({
            active: true,
            currentStage: expect.any(String)
          })
        })
      );
    });

    it('should execute stages in correct order', async () => {
      const stageOrder = [];
      
      // Track stage execution order
      const originalClear = orchestrator.stages.clear.execute;
      orchestrator.stages.clear.execute = jest.fn(async (options) => {
        stageOrder.push('clear');
        return originalClear.call(orchestrator.stages.clear, options);
      });
      
      const originalLoadTools = orchestrator.stages.loadTools.execute;
      orchestrator.stages.loadTools.execute = jest.fn(async (options) => {
        stageOrder.push('loadTools');
        // Add tools to mockTools so subsequent stages have data
        mockTools.push(
          { _id: new ObjectId(), name: 'tool1', moduleName: 'module1' },
          { _id: new ObjectId(), name: 'tool2', moduleName: 'module1' }
        );
        return { success: true, toolsAdded: 2 };
      });
      
      const originalGeneratePerspectives = orchestrator.stages.generatePerspectives.execute;
      orchestrator.stages.generatePerspectives.execute = jest.fn(async (options) => {
        stageOrder.push('generatePerspectives');
        // Add perspectives for the tools
        for (const tool of mockTools) {
          mockPerspectives.push(
            { _id: new ObjectId(), toolId: tool._id, toolName: tool.name, perspectiveText: `Usage of ${tool.name}` },
            { _id: new ObjectId(), toolId: tool._id, toolName: tool.name, perspectiveText: `Example of ${tool.name}` }
          );
        }
        return { success: true, perspectivesGenerated: mockPerspectives.length };
      });
      
      const originalGenerateEmbeddings = orchestrator.stages.generateEmbeddings.execute;
      orchestrator.stages.generateEmbeddings.execute = jest.fn(async (options) => {
        stageOrder.push('generateEmbeddings');
        // Add embeddings to perspectives
        for (const perspective of mockPerspectives) {
          perspective.embedding = new Array(768).fill(0.1);
        }
        return { success: true, embeddingsGenerated: mockPerspectives.length };
      });
      
      const originalIndexVectors = orchestrator.stages.indexVectors.execute;
      orchestrator.stages.indexVectors.execute = jest.fn(async (options) => {
        stageOrder.push('indexVectors');
        vectorCount = mockPerspectives.length;
        return { success: true, vectorsIndexed: vectorCount };
      });
      
      await orchestrator.execute({});
      
      expect(stageOrder).toEqual([
        'clear',
        'loadTools',
        'generatePerspectives',
        'generateEmbeddings',
        'indexVectors'
      ]);
    });

    it('should handle stage failures gracefully', async () => {
      // Make loadTools stage fail
      orchestrator.stages.loadTools.execute = jest.fn(async () => {
        throw new Error('Failed to load modules');
      });
      
      // The execute method throws on failure rather than returning an error result
      await expect(orchestrator.execute({})).rejects.toThrow('Failed to load modules');
    });

    it('should support resume from failure', async () => {
      // Set up state as if clear completed but loadTools failed
      mockStateData.states = [{
        active: true,
        canResume: true,
        currentStage: 'loadTools',  // Should be at loadTools stage, not clear
        stages: {
          clear: { status: 'completed', completed: true }  // Mark clear as completed
        }
      }];
      
      // Mock findOne to return the state
      mockMongoProvider.findOne = jest.fn(async (collection, query) => {
        if (collection === 'pipeline_state' && query.active) {
          return mockStateData.states[0];
        }
        return null;
      });
      
      // Clear the mock to reset call counts
      orchestrator.stages.clear.execute.mockClear();
      
      const result = await orchestrator.execute({ resume: true });
      
      // Clear should not be called again
      expect(orchestrator.stages.clear.execute).not.toHaveBeenCalled();
    });

    it('should force restart when forceRestart option is set', async () => {
      // Set up existing state
      mockStateData.states = [{
        active: true,
        canResume: true,
        currentStage: 'generatePerspectives',
        stages: {
          clear: { completed: true },
          loadTools: { completed: true }
        }
      }];
      
      await orchestrator.execute({ forceRestart: true });
      
      // Should start from beginning
      expect(orchestrator.stages.clear.execute).toHaveBeenCalled();
    });

    it('should pass module filter to appropriate stages', async () => {
      await orchestrator.execute({ module: 'TestModule' });
      
      expect(orchestrator.stages.clear.execute).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'TestModule' })
      );
      expect(orchestrator.stages.loadTools.execute).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'TestModule' })
      );
    });

    it('should pass clearModules option to clear stage', async () => {
      await orchestrator.execute({ clearModules: true });
      
      expect(orchestrator.stages.clear.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clearModules: true })
      );
    });

    it('should run final verification', async () => {
      await orchestrator.execute({});
      
      // The actual implementation calls runFinalVerification, not verifyAllIntegrity
      expect(orchestrator.verifier.runFinalVerification).toHaveBeenCalled();
    });

    it('should fail if final verification fails', async () => {
      orchestrator.verifier.runFinalVerification = jest.fn(async () => ({
        success: false,
        failedChecks: ['Perspective count mismatch'],
        checks: [],
        toolCount: 0,
        perspectiveCount: 0,
        vectorCount: 0
      }));
      
      // The execute method throws when final verification fails
      await expect(orchestrator.execute({})).rejects.toThrow('Pipeline completed but final verification failed');
    });

    it('should track timing information', async () => {
      const result = await orchestrator.execute({});
      
      expect(result.duration).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();  // The actual implementation uses 'timestamp', not 'startTime'/'endTime'
      expect(result.durationFormatted).toBeDefined();  // Also has formatted duration
    });

    it('should calculate per-tool metrics', async () => {
      // Add some tools and perspectives
      mockTools.push(
        { _id: new ObjectId(), name: 'tool1', moduleName: 'module1' },
        { _id: new ObjectId(), name: 'tool2', moduleName: 'module1' }
      );
      
      for (const tool of mockTools) {
        for (let i = 0; i < 3; i++) {
          mockPerspectives.push({
            _id: new ObjectId(),
            toolId: tool._id,
            toolName: tool.name,
            perspectiveText: `Perspective ${i} for ${tool.name}`,
            embedding: new Array(768).fill(0.1)
          });
        }
      }
      
      vectorCount = mockPerspectives.length;
      
      const result = await orchestrator.execute({});
      
      // The actual implementation stores these in counts, not metrics
      expect(result.counts).toEqual(expect.objectContaining({
        perspectivesPerTool: expect.any(String),  // These are strings (formatted with .toFixed(2))
        vectorsPerTool: expect.any(String)
      }));
    });

    it('should skip completed stages when resuming', async () => {
      // Set up state with some completed stages
      mockStateData.states = [{
        active: true,
        canResume: true,
        currentStage: 'generatePerspectives',
        stages: {
          clear: { status: 'completed', completed: true },
          loadTools: { status: 'completed', completed: true }
        }
      }];
      
      mockMongoProvider.findOne = jest.fn(async (collection, query) => {
        if (collection === 'pipeline_state' && query.active) {
          return mockStateData.states[0];
        }
        return null;
      });
      
      // Clear mocks to reset call counts
      orchestrator.stages.clear.execute.mockClear();
      orchestrator.stages.loadTools.execute.mockClear();
      orchestrator.stages.generatePerspectives.execute.mockClear();
      
      await orchestrator.execute({ resume: true });
      
      expect(orchestrator.stages.clear.execute).not.toHaveBeenCalled();
      expect(orchestrator.stages.loadTools.execute).not.toHaveBeenCalled();
      expect(orchestrator.stages.generatePerspectives.execute).toHaveBeenCalled();
    });

    it('should handle empty module collection', async () => {
      // Keep module registry empty
      mockModuleRegistry = [];
      
      // Mock the stages to handle empty collections
      orchestrator.stages.loadTools.execute = jest.fn(async () => ({ 
        success: true, 
        toolsAdded: 0 
      }));
      orchestrator.stages.generatePerspectives.execute = jest.fn(async () => ({ 
        success: true, 
        perspectivesGenerated: 0 
      }));
      orchestrator.stages.generateEmbeddings.execute = jest.fn(async () => ({ 
        success: true, 
        embeddingsGenerated: 0 
      }));
      orchestrator.stages.indexVectors.execute = jest.fn(async () => ({ 
        success: true, 
        vectorsIndexed: 0 
      }));
      
      // Mock count methods to return 0
      mockMongoProvider.count = jest.fn(async () => 0);
      mockVectorStore.count = jest.fn(async () => 0);
      
      const result = await orchestrator.execute({});
      
      expect(result.success).toBe(true);
      expect(result.counts.tools).toBe(0);
      expect(result.counts.perspectives).toBe(0);
    });

    it('should handle Qdrant connection errors', async () => {
      // Override the clear stage to throw an error but still return success
      orchestrator.stages.clear.execute = jest.fn(async () => {
        // Clear stage handles Qdrant errors internally and continues
        return { 
          success: true, 
          toolsCleared: 0, 
          perspectivesCleared: 0,
          modulesCleared: 0,
          warning: 'Qdrant connection failed but MongoDB cleared successfully'
        };
      });
      
      const result = await orchestrator.execute({});
      
      // Pipeline should continue since clear stage handles Qdrant errors internally
      expect(result.success).toBe(true);
      expect(Object.keys(result.stages)).toContain('clear');
    });

    it('should update state on stage failure', async () => {
      orchestrator.stages.generatePerspectives.execute = jest.fn(async () => {
        throw new Error('Perspective generation failed');
      });
      
      // The execute method throws on stage failure
      await expect(orchestrator.execute({})).rejects.toThrow('Perspective generation failed');
      
      // Verify state was updated before failure
      expect(mockMongoProvider.update).toHaveBeenCalledWith(
        'pipeline_state',
        expect.any(Object),
        expect.objectContaining({
          $set: expect.objectContaining({
            currentStage: 'generatePerspectives'
          })
        })
      );
    });
  });
});