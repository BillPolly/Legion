/**
 * Unit tests for MongoDBProvider
 * Tests ITripleStore implementation for MongoDB
 */

import { MongoClient } from 'mongodb';
import { MongoDBProvider } from '../../src/storage/MongoDBProvider.js';

describe('MongoDBProvider', () => {
  let mongoClient;
  let db;
  let collection;
  let provider;

  beforeAll(async () => {
    // Connect to MongoDB (assumes local MongoDB running)
    mongoClient = new MongoClient('mongodb://localhost:27017');
    await mongoClient.connect();
    db = mongoClient.db('test_convfinqa');
  });

  afterAll(async () => {
    await mongoClient.close();
  });

  beforeEach(async () => {
    // Create fresh collection for each test
    collection = db.collection(`triples_${Date.now()}`);
    provider = new MongoDBProvider({
      collection,
      metadata: { type: 'test', runId: 'test-run-1' }
    });
  });

  afterEach(async () => {
    // Drop test collection
    await collection.drop();
  });

  describe('addTriple', () => {
    test('should add a triple to MongoDB', async () => {
      await provider.addTriple('s1', 'p1', 'o1');

      const docs = await collection.find({}).toArray();
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject({
        s: 's1',
        p: 'p1',
        o: 'o1',
        type: 'test',
        runId: 'test-run-1'
      });
      expect(docs[0].createdAt).toBeInstanceOf(Date);
    });

    test('should add multiple triples', async () => {
      await provider.addTriple('s1', 'p1', 'o1');
      await provider.addTriple('s2', 'p2', 'o2');
      await provider.addTriple('s3', 'p3', 'o3');

      const docs = await collection.find({}).toArray();
      expect(docs).toHaveLength(3);
    });

    test('should store metadata with triple', async () => {
      await provider.addTriple('s1', 'p1', 'o1');

      const doc = await collection.findOne({ s: 's1' });
      expect(doc.type).toBe('test');
      expect(doc.runId).toBe('test-run-1');
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Add test triples
      await provider.addTriple('s1', 'rdf:type', 'owl:Class');
      await provider.addTriple('s1', 'rdfs:label', '"Stock Option"');
      await provider.addTriple('s2', 'rdf:type', 'owl:Class');
      await provider.addTriple('s2', 'rdfs:label', '"Pension Plan"');
      await provider.addTriple('kg:SO_2007', 'rdf:type', 's1');
      await provider.addTriple('kg:SO_2007', 'kg:price', 60.94);
    });

    test('should query all triples with null pattern', async () => {
      const results = await provider.query(null, null, null);
      expect(results).toHaveLength(6);
    });

    test('should query by subject', async () => {
      const results = await provider.query('s1', null, null);
      expect(results).toHaveLength(2);
      expect(results).toEqual(expect.arrayContaining([
        ['s1', 'rdf:type', 'owl:Class'],
        ['s1', 'rdfs:label', '"Stock Option"']
      ]));
    });

    test('should query by predicate', async () => {
      const results = await provider.query(null, 'rdf:type', null);
      expect(results).toHaveLength(3);
    });

    test('should query by object', async () => {
      const results = await provider.query(null, null, 'owl:Class');
      expect(results).toHaveLength(2);
    });

    test('should query by subject and predicate', async () => {
      const results = await provider.query('s1', 'rdf:type', null);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['s1', 'rdf:type', 'owl:Class']);
    });

    test('should query exact triple', async () => {
      const results = await provider.query('s1', 'rdf:type', 'owl:Class');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['s1', 'rdf:type', 'owl:Class']);
    });

    test('should return empty array for no matches', async () => {
      const results = await provider.query('nonexistent', null, null);
      expect(results).toEqual([]);
    });

    test('should filter by metadata', async () => {
      // Add triple with different metadata
      const otherProvider = new MongoDBProvider({
        collection,
        metadata: { type: 'other', runId: 'other-run' }
      });
      await otherProvider.addTriple('s99', 'p99', 'o99');

      // Query with original provider should not see other provider's triples
      const results = await provider.query(null, null, null);
      expect(results).toHaveLength(6);  // Original 6 triples only

      // Query with other provider should only see its own
      const otherResults = await otherProvider.query(null, null, null);
      expect(otherResults).toHaveLength(1);
    });
  });

  describe('removeTriple', () => {
    beforeEach(async () => {
      await provider.addTriple('s1', 'p1', 'o1');
      await provider.addTriple('s2', 'p2', 'o2');
    });

    test('should remove a triple', async () => {
      await provider.removeTriple('s1', 'p1', 'o1');

      const results = await provider.query(null, null, null);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['s2', 'p2', 'o2']);
    });

    test('should only remove triples with matching metadata', async () => {
      // Add triple with different metadata
      const otherProvider = new MongoDBProvider({
        collection,
        metadata: { type: 'other' }
      });
      await otherProvider.addTriple('s1', 'p1', 'o1');

      // Remove with original provider
      await provider.removeTriple('s1', 'p1', 'o1');

      // Original provider's triple removed
      const results = await provider.query('s1', 'p1', 'o1');
      expect(results).toHaveLength(0);

      // Other provider's triple still there
      const otherResults = await otherProvider.query('s1', 'p1', 'o1');
      expect(otherResults).toHaveLength(1);
    });
  });

  describe('size', () => {
    test('should return 0 for empty store', async () => {
      const count = await provider.size();
      expect(count).toBe(0);
    });

    test('should return correct count', async () => {
      await provider.addTriple('s1', 'p1', 'o1');
      await provider.addTriple('s2', 'p2', 'o2');
      await provider.addTriple('s3', 'p3', 'o3');

      const count = await provider.size();
      expect(count).toBe(3);
    });

    test('should only count triples with matching metadata', async () => {
      await provider.addTriple('s1', 'p1', 'o1');

      // Add triple with different metadata
      const otherProvider = new MongoDBProvider({
        collection,
        metadata: { type: 'other' }
      });
      await otherProvider.addTriple('s2', 'p2', 'o2');

      const count = await provider.size();
      expect(count).toBe(1);
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await provider.addTriple('s1', 'p1', 'o1');
      await provider.addTriple('s2', 'p2', 'o2');
    });

    test('should clear all triples', async () => {
      await provider.clear();

      const count = await provider.size();
      expect(count).toBe(0);
    });

    test('should only clear triples with matching metadata', async () => {
      // Add triple with different metadata
      const otherProvider = new MongoDBProvider({
        collection,
        metadata: { type: 'other' }
      });
      await otherProvider.addTriple('s99', 'p99', 'o99');

      // Clear original provider
      await provider.clear();

      // Original triples cleared
      const count = await provider.size();
      expect(count).toBe(0);

      // Other provider's triple still there
      const otherCount = await otherProvider.size();
      expect(otherCount).toBe(1);
    });
  });

  describe('getMetadata', () => {
    test('should return metadata', () => {
      const metadata = provider.getMetadata();
      expect(metadata).toMatchObject({
        metadata: {
          type: 'test',
          runId: 'test-run-1'
        },
        type: 'mongodb'
      });
      expect(metadata.collectionName).toBeDefined();
      expect(metadata.dbName).toBeDefined();
    });
  });
});
