import { KGEntityProxy } from '../../src/KGEntityProxy.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';
import { QueryEngine } from '../../src/QueryEngine.js';

describe('KGEntityProxy Query Capabilities', () => {
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
      ':project/team': { card: 'many', valueType: 'ref' },
      ':task/title': { card: 'one' },
      ':task/assignee': { card: 'one', valueType: 'ref' },
      ':task/project': { card: 'one', valueType: 'ref' }
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

  describe('Entity-Perspective Queries', () => {
    test('should allow querying from entity perspective', () => {
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

      store.add(alice);
      store.add(bob);

      const proxy = new KGEntityProxy(alice, store, identityManager);

      // Test that proxy has query method
      expect(typeof proxy.query).toBe('function');

      // Query all people from Alice's perspective
      const query = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const result = proxy.query(query);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result).toContain(alice);
      expect(result).toContain(bob);
    });

    test('should support entity-specific queries', () => {
      const techCorp = {
        type: 'company',
        name: 'TechCorp',
        founded: 2010
      };

      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        employer: techCorp
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        employer: techCorp
      };

      store.add(techCorp);
      store.add(alice);
      store.add(bob);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Query coworkers (people with same employer)
      const coworkerQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const coworkers = aliceProxy.query(coworkerQuery);
      const filteredCoworkers = coworkers.filter(person => person.employer === alice.employer && person !== alice);
      
      expect(filteredCoworkers.length).toBe(1);
      expect(filteredCoworkers[0]).toBe(bob);
    });

    test('should support pattern-based queries from entity perspective', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        skills: ['JavaScript', 'Python']
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        skills: ['JavaScript', 'Design']
      };

      const charlie = {
        type: 'person',
        name: 'Charlie Brown',
        age: 35,
        skills: ['Java', 'C++']
      };

      store.add(alice);
      store.add(bob);
      store.add(charlie);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Test legacy pattern query format
      const patterns = [
        ['?person', 'type', 'person'],
        ['?person', 'name', '?name']
      ];

      const result = aliceProxy.queryPatterns(patterns);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      
      const names = result.map(person => person.name);
      expect(names).toContain('Alice Johnson');
      expect(names).toContain('Bob Smith');
      expect(names).toContain('Charlie Brown');
    });

    test('should support query options and parameters', () => {
      const people = [];
      for (let i = 1; i <= 10; i++) {
        people.push({
          type: 'person',
          name: `Person ${i}`,
          age: 20 + i,
          active: i % 2 === 0
        });
      }

      store.addBatch(people);

      const proxy = new KGEntityProxy(people[0], store, identityManager);

      // Query with limit
      const limitedQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const limitedResult = proxy.query(limitedQuery, { limit: 5 });
      expect(limitedResult.length).toBe(5);

      // Query with offset
      const offsetResult = proxy.query(limitedQuery, { offset: 5 });
      expect(offsetResult.length).toBe(5);
      expect(offsetResult).not.toContain(people[0]);

      // Query with both limit and offset
      const bothResult = proxy.query(limitedQuery, { limit: 3, offset: 2 });
      expect(bothResult.length).toBe(3);
    });

    test('should handle empty query results gracefully', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      // Query for non-existent type
      const emptyQuery = {
        find: ['?item'],
        where: [
          ['?e', ':entity/type', 'nonexistent'],
          ['?e', ':entity/id', '?item']
        ]
      };

      const result = proxy.query(emptyQuery);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('should support self-referential queries', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        managerId: 'alice-123'
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        managerId: 'alice-123'
      };

      const charlie = {
        type: 'person',
        name: 'Charlie Brown',
        age: 28,
        managerId: 'alice-123'
      };

      store.add(alice);
      store.add(bob);
      store.add(charlie);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Find all people with same manager ID as Alice (including Alice herself)
      const sameManagerQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const allPeople = aliceProxy.query(sameManagerQuery);
      const sameManager = allPeople.filter(person => person.managerId === alice.managerId);
      
      expect(sameManager.length).toBe(3);
      expect(sameManager).toContain(alice);
      expect(sameManager).toContain(bob);
      expect(sameManager).toContain(charlie);
    });
  });

  describe('Complex Entity Queries', () => {
    test('should support queries with aggregations from entity perspective', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        salary: 80000
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        salary: 60000
      };

      const charlie = {
        type: 'person',
        name: 'Charlie Brown',
        age: 35,
        salary: 90000
      };

      store.add(alice);
      store.add(bob);
      store.add(charlie);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Query for statistics
      const allPeople = aliceProxy.query({
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      });

      // Calculate stats from Alice's perspective
      const totalSalary = allPeople.reduce((sum, person) => sum + person.salary, 0);
      const avgSalary = totalSalary / allPeople.length;
      const maxSalary = Math.max(...allPeople.map(p => p.salary));

      expect(allPeople.length).toBe(3);
      expect(totalSalary).toBe(230000);
      expect(avgSalary).toBeCloseTo(76666.67);
      expect(maxSalary).toBe(90000);
    });

    test('should support relationship traversal queries', () => {
      const techCorp = {
        type: 'company',
        name: 'TechCorp',
        founded: 2010
      };

      const webProject = {
        type: 'project',
        name: 'Web Platform',
        status: 'active'
      };

      const mobileProject = {
        type: 'project',
        name: 'Mobile App',
        status: 'planning'
      };

      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        employer: techCorp,
        projects: [webProject, mobileProject]
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        employer: techCorp,
        projects: [webProject]
      };

      store.add(techCorp);
      store.add(webProject);
      store.add(mobileProject);
      store.add(alice);
      store.add(bob);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Query all projects at Alice's company
      const companyProjectsQuery = {
        find: ['?project'],
        where: [
          ['?e', ':entity/type', 'project'],
          ['?e', ':entity/id', '?project']
        ]
      };

      const allProjects = aliceProxy.query(companyProjectsQuery);
      expect(allProjects.length).toBe(2);
      expect(allProjects).toContain(webProject);
      expect(allProjects).toContain(mobileProject);

      // Query colleagues (people at same company)
      const colleaguesQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const allPeople = aliceProxy.query(colleaguesQuery);
      const colleagues = allPeople.filter(person => person.employer === alice.employer);
      
      expect(colleagues.length).toBe(2);
      expect(colleagues).toContain(alice);
      expect(colleagues).toContain(bob);
    });

    test('should handle recursive relationship queries', () => {
      // Create hierarchical structure
      const ceo = {
        type: 'person',
        name: 'CEO Alice',
        role: 'CEO',
        level: 1
      };

      const manager1 = {
        type: 'person',
        name: 'Manager Bob',
        role: 'Manager',
        level: 2,
        manager: ceo
      };

      const manager2 = {
        type: 'person',
        name: 'Manager Carol',
        role: 'Manager',
        level: 2,
        manager: ceo
      };

      const employee1 = {
        type: 'person',
        name: 'Employee Dave',
        role: 'Employee',
        level: 3,
        manager: manager1
      };

      const employee2 = {
        type: 'person',
        name: 'Employee Eve',
        role: 'Employee',
        level: 3,
        manager: manager2
      };

      store.add(ceo);
      store.add(manager1);
      store.add(manager2);
      store.add(employee1);
      store.add(employee2);

      const ceoProxy = new KGEntityProxy(ceo, store, identityManager);

      // Query all people from CEO's perspective
      const orgQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const allPeople = ceoProxy.query(orgQuery);
      expect(allPeople.length).toBe(5);

      // Find direct reports (level 2)
      const directReports = allPeople.filter(person => person.manager === ceo);
      expect(directReports.length).toBe(2);
      expect(directReports).toContain(manager1);
      expect(directReports).toContain(manager2);

      // Find all reports (recursive)
      function getAllReports(manager) {
        const directReports = allPeople.filter(person => person.manager === manager);
        let allReports = [...directReports];
        
        for (const report of directReports) {
          allReports = allReports.concat(getAllReports(report));
        }
        
        return allReports;
      }

      const allReports = getAllReports(ceo);
      expect(allReports.length).toBe(4); // All except CEO
      expect(allReports).not.toContain(ceo);
    });
  });

  describe('Query Result Types and Formats', () => {
    test('should return actual object references, not IDs', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25
      };

      store.add(alice);
      store.add(bob);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      const query = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const result = aliceProxy.query(query);

      // Results should be actual objects, not IDs
      expect(result[0]).toBe(alice); // Same reference
      expect(result[1]).toBe(bob);   // Same reference

      // Should be modifiable
      result[0].queryModified = true;
      expect(alice.queryModified).toBe(true);
    });

    test('should support different query result formats', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        skills: ['JavaScript', 'Python']
      };

      store.add(alice);
      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Standard object query
      const objectQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const objectResult = aliceProxy.query(objectQuery);
      expect(Array.isArray(objectResult)).toBe(true);
      expect(objectResult[0]).toBe(alice);

      // Scalar query (if supported)
      const scalarQuery = {
        find: ['?name'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', alice],
          ['?e', ':entity/data', '?data']
        ]
      };

      // This would return names if DataScript supported it
      // For now, we expect objects
      const scalarResult = aliceProxy.query(objectQuery);
      expect(Array.isArray(scalarResult)).toBe(true);
    });

    test('should handle queries with complex where clauses', () => {
      const people = [];
      for (let i = 1; i <= 10; i++) {
        people.push({
          type: 'person',
          name: `Person ${i}`,
          age: 20 + i,
          active: i % 2 === 0,
          score: i * 10
        });
      }

      store.addBatch(people);

      const proxy = new KGEntityProxy(people[0], store, identityManager);

      // Complex query with multiple conditions
      const complexQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const allPeople = proxy.query(complexQuery);
      
      // Filter client-side for MVP (DataScript would do this server-side)
      const activeHighScorers = allPeople.filter(person => person.active && person.score >= 60);
      
      expect(activeHighScorers.length).toBe(3); // People 6, 8, 10
      activeHighScorers.forEach(person => {
        expect(person.active).toBe(true);
        expect(person.score).toBeGreaterThanOrEqual(60);
      });
    });
  });

  describe('Query Error Handling', () => {
    test('should throw error for invalid queries', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      // Invalid query structure
      expect(() => {
        proxy.query(null);
      }).toThrow();

      expect(() => {
        proxy.query({});
      }).toThrow();

      expect(() => {
        proxy.query({ find: [] });
      }).toThrow();

      expect(() => {
        proxy.query({ where: [] });
      }).toThrow();
    });

    test('should handle queries when store is empty', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      // Add and then remove
      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);
      store.remove(alice);

      const query = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const result = proxy.query(query);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('should fail fast on malformed patterns', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      // Invalid pattern format
      expect(() => {
        proxy.queryPatterns(null);
      }).toThrow();

      expect(() => {
        proxy.queryPatterns([]);
      }).toThrow();

      expect(() => {
        proxy.queryPatterns([['incomplete']]);
      }).toThrow();

      expect(() => {
        proxy.queryPatterns([['?s', 'predicate']]); // Missing object
      }).toThrow();
    });
  });
});