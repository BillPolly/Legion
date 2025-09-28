import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryProvider } from '../../src/providers/InMemoryProvider.js';

/**
 * Integration tests for InMemoryProvider
 * 
 * These tests verify complete workflows without mocks.
 * They test realistic scenarios that combine multiple operations.
 */
describe('InMemoryProvider Integration Tests', () => {
  let provider;

  beforeEach(() => {
    provider = new InMemoryProvider();
  });

  describe('Knowledge Graph Building', () => {
    it('should build a simple user knowledge graph', async () => {
      // Build a knowledge graph about users
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:1', 'hasEmail', 'alice@example.com');
      await provider.addTriple('user:1', 'livesIn', 'city:nyc');
      
      await provider.addTriple('user:2', 'hasName', 'Bob');
      await provider.addTriple('user:2', 'hasAge', 25);
      await provider.addTriple('user:2', 'livesIn', 'city:sf');
      
      await provider.addTriple('city:nyc', 'hasName', 'New York City');
      await provider.addTriple('city:sf', 'hasName', 'San Francisco');
      
      // Verify the graph
      const size = await provider.size();
      expect(size).toBe(9);
      
      // Query user facts
      const aliceFacts = await provider.query('user:1', null, null);
      expect(aliceFacts).toHaveLength(4);
      
      // Query city names
      const cities = await provider.query(null, 'hasName', null);
      expect(cities.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle relationship triples', async () => {
      // Build a social graph
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:2', 'hasName', 'Bob');
      await provider.addTriple('user:3', 'hasName', 'Charlie');
      
      await provider.addTriple('user:1', 'knows', 'user:2');
      await provider.addTriple('user:1', 'knows', 'user:3');
      await provider.addTriple('user:2', 'knows', 'user:3');
      
      // Find who Alice knows
      const aliceKnows = await provider.query('user:1', 'knows', null);
      expect(aliceKnows).toHaveLength(2);
      expect(aliceKnows.map(t => t[2])).toContain('user:2');
      expect(aliceKnows.map(t => t[2])).toContain('user:3');
      
      // Find who knows Charlie
      const knowsCharlie = await provider.query(null, 'knows', 'user:3');
      expect(knowsCharlie).toHaveLength(2);
      expect(knowsCharlie.map(t => t[0])).toContain('user:1');
      expect(knowsCharlie.map(t => t[0])).toContain('user:2');
    });
  });

  describe('Dynamic Graph Updates', () => {
    it('should handle adding and removing triples dynamically', async () => {
      // Initial state
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:1', 'hasAge', 30);
      
      let size = await provider.size();
      expect(size).toBe(2);
      
      // Update age (remove old, add new)
      await provider.removeTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:1', 'hasAge', 31);
      
      size = await provider.size();
      expect(size).toBe(2);
      
      // Verify new age
      const ageTriples = await provider.query('user:1', 'hasAge', null);
      expect(ageTriples[0][2]).toBe(31);
    });

    it('should handle batch operations correctly', async () => {
      // Add multiple users
      const users = [
        ['user:1', 'hasName', 'Alice'],
        ['user:2', 'hasName', 'Bob'],
        ['user:3', 'hasName', 'Charlie'],
        ['user:4', 'hasName', 'David'],
        ['user:5', 'hasName', 'Eve']
      ];
      
      for (const [s, p, o] of users) {
        await provider.addTriple(s, p, o);
      }
      
      let size = await provider.size();
      expect(size).toBe(5);
      
      // Remove some users
      await provider.removeTriple('user:2', 'hasName', 'Bob');
      await provider.removeTriple('user:4', 'hasName', 'David');
      
      size = await provider.size();
      expect(size).toBe(3);
      
      // Verify remaining users
      const remaining = await provider.query(null, 'hasName', null);
      expect(remaining).toHaveLength(3);
      expect(remaining.map(t => t[2])).toContain('Alice');
      expect(remaining.map(t => t[2])).toContain('Charlie');
      expect(remaining.map(t => t[2])).toContain('Eve');
    });
  });

  describe('Complex Query Patterns', () => {
    beforeEach(async () => {
      // Build a richer knowledge graph
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:1', 'livesIn', 'city:nyc');
      await provider.addTriple('user:1', 'worksAt', 'company:abc');
      
      await provider.addTriple('user:2', 'hasName', 'Bob');
      await provider.addTriple('user:2', 'hasAge', 30); // Same age as Alice
      await provider.addTriple('user:2', 'livesIn', 'city:sf');
      await provider.addTriple('user:2', 'worksAt', 'company:abc'); // Same company as Alice
      
      await provider.addTriple('user:3', 'hasName', 'Charlie');
      await provider.addTriple('user:3', 'hasAge', 25);
      await provider.addTriple('user:3', 'livesIn', 'city:nyc'); // Same city as Alice
      
      await provider.addTriple('company:abc', 'hasName', 'ABC Corp');
      await provider.addTriple('city:nyc', 'hasName', 'New York City');
      await provider.addTriple('city:sf', 'hasName', 'San Francisco');
    });

    it('should find all entities with same value', async () => {
      // Find all users aged 30
      const aged30 = await provider.query(null, 'hasAge', 30);
      expect(aged30).toHaveLength(2);
      expect(aged30.map(t => t[0])).toContain('user:1');
      expect(aged30.map(t => t[0])).toContain('user:2');
    });

    it('should find all facts about an entity', async () => {
      const aliceFacts = await provider.query('user:1', null, null);
      expect(aliceFacts).toHaveLength(4);
      
      // Check all expected facts are present
      expect(aliceFacts).toContainEqual(['user:1', 'hasName', 'Alice']);
      expect(aliceFacts).toContainEqual(['user:1', 'hasAge', 30]);
      expect(aliceFacts).toContainEqual(['user:1', 'livesIn', 'city:nyc']);
      expect(aliceFacts).toContainEqual(['user:1', 'worksAt', 'company:abc']);
    });

    it('should find all relationships of a specific type', async () => {
      const locations = await provider.query(null, 'livesIn', null);
      expect(locations).toHaveLength(3);
      
      const workplaces = await provider.query(null, 'worksAt', null);
      expect(workplaces).toHaveLength(2);
    });

    it('should find shared attributes', async () => {
      // Find who works at company:abc
      const coworkers = await provider.query(null, 'worksAt', 'company:abc');
      expect(coworkers).toHaveLength(2);
      
      // Find who lives in city:nyc
      const neighbors = await provider.query(null, 'livesIn', 'city:nyc');
      expect(neighbors).toHaveLength(2);
    });

    it('should navigate multi-hop relationships', async () => {
      // Find Alice's city
      const aliceCity = await provider.query('user:1', 'livesIn', null);
      expect(aliceCity).toHaveLength(1);
      const cityId = aliceCity[0][2];
      
      // Find the city's name
      const cityName = await provider.query(cityId, 'hasName', null);
      expect(cityName).toHaveLength(1);
      expect(cityName[0][2]).toBe('New York City');
    });
  });

  describe('Data Type Handling', () => {
    it('should preserve different data types', async () => {
      // Add triples with different types
      await provider.addTriple('entity:1', 'stringProp', 'text');
      await provider.addTriple('entity:1', 'numberProp', 42);
      await provider.addTriple('entity:1', 'floatProp', 3.14);
      await provider.addTriple('entity:1', 'boolProp', true);
      await provider.addTriple('entity:1', 'zeroProp', 0);
      await provider.addTriple('entity:1', 'falseProp', false);
      await provider.addTriple('entity:1', 'emptyProp', '');
      
      // Query all and verify types are preserved
      const all = await provider.query('entity:1', null, null);
      expect(all).toHaveLength(7);
      
      // Find specific values and check types
      const stringResult = await provider.query('entity:1', 'stringProp', 'text');
      expect(stringResult[0][2]).toBe('text');
      expect(typeof stringResult[0][2]).toBe('string');
      
      const numberResult = await provider.query('entity:1', 'numberProp', 42);
      expect(numberResult[0][2]).toBe(42);
      expect(typeof numberResult[0][2]).toBe('number');
      
      const floatResult = await provider.query('entity:1', 'floatProp', 3.14);
      expect(floatResult[0][2]).toBe(3.14);
      expect(typeof floatResult[0][2]).toBe('number');
      
      const boolResult = await provider.query('entity:1', 'boolProp', true);
      expect(boolResult[0][2]).toBe(true);
      expect(typeof boolResult[0][2]).toBe('boolean');
      
      const zeroResult = await provider.query('entity:1', 'zeroProp', 0);
      expect(zeroResult[0][2]).toBe(0);
      
      const falseResult = await provider.query('entity:1', 'falseProp', false);
      expect(falseResult[0][2]).toBe(false);
      
      const emptyResult = await provider.query('entity:1', 'emptyProp', '');
      expect(emptyResult[0][2]).toBe('');
    });

    it('should differentiate between similar values of different types', async () => {
      await provider.addTriple('entity:1', 'value', 123);
      await provider.addTriple('entity:2', 'value', '123');
      await provider.addTriple('entity:3', 'value', true);
      await provider.addTriple('entity:4', 'value', 'true');
      
      // Query for number 123
      const numResults = await provider.query(null, 'value', 123);
      expect(numResults).toHaveLength(1);
      expect(numResults[0][0]).toBe('entity:1');
      
      // Query for string '123'
      const strResults = await provider.query(null, 'value', '123');
      expect(strResults).toHaveLength(1);
      expect(strResults[0][0]).toBe('entity:2');
      
      // Query for boolean true
      const boolResults = await provider.query(null, 'value', true);
      expect(boolResults).toHaveLength(1);
      expect(boolResults[0][0]).toBe('entity:3');
      
      // Query for string 'true'
      const strTrueResults = await provider.query(null, 'value', 'true');
      expect(strTrueResults).toHaveLength(1);
      expect(strTrueResults[0][0]).toBe('entity:4');
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle hundreds of triples efficiently', async () => {
      const startTime = Date.now();
      
      // Add 500 triples
      for (let i = 0; i < 100; i++) {
        await provider.addTriple(`user:${i}`, 'hasName', `User${i}`);
        await provider.addTriple(`user:${i}`, 'hasAge', i % 50 + 20);
        await provider.addTriple(`user:${i}`, 'hasEmail', `user${i}@example.com`);
        await provider.addTriple(`user:${i}`, 'livesIn', `city:${i % 10}`);
        await provider.addTriple(`user:${i}`, 'isActive', i % 2 === 0);
      }
      
      const addTime = Date.now() - startTime;
      
      // Verify size
      const size = await provider.size();
      expect(size).toBe(500);
      
      // Query should still be fast
      const queryStart = Date.now();
      const aged30 = await provider.query(null, 'hasAge', 30);
      const queryTime = Date.now() - queryStart;
      
      expect(aged30.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(50); // Should be very fast
      
      // Pattern queries should also be fast
      const patternStart = Date.now();
      const user50Facts = await provider.query('user:50', null, null);
      const patternTime = Date.now() - patternStart;
      
      expect(user50Facts).toHaveLength(5);
      expect(patternTime).toBeLessThan(10);
    });
  });

  describe('Error-Free Edge Cases', () => {
    it('should handle empty operations gracefully', async () => {
      // Query empty store
      const results = await provider.query(null, null, null);
      expect(results).toEqual([]);
      
      // Remove from empty store
      const removed = await provider.removeTriple('x', 'y', 'z');
      expect(removed).toBe(false);
      
      // Clear empty store
      await expect(provider.clear()).resolves.not.toThrow();
      
      // Size of empty store
      const size = await provider.size();
      expect(size).toBe(0);
    });

    it('should handle repeated operations', async () => {
      // Add same triple multiple times
      const first = await provider.addTriple('x', 'y', 'z');
      const second = await provider.addTriple('x', 'y', 'z');
      const third = await provider.addTriple('x', 'y', 'z');
      
      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(third).toBe(false);
      
      const size = await provider.size();
      expect(size).toBe(1);
      
      // Remove same triple multiple times
      const firstRemove = await provider.removeTriple('x', 'y', 'z');
      const secondRemove = await provider.removeTriple('x', 'y', 'z');
      
      expect(firstRemove).toBe(true);
      expect(secondRemove).toBe(false);
      
      const finalSize = await provider.size();
      expect(finalSize).toBe(0);
    });

    it('should handle clear and rebuild', async () => {
      // Build a graph
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:2', 'hasName', 'Bob');
      
      let size = await provider.size();
      expect(size).toBe(2);
      
      // Clear it
      await provider.clear();
      
      size = await provider.size();
      expect(size).toBe(0);
      
      // Rebuild with new data
      await provider.addTriple('product:1', 'hasName', 'Widget');
      await provider.addTriple('product:2', 'hasName', 'Gadget');
      
      size = await provider.size();
      expect(size).toBe(2);
      
      // Old data should not be present
      const oldResults = await provider.query(null, null, 'Alice');
      expect(oldResults).toHaveLength(0);
      
      // New data should be queryable
      const newResults = await provider.query(null, null, 'Widget');
      expect(newResults).toHaveLength(1);
    });
  });
});