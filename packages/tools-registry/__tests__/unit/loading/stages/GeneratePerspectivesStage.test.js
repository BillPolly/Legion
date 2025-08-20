/**
 * Unit tests for GeneratePerspectivesStage
 * Tests perspective generation logic using mocked dependencies
 */

import { jest } from '@jest/globals';
import { GeneratePerspectivesStage } from '../../../../src/loading/stages/GeneratePerspectivesStage.js';
import { ObjectId } from 'mongodb';

describe('GeneratePerspectivesStage', () => {
  let generatePerspectivesStage;
  let mockMongoProvider;
  let mockPerspectiveGenerator;
  let mockVerifier;
  let mockStateManager;
  let mockTools;
  let mockPerspectives;

  beforeAll(async () => {
    // Mock data stores
    mockTools = [];
    mockPerspectives = [];
    
    // Mock MongoDB provider - NO REAL CONNECTIONS
    mockMongoProvider = {
      find: jest.fn(async (collection, query, options = {}) => {
        if (collection === 'tools') {
          let results = [...mockTools];
          if (query.moduleName) {
            results = results.filter(t => t.moduleName === query.moduleName);
          }
          if (options.limit) {
            results = results.slice(0, options.limit);
          }
          return results;
        } else if (collection === 'perspective_types') {
          return []; // Return empty so fallback logic is used
        }
        return [];
      }),
      insertMany: jest.fn(async (collection, docs) => {
        if (collection === 'tool_perspectives') {
          mockPerspectives.push(...docs);
        }
        return { insertedCount: docs.length };
      }),
      count: jest.fn(async (collection, query) => {
        if (collection === 'tool_perspectives') {
          return mockPerspectives.length;
        }
        return 0;
      }),
      aggregate: jest.fn(async (collection, pipeline) => {
        return [];
      })
    };
    
    // Mock perspective generator
    mockPerspectiveGenerator = {
      generatePerspectives: jest.fn(async (tool) => {
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
            priority: 100
          },
          {
            perspectiveType: 'search',
            perspectiveText: `Find ${tool.name} when you need ${tool.description}`,
            priority: 90
          },
          {
            perspectiveType: 'context',
            perspectiveText: `${tool.name} is useful for ${tool.description}`,
            priority: 80
          }
        ];
      })
    };
    
    // Mock verifier
    mockVerifier = {
      verifyAllToolsHavePerspectives: jest.fn(async () => {
        // Check if all tools have perspectives
        const toolsWithoutPerspectives = [];
        for (const tool of mockTools) {
          const hasPerspectives = mockPerspectives.some(p => p.toolId.toString() === tool._id.toString());
          if (!hasPerspectives) {
            toolsWithoutPerspectives.push(tool.name);
          }
        }
        
        return {
          success: toolsWithoutPerspectives.length === 0,
          toolsWithoutPerspectives,
          message: toolsWithoutPerspectives.length === 0 ? 'All tools have perspectives' : `${toolsWithoutPerspectives.length} tools lack perspectives`
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
            generatePerspectives: {
              processed: []
            }
          }
        };
      })
    };
  });

  beforeEach(async () => {
    // Reset mock data and clear calls
    mockTools = [
      { _id: new ObjectId(), name: 'tool1', description: 'Test tool 1', moduleName: 'module1' },
      { _id: new ObjectId(), name: 'tool2', description: 'Test tool 2', moduleName: 'module1' },
      { _id: new ObjectId(), name: 'tool3', description: 'Test tool 3', moduleName: 'module2' }
    ];
    mockPerspectives = [];
    
    jest.clearAllMocks();
    
    generatePerspectivesStage = new GeneratePerspectivesStage({
      perspectiveGenerator: mockPerspectiveGenerator,
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
    it('should generate perspectives for all tools', async () => {
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsProcessed).toBe(3);
      expect(result.perspectivesGenerated).toBe(9); // 3 tools × 3 perspectives each
      expect(result.message).toContain('Generated 9 perspectives');
      
      // Verify perspectives were saved to mock array
      expect(mockPerspectives).toHaveLength(9);
      
      // Verify each tool has perspectives
      for (const tool of mockTools) {
        const toolPerspectives = mockPerspectives.filter(p => p.toolId.toString() === tool._id.toString());
        expect(toolPerspectives).toHaveLength(3);
      }
    });

    it('should filter by module name', async () => {
      // Update mock verifier to check only module1 tools
      mockVerifier.verifyAllToolsHavePerspectives = jest.fn(async () => {
        const module1Tools = mockTools.filter(t => t.moduleName === 'module1');
        const toolsWithPerspectives = module1Tools.filter(tool => 
          mockPerspectives.some(p => p.toolId.toString() === tool._id.toString())
        );
        
        if (toolsWithPerspectives.length === module1Tools.length) {
          return { success: true, message: 'All tools have perspectives' };
        }
        
        const missingCount = module1Tools.length - toolsWithPerspectives.length;
        return {
          success: false,
          message: `${missingCount} tools lack perspectives`
        };
      });
      
      const result = await generatePerspectivesStage.execute({ module: 'module1' });
      
      expect(result.success).toBe(true);
      expect(result.toolsProcessed).toBe(2);
      expect(result.perspectivesGenerated).toBe(6);
      
      // Verify only module1 tools had perspectives generated
      expect(mockPerspectives).toHaveLength(6);
      mockPerspectives.forEach(p => {
        expect(['tool1', 'tool2']).toContain(p.toolName);
      });
    });

    it('should handle tools that generate no perspectives', async () => {
      // Add empty-tool to mock data
      mockTools.push({
        _id: new ObjectId(),
        name: 'empty-tool',
        description: 'Tool with no perspectives'
      });
      
      // Update mock verifier to handle tools with no perspectives
      mockVerifier.verifyAllToolsHavePerspectives = jest.fn(async () => {
        // Count tools that have perspectives
        const toolsWithPerspectives = mockTools.filter(tool => 
          mockPerspectives.some(p => p.toolId.toString() === tool._id.toString())
        );
        
        // We expect at least 3 tools with perspectives
        if (toolsWithPerspectives.length >= 3) {
          return { success: true, message: 'Tools have perspectives' };
        }
        
        return {
          success: false,
          message: `${4 - toolsWithPerspectives.length} tools lack perspectives`
        };
      });
      
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsProcessed).toBe(3); // Only tools with perspectives count as processed
      expect(result.perspectivesGenerated).toBe(9); // Only from the 3 normal tools
      
      // Verify the empty-tool had no perspectives generated
      const emptyToolPerspectives = mockPerspectives.filter(p => p.toolName === 'empty-tool');
      expect(emptyToolPerspectives).toHaveLength(0);
    });

    it('should continue on perspective generation failures', async () => {
      // Add failing-tool to mock data
      mockTools.push({
        _id: new ObjectId(),
        name: 'failing-tool',
        description: 'Tool that fails'
      });
      
      // Update mock verifier to handle tools with failures
      mockVerifier.verifyAllToolsHavePerspectives = jest.fn(async () => {
        const toolsWithPerspectives = mockTools.filter(tool => 
          mockPerspectives.some(p => p.toolId.toString() === tool._id.toString())
        );
        
        // We expect at least 3 tools with perspectives
        if (toolsWithPerspectives.length >= 3) {
          return { success: true, message: 'Tools have perspectives' };
        }
        
        return {
          success: false,
          message: `${4 - toolsWithPerspectives.length} tools lack perspectives`
        };
      });
      
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsProcessed).toBe(3); // Other tools should still process
      expect(result.perspectivesGenerated).toBe(9); // Only from successful tools
      
      // Verify the failing-tool had no perspectives generated
      const failingToolPerspectives = mockPerspectives.filter(p => p.toolName === 'failing-tool');
      expect(failingToolPerspectives).toHaveLength(0);
    });

    it('should save perspectives with proper structure', async () => {
      await generatePerspectivesStage.execute({});
      
      expect(mockPerspectives).toHaveLength(9);
      const perspective = mockPerspectives[0];
      
      expect(perspective).toHaveProperty('toolId');
      expect(perspective).toHaveProperty('toolName');
      expect(perspective).toHaveProperty('perspectiveType');
      expect(perspective).toHaveProperty('perspectiveText');
      expect(perspective).toHaveProperty('priority');
      expect(perspective).toHaveProperty('embedding');
      expect(perspective).toHaveProperty('embeddingModel');
      expect(perspective).toHaveProperty('generatedAt');
      expect(perspective).toHaveProperty('metadata');
      expect(perspective.embedding).toBeNull();
      expect(perspective.embeddingModel).toBeNull();
    });

    it('should batch insert perspectives', async () => {
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.perspectivesGenerated).toBe(9);
      
      // Verify insertMany was called (batch insertion)
      expect(mockMongoProvider.insertMany).toHaveBeenCalledTimes(3); // Once per tool
      expect(mockMongoProvider.insertMany).toHaveBeenCalledWith('tool_perspectives', expect.any(Array));
    });

    it('should track processed tools in state', async () => {
      const recordedCheckpoints = [];
      const customStateManager = {
        recordCheckpoint: async (stage, data) => {
          recordedCheckpoints.push(data);
          return { success: true };
        },
        getCurrentState: async () => ({
          stages: { generatePerspectives: { processed: [] } }
        })
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator: mockPerspectiveGenerator,
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
        stateManager: customStateManager
      });
      
      await stage.execute({});
      
      expect(recordedCheckpoints.length).toBeGreaterThan(0);
      expect(recordedCheckpoints[0].processed).toBeDefined();
    });

    it('should resume from previous state', async () => {
      const firstToolId = mockTools[0]._id.toString();
      
      // Update mock verifier for this test
      mockVerifier.verifyAllToolsHavePerspectives = jest.fn(async () => {
        // Count tools that have perspectives
        const toolsWithPerspectives = mockTools.filter(tool => 
          mockPerspectives.some(p => p.toolId.toString() === tool._id.toString())
        );
        
        // We expect at least 2 tools with perspectives (since first was skipped)
        if (toolsWithPerspectives.length >= 2) {
          return { success: true, message: 'Tools have perspectives' };
        }
        
        return {
          success: false,
          message: `${3 - toolsWithPerspectives.length} tools lack perspectives`
        };
      });
      
      // Simulate previous run that processed first tool
      const customStateManager = {
        recordCheckpoint: async () => ({ success: true }),
        getCurrentState: async () => ({
          stages: {
            generatePerspectives: {
              processed: [firstToolId]
            }
          }
        })
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator: mockPerspectiveGenerator,
        mongoProvider: mockMongoProvider,
        verifier: mockVerifier,
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
      expect(result.message).toContain('Generated 9 perspectives');
      expect(result.perspectiveCount).toBe(9);
      
      // Verify the mock verifier was called
      expect(mockVerifier.verifyAllToolsHavePerspectives).toHaveBeenCalled();
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
        perspectiveGenerator: mockPerspectiveGenerator,
        mongoProvider: mockMongoProvider,
        verifier: failingVerifier,
        stateManager: mockStateManager
      });
      
      await expect(stage.execute({})).rejects.toThrow('Perspective generation verification failed: Some tools lack perspectives');
    });

    it('should handle MongoDB errors', async () => {
      const failingProvider = {
        find: async () => {
          throw new Error('MongoDB connection lost');
        }
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator: mockPerspectiveGenerator,
        mongoProvider: failingProvider,
        verifier: mockVerifier,
        stateManager: mockStateManager
      });
      
      await expect(stage.execute({})).rejects.toThrow('MongoDB connection lost');
    });

    it('should handle empty tool collection', async () => {
      // Set empty tools array
      mockTools = [];
      
      // Update mock verifier for empty collection case
      mockVerifier.verifyAllToolsHavePerspectives = jest.fn(async () => {
        // For empty collections, verification should pass since there are no tools to check
        return { success: true, message: 'No tools to verify perspectives for' };
      });
      
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
      
      // Verify perspectives were generated and linked correctly via mock data
      expect(mockPerspectives).toHaveLength(9);
      
      // Check that each tool has perspectives linked to it
      for (const tool of mockTools) {
        const toolPerspectives = mockPerspectives.filter(p => p.toolId.toString() === tool._id.toString());
        
        expect(toolPerspectives).toHaveLength(3);
        toolPerspectives.forEach(p => {
          expect(p.toolName).toBe(tool.name);
          expect(p.toolId.toString()).toBe(tool._id.toString());
        });
      }
    });
  });

  describe('error recovery', () => {
    it('should continue processing after individual tool failures', async () => {
      // Add a failing tool to mock data
      mockTools.push({
        _id: new ObjectId(),
        name: 'failing-tool',
        description: 'Will fail'
      });
      
      const result = await generatePerspectivesStage.execute({});
      
      expect(result.success).toBe(true);
      expect(result.toolsProcessed).toBe(3); // Only successful tools count as processed
      expect(result.perspectivesGenerated).toBe(9); // Only from successful tools
      
      // Verify the failing tool had no perspectives generated
      const failingToolPerspectives = mockPerspectives.filter(p => p.toolName === 'failing-tool');
      expect(failingToolPerspectives).toHaveLength(0);
    });

    it('should handle partial batch insert failures gracefully', async () => {
      // Reset for this test
      mockPerspectives = [];
      
      const customProvider = {
        ...mockMongoProvider,
        insertMany: jest.fn(async (collection, docs) => {
          // Simulate partial success
          if (docs.length > 2) {
            const insertedCount = Math.floor(docs.length / 2);
            // Only add partial docs to mock array
            mockPerspectives.push(...docs.slice(0, insertedCount));
            return { insertedCount };
          }
          mockPerspectives.push(...docs);
          return { insertedCount: docs.length };
        }),
        count: jest.fn(async (collection, query) => {
          // Return actual count of perspectives saved (not expected)
          if (collection === 'tool_perspectives') {
            return mockPerspectives.length;
          }
          return 0;
        })
      };
      
      // Custom verifier that accepts any reasonable count for partial failures
      const flexibleVerifier = {
        verifyAllToolsHavePerspectives: jest.fn(async () => {
          // For partial failure testing, just check if some perspectives exist
          const hasAnyPerspectives = mockPerspectives.length > 0;
          return { 
            success: hasAnyPerspectives, 
            message: hasAnyPerspectives 
              ? `Found ${mockPerspectives.length} perspectives - partial success acceptable`
              : 'No perspectives found'
          };
        })
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator: mockPerspectiveGenerator,
        mongoProvider: customProvider,
        verifier: flexibleVerifier,
        stateManager: mockStateManager
      });
      
      // For partial failures, we expect the verification to fail due to count mismatch
      // but the test should handle this as expected behavior
      await expect(stage.execute({})).rejects.toThrow('Too few perspectives generated! Expected at least 9, got 3');
      
      // Verify that perspectives were generated and some were saved
      expect(mockPerspectives).toHaveLength(3); // Only 3 were actually saved due to partial failure
    });

    it('should handle perspective generator errors gracefully', async () => {
      const failingGenerator = {
        generatePerspectives: jest.fn(async () => {
          throw new Error('LLM service unavailable');
        })
      };
      
      // Update mock verifier to handle no perspectives
      const customVerifier = {
        ...mockVerifier,
        verifyAllToolsHavePerspectives: jest.fn(async () => {
          return {
            success: false,
            message: `3 tools lack perspectives`
          };
        })
      };
      
      const stage = new GeneratePerspectivesStage({
        perspectiveGenerator: failingGenerator,
        mongoProvider: mockMongoProvider,
        verifier: customVerifier,
        stateManager: mockStateManager
      });
      
      // When all tools fail, verification should throw
      await expect(stage.execute({})).rejects.toThrow('Perspective generation verification failed: 3 tools lack perspectives');
      
      // Verify no perspectives were added to mock array
      expect(mockPerspectives).toHaveLength(0);
    });
  });
});