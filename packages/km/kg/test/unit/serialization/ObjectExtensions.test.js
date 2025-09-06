/**
 * Unit tests for ObjectExtensions - Object prototype extensions
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import '../../../src/serialization/ObjectExtensions.js'; // Import to initialize extensions
import { Person, SimpleClass } from '../../fixtures/sample-classes.js';

describe('ObjectExtensions', () => {
  describe('Object.prototype.getId', () => {
    test('should generate unique IDs for different objects', () => {
      const obj1 = new SimpleClass("test1");
      const obj2 = new SimpleClass("test2");
      
      expect(obj1.getId()).not.toBe(obj2.getId());
      expect(obj1.getId()).toBeDefined();
      expect(obj2.getId()).toBeDefined();
      expect(typeof obj1.getId()).toBe('string');
    });

    test('should return same ID on multiple calls', () => {
      const obj = new SimpleClass("test");
      const id1 = obj.getId();
      const id2 = obj.getId();
      
      expect(id1).toBe(id2);
    });

    test('should use class name in ID for named classes', () => {
      const person = new Person("John", 30);
      const id = person.getId();
      
      expect(id).toMatch(/^person_[a-f0-9]{8}$/);
    });

    test('should use default prefix for plain objects', () => {
      const obj = {};
      const id = obj.getId();
      
      expect(id).toMatch(/^obj_[a-f0-9]{8}$/);
    });

    test('should handle objects with no constructor name', () => {
      const obj = Object.create(null);
      obj.getId = Object.prototype.getId;
      
      expect(() => obj.getId()).not.toThrow();
      expect(obj.getId()).toBeDefined();
    });
  });

  describe('Object.prototype.setId', () => {
    test('should allow manual ID setting', () => {
      const obj = new SimpleClass("test");
      const customId = "custom_test_id";
      
      const result = obj.setId(customId);
      expect(result).toBe(obj); // Should return self for chaining
      expect(obj.getId()).toBe(customId);
    });

    test('should override generated ID', () => {
      const obj = new SimpleClass("test");
      const originalId = obj.getId();
      const customId = "custom_id";
      
      obj.setId(customId);
      expect(obj.getId()).toBe(customId);
      expect(obj.getId()).not.toBe(originalId);
    });

    test('should handle null and undefined IDs', () => {
      const obj = new SimpleClass("test");
      
      obj.setId(null);
      expect(obj.getId()).toBe(null);
      
      // Create a fresh object for undefined test
      const obj2 = new SimpleClass("test2");
      obj2.setId(undefined);
      expect(obj2.getId()).toBe(undefined);
    });
  });

  describe('Object.prototype.toTriples', () => {
    test('should generate triples for simple objects', () => {
      const obj = new SimpleClass("test value");
      const triples = obj.toTriples();
      
      expect(Array.isArray(triples)).toBe(true);
      expect(triples.length).toBeGreaterThan(0);
      
      // Should have type triple
      const typeTriples = triples.filter(([, p]) => p === 'rdf:type');
      expect(typeTriples).toHaveLength(1);
      expect(typeTriples[0][2]).toBe(SimpleClass.getId());
    });

    test('should include object properties as triples', () => {
      const person = new Person("John", 30);
      const triples = person.toTriples();
      
      // Should have property triples
      const propertyTriples = triples.filter(([, p]) => p !== 'rdf:type');
      expect(propertyTriples.length).toBeGreaterThan(0);
      
      // Check for name property
      const nameTriples = triples.filter(([, , o]) => o === "John");
      expect(nameTriples.length).toBeGreaterThan(0);
    });

    test('should filter internal KG properties', () => {
      const obj = new SimpleClass("test");
      obj._kgId = "manual_id";
      obj._kgInternal = "should be filtered";
      obj.normalProperty = "should be included";
      
      const triples = obj.toTriples();
      
      // Should not include _kg* properties
      const internalTriples = triples.filter(([, p]) => 
        p.includes('_kgInternal') || p.includes('_kgId')
      );
      expect(internalTriples).toHaveLength(0);
      
      // Should include normal properties
      const normalTriples = triples.filter(([, p]) => 
        p.includes('normalProperty')
      );
      expect(normalTriples.length).toBeGreaterThan(0);
    });

    test('should handle null and undefined properties', () => {
      const obj = new SimpleClass("test");
      obj.nullProp = null;
      obj.undefinedProp = undefined;
      obj.validProp = "valid";
      
      const triples = obj.toTriples();
      
      // Should not include null/undefined properties
      const nullTriples = triples.filter(([, , o]) => o === null || o === undefined);
      expect(nullTriples).toHaveLength(0);
      
      // Should include valid properties
      const validTriples = triples.filter(([, , o]) => o === "valid");
      expect(validTriples.length).toBeGreaterThan(0);
    });

    test('should handle object references', () => {
      const person1 = new Person("John", 30);
      const person2 = new Person("Jane", 28);
      person1.friend = person2;
      
      const triples = person1.toTriples();
      
      // Should have reference to person2's ID
      const referenceTriples = triples.filter(([, , o]) => o === person2.getId());
      expect(referenceTriples.length).toBeGreaterThan(0);
    });

    test('should handle array properties', () => {
      const person = new Person("John", 30);
      person.hobbies = ["reading", "coding", "gaming"];
      
      const triples = person.toTriples();
      
      // Should have triples for array elements
      const hobbyTriples = triples.filter(([, p]) => p.includes('hobbies'));
      expect(hobbyTriples.length).toBe(3);
    });

    test('should handle arrays with object references', () => {
      const person = new Person("John", 30);
      const friend1 = new Person("Alice", 25);
      const friend2 = new Person("Bob", 35);
      person.friends = [friend1, friend2];
      
      const triples = person.toTriples();
      
      // Should have references to friend IDs
      const friendTriples = triples.filter(([, , o]) => 
        o === friend1.getId() || o === friend2.getId()
      );
      expect(friendTriples.length).toBe(2);
    });

    test('should handle mixed array types', () => {
      const obj = new SimpleClass("test");
      obj.mixedArray = ["string", 42, new SimpleClass("nested")];
      
      const triples = obj.toTriples();
      
      // Should handle all array elements
      const arrayTriples = triples.filter(([, p]) => p.includes('mixedArray'));
      expect(arrayTriples.length).toBe(3);
    });

    test('should use consistent subject ID', () => {
      const obj = new SimpleClass("test");
      const triples = obj.toTriples();
      
      const subjectIds = triples.map(([s]) => s);
      const uniqueSubjects = new Set(subjectIds);
      
      expect(uniqueSubjects.size).toBe(1);
      expect(subjectIds[0]).toBe(obj.getId());
    });
  });

  describe('Function.prototype.getId', () => {
    test('should generate deterministic IDs for classes', () => {
      const id1 = Person.getId();
      const id2 = Person.getId();
      
      expect(id1).toBe(id2);
      expect(typeof id1).toBe('string');
    });

    test('should generate different IDs for different classes', () => {
      const personId = Person.getId();
      const simpleId = SimpleClass.getId();
      
      expect(personId).not.toBe(simpleId);
    });

    test('should use class name in ID', () => {
      const id = Person.getId();
      expect(id).toMatch(/^Person_[a-f0-9]{8}$/);
    });

    test('should handle anonymous functions', () => {
      const anonymousFunc = function() {};
      const id = anonymousFunc.getId();
      
      expect(id).toMatch(/^(anonymous|anonymousFunc)_[a-f0-9]{8}$/);
    });

    test('should cache IDs', () => {
      // Clear any existing ID
      delete Person._kgId;
      
      const id1 = Person.getId();
      const id2 = Person.getId();
      
      expect(id1).toBe(id2);
      expect(Person._kgId).toBe(id1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle objects with circular references', () => {
      const obj1 = new SimpleClass("obj1");
      const obj2 = new SimpleClass("obj2");
      
      obj1.reference = obj2;
      obj2.reference = obj1;
      
      expect(() => {
        obj1.toTriples();
        obj2.toTriples();
      }).not.toThrow();
    });

    test('should handle very large objects', () => {
      const obj = new SimpleClass("test");
      
      // Add many properties
      for (let i = 0; i < 1000; i++) {
        obj[`prop${i}`] = `value${i}`;
      }
      
      const start = Date.now();
      const triples = obj.toTriples();
      const time = Date.now() - start;
      
      expect(time).toBeLessThan(100); // Should be fast
      expect(triples.length).toBeGreaterThan(1000);
    });

    test('should handle special characters in property names', () => {
      const obj = new SimpleClass("test");
      obj["prop@#$"] = "special value";
      obj["prop with spaces"] = "another value";
      obj["prop\nwith\nnewlines"] = "newline value";
      
      expect(() => {
        const triples = obj.toTriples();
        expect(triples.length).toBeGreaterThan(3);
      }).not.toThrow();
    });

    test('should handle very long property values', () => {
      const obj = new SimpleClass("test");
      obj.largeProperty = "x".repeat(10000);
      
      expect(() => {
        const triples = obj.toTriples();
        expect(triples.length).toBeGreaterThan(1);
      }).not.toThrow();
    });

    test('should handle nested objects', () => {
      const obj = new SimpleClass("test");
      obj.nested = {
        level1: {
          level2: {
            value: "deep"
          }
        }
      };
      
      const triples = obj.toTriples();
      
      // Should have reference to nested object
      const nestedTriples = triples.filter(([, p]) => p.includes('nested'));
      expect(nestedTriples.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('should handle ID generation efficiently', () => {
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        const obj = new SimpleClass(`test${i}`);
        obj.getId();
      }
      
      const time = Date.now() - start;
      expect(time).toBeLessThan(100);
    });

    test('should handle triple generation efficiently', () => {
      const objects = [];
      for (let i = 0; i < 100; i++) {
        objects.push(new Person(`Person ${i}`, 20 + i));
      }
      
      const start = Date.now();
      const allTriples = objects.flatMap(obj => obj.toTriples());
      const time = Date.now() - start;
      
      expect(time).toBeLessThan(50);
      expect(allTriples.length).toBeGreaterThanOrEqual(300);
    });
  });
});
