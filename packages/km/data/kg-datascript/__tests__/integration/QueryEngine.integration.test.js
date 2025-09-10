import { QueryEngine } from '../../src/QueryEngine.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';

describe('QueryEngine Integration', () => {
  let queryEngine;
  let core;
  let identityManager;
  let store;

  beforeEach(() => {
    // Comprehensive schema for integration tests
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' },
      ':person/name': { card: 'one' },
      ':person/age': { card: 'one' },
      ':person/email': { unique: 'identity' },
      ':person/friend': { card: 'many', valueType: 'ref' },
      ':person/employer': { card: 'one', valueType: 'ref' },
      ':company/name': { card: 'one' },
      ':company/employees': { card: 'many', valueType: 'ref' },
      ':company/founded': { card: 'one' },
      ':project/name': { card: 'one' },
      ':project/status': { card: 'one' },
      ':project/members': { card: 'many', valueType: 'ref' },
      ':project/lead': { card: 'one', valueType: 'ref' },
      ':task/title': { card: 'one' },
      ':task/assignee': { card: 'one', valueType: 'ref' },
      ':task/project': { card: 'one', valueType: 'ref' },
      ':task/status': { card: 'one' }
    };
    
    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
    queryEngine = new QueryEngine(core, store, identityManager);
  });

  test('Query with live objects - complete workflow', () => {
    // Create simple objects
    const alice = {
      name: 'Alice',
      age: 30,
      email: 'alice@techcorp.com',
      type: 'person',
      role: 'Engineering Manager'
    };

    const bob = {
      name: 'Bob',
      age: 25,
      email: 'bob@techcorp.com',
      type: 'person',
      role: 'Senior Developer'
    };

    // Add to store
    const aliceResult = store.add(alice);
    const bobResult = store.add(bob);

    // Simple query for objects
    const results = queryEngine.queryWithObjects({
      find: ['?personId'],
      where: [
        ['?e', ':entity/type', 'person'],
        ['?e', ':entity/id', '?personId']
      ]
    });

    // Results should contain actual objects
    expect(results).toBeDefined();
    expect(results.length).toBe(2);
    
    // Verify we get actual objects back
    results.forEach(person => {
      expect(person).toBeInstanceOf(Object);
      expect(person.name).toBeDefined();
      
      // Verify object identity is preserved
      const personFromStore = store.getObject(identityManager.getId(person));
      expect(personFromStore).toBe(person);
    });
  });

  test('Complex project management scenario', () => {
    // Create a simplified scenario with just tasks
    const tasks = [
      { title: 'Setup CI/CD', status: 'completed', type: 'task' },
      { title: 'Implement Auth', status: 'in-progress', type: 'task' },
      { title: 'Design UI', status: 'in-progress', type: 'task' },
      { title: 'Write Tests', status: 'pending', type: 'task' },
      { title: 'Requirements', status: 'completed', type: 'task' },
      { title: 'Architecture', status: 'in-progress', type: 'task' }
    ];

    // Add all tasks to store
    const taskResults = tasks.map(task => store.add(task));

    // Query all tasks
    const allTasks = queryEngine.queryWithObjects({
      find: ['?taskId'],
      where: [
        ['?e', ':entity/type', 'task'],
        ['?e', ':entity/id', '?taskId']
      ]
    });

    expect(allTasks.length).toBe(6);

    // Verify we can access task properties
    const inProgressTasks = allTasks.filter(task => task.status === 'in-progress');
    expect(inProgressTasks.length).toBe(3);

    // Test aggregation - simple count of tasks
    const taskCount = queryEngine.aggregate({
      find: ['(count ?e)'],
      where: [
        ['?e', ':entity/type', 'task']
      ],
      groupBy: []
    });

    expect(taskCount).toBeDefined();
    expect(taskCount[0][0]).toBe(6); // 6 total tasks
  });

  test('Reactive queries with live updates', () => {
    // Setup initial data
    const inventory = [
      { name: 'Widget A', quantity: 100, type: 'product' },
      { name: 'Widget B', quantity: 50, type: 'product' },
      { name: 'Widget C', quantity: 25, type: 'product' }
    ];

    inventory.forEach(item => store.add(item));

    // Simple query for all products
    const allProductsQuery = {
      find: ['?productId'],
      where: [
        ['?e', ':entity/type', 'product'],
        ['?e', ':entity/id', '?productId']
      ]
    };

    // Initial query - should return all 3 products
    let results = queryEngine.queryWithObjects(allProductsQuery);
    expect(results.length).toBe(3);
    
    // Verify we can access product properties
    const widgetC = results.find(product => product.name === 'Widget C');
    expect(widgetC).toBeDefined();
    expect(widgetC.quantity).toBe(25);

    // Update inventory
    inventory[1].quantity = 20; // Widget B updated
    store.update(inventory[1]);

    // Re-run query - should still return 3 products
    results = queryEngine.queryWithObjects(allProductsQuery);
    expect(results.length).toBe(3);
    
    // Check that the update was reflected
    const updatedWidgetB = results.find(product => product.name === 'Widget B');
    expect(updatedWidgetB).toBeDefined();
    expect(updatedWidgetB.quantity).toBe(20);

    // Update again
    inventory[2].quantity = 200; // Widget C restocked
    store.update(inventory[2]);

    // Final query
    results = queryEngine.queryWithObjects(allProductsQuery);
    expect(results.length).toBe(3);
    
    const restockedWidgetC = results.find(product => product.name === 'Widget C');
    expect(restockedWidgetC).toBeDefined();
    expect(restockedWidgetC.quantity).toBe(200);
  });

  test('Historical queries and time travel', () => {
    const document = {
      title: 'Important Doc',
      content: 'Version 1',
      type: 'document',
      version: 1
    };

    // Add initial version
    const docResult = store.add(document);
    const tx1 = core.db().tx;

    // Update document
    document.content = 'Version 2';
    document.version = 2;
    store.update(document);
    const tx2 = core.db().tx;

    // Update again
    document.content = 'Version 3';
    document.version = 3;
    store.update(document);
    const tx3 = core.db().tx;

    // Query current state
    const currentResult = queryEngine.queryWithObjects({
      find: ['?docId'],
      where: [
        ['?e', ':entity/type', 'document'],
        ['?e', ':entity/id', '?docId']
      ]
    });

    expect(currentResult.length).toBe(1);
    expect(currentResult[0].version).toBe(3);

    // Simple historical query test - just verify we can query historical state
    const historicalResult = queryEngine.queryAsOf(tx1, {
      find: ['?e'],
      where: [
        ['?e', ':entity/type', 'document']
      ]
    });

    expect(historicalResult).toBeDefined();
    expect(historicalResult.length).toBeGreaterThanOrEqual(1);
  });

  test('Performance with small dataset', () => {
    const startTime = Date.now();
    
    // Create small dataset for testing
    const testObjects = [];

    // Generate 50 test objects
    for (let i = 0; i < 50; i++) {
      testObjects.push({
        id: `item-${i}`,
        name: `Item ${i}`,
        type: 'test-item',
        category: ['A', 'B', 'C'][i % 3],
        value: i * 10
      });
    }

    // Batch add data
    const loadStart = Date.now();
    store.addBatch(testObjects);
    const loadTime = Date.now() - loadStart;

    expect(loadTime).toBeLessThan(1000); // Should load in under 1 second

    // Simple query
    const queryStart = Date.now();
    const results = queryEngine.queryWithObjects({
      find: ['?itemId'],
      where: [
        ['?e', ':entity/type', 'test-item'],
        ['?e', ':entity/id', '?itemId']
      ]
    });
    const queryTime = Date.now() - queryStart;

    expect(queryTime).toBeLessThan(500); // Query should complete quickly
    expect(results).toBeDefined();
    expect(results.length).toBe(50);

    // Verify data integrity
    expect(results[0].name).toBeDefined();
    expect(results[0].value).toBeDefined();

    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(2000); // Entire test under 2 seconds
  });
});