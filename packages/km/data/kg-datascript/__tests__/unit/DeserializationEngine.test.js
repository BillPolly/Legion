import { DeserializationEngine } from '../../src/DeserializationEngine.js';
import { SerializationEngine } from '../../src/SerializationEngine.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';

describe('DeserializationEngine Unit Tests', () => {
  let deserializer;
  let serializer;
  let identityManager;

  beforeEach(() => {
    identityManager = new ObjectIdentityManager();
    serializer = new SerializationEngine(identityManager);
    deserializer = new DeserializationEngine(identityManager);
  });

  describe('Simple Object Hydration', () => {
    test('should hydrate a simple object from triples', () => {
      const original = {
        type: 'person',
        name: 'Alice',
        age: 30,
        active: true
      };

      // Register and serialize
      const objectId = identityManager.register(original);
      const triples = serializer.serialize(original);

      // Clear identity manager to simulate fresh load
      identityManager.clear();

      // Hydrate from triples
      const hydrated = deserializer.hydrate(triples, objectId);

      expect(hydrated).toEqual(original);
      expect(hydrated).not.toBe(original); // Should be a new object
    });

    test('should handle null values correctly', () => {
      const original = {
        type: 'test',
        nullProp: null,
        validProp: 'value'
      };

      const objectId = identityManager.register(original);
      const triples = serializer.serialize(original);
      
      identityManager.clear();
      
      const hydrated = deserializer.hydrate(triples, objectId);
      
      expect(hydrated.nullProp).toBe(null);
      expect(hydrated.validProp).toBe('value');
    });

    test('should hydrate arrays correctly', () => {
      const original = {
        type: 'test',
        tags: ['javascript', 'nodejs', 'testing'],
        numbers: [1, 2, 3, 4, 5]
      };

      const objectId = identityManager.register(original);
      const triples = serializer.serialize(original);
      
      identityManager.clear();
      
      const hydrated = deserializer.hydrate(triples, objectId);
      
      expect(hydrated.tags).toEqual(['javascript', 'nodejs', 'testing']);
      expect(hydrated.numbers).toEqual([1, 2, 3, 4, 5]);
      expect(Array.isArray(hydrated.tags)).toBe(true);
    });

    test('should hydrate dates correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const original = {
        type: 'event',
        createdAt: date
      };

      const objectId = identityManager.register(original);
      const triples = serializer.serialize(original);
      
      identityManager.clear();
      
      const hydrated = deserializer.hydrate(triples, objectId);
      
      expect(hydrated.createdAt).toBeInstanceOf(Date);
      expect(hydrated.createdAt.toISOString()).toBe(date.toISOString());
    });

    test('should hydrate RegExp correctly', () => {
      const original = {
        type: 'test',
        pattern: /test.*pattern/gi
      };

      const objectId = identityManager.register(original);
      const triples = serializer.serialize(original);
      
      identityManager.clear();
      
      const hydrated = deserializer.hydrate(triples, objectId);
      
      expect(hydrated.pattern).toBeInstanceOf(RegExp);
      expect(hydrated.pattern.source).toBe('test.*pattern');
      expect(hydrated.pattern.flags).toBe('gi');
      expect(hydrated.pattern.toString()).toBe('/test.*pattern/gi');
    });

    test('should hydrate Maps correctly', () => {
      const original = {
        type: 'test',
        metadata: new Map([['key1', 'value1'], ['key2', 'value2']])
      };

      const objectId = identityManager.register(original);
      const triples = serializer.serialize(original);
      
      identityManager.clear();
      
      const hydrated = deserializer.hydrate(triples, objectId);
      
      expect(hydrated.metadata).toBeInstanceOf(Map);
      expect(hydrated.metadata.get('key1')).toBe('value1');
      expect(hydrated.metadata.get('key2')).toBe('value2');
      expect(hydrated.metadata.size).toBe(2);
    });

    test('should hydrate Sets correctly', () => {
      const original = {
        type: 'test',
        tags: new Set(['item1', 'item2', 'item3'])
      };

      const objectId = identityManager.register(original);
      const triples = serializer.serialize(original);
      
      identityManager.clear();
      
      const hydrated = deserializer.hydrate(triples, objectId);
      
      expect(hydrated.tags).toBeInstanceOf(Set);
      expect(hydrated.tags.has('item1')).toBe(true);
      expect(hydrated.tags.has('item2')).toBe(true);
      expect(hydrated.tags.has('item3')).toBe(true);
      expect(hydrated.tags.size).toBe(3);
    });
  });

  describe('Object Graph Reconstruction', () => {
    test('should reconstruct nested object references', () => {
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

      // Serialize both objects
      const addressId = identityManager.register(address);
      const personId = identityManager.register(person);
      
      const addressTriples = serializer.serialize(address);
      const personTriples = serializer.serialize(person);
      
      // Combine all triples
      const allTriples = [...addressTriples, ...personTriples];
      
      identityManager.clear();
      
      // Hydrate the entire graph
      const graph = deserializer.hydrateGraph(allTriples);
      
      // Should have both objects
      expect(graph.objects).toHaveProperty(String(addressId));
      expect(graph.objects).toHaveProperty(String(personId));
      
      // Get the hydrated objects
      const hydratedPerson = graph.objects[personId];
      const hydratedAddress = graph.objects[addressId];
      
      // Check structure
      expect(hydratedPerson.name).toBe('Bob');
      expect(hydratedAddress.street).toBe('123 Main St');
      
      // Check reference is properly connected
      expect(hydratedPerson.address).toBe(hydratedAddress);
    });

    test('should handle deeply nested object graphs', () => {
      const country = { type: 'country', name: 'USA' };
      const city = { type: 'city', name: 'New York', country: country };
      const company = { type: 'company', name: 'TechCorp', location: city };
      const person = { type: 'person', name: 'Alice', employer: company };

      // Register and serialize all
      const countryId = identityManager.register(country);
      const cityId = identityManager.register(city);
      const companyId = identityManager.register(company);
      const personId = identityManager.register(person);

      const allTriples = [
        ...serializer.serialize(country),
        ...serializer.serialize(city),
        ...serializer.serialize(company),
        ...serializer.serialize(person)
      ];

      identityManager.clear();

      // Hydrate the graph
      const graph = deserializer.hydrateGraph(allTriples);

      // Get root object
      const hydratedPerson = graph.objects[personId];
      
      // Verify deep references
      expect(hydratedPerson.employer.name).toBe('TechCorp');
      expect(hydratedPerson.employer.location.name).toBe('New York');
      expect(hydratedPerson.employer.location.country.name).toBe('USA');
      
      // Verify object identity
      expect(hydratedPerson.employer).toBe(graph.objects[companyId]);
      expect(hydratedPerson.employer.location).toBe(graph.objects[cityId]);
      expect(hydratedPerson.employer.location.country).toBe(graph.objects[countryId]);
    });

    test('should reconstruct arrays of object references', () => {
      const friend1 = { type: 'person', name: 'Friend1' };
      const friend2 = { type: 'person', name: 'Friend2' };
      const person = {
        type: 'person',
        name: 'Main',
        friends: [friend1, friend2]
      };

      const friend1Id = identityManager.register(friend1);
      const friend2Id = identityManager.register(friend2);
      const personId = identityManager.register(person);

      const allTriples = [
        ...serializer.serialize(friend1),
        ...serializer.serialize(friend2),
        ...serializer.serialize(person)
      ];

      identityManager.clear();

      const graph = deserializer.hydrateGraph(allTriples);
      const hydratedPerson = graph.objects[personId];

      expect(Array.isArray(hydratedPerson.friends)).toBe(true);
      expect(hydratedPerson.friends.length).toBe(2);
      expect(hydratedPerson.friends[0]).toBe(graph.objects[friend1Id]);
      expect(hydratedPerson.friends[1]).toBe(graph.objects[friend2Id]);
      expect(hydratedPerson.friends[0].name).toBe('Friend1');
      expect(hydratedPerson.friends[1].name).toBe('Friend2');
    });
  });

  describe('Reference Preservation', () => {
    test('should preserve circular references', () => {
      const obj1 = { type: 'node', name: 'Node1' };
      const obj2 = { type: 'node', name: 'Node2' };
      
      obj1.next = obj2;
      obj2.next = obj1;

      const obj1Id = identityManager.register(obj1);
      const obj2Id = identityManager.register(obj2);

      const allTriples = [
        ...serializer.serialize(obj1),
        ...serializer.serialize(obj2)
      ];

      identityManager.clear();

      const graph = deserializer.hydrateGraph(allTriples);
      const hydrated1 = graph.objects[obj1Id];
      const hydrated2 = graph.objects[obj2Id];

      // Check circular references are preserved
      expect(hydrated1.next).toBe(hydrated2);
      expect(hydrated2.next).toBe(hydrated1);
      expect(hydrated1.next.next).toBe(hydrated1);
    });

    test('should preserve self-references', () => {
      const obj = { type: 'node', name: 'SelfRef' };
      obj.self = obj;

      const objId = identityManager.register(obj);
      const triples = serializer.serialize(obj);

      identityManager.clear();

      const graph = deserializer.hydrateGraph(triples);
      const hydrated = graph.objects[objId];

      expect(hydrated.self).toBe(hydrated);
      expect(hydrated.self.self).toBe(hydrated);
    });

    test('should preserve complex reference chains', () => {
      const obj1 = { type: 'node', name: 'A' };
      const obj2 = { type: 'node', name: 'B' };
      const obj3 = { type: 'node', name: 'C' };
      
      obj1.next = obj2;
      obj2.next = obj3;
      obj3.next = obj1;

      const id1 = identityManager.register(obj1);
      const id2 = identityManager.register(obj2);
      const id3 = identityManager.register(obj3);

      const allTriples = [
        ...serializer.serialize(obj1),
        ...serializer.serialize(obj2),
        ...serializer.serialize(obj3)
      ];

      identityManager.clear();

      const graph = deserializer.hydrateGraph(allTriples);
      const h1 = graph.objects[id1];
      const h2 = graph.objects[id2];
      const h3 = graph.objects[id3];

      expect(h1.next).toBe(h2);
      expect(h2.next).toBe(h3);
      expect(h3.next).toBe(h1);
      expect(h1.next.next.next).toBe(h1);
    });

    test('should preserve shared references', () => {
      const shared = { type: 'shared', value: 'Shared Data' };
      const obj1 = { type: 'node', name: 'Obj1', data: shared };
      const obj2 = { type: 'node', name: 'Obj2', data: shared };

      const sharedId = identityManager.register(shared);
      const obj1Id = identityManager.register(obj1);
      const obj2Id = identityManager.register(obj2);

      const allTriples = [
        ...serializer.serialize(shared),
        ...serializer.serialize(obj1),
        ...serializer.serialize(obj2)
      ];

      identityManager.clear();

      const graph = deserializer.hydrateGraph(allTriples);
      const h1 = graph.objects[obj1Id];
      const h2 = graph.objects[obj2Id];
      const hShared = graph.objects[sharedId];

      // Both objects should reference the same shared object
      expect(h1.data).toBe(hShared);
      expect(h2.data).toBe(hShared);
      expect(h1.data).toBe(h2.data);
      expect(h1.data.value).toBe('Shared Data');
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid triple format', () => {
      const invalidTriples = [
        ['invalid'], // Too few elements
        [1, 2, 3, 4], // Too many elements
        'not an array', // Not an array
      ];

      invalidTriples.forEach(invalid => {
        expect(() => {
          deserializer.hydrate([invalid], 1);
        }).toThrow();
      });
    });

    test('should handle missing object references gracefully', () => {
      // Create triples with reference to non-existent object
      const triples = [
        [1, 'type', 'test'],
        [1, 'name', 'Test Object'],
        [1, 'missingRef', { _ref: 999 }] // Reference to non-existent object
      ];

      const hydrated = deserializer.hydrate(triples, 1);
      
      // Should create placeholder or handle gracefully
      expect(hydrated.type).toBe('test');
      expect(hydrated.name).toBe('Test Object');
      expect(hydrated.missingRef).toEqual({ _unresolved: 999 });
    });

    test('should handle malformed special types', () => {
      const triples = [
        [1, 'type', 'test'],
        [1, 'badDate', { _type: 'date', _value: 'not-a-date' }],
        [1, 'badRegex', { _type: 'regexp', _value: 'invalid//regex' }]
      ];

      const hydrated = deserializer.hydrate(triples, 1);
      
      // Should handle invalid dates
      expect(hydrated.badDate).toBeInstanceOf(Date);
      expect(isNaN(hydrated.badDate.getTime())).toBe(true);
      
      // Should handle invalid regex as string
      expect(typeof hydrated.badRegex).toBe('string');
      expect(hydrated.badRegex).toBe('invalid//regex');
    });
  });

  describe('Batch Operations', () => {
    test('should hydrate multiple independent objects', () => {
      const obj1 = { type: 'obj1', value: 1 };
      const obj2 = { type: 'obj2', value: 2 };
      const obj3 = { type: 'obj3', value: 3 };

      const id1 = identityManager.register(obj1);
      const id2 = identityManager.register(obj2);
      const id3 = identityManager.register(obj3);

      const allTriples = [
        ...serializer.serialize(obj1),
        ...serializer.serialize(obj2),
        ...serializer.serialize(obj3)
      ];

      identityManager.clear();

      const graph = deserializer.hydrateGraph(allTriples);

      expect(Object.keys(graph.objects).length).toBe(3);
      expect(graph.objects[id1].value).toBe(1);
      expect(graph.objects[id2].value).toBe(2);
      expect(graph.objects[id3].value).toBe(3);
    });

    test('should provide metadata about hydrated graph', () => {
      const obj1 = { type: 'node' };
      const obj2 = { type: 'node', ref: obj1 };

      const id1 = identityManager.register(obj1);
      const id2 = identityManager.register(obj2);

      const allTriples = [
        ...serializer.serialize(obj1),
        ...serializer.serialize(obj2)
      ];

      identityManager.clear();

      const graph = deserializer.hydrateGraph(allTriples);

      expect(graph.metadata).toBeDefined();
      expect(graph.metadata.objectCount).toBe(2);
      expect(graph.metadata.tripleCount).toBe(allTriples.length);
      expect(graph.metadata.rootIds).toContain(id1);
      expect(graph.metadata.rootIds).toContain(id2);
    });
  });
});