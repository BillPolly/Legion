/**
 * Unit tests for KnowledgeGraphStore
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { KnowledgeGraphStore } from '../../src/KnowledgeGraphStore.js';

describe('KnowledgeGraphStore', () => {
  let mongoServer;
  let store;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    store = new KnowledgeGraphStore({
      connectionString: uri,
      database: 'test-kg',
      collection: 'knowledge_graph'
    });

    await store.connect();
  }, 30000);

  afterAll(async () => {
    if (store) {
      await store.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('Entity Operations', () => {
    test('should insert and retrieve entity', async () => {
      const entity = {
        ontologyType: 'kg:CentrifugalPump',
        label: 'Pump P101',
        attributes: {
          operatingPressure: 150,
          manufacturer: 'Siemens'
        },
        provenance: {
          mentionedIn: ['sentence_1'],
          confidence: 0.95
        }
      };

      const entityId = await store.insertEntity(entity);
      expect(entityId).toBeDefined();

      const retrieved = await store.findEntityById(entityId);
      expect(retrieved).toBeDefined();
      expect(retrieved.graphType).toBe('entity');
      expect(retrieved.ontologyType).toBe('kg:CentrifugalPump');
      expect(retrieved.label).toBe('Pump P101');
      expect(retrieved.attributes.operatingPressure).toBe(150);
      expect(retrieved.provenance.confidence).toBe(0.95);
    });

    test('should find entities by filter', async () => {
      const entity1 = {
        ontologyType: 'kg:Tank',
        label: 'Tank T200',
        attributes: { capacity: 1000 },
        provenance: { mentionedIn: ['sentence_2'], confidence: 0.9 }
      };

      const entity2 = {
        ontologyType: 'kg:Tank',
        label: 'Tank T201',
        attributes: { capacity: 500 },
        provenance: { mentionedIn: ['sentence_3'], confidence: 0.85 }
      };

      await store.insertEntity(entity1);
      await store.insertEntity(entity2);

      const tanks = await store.findEntities({ ontologyType: 'kg:Tank' });
      expect(tanks.length).toBeGreaterThanOrEqual(2);
      expect(tanks.every(t => t.ontologyType === 'kg:Tank')).toBe(true);
    });

    test('should update entity', async () => {
      const entity = {
        ontologyType: 'kg:Valve',
        label: 'Valve V100',
        attributes: { status: 'closed' },
        provenance: { mentionedIn: ['sentence_4'], confidence: 0.88 }
      };

      const entityId = await store.insertEntity(entity);

      await store.updateEntity(entityId, {
        attributes: { status: 'open', lastChecked: new Date() }
      });

      const updated = await store.findEntityById(entityId);
      expect(updated.attributes.status).toBe('open');
      expect(updated.attributes.lastChecked).toBeDefined();
    });

    test('should soft delete entity', async () => {
      const entity = {
        ontologyType: 'kg:Sensor',
        label: 'Sensor S100',
        attributes: {},
        provenance: { mentionedIn: ['sentence_5'], confidence: 0.92 }
      };

      const entityId = await store.insertEntity(entity);

      await store.deleteEntity(entityId);

      const deleted = await store.findEntityById(entityId);
      expect(deleted).toBeNull(); // Soft-deleted items not returned by default
    });
  });

  describe('Relationship Operations', () => {
    test('should insert and retrieve relationship', async () => {
      // Create entities first
      const pumpId = await store.insertEntity({
        ontologyType: 'kg:Pump',
        label: 'Pump P102',
        attributes: {},
        provenance: { mentionedIn: ['sentence_6'], confidence: 0.9 }
      });

      const tankId = await store.insertEntity({
        ontologyType: 'kg:Tank',
        label: 'Tank T202',
        attributes: {},
        provenance: { mentionedIn: ['sentence_6'], confidence: 0.9 }
      });

      const relationship = {
        ontologyType: 'kg:connectsTo',
        label: 'connects to',
        from: pumpId,
        to: tankId,
        attributes: { connectionType: 'pipe' },
        provenance: {
          mentionedIn: ['sentence_6'],
          confidence: 0.93
        }
      };

      const relId = await store.insertRelationship(relationship);
      expect(relId).toBeDefined();

      const rels = await store.findRelationships({ _id: relId });
      expect(rels.length).toBe(1);
      expect(rels[0].graphType).toBe('relationship');
      expect(rels[0].from.toString()).toBe(pumpId.toString());
      expect(rels[0].to.toString()).toBe(tankId.toString());
    });

    test('should find relationships from entity', async () => {
      const sourceId = await store.insertEntity({
        ontologyType: 'kg:Motor',
        label: 'Motor M100',
        attributes: {},
        provenance: { mentionedIn: ['sentence_7'], confidence: 0.9 }
      });

      const target1Id = await store.insertEntity({
        ontologyType: 'kg:Gear',
        label: 'Gear G100',
        attributes: {},
        provenance: { mentionedIn: ['sentence_7'], confidence: 0.9 }
      });

      const target2Id = await store.insertEntity({
        ontologyType: 'kg:Shaft',
        label: 'Shaft S100',
        attributes: {},
        provenance: { mentionedIn: ['sentence_7'], confidence: 0.9 }
      });

      await store.insertRelationship({
        ontologyType: 'kg:drives',
        from: sourceId,
        to: target1Id,
        attributes: {},
        provenance: { mentionedIn: ['sentence_7'], confidence: 0.9 }
      });

      await store.insertRelationship({
        ontologyType: 'kg:drives',
        from: sourceId,
        to: target2Id,
        attributes: {},
        provenance: { mentionedIn: ['sentence_7'], confidence: 0.9 }
      });

      const outgoingRels = await store.findRelationshipsFrom(sourceId);
      expect(outgoingRels.length).toBeGreaterThanOrEqual(2);
      expect(outgoingRels.every(r => r.from.toString() === sourceId.toString())).toBe(true);
    });

    test('should find relationships to entity', async () => {
      const targetId = await store.insertEntity({
        ontologyType: 'kg:Controller',
        label: 'Controller C100',
        attributes: {},
        provenance: { mentionedIn: ['sentence_8'], confidence: 0.9 }
      });

      const source1Id = await store.insertEntity({
        ontologyType: 'kg:Sensor',
        label: 'Sensor S101',
        attributes: {},
        provenance: { mentionedIn: ['sentence_8'], confidence: 0.9 }
      });

      await store.insertRelationship({
        ontologyType: 'kg:sendDataTo',
        from: source1Id,
        to: targetId,
        attributes: {},
        provenance: { mentionedIn: ['sentence_8'], confidence: 0.9 }
      });

      const incomingRels = await store.findRelationshipsTo(targetId);
      expect(incomingRels.length).toBeGreaterThanOrEqual(1);
      expect(incomingRels.every(r => r.to.toString() === targetId.toString())).toBe(true);
    });
  });

  describe('Graph Operations', () => {
    test('should find items by mention', async () => {
      const sentenceId = 'sentence_9';

      const entityId = await store.insertEntity({
        ontologyType: 'kg:Heater',
        label: 'Heater H100',
        attributes: {},
        provenance: { mentionedIn: [sentenceId], confidence: 0.9 }
      });

      const items = await store.findByMention(sentenceId);
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.some(item => item._id.toString() === entityId.toString())).toBe(true);
    });

    test('should find items by ontology type', async () => {
      await store.insertEntity({
        ontologyType: 'kg:Compressor',
        label: 'Compressor C100',
        attributes: {},
        provenance: { mentionedIn: ['sentence_10'], confidence: 0.9 }
      });

      await store.insertEntity({
        ontologyType: 'kg:Compressor',
        label: 'Compressor C101',
        attributes: {},
        provenance: { mentionedIn: ['sentence_11'], confidence: 0.9 }
      });

      const compressors = await store.findByType('kg:Compressor');
      expect(compressors.length).toBeGreaterThanOrEqual(2);
      expect(compressors.every(c => c.ontologyType === 'kg:Compressor')).toBe(true);
    });

    test('should get statistics', async () => {
      const stats = await store.getStatistics();
      expect(stats.totalEntities).toBeGreaterThan(0);
      expect(stats.total).toBe(stats.totalEntities + stats.totalRelationships);
      expect(stats.byType).toBeDefined();
    });
  });
});
