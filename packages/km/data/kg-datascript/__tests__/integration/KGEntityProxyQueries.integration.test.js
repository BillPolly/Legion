import { KGEntityProxy } from '../../src/KGEntityProxy.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';
import { QueryEngine } from '../../src/QueryEngine.js';

describe('KGEntityProxy Query Integration', () => {
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

  describe('Live Data Query Integration', () => {
    test('should query live data from proxy perspective', () => {
      // Create a complex organizational structure
      const techCorp = {
        type: 'company',
        name: 'TechCorp',
        founded: 2010,
        industry: 'Technology'
      };

      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        role: 'Engineering Manager',
        employer: techCorp,
        startDate: '2020-01-15'
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        role: 'Senior Developer',
        employer: techCorp,
        startDate: '2021-03-10',
        manager: alice
      };

      const carol = {
        type: 'person',
        name: 'Carol Davis',
        age: 28,
        role: 'UX Designer',
        employer: techCorp,
        startDate: '2020-08-20',
        manager: alice
      };

      const webProject = {
        type: 'project',
        name: 'Web Platform Redesign',
        status: 'active',
        lead: alice,
        team: [alice, bob, carol],
        deadline: '2024-12-31'
      };

      const mobileProject = {
        type: 'project',
        name: 'Mobile App',
        status: 'planning',
        lead: bob,
        team: [bob, carol],
        deadline: '2025-06-30'
      };

      // Add all to store
      store.add(techCorp);
      store.add(alice);
      store.add(bob);
      store.add(carol);
      store.add(webProject);
      store.add(mobileProject);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Query from Alice's perspective
      const teamQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const allPeople = aliceProxy.query(teamQuery);
      expect(allPeople.length).toBe(3);
      expect(allPeople).toContain(alice);
      expect(allPeople).toContain(bob);
      expect(allPeople).toContain(carol);

      // Verify relationships are intact
      const subordinates = allPeople.filter(person => person.manager === alice);
      expect(subordinates.length).toBe(2);
      expect(subordinates).toContain(bob);
      expect(subordinates).toContain(carol);
    });

    test('should maintain consistency between proxy queries and direct store queries', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        skills: ['JavaScript', 'Management']
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        skills: ['Python', 'AI']
      };

      store.add(alice);
      store.add(bob);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Query through proxy
      const proxyQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const proxyResult = aliceProxy.query(proxyQuery);

      // Query directly through QueryEngine
      const directResult = queryEngine.queryWithObjects(proxyQuery);

      // Both should return same objects (same references)
      expect(proxyResult.length).toBe(directResult.length);
      expect(proxyResult).toContain(alice);
      expect(proxyResult).toContain(bob);
      expect(directResult).toContain(alice);
      expect(directResult).toContain(bob);

      // Verify same references
      const proxyAlice = proxyResult.find(p => p.name === 'Alice Johnson');
      const directAlice = directResult.find(p => p.name === 'Alice Johnson');
      expect(proxyAlice).toBe(directAlice);
      expect(proxyAlice).toBe(alice);
    });

    test('should reflect real-time changes in query results', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        active: true
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        active: true
      };

      const carol = {
        type: 'person',
        name: 'Carol Davis',
        age: 28,
        active: false
      };

      store.add(alice);
      store.add(bob);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Initial query
      const query = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      let result = aliceProxy.query(query);
      expect(result.length).toBe(2);

      // Add new person
      store.add(carol);

      // Query again - should see new person
      result = aliceProxy.query(query);
      expect(result.length).toBe(3);
      expect(result).toContain(carol);

      // Modify existing person
      bob.department = 'Engineering';
      bob.title = 'Senior Developer';

      // Query should reflect changes
      result = aliceProxy.query(query);
      const foundBob = result.find(p => p.name === 'Bob Smith');
      expect(foundBob.department).toBe('Engineering');
      expect(foundBob.title).toBe('Senior Developer');

      // Remove person
      store.remove(carol);

      // Query should no longer include removed person
      result = aliceProxy.query(query);
      expect(result.length).toBe(2);
      expect(result).not.toContain(carol);
    });

    test('should handle complex relationship queries with live updates', () => {
      // Create task management scenario
      const project = {
        type: 'project',
        name: 'Q4 Initiative',
        status: 'active'
      };

      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        role: 'Project Manager'
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        role: 'Developer'
      };

      const task1 = {
        type: 'task',
        title: 'Setup Infrastructure',
        assignee: bob,
        project: project,
        status: 'in-progress'
      };

      const task2 = {
        type: 'task',
        title: 'Design Database Schema',
        assignee: alice,
        project: project,
        status: 'completed'
      };

      store.add(project);
      store.add(alice);
      store.add(bob);
      store.add(task1);
      store.add(task2);

      const projectProxy = new KGEntityProxy(project, store, identityManager);

      // Query all tasks for this project
      const taskQuery = {
        find: ['?task'],
        where: [
          ['?e', ':entity/type', 'task'],
          ['?e', ':entity/id', '?task']
        ]
      };

      let projectTasks = projectProxy.query(taskQuery);
      let filteredTasks = projectTasks.filter(task => task.project === project);
      expect(filteredTasks.length).toBe(2);

      // Add new task
      const task3 = {
        type: 'task',
        title: 'Implement Frontend',
        assignee: bob,
        project: project,
        status: 'planned'
      };

      store.add(task3);

      // Query should include new task
      projectTasks = projectProxy.query(taskQuery);
      filteredTasks = projectTasks.filter(task => task.project === project);
      expect(filteredTasks.length).toBe(3);
      expect(filteredTasks).toContain(task3);

      // Update task status
      task1.status = 'completed';

      // Query should reflect updated status
      projectTasks = projectProxy.query(taskQuery);
      const updatedTask1 = projectTasks.find(t => t.title === 'Setup Infrastructure');
      expect(updatedTask1.status).toBe('completed');

      // Count completed tasks
      const completedTasks = projectTasks.filter(task => 
        task.project === project && task.status === 'completed'
      );
      expect(completedTasks.length).toBe(2);
    });
  });

  describe('Pattern Query Integration', () => {
    test('should support legacy pattern queries with live data', () => {
      const company = {
        type: 'company',
        name: 'InnovateCorp',
        founded: 2015,
        size: 'medium'
      };

      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        employer: company,
        position: 'CTO'
      };

      const bob = {
        type: 'person',
        name: 'Bob Smith',
        age: 25,
        employer: company,
        position: 'Lead Developer'
      };

      store.add(company);
      store.add(alice);
      store.add(bob);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Legacy pattern format
      const patterns = [
        ['?person', 'type', 'person'],
        ['?person', 'name', '?name'],
        ['?person', 'position', '?position']
      ];

      const results = aliceProxy.queryPatterns(patterns);
      expect(results.length).toBe(2);

      const resultNames = results.map(person => person.name);
      expect(resultNames).toContain('Alice Johnson');
      expect(resultNames).toContain('Bob Smith');

      const aliceResult = results.find(p => p.name === 'Alice Johnson');
      const bobResult = results.find(p => p.name === 'Bob Smith');

      expect(aliceResult.position).toBe('CTO');
      expect(bobResult.position).toBe('Lead Developer');
    });

    test('should handle mixed object and pattern queries', () => {
      const project1 = {
        type: 'project',
        name: 'Alpha Project',
        priority: 'high',
        budget: 100000
      };

      const project2 = {
        type: 'project',
        name: 'Beta Project',
        priority: 'medium',
        budget: 50000
      };

      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        projects: [project1, project2]
      };

      store.add(project1);
      store.add(project2);
      store.add(alice);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      // Standard object query
      const objectQuery = {
        find: ['?project'],
        where: [
          ['?e', ':entity/type', 'project'],
          ['?e', ':entity/id', '?project']
        ]
      };

      const objectResults = aliceProxy.query(objectQuery);
      expect(objectResults.length).toBe(2);

      // Legacy pattern query
      const patterns = [
        ['?project', 'type', 'project'],
        ['?project', 'priority', '?priority']
      ];

      const patternResults = aliceProxy.queryPatterns(patterns);
      expect(patternResults.length).toBe(2);

      // Both should return same projects
      expect(objectResults).toContain(project1);
      expect(objectResults).toContain(project2);
      expect(patternResults).toContain(project1);
      expect(patternResults).toContain(project2);

      // Filter high priority projects
      const highPriorityProjects = patternResults.filter(p => p.priority === 'high');
      expect(highPriorityProjects.length).toBe(1);
      expect(highPriorityProjects[0]).toBe(project1);
    });
  });

  describe('Performance and Scale Integration', () => {
    test('should handle large dataset queries efficiently', () => {
      const startTime = Date.now();

      // Create large dataset
      const companies = [];
      const people = [];
      const projects = [];

      // 10 companies
      for (let c = 1; c <= 10; c++) {
        companies.push({
          type: 'company',
          name: `Company ${c}`,
          founded: 2000 + c,
          industry: ['Tech', 'Finance', 'Healthcare'][c % 3]
        });
      }

      // 100 people distributed across companies
      for (let p = 1; p <= 100; p++) {
        people.push({
          type: 'person',
          name: `Person ${p}`,
          age: 20 + (p % 40),
          employer: companies[p % 10],
          active: p % 3 !== 0
        });
      }

      // 50 projects distributed across companies
      for (let pr = 1; pr <= 50; pr++) {
        projects.push({
          type: 'project',
          name: `Project ${pr}`,
          status: ['active', 'completed', 'planned'][pr % 3],
          lead: people[pr % 100],
          budget: (pr * 10000) + 50000
        });
      }

      // Add all to store
      store.addBatch(companies);
      store.addBatch(people);
      store.addBatch(projects);

      const setupTime = Date.now() - startTime;
      expect(setupTime).toBeLessThan(2000);

      // Query from first person's perspective
      const personProxy = new KGEntityProxy(people[0], store, identityManager);

      const queryStartTime = Date.now();

      // Large query for all people
      const peopleQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      const allPeople = personProxy.query(peopleQuery);
      expect(allPeople.length).toBe(100);

      // Large query for all projects
      const projectsQuery = {
        find: ['?project'],
        where: [
          ['?e', ':entity/type', 'project'],
          ['?e', ':entity/id', '?project']
        ]
      };

      const allProjects = personProxy.query(projectsQuery);
      expect(allProjects.length).toBe(50);

      const queryTime = Date.now() - queryStartTime;
      expect(queryTime).toBeLessThan(1000);

      // Complex filtering
      const filterStartTime = Date.now();

      const activePeople = allPeople.filter(person => person.active);
      const activeProjects = allProjects.filter(project => project.status === 'active');
      const highBudgetProjects = allProjects.filter(project => project.budget > 200000);

      expect(activePeople.length).toBeGreaterThan(60);
      expect(activeProjects.length).toBeGreaterThan(15);
      expect(highBudgetProjects.length).toBeGreaterThan(30);

      const filterTime = Date.now() - filterStartTime;
      expect(filterTime).toBeLessThan(500);

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(4000);
    });

    test('should maintain query performance with concurrent modifications', () => {
      // Create base dataset
      const items = [];
      for (let i = 1; i <= 200; i++) {
        items.push({
          type: 'item',
          name: `Item ${i}`,
          value: i * 10,
          category: ['A', 'B', 'C', 'D', 'E'][i % 5],
          active: i % 2 === 0
        });
      }

      store.addBatch(items);

      const proxy = new KGEntityProxy(items[0], store, identityManager);

      const query = {
        find: ['?item'],
        where: [
          ['?e', ':entity/type', 'item'],
          ['?e', ':entity/id', '?item']
        ]
      };

      // Perform queries while modifying data concurrently
      const startTime = Date.now();

      for (let iteration = 0; iteration < 10; iteration++) {
        // Query
        const queryStart = Date.now();
        const results = proxy.query(query);
        expect(results.length).toBeGreaterThanOrEqual(200);
        const queryDuration = Date.now() - queryStart;
        expect(queryDuration).toBeLessThan(100);

        // Modify some items
        for (let i = 0; i < 20; i++) {
          const item = items[i + (iteration * 20) % items.length];
          item.modified = true;
          item.iteration = iteration;
          item.timestamp = Date.now();
        }

        // Add/remove items
        if (iteration % 3 === 0) {
          const newItem = {
            type: 'item',
            name: `Dynamic Item ${iteration}`,
            value: iteration * 100,
            category: 'DYNAMIC',
            active: true
          };
          
          store.add(newItem);
          items.push(newItem);
        }
      }

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(3000);

      // Final verification
      const finalResults = proxy.query(query);
      expect(finalResults.length).toBeGreaterThan(200);

      // Verify modifications are reflected
      const modifiedItems = finalResults.filter(item => item.modified === true);
      expect(modifiedItems.length).toBeGreaterThan(100);
    });
  });
});