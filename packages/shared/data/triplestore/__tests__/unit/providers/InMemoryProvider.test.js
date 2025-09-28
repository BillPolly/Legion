import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryProvider } from '../../../src/providers/InMemoryProvider.js';

describe('InMemoryProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new InMemoryProvider();
  });

  describe('initialization', () => {
    it('should create an empty provider', async () => {
      const size = await provider.size();
      expect(size).toBe(0);
    });

    it('should return correct metadata', () => {
      const metadata = provider.getMetadata();
      expect(metadata.type).toBe('memory');
      expect(metadata.supportsTransactions).toBe(false);
      expect(metadata.supportsPersistence).toBe(false);
      expect(metadata.supportsAsync).toBe(true);
    });
  });

  describe('addTriple', () => {
    it('should add a triple successfully', async () => {
      const result = await provider.addTriple('user:1', 'hasName', 'Alice');
      expect(result).toBe(true);
      
      const size = await provider.size();
      expect(size).toBe(1);
    });

    it('should return false when adding duplicate triple', async () => {
      await provider.addTriple('user:1', 'hasName', 'Alice');
      const result = await provider.addTriple('user:1', 'hasName', 'Alice');
      
      expect(result).toBe(false);
      
      const size = await provider.size();
      expect(size).toBe(1); // Still only one triple
    });

    it('should add multiple triples', async () => {
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:2', 'hasName', 'Bob');
      
      const size = await provider.size();
      expect(size).toBe(3);
    });

    it('should handle various value types', async () => {
      await provider.addTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:2', 'isActive', true);
      await provider.addTriple('user:3', 'hasScore', 3.14);
      await provider.addTriple('user:4', 'hasNickname', '');
      await provider.addTriple('user:5', 'hasBalance', 0);
      
      const size = await provider.size();
      expect(size).toBe(5);
    });
  });

  describe('removeTriple', () => {
    beforeEach(async () => {
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:2', 'hasName', 'Bob');
    });

    it('should remove an existing triple', async () => {
      const result = await provider.removeTriple('user:1', 'hasName', 'Alice');
      expect(result).toBe(true);
      
      const size = await provider.size();
      expect(size).toBe(2);
    });

    it('should return false when removing non-existent triple', async () => {
      const result = await provider.removeTriple('user:999', 'hasName', 'Nobody');
      expect(result).toBe(false);
      
      const size = await provider.size();
      expect(size).toBe(3); // No change
    });

    it('should not affect other triples when removing one', async () => {
      await provider.removeTriple('user:1', 'hasName', 'Alice');
      
      // Check that user:1 hasAge 30 still exists
      const results = await provider.query('user:1', 'hasAge', null);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['user:1', 'hasAge', 30]);
    });

    it('should handle removing all triples for a subject', async () => {
      await provider.removeTriple('user:1', 'hasName', 'Alice');
      await provider.removeTriple('user:1', 'hasAge', 30);
      
      const size = await provider.size();
      expect(size).toBe(1); // Only user:2's triple remains
    });
  });

  describe('size', () => {
    it('should return 0 for empty store', async () => {
      const size = await provider.size();
      expect(size).toBe(0);
    });

    it('should return correct count after adding triples', async () => {
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:2', 'hasName', 'Bob');
      await provider.addTriple('user:3', 'hasName', 'Charlie');
      
      const size = await provider.size();
      expect(size).toBe(3);
    });

    it('should return correct count after removing triples', async () => {
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:2', 'hasName', 'Bob');
      await provider.removeTriple('user:1', 'hasName', 'Alice');
      
      const size = await provider.size();
      expect(size).toBe(1);
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:2', 'hasAge', 30);
      await provider.addTriple('user:3', 'hasEmail', 'test@example.com');
    });

    it('should remove all triples', async () => {
      await provider.clear();
      
      const size = await provider.size();
      expect(size).toBe(0);
    });

    it('should allow adding new triples after clear', async () => {
      await provider.clear();
      await provider.addTriple('user:4', 'hasName', 'David');
      
      const size = await provider.size();
      expect(size).toBe(1);
    });

    it('should clear indices properly', async () => {
      await provider.clear();
      
      // Try a query - should return empty
      const results = await provider.query(null, null, null);
      expect(results).toEqual([]);
    });
  });

  describe('exact match query', () => {
    beforeEach(async () => {
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:2', 'hasName', 'Bob');
    });

    it('should find exact triple match', async () => {
      const results = await provider.query('user:1', 'hasName', 'Alice');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['user:1', 'hasName', 'Alice']);
    });

    it('should return empty array for non-existent exact match', async () => {
      const results = await provider.query('user:999', 'hasName', 'Nobody');
      expect(results).toEqual([]);
    });

    it('should handle exact matches with different value types', async () => {
      await provider.addTriple('user:3', 'isActive', true);
      await provider.addTriple('user:4', 'hasBalance', 0);
      
      const boolResult = await provider.query('user:3', 'isActive', true);
      expect(boolResult[0]).toEqual(['user:3', 'isActive', true]);
      
      const zeroResult = await provider.query('user:4', 'hasBalance', 0);
      expect(zeroResult[0]).toEqual(['user:4', 'hasBalance', 0]);
    });
  });

  describe('query with wildcards', () => {
    beforeEach(async () => {
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:1', 'hasEmail', 'alice@example.com');
      await provider.addTriple('user:2', 'hasName', 'Bob');
      await provider.addTriple('user:3', 'hasName', 'Alice'); // Same name as user:1
    });

    it('should query with s p ? pattern', async () => {
      const results = await provider.query('user:1', 'hasName', null);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['user:1', 'hasName', 'Alice']);
    });

    it('should query with s ? o pattern', async () => {
      const results = await provider.query('user:1', null, 'Alice');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['user:1', 'hasName', 'Alice']);
    });

    it('should query with ? p o pattern', async () => {
      const results = await provider.query(null, 'hasName', 'Alice');
      expect(results).toHaveLength(2);
      expect(results).toContainEqual(['user:1', 'hasName', 'Alice']);
      expect(results).toContainEqual(['user:3', 'hasName', 'Alice']);
    });

    it('should query with s ? ? pattern', async () => {
      const results = await provider.query('user:1', null, null);
      expect(results).toHaveLength(3);
      expect(results).toContainEqual(['user:1', 'hasName', 'Alice']);
      expect(results).toContainEqual(['user:1', 'hasAge', 30]);
      expect(results).toContainEqual(['user:1', 'hasEmail', 'alice@example.com']);
    });

    it('should query with ? p ? pattern', async () => {
      const results = await provider.query(null, 'hasName', null);
      expect(results).toHaveLength(3);
      expect(results).toContainEqual(['user:1', 'hasName', 'Alice']);
      expect(results).toContainEqual(['user:2', 'hasName', 'Bob']);
      expect(results).toContainEqual(['user:3', 'hasName', 'Alice']);
    });

    it('should query with ? ? o pattern', async () => {
      const results = await provider.query(null, null, 'Alice');
      expect(results).toHaveLength(2);
      expect(results).toContainEqual(['user:1', 'hasName', 'Alice']);
      expect(results).toContainEqual(['user:3', 'hasName', 'Alice']);
    });

    it('should query with ? ? ? pattern (all triples)', async () => {
      const results = await provider.query(null, null, null);
      expect(results).toHaveLength(5);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string as object', async () => {
      await provider.addTriple('user:1', 'hasNickname', '');
      const results = await provider.query('user:1', 'hasNickname', null);
      expect(results).toHaveLength(1);
      expect(results[0][2]).toBe('');
    });

    it('should handle zero as object', async () => {
      await provider.addTriple('user:1', 'hasScore', 0);
      const results = await provider.query('user:1', 'hasScore', null);
      expect(results).toHaveLength(1);
      expect(results[0][2]).toBe(0);
    });

    it('should handle false as object', async () => {
      await provider.addTriple('user:1', 'isActive', false);
      const results = await provider.query('user:1', 'isActive', null);
      expect(results).toHaveLength(1);
      expect(results[0][2]).toBe(false);
    });

    it('should differentiate between number and string representation', async () => {
      await provider.addTriple('user:1', 'hasValue', 123);
      await provider.addTriple('user:2', 'hasValue', '123');
      
      const numResult = await provider.query('user:1', 'hasValue', 123);
      expect(numResult).toHaveLength(1);
      expect(numResult[0][2]).toBe(123);
      
      const strResult = await provider.query('user:2', 'hasValue', '123');
      expect(strResult).toHaveLength(1);
      expect(strResult[0][2]).toBe('123');
    });

    it('should handle special characters in string values', async () => {
      await provider.addTriple('user:1', 'hasName', 'O\'Brien');
      await provider.addTriple('user:2', 'hasEmail', 'test@example.com');
      await provider.addTriple('user:3', 'hasPath', '/home/user/file.txt');
      
      const size = await provider.size();
      expect(size).toBe(3);
      
      const results = await provider.query(null, null, null);
      expect(results).toHaveLength(3);
    });
  });

  describe('inheritance from ITripleStore', () => {
    it('should be instanceof ITripleStore', async () => {
      const { ITripleStore } = await import('../../../src/core/ITripleStore.js');
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

    it('should have async methods that return promises', async () => {
      expect(provider.addTriple('s', 'p', 'o')).toBeInstanceOf(Promise);
      expect(provider.removeTriple('s', 'p', 'o')).toBeInstanceOf(Promise);
      expect(provider.query('s', 'p', 'o')).toBeInstanceOf(Promise);
      expect(provider.size()).toBeInstanceOf(Promise);
      expect(provider.clear()).toBeInstanceOf(Promise);
    });
  });
});