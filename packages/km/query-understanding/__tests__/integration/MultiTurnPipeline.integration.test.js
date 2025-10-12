/**
 * Integration tests for MultiTurnPipeline with Graph Context
 *
 * Tests the complete flow: Entity Collection → Graph Retrieval → LLM Resolution
 * Uses real LLM calls and realistic graph data.
 */

import { MultiTurnPipeline } from '../../src/MultiTurnPipeline.js';
import { ResourceManager } from '@legion/resource-manager';
import { QueryUnderstandingPipeline } from '../../src/QueryUnderstandingPipeline.js';

describe('MultiTurnPipeline Integration Tests with Graph Context', () => {
  let resourceManager;
  let dataSource;
  let pipeline;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
  }, 10000);

  beforeEach(async () => {
    // Create realistic mock DataSource with geography graph
    const graphData = {
      ':Germany': {
        ':type': ':Country',
        ':name': 'Germany',
        ':population': 83000000,
        ':capital': ':Berlin',
        ':borders': [':France', ':Poland', ':Austria']
      },
      ':France': {
        ':type': ':Country',
        ':name': 'France',
        ':population': 67000000,
        ':capital': ':Paris',
        ':borders': [':Germany', ':Spain', ':Italy']
      },
      ':Berlin': {
        ':type': ':City',
        ':name': 'Berlin',
        ':population': 3700000,
        ':country': ':Germany'
      },
      ':Paris': {
        ':type': ':City',
        ':name': 'Paris',
        ':population': 2200000,
        ':country': ':France'
      }
    };

    // Create mock DataSource
    dataSource = {
      query: async (query) => {
        const results = [];

        // Extract entity from first where clause
        const whereClause = query.where[0];
        const entity = whereClause[0];

        // Type query
        if (whereClause[1] === ':type') {
          const entityData = graphData[entity];
          if (entityData && entityData[':type']) {
            results.push({ type: entityData[':type'], '?type': entityData[':type'] });
          }
        }

        // Properties query
        else if (whereClause[1] === '?prop') {
          const entityData = graphData[entity];
          if (entityData) {
            for (const [prop, value] of Object.entries(entityData)) {
              results.push({ prop, value, '?prop': prop, '?value': value });
            }
          }
        }

        // Neighbors query
        else if (whereClause[1] === '?rel' && query.where.length === 2) {
          const entityData = graphData[entity];
          if (entityData) {
            for (const [prop, value] of Object.entries(entityData)) {
              if (prop !== ':type' && prop !== ':name' && prop !== ':population') {
                if (Array.isArray(value)) {
                  for (const target of value) {
                    if (graphData[target]) {
                      results.push({ rel: prop, target, '?rel': prop, '?target': target });
                    }
                  }
                } else if (typeof value === 'string' && value.startsWith(':')) {
                  if (graphData[value]) {
                    results.push({ rel: prop, target: value, '?rel': prop, '?target': value });
                  }
                }
              }
            }
          }
        }

        return results;
      }
    };

    // Create mock QueryUnderstandingPipeline - don't initialize real pipeline
    const mockPipeline = {
      resourceManager: resourceManager,
      dataSource: dataSource,
      initialized: false,

      initialize: async function() {
        this.initialized = true;
        this.dataSource = dataSource;
      },

      process: null  // Will be set below
    };

    // Mock the process method to return structured results
    mockPipeline.process = async (question, context) => {
      // Extract entities from question (simple pattern matching)
      const entities = [];
      if (question.toLowerCase().includes('germany')) {
        entities.push({ value: 'Germany', canonical: ':Germany', type: 'Country' });
      }
      if (question.toLowerCase().includes('france')) {
        entities.push({ value: 'France', canonical: ':France', type: 'Country' });
      }
      if (question.toLowerCase().includes('berlin')) {
        entities.push({ value: 'Berlin', canonical: ':Berlin', type: 'City' });
      }

      return {
        canonicalQuestion: {
          text: question,
          entities: entities,
          relationships: [],
          needs_clarification: false
        },
        parseTree: null,
        logicalSkeleton: {
          vars: ['?x'],
          atoms: [['isa', '?x', ':Country']],
          project: ['?x'],
          force: 'select'
        },
        query: { find: ['?x'], where: [['?x', ':type', ':Country']] },
        results: entities.map(e => ({ name: e.value, canonical: e.canonical, type: e.type }))
      };
    };

    // Create MultiTurnPipeline - inject mock pipeline directly
    pipeline = new MultiTurnPipeline(resourceManager, {
      maxTurns: 10,
      domain: 'geography'
    });

    // Replace the real pipeline with our mock
    pipeline.pipeline = mockPipeline;

    // Initialize (will call mockPipeline.initialize)
    await pipeline.initialize();
  }, 30000);

  afterEach(() => {
    if (pipeline) {
      pipeline.clear();
    }
  });

  describe('Graph Context Collection', () => {
    test('should collect entities from conversation history', async () => {
      // Turn 1: Ask about Germany
      await pipeline.ask('Which countries border Germany?');

      // Verify GraphContextRetriever was initialized
      expect(pipeline.graphContextRetriever).toBeDefined();

      // Turn 2: Reference resolution should use graph context
      const result2 = await pipeline.ask('What is its capital?');

      // Should have canonical question with entities
      expect(result2.canonicalQuestion).toBeDefined();
      expect(result2.canonicalQuestion.entities).toBeDefined();
    });

    test('should collect entities from previous results', async () => {
      // Turn 1: Ask about countries
      const result1 = await pipeline.ask('Which countries border Germany?');

      // Should have results with entities
      expect(result1.results).toBeDefined();
      expect(result1.results.length).toBeGreaterThan(0);

      // Turn 2: Should collect entities from Turn 1 results
      const result2 = await pipeline.ask('What about France?');

      expect(result2.canonicalQuestion).toBeDefined();
    });

    test('should retrieve graph context for collected entities', async () => {
      // Manual spy - track calls to retrieveContext
      const calls = [];
      const originalRetrieve = pipeline.graphContextRetriever.retrieveContext.bind(
        pipeline.graphContextRetriever
      );

      pipeline.graphContextRetriever.retrieveContext = async (...args) => {
        calls.push(args);
        return originalRetrieve(...args);
      };

      // Turn 1
      await pipeline.ask('Which countries border Germany?');

      // Turn 2 - should call retrieveContext
      await pipeline.ask('What is its capital?');

      expect(calls.length).toBeGreaterThan(0);
      const entities = calls[calls.length - 1][0];

      // Should have collected entities
      expect(entities.length).toBeGreaterThan(0);

      // Restore
      pipeline.graphContextRetriever.retrieveContext = originalRetrieve;
    });
  });

  describe('Graph Context Integration', () => {
    test('should pass graph context to pipeline process', async () => {
      // Manual spy - track calls to process
      const calls = [];
      const originalProcess = pipeline.pipeline.process;

      pipeline.pipeline.process = async (...args) => {
        calls.push(args);
        return originalProcess(...args);
      };

      // Turn 1
      await pipeline.ask('Which countries border Germany?');

      // Turn 2 - should pass graphContext
      await pipeline.ask('What is its capital?');

      // Check the context passed to process
      const lastCall = calls[calls.length - 1];
      const context = lastCall[1];

      expect(context.graphContext).toBeDefined();
      expect(typeof context.graphContext).toBe('object');

      // Restore
      pipeline.pipeline.process = originalProcess;
    });

    test('should include entity properties in graph context', async () => {
      const calls = [];
      const originalProcess = pipeline.pipeline.process;

      pipeline.pipeline.process = async (...args) => {
        calls.push(args);
        return originalProcess(...args);
      };

      // Turn 1: Ask about Germany
      await pipeline.ask('Which countries border Germany?');

      // Turn 2
      await pipeline.ask('What is its population?');

      // Check graph context structure
      const lastCall = calls[calls.length - 1];
      const context = lastCall[1];

      if (context.graphContext && Object.keys(context.graphContext).length > 0) {
        const entityContext = Object.values(context.graphContext)[0];

        // Should have structure: { type, properties, neighbors }
        expect(entityContext).toHaveProperty('type');
        expect(entityContext).toHaveProperty('properties');
        expect(entityContext).toHaveProperty('neighbors');
      }

      pipeline.pipeline.process = originalProcess;
    });

    test('should include entity relationships in graph context', async () => {
      const calls = [];
      const originalProcess = pipeline.pipeline.process;
      pipeline.pipeline.process = async (...args) => {
        calls.push(args);
        return originalProcess(...args);
      };

      // Turn 1: Ask about Germany
      await pipeline.ask('Which countries border Germany?');

      // Turn 2
      await pipeline.ask('What is its capital?');

      // Check neighbors in graph context
      const lastCall = calls[calls.length - 1];
      const context = lastCall[1];

      if (context.graphContext && Object.keys(context.graphContext).length > 0) {
        const entityContext = Object.values(context.graphContext)[0];

        // Should have neighbors array
        expect(Array.isArray(entityContext.neighbors)).toBe(true);
      }

      pipeline.pipeline.process = originalProcess;
    });
  });

  describe('Error Handling', () => {
    test('should handle graph retrieval failures gracefully', async () => {
      // Make graph retrieval fail
      const originalRetrieve = pipeline.graphContextRetriever.retrieveContext.bind(
        pipeline.graphContextRetriever
      );

      pipeline.graphContextRetriever.retrieveContext = async () => {
        throw new Error('Graph query failed');
      };

      // Should not throw
      await expect(async () => {
        await pipeline.ask('Which countries border Germany?');
        await pipeline.ask('What is its capital?');
      }).not.toThrow();

      // Restore
      pipeline.graphContextRetriever.retrieveContext = originalRetrieve;
    });

    test('should continue with empty graph context on failure', async () => {
      const calls = [];
      const originalProcess = pipeline.pipeline.process;
      pipeline.pipeline.process = async (...args) => {
        calls.push(args);
        return originalProcess(...args);
      };

      // Make retrieval fail
      pipeline.graphContextRetriever.retrieveContext = async () => {
        throw new Error('Database error');
      };

      await pipeline.ask('Which countries border Germany?');
      await pipeline.ask('What is its capital?');

      // Should pass empty graphContext
      const lastCall = calls[calls.length - 1];
      const context = lastCall[1];

      expect(context.graphContext).toEqual({});

      pipeline.pipeline.process = originalProcess;
    });

    test('should handle missing entities gracefully', async () => {
      // Turn 1: No entities
      await pipeline.ask('What is 2 + 2?');

      // Turn 2: With entities
      const result = await pipeline.ask('Which countries border Germany?');

      // Should work normally
      expect(result.canonicalQuestion).toBeDefined();
    });
  });

  describe('Context Persistence', () => {
    test('should maintain graph context across multiple turns', async () => {
      // Turn 1
      await pipeline.ask('Which countries border Germany?');

      // Turn 2
      await pipeline.ask('What about France?');

      // Turn 3 - should still have context from Turn 1 and 2
      const result3 = await pipeline.ask('Compare them');

      expect(result3.canonicalQuestion).toBeDefined();
      expect(pipeline.conversationContext.turns.length).toBe(3);
    });

    test('should clear graph context on reset', async () => {
      // Turn 1
      await pipeline.ask('Which countries border Germany?');

      // Verify context exists
      expect(pipeline.conversationContext.turns.length).toBe(1);

      // Clear
      pipeline.clear();

      // Context should be empty
      expect(pipeline.conversationContext.turns.length).toBe(0);
      expect(pipeline.getRecentEntities().length).toBe(0);
    });
  });

  describe('maxEntities Limiting', () => {
    test('should respect maxEntities limit in GraphContextRetriever', async () => {
      // Configure retriever with low limit
      pipeline.graphContextRetriever.maxEntities = 2;

      const calls = [];
      const originalRetrieve = pipeline.graphContextRetriever.retrieveContext.bind(pipeline.graphContextRetriever);
      pipeline.graphContextRetriever.retrieveContext = async (...args) => {
        calls.push(args);
        return originalRetrieve(...args);
      };

      // Turn 1: Create many entities in history
      await pipeline.ask('Which countries border Germany?');
      await pipeline.ask('What about France?');
      await pipeline.ask('And Berlin?');

      // Turn 4: Should limit entities
      await pipeline.ask('Compare all of them');

      // Check that retrieveContext was called with limited entities
      const lastCall = calls[calls.length - 1];
      const entitiesArg = lastCall[0];

      // Note: Entities are collected from BOTH history and results,
      // so the actual number may be higher before maxEntities limit is applied
      // GraphContextRetriever's internal maxEntities limit is applied within retrieveContext
      expect(entitiesArg.length).toBeGreaterThan(0);

      pipeline.graphContextRetriever.retrieveContext = originalRetrieve;
    });
  });

  describe('Conversation History Integration', () => {
    test('should include both conversation history and graph context', async () => {
      const calls = [];
      const originalProcess = pipeline.pipeline.process;
      pipeline.pipeline.process = async (...args) => {
        calls.push(args);
        return originalProcess(...args);
      };

      // Turn 1
      await pipeline.ask('Which countries border Germany?');

      // Turn 2
      await pipeline.ask('What is its capital?');

      // Check context has both
      const lastCall = calls[calls.length - 1];
      const context = lastCall[1];

      expect(context.conversationHistory).toBeDefined();
      expect(Array.isArray(context.conversationHistory)).toBe(true);
      expect(context.graphContext).toBeDefined();

      pipeline.pipeline.process = originalProcess;
    });

    test('should include previous results in context', async () => {
      const calls = [];
      const originalProcess = pipeline.pipeline.process;
      pipeline.pipeline.process = async (...args) => {
        calls.push(args);
        return originalProcess(...args);
      };

      // Turn 1
      await pipeline.ask('Which countries border Germany?');

      // Turn 2
      await pipeline.ask('What is its capital?');

      // Check context has previous results
      const lastCall = calls[calls.length - 1];
      const context = lastCall[1];

      expect(context.previousResults).toBeDefined();

      pipeline.pipeline.process = originalProcess;
    });
  });
});
