import { describe, it, expect } from '@jest/globals';
import { ITripleStore } from '../../../src/core/ITripleStore.js';

describe('ITripleStore Interface', () => {
  describe('Base class instantiation', () => {
    it('should create an instance of ITripleStore', () => {
      const store = new ITripleStore();
      expect(store).toBeInstanceOf(ITripleStore);
    });
  });

  describe('Required async methods', () => {
    let store;

    beforeEach(() => {
      store = new ITripleStore();
    });

    it('should have addTriple method', () => {
      expect(typeof store.addTriple).toBe('function');
    });

    it('should have removeTriple method', () => {
      expect(typeof store.removeTriple).toBe('function');
    });

    it('should have query method', () => {
      expect(typeof store.query).toBe('function');
    });

    it('should have size method', () => {
      expect(typeof store.size).toBe('function');
    });

    it('should have clear method', () => {
      expect(typeof store.clear).toBe('function');
    });

    it('addTriple should return a promise', async () => {
      const result = store.addTriple('s', 'p', 'o');
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toThrow('Not implemented');
    });

    it('removeTriple should return a promise', async () => {
      const result = store.removeTriple('s', 'p', 'o');
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toThrow('Not implemented');
    });

    it('query should return a promise', async () => {
      const result = store.query('s', 'p', 'o');
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toThrow('Not implemented');
    });

    it('size should return a promise', async () => {
      const result = store.size();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toThrow('Not implemented');
    });

    it('clear should return a promise', async () => {
      const result = store.clear();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toThrow('Not implemented');
    });
  });

  describe('getMetadata method', () => {
    it('should have getMetadata method', () => {
      const store = new ITripleStore();
      expect(typeof store.getMetadata).toBe('function');
    });

    it('should throw error when not implemented', () => {
      const store = new ITripleStore();
      expect(() => store.getMetadata()).toThrow('Not implemented');
    });
  });

  describe('Method signatures', () => {
    it('addTriple should accept three parameters', () => {
      const store = new ITripleStore();
      expect(store.addTriple.length).toBe(3);
    });

    it('removeTriple should accept three parameters', () => {
      const store = new ITripleStore();
      expect(store.removeTriple.length).toBe(3);
    });

    it('query should accept three parameters', () => {
      const store = new ITripleStore();
      expect(store.query.length).toBe(3);
    });

    it('size should accept no parameters', () => {
      const store = new ITripleStore();
      expect(store.size.length).toBe(0);
    });

    it('clear should accept no parameters', () => {
      const store = new ITripleStore();
      expect(store.clear.length).toBe(0);
    });

    it('getMetadata should accept no parameters', () => {
      const store = new ITripleStore();
      expect(store.getMetadata.length).toBe(0);
    });
  });

  describe('Subclass implementation validation', () => {
    class TestTripleStore extends ITripleStore {
      async addTriple(subject, predicate, object) {
        return true;
      }

      async removeTriple(subject, predicate, object) {
        return true;
      }

      async query(subject, predicate, object) {
        return [];
      }

      async size() {
        return 0;
      }

      async clear() {
        return undefined;
      }

      getMetadata() {
        return {
          type: 'test',
          supportsTransactions: false,
          supportsPersistence: false,
          supportsAsync: true
        };
      }
    }

    it('should allow proper subclass implementation', () => {
      const store = new TestTripleStore();
      expect(store).toBeInstanceOf(ITripleStore);
      expect(store).toBeInstanceOf(TestTripleStore);
    });

    it('subclass should be able to implement addTriple', async () => {
      const store = new TestTripleStore();
      const result = await store.addTriple('s', 'p', 'o');
      expect(result).toBe(true);
    });

    it('subclass should be able to implement removeTriple', async () => {
      const store = new TestTripleStore();
      const result = await store.removeTriple('s', 'p', 'o');
      expect(result).toBe(true);
    });

    it('subclass should be able to implement query', async () => {
      const store = new TestTripleStore();
      const result = await store.query('s', 'p', 'o');
      expect(Array.isArray(result)).toBe(true);
    });

    it('subclass should be able to implement size', async () => {
      const store = new TestTripleStore();
      const result = await store.size();
      expect(typeof result).toBe('number');
    });

    it('subclass should be able to implement clear', async () => {
      const store = new TestTripleStore();
      await expect(store.clear()).resolves.toBeUndefined();
    });

    it('subclass should be able to implement getMetadata', () => {
      const store = new TestTripleStore();
      const metadata = store.getMetadata();
      expect(metadata).toHaveProperty('type');
      expect(metadata).toHaveProperty('supportsTransactions');
      expect(metadata).toHaveProperty('supportsPersistence');
      expect(metadata).toHaveProperty('supportsAsync');
    });
  });
});