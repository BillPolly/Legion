/**
 * Unit tests for PipelineVerifier
 * Tests verification logic using mocked dependencies
 */

import { jest } from '@jest/globals';
import { PipelineVerifier } from '../../../src/loading/PipelineVerifier.js';
import { ObjectId } from 'mongodb';

describe('PipelineVerifier', () => {
  let verifier;
  let mockMongoProvider;
  let mockVectorStore;
  let mockDataState;

  beforeAll(async () => {
    // Empty - all setup moved to beforeEach to avoid closure issues
  });

  beforeEach(async () => {
    // Reset mock data and clear calls
    mockDataState = {
      tools: [],
      perspectives: [],
      vectors: 0,
      collectionExists: true,
      collectionDimension: 768
    };

    jest.clearAllMocks();

    // Mock MongoDB provider - NO REAL CONNECTIONS
    // Moved here to avoid closure issues with mockDataState
    mockMongoProvider = {
      count: jest.fn(async (collection, query) => {
        if (collection === 'tools') {
          if (!query || Object.keys(query).length === 0) {
            return mockDataState.tools.length;
          }
          return mockDataState.tools.filter(tool => {
            // Handle various query patterns
            if (query.name) {
              return tool.name === query.name;
            }
            return true;
          }).length;
        }
        if (collection === 'tool_perspectives') {
          if (!query || Object.keys(query).length === 0) {
            return mockDataState.perspectives.length;
          }
          if (query.$or) {
            // Count perspectives without embeddings
            return mockDataState.perspectives.filter(p => 
              !p.embedding || p.embedding === null || p.embedding.length === 0
            ).length;
          }
          if (query.embedding) {
            if (query.embedding.$exists && query.embedding.$ne) {
              return mockDataState.perspectives.filter(p => p.embedding && p.embedding !== null).length;
            }
          }
          return mockDataState.perspectives.length;
        }
        return 0;
      }),
      findOne: jest.fn(async (collection, query) => {
        if (collection === 'tool_perspectives') {
          return mockDataState.perspectives.find(p => {
            if (query.embedding && query.embedding.$exists && query.embedding.$ne) {
              return p.embedding && p.embedding !== null;
            }
            return true;
          }) || null;
        }
        return null;
      }),
      aggregate: jest.fn(async (collection, pipeline) => {
        if (collection === 'tools') {
          // Simulate tools without perspectives aggregation
          const toolsWithoutPerspectives = mockDataState.tools.filter(tool => {
            const hasPersp = mockDataState.perspectives.some(p => p.toolId?.toString() === tool._id?.toString());
            return !hasPersp;
          });
          
          // Handle $sample stage
          if (pipeline.some(stage => stage.$sample)) {
            const sampleSize = pipeline.find(stage => stage.$sample)?.$sample?.size || 3;
            return mockDataState.perspectives.slice(0, Math.min(sampleSize, mockDataState.perspectives.length));
          }
          
          return toolsWithoutPerspectives;
        }
        if (collection === 'tool_perspectives') {
          // Handle $sample stage for perspective verification
          if (pipeline.some(stage => stage.$sample)) {
            const sampleSize = pipeline.find(stage => stage.$sample)?.$sample?.size || 3;
            return mockDataState.perspectives.slice(0, Math.min(sampleSize, mockDataState.perspectives.length));
          }
        }
        return [];
      })
    };

    // Mock vector store - NO REAL QDRANT
    mockVectorStore = {
      count: jest.fn(async (collectionName) => {
        return mockDataState.vectors;
      }),
      getCollection: jest.fn(async (collectionName) => {
        if (!mockDataState.collectionExists) {
          throw new Error('Collection not found');
        }
        return {
          config: {
            params: {
              vectors: {
                size: mockDataState.collectionDimension
              }
            }
          }
        };
      }),
      retrieve: jest.fn(async (collectionName, options) => {
        const { ids } = options;
        return ids.map(id => ({
          id,
          payload: {
            toolName: `tool-${id.slice(-3)}`
          },
          vector: new Array(768).fill(0.1)
        }));
      })
    };
    
    verifier = new PipelineVerifier(mockMongoProvider, mockVectorStore);
  });

  afterAll(async () => {
    // No cleanup needed for mocks
  });

  describe('verifyCleared', () => {
    it('should verify all collections are empty', async () => {
      const result = await verifier.verifyCleared();
      
      expect(result.success).toBe(true);
      expect(result.toolCount).toBe(0);
      expect(result.perspectiveCount).toBe(0);
      expect(result.vectorCount).toBe(0);
    });

    it('should fail if tools exist', async () => {
      mockDataState.tools = [{ _id: new ObjectId(), name: 'test-tool' }];
      
      const result = await verifier.verifyCleared();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Collections not fully cleared');
    });

    it('should fail if perspectives exist', async () => {
      mockDataState.perspectives = [{ 
        _id: new ObjectId(),
        toolName: 'test',
        perspectiveText: 'test perspective'
      }];
      
      const result = await verifier.verifyCleared();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Collections not fully cleared');
    });
  });

  describe('verifyToolCount', () => {
    it('should verify exact tool count', async () => {
      mockDataState.tools = [
        { _id: new ObjectId(), name: 'tool1', description: 'Test tool 1' },
        { _id: new ObjectId(), name: 'tool2', description: 'Test tool 2' },
        { _id: new ObjectId(), name: 'tool3', description: 'Test tool 3' }
      ];
      
      const result = await verifier.verifyToolCount(3);
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
    });

    it('should fail on count mismatch', async () => {
      mockDataState.tools = [{ _id: new ObjectId(), name: 'tool1' }];
      
      const result = await verifier.verifyToolCount(5);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Tool count mismatch');
      expect(result.expectedCount).toBe(5);
      expect(result.actualCount).toBe(1);
    });
  });

  describe('verifyAllToolsHavePerspectives', () => {
    beforeEach(async () => {
      // Set up test tools
      mockDataState.tools = [
        { _id: new ObjectId(), name: 'tool1' },
        { _id: new ObjectId(), name: 'tool2' }
      ];
    });

    it('should verify all tools have perspectives', async () => {
      // Add perspectives for all tools
      mockDataState.perspectives = mockDataState.tools.map(tool => ({
        _id: new ObjectId(),
        toolId: tool._id,
        toolName: tool.name,
        perspectiveText: `${tool.name} perspective`
      }));
      
      const result = await verifier.verifyAllToolsHavePerspectives();
      expect(result.success).toBe(true);
    });

    it('should detect tools without perspectives', async () => {
      // Only add perspective for first tool
      mockDataState.perspectives = [{
        _id: new ObjectId(),
        toolId: mockDataState.tools[0]._id,
        toolName: mockDataState.tools[0].name,
        perspectiveText: 'perspective'
      }];
      
      const result = await verifier.verifyAllToolsHavePerspectives();
      expect(result.success).toBe(false);
      expect(result.count).toBe(1);
      expect(result.examples).toContain('tool2');
    });
  });

  describe('verifyAllPerspectivesHaveEmbeddings', () => {
    it('should verify all perspectives have embeddings', async () => {
      const embedding = new Array(768).fill(0.1);
      
      mockDataState.perspectives = [
        { _id: new ObjectId(), toolName: 'tool1', perspectiveText: 'text1', embedding: embedding },
        { _id: new ObjectId(), toolName: 'tool2', perspectiveText: 'text2', embedding: embedding }
      ];
      
      const result = await verifier.verifyAllPerspectivesHaveEmbeddings();
      expect(result.success).toBe(true);
    });

    it('should detect perspectives without embeddings', async () => {
      const embedding = new Array(768).fill(0.1);
      
      mockDataState.perspectives = [
        { _id: new ObjectId(), toolName: 'tool1', perspectiveText: 'text1', embedding: embedding },
        { _id: new ObjectId(), toolName: 'tool2', perspectiveText: 'text2', embedding: null },
        { _id: new ObjectId(), toolName: 'tool3', perspectiveText: 'text3' }
      ];
      
      const result = await verifier.verifyAllPerspectivesHaveEmbeddings();
      expect(result.success).toBe(false);
      expect(result.count).toBe(2);
    });
  });

  describe('verifyEmbeddingDimensions', () => {
    it('should verify correct embedding dimensions', async () => {
      const correctEmbedding = new Array(768).fill(0.1);
      
      mockDataState.perspectives = [
        { _id: new ObjectId(), toolName: 'tool1', embedding: correctEmbedding },
        { _id: new ObjectId(), toolName: 'tool2', embedding: correctEmbedding }
      ];
      
      const result = await verifier.verifyEmbeddingDimensions(768);
      expect(result.success).toBe(true);
    });

    it('should detect wrong embedding dimensions', async () => {
      const wrongEmbedding = new Array(512).fill(0.1);
      
      // Only add the wrong embedding - findOne will return the first one it finds
      mockDataState.perspectives = [
        { _id: new ObjectId(), toolName: 'tool2', embedding: wrongEmbedding }
      ];
      
      const result = await verifier.verifyEmbeddingDimensions(768);
      expect(result.success).toBe(false);
      expect(result.expectedDimension).toBe(768);
      expect(result.actualDimension).toBe(512);
    });
  });

  describe('verifyPerspectiveVectorSync', () => {
    it('should verify 1:1 perspective to vector ratio', async () => {
      const embedding = new Array(768).fill(0.1);
      mockDataState.perspectives = [
        { _id: new ObjectId(), embedding: embedding },
        { _id: new ObjectId(), embedding: embedding }
      ];
      mockDataState.vectors = 2;
      
      const result = await verifier.verifyPerspectiveVectorSync();
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });
    
    it('should fail when counts mismatch', async () => {
      const embedding = new Array(768).fill(0.1);
      mockDataState.perspectives = [
        { _id: new ObjectId(), embedding: embedding },
        { _id: new ObjectId(), embedding: embedding }
      ];
      mockDataState.vectors = 1;
      
      const result = await verifier.verifyPerspectiveVectorSync();
      
      expect(result.success).toBe(false);
      expect(result.perspectiveCount).toBe(2);
      expect(result.vectorCount).toBe(1);
    });
  });

  describe('verifySampleVectorMatch', () => {
    it('should handle no perspectives gracefully', async () => {
      const result = await verifier.verifySampleVectorMatch();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('No perspectives to sample verify');
    });

    it('should verify vector samples match MongoDB data', async () => {
      const perspectiveId = new ObjectId();
      const embedding = new Array(768).fill(0.1);
      
      mockDataState.perspectives = [{
        _id: perspectiveId,
        toolName: 'test-tool',
        perspectiveText: 'test',
        embedding: embedding
      }];
      
      // Mock retrieve to return matching payload
      mockVectorStore.retrieve.mockImplementationOnce(async (collectionName, options) => {
        return options.ids.map(id => ({
          id,
          payload: {
            toolName: 'test-tool' // Match the perspective toolName
          },
          vector: embedding
        }));
      });
      
      const result = await verifier.verifySampleVectorMatch();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Sample verification passed');
    });
    
    it('should detect vector payload mismatch', async () => {
      const perspectiveId = new ObjectId();
      const embedding = new Array(768).fill(0.1);
      
      mockDataState.perspectives = [{
        _id: perspectiveId,
        toolName: 'test-tool',
        perspectiveText: 'test',
        embedding: embedding
      }];
      
      // Mock vector store to return mismatched payload
      mockVectorStore.retrieve.mockImplementationOnce(async (collectionName, options) => {
        return [{
          id: perspectiveId.toString(),
          payload: {
            toolName: 'different-tool' // Mismatch!
          },
          vector: embedding
        }];
      });
      
      const result = await verifier.verifySampleVectorMatch();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Vector payload mismatch');
    });
  });

  describe('runFinalVerification', () => {
    it('should run all verification checks', async () => {
      const embedding = new Array(768).fill(0.1);
      const toolId = new ObjectId();
      const perspectiveId = new ObjectId();
      
      mockDataState.tools = [{ _id: toolId, name: 'test-tool' }];
      mockDataState.perspectives = [{
        _id: perspectiveId,
        toolId: toolId,
        toolName: 'test-tool',
        embedding: embedding
      }];
      mockDataState.vectors = 1;
      
      // Mock retrieve to return matching payload for sample verification
      mockVectorStore.retrieve.mockImplementation(async (collectionName, options) => {
        return options.ids.map(id => ({
          id,
          payload: {
            toolName: 'test-tool' // Match the perspective toolName
          },
          vector: embedding
        }));
      });
      
      const result = await verifier.runFinalVerification();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.checks).toBeInstanceOf(Array);
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.toolCount).toBe(1);
      expect(result.perspectiveCount).toBe(1);
      expect(result.vectorCount).toBe(1);
    });

    it('should detect issues in final verification', async () => {
      // Add a tool without perspectives
      mockDataState.tools = [{ _id: new ObjectId(), name: 'orphan-tool' }];
      mockDataState.perspectives = []; // No perspectives
      
      const result = await verifier.runFinalVerification();
      
      expect(result.success).toBe(false);
      expect(result.failedChecks).toBeDefined();
      expect(result.failedChecks.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle MongoDB connection errors', async () => {
      const failingProvider = {
        count: async () => {
          throw new Error('Connection timeout');
        }
      };
      
      const failingVerifier = new PipelineVerifier(failingProvider, mockVectorStore);
      
      const result = await failingVerifier.verifyCleared();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection timeout');
    });

    it('should handle Qdrant connection errors', async () => {
      const failingVectorStore = {
        count: async () => {
          throw new Error('Qdrant unavailable');
        }
      };
      
      const failingVerifier = new PipelineVerifier(mockMongoProvider, failingVectorStore);
      
      const result = await failingVerifier.verifyCleared();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Qdrant unavailable');
    });
  });
});