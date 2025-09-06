import { InMemoryTripleStore } from '../../src/storage/InMemoryTripleStore.js';

describe('InMemoryTripleStore', () => {
  let store;

  beforeEach(() => {
    store = new InMemoryTripleStore();
  });

  describe('Basic Operations', () => {
    test('should add triples correctly', async () => {
      const result = await store.addTriple('s1', 'p1', 'o1');
      expect(result).toBe(true);
      
      const size = await store.size();
      expect(size).toBe(1);
    });

    test('should detect duplicate triples', async () => {
      await store.addTriple('s1', 'p1', 'o1');
      const result = await store.addTriple('s1', 'p1', 'o1');
      expect(result).toBe(false);
      
      const size = await store.size();
      expect(size).toBe(1);
    });

    test('should remove triples correctly', async () => {
      await store.addTriple('s1', 'p1', 'o1');
      const result = await store.removeTriple('s1', 'p1', 'o1');
      expect(result).toBe(true);
      
      const size = await store.size();
      expect(size).toBe(0);
    });

    test('should handle non-existent triple removal', async () => {
      const result = await store.removeTriple('s1', 'p1', 'o1');
      expect(result).toBe(false);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await store.addTriple('s1', 'p1', 'o1');
      await store.addTriple('s1', 'p2', 'o2');
      await store.addTriple('s2', 'p1', 'o3');
      await store.addTriple('s2', 'p2', 'o4');
    });

    test('should handle exact queries', async () => {
      const results = await store.query('s1', 'p1', 'o1');
      expect(results).toEqual([['s1', 'p1', 'o1']]);
    });

    test('should handle subject-predicate queries', async () => {
      const results = await store.query('s1', 'p1', null);
      expect(results).toEqual([['s1', 'p1', 'o1']]);
    });

    test('should handle subject-object queries', async () => {
      const results = await store.query('s1', null, 'o2');
      expect(results).toEqual([['s1', 'p2', 'o2']]);
    });

    test('should handle predicate-object queries', async () => {
      const results = await store.query(null, 'p1', 'o1');
      expect(results).toEqual([['s1', 'p1', 'o1']]);
    });

    test('should handle subject wildcard queries', async () => {
      const results = await store.query('s1', null, null);
      expect(results).toHaveLength(2);
      expect(results).toContainEqual(['s1', 'p1', 'o1']);
      expect(results).toContainEqual(['s1', 'p2', 'o2']);
    });

    test('should handle predicate wildcard queries', async () => {
      const results = await store.query(null, 'p1', null);
      expect(results).toHaveLength(2);
      expect(results).toContainEqual(['s1', 'p1', 'o1']);
      expect(results).toContainEqual(['s2', 'p1', 'o3']);
    });

    test('should handle object wildcard queries', async () => {
      const results = await store.query(null, null, 'o1');
      expect(results).toEqual([['s1', 'p1', 'o1']]);
    });

    test('should handle full wildcard queries', async () => {
      const results = await store.query(null, null, null);
      expect(results).toHaveLength(4);
    });
  });

  describe('Type Preservation', () => {
    test('should preserve number types', async () => {
      await store.addTriple('s1', 'p1', 42);
      const results = await store.query('s1', 'p1', null);
      expect(typeof results[0][2]).toBe('number');
      expect(results[0][2]).toBe(42);
    });

    test('should preserve boolean types', async () => {
      await store.addTriple('s1', 'p1', true);
      await store.addTriple('s1', 'p2', false);
      
      const results = await store.query('s1', null, null);
      const trueResult = results.find(([,p]) => p === 'p1');
      const falseResult = results.find(([,p]) => p === 'p2');
      
      expect(typeof trueResult[2]).toBe('boolean');
      expect(trueResult[2]).toBe(true);
      expect(typeof falseResult[2]).toBe('boolean');
      expect(falseResult[2]).toBe(false);
    });

    test('should preserve null values', async () => {
      await store.addTriple('s1', 'p1', null);
      const results = await store.query('s1', 'p1', null);
      expect(results[0][2]).toBe(null);
    });

    test('should preserve string types', async () => {
      await store.addTriple('s1', 'p1', 'test string');
      const results = await store.query('s1', 'p1', null);
      expect(typeof results[0][2]).toBe('string');
      expect(results[0][2]).toBe('test string');
    });
  });

  describe('Batch Operations', () => {
    test('should add multiple triples', async () => {
      const triples = [
        ['s1', 'p1', 'o1'],
        ['s2', 'p2', 'o2'],
        ['s3', 'p3', 'o3']
      ];
      
      const count = await store.addTriples(triples);
      expect(count).toBe(3);
      
      const size = await store.size();
      expect(size).toBe(3);
    });

    test('should handle duplicate triples in batch', async () => {
      const triples = [
        ['s1', 'p1', 'o1'],
        ['s1', 'p1', 'o1'], // duplicate
        ['s2', 'p2', 'o2']
      ];
      
      const count = await store.addTriples(triples);
      expect(count).toBe(2); // Only 2 unique triples added
      
      const size = await store.size();
      expect(size).toBe(2);
    });

    test('should remove multiple triples', async () => {
      const triples = [
        ['s1', 'p1', 'o1'],
        ['s2', 'p2', 'o2'],
        ['s3', 'p3', 'o3']
      ];
      
      await store.addTriples(triples);
      const count = await store.removeTriples(triples);
      expect(count).toBe(3);
      
      const size = await store.size();
      expect(size).toBe(0);
    });
  });

  describe('Backward Compatibility', () => {
    test('should support synchronous operations', () => {
      const result = store.addTripleSync('s1', 'p1', 'o1');
      expect(result).toBe(true);
      
      const queryResult = store.querySync('s1', 'p1', 'o1');
      expect(queryResult).toEqual([['s1', 'p1', 'o1']]);
      
      const removeResult = store.removeTripleSync('s1', 'p1', 'o1');
      expect(removeResult).toBe(true);
    });

    test('should support query pattern sync', () => {
      store.addTripleSync('s1', 'p1', 'o1');
      const result = store.queryPatternSync(['s1', 'p1', '?']);
      expect(result).toEqual([['s1', 'p1', 'o1']]);
    });
  });

  describe('Metadata', () => {
    test('should return correct metadata', () => {
      const metadata = store.getMetadata();
      expect(metadata.type).toBe('memory');
      expect(metadata.supportsTransactions).toBe(false);
      expect(metadata.supportsPersistence).toBe(false);
      expect(metadata.supportsAsync).toBe(true);
    });
  });

  describe('Utility Operations', () => {
    test('should check if triple exists', async () => {
      await store.addTriple('s1', 'p1', 'o1');
      
      const exists = await store.exists('s1', 'p1', 'o1');
      expect(exists).toBe(true);
      
      const notExists = await store.exists('s1', 'p1', 'o2');
      expect(notExists).toBe(false);
    });

    test('should clear all triples', async () => {
      await store.addTriple('s1', 'p1', 'o1');
      await store.addTriple('s2', 'p2', 'o2');
      
      await store.clear();
      
      const size = await store.size();
      expect(size).toBe(0);
    });
  });
});
