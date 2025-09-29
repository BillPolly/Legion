import { ObjectExtensions } from '../../src/ObjectExtensions.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { SerializationEngine } from '../../src/SerializationEngine.js';
import { StableIdGenerator } from '../../src/StableIdGenerator.js';

describe('ObjectExtensions Unit Tests', () => {
  let identityManager;
  let serializer;
  let idGenerator;
  let originalObjectPrototype;

  beforeEach(() => {
    identityManager = new ObjectIdentityManager();
    serializer = new SerializationEngine(identityManager);
    idGenerator = new StableIdGenerator();
    
    // Save original Object.prototype
    originalObjectPrototype = {};
    if (Object.prototype.toTriples) {
      originalObjectPrototype.toTriples = Object.prototype.toTriples;
      delete Object.prototype.toTriples;
    }
    if (Object.prototype.getId) {
      originalObjectPrototype.getId = Object.prototype.getId;
      delete Object.prototype.getId;
    }
    if (Object.prototype.getStableId) {
      originalObjectPrototype.getStableId = Object.prototype.getStableId;
      delete Object.prototype.getStableId;
    }
    
    // Initialize extensions with dependencies
    ObjectExtensions.initialize(identityManager, serializer, idGenerator);
  });

  afterEach(() => {
    // Clean up extensions
    ObjectExtensions.cleanup();
    
    // Restore original if any existed
    if (originalObjectPrototype.toTriples) {
      Object.prototype.toTriples = originalObjectPrototype.toTriples;
    }
    if (originalObjectPrototype.getId) {
      Object.prototype.getId = originalObjectPrototype.getId;
    }
    if (originalObjectPrototype.getStableId) {
      Object.prototype.getStableId = originalObjectPrototype.getStableId;
    }
  });

  describe('toTriples() Method', () => {
    test('should add toTriples method to Object.prototype', () => {
      expect(typeof Object.prototype.toTriples).toBe('function');
    });

    test('should serialize simple object to triples', () => {
      const obj = {
        type: 'person',
        name: 'Alice',
        age: 30
      };

      // Register object
      identityManager.register(obj);
      
      const triples = obj.toTriples();
      
      expect(Array.isArray(triples)).toBe(true);
      expect(triples.length).toBe(3);
      expect(triples.some(t => t[1] === 'type' && t[2] === 'person')).toBe(true);
      expect(triples.some(t => t[1] === 'name' && t[2] === 'Alice')).toBe(true);
      expect(triples.some(t => t[1] === 'age' && t[2] === 30)).toBe(true);
    });

    test('should handle nested objects', () => {
      const address = {
        street: '123 Main St',
        city: 'Springfield'
      };
      
      const person = {
        type: 'person',
        name: 'Bob',
        address: address
      };

      // Register objects
      identityManager.register(address);
      identityManager.register(person);
      
      const personTriples = person.toTriples();
      const addressTriples = address.toTriples();
      
      // Person should have reference to address
      const addressId = identityManager.getId(address);
      expect(personTriples.some(t => 
        t[1] === 'address' && t[2]._ref === addressId
      )).toBe(true);
      
      // Address should have its own triples
      expect(addressTriples.some(t => t[1] === 'street')).toBe(true);
      expect(addressTriples.some(t => t[1] === 'city')).toBe(true);
    });

    test('should handle arrays', () => {
      const obj = {
        type: 'list',
        items: ['a', 'b', 'c'],
        numbers: [1, 2, 3]
      };

      identityManager.register(obj);
      const triples = obj.toTriples();
      
      const itemsTriple = triples.find(t => t[1] === 'items');
      expect(itemsTriple[2]._type).toBe('array');
      expect(itemsTriple[2]._value).toEqual(['a', 'b', 'c']);
      
      const numbersTriple = triples.find(t => t[1] === 'numbers');
      expect(numbersTriple[2]._type).toBe('array');
      expect(numbersTriple[2]._value).toEqual([1, 2, 3]);
    });

    test('should handle special types', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const obj = {
        type: 'event',
        createdAt: date,
        pattern: /test/gi,
        tags: new Set(['a', 'b', 'c']),
        metadata: new Map([['key', 'value']])
      };

      identityManager.register(obj);
      const triples = obj.toTriples();
      
      // Check date serialization
      const dateTriple = triples.find(t => t[1] === 'createdAt');
      expect(dateTriple[2]._type).toBe('date');
      expect(dateTriple[2]._value).toBe(date.toISOString());
      
      // Check RegExp serialization
      const patternTriple = triples.find(t => t[1] === 'pattern');
      expect(patternTriple[2]._type).toBe('regexp');
      expect(patternTriple[2]._value).toBe('/test/gi');
      
      // Check Set serialization
      const tagsTriple = triples.find(t => t[1] === 'tags');
      expect(tagsTriple[2]._type).toBe('set');
      expect(tagsTriple[2]._value).toEqual(['a', 'b', 'c']);
      
      // Check Map serialization
      const metadataTriple = triples.find(t => t[1] === 'metadata');
      expect(metadataTriple[2]._type).toBe('map');
      expect(metadataTriple[2]._value).toEqual([['key', 'value']]);
    });

    test('should work with unregistered objects', () => {
      const obj = {
        type: 'unregistered',
        value: 'test'
      };

      // Should auto-register when calling toTriples
      const triples = obj.toTriples();
      
      expect(Array.isArray(triples)).toBe(true);
      expect(triples.length).toBeGreaterThan(0);
      
      // Should now be registered
      const id = identityManager.getId(obj);
      expect(id).toBeDefined();
    });

    test('should not serialize non-enumerable properties', () => {
      const obj = {
        visible: 'yes'
      };
      
      Object.defineProperty(obj, 'hidden', {
        value: 'secret',
        enumerable: false
      });
      
      identityManager.register(obj);
      const triples = obj.toTriples();
      
      expect(triples.some(t => t[1] === 'visible')).toBe(true);
      expect(triples.some(t => t[1] === 'hidden')).toBe(false);
    });

    test('should skip functions', () => {
      const obj = {
        type: 'test',
        value: 42,
        method: function() { return this.value; },
        arrow: () => 'arrow'
      };
      
      identityManager.register(obj);
      const triples = obj.toTriples();
      
      expect(triples.some(t => t[1] === 'type')).toBe(true);
      expect(triples.some(t => t[1] === 'value')).toBe(true);
      expect(triples.some(t => t[1] === 'method')).toBe(false);
      expect(triples.some(t => t[1] === 'arrow')).toBe(false);
    });
  });

  describe('getId() Method', () => {
    test('should add getId method to Object.prototype', () => {
      expect(typeof Object.prototype.getId).toBe('function');
    });

    test('should return ID for registered object', () => {
      const obj = { type: 'test', value: 'registered' };
      const id = identityManager.register(obj);
      
      expect(obj.getId()).toBe(id);
    });

    test('should return null for unregistered object', () => {
      const obj = { type: 'test', value: 'unregistered' };
      
      expect(obj.getId()).toBeNull();
    });

    test('should work with different object types', () => {
      const plain = { type: 'plain' };
      const array = [1, 2, 3];
      const date = new Date();
      
      const plainId = identityManager.register(plain);
      const arrayId = identityManager.register(array);
      const dateId = identityManager.register(date);
      
      expect(plain.getId()).toBe(plainId);
      expect(array.getId()).toBe(arrayId);
      expect(date.getId()).toBe(dateId);
    });

    test('should handle circular references', () => {
      const obj1 = { type: 'node', name: 'A' };
      const obj2 = { type: 'node', name: 'B' };
      
      obj1.next = obj2;
      obj2.next = obj1;
      
      const id1 = identityManager.register(obj1);
      const id2 = identityManager.register(obj2);
      
      expect(obj1.getId()).toBe(id1);
      expect(obj2.getId()).toBe(id2);
      expect(obj1.next.getId()).toBe(id2);
      expect(obj2.next.getId()).toBe(id1);
    });
  });

  describe('getStableId() Method', () => {
    test('should add getStableId method to Object.prototype', () => {
      expect(typeof Object.prototype.getStableId).toBe('function');
    });

    test('should generate stable ID for object', () => {
      const obj = {
        type: 'document',
        title: 'Test Doc',
        version: 1
      };
      
      const stableId = obj.getStableId();
      
      expect(typeof stableId).toBe('string');
      expect(stableId.length).toBeGreaterThan(0);
      
      // Should be consistent
      expect(obj.getStableId()).toBe(stableId);
    });

    test('should generate same ID for same content', () => {
      const obj1 = {
        type: 'item',
        name: 'Test',
        value: 42
      };
      
      const obj2 = {
        type: 'item',
        name: 'Test',
        value: 42
      };
      
      expect(obj1.getStableId()).toBe(obj2.getStableId());
    });

    test('should generate different IDs for different content', () => {
      const obj1 = { type: 'item', value: 1 };
      const obj2 = { type: 'item', value: 2 };
      
      expect(obj1.getStableId()).not.toBe(obj2.getStableId());
    });

    test('should handle property order', () => {
      const obj1 = {
        a: 1,
        b: 2,
        c: 3
      };
      
      const obj2 = {
        c: 3,
        a: 1,
        b: 2
      };
      
      // Should be same regardless of property order
      expect(obj1.getStableId()).toBe(obj2.getStableId());
    });

    test('should handle special types', () => {
      const date = new Date('2024-01-15');
      const obj = {
        type: 'special',
        date: date,
        regex: /test/gi,
        set: new Set([1, 2, 3]),
        map: new Map([['key', 'value']])
      };
      
      const stableId = obj.getStableId();
      expect(typeof stableId).toBe('string');
      
      // Create similar object
      const obj2 = {
        type: 'special',
        date: new Date('2024-01-15'),
        regex: /test/gi,
        set: new Set([1, 2, 3]),
        map: new Map([['key', 'value']])
      };
      
      expect(obj2.getStableId()).toBe(stableId);
    });
  });

  describe('Extension Safety', () => {
    test('should not interfere with existing properties', () => {
      const obj = {
        toTriples: 'existing value',
        getId: 42,
        getStableId: true
      };
      
      // Object's own properties should take precedence
      expect(obj.toTriples).toBe('existing value');
      expect(obj.getId).toBe(42);
      expect(obj.getStableId).toBe(true);
    });

    test('should be non-enumerable', () => {
      const obj = { type: 'test' };
      const keys = Object.keys(obj);
      
      // Extension methods should not appear in keys
      expect(keys).not.toContain('toTriples');
      expect(keys).not.toContain('getId');
      expect(keys).not.toContain('getStableId');
      
      // Should only have the original property
      expect(keys).toEqual(['type']);
    });

    test('should work with Object.create(null)', () => {
      const obj = Object.create(null);
      obj.type = 'nullProto';
      obj.value = 'test';
      
      // Should not have prototype methods
      expect(obj.toTriples).toBeUndefined();
      expect(obj.getId).toBeUndefined();
      expect(obj.getStableId).toBeUndefined();
    });

    test('should handle primitive values gracefully', () => {
      // Primitives don't have object identity
      expect(() => (42).toTriples()).not.toThrow();
      expect(() => "string".getId()).not.toThrow();
      expect(() => true.getStableId()).not.toThrow();
      
      // But they should return appropriate values
      const num = 42;
      expect(num.getId()).toBeNull(); // Numbers can't be registered
    });

    test('should cleanup properly', () => {
      // Verify extensions are present
      expect(typeof Object.prototype.toTriples).toBe('function');
      expect(typeof Object.prototype.getId).toBe('function');
      expect(typeof Object.prototype.getStableId).toBe('function');
      
      // Clean up
      ObjectExtensions.cleanup();
      
      // Verify extensions are removed
      expect(Object.prototype.toTriples).toBeUndefined();
      expect(Object.prototype.getId).toBeUndefined();
      expect(Object.prototype.getStableId).toBeUndefined();
      
      // Re-initialize for other tests
      ObjectExtensions.initialize(identityManager, serializer, idGenerator);
    });
  });

  describe('Integration with System', () => {
    test('should work with registered and stable IDs together', () => {
      const obj = {
        type: 'integrated',
        value: 'test'
      };
      
      // Get stable ID first
      const stableId = obj.getStableId();
      
      // Register with stable ID
      identityManager.registerWithId(obj, stableId);
      
      // getId should now return the stable ID
      expect(obj.getId()).toBe(stableId);
      
      // toTriples should use this ID
      const triples = obj.toTriples();
      expect(triples[0][0]).toBe(stableId);
    });

    test('should handle complex workflow', () => {
      // Create object graph
      const company = { type: 'company', name: 'TechCorp' };
      const dept = { type: 'department', name: 'Engineering' };
      const emp1 = { type: 'employee', name: 'Alice' };
      const emp2 = { type: 'employee', name: 'Bob' };
      
      // Build relationships
      company.departments = [dept];
      dept.company = company;
      dept.employees = [emp1, emp2];
      emp1.department = dept;
      emp2.department = dept;
      
      // Get stable IDs for all
      const companyId = company.getStableId();
      const deptId = dept.getStableId();
      const emp1Id = emp1.getStableId();
      const emp2Id = emp2.getStableId();
      
      // Register with stable IDs
      identityManager.registerWithId(company, companyId);
      identityManager.registerWithId(dept, deptId);
      identityManager.registerWithId(emp1, emp1Id);
      identityManager.registerWithId(emp2, emp2Id);
      
      // Verify IDs work
      expect(company.getId()).toBe(companyId);
      expect(dept.getId()).toBe(deptId);
      
      // Serialize all
      const companyTriples = company.toTriples();
      const deptTriples = dept.toTriples();
      
      // Verify references use IDs
      const deptRefInCompany = companyTriples.find(t => t[1] === 'departments');
      expect(deptRefInCompany[2]._type).toBe('array');
      expect(deptRefInCompany[2]._value).toEqual([{ _ref: deptId }]);
      
      const companyRefInDept = deptTriples.find(t => t[1] === 'company');
      expect(companyRefInDept[2]._ref).toBe(companyId);
    });
  });
});