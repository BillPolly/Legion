import { ObjectExtensions } from '../../src/ObjectExtensions.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { SerializationEngine } from '../../src/SerializationEngine.js';
import { DeserializationEngine } from '../../src/DeserializationEngine.js';
import { StableIdGenerator } from '../../src/StableIdGenerator.js';
import { LiveStore } from '../../src/LiveStore.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { KGClassicOperations } from '../../src/KGClassicOperations.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Object Extensions Integration Tests', () => {
  let identityManager;
  let serializer;
  let deserializer;
  let idGenerator;
  let store;
  let core;
  let kgOps;
  const tempDir = path.join(__dirname, '../tmp');
  const tempFile = path.join(tempDir, 'test-object-extensions.json');

  beforeEach(async () => {
    // Set up full system
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
    kgOps = new KGClassicOperations(identityManager, serializer);

    // Initialize object extensions
    ObjectExtensions.initialize(identityManager, serializer, idGenerator);

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up extensions
    ObjectExtensions.cleanup();

    // Clean up temp file if it exists
    try {
      await fs.unlink(tempFile);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });

  describe('Extensions with Live Store', () => {
    test('should use object methods with live store operations', () => {
      const person = {
        type: 'person',
        name: 'Alice',
        age: 30
      };

      const company = {
        type: 'company',
        name: 'TechCorp',
        founded: 2010
      };

      // Add to store
      store.add(person);
      store.add(company);

      // Use extension methods
      const personId = person.getId();
      const companyId = company.getId();

      expect(personId).toBeDefined();
      expect(companyId).toBeDefined();

      // Get triples using extension
      const personTriples = person.toTriples();
      const companyTriples = company.toTriples();

      expect(personTriples.length).toBe(3);
      expect(companyTriples.length).toBe(3);

      // Verify triple structure
      expect(personTriples[0][0]).toBe(personId);
      expect(companyTriples[0][0]).toBe(companyId);
    });

    test('should handle object relationships with extensions', () => {
      const team = {
        type: 'team',
        name: 'Engineering',
        members: []
      };

      const alice = {
        type: 'person',
        name: 'Alice',
        role: 'Lead'
      };

      const bob = {
        type: 'person',
        name: 'Bob',
        role: 'Developer'
      };

      // Build relationships
      team.members = [alice, bob];
      alice.team = team;
      bob.team = team;

      // Add to store
      store.add(team);
      store.add(alice);
      store.add(bob);

      // Use extension methods
      const teamTriples = team.toTriples();
      const aliceTriples = alice.toTriples();

      // Check references
      const teamId = team.getId();
      const aliceId = alice.getId();
      const bobId = bob.getId();

      const membersTriple = teamTriples.find(t => t[1] === 'members');
      expect(membersTriple[2]._type).toBe('array');
      expect(membersTriple[2]._value).toEqual([
        { _ref: aliceId },
        { _ref: bobId }
      ]);

      const teamRefTriple = aliceTriples.find(t => t[1] === 'team');
      expect(teamRefTriple[2]._ref).toBe(teamId);
    });
  });

  describe('Stable IDs with Persistence', () => {
    test('should use stable IDs for persistence', async () => {
      const doc = {
        type: 'document',
        title: 'Technical Spec',
        version: 1,
        sections: [
          { title: 'Introduction', content: 'Overview' },
          { title: 'Architecture', content: 'Design details' }
        ]
      };

      // Get stable ID using extension
      const stableId = doc.getStableId();
      expect(stableId).toBeDefined();
      expect(typeof stableId).toBe('string');

      // Register with stable ID
      identityManager.registerWithId(doc, stableId);

      // Also register sections
      doc.sections.forEach(section => {
        const sectionId = section.getStableId();
        identityManager.registerWithId(section, sectionId);
      });

      // Serialize using extension
      const docTriples = doc.toTriples();
      const sectionTriples = [];
      doc.sections.forEach(section => {
        sectionTriples.push(...section.toTriples());
      });

      // Save to file
      const allTriples = [...docTriples, ...sectionTriples];
      const storageData = serializer.toStorageFormat(allTriples);
      await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));

      // Simulate new session
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);

      // Load from file
      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      // Verify objects preserved
      const loadedDoc = hydratedGraph.objects[stableId];
      expect(loadedDoc).toBeDefined();
      expect(loadedDoc.title).toBe('Technical Spec');

      // Verify stable ID consistency
      const loadedStableId = idGenerator.generateId(loadedDoc);
      expect(loadedStableId).toBe(stableId);
    });

    test('should maintain object identity across save/load cycles', async () => {
      const graph = {
        nodes: [],
        edges: []
      };

      // Create nodes
      for (let i = 0; i < 5; i++) {
        const node = {
          type: 'node',
          id: i,
          label: `Node ${i}`
        };
        graph.nodes.push(node);
      }

      // Create edges
      for (let i = 0; i < 4; i++) {
        const edge = {
          type: 'edge',
          from: graph.nodes[i],
          to: graph.nodes[i + 1],
          weight: Math.random()
        };
        graph.edges.push(edge);
      }

      // Register all with stable IDs
      const nodeIds = new Map();
      graph.nodes.forEach(node => {
        const stableId = node.getStableId();
        identityManager.registerWithId(node, stableId);
        nodeIds.set(node, stableId);
      });

      const edgeIds = new Map();
      graph.edges.forEach(edge => {
        const stableId = edge.getStableId();
        identityManager.registerWithId(edge, stableId);
        edgeIds.set(edge, stableId);
      });

      // Serialize using extensions
      const allTriples = [];
      graph.nodes.forEach(node => {
        allTriples.push(...node.toTriples());
      });
      graph.edges.forEach(edge => {
        allTriples.push(...edge.toTriples());
      });

      // Save
      const storageData = serializer.toStorageFormat(allTriples);
      await fs.writeFile(tempFile, JSON.stringify(storageData, null, 2));

      // Load in new session
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      const newIdGenerator = new StableIdGenerator();

      // Re-initialize extensions for new session
      ObjectExtensions.cleanup();
      ObjectExtensions.initialize(newIdentityManager, 
                                  new SerializationEngine(newIdentityManager), 
                                  newIdGenerator);

      const loadedData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
      const hydratedGraph = newDeserializer.loadFromStorage(loadedData);

      // Verify all nodes and edges loaded
      expect(Object.keys(hydratedGraph.objects).length).toBe(9); // 5 nodes + 4 edges

      // Verify stable IDs match
      for (const [originalNode, originalId] of nodeIds) {
        const loadedNode = hydratedGraph.objects[originalId];
        expect(loadedNode).toBeDefined();
        expect(loadedNode.label).toBe(originalNode.label);
        
        // Check stable ID generation matches
        const regeneratedId = loadedNode.getStableId();
        expect(regeneratedId).toBe(originalId);
      }

      // Verify references preserved
      for (const [originalEdge, originalId] of edgeIds) {
        const loadedEdge = hydratedGraph.objects[originalId];
        expect(loadedEdge).toBeDefined();
        
        // Check that from/to references are correct objects
        const fromId = nodeIds.get(originalEdge.from);
        const toId = nodeIds.get(originalEdge.to);
        
        expect(loadedEdge.from).toBe(hydratedGraph.objects[fromId]);
        expect(loadedEdge.to).toBe(hydratedGraph.objects[toId]);
      }
    });
  });

  describe('Extensions with Classic KG Operations', () => {
    test('should work with classic KG operations', () => {
      const resource = {
        type: 'resource',
        name: 'Database',
        status: 'active'
      };

      const service1 = {
        type: 'service',
        name: 'API Gateway',
        port: 8080
      };

      const service2 = {
        type: 'service',
        name: 'Auth Service',
        port: 8081
      };

      // Add to store
      store.add(resource);
      store.add(service1);
      store.add(service2);

      // Use extensions to get IDs
      const resourceId = resource.getId();
      const service1Id = service1.getId();
      const service2Id = service2.getId();

      // Add relationships using classic operations
      kgOps.addTriple(service1, 'depends_on', resource);
      kgOps.addTriple(service2, 'depends_on', resource);
      kgOps.addTriple(service1, 'communicates_with', service2);

      // Query using classic operations
      const dependencies = kgOps.queryPattern({ predicate: 'depends_on' });
      expect(dependencies.length).toBe(2);

      // Use extensions to serialize
      const resourceTriples = resource.toTriples();
      const service1Triples = service1.toTriples();

      // Combine with classic operation triples
      const classicTriples = kgOps.getTriples();
      const allTriples = [
        ...resourceTriples,
        ...service1Triples,
        ...service2.toTriples(),
        ...classicTriples
      ];

      // Should have object properties + relationships
      expect(allTriples.length).toBeGreaterThan(9); // 3 objects * 3 props + relationships
    });

    test('should handle batch operations with extensions', () => {
      const items = [];
      
      // Create items
      for (let i = 0; i < 10; i++) {
        const item = {
          type: 'item',
          index: i,
          value: `Value ${i}`
        };
        items.push(item);
        store.add(item);
      }

      // Use extensions to get all triples
      const itemTriples = items.map(item => item.toTriples()).flat();
      expect(itemTriples.length).toBe(30); // 10 items * 3 properties

      // Add relationships using classic batch operations
      const relationships = [];
      for (let i = 0; i < 9; i++) {
        relationships.push({
          subject: items[i],
          predicate: 'next',
          object: items[i + 1]
        });
      }

      const results = kgOps.addTripleBatch(relationships);
      expect(results.every(r => r.success)).toBe(true);

      // Export everything
      const exportData = kgOps.exportTriples();
      expect(exportData.tripleCount).toBe(9); // Just the relationships

      // Get all IDs using extensions
      const ids = items.map(item => item.getId());
      expect(ids.every(id => id !== null)).toBe(true);

      // Get stable IDs
      const stableIds = items.map(item => item.getStableId());
      expect(new Set(stableIds).size).toBe(10); // All unique
    });
  });

  describe('Real-World Scenarios', () => {
    test('should handle social network graph', () => {
      const users = [
        { type: 'user', username: 'alice', name: 'Alice' },
        { type: 'user', username: 'bob', name: 'Bob' },
        { type: 'user', username: 'carol', name: 'Carol' },
        { type: 'user', username: 'dave', name: 'Dave' }
      ];

      const posts = [
        { type: 'post', content: 'Hello world!', author: users[0] },
        { type: 'post', content: 'Great day!', author: users[1] },
        { type: 'post', content: 'Learning KG', author: users[2] }
      ];

      // Build social connections
      users[0].following = [users[1], users[2]];
      users[1].following = [users[0], users[3]];
      users[2].following = [users[3]];
      users[3].following = [users[0], users[1], users[2]];

      // Add likes
      posts[0].likes = [users[1], users[2]];
      posts[1].likes = [users[0], users[3]];
      posts[2].likes = [users[0], users[1], users[3]];

      // Register all with stable IDs
      [...users, ...posts].forEach(entity => {
        const stableId = entity.getStableId();
        identityManager.registerWithId(entity, stableId);
      });

      // Serialize everything
      const allTriples = [];
      [...users, ...posts].forEach(entity => {
        allTriples.push(...entity.toTriples());
      });

      // Verify relationships captured
      const followingTriples = allTriples.filter(t => t[1] === 'following');
      expect(followingTriples.length).toBe(4); // Each user has following array

      const likesTriples = allTriples.filter(t => t[1] === 'likes');
      expect(likesTriples.length).toBe(3); // Each post has likes array

      // Query specific patterns using classic operations
      posts.forEach(post => {
        kgOps.addTriple(post, 'type', 'post'); // Add for querying
      });

      const postTriples = kgOps.queryPattern({ object: 'post' });
      expect(postTriples.length).toBe(3);
    });

    test('should handle e-commerce catalog', () => {
      const categories = [
        { type: 'category', name: 'Electronics', slug: 'electronics' },
        { type: 'category', name: 'Computers', slug: 'computers', parent: null }
      ];
      categories[1].parent = categories[0];

      const products = [
        {
          type: 'product',
          name: 'Laptop',
          price: 999.99,
          category: categories[1],
          specs: {
            cpu: 'Intel i7',
            ram: '16GB',
            storage: '512GB SSD'
          },
          tags: new Set(['portable', 'powerful', 'business'])
        },
        {
          type: 'product',
          name: 'Mouse',
          price: 29.99,
          category: categories[1],
          specs: {
            type: 'wireless',
            buttons: 3,
            dpi: 1600
          },
          tags: new Set(['wireless', 'ergonomic'])
        }
      ];

      const inventory = products.map(product => ({
        type: 'inventory',
        product: product,
        quantity: Math.floor(Math.random() * 100),
        location: 'Warehouse A'
      }));

      // Register everything
      [...categories, ...products, ...inventory].forEach(entity => {
        const stableId = entity.getStableId();
        identityManager.registerWithId(entity, stableId);
      });

      // Also register nested specs objects
      products.forEach(product => {
        const specsId = product.specs.getStableId();
        identityManager.registerWithId(product.specs, specsId);
      });

      // Serialize catalog
      const catalogTriples = [];
      [...categories, ...products].forEach(entity => {
        catalogTriples.push(...entity.toTriples());
      });
      products.forEach(product => {
        catalogTriples.push(...product.specs.toTriples());
      });

      // Serialize inventory separately
      const inventoryTriples = [];
      inventory.forEach(item => {
        inventoryTriples.push(...item.toTriples());
      });

      // Verify data integrity
      const productIds = products.map(p => p.getId());
      const inventoryProductRefs = inventoryTriples
        .filter(t => t[1] === 'product')
        .map(t => t[2]._ref);

      // Each inventory item should reference a product
      inventoryProductRefs.forEach(ref => {
        expect(productIds).toContain(ref);
      });

      // Check category hierarchy
      const laptopTriples = products[0].toTriples();
      const categoryTriple = laptopTriples.find(t => t[1] === 'category');
      expect(categoryTriple[2]._ref).toBe(categories[1].getId());

      // Verify specs are properly serialized
      const specsTriple = laptopTriples.find(t => t[1] === 'specs');
      expect(specsTriple[2]._ref).toBe(products[0].specs.getId());
    });
  });
});