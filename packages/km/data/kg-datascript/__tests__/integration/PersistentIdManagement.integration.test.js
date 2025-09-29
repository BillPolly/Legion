import { SerializationEngine } from '../../src/SerializationEngine.js';
import { DeserializationEngine } from '../../src/DeserializationEngine.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { StableIdGenerator } from '../../src/StableIdGenerator.js';
import { LiveStore } from '../../src/LiveStore.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Persistent ID Management Integration Tests', () => {
  let serializer;
  let deserializer;
  let identityManager;
  let idGenerator;
  let store;
  let core;
  const tempDir = path.join(__dirname, '../tmp');
  const tempFile = path.join(tempDir, 'test-persistent-ids.json');

  beforeEach(async () => {
    // Set up the full system with stable ID generation
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' }
    };

    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    idGenerator = new StableIdGenerator();
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

  describe('Stable ID Generation Across Sessions', () => {
    test('should use stable IDs for persistence', async () => {
      const obj = {
        type: 'document',
        title: 'Important Document',
        version: 1,
        content: 'This is the document content'
      };

      // Generate stable ID
      const stableId = idGenerator.generateId(obj);
      
      // Register with specific ID
      identityManager.registerWithId(obj, stableId);
      
      // Serialize
      const triples = serializer.serialize(obj);
      const storageData = serializer.toStorageFormat(triples);
      
      // Save with stable ID metadata
      const persistentData = {
        ...storageData,
        idMapping: {
          [stableId]: {
            hash: stableId,
            type: obj.type
          }
        }
      };
      
      await fs.writeFile(tempFile, JSON.stringify(persistentData, null, 2));

      // Simulate new session
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      const newIdGenerator = new StableIdGenerator();

      // Load from file
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      // Verify the object
      const loadedObj = hydratedGraph.objects[stableId];
      expect(loadedObj).toBeDefined();
      expect(loadedObj.title).toBe('Important Document');

      // Generate ID for loaded object - should match
      const loadedId = newIdGenerator.generateId(loadedObj);
      expect(loadedId).toBe(stableId);
    });

    test('should maintain ID consistency across multiple save/load cycles', async () => {
      const objects = [
        { type: 'user', name: 'Alice', email: 'alice@example.com' },
        { type: 'user', name: 'Bob', email: 'bob@example.com' },
        { type: 'post', title: 'First Post', author: null } // Will add reference
      ];

      // Set up references
      objects[2].author = objects[0]; // Post by Alice

      // Generate stable IDs and register
      const idMap = new Map();
      for (const obj of objects) {
        const stableId = idGenerator.generateId(obj);
        idMap.set(obj, stableId);
        identityManager.registerWithId(obj, stableId);
      }

      // First save
      const allTriples = [];
      for (const obj of objects) {
        allTriples.push(...serializer.serialize(obj));
      }
      
      const storageData = serializer.toStorageFormat(allTriples);
      await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));

      // First load
      let newIdentityManager = new ObjectIdentityManager();
      let newDeserializer = new DeserializationEngine(newIdentityManager);
      
      let loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      let hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      // Verify IDs are preserved
      for (const [originalObj, originalId] of idMap) {
        const loadedObj = hydratedGraph.objects[originalId];
        expect(loadedObj).toBeDefined();
        expect(loadedObj.type).toBe(originalObj.type);
      }

      // Modify and save again
      const aliceId = idMap.get(objects[0]);
      const modifiedAlice = hydratedGraph.objects[aliceId];
      modifiedAlice.email = 'alice.new@example.com';
      
      // Re-register with same ID
      newIdentityManager.registerWithId(modifiedAlice, aliceId);
      
      // Serialize again
      const newSerializer = new SerializationEngine(newIdentityManager);
      const modifiedTriples = newSerializer.serialize(modifiedAlice);
      
      // Merge with other objects
      const postId = idMap.get(objects[2]);
      const bobId = idMap.get(objects[1]);
      
      const allTriples2 = [
        ...modifiedTriples,
        ...newSerializer.serialize(hydratedGraph.objects[bobId]),
        ...newSerializer.serialize(hydratedGraph.objects[postId])
      ];
      
      const storageData2 = newSerializer.toStorageFormat(allTriples2);
      await fs.writeFile(tempFile, JSON.stringify(storageData2, null, 2));

      // Second load
      newIdentityManager = new ObjectIdentityManager();
      newDeserializer = new DeserializationEngine(newIdentityManager);
      
      loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      // Verify modified data with same IDs
      const finalAlice = hydratedGraph.objects[aliceId];
      expect(finalAlice.email).toBe('alice.new@example.com');
      expect(finalAlice.name).toBe('Alice');
      
      // Verify references still work
      const finalPost = hydratedGraph.objects[postId];
      expect(finalPost.author).toBe(finalAlice);
    });

    test('should handle ID collisions gracefully', () => {
      const generator1 = new StableIdGenerator();
      const generator2 = new StableIdGenerator();
      
      const obj1 = { type: 'item', value: 'A' };
      const obj2 = { type: 'item', value: 'A' }; // Same content
      
      const id1 = generator1.generateId(obj1);
      const id2 = generator2.generateId(obj2);
      
      // Same content should generate same ID (deterministic)
      expect(id1).toBe(id2);
      
      // Different content should generate different ID
      const obj3 = { type: 'item', value: 'B' };
      const id3 = generator1.generateId(obj3);
      expect(id3).not.toBe(id1);
    });
  });

  describe('ID Migration and Versioning', () => {
    test('should support ID format migration', async () => {
      // Old format with numeric IDs
      const oldFormatData = {
        version: '0.9',
        timestamp: new Date().toISOString(),
        tripleCount: 3,
        triples: [
          [1, 'type', 'legacy'],
          [1, 'name', 'Legacy Object'],
          [1, 'value', 42]
        ]
      };

      await fs.writeFile(tempFile, JSON.stringify(oldFormatData, null, 2));

      // Load with new system that expects string IDs
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      
      // Convert numeric IDs to strings during load
      const convertedTriples = loadedData.triples.map(([s, p, o]) => [
        String(s), // Convert subject ID to string
        p,
        typeof o === 'object' && o._ref !== undefined 
          ? { _ref: String(o._ref) } // Convert reference IDs
          : o
      ]);
      
      const convertedData = {
        ...loadedData,
        triples: convertedTriples
      };
      
      const hydratedGraph = newDeserializer.loadFromStorage(convertedData);
      
      // Verify object was loaded with string ID
      const loadedObj = hydratedGraph.objects['1'];
      expect(loadedObj).toBeDefined();
      expect(loadedObj.type).toBe('legacy');
      expect(loadedObj.name).toBe('Legacy Object');
      expect(loadedObj.value).toBe(42);
    });

    test('should preserve custom ID fields', () => {
      const generator = new StableIdGenerator({ idField: 'uuid' });
      
      const obj = {
        uuid: 'custom-uuid-12345',
        type: 'entity',
        name: 'Custom ID Entity'
      };
      
      const id = generator.generateId(obj);
      expect(id).toBe('custom-uuid-12345');
      
      // Object without custom field should get hash ID
      const obj2 = {
        type: 'entity',
        name: 'No Custom ID'
      };
      
      const id2 = generator.generateId(obj2);
      expect(id2).not.toBe('undefined');
      expect(id2.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle large object graphs with stable IDs', async () => {
      const nodeCount = 50;
      const nodes = [];
      const idMap = new Map();
      
      // Create interconnected graph
      for (let i = 0; i < nodeCount; i++) {
        const node = {
          type: 'node',
          id: i,
          label: `Node ${i}`,
          connections: []
        };
        nodes.push(node);
      }
      
      // Add connections
      for (let i = 0; i < nodeCount; i++) {
        // Connect to next 3 nodes (with wraparound)
        for (let j = 1; j <= 3; j++) {
          const targetIndex = (i + j) % nodeCount;
          nodes[i].connections.push(nodes[targetIndex]);
        }
      }
      
      // Generate stable IDs and register
      for (const node of nodes) {
        const stableId = idGenerator.generateId(node);
        idMap.set(node, stableId);
        identityManager.registerWithId(node, stableId);
      }
      
      // Serialize all
      const allTriples = [];
      for (const node of nodes) {
        allTriples.push(...serializer.serialize(node));
      }
      
      const storageData = serializer.toStorageFormat(allTriples);
      
      // Add ID mapping metadata
      const idMappingData = {};
      for (const [node, id] of idMap) {
        idMappingData[id] = {
          type: node.type,
          label: node.label
        };
      }
      
      const persistentData = {
        ...storageData,
        idMapping: idMappingData
      };
      
      await fs.writeFile(tempFile, JSON.stringify(persistentData, null, 2));
      
      // Verify file size is reasonable
      const stats = await fs.stat(tempFile);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.size).toBeLessThan(1000000); // Less than 1MB
      
      // Load and verify
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const hydratedGraph = newDeserializer.loadFromStorage(loadedData);
      
      // Verify all nodes loaded with correct IDs
      expect(Object.keys(hydratedGraph.objects).length).toBe(nodeCount);
      
      // Verify connections preserved
      for (const [originalNode, originalId] of idMap) {
        const loadedNode = hydratedGraph.objects[originalId];
        expect(loadedNode).toBeDefined();
        expect(loadedNode.connections.length).toBe(3);
        
        // Verify connection targets have correct IDs
        for (let i = 0; i < 3; i++) {
          const originalTarget = originalNode.connections[i];
          const originalTargetId = idMap.get(originalTarget);
          const loadedTarget = loadedNode.connections[i];
          const loadedTargetId = newIdentityManager.getId(loadedTarget);
          
          // The loaded target should be the object with the same stable ID
          expect(hydratedGraph.objects[originalTargetId]).toBe(loadedTarget);
        }
      }
    });

    test('should support incremental updates with stable IDs', async () => {
      // Initial object
      const doc = {
        type: 'document',
        title: 'Evolving Document',
        version: 1,
        sections: []
      };
      
      const docId = idGenerator.generateId(doc);
      identityManager.registerWithId(doc, docId);
      
      // Save initial version
      let triples = serializer.serialize(doc);
      let storageData = serializer.toStorageFormat(triples);
      await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));
      
      // Load and add sections incrementally
      for (let v = 2; v <= 5; v++) {
        // Load current version
        const currentIdentityManager = new ObjectIdentityManager();
        const currentDeserializer = new DeserializationEngine(currentIdentityManager);
        
        const currentData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
        const currentGraph = currentDeserializer.loadFromStorage(currentData);
        
        const currentDoc = currentGraph.objects[docId];
        
        // Add new section
        const newSection = {
          type: 'section',
          title: `Section ${v - 1}`,
          content: `Content for version ${v}`
        };
        
        const sectionId = idGenerator.generateId(newSection);
        currentIdentityManager.registerWithId(newSection, sectionId);
        
        currentDoc.sections.push(newSection);
        currentDoc.version = v;
        
        // Re-register document with same ID
        currentIdentityManager.registerWithId(currentDoc, docId);
        
        // Serialize both document and new section
        const currentSerializer = new SerializationEngine(currentIdentityManager);
        const updatedTriples = [
          ...currentSerializer.serialize(currentDoc),
          ...currentSerializer.serialize(newSection)
        ];
        
        // Also serialize existing sections
        for (const section of currentDoc.sections.slice(0, -1)) {
          updatedTriples.push(...currentSerializer.serialize(section));
        }
        
        // Save updated version
        storageData = currentSerializer.toStorageFormat(updatedTriples);
        await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));
      }
      
      // Final load and verification
      const finalIdentityManager = new ObjectIdentityManager();
      const finalDeserializer = new DeserializationEngine(finalIdentityManager);
      
      const finalData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const finalGraph = finalDeserializer.loadFromStorage(finalData);
      
      const finalDoc = finalGraph.objects[docId];
      expect(finalDoc.version).toBe(5);
      expect(finalDoc.sections.length).toBe(4);
      
      // Verify all sections have stable IDs
      for (let i = 0; i < 4; i++) {
        const section = finalDoc.sections[i];
        expect(section.title).toBe(`Section ${i + 1}`);
        
        // Generate ID for section - should match stored ID
        const expectedId = idGenerator.generateId({
          type: 'section',
          title: `Section ${i + 1}`,
          content: `Content for version ${i + 2}`
        });
        
        const actualId = finalIdentityManager.getId(section);
        expect(actualId).toBe(expectedId);
      }
    });
  });
});