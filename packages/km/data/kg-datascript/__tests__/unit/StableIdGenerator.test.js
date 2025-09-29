import { StableIdGenerator } from '../../src/StableIdGenerator.js';

describe('StableIdGenerator Unit Tests', () => {
  let generator;

  beforeEach(() => {
    generator = new StableIdGenerator();
  });

  describe('Basic ID Generation', () => {
    test('should generate deterministic IDs for objects', () => {
      const obj = {
        type: 'person',
        name: 'Alice',
        age: 30
      };

      const id1 = generator.generateId(obj);
      const id2 = generator.generateId(obj);

      expect(id1).toBe(id2); // Same object should get same ID
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    test('should generate different IDs for different objects', () => {
      const obj1 = { type: 'person', name: 'Alice', age: 30 };
      const obj2 = { type: 'person', name: 'Bob', age: 25 };

      const id1 = generator.generateId(obj1);
      const id2 = generator.generateId(obj2);

      expect(id1).not.toBe(id2);
    });

    test('should handle objects with same properties in different order', () => {
      const obj1 = { name: 'Alice', age: 30, type: 'person' };
      const obj2 = { type: 'person', age: 30, name: 'Alice' };

      const id1 = generator.generateId(obj1);
      const id2 = generator.generateId(obj2);

      // Should be the same since properties are the same
      expect(id1).toBe(id2);
    });

    test('should handle nested objects', () => {
      const obj = {
        type: 'person',
        name: 'Alice',
        address: {
          street: '123 Main St',
          city: 'Springfield',
          zip: '12345'
        }
      };

      const id = generator.generateId(obj);
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);

      // Same nested structure should get same ID
      const obj2 = {
        type: 'person',
        name: 'Alice',
        address: {
          street: '123 Main St',
          city: 'Springfield',
          zip: '12345'
        }
      };

      expect(generator.generateId(obj2)).toBe(id);
    });

    test('should handle arrays', () => {
      const obj1 = {
        type: 'list',
        items: ['a', 'b', 'c']
      };

      const obj2 = {
        type: 'list',
        items: ['a', 'b', 'c']
      };

      const obj3 = {
        type: 'list',
        items: ['c', 'b', 'a'] // Different order
      };

      const id1 = generator.generateId(obj1);
      const id2 = generator.generateId(obj2);
      const id3 = generator.generateId(obj3);

      expect(id1).toBe(id2); // Same array should get same ID
      expect(id1).not.toBe(id3); // Different array order should get different ID
    });

    test('should handle special types', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const obj = {
        type: 'event',
        createdAt: date,
        pattern: /test/gi,
        tags: new Set(['a', 'b', 'c']),
        metadata: new Map([['key1', 'value1'], ['key2', 'value2']])
      };

      const id = generator.generateId(obj);
      expect(typeof id).toBe('string');

      // Same special types should generate same ID
      const obj2 = {
        type: 'event',
        createdAt: new Date('2024-01-15T10:30:00Z'),
        pattern: /test/gi,
        tags: new Set(['a', 'b', 'c']),
        metadata: new Map([['key1', 'value1'], ['key2', 'value2']])
      };

      expect(generator.generateId(obj2)).toBe(id);
    });

    test('should handle null and undefined values', () => {
      const obj1 = { type: 'test', value: null };
      const obj2 = { type: 'test', value: undefined };
      const obj3 = { type: 'test' }; // Missing value property

      const id1 = generator.generateId(obj1);
      const id2 = generator.generateId(obj2);
      const id3 = generator.generateId(obj3);

      // null and undefined should be treated differently
      expect(id1).not.toBe(id2);
      // undefined property and missing property should be the same
      expect(id2).toBe(id3);
    });
  });

  describe('ID Stability', () => {
    test('should generate stable IDs across serializations', () => {
      const obj = {
        type: 'document',
        title: 'Test Doc',
        version: 1
      };

      // Generate ID multiple times
      const ids = [];
      for (let i = 0; i < 10; i++) {
        ids.push(generator.generateId(obj));
      }

      // All IDs should be the same
      const firstId = ids[0];
      expect(ids.every(id => id === firstId)).toBe(true);
    });

    test('should maintain ID stability after object modifications', () => {
      const obj = {
        type: 'mutable',
        value: 1
      };

      const originalId = generator.generateId(obj);

      // Modify the object
      obj.value = 2;
      obj.newProp = 'added';

      const modifiedId = generator.generateId(obj);

      // ID should change when object changes
      expect(modifiedId).not.toBe(originalId);

      // But should remain stable for the modified version
      const modifiedId2 = generator.generateId(obj);
      expect(modifiedId2).toBe(modifiedId);
    });

    test('should handle circular references', () => {
      const obj1 = { type: 'node', name: 'A' };
      const obj2 = { type: 'node', name: 'B' };
      
      obj1.next = obj2;
      obj2.next = obj1;

      // Should not throw error or infinite loop
      const id1 = generator.generateId(obj1);
      const id2 = generator.generateId(obj2);

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);

      // Should be stable
      expect(generator.generateId(obj1)).toBe(id1);
      expect(generator.generateId(obj2)).toBe(id2);
    });

    test('should handle self-references', () => {
      const obj = { type: 'self', name: 'SelfRef' };
      obj.self = obj;

      // Should not throw error or infinite loop
      const id = generator.generateId(obj);
      expect(typeof id).toBe('string');

      // Should be stable
      expect(generator.generateId(obj)).toBe(id);
    });
  });

  describe('ID Uniqueness', () => {
    test('should generate unique IDs for different objects', () => {
      const objects = [];
      const ids = new Set();

      // Create many different objects
      for (let i = 0; i < 100; i++) {
        const obj = {
          type: 'item',
          id: i,
          value: Math.random(),
          timestamp: Date.now() + i
        };
        objects.push(obj);
        ids.add(generator.generateId(obj));
      }

      // All IDs should be unique
      expect(ids.size).toBe(100);
    });

    test('should handle edge cases for uniqueness', () => {
      const ids = new Set();

      // Empty object
      ids.add(generator.generateId({}));
      
      // Object with single property
      ids.add(generator.generateId({ a: 1 }));
      
      // Object with null
      ids.add(generator.generateId({ value: null }));
      
      // Object with undefined (should be same as empty)
      const undefinedId = generator.generateId({ value: undefined });
      const emptyId = generator.generateId({});
      
      // Array
      ids.add(generator.generateId([1, 2, 3]));
      
      // Nested structure
      ids.add(generator.generateId({ a: { b: { c: 1 } } }));

      // Most should be unique (except undefined case)
      expect(ids.size).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Custom ID Generation', () => {
    test('should support custom ID fields', () => {
      const generator = new StableIdGenerator({ idField: 'customId' });
      
      const obj = {
        customId: 'my-special-id',
        type: 'test',
        name: 'Test Object'
      };

      const id = generator.generateId(obj);
      expect(id).toBe('my-special-id');
    });

    test('should fall back to hash when custom ID field is missing', () => {
      const generator = new StableIdGenerator({ idField: 'customId' });
      
      const obj = {
        type: 'test',
        name: 'Test Object'
      };

      const id = generator.generateId(obj);
      expect(typeof id).toBe('string');
      expect(id).not.toBe('undefined');
      expect(id.length).toBeGreaterThan(0);
    });

    test('should support UUID generation option', () => {
      const generator = new StableIdGenerator({ useUuid: true });
      
      const obj = {
        type: 'test',
        name: 'Test Object'
      };

      const id = generator.generateId(obj);
      
      // Check if it looks like a UUID (basic check)
      expect(typeof id).toBe('string');
      expect(id.length).toBe(36); // UUID v4 format
      expect(id.split('-').length).toBe(5); // UUID has 5 parts
    });
  });

  describe('Persistence Integration', () => {
    test('should generate IDs suitable for database storage', () => {
      const obj = {
        type: 'entity',
        name: 'Database Entity',
        data: { nested: 'value' }
      };

      const id = generator.generateId(obj);

      // ID should be a valid string
      expect(typeof id).toBe('string');
      
      // Should not contain problematic characters
      expect(id).not.toMatch(/[\0\n\r]/); // No null or newline chars
      
      // Should be consistent length (for hash-based IDs)
      expect(id.length).toBeGreaterThan(0);
      expect(id.length).toBeLessThanOrEqual(64); // Reasonable length for storage
    });

    test('should maintain ID mapping for object references', () => {
      const parent = { type: 'parent', name: 'Parent' };
      const child1 = { type: 'child', name: 'Child1', parent };
      const child2 = { type: 'child', name: 'Child2', parent };

      const parentId = generator.generateId(parent);
      const child1Id = generator.generateId(child1);
      const child2Id = generator.generateId(child2);

      // All IDs should be unique
      expect(parentId).not.toBe(child1Id);
      expect(parentId).not.toBe(child2Id);
      expect(child1Id).not.toBe(child2Id);

      // IDs should be stable
      expect(generator.generateId(parent)).toBe(parentId);
      expect(generator.generateId(child1)).toBe(child1Id);
      expect(generator.generateId(child2)).toBe(child2Id);
    });
  });
});