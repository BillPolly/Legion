import { SerializationEngine } from '../../src/SerializationEngine.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';

describe('SerializationEngine Integration Tests', () => {
  let engine;
  let identityManager;
  let store;
  let core;

  beforeEach(() => {
    // Set up the full system
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' }
    };

    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
    engine = new SerializationEngine(identityManager);
  });

  describe('Serialization with LiveStore', () => {
    test('should serialize objects that are in the store', () => {
      const person = {
        type: 'person',
        name: 'Alice',
        age: 30,
        email: 'alice@example.com'
      };

      // Add to store first
      const addResult = store.add(person);
      expect(addResult.success).toBe(true);
      
      // Now serialize
      const triples = engine.serialize(person);
      
      expect(triples).toBeInstanceOf(Array);
      expect(triples.length).toBe(4); // type, name, age, email
      
      // Verify triple structure
      expect(triples).toContainEqual([addResult.objectId, 'type', 'person']);
      expect(triples).toContainEqual([addResult.objectId, 'name', 'Alice']);
      expect(triples).toContainEqual([addResult.objectId, 'age', 30]);
      expect(triples).toContainEqual([addResult.objectId, 'email', 'alice@example.com']);
    });

    test('should serialize multiple related objects', () => {
      const company = {
        type: 'company',
        name: 'TechCorp',
        founded: 2010
      };

      const person1 = {
        type: 'person',
        name: 'Bob',
        employer: company
      };

      const person2 = {
        type: 'person',
        name: 'Carol',
        employer: company
      };

      // Add all to store
      const companyResult = store.add(company);
      const person1Result = store.add(person1);
      const person2Result = store.add(person2);

      // Serialize each
      const companyTriples = engine.serialize(company);
      const person1Triples = engine.serialize(person1);
      const person2Triples = engine.serialize(person2);

      // Check company serialization
      expect(companyTriples).toContainEqual([companyResult.objectId, 'type', 'company']);
      expect(companyTriples).toContainEqual([companyResult.objectId, 'name', 'TechCorp']);
      expect(companyTriples).toContainEqual([companyResult.objectId, 'founded', 2010]);

      // Check person serializations have references to company
      expect(person1Triples).toContainEqual([
        person1Result.objectId, 
        'employer', 
        { _ref: companyResult.objectId }
      ]);
      
      expect(person2Triples).toContainEqual([
        person2Result.objectId, 
        'employer', 
        { _ref: companyResult.objectId }
      ]);
    });

    test('should handle batch serialization of store objects', () => {
      const objects = [
        { type: 'task', title: 'Task 1', priority: 'high' },
        { type: 'task', title: 'Task 2', priority: 'medium' },
        { type: 'task', title: 'Task 3', priority: 'low' }
      ];

      // Add all to store
      const results = store.addBatch(objects);
      expect(results.every(r => r.success)).toBe(true);

      // Batch serialize
      const allTriples = engine.serializeBatch(objects);

      // Should have 3 properties per object × 3 objects = 9 triples
      expect(allTriples.length).toBe(9);

      // Verify each object was serialized
      for (let i = 0; i < objects.length; i++) {
        const objectId = results[i].objectId;
        expect(allTriples).toContainEqual([objectId, 'type', 'task']);
        expect(allTriples).toContainEqual([objectId, 'title', objects[i].title]);
        expect(allTriples).toContainEqual([objectId, 'priority', objects[i].priority]);
      }
    });

    test('should serialize circular references from store', () => {
      const parent = { type: 'node', name: 'Parent' };
      const child = { type: 'node', name: 'Child' };
      
      // Create circular reference
      parent.child = child;
      child.parent = parent;

      // Add to store
      const parentResult = store.add(parent);
      const childResult = store.add(child);

      // Serialize both
      const parentTriples = engine.serialize(parent);
      const childTriples = engine.serialize(child);

      // Check references are properly created
      expect(parentTriples).toContainEqual([
        parentResult.objectId,
        'child',
        { _ref: childResult.objectId }
      ]);

      expect(childTriples).toContainEqual([
        childResult.objectId,
        'parent',
        { _ref: parentResult.objectId }
      ]);
    });

    test('should handle complex object graphs', () => {
      // Create a graph structure
      const root = { type: 'root', name: 'Root Node' };
      const branch1 = { type: 'branch', name: 'Branch 1', parent: root };
      const branch2 = { type: 'branch', name: 'Branch 2', parent: root };
      const leaf1 = { type: 'leaf', name: 'Leaf 1', parent: branch1 };
      const leaf2 = { type: 'leaf', name: 'Leaf 2', parent: branch1 };
      const leaf3 = { type: 'leaf', name: 'Leaf 3', parent: branch2 };

      // Add reverse references
      root.children = [branch1, branch2];
      branch1.children = [leaf1, leaf2];
      branch2.children = [leaf3];

      // Add all to store
      const rootResult = store.add(root);
      const branch1Result = store.add(branch1);
      const branch2Result = store.add(branch2);
      const leaf1Result = store.add(leaf1);
      const leaf2Result = store.add(leaf2);
      const leaf3Result = store.add(leaf3);

      // Serialize root
      const rootTriples = engine.serialize(root);

      // Check children array contains references
      const childrenTriple = rootTriples.find(t => t[1] === 'children');
      expect(childrenTriple).toBeDefined();
      expect(childrenTriple[2]).toEqual({
        _type: 'array',
        _value: [
          { _ref: branch1Result.objectId },
          { _ref: branch2Result.objectId }
        ]
      });

      // Serialize branch1
      const branch1Triples = engine.serialize(branch1);
      
      // Check parent reference
      expect(branch1Triples).toContainEqual([
        branch1Result.objectId,
        'parent',
        { _ref: rootResult.objectId }
      ]);

      // Check children array
      const branch1ChildrenTriple = branch1Triples.find(t => t[1] === 'children');
      expect(branch1ChildrenTriple[2]).toEqual({
        _type: 'array',
        _value: [
          { _ref: leaf1Result.objectId },
          { _ref: leaf2Result.objectId }
        ]
      });
    });

    test('should serialize objects with dates and special types', () => {
      const createdDate = new Date('2024-01-15T10:30:00Z');
      const modifiedDate = new Date('2024-01-16T14:45:00Z');
      
      const document = {
        type: 'document',
        title: 'Important Doc',
        createdAt: createdDate,
        modifiedAt: modifiedDate,
        tags: new Set(['important', 'review', 'urgent']),
        metadata: new Map([
          ['author', 'Alice'],
          ['version', 2]
        ]),
        pattern: /^doc-\d+$/
      };

      // Add to store
      const docResult = store.add(document);

      // Serialize
      const triples = engine.serialize(document);

      // Check date serialization
      expect(triples).toContainEqual([
        docResult.objectId,
        'createdAt',
        { _type: 'date', _value: createdDate.toISOString() }
      ]);

      expect(triples).toContainEqual([
        docResult.objectId,
        'modifiedAt',
        { _type: 'date', _value: modifiedDate.toISOString() }
      ]);

      // Check Set serialization
      const tagsTriple = triples.find(t => t[1] === 'tags');
      expect(tagsTriple[2]).toEqual({
        _type: 'set',
        _value: ['important', 'review', 'urgent']
      });

      // Check Map serialization
      const metadataTriple = triples.find(t => t[1] === 'metadata');
      expect(metadataTriple[2]).toEqual({
        _type: 'map',
        _value: [['author', 'Alice'], ['version', 2]]
      });

      // Check RegExp serialization
      expect(triples).toContainEqual([
        docResult.objectId,
        'pattern',
        { _type: 'regexp', _value: '/^doc-\\d+$/' }
      ]);
    });

    test('should generate storage format for persistence', () => {
      const data = [
        { type: 'user', name: 'User1', active: true },
        { type: 'user', name: 'User2', active: false }
      ];

      // Add to store
      store.addBatch(data);

      // Serialize
      const triples = engine.serializeBatch(data);

      // Convert to storage format
      const storageData = engine.toStorageFormat(triples);

      expect(storageData).toHaveProperty('version', '1.0');
      expect(storageData).toHaveProperty('timestamp');
      expect(storageData).toHaveProperty('tripleCount', 6); // 3 properties × 2 objects
      expect(storageData).toHaveProperty('triples');
      expect(storageData.triples).toEqual(triples);

      // Timestamp should be valid ISO string
      expect(new Date(storageData.timestamp).toISOString()).toBe(storageData.timestamp);
    });
  });

  describe('Error Cases', () => {
    test('should fail to serialize objects not in store', () => {
      const orphan = { type: 'orphan', name: 'Not in store' };
      
      expect(() => {
        engine.serialize(orphan);
      }).toThrow('Object must be registered with identity manager before serialization');
    });

    test('should handle mixed registered and unregistered objects', () => {
      const registered = { type: 'registered', name: 'In Store' };
      const unregistered = { type: 'unregistered', name: 'Not in Store' };
      
      registered.ref = unregistered;

      // Only register the first object
      store.add(registered);

      // Serialize should handle the unregistered reference
      const triples = engine.serialize(registered);

      // The unregistered object should be serialized as inline
      const refTriple = triples.find(t => t[1] === 'ref');
      expect(refTriple).toBeDefined();
      expect(refTriple[2]).toEqual({
        _type: 'inline',
        _value: unregistered
      });
    });
  });

  describe('Consistency with Store Operations', () => {
    test('should maintain consistency after store updates', () => {
      const obj = { type: 'mutable', value: 1 };
      
      // Add to store
      const result = store.add(obj);
      
      // Initial serialization
      const triples1 = engine.serialize(obj);
      expect(triples1).toContainEqual([result.objectId, 'value', 1]);

      // Update the object
      obj.value = 2;
      store.update(obj);

      // Serialize again
      const triples2 = engine.serialize(obj);
      expect(triples2).toContainEqual([result.objectId, 'value', 2]);
      
      // Object ID should remain the same
      expect(triples1[0][0]).toBe(triples2[0][0]);
    });

    test('should handle objects removed from store', () => {
      const temp = { type: 'temporary', name: 'Will be removed' };
      
      // Add to store
      store.add(temp);
      
      // Can serialize while in store
      const triples = engine.serialize(temp);
      expect(triples.length).toBeGreaterThan(0);

      // Remove from store
      const removeResult = store.remove(temp);
      expect(removeResult.success).toBe(true);

      // Should not be able to serialize after removal
      expect(() => {
        engine.serialize(temp);
      }).toThrow('Object must be registered with identity manager before serialization');
    });
  });
});