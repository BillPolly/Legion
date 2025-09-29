import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';

describe('ObjectIdentityManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ObjectIdentityManager();
  });

  describe('Object registration and retrieval', () => {
    test('should register object and generate stable ID', () => {
      const obj = { name: 'Alice', age: 30 };
      
      const id = manager.register(obj);
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    test('should return same ID for same object', () => {
      const obj = { name: 'Bob', age: 25 };
      
      const id1 = manager.register(obj);
      const id2 = manager.register(obj);
      
      expect(id1).toBe(id2);
    });

    test('should return different IDs for different objects', () => {
      const obj1 = { name: 'Charlie' };
      const obj2 = { name: 'Charlie' }; // Same content, different object
      
      const id1 = manager.register(obj1);
      const id2 = manager.register(obj2);
      
      expect(id1).not.toBe(id2);
    });

    test('should retrieve object by ID', () => {
      const obj = { name: 'Diana', skills: ['coding', 'design'] };
      
      const id = manager.register(obj);
      const retrieved = manager.getObject(id);
      
      expect(retrieved).toBe(obj); // Same reference
      expect(retrieved.name).toBe('Diana');
      expect(retrieved.skills).toEqual(['coding', 'design']);
    });

    test('should retrieve ID by object', () => {
      const obj = { name: 'Eve' };
      
      const registeredId = manager.register(obj);
      const retrievedId = manager.getId(obj);
      
      expect(retrievedId).toBe(registeredId);
    });

    test('should return undefined for unregistered object', () => {
      const obj = { name: 'Frank' };
      
      const id = manager.getId(obj);
      
      expect(id).toBeUndefined();
    });

    test('should return undefined for non-existent ID', () => {
      const obj = manager.getObject(99999);
      
      expect(obj).toBeUndefined();
    });
  });

  describe('Object lifecycle and garbage collection', () => {
    test('should track object count', () => {
      expect(manager.size()).toBe(0);
      
      const obj1 = { name: 'Object1' };
      const obj2 = { name: 'Object2' };
      
      manager.register(obj1);
      expect(manager.size()).toBe(1);
      
      manager.register(obj2);
      expect(manager.size()).toBe(2);
      
      // Re-registering same object shouldn't increase count
      manager.register(obj1);
      expect(manager.size()).toBe(2);
    });

    test('should unregister object and free ID', () => {
      const obj = { name: 'Temporary' };
      
      const id = manager.register(obj);
      expect(manager.getObject(id)).toBe(obj);
      expect(manager.size()).toBe(1);
      
      const result = manager.unregister(obj);
      expect(result).toBe(true);
      expect(manager.getObject(id)).toBeUndefined();
      expect(manager.getId(obj)).toBeUndefined();
      expect(manager.size()).toBe(0);
    });

    test('should unregister by ID', () => {
      const obj = { name: 'ToDelete' };
      
      const id = manager.register(obj);
      const result = manager.unregisterById(id);
      
      expect(result).toBe(true);
      expect(manager.getObject(id)).toBeUndefined();
      expect(manager.getId(obj)).toBeUndefined();
    });

    test('should return false when unregistering non-existent object', () => {
      const obj = { name: 'NotRegistered' };
      
      const result = manager.unregister(obj);
      
      expect(result).toBe(false);
    });

    test('should use WeakMap for object storage (allows GC)', () => {
      // This test verifies that WeakMap is used correctly
      // We can't directly test GC, but we can verify the structure
      expect(manager._objectToId).toBeInstanceOf(WeakMap);
    });

    test('should clear all registrations', () => {
      const obj1 = { name: 'Object1' };
      const obj2 = { name: 'Object2' };
      const obj3 = { name: 'Object3' };
      
      const id1 = manager.register(obj1);
      const id2 = manager.register(obj2);
      const id3 = manager.register(obj3);
      
      expect(manager.size()).toBe(3);
      
      manager.clear();
      
      expect(manager.size()).toBe(0);
      expect(manager.getObject(id1)).toBeUndefined();
      expect(manager.getObject(id2)).toBeUndefined();
      expect(manager.getObject(id3)).toBeUndefined();
      expect(manager.getId(obj1)).toBeUndefined();
      expect(manager.getId(obj2)).toBeUndefined();
      expect(manager.getId(obj3)).toBeUndefined();
    });
  });

  describe('Special object handling', () => {
    test('should handle null and undefined appropriately', () => {
      expect(() => manager.register(null)).toThrow('Cannot register null or undefined');
      expect(() => manager.register(undefined)).toThrow('Cannot register null or undefined');
      
      expect(manager.getId(null)).toBeUndefined();
      expect(manager.getId(undefined)).toBeUndefined();
    });

    test('should only register objects (not primitives)', () => {
      expect(() => manager.register('string')).toThrow('Can only register objects');
      expect(() => manager.register(123)).toThrow('Can only register objects');
      expect(() => manager.register(true)).toThrow('Can only register objects');
    });

    test('should handle arrays as objects', () => {
      const arr = [1, 2, 3];
      
      const id = manager.register(arr);
      
      expect(id).toBeDefined();
      expect(manager.getObject(id)).toBe(arr);
    });

    test('should handle functions as objects', () => {
      const fn = function testFunction() { return 42; };
      
      const id = manager.register(fn);
      
      expect(id).toBeDefined();
      expect(manager.getObject(id)).toBe(fn);
    });

    test('should handle class instances', () => {
      class Person {
        constructor(name) {
          this.name = name;
        }
      }
      
      const person = new Person('TestPerson');
      const id = manager.register(person);
      
      expect(id).toBeDefined();
      expect(manager.getObject(id)).toBe(person);
      expect(manager.getObject(id).name).toBe('TestPerson');
    });
  });

  describe('ID generation', () => {
    test('should generate sequential IDs', () => {
      const obj1 = { name: 'First' };
      const obj2 = { name: 'Second' };
      const obj3 = { name: 'Third' };
      
      const id1 = manager.register(obj1);
      const id2 = manager.register(obj2);
      const id3 = manager.register(obj3);
      
      // IDs should be sequential
      expect(id2).toBe(id1 + 1);
      expect(id3).toBe(id2 + 1);
    });

    test('should reuse IDs after unregistration (optional optimization)', () => {
      const obj1 = { name: 'First' };
      const obj2 = { name: 'Second' };
      
      const id1 = manager.register(obj1);
      manager.unregister(obj1);
      
      const id2 = manager.register(obj2);
      
      // This is an optional optimization - IDs can be reused or not
      // Just verify that the new ID is valid
      expect(id2).toBeDefined();
      expect(manager.getObject(id2)).toBe(obj2);
    });
  });
});