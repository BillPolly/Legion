import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataScriptProvider } from '../../../src/providers/DataScriptProvider.js';

/**
 * Phase 4.4: Unit tests for DataScriptProvider entity mapping
 * 
 * Tests the mapping between triples and DataScript entities.
 * DataScript uses entities with :db/id, we map triples to entities.
 */
describe('DataScriptProvider - Entity Mapping', () => {
  let provider;

  beforeEach(() => {
    provider = new DataScriptProvider();
  });

  describe('Entity ID Generation', () => {
    it('should generate unique entity IDs for different triples', async () => {
      await provider.addTriple('entity:1', 'name', 'Alice');
      await provider.addTriple('entity:1', 'age', 30);
      
      const size = await provider.size();
      expect(size).toBe(2);
    });

    it('should use same entity ID for duplicate triple attempts', async () => {
      const result1 = await provider.addTriple('entity:1', 'name', 'Alice');
      expect(result1).toBe(true);
      
      const result2 = await provider.addTriple('entity:1', 'name', 'Alice');
      expect(result2).toBe(false); // Already exists
      
      const size = await provider.size();
      expect(size).toBe(1);
    });

    it('should generate negative entity IDs for temp IDs', async () => {
      // DataScript convention: negative IDs are temporary
      await provider.addTriple('entity:1', 'name', 'Alice');
      
      // Check internal mapping (if exposed)
      const tripleKey = provider._tripleKey('entity:1', 'name', 'Alice');
      const entityId = provider.tripleToEntity.get(tripleKey);
      expect(entityId).toBeLessThan(0);
    });

    it('should maintain entity ID mapping across operations', async () => {
      await provider.addTriple('entity:1', 'name', 'Alice');
      
      const tripleKey1 = provider._tripleKey('entity:1', 'name', 'Alice');
      const entityId1 = provider.tripleToEntity.get(tripleKey1);
      
      await provider.addTriple('entity:2', 'name', 'Bob');
      
      // First entity ID should still be mapped
      const entityId1After = provider.tripleToEntity.get(tripleKey1);
      expect(entityId1After).toBe(entityId1);
    });
  });

  describe('Triple Key Generation', () => {
    it('should generate consistent keys for same triple', () => {
      const key1 = provider._tripleKey('entity:1', 'name', 'Alice');
      const key2 = provider._tripleKey('entity:1', 'name', 'Alice');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different triples', () => {
      const key1 = provider._tripleKey('entity:1', 'name', 'Alice');
      const key2 = provider._tripleKey('entity:1', 'name', 'Bob');
      const key3 = provider._tripleKey('entity:2', 'name', 'Alice');
      
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    it('should handle different object types in keys', () => {
      const key1 = provider._tripleKey('entity:1', 'age', 30);
      const key2 = provider._tripleKey('entity:1', 'active', true);
      const key3 = provider._tripleKey('entity:1', 'score', 98.5);
      
      // Keys contain raw values, not serialized
      expect(key1).toContain('30');
      expect(key2).toContain('true');
      expect(key3).toContain('98.5');
    });
  });

  describe('Object Serialization', () => {
    it('should serialize string objects', () => {
      const result = provider._serializeObject('test string');
      expect(result).toBe('test string');
    });

    it('should serialize number objects', () => {
      const result1 = provider._serializeObject(42);
      expect(result1).toBe('__num__42');
      
      const result2 = provider._serializeObject(3.14);
      expect(result2).toBe('__num__3.14');
      
      const result3 = provider._serializeObject(-100);
      expect(result3).toBe('__num__-100');
    });

    it('should serialize boolean objects', () => {
      const result1 = provider._serializeObject(true);
      expect(result1).toBe('__bool__true');
      
      const result2 = provider._serializeObject(false);
      expect(result2).toBe('__bool__false');
    });

    it('should handle null and undefined', () => {
      const result1 = provider._serializeObject(null);
      expect(result1).toBe('__null__');
      
      const result2 = provider._serializeObject(undefined);
      expect(result2).toBe('__undefined__');
    });
  });

  describe('Object Deserialization', () => {
    it('should deserialize string values', () => {
      const result = provider._deserializeObject('test string');
      expect(result).toBe('test string');
    });

    it('should deserialize number strings', () => {
      const result1 = provider._deserializeObject('__num__42');
      expect(result1).toBe(42);
      
      const result2 = provider._deserializeObject('__num__3.14');
      expect(result2).toBe(3.14);
      
      const result3 = provider._deserializeObject('__num__-100');
      expect(result3).toBe(-100);
    });

    it('should deserialize boolean strings', () => {
      const result1 = provider._deserializeObject('__bool__true');
      expect(result1).toBe(true);
      
      const result2 = provider._deserializeObject('__bool__false');
      expect(result2).toBe(false);
    });

    it('should preserve strings that look like numbers but arent', () => {
      const result1 = provider._deserializeObject('42abc');
      expect(result1).toBe('42abc');
      
      const result2 = provider._deserializeObject('3.14.15');
      expect(result2).toBe('3.14.15');
    });
    
    it('should deserialize null and undefined', () => {
      const result1 = provider._deserializeObject('__null__');
      expect(result1).toBe(null);
      
      const result2 = provider._deserializeObject('__undefined__');
      expect(result2).toBe(undefined);
    });
  });

  describe('Entity Retraction', () => {
    it('should clean up entity mapping on removal', async () => {
      await provider.addTriple('entity:1', 'name', 'Alice');
      
      const tripleKey = provider._tripleKey('entity:1', 'name', 'Alice');
      expect(provider.tripleToEntity.has(tripleKey)).toBe(true);
      
      await provider.removeTriple('entity:1', 'name', 'Alice');
      expect(provider.tripleToEntity.has(tripleKey)).toBe(false);
    });

    it('should reset entity counter on clear', async () => {
      await provider.addTriple('entity:1', 'name', 'Alice');
      await provider.addTriple('entity:2', 'name', 'Bob');
      
      const initialNextId = provider.nextEntityId;
      expect(initialNextId).toBeGreaterThan(1);
      
      await provider.clear();
      expect(provider.nextEntityId).toBe(1);
      expect(provider.tripleToEntity.size).toBe(0);
    });
  });

  describe('Round-trip Conversion', () => {
    it('should preserve data through serialization/deserialization', async () => {
      // Add various types
      await provider.addTriple('entity:1', 'name', 'Alice');
      await provider.addTriple('entity:1', 'age', 30);
      await provider.addTriple('entity:1', 'active', true);
      await provider.addTriple('entity:1', 'score', 98.5);
      
      // Query them back
      const results = await provider.query('entity:1', null, null);
      
      // Check types are preserved
      const nameTriple = results.find(([,p,]) => p === 'name');
      const ageTriple = results.find(([,p,]) => p === 'age');
      const activeTriple = results.find(([,p,]) => p === 'active');
      const scoreTriple = results.find(([,p,]) => p === 'score');
      
      expect(nameTriple[2]).toBe('Alice');
      expect(ageTriple[2]).toBe(30);
      expect(activeTriple[2]).toBe(true);
      expect(scoreTriple[2]).toBe(98.5);
    });

    it('should handle edge cases in round-trip conversion', async () => {
      // Edge case values
      await provider.addTriple('entity:1', 'zero', 0);
      await provider.addTriple('entity:1', 'negative', -0);
      await provider.addTriple('entity:1', 'empty', '');
      await provider.addTriple('entity:1', 'whitespace', '  ');
      
      const results = await provider.query('entity:1', null, null);
      
      const zeroTriple = results.find(([,p,]) => p === 'zero');
      const negativeTriple = results.find(([,p,]) => p === 'negative');
      const emptyTriple = results.find(([,p,]) => p === 'empty');
      const whitespaceTriple = results.find(([,p,]) => p === 'whitespace');
      
      expect(zeroTriple[2]).toBe(0);
      expect(negativeTriple[2]).toBe(0); // -0 === 0 in JavaScript
      expect(emptyTriple[2]).toBe('');
      expect(whitespaceTriple[2]).toBe('  ');
    });
  });

  describe('DataScript Transaction Format', () => {
    it('should format transactions with proper structure', async () => {
      // This test verifies the transaction format is correct
      // by successfully adding data
      const result = await provider.addTriple('entity:1', 'name', 'Alice');
      expect(result).toBe(true);
      
      // Verify it was stored
      const triples = await provider.query('entity:1', 'name', null);
      expect(triples).toHaveLength(1);
      expect(triples[0]).toEqual(['entity:1', 'name', 'Alice']);
    });

    it('should use plain attributes without colons', async () => {
      // The fix for the keyword bug means we use plain attributes
      await provider.addTriple('entity:1', 'name', 'Alice');
      
      // Query using internal DataScript db to verify attribute format
      const datascript = (await import('datascript/datascript.js')).default;
      const { q, db } = datascript;
      
      const currentDb = db(provider.conn);
      const results = q(
        '[:find ?v :where [?e "triple/subject" "entity:1"] [?e "triple/object" ?v]]',
        currentDb
      );
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0][0]).toBe('Alice');
    });
  });
});