import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataScriptProvider } from '../../../src/providers/DataScriptProvider.js';
import { ITripleStore } from '../../../src/core/ITripleStore.js';

/**
 * Phase 4.11-4.12: Integration tests for DataScriptProvider
 * 
 * Tests that DataScriptProvider correctly implements ITripleStore
 * and integrates with the triple store ecosystem.
 */
describe('DataScriptProvider - Integration Tests', () => {
  let provider;

  beforeEach(() => {
    provider = new DataScriptProvider();
  });

  describe('Interface Compliance', () => {
    it('should be an instance of ITripleStore', () => {
      expect(provider).toBeInstanceOf(ITripleStore);
    });

    it('should implement all required methods', () => {
      expect(typeof provider.addTriple).toBe('function');
      expect(typeof provider.removeTriple).toBe('function');
      expect(typeof provider.query).toBe('function');
      expect(typeof provider.size).toBe('function');
      expect(typeof provider.clear).toBe('function');
      expect(typeof provider.getMetadata).toBe('function');
    });

    it('should return promises from async methods', async () => {
      const addResult = provider.addTriple('s', 'p', 'o');
      expect(addResult).toBeInstanceOf(Promise);
      await addResult;

      const removeResult = provider.removeTriple('s', 'p', 'o');
      expect(removeResult).toBeInstanceOf(Promise);
      await removeResult;

      const queryResult = provider.query(null, null, null);
      expect(queryResult).toBeInstanceOf(Promise);
      await queryResult;

      const sizeResult = provider.size();
      expect(sizeResult).toBeInstanceOf(Promise);
      await sizeResult;

      const clearResult = provider.clear();
      expect(clearResult).toBeInstanceOf(Promise);
      await clearResult;
    });
  });

  describe('Real-world Usage Scenario', () => {
    it('should handle a knowledge graph scenario', async () => {
      // Build a small knowledge graph
      await provider.addTriple('person:alice', 'type', 'Person');
      await provider.addTriple('person:alice', 'name', 'Alice Smith');
      await provider.addTriple('person:alice', 'age', 30);
      await provider.addTriple('person:alice', 'worksFor', 'company:techcorp');
      
      await provider.addTriple('person:bob', 'type', 'Person');
      await provider.addTriple('person:bob', 'name', 'Bob Johnson');
      await provider.addTriple('person:bob', 'age', 35);
      await provider.addTriple('person:bob', 'worksFor', 'company:techcorp');
      
      await provider.addTriple('company:techcorp', 'type', 'Company');
      await provider.addTriple('company:techcorp', 'name', 'TechCorp Inc');
      await provider.addTriple('company:techcorp', 'founded', 2010);
      
      // Query patterns
      const allPeople = await provider.query(null, 'type', 'Person');
      expect(allPeople).toHaveLength(2);
      
      const techcorpEmployees = await provider.query(null, 'worksFor', 'company:techcorp');
      expect(techcorpEmployees).toHaveLength(2);
      
      const aliceData = await provider.query('person:alice', null, null);
      expect(aliceData).toHaveLength(4);
      
      const ages = await provider.query(null, 'age', null);
      expect(ages).toHaveLength(2);
      expect(ages.map(([,,age]) => age).sort()).toEqual([30, 35]);
    });

    it('should handle RDF-like triples', async () => {
      // RDF-style subject-predicate-object triples
      await provider.addTriple('http://example.org/book/1', 'http://purl.org/dc/elements/1.1/title', 'The Great Gatsby');
      await provider.addTriple('http://example.org/book/1', 'http://purl.org/dc/elements/1.1/creator', 'F. Scott Fitzgerald');
      await provider.addTriple('http://example.org/book/1', 'http://purl.org/dc/terms/issued', 1925);
      
      const bookData = await provider.query('http://example.org/book/1', null, null);
      expect(bookData).toHaveLength(3);
      
      const titles = await provider.query(null, 'http://purl.org/dc/elements/1.1/title', null);
      expect(titles[0][2]).toBe('The Great Gatsby');
    });
  });

  describe('Schema Integration', () => {
    it('should work with custom schemas', async () => {
      const schema = {
        ':person/name': { ':db/cardinality': ':db.cardinality/one' },
        ':person/email': { ':db/unique': ':db.unique/identity' },
        ':person/friends': { ':db/cardinality': ':db.cardinality/many' }
      };
      
      const schemaProvider = new DataScriptProvider({ 
        schema,
        validateSchema: true 
      });
      
      await schemaProvider.addTriple('person:1', 'person/name', 'Alice');
      await schemaProvider.addTriple('person:1', 'person/email', 'alice@example.com');
      
      const results = await schemaProvider.query('person:1', null, null);
      expect(results).toHaveLength(2);
    });

    it('should support schema evolution', async () => {
      const initialSchema = {
        ':person/name': { ':db/cardinality': ':db.cardinality/one' }
      };
      
      const provider = new DataScriptProvider({ schema: initialSchema });
      
      await provider.addTriple('person:1', 'person/name', 'Alice');
      
      // Extend schema
      provider.extendSchema({
        ':person/age': { ':db/cardinality': ':db.cardinality/one' }
      });
      
      await provider.addTriple('person:1', 'person/age', 30);
      
      const results = await provider.query('person:1', null, null);
      expect(results).toHaveLength(2);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle moderate data volumes', async () => {
      const startTime = Date.now();
      
      // Add 1000 triples
      for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 10; j++) {
          await provider.addTriple(`entity:${i}`, `prop:${j}`, `value:${i}-${j}`);
        }
      }
      
      const insertTime = Date.now() - startTime;
      expect(insertTime).toBeLessThan(5000); // Should complete in under 5 seconds
      
      // Query performance
      const queryStartTime = Date.now();
      const results = await provider.query('entity:50', null, null);
      const queryTime = Date.now() - queryStartTime;
      
      expect(results).toHaveLength(10);
      expect(queryTime).toBeLessThan(100); // Query should be fast
      
      // Size check
      const size = await provider.size();
      expect(size).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid schema gracefully', () => {
      expect(() => {
        new DataScriptProvider({
          schema: {
            'invalid-attribute': { ':db/cardinality': ':db.cardinality/one' }
          },
          validateSchema: true
        });
      }).toThrow();
    });

    it('should handle query errors gracefully', async () => {
      // Empty store should not throw on queries
      const results = await provider.query('non-existent', null, null);
      expect(results).toEqual([]);
    });
  });

  describe('DataScript-specific Features', () => {
    it('should expose DataScript metadata', () => {
      const metadata = provider.getMetadata();
      
      expect(metadata.type).toBe('datascript');
      expect(metadata.capabilities.datalog).toBe(true);
      expect(metadata.capabilities.pull).toBe(true);
      expect(metadata.capabilities.transactions).toBe(true);
    });

    it('should handle DataScript-style queries internally', async () => {
      // Add data
      await provider.addTriple('entity:1', 'name', 'Test');
      await provider.addTriple('entity:1', 'value', 42);
      
      // The provider internally uses DataScript's Datalog queries
      // but exposes triple store interface
      const results = await provider.query('entity:1', null, null);
      
      expect(results).toHaveLength(2);
      expect(results.some(([,p,o]) => p === 'name' && o === 'Test')).toBe(true);
      expect(results.some(([,p,o]) => p === 'value' && o === 42)).toBe(true);
    });
  });
});