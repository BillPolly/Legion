/**
 * Unit tests for SemanticInventoryService
 *
 * Uses MOCKED SemanticSearch for unit testing only
 * Integration tests use real resources
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { SemanticInventoryService } from '../../src/semantic/SemanticInventoryService.js';

describe('SemanticInventoryService - Unit Tests', () => {
  let service;
  let mockResourceManager;
  let mockSemanticSearch;

  beforeEach(() => {
    // Create mock semantic search
    mockSemanticSearch = {
      semanticSearch: async (collection, text, options) => {
        // Mock responses based on collection
        if (collection === 'wordnet_entity_types') {
          return [
            { document: { label: 'PERSON' } },
            { document: { label: 'LOCATION' } }
          ];
        } else if (collection === 'wordnet_roles') {
          return [
            { document: { label: 'Agent' } },
            { document: { label: 'Theme' } }
          ];
        } else if (collection === 'wordnet_predicates') {
          return [
            { document: { label: 'heavy' } },
            { document: { label: 'red' } }
          ];
        } else if (collection === 'wordnet_relations') {
          return [
            { document: { label: 'in' } },
            { document: { label: 'on' } }
          ];
        }
        return [];
      },
      count: async (collection) => {
        // Mock non-zero counts for all collections
        if (collection === 'wordnet_predicates') return 0; // Optional collection
        return 10;
      }
    };

    // Create mock resource manager
    mockResourceManager = {
      get: async (key) => {
        if (key === 'semanticSearch') {
          return mockSemanticSearch;
        }
        return null;
      }
    };

    service = new SemanticInventoryService(mockResourceManager);
  });

  test('should construct with resourceManager', () => {
    expect(service.resourceManager).toBe(mockResourceManager);
    expect(service.semanticSearch).toBeNull();
    expect(service.initialized).toBe(false);
  });

  test('should initialize and get semanticSearch from resourceManager', async () => {
    await service.initialize();

    expect(service.semanticSearch).toBe(mockSemanticSearch);
    expect(service.initialized).toBe(true);
  });

  test('should throw if semanticSearch not available', async () => {
    const badResourceManager = {
      get: async () => null
    };

    const badService = new SemanticInventoryService(badResourceManager);

    await expect(badService.initialize()).rejects.toThrow('Semantic search provider not available');
  });

  test('should check if collections are indexed', async () => {
    await service.initialize();

    // Should succeed because mock count returns 10
    expect(service.initialized).toBe(true);
  });

  test('should throw if required collection is empty', async () => {
    // Mock that returns 0 for entity_types
    const emptyMockSemanticSearch = {
      count: async (collection) => {
        if (collection === 'wordnet_entity_types') return 0;
        return 10;
      }
    };

    const emptyMockResourceManager = {
      get: async () => emptyMockSemanticSearch
    };

    const emptyService = new SemanticInventoryService(emptyMockResourceManager);

    await expect(emptyService.initialize()).rejects.toThrow(
      'Collection wordnet_entity_types is not indexed'
    );
  });

  test('should return entity type labels', async () => {
    await service.initialize();

    const types = await service.semanticSearchEntityTypes('John is a person');

    expect(types).toEqual(['PERSON', 'LOCATION']);
    expect(Array.isArray(types)).toBe(true);
  });

  test('should return relation inventory', async () => {
    await service.initialize();

    const inventory = await service.semanticSearchRelationTypes('Alice gave Bob a gift');

    expect(inventory).toEqual({
      roles: ['Agent', 'Theme'],
      unaryPredicates: ['heavy', 'red'],
      binaryRelations: ['in', 'on']
    });
  });

  test('should accept search options for entity types', async () => {
    await service.initialize();

    const types = await service.semanticSearchEntityTypes('text', {
      limit: 10,
      threshold: 0.7
    });

    expect(types).toBeDefined();
    expect(Array.isArray(types)).toBe(true);
  });

  test('should accept search options for relation types', async () => {
    await service.initialize();

    const inventory = await service.semanticSearchRelationTypes('text', {
      limit: 30,
      threshold: 0.4
    });

    expect(inventory).toBeDefined();
    expect(inventory.roles).toBeDefined();
    expect(inventory.unaryPredicates).toBeDefined();
    expect(inventory.binaryRelations).toBeDefined();
  });

  test('should throw if semanticSearchEntityTypes called before initialize', async () => {
    await expect(service.semanticSearchEntityTypes('text')).rejects.toThrow(
      'SemanticInventoryService not initialized'
    );
  });

  test('should throw if semanticSearchRelationTypes called before initialize', async () => {
    await expect(service.semanticSearchRelationTypes('text')).rejects.toThrow(
      'SemanticInventoryService not initialized'
    );
  });

  test('should throw if getStats called before initialize', async () => {
    await expect(service.getStats()).rejects.toThrow(
      'SemanticInventoryService not initialized'
    );
  });

  test('should return stats from all collections', async () => {
    await service.initialize();

    const stats = await service.getStats();

    expect(stats).toEqual({
      entityTypes: 10,
      semanticRoles: 10,
      unaryPredicates: 0,
      binaryRelations: 10,
      total: 30
    });
  });

  test('should report initialized status correctly', async () => {
    expect(service.isInitialized()).toBe(false);

    await service.initialize();

    expect(service.isInitialized()).toBe(true);
  });
});
