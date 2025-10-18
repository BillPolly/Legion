/**
 * Data Preparation Test - Run ONCE to index test data
 *
 * This test suite indexes test data into Qdrant collections.
 * It runs FIRST (alphabetically before other integration tests).
 * Subsequent test runs skip indexing if data already exists.
 *
 * NO MOCKS - uses real Qdrant, real MongoDB, real embeddings
 * FAIL FAST - if resources unavailable, tests fail
 */

import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryIndexer } from '../../src/SemanticInventoryIndexer.js';

describe('Data Preparation (One-Time Indexing)', () => {
  let resourceManager;
  let semanticSearch;
  let indexer;

  beforeAll(async () => {
    // Get ResourceManager singleton (initialized ONCE)
    resourceManager = await ResourceManager.getInstance();

    // Get semantic search provider
    semanticSearch = await resourceManager.get('semanticSearch');
    if (!semanticSearch) {
      throw new Error('SemanticSearch not available - test environment not properly configured');
    }

    // Create indexer
    indexer = new SemanticInventoryIndexer(resourceManager);
    await indexer.initialize();
  }, 120000);

  afterAll(async () => {
    // Clean up indexer's MongoDB connection only
    if (indexer) {
      await indexer.close();
    }
    // DON'T close ResourceManager (singleton) or semanticSearch (managed by RM)
  });

  test('should prepare all test collections (index only if needed)', async () => {
    console.log('\n=== CHECKING TEST DATA ===');

    // Check each collection and index only if needed
    const collections = [
      { name: 'test_wordnet_entity_types', expected: 50, indexFn: () => indexer.indexEntityTypes({ testMode: true, collectionPrefix: 'test_' }) },
      { name: 'test_wordnet_roles', expected: 10, indexFn: () => indexer.indexRoles({ testMode: true, collectionPrefix: 'test_' }) },
      { name: 'test_wordnet_predicates', expected: 60, indexFn: () => indexer.indexPredicates({ testMode: true, collectionPrefix: 'test_' }) },
      { name: 'test_wordnet_relations', expected: 30, indexFn: () => indexer.indexRelations({ testMode: true, collectionPrefix: 'test_' }) }
    ];

    let totalIndexed = 0;
    let skipped = 0;

    for (const { name, expected, indexFn } of collections) {
      const count = await semanticSearch.count(name);

      if (count === expected) {
        console.log(`✓ ${name}: ${count} items (SKIPPING - data exists)`);
        skipped++;
      } else {
        console.log(`→ ${name}: ${count} items (INDEXING - expected ${expected})`);
        const startTime = Date.now();
        await indexFn();
        const duration = Date.now() - startTime;
        totalIndexed++;
        console.log(`✓ ${name}: indexed in ${duration}ms`);
      }
    }

    console.log(`\n=== DATA PREP COMPLETE ===`);
    console.log(`Indexed: ${totalIndexed} collections`);
    console.log(`Skipped: ${skipped} collections (data already exists)`);

    // Verify all collections have correct counts
    expect(await semanticSearch.count('test_wordnet_entity_types')).toBe(50);
    expect(await semanticSearch.count('test_wordnet_roles')).toBe(10);
    expect(await semanticSearch.count('test_wordnet_predicates')).toBe(60);
    expect(await semanticSearch.count('test_wordnet_relations')).toBe(30);
  }, 120000);

  test('should verify getStats() returns all collection counts', async () => {
    const stats = await indexer.getStats({ collectionPrefix: 'test_' });

    expect(stats).toHaveProperty('entity_types');
    expect(stats).toHaveProperty('roles');
    expect(stats).toHaveProperty('predicates');
    expect(stats).toHaveProperty('relations');
    expect(stats).toHaveProperty('total');

    expect(stats.entity_types).toBe(50);
    expect(stats.roles).toBe(10);
    expect(stats.predicates).toBe(60);
    expect(stats.relations).toBe(30);
    expect(stats.total).toBe(150);
  }, 10000);
});
