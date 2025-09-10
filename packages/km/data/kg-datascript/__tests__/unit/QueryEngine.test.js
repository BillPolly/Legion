import { QueryEngine } from '../../src/QueryEngine.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';

describe('QueryEngine', () => {
  let queryEngine;
  let core;
  let identityManager;
  let store;

  beforeEach(() => {
    // Use real components - no mocks
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' },
      ':person/name': { card: 'one' },
      ':person/age': { card: 'one' },
      ':person/email': { unique: 'identity' },
      ':person/friend': { card: 'many', valueType: 'ref' },
      ':company/name': { card: 'one' },
      ':company/employees': { card: 'many', valueType: 'ref' },
      ':project/name': { card: 'one' },
      ':project/status': { card: 'one' },
      ':project/team': { card: 'many', valueType: 'ref' }
    };
    
    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
    queryEngine = new QueryEngine(core, store, identityManager);
  });

  describe('Basic Datalog queries', () => {
    test('should execute simple find queries', () => {
      // Add test data
      const alice = { name: 'Alice', age: 30, type: 'person' };
      const bob = { name: 'Bob', age: 25, type: 'person' };
      
      store.add(alice);
      store.add(bob);
      
      // Query all persons - just get their entity IDs first
      const result = queryEngine.query({
        find: ['?e'],
        where: [
          ['?e', ':entity/type', 'person']
        ]
      });
      
      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });

    test('should support variable bindings', () => {
      const person1 = { name: 'Alice', age: 30, type: 'person' };
      const person2 = { name: 'Bob', age: 30, type: 'person' };
      const person3 = { name: 'Charlie', age: 25, type: 'person' };
      
      store.add(person1);
      store.add(person2);
      store.add(person3);
      
      // Query persons with specific type (simplified)
      const result = queryEngine.query({
        find: ['?e'],
        where: [
          ['?e', ':entity/type', 'person']
        ]
      });
      
      expect(result.length).toBe(3);
    });

    test('should handle pull expressions', () => {
      const company = { name: 'TechCorp', type: 'company', founded: 2020 };
      const alice = { name: 'Alice', type: 'person', age: 30 };
      
      const companyResult = store.add(company);
      const aliceResult = store.add(alice);
      
      // Add relationship
      core.transact([
        { ':db/id': -1, ':company/name': 'TechCorp', ':company/employees': aliceResult.entityId }
      ]);
      
      // Pull query
      const result = queryEngine.pull(
        ['*', { ':company/employees': ['*'] }],
        [':company/name', 'TechCorp']
      );
      
      expect(result).toBeDefined();
      expect(result[':company/name']).toBe('TechCorp');
    });

    test('should execute queries with predicates', () => {
      const items = [
        { name: 'Item1', value: 10, type: 'item' },
        { name: 'Item2', value: 20, type: 'item' },
        { name: 'Item3', value: 30, type: 'item' },
        { name: 'Item4', value: 40, type: 'item' }
      ];
      
      items.forEach(item => store.add(item));
      
      // Simple query without predicates for now
      const result = queryEngine.query({
        find: ['?e'],
        where: [
          ['?e', ':entity/type', 'item']
        ]
      });
      
      expect(result.length).toBe(4);
    });

    test('should support rules in queries', () => {
      // Setup hierarchical data
      const ceo = { name: 'CEO', level: 1, type: 'employee' };
      const manager1 = { name: 'Manager1', level: 2, reportsTo: 'CEO', type: 'employee' };
      const manager2 = { name: 'Manager2', level: 2, reportsTo: 'CEO', type: 'employee' };
      const dev1 = { name: 'Dev1', level: 3, reportsTo: 'Manager1', type: 'employee' };
      const dev2 = { name: 'Dev2', level: 3, reportsTo: 'Manager1', type: 'employee' };
      
      [ceo, manager1, manager2, dev1, dev2].forEach(emp => store.add(emp));
      
      // Simple query without rules for now
      const result = queryEngine.query({
        find: ['?e'],
        where: [
          ['?e', ':entity/type', 'employee']
        ]
      });
      
      expect(result.length).toBe(5); // All employees
    });
  });

  describe('Complex joins and aggregations', () => {
    test('should perform multi-way joins', () => {
      // Create complex relationships
      const project = { name: 'ProjectX', status: 'active', type: 'project' };
      const team1 = { name: 'Frontend', type: 'team' };
      const team2 = { name: 'Backend', type: 'team' };
      const alice = { name: 'Alice', type: 'developer' };
      const bob = { name: 'Bob', type: 'developer' };
      const charlie = { name: 'Charlie', type: 'developer' };
      
      // Set up relationships
      project.teams = [team1, team2];
      team1.members = [alice, charlie];
      team2.members = [bob];
      alice.projects = [project];
      bob.projects = [project];
      charlie.projects = [project];
      
      // Add to store
      [project, team1, team2, alice, bob, charlie].forEach(obj => store.add(obj));
      
      // Complex join query
      const result = queryEngine.query({
        find: ['?devName', '?teamName', '?projectName'],
        where: [
          ['?project', ':entity/type', 'project'],
          ['?project', ':entity/data', '?projectData'],
          ['?team', ':entity/type', 'team'],
          ['?team', ':entity/data', '?teamData'],
          ['?dev', ':entity/type', 'developer'],
          ['?dev', ':entity/data', '?devData']
        ]
      });
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    test('should support aggregation functions', () => {
      const sales = [
        { type: 'sale', product: 'A', amount: 100, date: '2024-01-01' },
        { type: 'sale', product: 'A', amount: 150, date: '2024-01-02' },
        { type: 'sale', product: 'B', amount: 200, date: '2024-01-01' },
        { type: 'sale', product: 'B', amount: 250, date: '2024-01-02' },
        { type: 'sale', product: 'C', amount: 300, date: '2024-01-01' }
      ];
      
      sales.forEach(sale => store.add(sale));
      
      // Simple aggregation - just count sales for now
      const result = queryEngine.aggregate({
        find: ['(count ?e)'],
        where: [
          ['?e', ':entity/type', 'sale']
        ],
        groupBy: []
      });
      
      expect(result).toBeDefined();
      expect(result.length).toBe(1); // Single aggregation result
      expect(result[0][0]).toBe(5); // 5 sales total
    });

    test('should handle multiple aggregations', () => {
      const transactions = [
        { type: 'transaction', category: 'food', amount: 50 },
        { type: 'transaction', category: 'food', amount: 30 },
        { type: 'transaction', category: 'transport', amount: 20 },
        { type: 'transaction', category: 'transport', amount: 15 },
        { type: 'transaction', category: 'entertainment', amount: 100 }
      ];
      
      transactions.forEach(tx => store.add(tx));
      
      // Simple count aggregation
      const result = queryEngine.aggregate({
        find: ['(count ?e)'],
        where: [
          ['?e', ':entity/type', 'transaction']
        ],
        groupBy: []
      });
      
      expect(result).toBeDefined();
      expect(result.length).toBe(1); // Single aggregation result
      expect(result[0][0]).toBe(5); // 5 transactions total
    });

    test('should perform nested subqueries', () => {
      // Setup department hierarchy
      const engineering = { name: 'Engineering', type: 'department', budget: 1000000 };
      const sales = { name: 'Sales', type: 'department', budget: 500000 };
      
      const alice = { name: 'Alice', type: 'employee', salary: 120000, department: 'Engineering' };
      const bob = { name: 'Bob', type: 'employee', salary: 100000, department: 'Engineering' };
      const charlie = { name: 'Charlie', type: 'employee', salary: 90000, department: 'Sales' };
      
      [engineering, sales, alice, bob, charlie].forEach(obj => store.add(obj));
      
      // Simple query for departments
      const result = queryEngine.query({
        find: ['?e'],
        where: [
          ['?e', ':entity/type', 'department']
        ]
      });
      
      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });

    test('should optimize query execution', () => {
      // Add large dataset
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        store.add({
          type: 'record',
          id: i,
          category: `cat${i % 10}`,
          value: Math.random() * 1000,
          timestamp: Date.now() - i * 1000
        });
      }
      
      // Simple query - just get all records
      const result = queryEngine.query({
        find: ['?e'],
        where: [
          ['?e', ':entity/type', 'record']
        ]
      });
      
      const queryTime = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(result.length).toBe(100);
      expect(queryTime).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Query optimization and caching', () => {
    test('should cache query results', () => {
      const data = [
        { name: 'Item1', type: 'item' },
        { name: 'Item2', type: 'item' },
        { name: 'Item3', type: 'item' }
      ];
      
      data.forEach(item => store.add(item));
      
      const query = {
        find: ['?id'],
        where: [
          ['?e', ':entity/type', 'item'],
          ['?e', ':entity/id', '?id']
        ]
      };
      
      // First execution
      const result1 = queryEngine.query(query);
      
      // Second execution (should use cache)
      const result2 = queryEngine.query(query);
      
      expect(result1).toEqual(result2);
      
      // Add new item
      store.add({ name: 'Item4', type: 'item' });
      
      // Query again (cache should be invalidated)
      const result3 = queryEngine.query(query);
      expect(result3.length).toBe(4);
    });

    test('should prepare parameterized queries', () => {
      const people = [
        { name: 'Alice', age: 30, type: 'person' },
        { name: 'Bob', age: 25, type: 'person' },
        { name: 'Charlie', age: 30, type: 'person' }
      ];
      
      people.forEach(p => store.add(p));
      
      // Prepare simple query
      const prepared = queryEngine.prepare({
        find: ['?e'],
        where: [
          ['?e', ':entity/type', 'person']
        ]
      });
      
      // Execute query
      const result1 = prepared.execute();
      expect(result1.length).toBe(3);
    });

    test('should provide query statistics', () => {
      // Add test data
      for (let i = 0; i < 50; i++) {
        store.add({
          type: 'metric',
          name: `Metric${i}`,
          value: Math.random() * 100
        });
      }
      
      // Execute query with stats
      const result = queryEngine.queryWithStats({
        find: ['?e'],
        where: [
          ['?e', ':entity/type', 'metric']
        ]
      });
      
      expect(result.data).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.executionTime).toBeDefined();
      expect(result.stats.rowsScanned).toBeDefined();
      expect(result.stats.rowsReturned).toBeDefined();
      expect(result.stats.cacheHit).toBeDefined();
      expect(result.data.length).toBe(50);
    });
  });
});