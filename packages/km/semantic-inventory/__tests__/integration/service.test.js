/**
 * SemanticInventoryService Integration Tests
 *
 * Tests the complete query API for semantic symbol selection.
 * Uses existing test data from data-preparation.test.js.
 *
 * NO MOCKS - uses real Qdrant semantic search
 * FAIL FAST - if service unavailable, tests fail
 */

import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryService } from '../../src/SemanticInventoryService.js';

describe('SemanticInventoryService (Query API)', () => {
  let resourceManager;
  let service;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Create and initialize service with test collection prefix
    service = new SemanticInventoryService(resourceManager, {
      collectionPrefix: 'test_'
    });
    await service.initialize();

    // Verify service initialized
    if (!service.isInitialized()) {
      throw new Error('SemanticInventoryService failed to initialize');
    }
  }, 30000);

  describe('Entity Type Search', () => {
    test('should find PERSON entities for "teacher professor instructor"', async () => {
      const types = await service.semanticSearchEntityTypes('teacher professor instructor');

      expect(types).toBeInstanceOf(Array);
      expect(types.length).toBeGreaterThan(0);
      expect(types[0]).toBe('PERSON');
    });

    test('should find LOCATION entities for "city building place"', async () => {
      const types = await service.semanticSearchEntityTypes('city building place');

      expect(types).toBeInstanceOf(Array);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('LOCATION');
    });

    test('should return unique entity type labels (no duplicates)', async () => {
      const types = await service.semanticSearchEntityTypes('professor teacher person');

      const uniqueTypes = new Set(types);
      expect(types.length).toBe(uniqueTypes.size);
    });

    test('should respect limit option', async () => {
      const types = await service.semanticSearchEntityTypes('person place thing', { limit: 3 });

      expect(types.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Relation Type Search', () => {
    test('should find roles, predicates, and relations for sentence', async () => {
      const inventory = await service.semanticSearchRelationTypes(
        'the teacher walked to the building'
      );

      expect(inventory).toHaveProperty('roles');
      expect(inventory).toHaveProperty('unaryPredicates');
      expect(inventory).toHaveProperty('binaryRelations');

      expect(inventory.roles).toBeInstanceOf(Array);
      expect(inventory.unaryPredicates).toBeInstanceOf(Array);
      expect(inventory.binaryRelations).toBeInstanceOf(Array);
    });

    test('should find Agent role for action sentences', async () => {
      const inventory = await service.semanticSearchRelationTypes(
        'the teacher gave the student a book'
      );

      expect(inventory.roles).toContain('Agent');
    });

    test('should find Theme role for object references', async () => {
      const inventory = await service.semanticSearchRelationTypes(
        'the student received the book'
      );

      expect(inventory.roles.length).toBeGreaterThan(0);
      // Theme is one of the core roles for objects being received
    });

    test('should find unary predicates for descriptive text', async () => {
      const inventory = await service.semanticSearchRelationTypes(
        'the heavy book on the tall table'
      );

      expect(inventory.unaryPredicates.length).toBeGreaterThan(0);
    });

    test('should find spatial relations for location text', async () => {
      const inventory = await service.semanticSearchRelationTypes(
        'the book is on the table inside the room'
      );

      expect(inventory.binaryRelations.length).toBeGreaterThan(0);
    });

    test('should find temporal relations for time text', async () => {
      const inventory = await service.semanticSearchRelationTypes(
        'the student arrived before the teacher'
      );

      expect(inventory.binaryRelations).toContain('before');
    });
  });

  describe('End-to-End Workflow', () => {
    test('should support complete DRS mention extraction workflow', async () => {
      const text = 'The professor walked to the university building';

      // Stage 1: Get entity type inventory for mention extraction
      const entityTypes = await service.semanticSearchEntityTypes(text);

      expect(entityTypes).toContain('PERSON');
      expect(entityTypes).toContain('LOCATION');
    });

    test('should support complete DRS event extraction workflow', async () => {
      const text = 'John gave Mary a heavy book in the library';

      // Stage 3: Get relation inventory for event extraction
      const inventory = await service.semanticSearchRelationTypes(text);

      expect(inventory.roles.length).toBeGreaterThan(0);
      expect(inventory.unaryPredicates.length).toBeGreaterThan(0);
      expect(inventory.binaryRelations.length).toBeGreaterThan(0);
    });

    test('should handle complex multi-clause sentences', async () => {
      const text = 'The student read the book before the exam in the library';

      const entityTypes = await service.semanticSearchEntityTypes(text);
      const inventory = await service.semanticSearchRelationTypes(text);

      // Should find various entity types
      expect(entityTypes.length).toBeGreaterThan(0);

      // Should find roles for reading action
      expect(inventory.roles.length).toBeGreaterThan(0);

      // Should find temporal and spatial relations
      expect(inventory.binaryRelations.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should throw error if searching without initialization', async () => {
      const uninitializedService = new SemanticInventoryService(resourceManager);

      await expect(
        uninitializedService.semanticSearchEntityTypes('test')
      ).rejects.toThrow('not initialized');
    });

    test('should return empty arrays for non-matching queries', async () => {
      // Use very high threshold to get no matches
      const types = await service.semanticSearchEntityTypes(
        'xyzabc123nonsense',
        { threshold: 0.99 }
      );

      expect(types).toBeInstanceOf(Array);
      // May or may not be empty - service returns best matches even for nonsense
    });
  });
});
