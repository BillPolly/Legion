import { KGClassicOperations } from '../../src/KGClassicOperations.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { SerializationEngine } from '../../src/SerializationEngine.js';

describe('KGClassicOperations Unit Tests', () => {
  let kgOps;
  let identityManager;
  let serializer;

  beforeEach(() => {
    identityManager = new ObjectIdentityManager();
    serializer = new SerializationEngine(identityManager);
    kgOps = new KGClassicOperations(identityManager, serializer);
  });

  describe('Triple Operations', () => {
    test('should add triple for registered object', () => {
      const obj = { type: 'person', name: 'Alice' };
      const objId = identityManager.register(obj);

      const result = kgOps.addTriple(obj, 'age', 30);
      
      expect(result.success).toBe(true);
      expect(result.triple).toEqual([objId, 'age', 30]);
      
      // Verify triple was added to store
      const triples = kgOps.getTriples();
      expect(triples).toContainEqual([objId, 'age', 30]);
    });

    test('should add multiple triples for same object', () => {
      const obj = { type: 'person', name: 'Bob' };
      identityManager.register(obj);

      kgOps.addTriple(obj, 'age', 25);
      kgOps.addTriple(obj, 'email', 'bob@example.com');
      kgOps.addTriple(obj, 'active', true);

      const triples = kgOps.getTriples();
      expect(triples.length).toBe(3);
    });

    test('should handle object references in triples', () => {
      const company = { type: 'company', name: 'TechCorp' };
      const person = { type: 'person', name: 'Carol' };
      
      const companyId = identityManager.register(company);
      const personId = identityManager.register(person);

      const result = kgOps.addTriple(person, 'employer', company);
      
      expect(result.success).toBe(true);
      expect(result.triple).toEqual([personId, 'employer', { _ref: companyId }]);
    });

    test('should remove triple', () => {
      const obj = { type: 'task', title: 'Task 1' };
      const objId = identityManager.register(obj);

      // Add triples
      kgOps.addTriple(obj, 'status', 'pending');
      kgOps.addTriple(obj, 'priority', 'high');

      // Remove one triple
      const result = kgOps.removeTriple(obj, 'status', 'pending');
      
      expect(result.success).toBe(true);
      expect(result.removed).toBe(true);

      // Verify triple was removed
      const triples = kgOps.getTriples();
      expect(triples).not.toContainEqual([objId, 'status', 'pending']);
      expect(triples).toContainEqual([objId, 'priority', 'high']);
    });

    test('should handle removing non-existent triple', () => {
      const obj = { type: 'test' };
      identityManager.register(obj);

      const result = kgOps.removeTriple(obj, 'nonexistent', 'value');
      
      expect(result.success).toBe(true);
      expect(result.removed).toBe(false);
    });

    test('should fail operations on unregistered objects', () => {
      const unregistered = { type: 'orphan' };

      expect(() => {
        kgOps.addTriple(unregistered, 'prop', 'value');
      }).toThrow('Object must be registered');

      expect(() => {
        kgOps.removeTriple(unregistered, 'prop', 'value');
      }).toThrow('Object must be registered');
    });

    test('should add triples with special types', () => {
      const obj = { type: 'document' };
      const objId = identityManager.register(obj);

      const date = new Date('2024-01-15T10:30:00Z');
      const pattern = /test/gi;
      const tags = new Set(['a', 'b', 'c']);
      const metadata = new Map([['key', 'value']]);

      kgOps.addTriple(obj, 'createdAt', date);
      kgOps.addTriple(obj, 'pattern', pattern);
      kgOps.addTriple(obj, 'tags', tags);
      kgOps.addTriple(obj, 'metadata', metadata);

      const triples = kgOps.getTriples();
      
      expect(triples).toContainEqual([
        objId, 'createdAt', { _type: 'date', _value: date.toISOString() }
      ]);
      expect(triples).toContainEqual([
        objId, 'pattern', { _type: 'regexp', _value: '/test/gi' }
      ]);
      expect(triples).toContainEqual([
        objId, 'tags', { _type: 'set', _value: ['a', 'b', 'c'] }
      ]);
      expect(triples).toContainEqual([
        objId, 'metadata', { _type: 'map', _value: [['key', 'value']] }
      ]);
    });
  });

  describe('Pattern Queries', () => {
    beforeEach(() => {
      // Set up test data
      const alice = { type: 'person', name: 'Alice' };
      const bob = { type: 'person', name: 'Bob' };
      const techCorp = { type: 'company', name: 'TechCorp' };
      
      identityManager.register(alice);
      identityManager.register(bob);
      identityManager.register(techCorp);

      kgOps.addTriple(alice, 'age', 30);
      kgOps.addTriple(alice, 'employer', techCorp);
      kgOps.addTriple(bob, 'age', 25);
      kgOps.addTriple(bob, 'employer', techCorp);
      kgOps.addTriple(techCorp, 'founded', 2010);
    });

    test('should query by subject', () => {
      const alice = identityManager.getObject(1); // First registered object
      const results = kgOps.queryPattern({ subject: alice });

      expect(results.length).toBe(2); // age and employer
      expect(results).toContainEqual([1, 'age', 30]);
      expect(results).toContainEqual([1, 'employer', { _ref: 3 }]);
    });

    test('should query by predicate', () => {
      const results = kgOps.queryPattern({ predicate: 'age' });

      expect(results.length).toBe(2);
      expect(results).toContainEqual([1, 'age', 30]);
      expect(results).toContainEqual([2, 'age', 25]);
    });

    test('should query by object value', () => {
      const results = kgOps.queryPattern({ object: 30 });

      expect(results.length).toBe(1);
      expect(results).toContainEqual([1, 'age', 30]);
    });

    test('should query by object reference', () => {
      const techCorp = identityManager.getObject(3);
      const results = kgOps.queryPattern({ object: techCorp });

      expect(results.length).toBe(2); // Both Alice and Bob work at TechCorp
      expect(results).toContainEqual([1, 'employer', { _ref: 3 }]);
      expect(results).toContainEqual([2, 'employer', { _ref: 3 }]);
    });

    test('should query with multiple constraints', () => {
      const alice = identityManager.getObject(1);
      const results = kgOps.queryPattern({ 
        subject: alice, 
        predicate: 'age' 
      });

      expect(results.length).toBe(1);
      expect(results).toContainEqual([1, 'age', 30]);
    });

    test('should query all triples with empty pattern', () => {
      const results = kgOps.queryPattern({});

      expect(results.length).toBe(5); // All triples
      expect(results).toHaveLength(5);
    });

    test('should return empty array for no matches', () => {
      const results = kgOps.queryPattern({ predicate: 'nonexistent' });

      expect(results).toEqual([]);
    });

    test('should handle complex query patterns', () => {
      // Find all people (entities with age property)
      const peopleTriples = kgOps.queryPattern({ predicate: 'age' });
      const peopleIds = [...new Set(peopleTriples.map(t => t[0]))];
      
      expect(peopleIds).toEqual([1, 2]); // Alice and Bob

      // Get all properties of first person
      const person1Props = kgOps.queryPattern({ subject: identityManager.getObject(1) });
      const propNames = person1Props.map(t => t[1]);
      
      expect(propNames).toContain('age');
      expect(propNames).toContain('employer');
    });
  });

  describe('Batch Operations', () => {
    test('should add multiple triples in batch', () => {
      const obj1 = { type: 'item', id: 1 };
      const obj2 = { type: 'item', id: 2 };
      
      identityManager.register(obj1);
      identityManager.register(obj2);

      const triplesToAdd = [
        { subject: obj1, predicate: 'status', object: 'active' },
        { subject: obj1, predicate: 'value', object: 100 },
        { subject: obj2, predicate: 'status', object: 'inactive' },
        { subject: obj2, predicate: 'value', object: 200 }
      ];

      const results = kgOps.addTripleBatch(triplesToAdd);

      expect(results.every(r => r.success)).toBe(true);
      expect(kgOps.getTriples().length).toBe(4);
    });

    test('should remove multiple triples in batch', () => {
      const obj = { type: 'test' };
      identityManager.register(obj);

      // Add triples
      kgOps.addTriple(obj, 'prop1', 'value1');
      kgOps.addTriple(obj, 'prop2', 'value2');
      kgOps.addTriple(obj, 'prop3', 'value3');

      // Remove some in batch
      const triplesToRemove = [
        { subject: obj, predicate: 'prop1', object: 'value1' },
        { subject: obj, predicate: 'prop3', object: 'value3' }
      ];

      const results = kgOps.removeTripleBatch(triplesToRemove);

      expect(results.every(r => r.success)).toBe(true);
      expect(kgOps.getTriples().length).toBe(1);
      expect(kgOps.getTriples()[0][1]).toBe('prop2');
    });
  });

  describe('Serialization Integration', () => {
    test('should serialize object to triples using classic API', () => {
      const obj = {
        type: 'product',
        name: 'Widget',
        price: 29.99,
        inStock: true
      };

      const objId = identityManager.register(obj);
      
      // Use classic API to get triples
      const triples = kgOps.objectToTriples(obj);

      expect(triples).toHaveLength(4);
      expect(triples).toContainEqual([objId, 'type', 'product']);
      expect(triples).toContainEqual([objId, 'name', 'Widget']);
      expect(triples).toContainEqual([objId, 'price', 29.99]);
      expect(triples).toContainEqual([objId, 'inStock', true]);
    });

    test('should handle nested objects in serialization', () => {
      const address = { street: '123 Main St', city: 'Springfield' };
      const person = {
        type: 'person',
        name: 'Test User',
        address: address
      };

      const addressId = identityManager.register(address);
      const personId = identityManager.register(person);

      const personTriples = kgOps.objectToTriples(person);
      const addressTriples = kgOps.objectToTriples(address);

      // Check person triples
      expect(personTriples).toContainEqual([personId, 'type', 'person']);
      expect(personTriples).toContainEqual([personId, 'name', 'Test User']);
      expect(personTriples).toContainEqual([personId, 'address', { _ref: addressId }]);

      // Check address triples
      expect(addressTriples).toContainEqual([addressId, 'street', '123 Main St']);
      expect(addressTriples).toContainEqual([addressId, 'city', 'Springfield']);
    });
  });

  describe('Triple Store Management', () => {
    test('should clear all triples', () => {
      const obj = { type: 'test' };
      identityManager.register(obj);

      kgOps.addTriple(obj, 'prop1', 'value1');
      kgOps.addTriple(obj, 'prop2', 'value2');

      expect(kgOps.getTriples().length).toBe(2);

      kgOps.clearTriples();

      expect(kgOps.getTriples().length).toBe(0);
    });

    test('should get triple count', () => {
      expect(kgOps.getTripleCount()).toBe(0);

      const obj = { type: 'test' };
      identityManager.register(obj);

      kgOps.addTriple(obj, 'prop1', 'value1');
      kgOps.addTriple(obj, 'prop2', 'value2');

      expect(kgOps.getTripleCount()).toBe(2);
    });

    test('should check if triple exists', () => {
      const obj = { type: 'test' };
      const objId = identityManager.register(obj);

      kgOps.addTriple(obj, 'prop', 'value');

      expect(kgOps.hasTriple(obj, 'prop', 'value')).toBe(true);
      expect(kgOps.hasTriple(obj, 'prop', 'different')).toBe(false);
      expect(kgOps.hasTriple(obj, 'other', 'value')).toBe(false);
    });

    test('should export and import triple store', () => {
      const obj1 = { type: 'item1' };
      const obj2 = { type: 'item2' };
      
      identityManager.register(obj1);
      identityManager.register(obj2);

      kgOps.addTriple(obj1, 'prop', 'value1');
      kgOps.addTriple(obj2, 'prop', 'value2');

      // Export
      const exported = kgOps.exportTriples();
      expect(exported.version).toBe('1.0');
      expect(exported.triples).toHaveLength(2);

      // Clear and import
      kgOps.clearTriples();
      expect(kgOps.getTripleCount()).toBe(0);

      kgOps.importTriples(exported);
      expect(kgOps.getTripleCount()).toBe(2);
      expect(kgOps.getTriples()).toEqual(exported.triples);
    });
  });
});