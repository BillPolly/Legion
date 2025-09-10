import { KGEntityProxy } from '../../src/KGEntityProxy.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';
import { QueryEngine } from '../../src/QueryEngine.js';

describe('KGEntityProxy Integration', () => {
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
      ':person/age': { card: 'one' },
      ':person/email': { unique: 'identity' },
      ':person/employer': { card: 'one', valueType: 'ref' },
      ':person/friends': { card: 'many', valueType: 'ref' },
      ':company/name': { card: 'one' },
      ':company/founded': { card: 'one' },
      ':company/employees': { card: 'many', valueType: 'ref' },
      ':project/name': { card: 'one' },
      ':project/lead': { card: 'one', valueType: 'ref' },
      ':project/team': { card: 'many', valueType: 'ref' }
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

  describe('Proxy with Live Store Integration', () => {
    test('should create proxy for objects in live store', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@techcorp.com'
      };

      // Add to store first
      store.add(person);

      // Create proxy should work
      const proxy = new KGEntityProxy(person, store, identityManager);

      expect(proxy).toBeDefined();
      expect(proxy.name).toBe('Alice Johnson');
      expect(proxy.age).toBe(30);
      expect(proxy.email).toBe('alice@techcorp.com');
      expect(proxy.type).toBe('person');
    });

    test('should maintain consistency between proxy and store queries', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        role: 'Engineer'
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        role: 'Designer'
      };

      // Add to store
      store.add(alice);
      store.add(bob);

      // Create proxy
      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Modify through proxy
      aliceProxy.age = 31;
      aliceProxy.status = 'senior';

      // Query through store should reflect proxy changes
      const query = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const people = queryEngine.queryWithObjects(query);
      const foundAlice = people.find(p => p.name === 'Alice Johnson');

      expect(foundAlice).toBe(alice); // Same reference
      expect(foundAlice.age).toBe(31); // Reflects proxy change
      expect(foundAlice.status).toBe('senior'); // New property added via proxy
    });

    test('should handle complex object relationships through proxy', () => {
      // Create related objects
      const techCorp = {
        type: 'company',
        name: 'TechCorp',
        founded: 2010,
        location: 'San Francisco'
      };

      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        employer: techCorp,
        skills: ['JavaScript', 'Python']
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        employer: techCorp,
        skills: ['Design', 'UX']
      };

      const project = {
        type: 'project',
        name: 'Web Platform',
        lead: alice,
        team: [alice, bob],
        status: 'active'
      };

      // Add all to store
      store.add(techCorp);
      store.add(alice);
      store.add(bob);
      store.add(project);

      // Create proxies
      const aliceProxy = new KGEntityProxy(alice, store, identityManager);
      const projectProxy = new KGEntityProxy(project, store, identityManager);

      // Test relationship access through proxy
      expect(aliceProxy.employer).toBe(techCorp);
      expect(aliceProxy.employer.name).toBe('TechCorp');
      expect(projectProxy.lead).toBe(alice);
      expect(projectProxy.team).toContain(alice);
      expect(projectProxy.team).toContain(bob);

      // Modify relationships through proxy
      aliceProxy.title = 'Senior Engineer';
      projectProxy.budget = 100000;

      // Verify changes are reflected in original objects
      expect(alice.title).toBe('Senior Engineer');
      expect(project.budget).toBe(100000);

      // Verify changes are queryable through store
      const projectQuery = {
        find: ['?project'],
        where: [
          ['?e', ':entity/type', 'project'],
          ['?e', ':entity/id', '?project']
        ]
      };

      const projects = queryEngine.queryWithObjects(projectQuery);
      expect(projects.length).toBe(1);
      expect(projects[0]).toBe(project);
      expect(projects[0].budget).toBe(100000);
    });

    test('should handle batch operations with proxies', () => {
      // Create test data
      const people = [];
      for (let i = 1; i <= 10; i++) {
        people.push({
          type: 'person',
          name: `Person ${i}`,
          age: 20 + i,
          active: i % 2 === 0
        });
      }

      // Add all to store
      store.addBatch(people);

      // Create proxies for all
      const proxies = people.map(person => new KGEntityProxy(person, store, identityManager));

      // Modify all through proxies
      proxies.forEach((proxy, index) => {
        proxy.index = index;
        proxy.modified = new Date();
        if (proxy.active) {
          proxy.status = 'verified';
        }
      });

      // Verify all changes are reflected in original objects
      people.forEach((person, index) => {
        expect(person.index).toBe(index);
        expect(person.modified).toBeInstanceOf(Date);
        if (person.active) {
          expect(person.status).toBe('verified');
        }
      });

      // Verify changes are queryable
      const query = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const queriedPeople = queryEngine.queryWithObjects(query);
      expect(queriedPeople.length).toBe(10);

      queriedPeople.forEach((person, idx) => {
        expect(person.index).toBeDefined();
        expect(person.modified).toBeInstanceOf(Date);
        if (person.active) {
          expect(person.status).toBe('verified');
        }
      });
    });

    test('should maintain proxy behavior across store transactions', () => {
      const document = {
        type: 'document',
        title: 'Important Document',
        content: 'Original content',
        version: 1.0
      };

      store.add(document);
      const proxy = new KGEntityProxy(document, store, identityManager);

      // Verify initial state
      expect(proxy.title).toBe('Important Document');
      expect(proxy.version).toBe(1.0);

      // Start transaction and modify through proxy
      const transaction = core.transact([]);
      proxy.content = 'Updated content';
      proxy.version = 1.1;
      proxy.lastModified = new Date();

      // Changes should be visible immediately
      expect(document.content).toBe('Updated content');
      expect(document.version).toBe(1.1);
      expect(document.lastModified).toBeInstanceOf(Date);

      // Verify through query
      const query = {
        find: ['?doc'],
        where: [
          ['?e', ':entity/type', 'document'],
          ['?e', ':entity/id', '?doc']
        ]
      };

      const docs = queryEngine.queryWithObjects(query);
      expect(docs.length).toBe(1);
      expect(docs[0]).toBe(document);
      expect(docs[0].content).toBe('Updated content');
      expect(docs[0].version).toBe(1.1);
    });

    test('should handle proxy deletion and store cleanup', () => {
      const tempObject = {
        type: 'temporary',
        name: 'Temporary Object',
        data: 'Some data'
      };

      store.add(tempObject);
      const proxy = new KGEntityProxy(tempObject, store, identityManager);

      // Verify object exists
      expect(proxy.name).toBe('Temporary Object');

      const query = {
        find: ['?obj'],
        where: [
          ['?e', ':entity/type', 'temporary'],
          ['?e', ':entity/id', '?obj']
        ]
      };

      let results = queryEngine.queryWithObjects(query);
      expect(results.length).toBe(1);
      expect(results[0]).toBe(tempObject);

      // Remove from store
      store.remove(tempObject);

      // Query should return empty
      results = queryEngine.queryWithObjects(query);
      expect(results.length).toBe(0);

      // Proxy should still work with the object reference but object is no longer in store
      expect(proxy.name).toBe('Temporary Object'); // Still accessible
      proxy.name = 'Modified Name'; // Still modifiable
      expect(tempObject.name).toBe('Modified Name'); // Changes still reflected
    });

    test('should handle concurrent proxy modifications', () => {
      const sharedObject = {
        type: 'shared',
        counter: 0,
        values: [],
        metadata: {
          accessCount: 0
        }
      };

      store.add(sharedObject);

      // Create multiple proxies to same object
      const proxy1 = new KGEntityProxy(sharedObject, store, identityManager);
      const proxy2 = new KGEntityProxy(sharedObject, store, identityManager);
      const proxy3 = new KGEntityProxy(sharedObject, store, identityManager);

      // Concurrent modifications
      proxy1.counter = 1;
      proxy2.counter = proxy2.counter + 1; // Should see proxy1's change
      proxy3.counter = proxy3.counter + 1; // Should see proxy2's change

      expect(sharedObject.counter).toBe(3);
      expect(proxy1.counter).toBe(3);
      expect(proxy2.counter).toBe(3);
      expect(proxy3.counter).toBe(3);

      // Modify arrays concurrently
      proxy1.values.push('value1');
      proxy2.values.push('value2');
      proxy3.values.push('value3');

      expect(sharedObject.values.length).toBe(3);
      expect(sharedObject.values).toEqual(['value1', 'value2', 'value3']);

      // Modify nested objects concurrently
      proxy1.metadata.lastAccess = 'proxy1';
      proxy2.metadata.accessCount = 10;
      proxy3.metadata.source = 'proxy3';

      expect(sharedObject.metadata.lastAccess).toBe('proxy1');
      expect(sharedObject.metadata.accessCount).toBe(10);
      expect(sharedObject.metadata.source).toBe('proxy3');

      // Verify all changes are queryable
      const query = {
        find: ['?obj'],
        where: [
          ['?e', ':entity/type', 'shared'],
          ['?e', ':entity/id', '?obj']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      expect(results.length).toBe(1);
      const result = results[0];
      
      expect(result).toBe(sharedObject);
      expect(result.counter).toBe(3);
      expect(result.values.length).toBe(3);
      expect(result.metadata.accessCount).toBe(10);
    });

  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle proxy operations on removed objects', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      // Initial access works
      expect(proxy.name).toBe('Alice Johnson');

      // Remove from store
      store.remove(person);

      // Proxy should still work with the object (but object no longer in store)
      expect(proxy.name).toBe('Alice Johnson');
      proxy.name = 'Alice Smith';
      expect(person.name).toBe('Alice Smith');
      expect(proxy.name).toBe('Alice Smith');
    });

    test('should handle complex nested modifications after store changes', () => {
      const complex = {
        type: 'complex',
        data: {
          level1: {
            level2: {
              level3: {
                value: 'deep value',
                items: [1, 2, 3]
              }
            }
          }
        }
      };

      store.add(complex);
      const proxy = new KGEntityProxy(complex, store, identityManager);

      // Deep modification
      proxy.data.level1.level2.level3.value = 'modified deep value';
      proxy.data.level1.level2.level3.items.push(4);
      proxy.data.newProperty = 'added at runtime';

      expect(complex.data.level1.level2.level3.value).toBe('modified deep value');
      expect(complex.data.level1.level2.level3.items).toEqual([1, 2, 3, 4]);
      expect(complex.data.newProperty).toBe('added at runtime');

      // Query should reflect changes
      const query = {
        find: ['?obj'],
        where: [
          ['?e', ':entity/type', 'complex'],
          ['?e', ':entity/id', '?obj']
        ]
      };

      const results = queryEngine.queryWithObjects(query);
      expect(results.length).toBe(1);
      expect(results[0]).toBe(complex);
      expect(results[0].data.newProperty).toBe('added at runtime');
    });

    test('should handle circular reference modifications through proxy', () => {
      const nodeA = { type: 'node', name: 'A', value: 1 };
      const nodeB = { type: 'node', name: 'B', value: 2 };

      // Create circular references
      nodeA.next = nodeB;
      nodeB.next = nodeA;
      nodeA.prev = nodeB;
      nodeB.prev = nodeA;

      store.add(nodeA);
      store.add(nodeB);

      const proxyA = new KGEntityProxy(nodeA, store, identityManager);
      const proxyB = new KGEntityProxy(nodeB, store, identityManager);

      // Modify through circular references
      proxyA.next.value = 20;
      proxyB.prev.value = 10;

      expect(nodeB.value).toBe(20); // Modified through proxyA.next
      expect(nodeA.value).toBe(10); // Modified through proxyB.prev

      // Add new properties through circular references
      proxyA.next.timestamp = Date.now();
      proxyB.prev.modified = true;

      expect(nodeB.timestamp).toBeDefined();
      expect(nodeA.modified).toBe(true);

      // Verify through queries
      const query = {
        find: ['?node'],
        where: [
          ['?e', ':entity/type', 'node'],
          ['?e', ':entity/id', '?node']
        ]
      };

      const nodes = queryEngine.queryWithObjects(query);
      expect(nodes.length).toBe(2);

      const foundA = nodes.find(n => n.name === 'A');
      const foundB = nodes.find(n => n.name === 'B');

      expect(foundA.value).toBe(10);
      expect(foundA.modified).toBe(true);
      expect(foundB.value).toBe(20);
      expect(foundB.timestamp).toBeDefined();
    });
  });
});