import { SerializationEngine } from '../../src/SerializationEngine.js';
import { DeserializationEngine } from '../../src/DeserializationEngine.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Save and Load Cycle Integration Tests', () => {
  let serializer;
  let deserializer;
  let identityManager;
  let store;
  let core;
  const tempDir = path.join(__dirname, '../tmp');
  const tempFile = path.join(tempDir, 'test-save-load.json');

  beforeEach(async () => {
    // Set up the full system
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' }
    };

    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
    serializer = new SerializationEngine(identityManager);
    deserializer = new DeserializationEngine(identityManager);

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempFile);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });

  describe('Simple Save and Load', () => {
    test('should save and load a simple object', async () => {
      const original = {
        type: 'person',
        name: 'Alice',
        age: 30,
        email: 'alice@example.com'
      };

      // Add to store
      const addResult = store.add(original);
      expect(addResult.success).toBe(true);

      // Serialize
      const triples = serializer.serialize(original);
      const storageData = serializer.toStorageFormat(triples);

      // Save to file
      await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));

      // Clear the system to simulate fresh load
      identityManager.clear();
      store = new LiveStore(core, new ObjectIdentityManager());
      
      // Create new deserializer with fresh identity manager
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);

      // Load from file
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      // Verify loaded object
      expect(hydratedGraph.objects).toHaveProperty(String(addResult.objectId));
      const loaded = hydratedGraph.objects[addResult.objectId];
      
      expect(loaded.type).toBe('person');
      expect(loaded.name).toBe('Alice');
      expect(loaded.age).toBe(30);
      expect(loaded.email).toBe('alice@example.com');
    });

    test('should save and load objects with special types', async () => {
      const createdDate = new Date('2024-01-15T10:30:00Z');
      const pattern = /^test-\d+$/;
      
      const original = {
        type: 'document',
        title: 'Test Doc',
        createdAt: createdDate,
        tags: new Set(['tag1', 'tag2', 'tag3']),
        metadata: new Map([['key1', 'value1'], ['key2', 'value2']]),
        pattern: pattern
      };

      // Add to store
      const addResult = store.add(original);
      
      // Serialize and save
      const triples = serializer.serialize(original);
      const storageData = serializer.toStorageFormat(triples);
      await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));

      // Load with fresh system
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      const loaded = hydratedGraph.objects[addResult.objectId];
      
      expect(loaded.type).toBe('document');
      expect(loaded.title).toBe('Test Doc');
      expect(loaded.createdAt).toBeInstanceOf(Date);
      expect(loaded.createdAt.toISOString()).toBe(createdDate.toISOString());
      expect(loaded.tags).toBeInstanceOf(Set);
      expect(loaded.tags.has('tag1')).toBe(true);
      expect(loaded.tags.has('tag2')).toBe(true);
      expect(loaded.tags.has('tag3')).toBe(true);
      expect(loaded.metadata).toBeInstanceOf(Map);
      expect(loaded.metadata.get('key1')).toBe('value1');
      expect(loaded.metadata.get('key2')).toBe('value2');
      expect(loaded.pattern).toBeInstanceOf(RegExp);
      expect(loaded.pattern.toString()).toBe(pattern.toString());
    });
  });

  describe('Complex Graph Save and Load', () => {
    test('should save and load nested object graphs', async () => {
      const company = { type: 'company', name: 'TechCorp', founded: 2010 };
      const department = { type: 'department', name: 'Engineering', company: company };
      const person1 = { type: 'person', name: 'Bob', department: department };
      const person2 = { type: 'person', name: 'Carol', department: department };
      
      company.departments = [department];
      department.employees = [person1, person2];

      // Add all to store
      const companyResult = store.add(company);
      const deptResult = store.add(department);
      const person1Result = store.add(person1);
      const person2Result = store.add(person2);

      // Serialize all
      const allTriples = [
        ...serializer.serialize(company),
        ...serializer.serialize(department),
        ...serializer.serialize(person1),
        ...serializer.serialize(person2)
      ];

      // Save
      const storageData = serializer.toStorageFormat(allTriples);
      await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));

      // Load with fresh system
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      // Verify object relationships
      const loadedCompany = hydratedGraph.objects[companyResult.objectId];
      const loadedDept = hydratedGraph.objects[deptResult.objectId];
      const loadedPerson1 = hydratedGraph.objects[person1Result.objectId];
      const loadedPerson2 = hydratedGraph.objects[person2Result.objectId];

      expect(loadedCompany.name).toBe('TechCorp');
      expect(loadedDept.name).toBe('Engineering');
      expect(loadedPerson1.name).toBe('Bob');
      expect(loadedPerson2.name).toBe('Carol');

      // Check references are properly connected
      expect(loadedDept.company).toBe(loadedCompany);
      expect(loadedPerson1.department).toBe(loadedDept);
      expect(loadedPerson2.department).toBe(loadedDept);
      
      // Check arrays of references
      expect(loadedCompany.departments).toEqual([loadedDept]);
      expect(loadedDept.employees).toContain(loadedPerson1);
      expect(loadedDept.employees).toContain(loadedPerson2);
      expect(loadedDept.employees.length).toBe(2);
    });

    test('should save and load circular references', async () => {
      const node1 = { type: 'node', name: 'Node1' };
      const node2 = { type: 'node', name: 'Node2' };
      const node3 = { type: 'node', name: 'Node3' };
      
      // Create circular chain
      node1.next = node2;
      node2.next = node3;
      node3.next = node1;

      // Add to store
      const id1 = store.add(node1).objectId;
      const id2 = store.add(node2).objectId;
      const id3 = store.add(node3).objectId;

      // Serialize all
      const allTriples = [
        ...serializer.serialize(node1),
        ...serializer.serialize(node2),
        ...serializer.serialize(node3)
      ];

      // Save
      const storageData = serializer.toStorageFormat(allTriples);
      await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));

      // Load with fresh system
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      const loaded1 = hydratedGraph.objects[id1];
      const loaded2 = hydratedGraph.objects[id2];
      const loaded3 = hydratedGraph.objects[id3];

      // Verify circular references are preserved
      expect(loaded1.next).toBe(loaded2);
      expect(loaded2.next).toBe(loaded3);
      expect(loaded3.next).toBe(loaded1);
      
      // Verify we can traverse the circle
      expect(loaded1.next.next.next).toBe(loaded1);
    });

    test('should save and load self-referencing objects', async () => {
      const selfRef = { type: 'recursive', name: 'SelfRef' };
      selfRef.self = selfRef;
      selfRef.parent = selfRef;
      selfRef.children = [selfRef];

      // Add to store
      const id = store.add(selfRef).objectId;

      // Serialize
      const triples = serializer.serialize(selfRef);
      const storageData = serializer.toStorageFormat(triples);
      await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));

      // Load with fresh system
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      const loaded = hydratedGraph.objects[id];

      // Verify self-references are preserved
      expect(loaded.self).toBe(loaded);
      expect(loaded.parent).toBe(loaded);
      expect(loaded.children[0]).toBe(loaded);
      expect(loaded.self.self.self).toBe(loaded);
    });
  });

  describe('Large Dataset Save and Load', () => {
    test('should handle saving and loading many objects', async () => {
      const objects = [];
      const count = 100;

      // Create many objects with relationships
      for (let i = 0; i < count; i++) {
        const obj = {
          type: 'item',
          id: i,
          name: `Item ${i}`,
          value: Math.random() * 1000,
          tags: [`tag${i % 10}`, `tag${(i + 1) % 10}`],
          createdAt: new Date(Date.now() - i * 1000000)
        };

        // Add reference to previous object
        if (i > 0) {
          obj.previous = objects[i - 1];
        }

        objects.push(obj);
      }

      // Add all to store first (before creating circular references to ensure proper registration)
      const ids = [];
      for (const obj of objects) {
        const result = store.add(obj);
        ids.push(result.objectId);
      }

      // Now create circular references (after all objects are registered)
      objects[count - 1].next = objects[0];
      objects[0].previous = objects[count - 1];

      // Update the objects in the store with the new references
      store.update(objects[count - 1]);
      store.update(objects[0]);

      // Now serialize all objects
      const allTriples = [];
      for (const obj of objects) {
        allTriples.push(...serializer.serialize(obj));
      }

      // Save
      const storageData = serializer.toStorageFormat(allTriples);
      await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));

      // Verify storage format metadata
      expect(storageData.tripleCount).toBeGreaterThan(count * 4); // At least 4 properties per object

      // Load with fresh system
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      // Verify all objects were loaded
      expect(hydratedGraph.metadata.objectCount).toBe(count);
      
      // Verify some specific objects and their relationships
      const first = hydratedGraph.objects[ids[0]];
      const last = hydratedGraph.objects[ids[count - 1]];
      const middle = hydratedGraph.objects[ids[50]];

      expect(first.id).toBe(0);
      expect(first.name).toBe('Item 0');
      expect(first.previous).toBe(last); // Circular reference
      
      expect(last.id).toBe(count - 1);
      expect(last.name).toBe(`Item ${count - 1}`);
      expect(last.next).toBe(first); // Circular reference
      
      expect(middle.id).toBe(50);
      expect(middle.name).toBe('Item 50');
      expect(middle.previous).toBe(hydratedGraph.objects[ids[49]]);
      
      // Verify dates were preserved
      expect(first.createdAt).toBeInstanceOf(Date);
      expect(middle.createdAt).toBeInstanceOf(Date);
      expect(last.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted storage data gracefully', async () => {
      const corrupted = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        tripleCount: 3,
        triples: [
          [1, 'type', 'test'],
          ['invalid', 'name', 'Bad ID'], // Invalid object ID
          [1, 2, 3, 4] // Too many elements
        ]
      };

      await fs.writeFile(tempFile, JSON.stringify(corrupted, null, 2));

      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      
      expect(() => {
        newDeserializer.loadFromStorage(loadedData);
      }).toThrow();
    });

    test('should handle missing storage format fields', () => {
      const newDeserializer = new DeserializationEngine(new ObjectIdentityManager());
      
      // Missing triples field
      expect(() => {
        newDeserializer.loadFromStorage({ version: '1.0' });
      }).toThrow('Invalid storage format');

      // Null storage data
      expect(() => {
        newDeserializer.loadFromStorage(null);
      }).toThrow('Invalid storage format');

      // Empty object
      expect(() => {
        newDeserializer.loadFromStorage({});
      }).toThrow('Invalid storage format');
    });
  });

  describe('Incremental Save and Load', () => {
    test('should support incremental additions to saved data', async () => {
      // First save
      const obj1 = { type: 'first', name: 'Object 1', value: 100 };
      const id1 = store.add(obj1).objectId;
      
      const triples1 = serializer.serialize(obj1);
      const storage1 = serializer.toStorageFormat(triples1);
      await fs.writeFile(tempFile, JSON.stringify(storage1, null, 2));

      // Load and verify first object
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      
      let loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      let hydratedGraph = newDeserializer.loadFromStorage(loadedData);
      
      expect(hydratedGraph.metadata.objectCount).toBe(1);
      expect(hydratedGraph.objects[id1].name).toBe('Object 1');

      // Add more objects that reference the first
      const obj2 = { type: 'second', name: 'Object 2', ref: obj1 };
      const obj3 = { type: 'third', name: 'Object 3', ref: obj1 };
      
      const id2 = store.add(obj2).objectId;
      const id3 = store.add(obj3).objectId;

      // Serialize all objects (including the first one again for references)
      const allTriples = [
        ...serializer.serialize(obj1),
        ...serializer.serialize(obj2),
        ...serializer.serialize(obj3)
      ];

      // Save updated data
      const storage2 = serializer.toStorageFormat(allTriples);
      await fs.writeFile(tempFile, JSON.stringify(storage2, null, 2));

      // Load with fresh system and verify all objects
      const finalIdentityManager = new ObjectIdentityManager();
      const finalDeserializer = new DeserializationEngine(finalIdentityManager);
      
      loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      hydratedGraph = finalDeserializer.loadFromStorage(loadedData);

      expect(hydratedGraph.metadata.objectCount).toBe(3);
      
      const loaded1 = hydratedGraph.objects[id1];
      const loaded2 = hydratedGraph.objects[id2];
      const loaded3 = hydratedGraph.objects[id3];

      expect(loaded1.name).toBe('Object 1');
      expect(loaded2.name).toBe('Object 2');
      expect(loaded3.name).toBe('Object 3');
      
      // Verify references
      expect(loaded2.ref).toBe(loaded1);
      expect(loaded3.ref).toBe(loaded1);
    });
  });
});