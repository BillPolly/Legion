import { KGEngine } from '../../src/KGEngine.js';

describe('KGEngine Unit Tests', () => {
  let engine;

  beforeEach(() => {
    engine = new KGEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.destroy();
    }
  });

  describe('Object Management', () => {
    test('should add and retrieve objects', () => {
      const obj = { name: 'Test', value: 42 };
      const id = engine.add(obj, 'test-1');
      
      expect(id).toBe('test-1');
      
      const retrieved = engine.get('test-1');
      expect(retrieved).toEqual(obj);
    });

    test('should generate ID if not provided', () => {
      const obj = { name: 'Test' };
      const id = engine.add(obj);
      
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      
      const retrieved = engine.get(id);
      expect(retrieved).toEqual(obj);
    });

    test('should update objects', () => {
      const obj = { name: 'Test', value: 1 };
      const id = engine.add(obj, 'update-test');
      
      const updated = engine.update(obj, { value: 2, extra: 'data' });
      
      expect(updated).toBe(obj); // Same object reference
      expect(obj.value).toBe(2);
      expect(obj.extra).toBe('data');
      
      const retrieved = engine.get('update-test');
      expect(retrieved).toEqual(obj);
    });

    test('should remove objects', () => {
      const obj = { name: 'Test' };
      const id = engine.add(obj, 'remove-test');
      
      expect(engine.get('remove-test')).toEqual(obj);
      
      engine.remove('remove-test');
      
      expect(engine.get('remove-test')).toBeNull();
    });

    test('should track object identity', () => {
      const obj = { name: 'Test' };
      const id = engine.add(obj, 'identity-test');
      
      const objId = engine.getObjectId(obj);
      expect(objId).toBe('identity-test');
    });
  });

  describe('Querying', () => {
    beforeEach(() => {
      engine.add({ name: 'Alice', role: 'Developer', age: 30 }, 'alice');
      engine.add({ name: 'Bob', role: 'Designer', age: 25 }, 'bob');
      engine.add({ name: 'Charlie', role: 'Developer', age: 35 }, 'charlie');
      engine.add({ name: 'Diana', role: 'Manager', age: 40 }, 'diana');
    });

    test('should find objects by pattern', () => {
      const developers = engine.find({ role: 'Developer' });
      
      expect(developers).toHaveLength(2);
      expect(developers.map(d => d.name).sort()).toEqual(['Alice', 'Charlie']);
    });

    test('should find objects with multiple criteria', () => {
      const results = engine.find({ role: 'Developer', age: 30 });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alice');
    });

    test('should return empty array for no matches', () => {
      const results = engine.find({ role: 'Architect' });
      
      expect(results).toEqual([]);
    });

    test('should get all objects', () => {
      const all = engine.getAll();
      
      expect(all).toHaveLength(4);
      expect(all.map(o => o.name).sort()).toEqual(['Alice', 'Bob', 'Charlie', 'Diana']);
    });
  });

  describe('Change Notifications', () => {
    test('should notify on add', () => {
      let changeCount = 0;
      let lastChange = null;
      
      const unsubscribe = engine.onChange((change) => {
        changeCount++;
        lastChange = change;
      });
      
      const obj = { name: 'Test' };
      engine.add(obj, 'notify-test');
      
      expect(changeCount).toBe(1);
      expect(lastChange.objects).toContain(obj);
      
      unsubscribe();
    });

    test('should notify on update', () => {
      const obj = { name: 'Test', value: 1 };
      engine.add(obj, 'update-notify');
      
      let changeCount = 0;
      const unsubscribe = engine.onChange(() => {
        changeCount++;
      });
      
      engine.update(obj, { value: 2 });
      
      expect(changeCount).toBe(1);
      
      unsubscribe();
    });

    test('should support multiple listeners', () => {
      let count1 = 0;
      let count2 = 0;
      
      const unsub1 = engine.onChange(() => count1++);
      const unsub2 = engine.onChange(() => count2++);
      
      engine.add({ name: 'Test' }, 'multi-notify');
      
      expect(count1).toBe(1);
      expect(count2).toBe(1);
      
      unsub1();
      unsub2();
    });

    test('should unsubscribe correctly', () => {
      let count = 0;
      const unsubscribe = engine.onChange(() => count++);
      
      engine.add({ name: 'Test1' }, 'unsub-1');
      expect(count).toBe(1);
      
      unsubscribe();
      
      engine.add({ name: 'Test2' }, 'unsub-2');
      expect(count).toBe(1); // Should not increase
    });
  });

  describe('DataScript Integration', () => {
    test('should expose DataScript query interface', () => {
      engine.add({ name: 'Test', value: 42 }, 'ds-test');
      
      // Direct DataScript query
      const results = engine.query(
        '[:find ?id :where [?e :object/id ?id]]'
      );
      
      expect(results).toBeTruthy();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should expose DataScript database', () => {
      const db = engine.db();
      expect(db).toBeTruthy();
    });

    test('should expose DataScript transact', () => {
      const result = engine.transact([]);
      expect(result).toBeTruthy();
      expect(result.db_after).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined gracefully', () => {
      expect(engine.get(null)).toBeNull();
      expect(engine.get(undefined)).toBeNull();
      expect(engine.get('non-existent')).toBeNull();
    });

    test('should handle removing non-existent object', () => {
      // Should not throw - just silently do nothing
      expect(() => {
        engine.remove('non-existent');
      }).not.toThrow();
    });

    test('should handle updating non-tracked object', () => {
      const obj = { name: 'Untracked' };
      
      expect(() => {
        engine.update(obj, { value: 1 });
      }).toThrow();
    });

    test('should clear all data', () => {
      engine.add({ name: 'Test1' }, 'clear-1');
      engine.add({ name: 'Test2' }, 'clear-2');
      
      expect(engine.getAll()).toHaveLength(2);
      
      engine.clear();
      
      expect(engine.getAll()).toHaveLength(0);
      expect(engine.get('clear-1')).toBeNull();
      expect(engine.get('clear-2')).toBeNull();
    });
  });
});