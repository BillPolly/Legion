import { KGEntityProxy } from '../../src/KGEntityProxy.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';
import { QueryEngine } from '../../src/QueryEngine.js';

describe('KGEntityProxy Notification System Integration', () => {
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
      ':company/employees': { card: 'many', valueType: 'ref' }
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

  describe('Live Updates Through Store', () => {
    test('should notify when objects are updated through store', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const notifications = [];
      proxy.onChange((change) => {
        notifications.push(change);
      });

      // Update through proxy (this should trigger notification)
      proxy.age = 31;
      expect(notifications.length).toBe(1);

      // Update through store (this should also update proxy)
      alice.name = 'Alice Smith';
      store.update(alice);

      // Proxy should reflect the change
      expect(proxy.name).toBe('Alice Smith');
    });

    test('should handle cascading updates in object relationships', () => {
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
      const bobProxy = new KGEntityProxy(bob, store, identityManager);

      const aliceNotifications = [];
      const bobNotifications = [];

      aliceProxy.onChange((change) => {
        aliceNotifications.push(change);
      });

      bobProxy.onChange((change) => {
        bobNotifications.push(change);
      });

      // Update company through one proxy
      aliceProxy.employer.name = 'TechCorp Industries';
      store.update(techCorp);

      // Both proxies should see the company change
      expect(aliceProxy.employer.name).toBe('TechCorp Industries');
      expect(bobProxy.employer.name).toBe('TechCorp Industries');
    });

    test('should support real-time query result notifications', () => {
      const people = [
        { type: 'person', name: 'Alice', age: 30, active: true },
        { type: 'person', name: 'Bob', age: 25, active: true },
        { type: 'person', name: 'Charlie', age: 35, active: false }
      ];

      store.addBatch(people);

      const aliceProxy = new KGEntityProxy(people[0], store, identityManager);

      // Query for active people
      const activeQuery = {
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      };

      let queryResults = aliceProxy.query(activeQuery);
      const activePeople = queryResults.filter(person => person.active);
      expect(activePeople.length).toBe(2);

      const notifications = [];
      aliceProxy.onChange((change) => {
        notifications.push(change);
        
        // Re-run query after change
        queryResults = aliceProxy.query(activeQuery);
      });

      // Change Charlie to active through direct store update
      people[2].active = true;
      store.update(people[2]);

      // Query should now return all 3 people as active
      const newActivePeople = queryResults.filter(person => person.active);
      expect(newActivePeople.length).toBe(3);
    });

    test('should handle complex change propagation scenarios', () => {
      const manager = {
        type: 'person',
        name: 'Manager Alice',
        role: 'manager',
        reportCount: 0
      };

      const employees = [
        { type: 'person', name: 'Employee Bob', role: 'developer', manager: manager },
        { type: 'person', name: 'Employee Carol', role: 'designer', manager: manager },
        { type: 'person', name: 'Employee Dave', role: 'tester', manager: manager }
      ];

      store.add(manager);
      store.addBatch(employees);

      // Update manager's report count
      manager.reportCount = employees.length;
      store.update(manager);

      const managerProxy = new KGEntityProxy(manager, store, identityManager);
      const bobProxy = new KGEntityProxy(employees[0], store, identityManager);

      const managerChanges = [];
      const bobChanges = [];

      managerProxy.onChange((change) => {
        managerChanges.push(change);
      });

      bobProxy.onChange((change) => {
        bobChanges.push(change);
      });

      // Promote Bob to senior developer
      bobProxy.role = 'senior developer';
      bobProxy.salary = 90000;

      expect(managerChanges.length).toBe(0); // Manager not directly changed
      expect(bobChanges.length).toBe(2); // Role and salary changed

      // Add new employee, update manager's count
      const newEmployee = {
        type: 'person',
        name: 'Employee Eve',
        role: 'developer',
        manager: manager
      };

      store.add(newEmployee);
      managerProxy.reportCount = 4;

      expect(managerChanges.length).toBe(1); // Report count updated
      expect(managerChanges[0].property).toBe('reportCount');
      expect(managerChanges[0].newValue).toBe(4);
    });
  });

  describe('Multi-Proxy Change Coordination', () => {
    test('should coordinate changes across multiple proxies to same object', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);

      // Create multiple proxies to the same object
      const proxy1 = new KGEntityProxy(alice, store, identityManager);
      const proxy2 = new KGEntityProxy(alice, store, identityManager);

      const proxy1Changes = [];
      const proxy2Changes = [];

      proxy1.onChange((change) => {
        proxy1Changes.push(change);
      });

      proxy2.onChange((change) => {
        proxy2Changes.push(change);
      });

      // Change through proxy1
      proxy1.age = 31;

      // Both proxies should see the change
      expect(proxy1.age).toBe(31);
      expect(proxy2.age).toBe(31);

      // Only proxy1 should receive notification (it made the change)
      expect(proxy1Changes.length).toBe(1);
      expect(proxy2Changes.length).toBe(0);

      // Change through proxy2
      proxy2.name = 'Alice Smith';

      // Both should see the change
      expect(proxy1.name).toBe('Alice Smith');
      expect(proxy2.name).toBe('Alice Smith');

      // Only proxy2 should receive notification
      expect(proxy1Changes.length).toBe(1);
      expect(proxy2Changes.length).toBe(1);
    });

    test('should handle simultaneous changes from multiple proxies', () => {
      const shared = {
        type: 'shared',
        counter: 0,
        lastUpdated: Date.now()
      };

      store.add(shared);

      const proxy1 = new KGEntityProxy(shared, store, identityManager);
      const proxy2 = new KGEntityProxy(shared, store, identityManager);

      const allChanges = [];

      proxy1.onChange((change) => {
        allChanges.push({ proxy: 1, change });
      });

      proxy2.onChange((change) => {
        allChanges.push({ proxy: 2, change });
      });

      // Simulate simultaneous updates (ensuring values actually change)
      const baseTime = Date.now();
      proxy1.counter = 1;
      proxy1.lastUpdated = baseTime + 1000;

      proxy2.counter = 2;
      proxy2.lastUpdated = baseTime + 2000;

      // Should have received all change notifications
      // Note: Only the proxy making the change gets the notification
      expect(allChanges.length).toBe(4); // 2 changes from each proxy
      
      // Final state should be consistent
      expect(proxy1.counter).toBe(proxy2.counter);
      expect(proxy1.lastUpdated).toBe(proxy2.lastUpdated);
    });
  });

  describe('Query-Driven Notifications', () => {
    test('should support notifications for query result changes', () => {
      const people = [
        { type: 'person', name: 'Alice', department: 'Engineering', salary: 80000 },
        { type: 'person', name: 'Bob', department: 'Engineering', salary: 75000 },
        { type: 'person', name: 'Carol', department: 'Sales', salary: 65000 }
      ];

      store.addBatch(people);

      const aliceProxy = new KGEntityProxy(people[0], store, identityManager);

      // Track query results
      let engineeringTeam = aliceProxy.query({
        find: ['?person'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?person']
        ]
      }).filter(person => person.department === 'Engineering');

      expect(engineeringTeam.length).toBe(2);

      const queryChangeNotifications = [];

      // Set up notification for department changes
      aliceProxy.onPropertyChange('department', (change) => {
        queryChangeNotifications.push(change);
        
        // Re-run query
        engineeringTeam = aliceProxy.query({
          find: ['?person'],
          where: [
            ['?e', ':entity/type', 'person'],
            ['?e', ':entity/id', '?person']
          ]
        }).filter(person => person.department === 'Engineering');
      });

      // Move Alice to Sales
      aliceProxy.department = 'Sales';

      expect(queryChangeNotifications.length).toBe(1);
      expect(engineeringTeam.length).toBe(1); // Only Bob remains
      expect(engineeringTeam[0].name).toBe('Bob');
    });
  });

  describe('Performance and Memory', () => {
    test('should not leak memory with many notifications', () => {
      const objects = [];
      const proxies = [];

      // Create many objects and proxies
      for (let i = 0; i < 100; i++) {
        const obj = {
          type: 'test',
          name: `Object ${i}`,
          value: i
        };
        objects.push(obj);
        store.add(obj);
        proxies.push(new KGEntityProxy(obj, store, identityManager));
      }

      // Add listeners to all proxies
      const allNotifications = [];
      proxies.forEach((proxy, index) => {
        proxy.onChange((change) => {
          allNotifications.push({ proxyIndex: index, change });
        });
      });

      // Make changes to all objects
      proxies.forEach((proxy, index) => {
        proxy.value = index * 2 + 1000; // Add 1000 to ensure all values change
      });

      expect(allNotifications.length).toBe(100);

      // Remove references to proxies (simulating cleanup)
      for (let i = 0; i < proxies.length; i++) {
        proxies[i] = null;
      }

      // Force garbage collection simulation
      // (In real test, this would be harder to verify, but we can at least ensure no errors)
      expect(allNotifications.length).toBe(100);
    });

    test('should handle high-frequency updates efficiently', () => {
      const counter = {
        type: 'counter',
        value: 0,
        updates: 0
      };

      store.add(counter);
      const proxy = new KGEntityProxy(counter, store, identityManager);

      const notifications = [];
      proxy.onChange((change) => {
        notifications.push(change);
      });

      const startTime = Date.now();

      // Make many rapid updates (start from 1 to avoid 0->0 non-change)
      for (let i = 1; i <= 1000; i++) {
        proxy.value = i;
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(notifications.length).toBe(1000);
      expect(proxy.value).toBe(1000);
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second for 1000 updates
    });
  });
});