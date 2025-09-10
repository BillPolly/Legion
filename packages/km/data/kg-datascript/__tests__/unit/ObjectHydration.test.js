import { QueryEngine } from '../../src/QueryEngine.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';

describe('Object Hydration', () => {
  let core;
  let identityManager;
  let store;
  let queryEngine;

  beforeEach(() => {
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' },
      ':person/name': { card: 'one' },
      ':person/age': { card: 'one' }
    };

    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
    queryEngine = new QueryEngine(core, store, identityManager);
  });

  afterEach(() => {
    core = null;
    identityManager = null;
    store = null;
    queryEngine = null;
  });

  describe('Single Object Return', () => {
    test('should return actual object for single entity queries', () => {
      const person = {
        type: 'person',
        name: 'Alice',
        age: 30
      };

      store.add(person);

      const query = {
        find: ['?objectId'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);

      // The result should be the actual JavaScript object
      const result = results[0];
      expect(result).toEqual(person);
      expect(result.name).toBe('Alice');
      expect(result.age).toBe(30);
      expect(result.type).toBe('person');
    });

    test('should maintain object identity for single object returns', () => {
      const person = {
        type: 'person',
        name: 'Bob',
        age: 25
      };

      store.add(person);

      const query = {
        find: ['?objectId'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      const returnedObject = results[0];

      // Should be the exact same object reference
      expect(returnedObject).toBe(person);
    });

    test('should handle queries that return no objects', () => {
      const query = {
        find: ['?objectId'],
        where: [
          ['?e', ':entity/type', 'nonexistent'],
          ['?e', ':entity/id', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Multiple Object Return', () => {
    test('should return array of actual objects for multi-entity queries', () => {
      const people = [
        { type: 'person', name: 'Alice', age: 30 },
        { type: 'person', name: 'Bob', age: 25 },
        { type: 'person', name: 'Carol', age: 35 }
      ];

      people.forEach(person => store.add(person));

      const query = {
        find: ['?objectId'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);

      // All results should be actual JavaScript objects
      results.forEach(result => {
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
        expect(result.type).toBe('person');
        expect(result.name).toBeDefined();
        expect(result.age).toBeDefined();
      });

      // Should contain all our test objects
      const names = results.map(obj => obj.name).sort();
      expect(names).toEqual(['Alice', 'Bob', 'Carol']);
    });

    test('should maintain object identity for multiple object returns', () => {
      const people = [
        { type: 'person', name: 'Alice', age: 30 },
        { type: 'person', name: 'Bob', age: 25 }
      ];

      people.forEach(person => store.add(person));

      const query = {
        find: ['?objectId'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      // Each returned object should be the exact same reference as the original
      results.forEach(returnedObject => {
        const originalObject = people.find(p => p.name === returnedObject.name);
        expect(returnedObject).toBe(originalObject);
      });
    });

    test('should handle filtered queries with object returns', () => {
      const people = [
        { type: 'person', name: 'Alice', age: 30, active: true },
        { type: 'person', name: 'Bob', age: 25, active: false },
        { type: 'person', name: 'Carol', age: 35, active: true }
      ];

      people.forEach(person => store.add(person));

      // Query specifically for people with type 'person' (all of them)
      const query = {
        find: ['?objectId'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      expect(results.length).toBe(3);

      // Filter for active people in application logic
      const activeResults = results.filter(person => person.active === true);
      expect(activeResults.length).toBe(2);
      
      const activeNames = activeResults.map(p => p.name).sort();
      expect(activeNames).toEqual(['Alice', 'Carol']);
    });
  });

  describe('Multi-Variable Queries', () => {
    test('should handle queries with multiple variables returning objects', () => {
      const person = {
        type: 'person',
        name: 'Alice',
        age: 30
      };

      store.add(person);

      const query = {
        find: ['?e', '?objectId'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);

      // Since we have two variables in find, result should be an array [entityId, object]
      const result = results[0];
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      
      const [entityId, objectResult] = result;
      expect(typeof entityId).toBe('number'); // DataScript entity IDs are numbers
      expect(objectResult).toBe(person); // Should be the exact same object reference
    });

    test('should handle queries with object-first variable ordering', () => {
      const person = {
        type: 'person',
        name: 'Bob',
        age: 25
      };

      store.add(person);

      const query = {
        find: ['?objectId', '?e'],  // Object first, entity second
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      expect(results.length).toBe(1);

      const result = results[0];
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      
      const [objectResult, entityId] = result;
      expect(objectResult).toBe(person); // Should be the exact same object reference
      expect(typeof entityId).toBe('number'); // DataScript entity IDs are numbers
    });
  });

  describe('Query Result Format Consistency', () => {
    test('should return consistent format for single variable object queries', () => {
      const objects = [
        { type: 'item', name: 'Widget A', price: 10.99 },
        { type: 'item', name: 'Widget B', price: 15.99 }
      ];

      objects.forEach(obj => store.add(obj));

      const query = {
        find: ['?objectId'],
        where: [
          ['?e', ':entity/type', 'item'],
          ['?e', ':entity/id', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      expect(results.length).toBe(2);

      // When find has single variable, results should be flat array of objects
      results.forEach(result => {
        expect(typeof result).toBe('object');
        expect(result.type).toBe('item');
        expect(result.name).toBeDefined();
        expect(result.price).toBeDefined();
      });
    });

    test('should return consistent format for multi-variable object queries', () => {
      const objects = [
        { type: 'item', name: 'Widget A', price: 10.99 },
        { type: 'item', name: 'Widget B', price: 15.99 }
      ];

      objects.forEach(obj => store.add(obj));

      const query = {
        find: ['?e', '?objectId'],
        where: [
          ['?e', ':entity/type', 'item'],
          ['?e', ':entity/id', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      expect(results.length).toBe(2);

      // When find has multiple variables, results should be array of arrays
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        
        const [entityId, objectResult] = result;
        expect(typeof entityId).toBe('number');
        expect(typeof objectResult).toBe('object');
        expect(objectResult.type).toBe('item');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed queries gracefully', () => {
      const query = {
        find: ['?objectId'],
        where: [
          ['?e', ':nonexistent/attribute', '?objectId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      // Should return empty array, not throw error
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('should handle queries with invalid entity references', () => {
      const query = {
        find: ['?objectId'],
        where: [
          [99999, ':entity/id', '?objectId'] // Non-existent entity ID
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });
});