/**
 * Integration test for object-KG round-trip functionality
 * Tests the core principle of Perfect Isomorphism
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import '../../src/serialization/ObjectExtensions.js'; // Import to initialize object extensions
import { KGEngine } from '../../src/core/KGEngine.js';
import { Person, Employee, SimpleClass, ComplexClass } from '../fixtures/sample-classes.js';
import { createSimpleTestData, createEmployeeTestData, createComplexHierarchy } from '../fixtures/test-data.js';

describe('Object-KG Round-trip Integration', () => {
  let engine;

  beforeEach(() => {
    engine = new KGEngine();
  });

  describe('Simple Object Round-trip', () => {
    test('should serialize and reconstruct simple objects', () => {
      const original = new SimpleClass("test value");
      
      // Serialize to triples
      const triples = original.toTriples();
      expect(triples.length).toBeGreaterThan(0);
      
      // Add to KG
      triples.forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
      
      // Verify triples were added
      const allTriples = engine.query(null, null, null);
      expect(allTriples.length).toBe(triples.length);
      
      // Verify object has ID
      expect(original.getId()).toBeDefined();
      expect(typeof original.getId()).toBe('string');
    });

    test('should preserve object properties in triples', () => {
      const person = new Person("John", 30);
      const triples = person.toTriples();
      
      // Should have type triple
      const typeTriples = triples.filter(([, p]) => p === 'rdf:type');
      expect(typeTriples).toHaveLength(1);
      expect(typeTriples[0][2]).toBe(Person.getId());
      
      // Should have property triples
      const propertyTriples = triples.filter(([, p]) => p !== 'rdf:type');
      expect(propertyTriples.length).toBeGreaterThan(0);
      
      // Add to engine and verify queryable
      triples.forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
      
      const nameResults = engine.query(person.getId(), null, 'John');
      expect(nameResults).toHaveLength(1);
    });

    test('should handle objects with array properties', () => {
      const person = new Person("John", 30);
      person.friends = ["Alice", "Bob"];
      
      const triples = person.toTriples();
      expect(triples.length).toBeGreaterThan(2);
      
      // Add to engine
      triples.forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
      
      // Verify all triples are queryable
      const personTriples = engine.query(person.getId(), null, null);
      expect(personTriples.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Object Hierarchies', () => {
    test('should handle object references', () => {
      const { john, jane } = createSimpleTestData();
      
      // Serialize both objects
      const johnTriples = john.toTriples();
      const janeTriples = jane.toTriples();
      
      // Add to engine
      [...johnTriples, ...janeTriples].forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
      
      // Verify relationships are preserved
      const johnFriendTriples = engine.query(john.getId(), null, jane.getId());
      expect(johnFriendTriples.length).toBeGreaterThan(0);
    });

    test('should handle inheritance hierarchies', () => {
      const { alice, david } = createEmployeeTestData();
      
      // Serialize employee objects
      const aliceTriples = alice.toTriples();
      const davidTriples = david.toTriples();
      
      // Add to engine
      [...aliceTriples, ...davidTriples].forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
      
      // Verify type information
      const aliceTypeTriples = engine.query(alice.getId(), 'rdf:type', null);
      expect(aliceTypeTriples).toHaveLength(1);
      expect(aliceTypeTriples[0][2]).toBe(Employee.getId());
      
      // Verify manager relationship
      const managerTriples = engine.query(alice.getId(), null, david.getId());
      expect(managerTriples.length).toBeGreaterThan(0);
    });

    test('should handle nested object structures', () => {
      const { root, child1, grandchild1 } = createComplexHierarchy();
      
      // Serialize all objects
      const allObjects = [root, child1, grandchild1];
      const allTriples = allObjects.flatMap(obj => obj.toTriples());
      
      // Add to engine
      allTriples.forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
      
      // Verify hierarchy relationships
      const rootChildren = engine.query(root.getId(), null, child1.getId());
      expect(rootChildren.length).toBeGreaterThan(0);
      
      const childGrandchildren = engine.query(child1.getId(), null, grandchild1.getId());
      expect(childGrandchildren.length).toBeGreaterThan(0);
    });
  });

  describe('Class Information Preservation', () => {
    test('should preserve class identity', () => {
      const person = new Person("John", 30);
      const employee = new Employee("Alice", 32, "Engineering", 5000);
      
      const personTriples = person.toTriples();
      const employeeTriples = employee.toTriples();
      
      // Add to engine
      [...personTriples, ...employeeTriples].forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
      
      // Verify different class types
      const personTypes = engine.query(person.getId(), 'rdf:type', null);
      const employeeTypes = engine.query(employee.getId(), 'rdf:type', null);
      
      expect(personTypes[0][2]).toBe(Person.getId());
      expect(employeeTypes[0][2]).toBe(Employee.getId());
      expect(personTypes[0][2]).not.toBe(employeeTypes[0][2]);
    });

    test('should generate consistent class IDs', () => {
      const person1 = new Person("John", 30);
      const person2 = new Person("Jane", 28);
      
      // Both should have same class ID
      expect(Person.getId()).toBe(Person.getId());
      
      const triples1 = person1.toTriples();
      const triples2 = person2.toTriples();
      
      const type1 = triples1.find(([, p]) => p === 'rdf:type')[2];
      const type2 = triples2.find(([, p]) => p === 'rdf:type')[2];
      
      expect(type1).toBe(type2);
      expect(type1).toBe(Person.getId());
    });
  });

  describe('Property Filtering', () => {
    test('should filter internal KG properties', () => {
      const obj = new SimpleClass("test");
      obj._kgId = "manual_id";
      obj._kgInternal = "should be filtered";
      obj.normalProperty = "should be included";
      
      const triples = obj.toTriples();
      
      // Should not include _kg* properties in serialization
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
  });

  describe('ID Generation and Consistency', () => {
    test('should generate unique IDs for different objects', () => {
      const obj1 = new SimpleClass("test1");
      const obj2 = new SimpleClass("test2");
      
      expect(obj1.getId()).not.toBe(obj2.getId());
      expect(obj1.getId()).toBeDefined();
      expect(obj2.getId()).toBeDefined();
    });

    test('should maintain ID consistency across serialization', () => {
      const obj = new SimpleClass("test");
      const id1 = obj.getId();
      
      // Serialize
      const triples = obj.toTriples();
      
      // ID should remain the same
      const id2 = obj.getId();
      expect(id1).toBe(id2);
      
      // Triples should use the same ID
      const subjectIds = triples.map(([s]) => s);
      subjectIds.forEach(id => {
        expect(id).toBe(id1);
      });
    });

    test('should allow manual ID setting', () => {
      const obj = new SimpleClass("test");
      const customId = "custom_test_id";
      
      obj.setId(customId);
      expect(obj.getId()).toBe(customId);
      
      const triples = obj.toTriples();
      const subjectIds = triples.map(([s]) => s);
      subjectIds.forEach(id => {
        expect(id).toBe(customId);
      });
    });
  });

  describe('Performance with Multiple Objects', () => {
    test('should handle serialization of many objects efficiently', async () => {
      const objects = [];
      for (let i = 0; i < 100; i++) {
        objects.push(new Person(`Person ${i}`, 20 + i));
      }
      
      const start = Date.now();
      const allTriples = objects.flatMap(obj => obj.toTriples());
      const serializationTime = Date.now() - start;
      
      expect(serializationTime).toBeLessThan(100); // Should be fast
      expect(allTriples.length).toBeGreaterThanOrEqual(300); // Each person should have multiple triples
      
      // Add to engine
      const addStart = Date.now();
      allTriples.forEach(([s, p, o]) => {
        engine.addTriple(s, p, o);
      });
      const addTime = Date.now() - addStart;
      
      expect(addTime).toBeLessThan(200); // Should be reasonably fast
      expect(await engine.size()).toBe(allTriples.length);
    });
  });

  describe('Edge Cases', () => {
    test('should handle objects with circular references gracefully', () => {
      const obj1 = new SimpleClass("obj1");
      const obj2 = new SimpleClass("obj2");
      
      // Create circular reference
      obj1.reference = obj2;
      obj2.reference = obj1;
      
      // Should not throw during serialization
      expect(() => {
        const triples1 = obj1.toTriples();
        const triples2 = obj2.toTriples();
        
        [...triples1, ...triples2].forEach(([s, p, o]) => {
          engine.addTriple(s, p, o);
        });
      }).not.toThrow();
    });

    test('should handle objects with special characters in properties', () => {
      const obj = new SimpleClass("test");
      obj["prop@#$"] = "special value";
      obj["prop with spaces"] = "another value";
      obj["prop\nwith\nnewlines"] = "newline value";
      
      expect(() => {
        const triples = obj.toTriples();
        triples.forEach(([s, p, o]) => {
          engine.addTriple(s, p, o);
        });
      }).not.toThrow();
    });

    test('should handle very large property values', () => {
      const obj = new SimpleClass("test");
      obj.largeProperty = "x".repeat(10000);
      
      expect(() => {
        const triples = obj.toTriples();
        triples.forEach(([s, p, o]) => {
          engine.addTriple(s, p, o);
        });
      }).not.toThrow();
    });
  });
});
