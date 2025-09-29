import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DataStore, createDataStore } from '../src/store.js';

describe('DataStore - Basic Creation', () => {
  describe('Constructor', () => {
    it('should create DataStore with empty schema', () => {
      const store = new DataStore();
      assert.ok(store instanceof DataStore);
      assert.deepStrictEqual(store.schema, {});
    });

    it('should create DataStore with provided schema', () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      assert.deepStrictEqual(store.schema, schema);
    });

    it('should freeze the schema to prevent mutation', () => {
      const schema = {
        ':user/name': { unique: 'identity' }
      };
      const store = new DataStore(schema);
      
      assert.throws(() => {
        store.schema[':user/age'] = { valueType: 'number' };
      });
    });

    it('should accept options parameter', () => {
      const options = { debounceMs: 50 };
      const store = new DataStore({}, options);
      assert.strictEqual(store.options.debounceMs, 50);
    });

    it('should use default options when none provided', () => {
      const store = new DataStore();
      assert.strictEqual(store.options.debounceMs, 10);
    });
  });

  describe('Schema Validation', () => {
    it('should throw error for invalid schema format', () => {
      assert.throws(() => {
        new DataStore({ 'invalid-key': {} });
      }, /Schema attributes must start with ':'/);
    });

    it('should throw error for invalid attribute properties', () => {
      assert.throws(() => {
        new DataStore({ ':user/name': { unique: 'invalid' } });
      }, /Invalid unique constraint/);
    });

    it('should accept valid schema properties', () => {
      const schema = {
        ':user/id': { unique: 'identity' },
        ':user/email': { unique: 'value' },
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/age': { valueType: 'number' }
      };
      
      const store = new DataStore(schema);
      assert.deepStrictEqual(store.schema, schema);
    });
  });

  describe('createDataStore helper', () => {
    it('should create DataStore instance', () => {
      const store = createDataStore();
      assert.ok(store instanceof DataStore);
    });

    it('should pass schema to constructor', () => {
      const schema = { ':user/name': { unique: 'identity' } };
      const store = createDataStore({ schema });
      assert.deepStrictEqual(store.schema, schema);
    });

    it('should pass options to constructor', () => {
      const options = { debounceMs: 100 };
      const store = createDataStore({ options });
      assert.strictEqual(store.options.debounceMs, 100);
    });
  });

  describe('Proxy Registry System', () => {
    it('should have proxy registry initialized', () => {
      const store = new DataStore();
      // Registry should be private but we can test its behavior through public methods
      assert.ok(store._proxyRegistry);
    });

    it('should register proxy for entity ID', () => {
      const store = new DataStore();
      const mockProxy = { entityId: 1, isValid: () => true };
      
      store._registerProxy(1, mockProxy);
      assert.strictEqual(store._getRegisteredProxy(1), mockProxy);
    });

    it('should return undefined for unregistered entity', () => {
      const store = new DataStore();
      assert.strictEqual(store._getRegisteredProxy(999), undefined);
    });

    it('should enforce singleton pattern - same proxy for same entity', () => {
      const store = new DataStore();
      const mockProxy1 = { entityId: 1, isValid: () => true };
      const mockProxy2 = { entityId: 1, isValid: () => true };
      
      store._registerProxy(1, mockProxy1);
      const retrieved1 = store._getRegisteredProxy(1);
      
      // Should not overwrite existing proxy
      store._registerProxy(1, mockProxy2);
      const retrieved2 = store._getRegisteredProxy(1);
      
      assert.strictEqual(retrieved1, retrieved2);
      assert.strictEqual(retrieved1, mockProxy1);
    });

    it('should handle multiple different entities', () => {
      const store = new DataStore();
      const proxy1 = { entityId: 1, isValid: () => true };
      const proxy2 = { entityId: 2, isValid: () => true };
      
      store._registerProxy(1, proxy1);
      store._registerProxy(2, proxy2);
      
      assert.strictEqual(store._getRegisteredProxy(1), proxy1);
      assert.strictEqual(store._getRegisteredProxy(2), proxy2);
    });

    it('should support proxy invalidation', () => {
      const store = new DataStore();
      let isValid = true;
      const mockProxy = { 
        entityId: 1, 
        isValid: () => isValid,
        _invalidate: () => { isValid = false; }
      };
      
      store._registerProxy(1, mockProxy);
      assert.ok(store._getRegisteredProxy(1).isValid());
      
      // Invalidate proxy
      store._invalidateProxy(1);
      assert.ok(!store._getRegisteredProxy(1).isValid());
    });

    it('should clean up invalid proxies', () => {
      const store = new DataStore();
      const mockProxy = { 
        entityId: 1, 
        isValid: () => false  // Already invalid
      };
      
      store._registerProxy(1, mockProxy);
      
      // Cleanup should remove invalid proxy
      store._cleanupProxies();
      assert.strictEqual(store._getRegisteredProxy(1), undefined);
    });
  });

  describe('Basic Entity Creation', () => {
    it('should create entity with attributes', () => {
      const schema = {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      const result = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com'
      });
      
      assert.ok(result.entityId);
      assert.ok(typeof result.entityId === 'number');
      assert.ok(result.tempids);
    });

    it('should handle tempids in entity creation', () => {
      const store = new DataStore();
      
      const result = store.createEntity({
        ':db/id': -1,
        ':user/name': 'Bob'
      });
      
      assert.ok(result.entityId);
      assert.ok(result.tempids.has(-1));
      assert.strictEqual(result.tempids.get(-1), result.entityId);
    });

    it('should validate required attributes', () => {
      const store = new DataStore();
      
      // Empty data should throw
      assert.throws(() => {
        store.createEntity({});
      }, /Entity data cannot be empty/);
      
      // Null/undefined should throw
      assert.throws(() => {
        store.createEntity(null);
      }, /Entity data is required/);
    });

    it('should validate attribute format', () => {
      const store = new DataStore();
      
      assert.throws(() => {
        store.createEntity({
          'invalid-attr': 'value'  // Should start with ':'
        });
      }, /Attributes must start with ':'/);
    });

    it('should enforce schema constraints during creation', () => {
      const schema = {
        ':user/email': { unique: 'value' }
      };
      const store = new DataStore(schema);
      
      // First entity should succeed
      const result1 = store.createEntity({
        ':user/email': 'test@example.com'
      });
      assert.ok(result1.entityId);
      
      // Second entity with same email should fail
      assert.throws(() => {
        store.createEntity({
          ':user/email': 'test@example.com'
        });
      }, /Unique constraint violation/);
    });

    it('should create multiple entities with different IDs', () => {
      const store = new DataStore();
      
      const result1 = store.createEntity({ ':user/name': 'Alice' });
      const result2 = store.createEntity({ ':user/name': 'Bob' });
      
      assert.notStrictEqual(result1.entityId, result2.entityId);
      assert.ok(result1.entityId < result2.entityId); // IDs should be sequential
    });

    it('should support batch entity creation', () => {
      const store = new DataStore();
      
      const result = store.createEntities([
        { ':user/name': 'Alice' },
        { ':user/name': 'Bob' },
        { ':user/name': 'Charlie' }
      ]);
      
      assert.strictEqual(result.entityIds.length, 3);
      assert.ok(result.tempids);
      
      // All IDs should be different
      const ids = result.entityIds;
      assert.strictEqual(new Set(ids).size, 3);
    });
  });
});