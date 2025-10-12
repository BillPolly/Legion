/**
 * Integration tests for GraphContextRetriever with real DataSource
 *
 * Tests graph context retrieval with realistic graph data.
 */

import { GraphContextRetriever } from '../../src/context/GraphContextRetriever.js';

describe('GraphContextRetriever Integration Tests', () => {
  let dataSource;
  let retriever;

  beforeEach(() => {
    // Create a realistic mock DataSource with graph data
    const graphData = {
      // Countries
      ':Germany': {
        ':type': ':Country',
        ':name': 'Germany',
        ':population': 83000000,
        ':capital': ':Berlin',
        ':borders': [':France', ':Poland', ':Austria', ':Switzerland']
      },
      ':France': {
        ':type': ':Country',
        ':name': 'France',
        ':population': 67000000,
        ':capital': ':Paris',
        ':borders': [':Germany', ':Spain', ':Italy', ':Belgium']
      },
      ':Poland': {
        ':type': ':Country',
        ':name': 'Poland',
        ':population': 38000000,
        ':capital': ':Warsaw',
        ':borders': [':Germany', ':Czech_Republic']
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
      }
    };

    // Mock DataSource that queries the graph data
    dataSource = {
      query: async (query) => {
        const results = [];

        // Extract entity from where clause
        const whereClause = query.where[0];
        const entity = whereClause[0];

        // Type query: [entity, ':type', '?type']
        if (whereClause[1] === ':type' && whereClause[2] === '?type') {
          const entityData = graphData[entity];
          if (entityData && entityData[':type']) {
            results.push({ type: entityData[':type'], '?type': entityData[':type'] });
          }
          return results;
        }

        // Properties query: [entity, '?prop', '?value']
        if (whereClause[1] === '?prop' && whereClause[2] === '?value') {
          const entityData = graphData[entity];
          if (entityData) {
            for (const [prop, value] of Object.entries(entityData)) {
              results.push({ prop, value, '?prop': prop, '?value': value });
            }
          }
          return results;
        }

        // Neighbors query: [entity, '?rel', '?target'] with type constraint
        if (whereClause[1] === '?rel' && whereClause[2] === '?target' && query.where.length === 2) {
          const entityData = graphData[entity];
          if (entityData) {
            for (const [prop, value] of Object.entries(entityData)) {
              if (prop !== ':type' && prop !== ':name' && prop !== ':population') {
                if (Array.isArray(value)) {
                  // Multiple relationships (e.g., borders)
                  for (const target of value) {
                    if (graphData[target] && graphData[target][':type']) {
                      results.push({ rel: prop, target, '?rel': prop, '?target': target });
                    }
                  }
                } else if (typeof value === 'string' && value.startsWith(':')) {
                  // Single relationship (e.g., capital)
                  if (graphData[value] && graphData[value][':type']) {
                    results.push({ rel: prop, target: value, '?rel': prop, '?target': value });
                  }
                }
              }
            }
          }
          return results;
        }

        return results;
      }
    };

    retriever = new GraphContextRetriever(dataSource, {
      defaultRadius: 1,
      maxEntities: 10
    });
  });

  describe('Single Entity Retrieval', () => {
    test('should retrieve complete context for Germany', async () => {
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' }
      ];

      const context = await retriever.retrieveContext(entities);

      expect(context).toBeDefined();
      expect(context[':Germany']).toBeDefined();

      const germanyContext = context[':Germany'];
      expect(germanyContext.type).toBe(':Country');
      expect(germanyContext.properties[':name']).toBe('Germany');
      expect(germanyContext.properties[':population']).toBe(83000000);
      expect(germanyContext.neighbors.length).toBeGreaterThan(0);

      // Should have border relationships
      const borderingCountries = germanyContext.neighbors.filter(n => n.rel === ':borders');
      expect(borderingCountries.length).toBeGreaterThan(0);
      expect(borderingCountries.some(n => n.target === ':France')).toBe(true);
    });

    test('should retrieve context for city entity', async () => {
      const entities = [
        { value: 'Berlin', canonical: ':Berlin', type: 'City' }
      ];

      const context = await retriever.retrieveContext(entities);

      expect(context[':Berlin']).toBeDefined();

      const berlinContext = context[':Berlin'];
      expect(berlinContext.type).toBe(':City');
      expect(berlinContext.properties[':name']).toBe('Berlin');
      expect(berlinContext.properties[':population']).toBe(3700000);

      // Should have country relationship
      const countryRel = berlinContext.neighbors.find(n => n.rel === ':country');
      expect(countryRel).toBeDefined();
      expect(countryRel.target).toBe(':Germany');
    });
  });

  describe('Multiple Entity Retrieval', () => {
    test('should retrieve context for multiple countries', async () => {
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' },
        { value: 'France', canonical: ':France', type: 'Country' }
      ];

      const context = await retriever.retrieveContext(entities);

      expect(Object.keys(context).length).toBe(2);
      expect(context[':Germany']).toBeDefined();
      expect(context[':France']).toBeDefined();

      expect(context[':Germany'].type).toBe(':Country');
      expect(context[':France'].type).toBe(':Country');
    });

    test('should retrieve context for mixed entity types', async () => {
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' },
        { value: 'Berlin', canonical: ':Berlin', type: 'City' }
      ];

      const context = await retriever.retrieveContext(entities);

      expect(Object.keys(context).length).toBe(2);
      expect(context[':Germany'].type).toBe(':Country');
      expect(context[':Berlin'].type).toBe(':City');
    });
  });

  describe('Relationship Discovery', () => {
    test('should discover bidirectional border relationships', async () => {
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' }
      ];

      const context = await retriever.retrieveContext(entities);
      const germanyContext = context[':Germany'];

      const borderRelations = germanyContext.neighbors.filter(n => n.rel === ':borders');

      // Should have multiple borders (at least 2)
      expect(borderRelations.length).toBeGreaterThanOrEqual(2);

      // Should include known neighbors
      const targets = borderRelations.map(r => r.target);
      expect(targets).toContain(':France');
      expect(targets).toContain(':Poland');
    });

    test('should discover capital relationships', async () => {
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' }
      ];

      const context = await retriever.retrieveContext(entities);
      const germanyContext = context[':Germany'];

      const capitalRel = germanyContext.neighbors.find(n => n.rel === ':capital');
      expect(capitalRel).toBeDefined();
      expect(capitalRel.target).toBe(':Berlin');
    });

    test('should discover inverse relationships (city to country)', async () => {
      const entities = [
        { value: 'Berlin', canonical: ':Berlin', type: 'City' }
      ];

      const context = await retriever.retrieveContext(entities);
      const berlinContext = context[':Berlin'];

      const countryRel = berlinContext.neighbors.find(n => n.rel === ':country');
      expect(countryRel).toBeDefined();
      expect(countryRel.target).toBe(':Germany');
    });
  });

  describe('Property Filtering', () => {
    test('should exclude type property from properties', async () => {
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' }
      ];

      const context = await retriever.retrieveContext(entities);
      const germanyContext = context[':Germany'];

      // Type should be in type field, not properties
      expect(germanyContext.type).toBe(':Country');
      expect(germanyContext.properties[':type']).toBeUndefined();
    });

    test('should include literal properties only', async () => {
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' }
      ];

      const context = await retriever.retrieveContext(entities);
      const germanyContext = context[':Germany'];

      // Should have literal properties
      expect(germanyContext.properties[':name']).toBe('Germany');
      expect(germanyContext.properties[':population']).toBe(83000000);

      // Note: The mock dataSource returns all properties including relationships
      // In the real implementation, the properties query gets everything,
      // but GraphContextRetriever filters out objects (arrays and entity IRIs go to neighbors)
      // The properties object should only contain primitives
      for (const value of Object.values(germanyContext.properties)) {
        expect(typeof value !== 'object' || value === null).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent entity gracefully', async () => {
      const entities = [
        { value: 'Atlantis', canonical: ':Atlantis', type: 'Country' }
      ];

      const context = await retriever.retrieveContext(entities);

      // Should return empty context for non-existent entity
      expect(context[':Atlantis']).toBeDefined();
      expect(context[':Atlantis'].type).toBeNull();
      expect(context[':Atlantis'].properties).toEqual({});
      expect(context[':Atlantis'].neighbors).toEqual([]);
    });

    test('should handle query failures gracefully', async () => {
      const failingDataSource = {
        query: async () => {
          throw new Error('Database connection failed');
        }
      };

      const failingRetriever = new GraphContextRetriever(failingDataSource);
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' }
      ];

      // Should not throw, but log warning
      const context = await failingRetriever.retrieveContext(entities);

      // Should return context with entity but empty data (graceful degradation)
      expect(Object.keys(context).length).toBe(1);
      expect(context[':Germany']).toBeDefined();
      expect(context[':Germany'].type).toBeNull();
      expect(context[':Germany'].properties).toEqual({});
      expect(context[':Germany'].neighbors).toEqual([]);
    });

    test('should handle partial failures gracefully', async () => {
      let callCount = 0;
      const partiallyFailingDataSource = {
        query: async (query) => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Properties query failed');
          }
          return dataSource.query(query);
        }
      };

      const partialRetriever = new GraphContextRetriever(partiallyFailingDataSource);
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' }
      ];

      // Should handle failure in properties query but still return entity context
      const context = await partialRetriever.retrieveContext(entities);

      // Should have entity with partial data (type but no properties)
      expect(Object.keys(context).length).toBe(1);
      expect(context[':Germany']).toBeDefined();
      expect(context[':Germany'].type).toBe(':Country');
      expect(context[':Germany'].properties).toEqual({});  // Failed query
    });
  });

  describe('Prompt Formatting', () => {
    test('should format complete context for LLM prompt', async () => {
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' }
      ];

      const context = await retriever.retrieveContext(entities);
      const formatted = retriever.formatForPrompt(context);

      expect(formatted).toContain(':Germany:');
      expect(formatted).toContain('Type: :Country');
      expect(formatted).toContain('Properties:');
      expect(formatted).toContain(':name: Germany');
      expect(formatted).toContain(':population: 83000000');
      expect(formatted).toContain('Related entities:');
      expect(formatted).toContain(':borders');
      expect(formatted).toContain(':capital');
    });

    test('should format multiple entities clearly', async () => {
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' },
        { value: 'France', canonical: ':France', type: 'Country' }
      ];

      const context = await retriever.retrieveContext(entities);
      const formatted = retriever.formatForPrompt(context);

      // Should have separate sections for each entity
      expect(formatted).toContain(':Germany:');
      expect(formatted).toContain(':France:');

      // Should have clear structure
      const sections = formatted.split('\n\n');
      expect(sections.length).toBeGreaterThan(2);
    });
  });

  describe('Max Entities Limit', () => {
    test('should respect maxEntities limit', async () => {
      const limitedRetriever = new GraphContextRetriever(dataSource, {
        maxEntities: 2
      });

      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' },
        { value: 'France', canonical: ':France', type: 'Country' },
        { value: 'Poland', canonical: ':Poland', type: 'Country' }
      ];

      const context = await limitedRetriever.retrieveContext(entities);

      // Should only retrieve first 2 entities
      expect(Object.keys(context).length).toBe(2);
      expect(context[':Germany']).toBeDefined();
      expect(context[':France']).toBeDefined();
      expect(context[':Poland']).toBeUndefined();
    });
  });

  describe('Complex Graph Scenarios', () => {
    test('should handle entity with many relationships', async () => {
      const entities = [
        { value: 'Germany', canonical: ':Germany', type: 'Country' }
      ];

      const context = await retriever.retrieveContext(entities);
      const germanyContext = context[':Germany'];

      // Should have multiple types of relationships
      const relationshipTypes = new Set(germanyContext.neighbors.map(n => n.rel));
      expect(relationshipTypes.size).toBeGreaterThan(1);
      expect(relationshipTypes.has(':borders')).toBe(true);
      expect(relationshipTypes.has(':capital')).toBe(true);
    });

    test('should handle entity with no relationships', async () => {
      // Add an isolated entity to the graph
      const isolatedDataSource = {
        query: async (query) => {
          const whereClause = query.where[0];
          const entity = whereClause[0];

          if (entity === ':Island') {
            if (whereClause[1] === ':type') {
              return [{ type: ':Country', '?type': ':Country' }];
            }
            if (whereClause[1] === '?prop') {
              return [
                { prop: ':type', value: ':Country', '?prop': ':type', '?value': ':Country' },
                { prop: ':name', value: 'Island', '?prop': ':name', '?value': 'Island' }
              ];
            }
            if (whereClause[1] === '?rel') {
              return [];  // No neighbors
            }
          }
          return [];
        }
      };

      const isolatedRetriever = new GraphContextRetriever(isolatedDataSource);
      const entities = [
        { value: 'Island', canonical: ':Island', type: 'Country' }
      ];

      const context = await isolatedRetriever.retrieveContext(entities);
      const islandContext = context[':Island'];

      expect(islandContext.type).toBe(':Country');
      expect(islandContext.properties[':name']).toBe('Island');
      expect(islandContext.neighbors).toEqual([]);
    });
  });
});
