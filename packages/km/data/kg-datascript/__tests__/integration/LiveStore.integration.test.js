import { LiveStore } from '../../src/LiveStore.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';

describe('LiveStore Integration', () => {
  let store;
  let core;
  let identityManager;

  beforeEach(() => {
    // Real components with comprehensive schema
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' },
      ':person/name': { card: 'one' },
      ':person/age': { card: 'one' },
      ':person/friend': { card: 'many', valueType: 'ref' },
      ':team/name': { card: 'one' },
      ':team/members': { card: 'many', valueType: 'ref' },
      ':team/lead': { card: 'one', valueType: 'ref' }
    };
    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
  });

  test('Multi-operation transactions with complex objects', () => {
    // Create a complex object graph
    const company = {
      name: 'TechCorp',
      founded: 2020,
      departments: []
    };

    const engineering = {
      name: 'Engineering',
      budget: 1000000,
      employees: []
    };

    const alice = {
      name: 'Alice',
      role: 'Engineer',
      salary: 120000
    };

    const bob = {
      name: 'Bob',
      role: 'Manager',
      salary: 150000
    };

    // Build relationships
    engineering.employees.push(alice, bob);
    engineering.manager = bob;
    company.departments.push(engineering);
    
    alice.department = engineering;
    alice.company = company;
    bob.department = engineering;
    bob.company = company;

    // Execute multi-operation transaction
    const result = store.transaction(() => {
      const companyResult = store.add(company);
      const engResult = store.add(engineering);
      const aliceResult = store.add(alice);
      const bobResult = store.add(bob);
      
      return {
        company: companyResult,
        engineering: engResult,
        alice: aliceResult,
        bob: bobResult
      };
    });

    expect(result.success).toBe(true);
    expect(result.data.company.success).toBe(true);
    expect(result.data.engineering.success).toBe(true);
    expect(result.data.alice.success).toBe(true);
    expect(result.data.bob.success).toBe(true);

    // Verify object relationships are preserved
    const retrievedCompany = store.getObject(result.data.company.objectId);
    expect(retrievedCompany).toBe(company);
    expect(retrievedCompany.departments[0]).toBe(engineering);
    expect(engineering.employees).toContain(alice);
    expect(engineering.employees).toContain(bob);
    expect(alice.company).toBe(company);
  });

  test('Complex query with live objects and DataScript', () => {
    // Setup test data
    const team1 = { name: 'Frontend', type: 'team' };
    const team2 = { name: 'Backend', type: 'team' };
    
    const dev1 = { name: 'Alice', type: 'developer', skills: ['React', 'TypeScript'] };
    const dev2 = { name: 'Bob', type: 'developer', skills: ['Node.js', 'Python'] };
    const dev3 = { name: 'Charlie', type: 'developer', skills: ['React', 'Node.js'] };
    
    team1.members = [dev1, dev3];
    team2.members = [dev2];
    
    dev1.team = team1;
    dev2.team = team2;
    dev3.team = team1;

    // Add to store
    [team1, team2, dev1, dev2, dev3].forEach(obj => store.add(obj));

    // Query developers in Frontend team
    const frontendDevs = store.queryObjects({
      type: 'developer',
      where: dev => dev.team && dev.team.name === 'Frontend'
    });

    expect(frontendDevs.length).toBe(2);
    expect(frontendDevs).toContain(dev1);
    expect(frontendDevs).toContain(dev3);

    // Query developers with React skills
    const reactDevs = store.queryObjects({
      type: 'developer',
      where: dev => dev.skills && dev.skills.includes('React')
    });

    expect(reactDevs.length).toBe(2);
    expect(reactDevs).toContain(dev1);
    expect(reactDevs).toContain(dev3);

    // Use DataScript query directly
    const dataScriptResults = store.query({
      find: ['?objId'],
      where: [
        ['?e', ':entity/type', 'developer'],
        ['?e', ':entity/id', '?objId']
      ]
    });

    expect(dataScriptResults.length).toBe(3);
    
    // Map back to objects
    const objects = dataScriptResults.map(([objId]) => store.getObject(objId)).filter(Boolean);
    expect(objects.length).toBe(3);
    expect(objects).toContain(dev1);
    expect(objects).toContain(dev2);
    expect(objects).toContain(dev3);
  });

  test('Transaction rollback with complex state', () => {
    const account1 = { id: 'acc1', balance: 1000 };
    const account2 = { id: 'acc2', balance: 500 };
    
    store.add(account1);
    store.add(account2);
    
    const initialBalance1 = account1.balance;
    const initialBalance2 = account2.balance;

    // Attempt transfer that will fail
    const result = store.transaction(() => {
      const transferAmount = 1500; // More than available
      
      if (account1.balance < transferAmount) {
        throw new Error('Insufficient funds');
      }
      
      account1.balance -= transferAmount;
      account2.balance += transferAmount;
      
      store.update(account1);
      store.update(account2);
      
      return { transferred: transferAmount };
    });

    expect(result.success).toBe(false);
    expect(result.error.message).toBe('Insufficient funds');
    
    // Verify balances are unchanged (rolled back)
    expect(account1.balance).toBe(initialBalance1);
    expect(account2.balance).toBe(initialBalance2);
    
    // Verify in DataScript
    const acc1Retrieved = store.getObject(identityManager.getId(account1));
    const acc2Retrieved = store.getObject(identityManager.getId(account2));
    
    expect(acc1Retrieved.balance).toBe(initialBalance1);
    expect(acc2Retrieved.balance).toBe(initialBalance2);
  });

  test('Large batch operations performance', () => {
    const startTime = Date.now();
    const batchSize = 1000;
    const objects = [];
    
    // Create large batch of objects
    for (let i = 0; i < batchSize; i++) {
      objects.push({
        id: i,
        name: `Object${i}`,
        value: Math.random() * 1000,
        timestamp: Date.now(),
        metadata: {
          created: new Date().toISOString(),
          version: '1.0.0',
          tags: ['test', 'batch', `group${i % 10}`]
        }
      });
    }

    // Batch add
    const addResults = store.addBatch(objects);
    
    expect(addResults.length).toBe(batchSize);
    expect(addResults.every(r => r.success)).toBe(true);
    expect(store.size()).toBe(batchSize);
    
    const addTime = Date.now() - startTime;
    
    // Query subset
    const queryStart = Date.now();
    const group5Objects = store.queryObjects({
      where: obj => obj.metadata && obj.metadata.tags && obj.metadata.tags.includes('group5')
    });
    
    const queryTime = Date.now() - queryStart;
    
    expect(group5Objects.length).toBe(100); // 10% should be in group5
    
    // Batch remove
    const removeStart = Date.now();
    const removeResults = store.removeBatch(objects.slice(0, 500));
    
    const removeTime = Date.now() - removeStart;
    
    expect(removeResults.length).toBe(500);
    expect(removeResults.every(r => r.success)).toBe(true);
    expect(store.size()).toBe(500);
    
    // Performance assertions (generous limits for MVP)
    expect(addTime).toBeLessThan(5000); // 5 seconds for 1000 adds
    expect(queryTime).toBeLessThan(1000); // 1 second for query
    expect(removeTime).toBeLessThan(3000); // 3 seconds for 500 removes
  });

  test('Object updates with DataScript synchronization', () => {
    const project = {
      name: 'ProjectX',
      status: 'planning',
      progress: 0,
      tasks: []
    };

    const task1 = { name: 'Design', status: 'pending', assignee: null };
    const task2 = { name: 'Implementation', status: 'pending', assignee: null };
    const developer = { name: 'Alice', role: 'Developer' };

    project.tasks.push(task1, task2);
    
    // Initial add
    store.add(project);
    store.add(task1);
    store.add(task2);
    store.add(developer);
    
    const projectId = identityManager.getId(project);

    // Update project
    project.status = 'in-progress';
    project.progress = 25;
    task1.status = 'completed';
    task1.assignee = developer;
    task2.status = 'in-progress';
    task2.assignee = developer;

    store.transaction(() => {
      store.update(project);
      store.update(task1);
      store.update(task2);
    });

    // Query updated state from DataScript
    const results = store.query({
      find: ['?data'],
      where: [
        ['?e', ':entity/id', projectId],
        ['?e', ':entity/data', '?data']
      ]
    });

    expect(results.length).toBe(1);
    const storedData = JSON.parse(results[0][0]);
    expect(storedData.status).toBe('in-progress');
    expect(storedData.progress).toBe(25);

    // Verify object references are maintained
    const retrievedProject = store.getObject(projectId);
    expect(retrievedProject).toBe(project);
    expect(retrievedProject.tasks[0]).toBe(task1);
    expect(task1.assignee).toBe(developer);
  });

  test('Concurrent modifications with consistency', () => {
    const sharedResource = {
      counter: 0,
      modifications: []
    };

    store.add(sharedResource);

    const operations = [];
    const operationCount = 50;

    // Simulate concurrent modifications
    for (let i = 0; i < operationCount; i++) {
      operations.push(
        new Promise((resolve) => {
          setTimeout(() => {
            const result = store.transaction(() => {
              sharedResource.counter++;
              sharedResource.modifications.push({
                operation: i,
                timestamp: Date.now(),
                value: sharedResource.counter
              });
              store.update(sharedResource);
              return sharedResource.counter;
            });
            resolve(result);
          }, Math.random() * 10); // Random delay to simulate concurrency
        })
      );
    }

    return Promise.all(operations).then(results => {
      // All operations should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // Counter should equal operation count
      expect(sharedResource.counter).toBe(operationCount);
      
      // All modifications should be recorded
      expect(sharedResource.modifications.length).toBe(operationCount);
      
      // Verify in DataScript
      const objId = identityManager.getId(sharedResource);
      const retrieved = store.getObject(objId);
      expect(retrieved.counter).toBe(operationCount);
      expect(retrieved.modifications.length).toBe(operationCount);
    });
  });
});