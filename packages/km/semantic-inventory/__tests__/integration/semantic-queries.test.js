/**
 * Semantic Query Tests - Query existing test data
 *
 * This test suite ONLY queries existing data in Qdrant.
 * NO indexing - assumes data-preparation.test.js already ran.
 * Fast execution (~100-200ms total).
 *
 * NO MOCKS - uses real Qdrant semantic search
 * FAIL FAST - if data missing, tests fail
 */

import { ResourceManager } from '@legion/resource-manager';

describe('Semantic Queries (Fast - No Indexing)', () => {
  let resourceManager;
  let semanticSearch;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Get semantic search provider
    semanticSearch = await resourceManager.get('semanticSearch');
    if (!semanticSearch) {
      throw new Error('SemanticSearch not available');
    }

    // Verify test data exists
    const counts = {
      entity_types: await semanticSearch.count('test_wordnet_entity_types'),
      roles: await semanticSearch.count('test_wordnet_roles'),
      predicates: await semanticSearch.count('test_wordnet_predicates'),
      relations: await semanticSearch.count('test_wordnet_relations')
    };

    if (counts.entity_types === 0 || counts.roles === 0 || counts.predicates === 0 || counts.relations === 0) {
      throw new Error(`Test data missing! Run data-preparation.test.js first. Counts: ${JSON.stringify(counts)}`);
    }

    console.log(`\n=== Test Data Ready: ${JSON.stringify(counts)} ===\n`);
  }, 30000);

  describe('Entity Types', () => {
    test('should find PERSON entities', async () => {
      const results = await semanticSearch.semanticSearch(
        'test_wordnet_entity_types',
        'teacher',
        { limit: 3, threshold: 0.5 }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.label).toBe('PERSON');
      expect(results[0].document).toHaveProperty('synonyms');
      expect(results[0].document).toHaveProperty('definition');
    });

    test('should have valid entity type categories', async () => {
      const validCategories = [
        'PERSON', 'LOCATION', 'ORGANIZATION', 'ARTIFACT',
        'EVENT', 'TIME', 'QUANTITY', 'ABSTRACT', 'PHYSICAL_OBJECT', 'THING'
      ];

      const results = await semanticSearch.semanticSearch(
        'test_wordnet_entity_types',
        'teacher',
        { limit: 5 }
      );

      for (const result of results) {
        expect(validCategories).toContain(result.document.label);
        expect(validCategories).toContain(result.document.entityType);
      }
    });
  });

  describe('Semantic Roles', () => {
    test('should find Agent role', async () => {
      const results = await semanticSearch.semanticSearch(
        'test_wordnet_roles',
        'causer of action',
        { limit: 3, threshold: 0.5 }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document).toHaveProperty('label');
      expect(results[0].document).toHaveProperty('definition');
      expect(results[0].document).toHaveProperty('roleType');
    });

    test('should have valid role types', async () => {
      const validRoleTypes = ['core', 'peripheral'];

      const results = await semanticSearch.semanticSearch(
        'test_wordnet_roles',
        'agent action',
        { limit: 10 }
      );

      for (const result of results) {
        expect(validRoleTypes).toContain(result.document.roleType);
      }
    });
  });

  describe('Predicates', () => {
    test('should find adjective predicates', async () => {
      const results = await semanticSearch.semanticSearch(
        'test_wordnet_predicates',
        'big',
        { limit: 3 }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document).toHaveProperty('synonyms');
      expect(results[0].document).toHaveProperty('pos');
    });

    test('should include all POS types (a, n, v)', async () => {
      const adjResults = await semanticSearch.semanticSearch('test_wordnet_predicates', 'big', { limit: 5 });
      const nounResults = await semanticSearch.semanticSearch('test_wordnet_predicates', 'teacher', { limit: 5 });
      const verbResults = await semanticSearch.semanticSearch('test_wordnet_predicates', 'walk', { limit: 5 });

      const allResults = [...adjResults, ...nounResults, ...verbResults];
      const posTypes = new Set(allResults.map(r => r.document.pos));

      expect(posTypes.has('a')).toBe(true);
      expect(posTypes.has('n')).toBe(true);
      expect(posTypes.has('v')).toBe(true);
    });
  });

  describe('Relations', () => {
    test('should find spatial relations', async () => {
      const results = await semanticSearch.semanticSearch(
        'test_wordnet_relations',
        'inside location place',
        { limit: 10, threshold: 0.3 }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document).toHaveProperty('relationType');
      expect(results[0].document).toHaveProperty('synonyms');
    });

    test('should have valid relation types (spatial, temporal, logical)', async () => {
      const validRelationTypes = ['spatial', 'temporal', 'logical'];

      const results = await semanticSearch.semanticSearch(
        'test_wordnet_relations',
        'in before because inside when',
        { limit: 20, threshold: 0.1 }
      );

      expect(results.length).toBeGreaterThan(0);

      for (const result of results) {
        expect(validRelationTypes).toContain(result.document.relationType);
      }

      // Count distribution
      const typeCounts = {};
      for (const result of results) {
        const type = result.document.relationType;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      }
      console.log(`Relation type distribution: ${JSON.stringify(typeCounts)}`);
    });
  });

  describe('Collection Statistics', () => {
    test('should have correct counts', async () => {
      expect(await semanticSearch.count('test_wordnet_entity_types')).toBe(50);
      expect(await semanticSearch.count('test_wordnet_roles')).toBe(10);
      expect(await semanticSearch.count('test_wordnet_predicates')).toBe(60);
      expect(await semanticSearch.count('test_wordnet_relations')).toBe(30);
    });
  });
});
