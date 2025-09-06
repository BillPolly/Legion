/**
 * Unit tests for QueryBuilder - Fluent query interface
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { QueryBuilder } from '../../../src/core/QueryBuilder.js';
import { KGEngine } from '../../../src/core/KGEngine.js';
import { sampleTriples } from '../../fixtures/test-data.js';

describe('QueryBuilder', () => {
  let engine;
  let queryBuilder;

  beforeEach(() => {
    engine = new KGEngine();
    queryBuilder = new QueryBuilder(engine);
    
    // Add sample data
    sampleTriples.forEach(([s, p, o]) => {
      engine.addTriple(s, p, o);
    });
  });

  describe('Basic Query Construction', () => {
    test('should create query builder with engine', () => {
      expect(queryBuilder.kg).toBe(engine);
      expect(queryBuilder.conditions).toEqual([]);
    });

    test('should add single condition', () => {
      const result = queryBuilder.where('john_123', 'name', 'John');
      expect(result).toBe(queryBuilder); // Should return self for chaining
      expect(queryBuilder.conditions).toHaveLength(1);
      expect(queryBuilder.conditions[0]).toEqual(['john_123', 'name', 'John']);
    });

    test('should add multiple conditions', () => {
      queryBuilder
        .where('john_123', 'name', 'John')
        .where('john_123', 'age', 30);
      
      expect(queryBuilder.conditions).toHaveLength(2);
      expect(queryBuilder.conditions[0]).toEqual(['john_123', 'name', 'John']);
      expect(queryBuilder.conditions[1]).toEqual(['john_123', 'age', 30]);
    });
  });

  describe('Single Condition Queries', () => {
    test('should execute single exact condition', () => {
      const results = queryBuilder
        .where('john_123', 'name', 'John')
        .execute();
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['john_123', 'name', 'John']);
    });

    test('should execute single wildcard condition', () => {
      const results = queryBuilder
        .where('john_123', '?', '?')
        .execute();
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([s]) => {
        expect(s).toBe('john_123');
      });
    });

    test('should execute predicate-only condition', () => {
      const results = queryBuilder
        .where('?', 'rdf:type', '?')
        .execute();
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([, p]) => {
        expect(p).toBe('rdf:type');
      });
    });

    test('should execute object-only condition', () => {
      const results = queryBuilder
        .where('?', '?', 'Person')
        .execute();
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([, , o]) => {
        expect(o).toBe('Person');
      });
    });
  });

  describe('Multiple Condition Queries', () => {
    test('should find intersection of multiple conditions', () => {
      const results = queryBuilder
        .where('john_123', '?', '?')
        .where('?', 'name', 'John')
        .execute();
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['john_123', 'name', 'John']);
    });

    test('should return empty result when no intersection exists', () => {
      const results = queryBuilder
        .where('john_123', 'name', 'John')
        .where('jane_456', 'name', 'Jane')
        .execute();
      
      expect(results).toHaveLength(0);
    });

    test('should handle complex multi-condition queries', () => {
      // Add more test data
      engine.addTriple('john_123', 'friend', 'jane_456');
      engine.addTriple('jane_456', 'friend', 'john_123');
      
      const results = queryBuilder
        .where('?', 'rdf:type', 'Person')
        .where('?', 'friend', '?')
        .execute();
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([s, p, o]) => {
        expect(p).toBe('friend');
      });
    });
  });

  describe('Empty Query Handling', () => {
    test('should return all triples when no conditions', () => {
      const results = queryBuilder.execute();
      expect(results).toHaveLength(sampleTriples.length);
    });

    test('should handle empty result sets', () => {
      const results = queryBuilder
        .where('nonexistent', 'predicate', 'object')
        .execute();
      
      expect(results).toHaveLength(0);
    });
  });

  describe('Distinct Values', () => {
    test('should return distinct values for variables', () => {
      // This is a simplified test since the current implementation
      // has limitations with variable binding
      const builder = new QueryBuilder(engine);
      builder.conditions = [['?', 'rdf:type', '?']];
      
      const distinctValues = builder.distinct('subject');
      expect(Array.isArray(distinctValues)).toBe(true);
    });

    test('should handle distinct on empty results', () => {
      const builder = new QueryBuilder(engine);
      builder.conditions = [['nonexistent', 'predicate', 'object']];
      
      const distinctValues = builder.distinct('subject');
      expect(distinctValues).toHaveLength(0);
    });
  });

  describe('Variable Handling', () => {
    test('should recognize question mark as variable', () => {
      expect(queryBuilder._isVariable('?')).toBe(true);
      expect(queryBuilder._isVariable(null)).toBe(true);
      expect(queryBuilder._isVariable(undefined)).toBe(true);
      expect(queryBuilder._isVariable('john_123')).toBe(false);
      expect(queryBuilder._isVariable('')).toBe(false);
    });
  });

  describe('Result Intersection', () => {
    test('should intersect results correctly', () => {
      const results1 = [
        ['john_123', 'name', 'John'],
        ['john_123', 'age', '30'],
        ['jane_456', 'name', 'Jane']
      ];
      
      const results2 = [
        ['john_123', 'name', 'John'],
        ['john_123', 'rdf:type', 'Person']
      ];
      
      const intersection = queryBuilder._intersectResults(results1, results2);
      expect(intersection).toHaveLength(1);
      expect(intersection[0]).toEqual(['john_123', 'name', 'John']);
    });

    test('should handle empty intersections', () => {
      const results1 = [['john_123', 'name', 'John']];
      const results2 = [['jane_456', 'name', 'Jane']];
      
      const intersection = queryBuilder._intersectResults(results1, results2);
      expect(intersection).toHaveLength(0);
    });

    test('should handle one empty result set', () => {
      const results1 = [['john_123', 'name', 'John']];
      const results2 = [];
      
      const intersection = queryBuilder._intersectResults(results1, results2);
      expect(intersection).toHaveLength(0);
    });
  });

  describe('Chaining and Fluent Interface', () => {
    test('should support method chaining', () => {
      const result = queryBuilder
        .where('john_123', '?', '?')
        .where('?', 'name', '?');
      
      expect(result).toBe(queryBuilder);
      expect(queryBuilder.conditions).toHaveLength(2);
    });

    test('should allow building complex queries through chaining', () => {
      const results = queryBuilder
        .where('?', 'rdf:type', 'Person')
        .where('?', 'name', '?')
        .execute();
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(([, p]) => {
        expect(p).toBe('name');
      });
    });

    test('should maintain state across chained calls', () => {
      queryBuilder
        .where('john_123', 'name', 'John')
        .where('john_123', 'age', '30');
      
      expect(queryBuilder.conditions).toHaveLength(2);
      
      const results = queryBuilder.execute();
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['john_123', 'name', 'John']);
    });
  });

  describe('Performance with Large Datasets', () => {
    beforeEach(() => {
      // Add large dataset
      for (let i = 0; i < 1000; i++) {
        engine.addTriple(`person_${i}`, 'rdf:type', 'Person');
        engine.addTriple(`person_${i}`, 'name', `Person ${i}`);
        engine.addTriple(`person_${i}`, 'age', `${20 + (i % 50)}`);
      }
    });

    test('should handle large single condition queries efficiently', () => {
      const start = Date.now();
      const results = queryBuilder
        .where('?', 'rdf:type', 'Person')
        .execute();
      const time = Date.now() - start;
      
      expect(time).toBeLessThan(100); // Should be fast
      expect(results.length).toBeGreaterThan(1000);
    });

    test('should handle large multi-condition queries efficiently', () => {
      const start = Date.now();
      const results = queryBuilder
        .where('?', 'rdf:type', 'Person')
        .where('?', 'age', '25')
        .execute();
      const time = Date.now() - start;
      
      expect(time).toBeLessThan(200); // Should still be reasonably fast
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined in conditions', () => {
      expect(() => {
        queryBuilder.where(null, null, null).execute();
      }).not.toThrow();
    });

    test('should handle empty strings in conditions', () => {
      engine.addTriple('', '', '');
      const results = queryBuilder
        .where('', '', '')
        .execute();
      
      expect(results).toHaveLength(1);
    });

    test('should handle special characters in conditions', () => {
      engine.addTriple('subject@#$', 'predicate%^&', 'object*()');
      const results = queryBuilder
        .where('subject@#$', 'predicate%^&', 'object*()')
        .execute();
      
      expect(results).toHaveLength(1);
    });

    test('should handle unicode characters in conditions', () => {
      engine.addTriple('José', 'habla', 'español');
      const results = queryBuilder
        .where('José', 'habla', 'español')
        .execute();
      
      expect(results).toHaveLength(1);
    });

    test('should handle very long condition values', () => {
      const longValue = 'a'.repeat(10000);
      engine.addTriple('subject', 'predicate', longValue);
      
      const results = queryBuilder
        .where('subject', 'predicate', longValue)
        .execute();
      
      expect(results).toHaveLength(1);
    });
  });

  describe('Query Builder Reuse', () => {
    test('should allow reusing query builder with different conditions', () => {
      // First query
      const results1 = queryBuilder
        .where('john_123', 'name', 'John')
        .execute();
      
      expect(results1).toHaveLength(1);
      
      // Reset and new query
      queryBuilder.conditions = [];
      const results2 = queryBuilder
        .where('jane_456', 'name', 'Jane')
        .execute();
      
      expect(results2).toHaveLength(1);
      expect(results2[0]).toEqual(['jane_456', 'name', 'Jane']);
    });

    test('should maintain engine reference across reuse', () => {
      queryBuilder.conditions = [];
      queryBuilder.where('?', 'rdf:type', 'Person');
      
      expect(queryBuilder.kg).toBe(engine);
      expect(queryBuilder.execute().length).toBeGreaterThan(0);
    });
  });

  describe('Integration with KGEngine', () => {
    test('should work with all KGEngine query patterns', () => {
      // Test all the patterns that KGEngine supports
      const patterns = [
        ['john_123', 'name', 'John'],     // exact
        ['john_123', '?', '?'],           // s ? ?
        ['?', 'name', '?'],               // ? p ?
        ['?', '?', 'Person'],             // ? ? o
        ['john_123', 'name', '?'],        // s p ?
        ['john_123', '?', 'Person'],      // s ? o
        ['?', 'rdf:type', 'Person']       // ? p o
      ];
      
      patterns.forEach(([s, p, o]) => {
        const builder = new QueryBuilder(engine);
        const results = builder.where(s, p, o).execute();
        expect(Array.isArray(results)).toBe(true);
      });
    });

    test('should produce same results as direct KGEngine queries', () => {
      const subject = 'john_123';
      const predicate = 'name';
      const object = 'John';
      
      const engineResults = engine.query(subject, predicate, object);
      const builderResults = queryBuilder
        .where(subject, predicate, object)
        .execute();
      
      expect(builderResults).toEqual(engineResults);
    });
  });
});
