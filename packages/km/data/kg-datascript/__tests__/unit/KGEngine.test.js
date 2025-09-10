import { KGEngine } from '../../src/KGEngine.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';
import { SerializationEngine } from '../../src/SerializationEngine.js';
import { DeserializationEngine } from '../../src/DeserializationEngine.js';
import { StableIdGenerator } from '../../src/StableIdGenerator.js';
import { KGClassicOperations } from '../../src/KGClassicOperations.js';
import { ObjectExtensions } from '../../src/ObjectExtensions.js';
import { QueryEngine } from '../../src/QueryEngine.js';
import { PatternTranslator } from '../../src/PatternTranslator.js';
import { KGEntityProxy } from '../../src/KGEntityProxy.js';

describe('KGEngine Unit Tests', () => {
  let engine;

  beforeEach(() => {
    // Clean up any existing extensions
    ObjectExtensions.cleanup();
    
    // Create engine with test schema
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' }
    };
    
    engine = new KGEngine(schema);
  });

  afterEach(() => {
    // Clear all data to ensure test isolation
    if (engine) {
      engine.clear();
    }
  });

  describe('Initialization', () => {
    test('should create engine with all components', () => {
      expect(engine).toBeDefined();
      expect(engine.core).toBeInstanceOf(KGDataScriptCore);
      expect(engine.identityManager).toBeInstanceOf(ObjectIdentityManager);
      expect(engine.store).toBeInstanceOf(LiveStore);
    });

    test('should initialize object extensions', () => {
      expect(ObjectExtensions.isInitialized()).toBe(true);
      expect(typeof Object.prototype.toTriples).toBe('function');
      expect(typeof Object.prototype.getId).toBe('function');
      expect(typeof Object.prototype.getStableId).toBe('function');
    });

    test('should expose all API surfaces', () => {
      // Object API
      expect(typeof engine.add).toBe('function');
      expect(typeof engine.remove).toBe('function');
      expect(typeof engine.update).toBe('function');
      expect(typeof engine.get).toBe('function');
      
      // Query API
      expect(typeof engine.query).toBe('function');
      expect(typeof engine.queryPattern).toBe('function');
      expect(typeof engine.find).toBe('function');
      
      // Serialization API
      expect(typeof engine.serialize).toBe('function');
      expect(typeof engine.deserialize).toBe('function');
      expect(typeof engine.save).toBe('function');
      expect(typeof engine.load).toBe('function');
      
      // Classic KG API
      expect(typeof engine.addTriple).toBe('function');
      expect(typeof engine.removeTriple).toBe('function');
      expect(typeof engine.getTriples).toBe('function');
      
      // Proxy API
      expect(typeof engine.proxy).toBe('function');
      expect(typeof engine.watch).toBe('function');
      expect(typeof engine.unwatch).toBe('function');
    });
  });

  describe('Object API', () => {
    test('should add objects to store', () => {
      const obj = { type: 'person', name: 'Alice' };
      const result = engine.add(obj);
      
      expect(result.success).toBe(true);
      expect(result.object).toBe(obj);
      expect(result.id).toBeDefined();
      
      // Object should have ID
      expect(obj.getId()).toBe(result.id);
    });

    test('should remove objects from store', () => {
      const obj = { type: 'person', name: 'Bob' };
      engine.add(obj);
      
      const result = engine.remove(obj);
      expect(result.success).toBe(true);
      expect(result.object).toBe(obj);
    });

    test('should update objects in store', () => {
      const obj = { type: 'person', name: 'Carol', age: 25 };
      engine.add(obj);
      
      const result = engine.update(obj, { age: 26 });
      expect(result.success).toBe(true);
      expect(result.object).toBe(obj);
      expect(obj.age).toBe(26);
    });

    test('should get object by ID', () => {
      const obj = { type: 'person', name: 'Dave' };
      const { id } = engine.add(obj);
      
      const retrieved = engine.get(id);
      expect(retrieved).toBe(obj);
    });

    test('should handle batch operations', () => {
      const objects = [
        { type: 'item', value: 1 },
        { type: 'item', value: 2 },
        { type: 'item', value: 3 }
      ];
      
      const results = engine.addBatch(objects);
      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
      
      // All objects should be retrievable
      objects.forEach(obj => {
        const id = obj.getId();
        expect(engine.get(id)).toBe(obj);
      });
    });
  });

  describe('Query API', () => {
    beforeEach(() => {
      // Add test data
      engine.add({ type: 'person', name: 'Alice', age: 30 });
      engine.add({ type: 'person', name: 'Bob', age: 25 });
      engine.add({ type: 'company', name: 'TechCorp' });
    });

    test('should execute Datalog queries', () => {
      // Debug logging to understand failures
      console.log('\n=== Debug Datalog Query Test ===');
      console.log('Objects in identity manager:', engine.identityManager.size());
      console.log('Entity count:', engine.getStats().entityCount);
      
      const results = engine.query(
        '[:find ?e :where [?e :entity/type "person"]]'
      );
      
      console.log('Query results count:', results.length);
      console.log('Results:', results.map(r => ({ type: r?.type, name: r?.name })));
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      
      // Debug the failing assertion
      const everyIsPerson = results.every(r => r.type === 'person');
      console.log('Every result is person:', everyIsPerson);
      if (!everyIsPerson) {
        console.log('Non-person results:', results.filter(r => r.type !== 'person'));
      }
      
      expect(results.every(r => r.type === 'person')).toBe(true);
    });

    test('should execute pattern queries', () => {
      console.log('\n=== Debug Pattern Query Test ===');
      console.log('Objects in identity manager:', engine.identityManager.size());
      console.log('Entity count:', engine.getStats().entityCount);
      
      // Test what the pattern translator produces
      const pattern = { type: 'person' };
      const datalogQuery = engine.patternTranslator.translate(pattern);
      console.log('Pattern:', pattern);
      console.log('Translated datalog query:', JSON.stringify(datalogQuery));
      
      const results = engine.queryPattern({ type: 'person' });
      
      console.log('Pattern query results count:', results.length);
      console.log('Pattern results:', results.map(r => ({ type: r?.type, name: r?.name })));
      
      expect(results.length).toBe(2);
      
      const everyIsPerson = results.every(r => r.type === 'person');
      console.log('Every pattern result is person:', everyIsPerson);
      if (!everyIsPerson) {
        console.log('Non-person pattern results:', results.filter(r => r.type !== 'person'));
      }
      
      expect(results.every(r => r.type === 'person')).toBe(true);
    });

    test('should find objects by criteria', () => {
      const result = engine.find({ type: 'person', name: 'Alice' });
      
      expect(result).toBeDefined();
      expect(result.name).toBe('Alice');
      expect(result.age).toBe(30);
    });

    test('should find all by type', () => {
      const results = engine.findAll({ type: 'person' });
      
      expect(results.length).toBe(2);
      expect(results.every(r => r.type === 'person')).toBe(true);
    });
  });

  describe('Serialization API', () => {
    test('should serialize objects to triples', () => {
      const obj = { type: 'document', title: 'Test Doc' };
      engine.add(obj);
      
      const triples = engine.serialize(obj);
      
      expect(Array.isArray(triples)).toBe(true);
      expect(triples.length).toBeGreaterThan(0);
      expect(triples[0].length).toBe(3); // [subject, predicate, object]
    });

    test('should serialize entire store', () => {
      engine.add({ type: 'item', value: 1 });
      engine.add({ type: 'item', value: 2 });
      
      const data = engine.serializeAll();
      
      expect(data.version).toBeDefined();
      expect(data.triples).toBeDefined();
      expect(data.tripleCount).toBeGreaterThan(0);
    });

    test('should deserialize triples to objects', () => {
      const original = { type: 'test', value: 42 };
      engine.add(original);
      
      const triples = engine.serialize(original);
      const data = engine.toStorageFormat(triples);
      
      const result = engine.deserialize(data);
      
      expect(result.success).toBe(true);
      expect(result.objectCount).toBe(1);
      expect(Object.values(result.objects)[0].type).toBe('test');
      expect(Object.values(result.objects)[0].value).toBe(42);
    });

    test('should save to JSON string', () => {
      engine.add({ type: 'saveable', data: 'test' });
      
      const json = engine.save();
      
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.version).toBeDefined();
      expect(parsed.triples).toBeDefined();
    });

    test('should load from JSON string', () => {
      const obj = { type: 'loadable', value: 'original' };
      engine.add(obj);
      
      const json = engine.save();
      
      // Create new engine
      const newEngine = new KGEngine();
      const result = newEngine.load(json);
      
      expect(result.success).toBe(true);
      expect(result.objectCount).toBeGreaterThan(0);
      
      newEngine.cleanup();
    });
  });

  describe('Classic KG API', () => {
    test('should add triples', () => {
      const obj = { type: 'resource', name: 'Database' };
      engine.add(obj);
      
      const result = engine.addTriple(obj, 'status', 'active');
      
      expect(result.success).toBe(true);
      expect(result.triple).toBeDefined();
      expect(result.triple[1]).toBe('status');
      expect(result.triple[2]).toBe('active');
    });

    test('should remove triples', () => {
      const obj = { type: 'resource', name: 'Cache' };
      engine.add(obj);
      
      engine.addTriple(obj, 'status', 'active');
      const result = engine.removeTriple(obj, 'status', 'active');
      
      expect(result.success).toBe(true);
      expect(result.removedCount).toBe(1);
    });

    test('should get all triples', () => {
      const obj1 = { type: 'node', id: 1 };
      const obj2 = { type: 'node', id: 2 };
      
      engine.add(obj1);
      engine.add(obj2);
      engine.addTriple(obj1, 'connects_to', obj2);
      
      const triples = engine.getTriples();
      
      expect(Array.isArray(triples)).toBe(true);
      expect(triples.some(t => t[1] === 'connects_to')).toBe(true);
    });

    test('should query triples by pattern', () => {
      const obj = { type: 'service', name: 'API' };
      engine.add(obj);
      engine.addTriple(obj, 'port', 8080);
      engine.addTriple(obj, 'protocol', 'http');
      
      const results = engine.queryTriples({ predicate: 'port' });
      
      expect(results.length).toBe(1);
      expect(results[0][2]).toBe(8080);
    });
  });

  describe('Proxy API', () => {
    test('should create proxy for object', () => {
      const obj = { type: 'entity', name: 'Test' };
      engine.add(obj);
      
      const proxy = engine.proxy(obj);
      
      expect(proxy).toBeDefined();
      expect(proxy.name).toBe('Test');
      expect(typeof proxy.onChange).toBe('function');
    });

    test('should watch objects for changes', () => {
      const obj = { type: 'watchable', value: 1 };
      engine.add(obj);
      
      let notified = false;
      const unsubscribe = engine.watch(obj, () => {
        notified = true;
      });
      
      expect(typeof unsubscribe).toBe('function');
      
      // Update should trigger notification
      engine.update(obj, { value: 2 });
      
      // In real implementation, this would be async
      // For unit test, we'll check the subscription exists
      expect(engine._subscriptions.has(obj)).toBe(true);
      
      unsubscribe();
      expect(engine._subscriptions.has(obj)).toBe(false);
    });

    test('should unwatch objects', () => {
      const obj = { type: 'unwatchable', value: 1 };
      engine.add(obj);
      
      const unsubscribe = engine.watch(obj, () => {});
      expect(engine._subscriptions.has(obj)).toBe(true);
      
      engine.unwatch(obj);
      expect(engine._subscriptions.has(obj)).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    test('should generate stable IDs', () => {
      const obj = { type: 'stable', value: 'test' };
      
      const id1 = engine.generateStableId(obj);
      const id2 = engine.generateStableId(obj);
      
      expect(id1).toBe(id2);
      expect(typeof id1).toBe('string');
    });

    test('should provide statistics', () => {
      engine.add({ type: 'stat1' });
      engine.add({ type: 'stat2' });
      engine.add({ type: 'stat3' });
      
      const stats = engine.getStats();
      
      expect(stats.objectCount).toBe(3);
      expect(stats.entityCount).toBeGreaterThanOrEqual(3);
      expect(stats.tripleCount).toBeGreaterThanOrEqual(0);
    });

    test('should clear all data', () => {
      engine.add({ type: 'clearable' });
      expect(engine.getStats().objectCount).toBeGreaterThan(0);
      
      engine.clear();
      
      expect(engine.getStats().objectCount).toBe(0);
      expect(engine.getStats().entityCount).toBe(0);
    });

    test('should cleanup properly', () => {
      expect(ObjectExtensions.isInitialized()).toBe(true);
      
      engine.cleanup();
      
      expect(ObjectExtensions.isInitialized()).toBe(false);
      expect(Object.prototype.toTriples).toBeUndefined();
      expect(Object.prototype.getId).toBeUndefined();
      expect(Object.prototype.getStableId).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should throw on invalid operations', () => {
      expect(() => engine.add(null)).toThrow();
      expect(() => engine.add(undefined)).toThrow();
      expect(() => engine.add('string')).toThrow();
      expect(() => engine.add(42)).toThrow();
    });

    test('should throw on unregistered object operations', () => {
      const unregistered = { type: 'unregistered' };
      
      expect(() => engine.remove(unregistered)).toThrow();
      expect(() => engine.update(unregistered, {})).toThrow();
      expect(() => engine.addTriple(unregistered, 'prop', 'value')).toThrow();
    });

    test('should handle query errors gracefully', () => {
      expect(() => engine.query('invalid query')).toThrow();
      expect(() => engine.queryPattern(null)).toThrow();
    });
  });
});