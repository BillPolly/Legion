import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataScriptProvider } from '../../../src/providers/DataScriptProvider.js';

/**
 * Phase 4.5: Main unit tests for DataScriptProvider
 * 
 * Tests the core triple store operations with DataScript backend.
 * DataScript provides Datalog queries and immutable database.
 */
describe('DataScriptProvider - Core Operations', () => {
  let provider;

  beforeEach(() => {
    provider = new DataScriptProvider();
  });

  describe('Basic Operations', () => {
    describe('addTriple', () => {
      it('should add a new triple', async () => {
        const result = await provider.addTriple('entity:1', 'name', 'Alice');
        expect(result).toBe(true);
      });

      it('should return false for duplicate triple', async () => {
        await provider.addTriple('entity:1', 'name', 'Alice');
        const result = await provider.addTriple('entity:1', 'name', 'Alice');
        expect(result).toBe(false);
      });

      it('should handle different data types', async () => {
        expect(await provider.addTriple('entity:1', 'name', 'Alice')).toBe(true);
        expect(await provider.addTriple('entity:1', 'age', 30)).toBe(true);
        expect(await provider.addTriple('entity:1', 'active', true)).toBe(true);
        expect(await provider.addTriple('entity:1', 'score', 98.5)).toBe(true);
      });

      it('should handle special characters in strings', async () => {
        const specialStr = 'Test with "quotes" and \n newline';
        const result = await provider.addTriple('entity:1', 'description', specialStr);
        expect(result).toBe(true);
        
        const triples = await provider.query('entity:1', 'description', null);
        expect(triples[0][2]).toBe(specialStr);
      });
    });

    describe('removeTriple', () => {
      it('should remove an existing triple', async () => {
        await provider.addTriple('entity:1', 'name', 'Alice');
        const result = await provider.removeTriple('entity:1', 'name', 'Alice');
        expect(result).toBe(true);
        
        const size = await provider.size();
        expect(size).toBe(0);
      });

      it('should return false for non-existent triple', async () => {
        const result = await provider.removeTriple('entity:1', 'name', 'Alice');
        expect(result).toBe(false);
      });

      it('should only remove exact matches', async () => {
        await provider.addTriple('entity:1', 'name', 'Alice');
        await provider.addTriple('entity:1', 'name', 'Bob');
        await provider.addTriple('entity:2', 'name', 'Alice');
        
        await provider.removeTriple('entity:1', 'name', 'Alice');
        
        const remaining = await provider.query(null, null, null);
        expect(remaining).toHaveLength(2);
        expect(remaining).toContainEqual(['entity:1', 'name', 'Bob']);
        expect(remaining).toContainEqual(['entity:2', 'name', 'Alice']);
      });
    });

    describe('query', () => {
      beforeEach(async () => {
        // Add test data
        await provider.addTriple('entity:1', 'name', 'Alice');
        await provider.addTriple('entity:1', 'age', 30);
        await provider.addTriple('entity:2', 'name', 'Bob');
        await provider.addTriple('entity:2', 'age', 25);
        await provider.addTriple('entity:3', 'name', 'Charlie');
      });

      it('should query all triples with null wildcards', async () => {
        const results = await provider.query(null, null, null);
        expect(results).toHaveLength(5);
      });

      it('should query by subject', async () => {
        const results = await provider.query('entity:1', null, null);
        expect(results).toHaveLength(2);
        expect(results).toContainEqual(['entity:1', 'name', 'Alice']);
        expect(results).toContainEqual(['entity:1', 'age', 30]);
      });

      it('should query by predicate', async () => {
        const results = await provider.query(null, 'age', null);
        expect(results).toHaveLength(2);
        expect(results).toContainEqual(['entity:1', 'age', 30]);
        expect(results).toContainEqual(['entity:2', 'age', 25]);
      });

      it('should query by object', async () => {
        const results = await provider.query(null, null, 'Alice');
        expect(results).toHaveLength(1);
        expect(results).toContainEqual(['entity:1', 'name', 'Alice']);
      });

      it('should query with multiple constraints', async () => {
        const results = await provider.query('entity:1', 'name', null);
        expect(results).toHaveLength(1);
        expect(results).toContainEqual(['entity:1', 'name', 'Alice']);
      });

      it('should query exact match', async () => {
        const results = await provider.query('entity:1', 'name', 'Alice');
        expect(results).toHaveLength(1);
        expect(results).toContainEqual(['entity:1', 'name', 'Alice']);
      });

      it('should return empty array for no matches', async () => {
        const results = await provider.query('entity:999', null, null);
        expect(results).toEqual([]);
      });

      it('should handle numeric object queries', async () => {
        const results = await provider.query(null, null, 30);
        expect(results).toHaveLength(1);
        expect(results).toContainEqual(['entity:1', 'age', 30]);
      });
    });

    describe('size', () => {
      it('should return 0 for empty store', async () => {
        const size = await provider.size();
        expect(size).toBe(0);
      });

      it('should count triples correctly', async () => {
        await provider.addTriple('entity:1', 'name', 'Alice');
        expect(await provider.size()).toBe(1);
        
        await provider.addTriple('entity:1', 'age', 30);
        expect(await provider.size()).toBe(2);
        
        await provider.addTriple('entity:2', 'name', 'Bob');
        expect(await provider.size()).toBe(3);
      });

      it('should not count duplicates', async () => {
        await provider.addTriple('entity:1', 'name', 'Alice');
        await provider.addTriple('entity:1', 'name', 'Alice');
        expect(await provider.size()).toBe(1);
      });

      it('should update after removal', async () => {
        await provider.addTriple('entity:1', 'name', 'Alice');
        await provider.addTriple('entity:1', 'age', 30);
        expect(await provider.size()).toBe(2);
        
        await provider.removeTriple('entity:1', 'name', 'Alice');
        expect(await provider.size()).toBe(1);
      });
    });

    describe('clear', () => {
      it('should remove all triples', async () => {
        await provider.addTriple('entity:1', 'name', 'Alice');
        await provider.addTriple('entity:2', 'name', 'Bob');
        await provider.addTriple('entity:3', 'name', 'Charlie');
        
        await provider.clear();
        
        const size = await provider.size();
        expect(size).toBe(0);
        
        const results = await provider.query(null, null, null);
        expect(results).toEqual([]);
      });

      it('should work on empty store', async () => {
        await provider.clear();
        expect(await provider.size()).toBe(0);
      });

      it('should allow adding after clear', async () => {
        await provider.addTriple('entity:1', 'name', 'Alice');
        await provider.clear();
        
        const result = await provider.addTriple('entity:2', 'name', 'Bob');
        expect(result).toBe(true);
        expect(await provider.size()).toBe(1);
      });
    });
  });

  describe('Complex Queries', () => {
    beforeEach(async () => {
      // Add graph-like data
      await provider.addTriple('person:1', 'name', 'Alice');
      await provider.addTriple('person:1', 'knows', 'person:2');
      await provider.addTriple('person:1', 'knows', 'person:3');
      await provider.addTriple('person:2', 'name', 'Bob');
      await provider.addTriple('person:2', 'knows', 'person:3');
      await provider.addTriple('person:3', 'name', 'Charlie');
      await provider.addTriple('person:3', 'knows', 'person:1');
    });

    it('should find all relationships for a person', async () => {
      const results = await provider.query('person:1', 'knows', null);
      expect(results).toHaveLength(2);
      expect(results.map(([,,o]) => o).sort()).toEqual(['person:2', 'person:3']);
    });

    it('should find reverse relationships', async () => {
      const results = await provider.query(null, 'knows', 'person:3');
      expect(results).toHaveLength(2);
      expect(results.map(([s,,]) => s).sort()).toEqual(['person:1', 'person:2']);
    });

    it('should support property queries', async () => {
      const nameResults = await provider.query(null, 'name', null);
      expect(nameResults).toHaveLength(3);
      
      const knowsResults = await provider.query(null, 'knows', null);
      expect(knowsResults).toHaveLength(4);
    });
  });

  describe('Data Types', () => {
    it('should handle integers', async () => {
      await provider.addTriple('entity:1', 'count', 42);
      const results = await provider.query('entity:1', 'count', null);
      expect(results[0][2]).toBe(42);
      expect(typeof results[0][2]).toBe('number');
    });

    it('should handle floats', async () => {
      await provider.addTriple('entity:1', 'score', 3.14159);
      const results = await provider.query('entity:1', 'score', null);
      expect(results[0][2]).toBe(3.14159);
      expect(typeof results[0][2]).toBe('number');
    });

    it('should handle booleans', async () => {
      await provider.addTriple('entity:1', 'active', true);
      await provider.addTriple('entity:1', 'deleted', false);
      
      const activeResults = await provider.query('entity:1', 'active', null);
      expect(activeResults[0][2]).toBe(true);
      expect(typeof activeResults[0][2]).toBe('boolean');
      
      const deletedResults = await provider.query('entity:1', 'deleted', null);
      expect(deletedResults[0][2]).toBe(false);
      expect(typeof deletedResults[0][2]).toBe('boolean');
    });

    it('should handle empty strings', async () => {
      await provider.addTriple('entity:1', 'description', '');
      const results = await provider.query('entity:1', 'description', null);
      expect(results[0][2]).toBe('');
    });

    it('should handle zero values', async () => {
      await provider.addTriple('entity:1', 'count', 0);
      const results = await provider.query('entity:1', 'count', null);
      expect(results[0][2]).toBe(0);
    });

    it('should distinguish between similar values of different types', async () => {
      await provider.addTriple('entity:1', 'prop1', '42');
      await provider.addTriple('entity:1', 'prop2', 42);
      await provider.addTriple('entity:1', 'prop3', 'true');
      await provider.addTriple('entity:1', 'prop4', true);
      
      const stringResults = await provider.query(null, null, '42');
      expect(stringResults).toHaveLength(1);
      expect(stringResults[0][1]).toBe('prop1');
      
      const numberResults = await provider.query(null, null, 42);
      expect(numberResults).toHaveLength(1);
      expect(numberResults[0][1]).toBe('prop2');
      
      const stringBoolResults = await provider.query(null, null, 'true');
      expect(stringBoolResults).toHaveLength(1);
      expect(stringBoolResults[0][1]).toBe('prop3');
      
      const boolResults = await provider.query(null, null, true);
      expect(boolResults).toHaveLength(1);
      expect(boolResults[0][1]).toBe('prop4');
    });
  });

  describe('Metadata', () => {
    it('should provide correct metadata', () => {
      const metadata = provider.getMetadata();
      
      expect(metadata.type).toBe('datascript');
      expect(metadata.supportsTransactions).toBe(true);
      expect(metadata.supportsPersistence).toBe(false);
      expect(metadata.supportsAsync).toBe(true);
      expect(metadata.capabilities.datalog).toBe(true);
      expect(metadata.capabilities.pull).toBe(true);
    });

    it('should include schema in metadata', () => {
      const customSchema = {
        ':person/name': { ':db/cardinality': ':db.cardinality/one' }
      };
      const providerWithSchema = new DataScriptProvider({ schema: customSchema });
      
      const metadata = providerWithSchema.getMetadata();
      expect(metadata.schema).toBeDefined();
      expect(metadata.schema[':person/name']).toBeDefined();
    });
  });
});