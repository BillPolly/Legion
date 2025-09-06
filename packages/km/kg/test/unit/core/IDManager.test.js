/**
 * Unit tests for IDManager - ID generation strategies
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { IDManager, idManager } from '../../../src/core/IDManager.js';

describe('IDManager', () => {
  let manager;

  beforeEach(() => {
    manager = new IDManager();
  });

  describe('Random ID Generation', () => {
    test('should generate random IDs with default prefix', () => {
      const id = manager.generateRandomId();
      expect(id).toMatch(/^obj_[a-f0-9]{8}$/);
    });

    test('should generate random IDs with custom prefix', () => {
      const id = manager.generateRandomId('person');
      expect(id).toMatch(/^person_[a-f0-9]{8}$/);
    });

    test('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(manager.generateRandomId());
      }
      expect(ids.size).toBe(1000);
    });

    test('should handle empty prefix', () => {
      const id = manager.generateRandomId('');
      expect(id).toMatch(/^_[a-f0-9]{8}$/);
    });

    test('should handle special characters in prefix', () => {
      const id = manager.generateRandomId('test@#$');
      expect(id).toMatch(/^test@#\$_[a-f0-9]{8}$/);
    });
  });

  describe('Deterministic ID Generation', () => {
    test('should generate consistent IDs for same input', () => {
      const id1 = manager.generateDeterministicId('TestClass');
      const id2 = manager.generateDeterministicId('TestClass');
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^TestClass_[a-f0-9]{8}$/);
    });

    test('should generate different IDs for different inputs', () => {
      const id1 = manager.generateDeterministicId('ClassA');
      const id2 = manager.generateDeterministicId('ClassB');
      expect(id1).not.toBe(id2);
    });

    test('should use namespace in ID generation', () => {
      const id1 = manager.generateDeterministicId('TestClass', 'namespace1');
      const id2 = manager.generateDeterministicId('TestClass', 'namespace2');
      expect(id1).not.toBe(id2);
    });

    test('should cache deterministic IDs', () => {
      const id1 = manager.generateDeterministicId('TestClass');
      const id2 = manager.generateDeterministicId('TestClass');
      expect(id1).toBe(id2);
      expect(manager.deterministicCache.size).toBe(1);
    });

    test('should handle empty name', () => {
      const id = manager.generateDeterministicId('');
      expect(id).toMatch(/^_[a-f0-9]{8}$/);
    });

    test('should handle unicode characters', () => {
      const id = manager.generateDeterministicId('José');
      expect(id).toMatch(/^José_[a-f0-9]{8}$/);
    });
  });

  describe('Property ID Generation', () => {
    test('should generate property IDs', () => {
      const id = manager.generatePropertyId('Person', 'name');
      expect(id).toMatch(/^Person\.name_[a-f0-9]{8}$/);
    });

    test('should be consistent for same class and property', () => {
      const id1 = manager.generatePropertyId('Person', 'name');
      const id2 = manager.generatePropertyId('Person', 'name');
      expect(id1).toBe(id2);
    });

    test('should be different for different properties', () => {
      const id1 = manager.generatePropertyId('Person', 'name');
      const id2 = manager.generatePropertyId('Person', 'age');
      expect(id1).not.toBe(id2);
    });

    test('should be different for different classes', () => {
      const id1 = manager.generatePropertyId('Person', 'name');
      const id2 = manager.generatePropertyId('Employee', 'name');
      expect(id1).not.toBe(id2);
    });

    test('should handle special characters in class and property names', () => {
      const id = manager.generatePropertyId('Test@Class', 'prop#name');
      expect(id).toMatch(/^Test@Class\.prop#name_[a-f0-9]{8}$/);
    });
  });

  describe('Method ID Generation', () => {
    test('should generate method IDs', () => {
      const id = manager.generateMethodId('Person', 'greet');
      expect(id).toMatch(/^Person\.greet_[a-f0-9]{8}$/);
    });

    test('should be consistent for same class and method', () => {
      const id1 = manager.generateMethodId('Person', 'greet');
      const id2 = manager.generateMethodId('Person', 'greet');
      expect(id1).toBe(id2);
    });

    test('should be different for different methods', () => {
      const id1 = manager.generateMethodId('Person', 'greet');
      const id2 = manager.generateMethodId('Person', 'farewell');
      expect(id1).not.toBe(id2);
    });

    test('should be different for different classes', () => {
      const id1 = manager.generateMethodId('Person', 'greet');
      const id2 = manager.generateMethodId('Employee', 'greet');
      expect(id1).not.toBe(id2);
    });

    test('should handle constructor method', () => {
      const id = manager.generateMethodId('Person', 'constructor');
      expect(id).toMatch(/^Person\.constructor_[a-f0-9]{8}$/);
    });

    test('should handle static methods', () => {
      const id = manager.generateMethodId('Person', 'getSpecies');
      expect(id).toMatch(/^Person\.getSpecies_[a-f0-9]{8}$/);
    });
  });

  describe('Cache Management', () => {
    test('should cache deterministic IDs', () => {
      expect(manager.deterministicCache.size).toBe(0);
      
      manager.generateDeterministicId('TestClass');
      expect(manager.deterministicCache.size).toBe(1);
      
      manager.generatePropertyId('TestClass', 'prop');
      expect(manager.deterministicCache.size).toBe(2);
      
      manager.generateMethodId('TestClass', 'method');
      expect(manager.deterministicCache.size).toBe(3);
    });

    test('should reuse cached IDs', () => {
      const id1 = manager.generateDeterministicId('TestClass');
      const cacheSize = manager.deterministicCache.size;
      
      const id2 = manager.generateDeterministicId('TestClass');
      expect(id1).toBe(id2);
      expect(manager.deterministicCache.size).toBe(cacheSize);
    });

    test('should handle cache with many entries', () => {
      for (let i = 0; i < 1000; i++) {
        manager.generateDeterministicId(`Class${i}`);
      }
      expect(manager.deterministicCache.size).toBe(1000);
      
      // Verify all cached IDs are still accessible
      for (let i = 0; i < 1000; i++) {
        const id = manager.generateDeterministicId(`Class${i}`);
        expect(id).toMatch(/^Class\d+_[a-f0-9]{8}$/);
      }
    });
  });

  describe('Collision Resistance', () => {
    test('should have low collision probability for random IDs', () => {
      const ids = new Set();
      const collisions = [];
      
      for (let i = 0; i < 10000; i++) {
        const id = manager.generateRandomId();
        if (ids.has(id)) {
          collisions.push(id);
        }
        ids.add(id);
      }
      
      expect(collisions).toHaveLength(0);
    });

    test('should generate different hashes for similar names', () => {
      const id1 = manager.generateDeterministicId('TestClass');
      const id2 = manager.generateDeterministicId('TestClass1');
      const id3 = manager.generateDeterministicId('TestClas');
      
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
    });

    test('should handle hash collisions gracefully', () => {
      // This test ensures the system doesn't break even if hash collisions occur
      // (though they should be extremely rare with SHA-256)
      const ids = new Set();
      
      for (let i = 0; i < 1000; i++) {
        const id = manager.generateDeterministicId(`TestClass${i}`);
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    });
  });

  describe('Singleton Instance', () => {
    test('should export singleton instance', () => {
      expect(idManager).toBeInstanceOf(IDManager);
    });

    test('should maintain state across imports', () => {
      const id1 = idManager.generateDeterministicId('SingletonTest');
      const id2 = idManager.generateDeterministicId('SingletonTest');
      expect(id1).toBe(id2);
    });

    test('should have independent cache from new instances', () => {
      const newManager = new IDManager();
      
      idManager.generateDeterministicId('TestClass');
      expect(idManager.deterministicCache.size).toBeGreaterThan(0);
      expect(newManager.deterministicCache.size).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null and undefined inputs gracefully', () => {
      expect(() => manager.generateDeterministicId(null)).not.toThrow();
      expect(() => manager.generateDeterministicId(undefined)).not.toThrow();
      expect(() => manager.generatePropertyId(null, 'prop')).not.toThrow();
      expect(() => manager.generateMethodId('Class', null)).not.toThrow();
    });

    test('should handle very long names', () => {
      const longName = 'a'.repeat(10000);
      const id = manager.generateDeterministicId(longName);
      expect(id).toMatch(/^a{10000}_[a-f0-9]{8}$/);
    });

    test('should handle names with newlines and tabs', () => {
      const nameWithWhitespace = 'Test\nClass\tName';
      const id = manager.generateDeterministicId(nameWithWhitespace);
      expect(id).toMatch(/^Test\nClass\tName_[a-f0-9]{8}$/);
    });

    test('should handle numeric inputs', () => {
      const id1 = manager.generateDeterministicId(123);
      const id2 = manager.generateDeterministicId('123');
      expect(id1).toBe(id2); // Should convert to string
    });
  });

  describe('Performance', () => {
    test('should generate random IDs quickly', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        manager.generateRandomId();
      }
      const time = Date.now() - start;
      expect(time).toBeLessThan(100); // Should take less than 100ms
    });

    test('should generate deterministic IDs quickly', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        manager.generateDeterministicId(`Class${i}`);
      }
      const time = Date.now() - start;
      expect(time).toBeLessThan(200); // Should take less than 200ms
    });

    test('should access cached IDs very quickly', () => {
      // Pre-populate cache
      for (let i = 0; i < 100; i++) {
        manager.generateDeterministicId(`Class${i}`);
      }
      
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        manager.generateDeterministicId(`Class${i}`);
      }
      const time = Date.now() - start;
      expect(time).toBeLessThan(10); // Cached access should be very fast
    });
  });
});
