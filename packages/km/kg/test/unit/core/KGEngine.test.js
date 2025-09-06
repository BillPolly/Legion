/**
 * Unit tests for KGEngine - Core triple storage and querying
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { KGEngine } from '../../../src/core/KGEngine.js';
import { sampleTriples } from '../../fixtures/test-data.js';

describe('KGEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new KGEngine();
  });

  describe('Triple Storage', () => {
    test('should add triples successfully', async () => {
      const result = engine.addTriple('subject', 'predicate', 'object');
      expect(result).toBe(true);
      const size = await engine.size();
      expect(size).toBe(1);
    });

    test('should not add duplicate triples', async () => {
      engine.addTriple('subject', 'predicate', 'object');
      const result = engine.addTriple('subject', 'predicate', 'object');
      expect(result).toBe(false);
      const size = await engine.size();
      expect(size).toBe(1);
    });

    test('should remove triples successfully', async () => {
      engine.addTriple('subject', 'predicate', 'object');
      const result = engine.removeTriple('subject', 'predicate', 'object');
      expect(result).toBe(true);
      const size = await engine.size();
      expect(size).toBe(0);
    });

    test('should return false when removing non-existent triple', () => {
      const result = engine.removeTriple('subject', 'predicate', 'object');
      expect(result).toBe(false);
    });

    test('should handle multiple triples', async () => {
      sampleTriples.forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
      const size = await engine.size();
      expect(size).toBe(sampleTriples.length);
    });
  });

  describe('Exact Queries', () => {
    beforeEach(() => {
      sampleTriples.forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
    });

    test('should find exact matches', () => {
      const results = engine.query('john_123', 'name', 'John');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['john_123', 'name', 'John']);
    });

    test('should return empty array for non-existent triple', () => {
      const results = engine.query('nonexistent', 'predicate', 'object');
      expect(results).toHaveLength(0);
    });
  });

  describe('Pattern Queries', () => {
    beforeEach(() => {
      sampleTriples.forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
    });

    test('should query by subject (s ? ?)', () => {
      const results = engine.query('john_123', null, null);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([s]) => {
        expect(s).toBe('john_123');
      });
    });

    test('should query by predicate (? p ?)', () => {
      const results = engine.query(null, 'rdf:type', null);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([, p]) => {
        expect(p).toBe('rdf:type');
      });
    });

    test('should query by object (? ? o)', () => {
      const results = engine.query(null, null, 'Person');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([, , o]) => {
        expect(o).toBe('Person');
      });
    });

    test('should query subject-predicate (s p ?)', () => {
      const results = engine.query('john_123', 'name', null);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['john_123', 'name', 'John']);
    });

    test('should query subject-object (s ? o)', () => {
      const results = engine.query('john_123', null, 'Person');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['john_123', 'rdf:type', 'Person']);
    });

    test('should query predicate-object (? p o)', () => {
      const results = engine.query(null, 'rdf:type', 'Person');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([, p, o]) => {
        expect(p).toBe('rdf:type');
        expect(o).toBe('Person');
      });
    });

    test('should return all triples with wildcard query (? ? ?)', () => {
      const results = engine.query(null, null, null);
      expect(results).toHaveLength(sampleTriples.length);
    });
  });

  describe('Query Pattern Array', () => {
    beforeEach(() => {
      sampleTriples.forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
    });

    test('should handle array pattern with nulls', () => {
      const results = engine.queryPattern(['john_123', null, null]);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([s]) => {
        expect(s).toBe('john_123');
      });
    });

    test('should handle array pattern with question marks', () => {
      const results = engine.queryPattern(['?', 'name', '?']);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([, p]) => {
        expect(p).toBe('name');
      });
    });

    test('should handle mixed null and question mark patterns', () => {
      const results = engine.queryPattern(['john_123', '?', null]);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([s]) => {
        expect(s).toBe('john_123');
      });
    });
  });

  describe('Indexing Performance', () => {
    test('should maintain indices correctly', () => {
      engine.addTriple('s1', 'p1', 'o1');
      engine.addTriple('s1', 'p2', 'o2');
      engine.addTriple('s2', 'p1', 'o1');

      // Test that queries work correctly (indicating proper indexing)
      const s1Results = engine.query('s1', null, null);
      expect(s1Results).toHaveLength(2);
      
      const p1Results = engine.query(null, 'p1', null);
      expect(p1Results).toHaveLength(2);
      
      const o1Results = engine.query(null, null, 'o1');
      expect(o1Results).toHaveLength(2);
    });

    test('should clean up indices when removing triples', () => {
      engine.addTriple('s1', 'p1', 'o1');
      engine.removeTriple('s1', 'p1', 'o1');

      // Indices should be cleaned up (though empty structures may remain)
      const sResults = engine.query('s1', null, null);
      const pResults = engine.query(null, 'p1', null);
      const oResults = engine.query(null, null, 'o1');

      expect(sResults).toHaveLength(0);
      expect(pResults).toHaveLength(0);
      expect(oResults).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty strings', () => {
      engine.addTriple('', '', '');
      const results = engine.query('', '', '');
      expect(results).toHaveLength(1);
    });

    test('should handle special characters', () => {
      engine.addTriple('subject@#$', 'predicate%^&', 'object*()');
      const results = engine.query('subject@#$', 'predicate%^&', 'object*()');
      expect(results).toHaveLength(1);
    });

    test('should handle unicode characters', () => {
      engine.addTriple('José', 'habla', 'español');
      const results = engine.query('José', 'habla', 'español');
      expect(results).toHaveLength(1);
    });

    test('should handle numbers as strings', () => {
      engine.addTriple('subject', 'age', '30');
      const results = engine.query('subject', 'age', '30');
      expect(results).toHaveLength(1);
    });

    test('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      engine.addTriple(longString, 'predicate', 'object');
      const results = engine.query(longString, 'predicate', 'object');
      expect(results).toHaveLength(1);
    });
  });

  describe('Performance with Large Datasets', () => {
    test('should handle 1000 triples efficiently', async () => {
      const start = Date.now();
      
      // Add 1000 triples
      for (let i = 0; i < 1000; i++) {
        engine.addTriple(`subject_${i}`, `predicate_${i % 10}`, `object_${i % 100}`);
      }
      
      const addTime = Date.now() - start;
      expect(addTime).toBeLessThan(1000); // Should take less than 1 second
      
      const size = await engine.size();
      expect(size).toBe(1000);

      // Test query performance
      const queryStart = Date.now();
      const results = engine.query(null, 'predicate_5', null);
      const queryTime = Date.now() - queryStart;
      
      expect(queryTime).toBeLessThan(100); // Should take less than 100ms
      expect(results.length).toBe(100); // Should find 100 matches
    });

    test('should handle complex query patterns on large dataset', () => {
      // Add structured data
      for (let i = 0; i < 500; i++) {
        engine.addTriple(`person_${i}`, 'rdf:type', 'Person');
        engine.addTriple(`person_${i}`, 'name', `Person ${i}`);
        engine.addTriple(`person_${i}`, 'age', `${20 + (i % 50)}`);
        if (i % 10 === 0) {
          engine.addTriple(`person_${i}`, 'role', 'manager');
        }
      }

      const start = Date.now();
      const managers = engine.query(null, 'role', 'manager');
      const queryTime = Date.now() - start;

      expect(queryTime).toBeLessThan(50); // Should be very fast
      expect(managers).toHaveLength(50); // Should find 50 managers
    });
  });

  describe('Memory Management', () => {
    test('should not leak memory when adding and removing many triples', async () => {
      const initialSize = await engine.size();
      
      // Add many triples
      for (let i = 0; i < 1000; i++) {
        engine.addTriple(`temp_${i}`, 'temp_pred', 'temp_obj');
      }
      
      const sizeAfterAdd = await engine.size();
      expect(sizeAfterAdd).toBe(initialSize + 1000);
      
      // Remove all temp triples
      for (let i = 0; i < 1000; i++) {
        engine.removeTriple(`temp_${i}`, 'temp_pred', 'temp_obj');
      }
      
      const finalSize = await engine.size();
      expect(finalSize).toBe(initialSize);
    });
  });
});
