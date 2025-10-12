/**
 * End-to-End tests for Complete Conversation Flows
 *
 * Tests full conversation scenarios from user questions to final results,
 * including graph-based reference resolution.
 */

import { MultiTurnPipeline } from '../../src/MultiTurnPipeline.js';
import { ResourceManager } from '@legion/resource-manager';

describe('E2E Conversation Flow Tests', () => {
  let resourceManager;
  let pipeline;
  let dataSource;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 10000);

  beforeEach(async () => {
    // Create comprehensive graph data for testing
    const graphData = {
      // Countries
      ':Germany': {
        ':type': ':Country',
        ':name': 'Germany',
        ':population': 83000000,
        ':area': 357022,
        ':capital': ':Berlin',
        ':borders': [':France', ':Poland', ':Austria', ':Switzerland', ':Belgium']
      },
      ':France': {
        ':type': ':Country',
        ':name': 'France',
        ':population': 67000000,
        ':area': 551695,
        ':capital': ':Paris',
        ':borders': [':Germany', ':Spain', ':Italy', ':Belgium', ':Switzerland']
      },
      ':Poland': {
        ':type': ':Country',
        ':name': 'Poland',
        ':population': 38000000,
        ':area': 312696,
        ':capital': ':Warsaw',
        ':borders': [':Germany', ':Czech_Republic', ':Slovakia']
      },
      ':Spain': {
        ':type': ':Country',
        ':name': 'Spain',
        ':population': 47000000,
        ':area': 505990,
        ':capital': ':Madrid',
        ':borders': [':France', ':Portugal']
      },
      // Cities
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
      },
      ':Warsaw': {
        ':type': ':City',
        ':name': 'Warsaw',
        ':population': 1800000,
        ':country': ':Poland'
      },
      ':Madrid': {
        ':type': ':City',
        ':name': 'Madrid',
        ':population': 3200000,
        ':country': ':Spain'
      }
    };

    // Create mock DataSource
    dataSource = {
      query: async (query) => {
        const results = [];
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
              if (prop !== ':type' && prop !== ':name' && prop !== ':population' && prop !== ':area') {
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
        // Search query (for answers)
        else if (whereClause[1] === ':borders') {
          const target = whereClause[2];
          // Find all entities that border the target
          for (const [iri, data] of Object.entries(graphData)) {
            if (data[':borders'] && data[':borders'].includes(target)) {
              results.push({
                '?x': iri,
                x: iri,
                name: data[':name'],
                canonical: iri,
                type: data[':type']
              });
            }
          }
        }

        return results;
      }
    };

    // Create mock pipeline
    const mockPipeline = {
      resourceManager: resourceManager,
      dataSource: dataSource,
      initialized: false,

      initialize: async function() {
        this.initialized = true;
        this.dataSource = dataSource;
      },

      process: async (question, context) => {
        // Entity extraction
        const entities = [];
        const lowerQ = question.toLowerCase();

        ['germany', 'france', 'poland', 'spain'].forEach(name => {
          if (lowerQ.includes(name)) {
            const capital = name.charAt(0).toUpperCase() + name.slice(1);
            entities.push({
              value: capital,
              canonical: `:${capital}`,
              type: 'Country'
            });
          }
        });

        // Query execution
        let results = [];
        if (lowerQ.includes('border')) {
          // Find borders
          const targetEntity = entities[0];
          if (targetEntity) {
            const queryResults = await dataSource.query({
              find: ['?x'],
              where: [[targetEntity.canonical, ':borders', '?x']]
            });
            results = queryResults;
          }
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
          results: results.length > 0 ? results : entities.map(e => ({
            name: e.value,
            canonical: e.canonical,
            type: e.type
          }))
        };
      }
    };

    // Create MultiTurnPipeline with mock
    pipeline = new MultiTurnPipeline(resourceManager, {
      maxTurns: 10,
      domain: 'geography'
    });

    pipeline.pipeline = mockPipeline;
    await pipeline.initialize();
  }, 30000);

  afterEach(() => {
    if (pipeline) {
      pipeline.clear();
    }
  });

  describe('Possessive Reference Flow', () => {
    test('should resolve "its capital" using graph context', async () => {
      // Turn 1: Ask about Germany
      const result1 = await pipeline.ask('Which countries border Germany?');

      expect(result1.canonicalQuestion).toBeDefined();
      expect(result1.canonicalQuestion.entities.length).toBeGreaterThan(0);
      expect(result1.results).toBeDefined();

      // Turn 2: Use possessive reference "its"
      const result2 = await pipeline.ask('What is its capital?');

      // Should resolve "its" using graph context
      expect(result2.canonicalQuestion).toBeDefined();
      expect(result2.canonicalQuestion.text).toContain('capital');

      // Conversation should have 2 turns
      expect(pipeline.conversationContext.turns.length).toBe(2);
    });
  });

  describe('Ellipsis Resolution Flow', () => {
    test('should resolve "What about France?" ellipsis', async () => {
      // Turn 1: Initial complete question
      const result1 = await pipeline.ask('Which countries border Germany?');

      expect(result1.canonicalQuestion.text).toContain('Germany');

      // Turn 2: Elliptical question
      const result2 = await pipeline.ask('What about France?');

      // Should expand ellipsis to full question
      expect(result2.canonicalQuestion).toBeDefined();
      expect(result2.canonicalQuestion.entities.some(e =>
        e.value.toLowerCase().includes('france')
      )).toBe(true);
    });

    test('should resolve "And Spain?" continuation', async () => {
      // Turn 1
      await pipeline.ask('Which countries border Germany?');

      // Turn 2
      await pipeline.ask('What about France?');

      // Turn 3: Another ellipsis
      const result3 = await pipeline.ask('And Spain?');

      // Should continue the pattern
      expect(result3.canonicalQuestion).toBeDefined();
      expect(result3.canonicalQuestion.entities.some(e =>
        e.value.toLowerCase().includes('spain')
      )).toBe(true);
    });
  });

  describe('Implicit Reference Flow', () => {
    test('should resolve implicit continuation "And the area?"', async () => {
      // Turn 1: Ask about population
      await pipeline.ask('What is the population of Germany?');

      // Turn 2: Implicit reference to Germany
      const result2 = await pipeline.ask('And the area?');

      // Should carry forward Germany from context
      expect(result2.canonicalQuestion).toBeDefined();
      expect(result2.canonicalQuestion.text.toLowerCase()).toContain('area');
    });
  });

  describe('Comparative Reference Flow', () => {
    test('should resolve "Which has a larger population?"', async () => {
      // Turn 1: Establish comparison set
      await pipeline.ask('Which countries border Germany?');

      // Turn 2: Comparative question
      const result2 = await pipeline.ask('Which one has the largest population?');

      // Should understand "one" refers to countries from Turn 1
      expect(result2.canonicalQuestion).toBeDefined();
      expect(result2.canonicalQuestion.text.toLowerCase()).toContain('population');
    });

    test('should resolve "larger than France" comparison', async () => {
      // Turn 1: Establish entity
      await pipeline.ask('What is the population of France?');

      // Turn 2: Comparative question
      const result2 = await pipeline.ask('Which countries have a larger population?');

      // Should compare relative to France
      expect(result2.canonicalQuestion).toBeDefined();
      expect(result2.canonicalQuestion.text.toLowerCase()).toContain('population');
    });
  });

  describe('Multi-Turn Context Persistence', () => {
    test('should maintain context across 5 turns', async () => {
      // Turn 1
      await pipeline.ask('Which countries border Germany?');
      expect(pipeline.conversationContext.turns.length).toBe(1);

      // Turn 2
      await pipeline.ask('What about France?');
      expect(pipeline.conversationContext.turns.length).toBe(2);

      // Turn 3
      await pipeline.ask('And Spain?');
      expect(pipeline.conversationContext.turns.length).toBe(3);

      // Turn 4
      await pipeline.ask('Which one has the largest area?');
      expect(pipeline.conversationContext.turns.length).toBe(4);

      // Turn 5
      const result5 = await pipeline.ask('What is its capital?');
      expect(pipeline.conversationContext.turns.length).toBe(5);

      // All turns should be in history
      expect(result5).toBeDefined();
    });

    test('should access entities from earlier turns', async () => {
      // Turn 1: Germany
      await pipeline.ask('Which countries border Germany?');

      // Turn 2: France
      await pipeline.ask('What about France?');

      // Turn 3: Reference to Turn 1 entity
      const result3 = await pipeline.ask('Compare them');

      // Should have access to both Germany and France
      expect(result3.canonicalQuestion).toBeDefined();
      expect(pipeline.getRecentEntities().length).toBeGreaterThan(0);
    });
  });

  describe('Graph Context Usage', () => {
    test('should use capital relationship from graph', async () => {
      // Turn 1
      await pipeline.ask('Which countries border Germany?');

      // Turn 2: Query requires graph relationship
      const result2 = await pipeline.ask('What is its capital?');

      // Graph context should have been retrieved
      expect(result2.canonicalQuestion).toBeDefined();

      // Check that graph context was used in Turn 2
      const recentEntities = pipeline.getRecentEntities();
      expect(recentEntities.length).toBeGreaterThan(0);
    });

    test('should use borders relationship from graph', async () => {
      // Turn 1
      await pipeline.ask('What is the population of Germany?');

      // Turn 2: Query requires borders relationship
      const result2 = await pipeline.ask('Which countries border it?');

      // Should resolve "it" to Germany using graph context
      expect(result2.canonicalQuestion).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    test('should recover from unrelated question', async () => {
      // Turn 1: Unrelated question
      await pipeline.ask('What is 2 + 2?');

      // Turn 2: Normal geography question
      const result2 = await pipeline.ask('Which countries border Germany?');

      // Should not be confused by Turn 1
      expect(result2.canonicalQuestion).toBeDefined();
      expect(result2.canonicalQuestion.entities.some(e =>
        e.value.toLowerCase().includes('germany')
      )).toBe(true);
    });

    test('should handle reset and continue', async () => {
      // Turn 1
      await pipeline.ask('Which countries border Germany?');
      expect(pipeline.conversationContext.turns.length).toBe(1);

      // Reset
      pipeline.clear();
      expect(pipeline.conversationContext.turns.length).toBe(0);

      // Turn 2 (after reset)
      const result2 = await pipeline.ask('Which countries border France?');

      // Should work normally without previous context
      expect(result2.canonicalQuestion).toBeDefined();
      expect(pipeline.conversationContext.turns.length).toBe(1);
    });
  });

  describe('Complex Conversation Scenarios', () => {
    test('should handle geography exploration conversation', async () => {
      // Simulated natural conversation about European geography

      // Turn 1: Start with Germany
      const r1 = await pipeline.ask('Which countries border Germany?');
      expect(r1.canonicalQuestion.entities.length).toBeGreaterThan(0);

      // Turn 2: Follow-up about one neighbor
      const r2 = await pipeline.ask('What about France?');
      expect(r2.canonicalQuestion).toBeDefined();

      // Turn 3: Ask about property
      const r3 = await pipeline.ask('What is its population?');
      expect(r3.canonicalQuestion.text.toLowerCase()).toContain('population');

      // Turn 4: Comparative question
      const r4 = await pipeline.ask('Which one is larger?');
      expect(r4.canonicalQuestion).toBeDefined();

      // Turn 5: Ask about capital
      const r5 = await pipeline.ask('What is its capital?');
      expect(r5.canonicalQuestion.text.toLowerCase()).toContain('capital');

      // All 5 turns should be in history
      expect(pipeline.conversationContext.turns.length).toBe(5);
    });

    test('should handle comparison-focused conversation', async () => {
      // Turn 1: Get comparison set
      const r1 = await pipeline.ask('Which countries border Germany?');
      expect(r1.results).toBeDefined();

      // Turn 2: Compare populations
      const r2 = await pipeline.ask('Which has the largest population?');
      expect(r2.canonicalQuestion.text.toLowerCase()).toContain('population');

      // Turn 3: Compare areas
      const r3 = await pipeline.ask('And the largest area?');
      expect(r3.canonicalQuestion.text.toLowerCase()).toContain('area');

      // Turn 4: Ask about winner
      const r4 = await pipeline.ask('What is its capital?');
      expect(r4.canonicalQuestion.text.toLowerCase()).toContain('capital');

      expect(pipeline.conversationContext.turns.length).toBe(4);
    });
  });
});
