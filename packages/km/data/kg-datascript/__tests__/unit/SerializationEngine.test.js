import { SerializationEngine } from '../../src/SerializationEngine.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';

describe('SerializationEngine Unit Tests', () => {
  let engine;
  let identityManager;

  beforeEach(() => {
    identityManager = new ObjectIdentityManager();
    engine = new SerializationEngine(identityManager);
  });

  describe('Simple Object Serialization', () => {
    test('should serialize a simple object to triples', () => {
      const obj = {
        type: 'person',
        name: 'Alice',
        age: 30,
        active: true
      };

      // Register object to get ID
      const objectId = identityManager.register(obj);
      
      const triples = engine.serialize(obj);

      expect(triples).toBeInstanceOf(Array);
      expect(triples.length).toBeGreaterThan(0);

      // Should have triples for each property
      expect(triples).toContainEqual([objectId, 'type', 'person']);
      expect(triples).toContainEqual([objectId, 'name', 'Alice']);
      expect(triples).toContainEqual([objectId, 'age', 30]);
      expect(triples).toContainEqual([objectId, 'active', true]);
    });

    test('should handle null and undefined values', () => {
      const obj = {
        type: 'test',
        nullProp: null,
        undefinedProp: undefined,
        validProp: 'value'
      };

      const objectId = identityManager.register(obj);
      const triples = engine.serialize(obj);

      // Should serialize null but skip undefined
      expect(triples).toContainEqual([objectId, 'type', 'test']);
      expect(triples).toContainEqual([objectId, 'nullProp', null]);
      expect(triples).toContainEqual([objectId, 'validProp', 'value']);
      
      // Should not serialize undefined
      const undefinedTriple = triples.find(t => t[1] === 'undefinedProp');
      expect(undefinedTriple).toBeUndefined();
    });

    test('should handle arrays as values', () => {
      const obj = {
        type: 'test',
        tags: ['javascript', 'nodejs', 'testing']
      };

      const objectId = identityManager.register(obj);
      const triples = engine.serialize(obj);

      // Arrays should be serialized as special array values
      const tagsTriple = triples.find(t => t[1] === 'tags');
      expect(tagsTriple).toBeDefined();
      expect(tagsTriple[2]).toEqual({
        _type: 'array',
        _value: ['javascript', 'nodejs', 'testing']
      });
    });

    test('should handle dates', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const obj = {
        type: 'event',
        createdAt: date
      };

      const objectId = identityManager.register(obj);
      const triples = engine.serialize(obj);

      const dateTriple = triples.find(t => t[1] === 'createdAt');
      expect(dateTriple).toBeDefined();
      expect(dateTriple[2]).toEqual({
        _type: 'date',
        _value: date.toISOString()
      });
    });
  });

  describe('Nested Object Serialization', () => {
    test('should serialize nested objects with references', () => {
      const address = {
        type: 'address',
        street: '123 Main St',
        city: 'Springfield'
      };

      const person = {
        type: 'person',
        name: 'Bob',
        address: address
      };

      // Register both objects
      const addressId = identityManager.register(address);
      const personId = identityManager.register(person);

      const triples = engine.serialize(person);

      // Should have person properties
      expect(triples).toContainEqual([personId, 'type', 'person']);
      expect(triples).toContainEqual([personId, 'name', 'Bob']);
      
      // Should have reference to address object
      expect(triples).toContainEqual([personId, 'address', { _ref: addressId }]);

      // Now serialize the address
      const addressTriples = engine.serialize(address);
      expect(addressTriples).toContainEqual([addressId, 'type', 'address']);
      expect(addressTriples).toContainEqual([addressId, 'street', '123 Main St']);
      expect(addressTriples).toContainEqual([addressId, 'city', 'Springfield']);
    });

    test('should handle deeply nested objects', () => {
      const country = {
        type: 'country',
        name: 'USA'
      };

      const city = {
        type: 'city',
        name: 'New York',
        country: country
      };

      const company = {
        type: 'company',
        name: 'TechCorp',
        location: city
      };

      const person = {
        type: 'person',
        name: 'Alice',
        employer: company
      };

      // Register all objects
      const countryId = identityManager.register(country);
      const cityId = identityManager.register(city);
      const companyId = identityManager.register(company);
      const personId = identityManager.register(person);

      const triples = engine.serialize(person);

      // Check references are properly created
      expect(triples).toContainEqual([personId, 'employer', { _ref: companyId }]);
      
      const companyTriples = engine.serialize(company);
      expect(companyTriples).toContainEqual([companyId, 'location', { _ref: cityId }]);
      
      const cityTriples = engine.serialize(city);
      expect(cityTriples).toContainEqual([cityId, 'country', { _ref: countryId }]);
    });

    test('should handle arrays of objects', () => {
      const friend1 = { type: 'person', name: 'Friend1' };
      const friend2 = { type: 'person', name: 'Friend2' };
      
      const person = {
        type: 'person',
        name: 'Main',
        friends: [friend1, friend2]
      };

      // Register all objects
      const friend1Id = identityManager.register(friend1);
      const friend2Id = identityManager.register(friend2);
      const personId = identityManager.register(person);

      const triples = engine.serialize(person);

      const friendsTriple = triples.find(t => t[1] === 'friends');
      expect(friendsTriple).toBeDefined();
      expect(friendsTriple[2]).toEqual({
        _type: 'array',
        _value: [{ _ref: friend1Id }, { _ref: friend2Id }]
      });
    });
  });

  describe('Circular Reference Handling', () => {
    test('should handle simple circular references', () => {
      const obj1 = { type: 'node', name: 'Node1' };
      const obj2 = { type: 'node', name: 'Node2' };
      
      // Create circular reference
      obj1.next = obj2;
      obj2.next = obj1;

      const obj1Id = identityManager.register(obj1);
      const obj2Id = identityManager.register(obj2);

      // Should not throw or go into infinite loop
      const triples1 = engine.serialize(obj1);
      const triples2 = engine.serialize(obj2);

      expect(triples1).toContainEqual([obj1Id, 'next', { _ref: obj2Id }]);
      expect(triples2).toContainEqual([obj2Id, 'next', { _ref: obj1Id }]);
    });

    test('should handle self-referencing objects', () => {
      const obj = { type: 'node', name: 'SelfRef' };
      obj.self = obj;

      const objId = identityManager.register(obj);
      const triples = engine.serialize(obj);

      expect(triples).toContainEqual([objId, 'type', 'node']);
      expect(triples).toContainEqual([objId, 'name', 'SelfRef']);
      expect(triples).toContainEqual([objId, 'self', { _ref: objId }]);
    });

    test('should handle complex circular reference chains', () => {
      const obj1 = { type: 'node', name: 'A' };
      const obj2 = { type: 'node', name: 'B' };
      const obj3 = { type: 'node', name: 'C' };
      
      // Create circular chain: A -> B -> C -> A
      obj1.next = obj2;
      obj2.next = obj3;
      obj3.next = obj1;

      const id1 = identityManager.register(obj1);
      const id2 = identityManager.register(obj2);
      const id3 = identityManager.register(obj3);

      const triples1 = engine.serialize(obj1);
      const triples2 = engine.serialize(obj2);
      const triples3 = engine.serialize(obj3);

      expect(triples1).toContainEqual([id1, 'next', { _ref: id2 }]);
      expect(triples2).toContainEqual([id2, 'next', { _ref: id3 }]);
      expect(triples3).toContainEqual([id3, 'next', { _ref: id1 }]);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for unregistered objects', () => {
      const obj = { type: 'test', name: 'Unregistered' };
      
      expect(() => {
        engine.serialize(obj);
      }).toThrow('Object must be registered with identity manager before serialization');
    });

    test('should throw error for non-objects', () => {
      expect(() => {
        engine.serialize('string');
      }).toThrow('Can only serialize objects');

      expect(() => {
        engine.serialize(123);
      }).toThrow('Can only serialize objects');

      expect(() => {
        engine.serialize(null);
      }).toThrow('Can only serialize objects');

      expect(() => {
        engine.serialize(undefined);
      }).toThrow('Can only serialize objects');
    });
  });

  describe('Special Cases', () => {
    test('should handle functions by skipping them', () => {
      const obj = {
        type: 'test',
        name: 'WithFunction',
        method: function() { return 'test'; },
        arrow: () => 'arrow'
      };

      const objId = identityManager.register(obj);
      const triples = engine.serialize(obj);

      // Should not serialize functions
      expect(triples).toContainEqual([objId, 'type', 'test']);
      expect(triples).toContainEqual([objId, 'name', 'WithFunction']);
      
      const methodTriple = triples.find(t => t[1] === 'method');
      expect(methodTriple).toBeUndefined();
      
      const arrowTriple = triples.find(t => t[1] === 'arrow');
      expect(arrowTriple).toBeUndefined();
    });

    test('should handle symbols', () => {
      const sym = Symbol('test');
      const obj = {
        type: 'test',
        [sym]: 'symbol value',
        regularProp: 'regular'
      };

      const objId = identityManager.register(obj);
      const triples = engine.serialize(obj);

      // Should serialize regular properties
      expect(triples).toContainEqual([objId, 'type', 'test']);
      expect(triples).toContainEqual([objId, 'regularProp', 'regular']);
      
      // Symbol properties are skipped (not enumerable by default)
      expect(triples.length).toBe(2);
    });

    test('should handle RegExp objects', () => {
      const obj = {
        type: 'test',
        pattern: /test.*pattern/gi
      };

      const objId = identityManager.register(obj);
      const triples = engine.serialize(obj);

      const patternTriple = triples.find(t => t[1] === 'pattern');
      expect(patternTriple).toBeDefined();
      expect(patternTriple[2]).toEqual({
        _type: 'regexp',
        _value: '/test.*pattern/gi'
      });
    });

    test('should handle Maps and Sets', () => {
      const map = new Map([['key1', 'value1'], ['key2', 'value2']]);
      const set = new Set(['item1', 'item2', 'item3']);
      
      const obj = {
        type: 'test',
        mapData: map,
        setData: set
      };

      const objId = identityManager.register(obj);
      const triples = engine.serialize(obj);

      const mapTriple = triples.find(t => t[1] === 'mapData');
      expect(mapTriple).toBeDefined();
      expect(mapTriple[2]).toEqual({
        _type: 'map',
        _value: [['key1', 'value1'], ['key2', 'value2']]
      });

      const setTriple = triples.find(t => t[1] === 'setData');
      expect(setTriple).toBeDefined();
      expect(setTriple[2]).toEqual({
        _type: 'set',
        _value: ['item1', 'item2', 'item3']
      });
    });
  });
});