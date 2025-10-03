/**
 * Integration test for entity extraction and storage
 * Tests the full flow: NLP → Entity Store → Deduplication → Semantic Search
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { KnowledgeGraphStore } from '../../src/KnowledgeGraphStore.js';
import { EntityDeduplicator } from '../../src/EntityDeduplicator.js';
import { ProvenanceTracker } from '../../src/ProvenanceTracker.js';
import { OntologyInstanceExtractor } from '../../src/OntologyInstanceExtractor.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ResourceManager } from '@legion/resource-manager';

describe('Entity Extraction Integration', () => {
  let mongoServer;
  let store;
  let deduplicator;
  let provenance;
  let extractor;
  let semanticSearch;
  let resourceManager;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getInstance();

    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    // Create knowledge graph store
    store = new KnowledgeGraphStore({
      connectionString: uri,
      database: 'test-kg',
      collection: 'knowledge_graph'
    });
    await store.connect();

    // Create semantic search
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();

    // Create support services
    deduplicator = new EntityDeduplicator(store, semanticSearch);
    provenance = new ProvenanceTracker(store);

    // Create extractor
    extractor = new OntologyInstanceExtractor({
      knowledgeGraphStore: store,
      semanticSearch,
      entityDeduplicator: deduplicator,
      provenanceTracker: provenance,
      deduplicationThreshold: 0.85
    });
  }, 60000);

  afterAll(async () => {
    if (store) {
      await store.disconnect();
    }
    if (semanticSearch) {
      await semanticSearch.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  test('should extract entities from NLP result', async () => {
    // Simulate NLP extraction result
    const nlpResult = {
      extractions: {
        entityDetails: [
          {
            type: 'kg:CentrifugalPump',
            text: 'Pump P101',
            label: 'Pump P101',
            confidence: 0.95,
            properties: {
              operatingPressure: 150
            }
          },
          {
            type: 'kg:Tank',
            text: 'Tank T200',
            label: 'Tank T200',
            confidence: 0.92,
            properties: {
              capacity: 1000
            }
          }
        ],
        relationshipDetails: [
          {
            type: 'kg:connectsTo',
            subject: 'Pump P101',
            object: 'Tank T200',
            confidence: 0.90
          }
        ]
      }
    };

    const result = await extractor.extractInstances(nlpResult, 'sentence_test_1');

    // Verify entities were created
    expect(result.entities.length).toBe(2);
    expect(result.entities[0].action).toBe('created');
    expect(result.entities[0].mongoId).toBeDefined();
    expect(result.entities[1].action).toBe('created');

    // Verify relationship was created
    expect(result.relationships.length).toBe(1);
    expect(result.relationships[0].action).toBe('created');
    expect(result.relationships[0].mongoId).toBeDefined();

    // Verify statistics
    expect(result.statistics.entitiesCreated).toBe(2);
    expect(result.statistics.relationshipsCreated).toBe(1);
  }, 30000);

  test('should deduplicate similar entities', async () => {
    // First extraction: Create "Pump P101"
    const nlpResult1 = {
      extractions: {
        entityDetails: [
          {
            type: 'kg:CentrifugalPump',
            text: 'Pump P101',
            label: 'Pump P101',
            confidence: 0.95
          }
        ],
        relationshipDetails: []
      }
    };

    const result1 = await extractor.extractInstances(nlpResult1, 'sentence_dedup_1', {
      enableDeduplication: true
    });

    expect(result1.entities[0].action).toBe('created');
    const originalId = result1.entities[0].mongoId;

    // Second extraction: Try to create "pump P101" (lowercase, should deduplicate)
    const nlpResult2 = {
      extractions: {
        entityDetails: [
          {
            type: 'kg:CentrifugalPump',
            text: 'pump P101',
            label: 'pump P101',
            confidence: 0.90
          }
        ],
        relationshipDetails: []
      }
    };

    const result2 = await extractor.extractInstances(nlpResult2, 'sentence_dedup_2', {
      enableDeduplication: true
    });

    expect(result2.entities[0].action).toBe('merged');
    expect(result2.entities[0].mergedWith.toString()).toBe(originalId.toString());
    expect(result2.statistics.entitiesMerged).toBe(1);
    expect(result2.statistics.entitiesCreated).toBe(0);

    // Verify provenance was updated
    const mentions = await provenance.getSentencesMentioning(originalId);
    expect(mentions).toContain('sentence_dedup_1');
    expect(mentions).toContain('sentence_dedup_2');
  }, 30000);

  test('should track provenance across mentions', async () => {
    const nlpResult = {
      extractions: {
        entityDetails: [
          {
            type: 'kg:Valve',
            text: 'Valve V100',
            label: 'Valve V100',
            confidence: 0.93
          }
        ],
        relationshipDetails: []
      }
    };

    // Extract from first sentence
    const result1 = await extractor.extractInstances(nlpResult, 'sentence_prov_1');
    const valveId = result1.entities[0].mongoId;

    // Add mention from second sentence
    await provenance.addMention(valveId, 'sentence_prov_2');

    // Add mention from third sentence
    await provenance.addMention(valveId, 'sentence_prov_3');

    // Verify all mentions tracked
    const mentions = await provenance.getSentencesMentioning(valveId);
    expect(mentions.length).toBe(3);
    expect(mentions).toContain('sentence_prov_1');
    expect(mentions).toContain('sentence_prov_2');
    expect(mentions).toContain('sentence_prov_3');

    // Verify reverse lookup
    const itemsInSentence = await provenance.getMentionsInSentence('sentence_prov_1');
    expect(itemsInSentence.entities.length).toBeGreaterThanOrEqual(1);
    expect(itemsInSentence.entities.some(e => e._id.toString() === valveId.toString())).toBe(true);
  });

  test('should handle batch extraction', async () => {
    const nlpResults = [
      {
        extractions: {
          entityDetails: [
            { type: 'kg:Motor', text: 'Motor M100', label: 'Motor M100', confidence: 0.9 }
          ],
          relationshipDetails: []
        }
      },
      {
        extractions: {
          entityDetails: [
            { type: 'kg:Motor', text: 'Motor M101', label: 'Motor M101', confidence: 0.88 }
          ],
          relationshipDetails: []
        }
      }
    ];

    const sentenceIds = ['sentence_batch_1', 'sentence_batch_2'];

    const result = await extractor.extractInstancesBatch(nlpResults, sentenceIds);

    expect(result.sentences).toBe(2);
    expect(result.entities.length).toBe(2);
    expect(result.statistics.entitiesCreated).toBe(2);
  }, 30000);

  test('should link entities via MongoDB ObjectIds', async () => {
    const nlpResult = {
      extractions: {
        entityDetails: [
          { type: 'kg:Heater', text: 'Heater H100', label: 'Heater H100', confidence: 0.91 },
          { type: 'kg:Thermostat', text: 'Thermostat T100', label: 'Thermostat T100', confidence: 0.89 }
        ],
        relationshipDetails: [
          {
            type: 'kg:controls',
            subject: 'Thermostat T100',
            object: 'Heater H100',
            confidence: 0.92
          }
        ]
      }
    };

    const result = await extractor.extractInstances(nlpResult, 'sentence_link_1');

    // Get the relationship
    const relId = result.relationships[0].mongoId;
    const rel = await store.findGraphItem(relId);

    // Verify it links to actual entity MongoDB IDs
    expect(rel.from).toBeDefined();
    expect(rel.to).toBeDefined();

    // Verify we can traverse the relationship
    const fromEntity = await store.findEntityById(rel.from);
    const toEntity = await store.findEntityById(rel.to);

    expect(fromEntity).toBeDefined();
    expect(toEntity).toBeDefined();
    expect(fromEntity.label).toBe('Thermostat T100');
    expect(toEntity.label).toBe('Heater H100');
  });

  test('should get knowledge graph statistics', async () => {
    const stats = await store.getStatistics();

    expect(stats.totalEntities).toBeGreaterThan(0);
    expect(stats.totalRelationships).toBeGreaterThan(0);
    expect(stats.total).toBe(stats.totalEntities + stats.totalRelationships);
    expect(stats.byType).toBeDefined();
    expect(Object.keys(stats.byType).length).toBeGreaterThan(0);
  });
});
