/**
 * Unit tests for GraphContextRetriever
 */

import { GraphContextRetriever } from '../../src/context/GraphContextRetriever.js';

// Helper to create mock DataSource with preset responses
function createMockDataSource(responses = []) {
  let responseIndex = 0;
  return {
    query: async (query) => {
      if (responseIndex < responses.length) {
        return responses[responseIndex++];
      }
      return [];
    }
  };
}

describe('GraphContextRetriever', () => {
  describe('Constructor', () => {
    test('should throw error if dataSource not provided', () => {
      expect(() => new GraphContextRetriever()).toThrow('DataSource is required');
    });

    test('should initialize with default options', () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource);

      expect(retriever.dataSource).toBe(mockDataSource);
      expect(retriever.defaultRadius).toBe(1);
      expect(retriever.maxEntities).toBe(10);
    });

    test('should initialize with custom options', () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource, {
        defaultRadius: 2,
        maxEntities: 5
      });

      expect(retriever.defaultRadius).toBe(2);
      expect(retriever.maxEntities).toBe(5);
    });
  });

  describe('retrieveContext()', () => {
    test('should throw error if entities is not an array', async () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource);

      await expect(retriever.retrieveContext('not-an-array')).rejects.toThrow('Entities must be an array');
    });

    test('should return empty object for empty entities array', async () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource);

      const result = await retriever.retrieveContext([]);
      expect(result).toEqual({});
    });

    test('should skip entities without canonical field', async () => {
      const mockDataSource = createMockDataSource([
        [{ type: ':Country' }],          // Type query for :France
        [{ prop: ':name', value: 'France' }],  // Properties query
        []                                 // Neighbors query
      ]);
      const retriever = new GraphContextRetriever(mockDataSource);

      const entities = [
        { value: 'France' },  // Missing canonical
        null,                   // Null entity
        { canonical: ':France', value: 'France' }  // Valid entity
      ];

      const result = await retriever.retrieveContext(entities);

      expect(Object.keys(result)).toHaveLength(1);
      expect(result[':France']).toBeDefined();
    });

    test('should retrieve type, properties, and neighbors for single entity', async () => {
      const mockDataSource = createMockDataSource([
        [{ type: ':Country' }],
        [
          { prop: ':name', value: 'France' },
          { prop: ':population', value: 67000000 },
          { prop: ':type', value: ':Country' }  // Should be filtered out
        ],
        [
          { rel: ':borders', target: ':Germany' },
          { rel: ':borders', target: ':Spain' },
          { rel: ':hasCapital', target: ':Paris' }
        ]
      ]);
      const retriever = new GraphContextRetriever(mockDataSource);

      const entities = [{ canonical: ':France', value: 'France', type: 'Country' }];

      const result = await retriever.retrieveContext(entities, 1);

      expect(result[':France']).toEqual({
        type: ':Country',
        properties: {
          ':name': 'France',
          ':population': 67000000
        },
        neighbors: [
          { rel: ':borders', target: ':Germany' },
          { rel: ':borders', target: ':Spain' },
          { rel: ':hasCapital', target: ':Paris' }
        ]
      });
    });

    test('should handle multiple entities', async () => {
      const mockDataSource = createMockDataSource([
        // France
        [{ type: ':Country' }],
        [{ prop: ':name', value: 'France' }],
        [{ rel: ':borders', target: ':Germany' }],
        // Germany
        [{ type: ':Country' }],
        [{ prop: ':name', value: 'Germany' }],
        [{ rel: ':borders', target: ':France' }]
      ]);
      const retriever = new GraphContextRetriever(mockDataSource);

      const entities = [
        { canonical: ':France', value: 'France' },
        { canonical: ':Germany', value: 'Germany' }
      ];

      const result = await retriever.retrieveContext(entities, 1);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result[':France']).toBeDefined();
      expect(result[':Germany']).toBeDefined();
    });

    test('should limit to maxEntities', async () => {
      const mockDataSource = createMockDataSource([
        // First 2 entities
        [{ type: ':Country' }], [], [],
        [{ type: ':Country' }], [], []
      ]);
      const retriever = new GraphContextRetriever(mockDataSource, { maxEntities: 2 });

      const entities = [
        { canonical: ':France', value: 'France' },
        { canonical: ':Germany', value: 'Germany' },
        { canonical: ':Spain', value: 'Spain' }  // Should be skipped
      ];

      const result = await retriever.retrieveContext(entities, 1);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result[':France']).toBeDefined();
      expect(result[':Germany']).toBeDefined();
      expect(result[':Spain']).toBeUndefined();
    });

    test('should use defaultRadius if radius not specified', async () => {
      const mockDataSource = createMockDataSource([
        [{ type: ':Country' }], [], []
      ]);
      const retriever = new GraphContextRetriever(mockDataSource, { defaultRadius: 2 });

      const entities = [{ canonical: ':France', value: 'France' }];

      const result = await retriever.retrieveContext(entities);  // No radius specified

      expect(result[':France']).toBeDefined();
    });

    test('should handle missing type gracefully', async () => {
      const mockDataSource = createMockDataSource([
        [],  // Empty type results
        [{ prop: ':name', value: 'France' }],
        [{ rel: ':borders', target: ':Germany' }]
      ]);
      const retriever = new GraphContextRetriever(mockDataSource);

      const entities = [{ canonical: ':France', value: 'France' }];

      const result = await retriever.retrieveContext(entities, 1);

      expect(result[':France']).toEqual({
        type: null,
        properties: { ':name': 'France' },
        neighbors: [{ rel: ':borders', target: ':Germany' }]
      });
    });

    test('should filter out :type from properties', async () => {
      const mockDataSource = createMockDataSource([
        [{ type: ':Country' }],
        [
          { prop: ':name', value: 'France' },
          { prop: ':type', value: ':Country' },  // Should be filtered
          { prop: ':population', value: 67000000 }
        ],
        []
      ]);
      const retriever = new GraphContextRetriever(mockDataSource);

      const entities = [{ canonical: ':France', value: 'France' }];

      const result = await retriever.retrieveContext(entities, 1);

      expect(result[':France'].properties).toEqual({
        ':name': 'France',
        ':population': 67000000
      });
      expect(result[':France'].properties[':type']).toBeUndefined();
    });

    test('should filter out :type from neighbors', async () => {
      const mockDataSource = createMockDataSource([
        [{ type: ':Country' }],
        [],
        [
          { rel: ':borders', target: ':Germany' },
          { rel: ':type', target: ':Country' }  // Should be filtered
        ]
      ]);
      const retriever = new GraphContextRetriever(mockDataSource);

      const entities = [{ canonical: ':France', value: 'France' }];

      const result = await retriever.retrieveContext(entities, 1);

      expect(result[':France'].neighbors).toEqual([
        { rel: ':borders', target: ':Germany' }
      ]);
    });

    test('should only store literal properties (not objects)', async () => {
      const mockDataSource = createMockDataSource([
        [{ type: ':Country' }],
        [
          { prop: ':name', value: 'France' },
          { prop: ':metadata', value: { complex: 'object' } },  // Should be filtered
          { prop: ':population', value: 67000000 }
        ],
        []
      ]);
      const retriever = new GraphContextRetriever(mockDataSource);

      const entities = [{ canonical: ':France', value: 'France' }];

      const result = await retriever.retrieveContext(entities, 1);

      expect(result[':France'].properties).toEqual({
        ':name': 'France',
        ':population': 67000000
      });
    });
  });

  describe('formatForPrompt()', () => {
    test('should return empty string for empty graph context', () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource);

      const result = retriever.formatForPrompt({});
      expect(result).toBe('');
    });

    test('should return empty string for null graph context', () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource);

      const result = retriever.formatForPrompt(null);
      expect(result).toBe('');
    });

    test('should format single entity with type only', () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource);

      const graphContext = {
        ':France': {
          type: ':Country',
          properties: {},
          neighbors: []
        }
      };

      const result = retriever.formatForPrompt(graphContext);

      expect(result).toContain(':France:');
      expect(result).toContain('Type: :Country');
    });

    test('should format entity with properties', () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource);

      const graphContext = {
        ':France': {
          type: ':Country',
          properties: {
            ':name': 'France',
            ':population': 67000000
          },
          neighbors: []
        }
      };

      const result = retriever.formatForPrompt(graphContext);

      expect(result).toContain(':France:');
      expect(result).toContain('Properties:');
      expect(result).toContain(':name: France');
      expect(result).toContain(':population: 67000000');
    });

    test('should format entity with neighbors', () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource);

      const graphContext = {
        ':France': {
          type: ':Country',
          properties: {},
          neighbors: [
            { rel: ':borders', target: ':Germany' },
            { rel: ':borders', target: ':Spain' }
          ]
        }
      };

      const result = retriever.formatForPrompt(graphContext);

      expect(result).toContain(':France:');
      expect(result).toContain('Related entities:');
      expect(result).toContain(':borders → :Germany');
      expect(result).toContain(':borders → :Spain');
    });

    test('should format multiple entities', () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource);

      const graphContext = {
        ':France': {
          type: ':Country',
          properties: { ':name': 'France' },
          neighbors: []
        },
        ':Germany': {
          type: ':Country',
          properties: { ':name': 'Germany' },
          neighbors: []
        }
      };

      const result = retriever.formatForPrompt(graphContext);

      expect(result).toContain(':France:');
      expect(result).toContain(':Germany:');
    });

    test('should include header text', () => {
      const mockDataSource = { query: async () => [] };
      const retriever = new GraphContextRetriever(mockDataSource);

      const graphContext = {
        ':France': {
          type: ':Country',
          properties: {},
          neighbors: []
        }
      };

      const result = retriever.formatForPrompt(graphContext);

      expect(result).toContain('Graph context (entities and their relationships):');
    });
  });
});
