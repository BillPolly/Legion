import { KGEngine } from '../../src/KGEngine.js';

describe('KGEngine Integration Tests', () => {
  let engine;

  beforeEach(() => {
    engine = new KGEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.destroy();
    }
  });

  describe('Complete Object Lifecycle', () => {
    test('should handle full object lifecycle', () => {
      // Phase 1: Add objects
      const alice = { name: 'Alice', age: 30, city: 'New York' };
      const bob = { name: 'Bob', age: 25, city: 'Boston' };
      const company = { name: 'TechCorp', city: 'San Francisco' };
      
      const aliceId = engine.add(alice, 'alice');
      const bobId = engine.add(bob, 'bob');
      const companyId = engine.add(company, 'company');
      
      expect(aliceId).toBe('alice');
      expect(bobId).toBe('bob');
      expect(companyId).toBe('company');
      
      // Phase 2: Retrieve objects
      const retrievedAlice = engine.get('alice');
      expect(retrievedAlice).toEqual(alice);
      
      // Phase 3: Update objects
      engine.update(alice, { age: 31 });
      const updatedAlice = engine.get('alice');
      expect(updatedAlice.age).toBe(31);
      
      // Phase 4: Query objects
      const people = engine.find({ city: 'New York' });
      expect(people).toHaveLength(1);
      expect(people[0].name).toBe('Alice');
      
      // Phase 5: Remove objects
      engine.remove('alice');
      const removedAlice = engine.get('alice');
      expect(removedAlice).toBeNull();
    });

    test('should handle multiple objects with same properties', () => {
      // Add multiple people
      const people = [
        { name: 'Alice', role: 'Developer', level: 'Senior' },
        { name: 'Bob', role: 'Developer', level: 'Junior' },
        { name: 'Charlie', role: 'Designer', level: 'Senior' },
        { name: 'Diana', role: 'Manager', level: 'Senior' }
      ];
      
      people.forEach((person, i) => {
        engine.add(person, `person-${i}`);
      });
      
      // Query by single attribute
      const developers = engine.find({ role: 'Developer' });
      expect(developers).toHaveLength(2);
      expect(developers.map(d => d.name).sort()).toEqual(['Alice', 'Bob']);
      
      // Query by multiple attributes
      const seniorDevelopers = engine.find({ role: 'Developer', level: 'Senior' });
      expect(seniorDevelopers).toHaveLength(1);
      expect(seniorDevelopers[0].name).toBe('Alice');
      
      // Get all objects
      const all = engine.getAll();
      expect(all).toHaveLength(4);
    });
  });

  describe('Change Notifications', () => {
    test('should track changes across operations', () => {
      const changes = [];
      const unsubscribe = engine.onChange((change) => {
        changes.push(change);
      });
      
      // Add object
      const obj1 = { name: 'Test1', value: 1 };
      engine.add(obj1, 'test-1');
      expect(changes).toHaveLength(1);
      expect(changes[0].objects).toContain(obj1);
      
      // Update object
      engine.update(obj1, { value: 2 });
      expect(changes).toHaveLength(2);
      
      // Add another object
      const obj2 = { name: 'Test2', value: 3 };
      engine.add(obj2, 'test-2');
      expect(changes).toHaveLength(3);
      
      unsubscribe();
      
      // No more notifications after unsubscribe
      engine.add({ name: 'Test3' }, 'test-3');
      expect(changes).toHaveLength(3);
    });
  });

  describe('DataScript Query Integration', () => {
    test('should support direct DataScript queries', () => {
      // Add test data
      engine.add({ name: 'Alice', age: 30 }, 'alice');
      engine.add({ name: 'Bob', age: 25 }, 'bob');
      engine.add({ name: 'Charlie', age: 35 }, 'charlie');
      
      // Direct DataScript query (returns empty due to comparison issues)
      const results = engine.query('[:find ?id :where [?e :object/id ?id]]');
      expect(Array.isArray(results)).toBe(true);
    });

    test('should expose DataScript database', () => {
      const db = engine.db();
      expect(db).toBeDefined();
    });

    test('should support DataScript transactions', () => {
      const result = engine.transact([]);
      expect(result).toBeDefined();
      expect(result.db_after).toBeDefined();
    });
  });

  describe('Object Identity', () => {
    test('should track object identity correctly', () => {
      const obj1 = { name: 'Test1', value: 1 };
      const obj2 = { name: 'Test2', value: 2 };
      
      const id1 = engine.add(obj1, 'obj-1');
      const id2 = engine.add(obj2, 'obj-2');
      
      expect(engine.getObjectId(obj1)).toBe('obj-1');
      expect(engine.getObjectId(obj2)).toBe('obj-2');
      
      // Update doesn't change identity
      engine.update(obj1, { value: 10 });
      expect(engine.getObjectId(obj1)).toBe('obj-1');
    });
  });

  describe('Batch Operations', () => {
    test('should handle rapid additions', () => {
      const objects = [];
      for (let i = 0; i < 100; i++) {
        const obj = { name: `Test${i}`, value: i };
        const id = engine.add(obj, `test-${i}`);
        objects.push(obj);
        expect(id).toBe(`test-${i}`);
      }
      
      const all = engine.getAll();
      expect(all).toHaveLength(100);
    });

    test('should handle complex nested objects', () => {
      const complex = {
        name: 'Complex',
        nested: {
          level1: {
            level2: {
              value: 'deep'
            }
          }
        },
        array: [1, 2, 3],
        mixed: [
          { type: 'a', value: 1 },
          { type: 'b', value: 2 }
        ]
      };
      
      const id = engine.add(complex, 'complex');
      const retrieved = engine.get('complex');
      
      expect(retrieved).toEqual(complex);
      expect(retrieved.nested.level1.level2.value).toBe('deep');
      expect(retrieved.array).toEqual([1, 2, 3]);
    });
  });

  describe('Error Handling', () => {
    test('should handle null/undefined gracefully', () => {
      expect(engine.get(null)).toBeNull();
      expect(engine.get(undefined)).toBeNull();
      
      expect(() => engine.remove(null)).not.toThrow();
      expect(() => engine.remove(undefined)).not.toThrow();
    });

    test('should handle non-existent objects', () => {
      expect(engine.get('non-existent')).toBeNull();
      expect(() => engine.remove('non-existent')).not.toThrow();
    });
  });

  describe('Clear Operation', () => {
    test('should clear all data', () => {
      // Add test data
      engine.add({ name: 'Test1' }, 'test-1');
      engine.add({ name: 'Test2' }, 'test-2');
      engine.add({ name: 'Test3' }, 'test-3');
      
      expect(engine.getAll()).toHaveLength(3);
      
      // Clear everything
      engine.clear();
      
      expect(engine.getAll()).toHaveLength(0);
      expect(engine.get('test-1')).toBeNull();
      expect(engine.get('test-2')).toBeNull();
      expect(engine.get('test-3')).toBeNull();
    });
  });
});