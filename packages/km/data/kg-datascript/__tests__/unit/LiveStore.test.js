import { LiveStore } from '../../src/LiveStore.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';

describe('LiveStore', () => {
  let store;
  let core;
  let identityManager;

  beforeEach(() => {
    // Use real components - no mocks
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' }
    };
    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
  });

  describe('Add operations with objects', () => {
    test('should add single object to store', () => {
      const obj = { name: 'Alice', age: 30 };
      
      const result = store.add(obj);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.objectId).toBeDefined();
      expect(typeof result.objectId).toBe('number');
      expect(result.entityId).toBeDefined();
    });

    test('should preserve object identity when adding', () => {
      const obj = { name: 'Bob', age: 25 };
      
      const result = store.add(obj);
      const retrievedObj = store.getObject(result.objectId);
      
      expect(retrievedObj).toBe(obj); // Same reference
    });

    test('should handle adding same object multiple times', () => {
      const obj = { name: 'Charlie', age: 35 };
      
      const result1 = store.add(obj);
      const result2 = store.add(obj);
      
      // Should return same object ID
      expect(result2.objectId).toBe(result1.objectId);
      expect(result2.alreadyExists).toBe(true);
    });

    test('should add multiple objects in batch', () => {
      const objects = [
        { name: 'Object1', value: 1 },
        { name: 'Object2', value: 2 },
        { name: 'Object3', value: 3 }
      ];
      
      const results = store.addBatch(objects);
      
      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(new Set(results.map(r => r.objectId)).size).toBe(3); // All unique IDs
    });

    test('should serialize complex objects when adding', () => {
      const complexObj = {
        name: 'Complex',
        nested: {
          level1: {
            level2: 'deep value'
          }
        },
        array: [1, 2, 3],
        date: new Date('2024-01-01')
      };
      
      const result = store.add(complexObj);
      
      expect(result.success).toBe(true);
      
      // Verify it's stored in DataScript
      const query = store.query({
        find: ['?data'],
        where: [
          ['?e', ':entity/id', result.objectId],
          ['?e', ':entity/data', '?data']
        ]
      });
      
      expect(query.length).toBeGreaterThan(0);
      const storedData = JSON.parse(query[0][0]);
      expect(storedData.name).toBe('Complex');
      expect(storedData.nested.level1.level2).toBe('deep value');
    });

    test('should handle circular references gracefully', () => {
      const obj1 = { name: 'Object1' };
      const obj2 = { name: 'Object2' };
      obj1.ref = obj2;
      obj2.ref = obj1; // Circular reference
      
      const result = store.add(obj1);
      
      expect(result.success).toBe(true);
      expect(result.hasCircularRef).toBe(true);
    });
  });

  describe('Remove operations with objects', () => {
    test('should remove object from store', () => {
      const obj = { name: 'ToRemove', value: 42 };
      
      const addResult = store.add(obj);
      const removeResult = store.remove(obj);
      
      expect(removeResult.success).toBe(true);
      expect(removeResult.objectId).toBe(addResult.objectId);
      expect(removeResult.removed).toBe(true);
    });

    test('should clear object identity when removed', () => {
      const obj = { name: 'ToClear' };
      
      store.add(obj);
      store.remove(obj);
      
      const retrieved = store.getObject(identityManager.getId(obj));
      expect(retrieved).toBeUndefined();
    });

    test('should handle removing non-existent object', () => {
      const obj = { name: 'NotInStore' };
      
      const result = store.remove(obj);
      
      expect(result.success).toBe(false);
      expect(result.notFound).toBe(true);
    });

    test('should remove multiple objects in batch', () => {
      const objects = [
        { name: 'Batch1' },
        { name: 'Batch2' },
        { name: 'Batch3' }
      ];
      
      store.addBatch(objects);
      const results = store.removeBatch(objects);
      
      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.removed)).toBe(true);
    });

    test('should remove by object ID', () => {
      const obj = { name: 'RemoveById' };
      
      const addResult = store.add(obj);
      const removeResult = store.removeById(addResult.objectId);
      
      expect(removeResult.success).toBe(true);
      expect(removeResult.removed).toBe(true);
      expect(store.getObject(addResult.objectId)).toBeUndefined();
    });
  });

  describe('Transaction atomicity', () => {
    test('should execute atomic transactions', () => {
      const objects = [
        { name: 'Tx1', value: 1 },
        { name: 'Tx2', value: 2 },
        { name: 'Tx3', value: 3 }
      ];
      
      const result = store.transaction(() => {
        const results = [];
        for (const obj of objects) {
          results.push(store.add(obj));
        }
        return results;
      });
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(3);
      expect(result.data.every(r => r.success)).toBe(true);
    });

    test('should rollback on transaction failure', () => {
      const obj1 = { name: 'WillSucceed' };
      const obj2 = null; // Will cause failure
      
      const result = store.transaction(() => {
        store.add(obj1);
        store.add(obj2); // This should throw
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      // obj1 should not be in store due to rollback
      const query = store.query({
        find: ['?e'],
        where: [['?e', ':entity/data', '?data']]
      });
      
      const hasObj1 = query.some(([e]) => {
        const entity = core.entity(e);
        if (entity && entity[':entity/data']) {
          const data = JSON.parse(entity[':entity/data']);
          return data.name === 'WillSucceed';
        }
        return false;
      });
      
      expect(hasObj1).toBe(false);
    });

    test('should maintain consistency during concurrent operations', () => {
      const counter = { value: 0 };
      store.add(counter);
      
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          store.transaction(() => {
            counter.value++;
            store.update(counter);
            return counter.value;
          })
        );
      }
      
      // All operations should complete
      operations.forEach(op => {
        expect(op.success).toBe(true);
      });
      
      // Final value should be consistent
      expect(counter.value).toBe(10);
    });

    test('should handle nested transactions', () => {
      const parent = { name: 'Parent', children: [] };
      const child1 = { name: 'Child1' };
      const child2 = { name: 'Child2' };
      
      const result = store.transaction(() => {
        const parentResult = store.add(parent);
        
        const childResults = store.transaction(() => {
          const c1 = store.add(child1);
          const c2 = store.add(child2);
          
          // Link children to parent
          parent.children.push(child1, child2);
          store.update(parent);
          
          return [c1, c2];
        });
        
        return { parent: parentResult, children: childResults.data };
      });
      
      expect(result.success).toBe(true);
      expect(result.data.parent.success).toBe(true);
      expect(result.data.children.length).toBe(2);
      expect(parent.children.length).toBe(2);
    });
  });

  describe('Query operations', () => {
    test('should query objects from store', () => {
      const objects = [
        { type: 'person', name: 'Alice', age: 30 },
        { type: 'person', name: 'Bob', age: 25 },
        { type: 'person', name: 'Charlie', age: 35 }
      ];
      
      objects.forEach(obj => store.add(obj));
      
      const results = store.queryObjects({
        type: 'person',
        where: obj => obj.age > 25
      });
      
      expect(results.length).toBe(2);
      expect(results).toContain(objects[0]); // Alice
      expect(results).toContain(objects[2]); // Charlie
    });

    test('should return actual objects from queries', () => {
      const obj = { name: 'QueryTest', value: 100 };
      
      const addResult = store.add(obj);
      const queried = store.getObject(addResult.objectId);
      
      expect(queried).toBe(obj); // Same reference
      expect(queried.name).toBe('QueryTest');
      expect(queried.value).toBe(100);
    });
  });

  describe('Update operations', () => {
    test('should update existing object', () => {
      const obj = { name: 'Original', value: 1 };
      
      store.add(obj);
      
      // Modify object
      obj.name = 'Updated';
      obj.value = 2;
      obj.newField = 'New';
      
      const result = store.update(obj);
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      
      // Verify update in DataScript
      const queried = store.getObject(result.objectId);
      expect(queried).toBe(obj);
      expect(queried.name).toBe('Updated');
      expect(queried.value).toBe(2);
      expect(queried.newField).toBe('New');
    });

    test('should handle update of non-existent object', () => {
      const obj = { name: 'NotInStore' };
      
      const result = store.update(obj);
      
      expect(result.success).toBe(false);
      expect(result.notFound).toBe(true);
    });
  });

  describe('Store state management', () => {
    test('should track all objects in store', () => {
      const objects = [];
      for (let i = 0; i < 5; i++) {
        objects.push({ id: i, name: `Object${i}` });
      }
      
      objects.forEach(obj => store.add(obj));
      
      expect(store.size()).toBe(5);
      
      const allObjects = store.getAllObjects();
      expect(allObjects.length).toBe(5);
      objects.forEach(obj => {
        expect(allObjects).toContain(obj);
      });
    });

    test('should clear all objects from store', () => {
      const objects = [
        { name: 'ToClear1' },
        { name: 'ToClear2' },
        { name: 'ToClear3' }
      ];
      
      objects.forEach(obj => store.add(obj));
      expect(store.size()).toBe(3);
      
      store.clear();
      
      expect(store.size()).toBe(0);
      expect(store.getAllObjects()).toEqual([]);
      
      // Verify DataScript is also cleared
      const query = store.query({
        find: ['?e'],
        where: [['?e', ':entity/id', '?id']]
      });
      expect(query.length).toBe(0);
    });

    test('should check if object exists in store', () => {
      const obj1 = { name: 'Exists' };
      const obj2 = { name: 'NotExists' };
      
      store.add(obj1);
      
      expect(store.has(obj1)).toBe(true);
      expect(store.has(obj2)).toBe(false);
    });
  });
});