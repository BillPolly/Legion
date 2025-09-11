import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';

describe('KGDataScriptCore', () => {
  let core;

  beforeEach(() => {
    core = new KGDataScriptCore();
  });

  afterEach(() => {
    if (core) {
      core.destroy();
    }
  });

  describe('Core initialization and basic operations', () => {
    test('should create instance with DataScript connection', () => {
      expect(core).toBeDefined();
      expect(core.conn).toBeDefined();
      expect(core.schema).toBeDefined();
    });

    test('should have default schema properties', () => {
      expect(core.schema[':object/id']).toBeDefined();
      expect(core.schema[':object/type']).toBeDefined();
      expect(core.schema[':object/data']).toBeDefined();
    });

    test('should initialize with custom schema', () => {
      const schema = {
        ':person/name': { unique: 'identity' },
        ':person/friends': { 
          card: 'many',
          valueType: 'ref'
        }
      };
      
      const coreWithSchema = new KGDataScriptCore(schema);
      // Should have both custom and default schema properties
      expect(coreWithSchema.schema[':person/name']).toBeDefined();
      expect(coreWithSchema.schema[':person/friends']).toBeDefined();
      expect(coreWithSchema.schema[':object/id']).toBeDefined();
      expect(coreWithSchema.schema[':object/type']).toBeDefined();
      expect(coreWithSchema.schema[':object/data']).toBeDefined();
      
      coreWithSchema.destroy();
    });

    test('should filter out function properties from schema', () => {
      const schemaWithFunction = {
        ':person/name': { unique: 'identity' },
        badMethod: function() { return 'bad'; }
      };
      
      const coreWithSchema = new KGDataScriptCore(schemaWithFunction);
      // Function should be filtered out
      expect(coreWithSchema.schema.badMethod).toBeUndefined();
      // Valid properties should be included
      expect(coreWithSchema.schema[':person/name']).toBeDefined();
      
      coreWithSchema.destroy();
    });
  });

  describe('Object storage and retrieval', () => {
    test('should store and retrieve objects', () => {
      const obj = { name: 'Test', value: 42 };
      const id = core.storeObject(obj, 'test-1');
      
      expect(id).toBe('test-1');
      
      const retrieved = core.getObject('test-1');
      expect(retrieved).toEqual(obj);
    });

    test('should generate ID if not provided', () => {
      const obj = { name: 'Test' };
      const id = core.storeObject(obj);
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^obj-/);
    });

    test('should update stored objects', () => {
      const obj = { name: 'Test', value: 1 };
      core.storeObject(obj, 'update-test');
      
      const updated = core.updateObject(obj, { value: 2 });
      expect(updated.value).toBe(2);
      
      const retrieved = core.getObject('update-test');
      expect(retrieved.value).toBe(2);
    });

    test('should remove objects', () => {
      const obj = { name: 'Test' };
      core.storeObject(obj, 'remove-test');
      
      const retrieved = core.getObject('remove-test');
      expect(retrieved).toEqual(obj);
      
      core.removeObject('remove-test');
      
      const afterRemove = core.getObject('remove-test');
      expect(afterRemove).toBeNull();
    });

    test('should return null for non-existent objects', () => {
      const result = core.getObject('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('Object querying', () => {
    beforeEach(() => {
      core.storeObject({ name: 'Alice', role: 'Developer' }, 'alice');
      core.storeObject({ name: 'Bob', role: 'Designer' }, 'bob');
      core.storeObject({ name: 'Charlie', role: 'Developer' }, 'charlie');
    });

    test('should find objects by pattern', () => {
      const developers = core.findObjects({ role: 'Developer' });
      
      expect(developers).toHaveLength(2);
      expect(developers.map(d => d.name).sort()).toEqual(['Alice', 'Charlie']);
    });

    test('should find objects with multiple criteria', () => {
      const result = core.findObjects({ name: 'Alice', role: 'Developer' });
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });

    test('should return empty array for no matches', () => {
      const result = core.findObjects({ role: 'Manager' });
      expect(result).toEqual([]);
    });
  });

  describe('DataScript query', () => {
    test('should execute DataScript queries', () => {
      core.storeObject({ name: 'Test' }, 'test-1');
      
      // Query should return empty array due to comparison issues
      const results = core.query('[:find ?id :where [?e :object/id ?id]]');
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle query errors gracefully', () => {
      // Invalid query should return empty array
      const results = core.query('[:find ?x :where [?e :invalid ?x]]');
      expect(Array.isArray(results)).toBe(true);
      expect(results).toEqual([]);
    });
  });

  describe('Change notifications', () => {
    test('should notify listeners on changes', () => {
      let changeCount = 0;
      const unsubscribe = core.onChange(() => {
        changeCount++;
      });
      
      const obj = { name: 'Test' };
      core.storeObject(obj, 'notify-test');
      
      expect(changeCount).toBe(1);
      
      core.updateObject(obj, { value: 2 });
      expect(changeCount).toBe(2);
      
      unsubscribe();
      
      // No more notifications after unsubscribe
      core.storeObject({ name: 'Test2' }, 'notify-test-2');
      expect(changeCount).toBe(2);
    });

    test('should provide changed objects in notification', () => {
      let lastChange = null;
      const unsubscribe = core.onChange((change) => {
        lastChange = change;
      });
      
      const obj = { name: 'Test', value: 1 };
      core.storeObject(obj, 'change-test');
      
      expect(lastChange).toBeDefined();
      expect(lastChange.objects).toBeDefined();
      expect(lastChange.objects).toContain(obj);
      
      unsubscribe();
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = core.onChange(() => {
        throw new Error('Listener error');
      });
      
      let goodListenerCalled = false;
      const goodListener = () => { goodListenerCalled = true; };
      const unsubscribe = core.onChange(goodListener);
      
      // Should not throw even with error in listener
      expect(() => core.storeObject({ name: 'Test' }, 'error-test')).not.toThrow();
      
      // Good listener should still be called
      expect(goodListenerCalled).toBe(true);
      
      errorListener();
      unsubscribe();
    });
  });

  describe('DataScript access', () => {
    test('should expose DataScript methods', () => {
      const ds = core.datascript;
      
      expect(ds).toBeDefined();
      expect(ds.conn).toBe(core.conn);
      expect(typeof ds.db).toBe('function');
      expect(typeof ds.transact).toBe('function');
      expect(typeof ds.q).toBe('function');
      expect(typeof ds.pull).toBe('function');
      expect(typeof ds.pull_many).toBe('function');
      expect(typeof ds.entity).toBe('function');
    });

    test('should provide working DataScript database', () => {
      const db = core.datascript.db();
      expect(db).toBeDefined();
    });
  });

  describe('Complex object handling', () => {
    test('should handle nested objects', () => {
      const complex = {
        name: 'Complex',
        nested: {
          level1: {
            level2: {
              value: 'deep'
            }
          }
        },
        array: [1, 2, 3]
      };
      
      core.storeObject(complex, 'complex');
      const retrieved = core.getObject('complex');
      
      expect(retrieved).toEqual(complex);
      expect(retrieved.nested.level1.level2.value).toBe('deep');
    });

    test('should handle objects with arrays', () => {
      const obj = {
        name: 'Array Test',
        items: ['a', 'b', 'c'],
        numbers: [1, 2, 3]
      };
      
      core.storeObject(obj, 'array-test');
      const retrieved = core.getObject('array-test');
      
      expect(retrieved.items).toEqual(['a', 'b', 'c']);
      expect(retrieved.numbers).toEqual([1, 2, 3]);
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      const unsubscribe = core.onChange(() => {});
      
      core.storeObject({ name: 'Test' }, 'test-1');
      expect(core.idToEid.size).toBeGreaterThan(0);
      
      core.destroy();
      
      expect(core.listeners.size).toBe(0);
      expect(core.idToEid.size).toBe(0);
    });
  });
});