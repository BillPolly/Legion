/**
 * MongoTripleStore Integration Test
 *
 * Demonstrates that RDF triples persist in MongoDB instead of in-memory.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoTripleStore } from '../../src/stores/MongoTripleStore.js';

describe('MongoTripleStore Integration', () => {
  let mongoServer;
  let connectionString;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    connectionString = mongoServer.getUri();
  }, 60000);

  afterAll(async () => {
    if (mongoServer) await mongoServer.stop();
  });

  test('should store and query triples in MongoDB', async () => {
    const store = new MongoTripleStore({
      connectionString,
      database: 'test-triples',
      collection: 'triples'
    });

    await store.connect();

    // Add some triples
    await store.add('kg:WaterHeater', 'rdf:type', 'owl:Class');
    await store.add('kg:WaterHeater', 'rdfs:label', '"Water Heater"');
    await store.add('kg:WaterHeater', 'rdfs:subClassOf', 'kg:PhysicalEntity');

    // Query all triples about WaterHeater
    const results = await store.query('kg:WaterHeater', null, null);
    expect(results.length).toBe(3);

    // Query specific predicate
    const typeTriples = await store.query('kg:WaterHeater', 'rdf:type', null);
    expect(typeTriples.length).toBe(1);
    expect(typeTriples[0]).toEqual(['kg:WaterHeater', 'rdf:type', 'owl:Class']);

    // Query by object
    const classesQuery = await store.query(null, 'rdf:type', 'owl:Class');
    expect(classesQuery.length).toBe(1);
    expect(classesQuery[0][0]).toBe('kg:WaterHeater');

    await store.disconnect();
  }, 10000);

  test('should persist triples across disconnect/reconnect', async () => {
    const dbName = 'persistence-test';
    const collectionName = 'triples';

    // First connection - add triples
    const store1 = new MongoTripleStore({
      connectionString,
      database: dbName,
      collection: collectionName
    });

    await store1.connect();
    await store1.clear(); // Clear any previous data

    await store1.add('kg:Pump', 'rdf:type', 'owl:Class');
    await store1.add('kg:Pump', 'rdfs:label', '"Pump"');
    await store1.add('kg:Pump', 'rdfs:subClassOf', 'kg:PhysicalEntity');

    const count1 = await store1.count();
    expect(count1).toBe(3);

    await store1.disconnect();

    // Second connection - verify triples persist
    const store2 = new MongoTripleStore({
      connectionString,
      database: dbName,
      collection: collectionName
    });

    await store2.connect();

    const count2 = await store2.count();
    expect(count2).toBe(3);

    const results = await store2.query('kg:Pump', null, null);
    expect(results.length).toBe(3);

    const labels = await store2.query('kg:Pump', 'rdfs:label', null);
    expect(labels[0][2]).toBe('"Pump"');

    await store2.disconnect();
  }, 10000);

  test('should handle duplicate triples gracefully', async () => {
    const store = new MongoTripleStore({
      connectionString,
      database: 'duplicate-test',
      collection: 'triples'
    });

    await store.connect();
    await store.clear();

    // Add same triple twice
    await store.add('kg:Valve', 'rdf:type', 'owl:Class');
    await store.add('kg:Valve', 'rdf:type', 'owl:Class'); // Duplicate

    const results = await store.query('kg:Valve', 'rdf:type', 'owl:Class');
    expect(results.length).toBe(1); // Should only have one

    await store.disconnect();
  }, 10000);

  test('should remove triples correctly', async () => {
    const store = new MongoTripleStore({
      connectionString,
      database: 'remove-test',
      collection: 'triples'
    });

    await store.connect();
    await store.clear();

    await store.add('kg:Tank', 'rdf:type', 'owl:Class');
    await store.add('kg:Tank', 'rdfs:label', '"Tank"');
    await store.add('kg:Tank', 'rdfs:subClassOf', 'kg:PhysicalEntity');

    let count = await store.count();
    expect(count).toBe(3);

    // Remove one triple
    await store.remove('kg:Tank', 'rdfs:label', '"Tank"');

    count = await store.count();
    expect(count).toBe(2);

    const labels = await store.query('kg:Tank', 'rdfs:label', null);
    expect(labels.length).toBe(0);

    await store.disconnect();
  }, 10000);

  test('should remove triples by pattern', async () => {
    const store = new MongoTripleStore({
      connectionString,
      database: 'pattern-test',
      collection: 'triples'
    });

    await store.connect();
    await store.clear();

    await store.add('kg:Heater1', 'rdf:type', 'kg:WaterHeater');
    await store.add('kg:Heater2', 'rdf:type', 'kg:WaterHeater');
    await store.add('kg:Pump1', 'rdf:type', 'kg:Pump');

    let count = await store.count();
    expect(count).toBe(3);

    // Remove all WaterHeater instances
    await store.removePattern(null, 'rdf:type', 'kg:WaterHeater');

    count = await store.count();
    expect(count).toBe(1);

    const remaining = await store.getAll();
    expect(remaining[0]).toEqual(['kg:Pump1', 'rdf:type', 'kg:Pump']);

    await store.disconnect();
  }, 10000);

  test('should support subscriptions to changes', async () => {
    const store = new MongoTripleStore({
      connectionString,
      database: 'subscription-test',
      collection: 'triples'
    });

    await store.connect();
    await store.clear();

    let notificationCount = 0;
    const subscriptionId = store.subscribe(() => {
      notificationCount++;
    });

    // Add triple - should trigger notification
    await store.add('kg:Pipe', 'rdf:type', 'owl:Class');
    expect(notificationCount).toBe(1);

    // Remove triple - should trigger notification
    await store.remove('kg:Pipe', 'rdf:type', 'owl:Class');
    expect(notificationCount).toBe(2);

    // Clear - should trigger notification
    await store.clear();
    expect(notificationCount).toBe(3);

    store.unsubscribe(subscriptionId);

    // Add after unsubscribe - should NOT trigger notification
    await store.add('kg:Valve', 'rdf:type', 'owl:Class');
    expect(notificationCount).toBe(3);

    await store.disconnect();
  }, 10000);

  test('should provide statistics about stored triples', async () => {
    const store = new MongoTripleStore({
      connectionString,
      database: 'stats-test',
      collection: 'triples'
    });

    await store.connect();
    await store.clear();

    // Add various triples
    await store.add('kg:WaterHeater', 'rdf:type', 'owl:Class');
    await store.add('kg:Pump', 'rdf:type', 'owl:Class');
    await store.add('kg:HeatingProcess', 'rdf:type', 'owl:Class');

    await store.add('kg:WaterHeater', 'rdf:type', 'owl:Class'); // Duplicate (ignored)
    await store.add('kg:Pump', 'rdf:type', 'owl:Class'); // Duplicate (ignored)

    await store.add('kg:heats', 'rdf:type', 'owl:ObjectProperty');
    await store.add('kg:requiresPrecondition', 'rdf:type', 'owl:ObjectProperty');

    const stats = await store.getStatistics();

    expect(stats.totalTriples).toBe(5); // 3 classes + 2 properties
    expect(stats.classes).toBe(3);
    expect(stats.objectProperties).toBe(2);
    expect(stats.byPredicate['rdf:type']).toBe(5);

    await store.disconnect();
  }, 10000);
});
