/**
 * Unit tests for ClearStage
 * Tests database clearing logic using mocked dependencies
 */

import { jest } from '@jest/globals';
import { ClearStage } from '../../../../src/loading/stages/ClearStage.js';

describe('ClearStage', () => {
  let clearStage;
  let mockMongoProvider;
  let mockVectorStore;
  let mockVerifier;
  let mockClearResults;

  beforeEach(async () => {
    // Reset mock data and clear calls
    mockClearResults = {
      tools: 2,
      perspectives: 2,
      modules: 1,
      vectors: 5
    };

    jest.clearAllMocks();

    // Mock MongoDB provider - NO REAL CONNECTIONS
    // Mock structure must match implementation: mongoProvider.db.collection().deleteMany()
    mockMongoProvider = {
      db: {
        collection: jest.fn((collectionName) => ({
          deleteMany: jest.fn(async (query) => {
            let deletedCount = 0;
            switch (collectionName) {
              case 'tools':
                deletedCount = mockClearResults.tools;
                mockClearResults.tools = 0;
                break;
              case 'tool_perspectives':
                deletedCount = mockClearResults.perspectives;
                mockClearResults.perspectives = 0;
                break;
              case 'modules':
                deletedCount = mockClearResults.modules;
                mockClearResults.modules = 0;
                break;
              default:
                deletedCount = 0;
            }
            return { deletedCount };
          }),
          countDocuments: jest.fn(async (query) => {
            switch (collectionName) {
              case 'tools':
                return mockClearResults.tools;
              case 'tool_perspectives':
                return mockClearResults.perspectives;
              case 'modules':
                return mockClearResults.modules;
              default:
                return 0;
            }
          })
        }))
      }
    };

    // Mock vector store - NO REAL QDRANT
    mockVectorStore = {
      clearCollection: jest.fn(async (collectionName) => {
        const vectorsCleared = mockClearResults.vectors;
        mockClearResults.vectors = 0;
        return { success: true, message: `Cleared ${vectorsCleared} vectors from collection`, vectorsCleared };
      }),
      deleteCollection: jest.fn(async (collectionName) => {
        const vectorsCleared = mockClearResults.vectors;
        mockClearResults.vectors = 0;
        return { success: true, vectorsCleared };
      }),
      createCollection: jest.fn(async (collectionName, config) => {
        return { success: true };
      }),
      count: jest.fn(async (collectionName) => {
        return mockClearResults.vectors;
      }),
      getCollection: jest.fn(async (collectionName) => {
        return {
          config: {
            params: {
              vectors: {
                size: 768
              }
            }
          }
        };
      })
    };

    // Mock verifier
    mockVerifier = {
      verifyCleared: jest.fn(async () => {
        // Check if all collections are cleared (modules is always cleared by default)
        const allClear = mockClearResults.tools === 0 && 
                         mockClearResults.perspectives === 0 && 
                         mockClearResults.modules === 0 &&
                         mockClearResults.vectors === 0;
        
        return {
          success: allClear,
          message: allClear ? 'All collections cleared and ready' : 'Some collections not cleared',
          toolCount: mockClearResults.tools,
          perspectiveCount: mockClearResults.perspectives,
          moduleCount: mockClearResults.modules,
          vectorCount: mockClearResults.vectors
        };
      })
    };

    clearStage = new ClearStage({
      mongoProvider: mockMongoProvider,
      vectorStore: mockVectorStore,
      verifier: mockVerifier
    });
  });

  afterEach(async () => {
    // No cleanup needed for mocks
  });

  afterAll(async () => {
    // No cleanup needed for mocks
  });

  describe('execute', () => {
    it('should clear tools and perspectives by default', async () => {
      // Debug: Log the mock state before execution
      console.log('Mock state before:', JSON.stringify(mockClearResults));
      
      const result = await clearStage.execute({});
      
      // Debug: Log the mock state after execution
      console.log('Mock state after:', JSON.stringify(mockClearResults));
      console.log('Result:', JSON.stringify(result));
      
      expect(result.success).toBe(true);
      expect(result.toolCount).toBe(0);
      expect(result.perspectiveCount).toBe(0);
      expect(result.vectorCount).toBe(0);
      
      // Verify mock methods were called
      expect(mockMongoProvider.db.collection).toHaveBeenCalledWith('tools');
      expect(mockMongoProvider.db.collection).toHaveBeenCalledWith('tool_perspectives');
      expect(mockVectorStore.clearCollection).toHaveBeenCalledWith('legion_tools');
    });

    it('should clear modules when clearModules option is set', async () => {
      const result = await clearStage.execute({ clearModules: true });
      
      expect(result.success).toBe(true);
      expect(result.modulesCleared).toBe(1);
      
      // Verify modules were cleared
      expect(mockMongoProvider.db.collection).toHaveBeenCalledWith('modules');
    });

    it('should clear modules by default (runtime state always cleared)', async () => {
      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.modulesCleared).toBe(1);
      
      // Verify modules were cleared (runtime state always cleared in clearAll)
      expect(mockMongoProvider.db.collection).toHaveBeenCalledWith('modules');
    });

    it('should clear base collections and modules (runtime state always cleared)', async () => {
      const result = await clearStage.execute({ someOption: 'ignored' });
      
      expect(result.success).toBe(true);
      expect(result.toolCount).toBe(0);
      expect(result.perspectiveCount).toBe(0);
      expect(result.modulesCleared).toBe(1);
      
      // Verify all collections were cleared (modules runtime state always cleared)
      expect(mockMongoProvider.db.collection).toHaveBeenCalledWith('tools');
      expect(mockMongoProvider.db.collection).toHaveBeenCalledWith('tool_perspectives');
      expect(mockMongoProvider.db.collection).toHaveBeenCalledWith('modules');
    });

    it('should handle clearing when collections are already empty', async () => {
      // Set up empty collections
      mockClearResults = {
        tools: 0,
        perspectives: 0,
        modules: 0,
        vectors: 0
      };

      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolCount).toBe(0);
      expect(result.perspectiveCount).toBe(0);
    });

    it('should fail if verification fails', async () => {
      // Mock verification failure
      const failingVerifier = {
        verifyCleared: jest.fn(async () => ({
          success: false,
          message: 'Tools still exist',
          toolCount: 1,
          perspectiveCount: 0,
          vectorCount: 0
        }))
      };

      const failingStage = new ClearStage({
        mongoProvider: mockMongoProvider,
        vectorStore: mockVectorStore,
        verifier: failingVerifier
      });

      await expect(failingStage.execute({})).rejects.toThrow('Clear verification failed: Tools still exist');
    });

    it('should handle MongoDB errors', async () => {
      const failingProvider = {
        db: {
          collection: jest.fn(() => ({
            deleteMany: jest.fn(async () => {
              throw new Error('MongoDB connection lost');
            })
          }))
        }
      };

      const failingStage = new ClearStage({
        mongoProvider: failingProvider,
        vectorStore: mockVectorStore,
        verifier: mockVerifier
      });

      await expect(failingStage.execute({})).rejects.toThrow('MongoDB connection lost');
    });

    it('should handle vector store errors', async () => {
      const failingVectorStore = {
        clearCollection: jest.fn(async () => {
          throw new Error('Qdrant unavailable');
        }),
        deleteCollection: jest.fn(async () => {
          throw new Error('Qdrant unavailable');
        })
      };

      // Custom verifier that doesn't check vectors when vector store fails
      const customVerifier = {
        verifyCleared: jest.fn(async () => {
          // MongoDB collections are cleared, but vectors aren't (due to error)
          // The implementation catches vector store errors, so it should succeed
          return {
            success: true,
            message: 'MongoDB collections cleared (vector store error ignored)',
            toolCount: 0,
            perspectiveCount: 0,
            moduleCount: 0,
            vectorCount: 5 // Vectors not cleared due to error
          };
        })
      };

      const failingStage = new ClearStage({
        mongoProvider: mockMongoProvider,
        vectorStore: failingVectorStore,
        verifier: customVerifier
      });

      // The implementation catches vector store errors and continues
      // So it should not throw, but should still succeed
      const result = await failingStage.execute({});
      expect(result.success).toBe(true);
      expect(failingVectorStore.clearCollection).toHaveBeenCalled();
    });

    it('should return verification result', async () => {
      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('All collections cleared and ready');
      expect(result.toolCount).toBe(0);
      expect(result.perspectiveCount).toBe(0);
      expect(result.vectorCount).toBe(0);
    });

    it('should include modulesCleared when modules are cleared', async () => {
      const result = await clearStage.execute({ clearModules: true });
      
      expect(result).toMatchObject({
        success: true,
        message: 'All collections cleared and ready',
        toolCount: 0,
        perspectiveCount: 0,
        vectorCount: 0,
        modulesCleared: 1
      });
    });

    it('should use fixed collection name', async () => {
      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(mockVectorStore.clearCollection).toHaveBeenCalledWith('legion_tools');
    });

    it('should complete clearing operations', async () => {
      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('All collections cleared and ready');
      expect(result.toolCount).toBe(0);
      expect(result.perspectiveCount).toBe(0);
      expect(result.vectorCount).toBe(0);
    });

    it('should track operations with verbose logging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await clearStage.execute({ verbose: true });
      
      expect(result.success).toBe(true);
      // Verification is implementation-specific, just ensure no crashes
      
      consoleSpy.mockRestore();
    });
  });

  describe('verification', () => {
    it('should verify all collections are empty after clear', async () => {
      const result = await clearStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('All collections cleared and ready');
      expect(result.toolCount).toBe(0);
      expect(result.perspectiveCount).toBe(0);
      expect(result.vectorCount).toBe(0);
    });

    it('should detect incomplete clear', async () => {
      const customVerifier = {
        verifyCleared: jest.fn(async () => ({
          success: false,
          message: 'Clear incomplete: tools=1',
          toolCount: 1,
          perspectiveCount: 0,
          vectorCount: 0
        }))
      };

      const stage = new ClearStage({
        mongoProvider: mockMongoProvider,
        vectorStore: mockVectorStore,
        verifier: customVerifier
      });

      await expect(stage.execute({})).rejects.toThrow('Clear verification failed: Clear incomplete: tools=1');
    });

    it('should handle verifier errors gracefully', async () => {
      const failingVerifier = {
        verifyCleared: jest.fn(async () => {
          throw new Error('Verifier failed');
        })
      };

      const stage = new ClearStage({
        mongoProvider: mockMongoProvider,
        vectorStore: mockVectorStore,
        verifier: failingVerifier
      });

      await expect(stage.execute({})).rejects.toThrow('Verifier failed');
    });
  });

  describe('edge cases', () => {
    it('should handle missing clearCollection method on vector store', async () => {
      const limitedVectorStore = {
        deleteCollection: jest.fn(async () => ({ success: true })),
        count: jest.fn(async () => 0),
        getCollection: jest.fn(async () => null)
        // No clearCollection method - implementation will catch error and continue
      };

      // Custom verifier that succeeds even though vectors weren't cleared  
      const customVerifier = {
        verifyCleared: jest.fn(async () => ({
          success: true,
          message: 'MongoDB collections cleared (vector store method missing)',
          toolCount: 0,
          perspectiveCount: 0,
          moduleCount: 0,
          vectorCount: 5
        }))
      };

      const stage = new ClearStage({
        mongoProvider: mockMongoProvider,
        vectorStore: limitedVectorStore,
        verifier: customVerifier
      });

      // The implementation catches the error and continues
      const result = await stage.execute({});
      expect(result.success).toBe(true);
    });

    it('should require vector store dependency', async () => {
      const stage = new ClearStage({
        mongoProvider: mockMongoProvider,
        vectorStore: null,
        verifier: mockVerifier
      });

      // Should crash when trying to use null vectorStore
      await expect(stage.execute({})).rejects.toThrow();
    });

    it('should require verifier dependency', async () => {
      const stage = new ClearStage({
        mongoProvider: mockMongoProvider,
        vectorStore: mockVectorStore,
        verifier: null
      });

      // Should crash when trying to use null verifier
      await expect(stage.execute({})).rejects.toThrow();
    });
  });
});