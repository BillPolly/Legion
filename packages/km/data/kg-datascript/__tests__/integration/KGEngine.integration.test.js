import { KGEngine } from '../../src/KGEngine.js';

describe('KGEngine Integration Tests', () => {
  let engine;

  beforeEach(() => {
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' }
    };
    
    engine = new KGEngine(schema);
  });

  afterEach(() => {
    if (engine) {
      engine.clear();
    }
  });

  describe('Complete Object → DataScript → Query → Hydration Flow', () => {
    test('should handle full object lifecycle with queries', () => {
      // Phase 1: Add objects using Object API
      const alice = { type: 'person', name: 'Alice', age: 30, city: 'New York' };
      const bob = { type: 'person', name: 'Bob', age: 25, city: 'Boston' };
      const company = { type: 'company', name: 'TechCorp', city: 'San Francisco' };
      
      const aliceResult = engine.add(alice);
      const bobResult = engine.add(bob);
      const companyResult = engine.add(company);
      
      expect(aliceResult.success).toBe(true);
      expect(bobResult.success).toBe(true);
      expect(companyResult.success).toBe(true);
      
      // Verify ObjectIdentityManager integration
      expect(alice.getId()).toBe(aliceResult.id);
      expect(bob.getId()).toBe(bobResult.id);
      expect(company.getId()).toBe(companyResult.id);
      
      // Phase 2: Query using Datalog (EDN strings)
      const peopleByDatalog = engine.query('[:find ?e :where [?e :entity/type "person"]]');
      expect(peopleByDatalog.length).toBe(2);
      expect(peopleByDatalog.every(p => p.type === 'person')).toBe(true);
      expect(peopleByDatalog.some(p => p.name === 'Alice')).toBe(true);
      expect(peopleByDatalog.some(p => p.name === 'Bob')).toBe(true);
      
      // Phase 3: Query using Object format
      const peopleByObject = engine.query({
        find: ['?e'],
        where: [['?e', ':entity/type', 'person']]
      });
      expect(peopleByObject.length).toBe(2);
      expect(peopleByObject).toEqual(peopleByDatalog);
      
      // Phase 4: Pattern queries
      const youngPeople = engine.queryPattern({ type: 'person', age: 25 });
      expect(youngPeople.length).toBe(1);
      expect(youngPeople[0].name).toBe('Bob');
      
      const peopleInBoston = engine.findAll({ type: 'person', city: 'Boston' });
      expect(peopleInBoston.length).toBe(1);
      expect(peopleInBoston[0]).toBe(bob); // Same object reference
      
      // Phase 5: Update objects and verify queries reflect changes
      engine.update(alice, { age: 31, city: 'Chicago' });
      
      const updatedAlice = engine.find({ type: 'person', name: 'Alice' });
      expect(updatedAlice.age).toBe(31);
      expect(updatedAlice.city).toBe('Chicago');
      expect(updatedAlice).toBe(alice); // Same object reference
      
      // Phase 6: Remove and verify
      engine.remove(bob);
      const remainingPeople = engine.query('[:find ?e :where [?e :entity/type "person"]]');
      expect(remainingPeople.length).toBe(1);
      expect(remainingPeople[0].name).toBe('Alice');
    });

    test('should handle complex multi-attribute queries', () => {
      // Add test data with multiple attributes
      const users = [
        { type: 'user', name: 'John', role: 'admin', active: true, score: 95 },
        { type: 'user', name: 'Jane', role: 'user', active: true, score: 87 },
        { type: 'user', name: 'Mike', role: 'user', active: false, score: 72 },
        { type: 'user', name: 'Sarah', role: 'admin', active: true, score: 98 }
      ];
      
      users.forEach(user => engine.add(user));
      
      // Query for active admins
      const activeAdmins = engine.query({
        find: ['?e'],
        where: [
          ['?e', ':entity/type', 'user'],
          ['?e', ':entity/role', 'admin'],
          ['?e', ':entity/active', true]
        ]
      });
      
      expect(activeAdmins.length).toBe(2);
      expect(activeAdmins.every(u => u.role === 'admin' && u.active === true)).toBe(true);
      
      // Complex pattern query
      const highScoreUsers = engine.findAll({ type: 'user', active: true });
      const topPerformers = highScoreUsers.filter(u => u.score > 90);
      
      expect(topPerformers.length).toBe(2); // John and Sarah
      expect(topPerformers.every(u => u.score > 90)).toBe(true);
    });
  });

  describe('Serialization → Deserialization → Persistence Flow', () => {
    test('should serialize and deserialize complete object graphs', () => {
      // Phase 1: Create complex object graph
      const person = { type: 'person', name: 'Alice', age: 30 };
      const company = { type: 'company', name: 'TechCorp' };
      const project = { type: 'project', name: 'WebApp', status: 'active' };
      
      engine.add(person);
      engine.add(company);
      engine.add(project);
      
      // Phase 2: Serialize individual objects
      const personTriples = engine.serialize(person);
      expect(personTriples.length).toBeGreaterThan(0);
      expect(personTriples.some(t => t[1] === 'name' && t[2] === 'Alice')).toBe(true);
      
      // Phase 3: Serialize entire store
      const allData = engine.serializeAll();
      expect(allData.objects).toBeDefined();
      expect(allData.triples).toBeDefined();
      expect(Object.keys(allData.objects).length).toBe(3);
      
      // Phase 4: Save to JSON
      const jsonData = engine.save();
      expect(typeof jsonData).toBe('string');
      const parsed = JSON.parse(jsonData);
      expect(parsed.objects).toBeDefined();
      expect(parsed.triples).toBeDefined();
      
      // Phase 5: Clear and reload
      engine.clear();
      expect(engine.getStats().objectCount).toBe(0);
      
      const loadResult = engine.load(jsonData);
      expect(loadResult.success).toBe(true);
      expect(loadResult.objectCount).toBe(3);
      
      // Phase 6: Verify all objects restored
      const restoredPeople = engine.findAll({ type: 'person' });
      const restoredCompanies = engine.findAll({ type: 'company' });
      const restoredProjects = engine.findAll({ type: 'project' });
      
      expect(restoredPeople.length).toBe(1);
      expect(restoredCompanies.length).toBe(1);
      expect(restoredProjects.length).toBe(1);
      
      expect(restoredPeople[0].name).toBe('Alice');
      expect(restoredCompanies[0].name).toBe('TechCorp');
      expect(restoredProjects[0].status).toBe('active');
    });

    test('should handle partial deserialization and merging', () => {
      // Add initial data
      const alice = { type: 'person', name: 'Alice', age: 30 };
      engine.add(alice);
      
      // Serialize and save
      const initialData = engine.save();
      
      // Add more data
      const bob = { type: 'person', name: 'Bob', age: 25 };
      engine.add(bob);
      
      expect(engine.findAll({ type: 'person' }).length).toBe(2);
      
      // Clear and load only initial data
      engine.clear();
      engine.load(initialData);
      
      const restored = engine.findAll({ type: 'person' });
      expect(restored.length).toBe(1);
      expect(restored[0].name).toBe('Alice');
      
      // Add new data after restoration
      const charlie = { type: 'person', name: 'Charlie', age: 35 };
      engine.add(charlie);
      
      const final = engine.findAll({ type: 'person' });
      expect(final.length).toBe(2);
      expect(final.some(p => p.name === 'Alice')).toBe(true);
      expect(final.some(p => p.name === 'Charlie')).toBe(true);
    });
  });

  describe('Cross-API Interactions (Object + Query + KG)', () => {
    test('should seamlessly integrate Object API, Query API, and KG API', () => {
      // Phase 1: Use Object API
      const person = { type: 'person', name: 'Alice', age: 30 };
      engine.add(person);
      
      // Phase 2: Use Classic KG API to add relationships
      const company = { type: 'company', name: 'TechCorp' };
      engine.add(company);
      
      engine.addTriple(person, 'worksFor', company);
      engine.addTriple(person, 'salary', 75000);
      engine.addTriple(company, 'industry', 'Technology');
      
      // Phase 3: Query using DataScript to find relationships
      const employeeQuery = engine.query({
        find: ['?person', '?company'],
        where: [
          ['?person', ':entity/type', 'person'],
          ['?company', ':entity/type', 'company']
        ]
      });
      
      expect(employeeQuery.length).toBe(1);
      expect(employeeQuery[0][0]).toBe(person);
      expect(employeeQuery[0][1]).toBe(company);
      
      // Phase 4: Use KG API to query triples
      const allTriples = engine.getTriples();
      const personTriples = allTriples.filter(t => t[0] === engine.identityManager.getId(person));
      
      expect(personTriples.length).toBeGreaterThan(0); // At least worksFor and salary
      expect(personTriples.some(t => t[1] === 'worksFor')).toBe(true);
      expect(personTriples.some(t => t[1] === 'salary' && t[2] === 75000)).toBe(true);
      
      // Phase 5: Update using Object API and KG API separately
      engine.update(person, { age: 31 });
      
      // Update KG triple separately (Object API and KG API are separate systems)
      engine.addTriple(person, 'position', 'Senior Developer');
      
      const updatedTriples = engine.getTriples();
      const updatedPersonTriples = updatedTriples.filter(t => t[0] === engine.identityManager.getId(person));
      
      expect(updatedPersonTriples.some(t => 
        t[1] === 'position' && t[2] === 'Senior Developer'
      )).toBe(true);
    });

    test('should handle mixed query types in single workflow', () => {
      // Setup complex data
      const people = [
        { type: 'person', name: 'Alice', department: 'Engineering', salary: 85000 },
        { type: 'person', name: 'Bob', department: 'Engineering', salary: 75000 },
        { type: 'person', name: 'Carol', department: 'Marketing', salary: 70000 },
        { type: 'person', name: 'David', department: 'Sales', salary: 80000 }
      ];
      
      people.forEach(p => engine.add(p));
      
      // Add relationships using KG API
      people.forEach(person => {
        engine.addTriple(person, 'employeeId', Math.floor(Math.random() * 10000));
      });
      
      // Mix different query approaches
      // 1. Datalog query
      const engineeringByDatalog = engine.query(
        '[:find ?e :where [?e :entity/department "Engineering"]]'
      );
      
      // 2. Object query  
      const engineeringByObject = engine.query({
        find: ['?e'],
        where: [['?e', ':entity/department', 'Engineering']]
      });
      
      // 3. Pattern query
      const engineeringByPattern = engine.findAll({ 
        type: 'person', 
        department: 'Engineering' 
      });
      
      // All should return same results
      expect(engineeringByDatalog.length).toBe(2);
      expect(engineeringByObject.length).toBe(2);
      expect(engineeringByPattern.length).toBe(2);
      
      // Verify they're the same objects
      const names1 = engineeringByDatalog.map(p => p.name).sort();
      const names2 = engineeringByObject.map(p => p.name).sort();
      const names3 = engineeringByPattern.map(p => p.name).sort();
      
      expect(names1).toEqual(['Alice', 'Bob']);
      expect(names2).toEqual(names1);
      expect(names3).toEqual(names1);
      
      // Verify object identity preserved
      expect(engineeringByDatalog[0] === engineeringByObject[0] || 
             engineeringByDatalog[0] === engineeringByObject[1]).toBe(true);
    });
  });

  describe('Statistics and Health Monitoring', () => {
    test('should provide accurate statistics across all operations', () => {
      // Initial state
      let stats = engine.getStats();
      expect(stats.objectCount).toBe(0);
      expect(stats.entityCount).toBe(0);
      expect(stats.tripleCount).toBe(0);
      expect(stats.subscriptionCount).toBe(0);
      
      // Add objects
      const objects = [
        { type: 'person', name: 'Alice' },
        { type: 'person', name: 'Bob' },
        { type: 'company', name: 'TechCorp' }
      ];
      
      objects.forEach(obj => engine.add(obj));
      
      stats = engine.getStats();
      expect(stats.objectCount).toBe(3);
      expect(stats.entityCount).toBe(3);
      expect(stats.tripleCount).toBeGreaterThan(0);
      
      // Add triples
      engine.addTriple(objects[0], 'worksFor', objects[2]);
      engine.addTriple(objects[1], 'worksFor', objects[2]);
      
      stats = engine.getStats();
      expect(stats.tripleCount).toBeGreaterThan(2);
      
      // Add subscriptions
      const unwatch1 = engine.watch(objects[0], () => {});
      const unwatch2 = engine.watch(objects[1], () => {});
      
      stats = engine.getStats();
      expect(stats.subscriptionCount).toBe(2);
      
      // Remove subscription
      unwatch1();
      
      stats = engine.getStats();
      expect(stats.subscriptionCount).toBe(1);
      
      // Clear and verify
      engine.clear();
      
      stats = engine.getStats();
      expect(stats.objectCount).toBe(0);
      expect(stats.entityCount).toBe(0);
      expect(stats.tripleCount).toBe(0);
      expect(stats.subscriptionCount).toBe(0);
    });
  });
});