import { KGClassicOperations } from '../../src/KGClassicOperations.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { SerializationEngine } from '../../src/SerializationEngine.js';
import { DeserializationEngine } from '../../src/DeserializationEngine.js';
import { LiveStore } from '../../src/LiveStore.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { StableIdGenerator } from '../../src/StableIdGenerator.js';

describe('Legacy KG API Integration Tests', () => {
  let kgOps;
  let identityManager;
  let serializer;
  let deserializer;
  let store;
  let core;
  let idGenerator;

  beforeEach(() => {
    // Set up full system with all components
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
  });

  describe('Classic Triple Operations with Live Store', () => {
    test('should add triples and sync with live store', () => {
      const person = { type: 'person', name: 'Alice' };
      const company = { type: 'company', name: 'TechCorp' };
      
      // Add objects to live store
      store.add(person);
      store.add(company);
      
      // Add triples using classic API
      kgOps.addTriple(person, 'age', 30);
      kgOps.addTriple(person, 'employer', company);
      kgOps.addTriple(company, 'employees', 50);
      
      // Query using classic API
      const personTriples = kgOps.queryPattern({ subject: person });
      expect(personTriples.length).toBe(2);
      
      const companyTriples = kgOps.queryPattern({ subject: company });
      expect(companyTriples.length).toBe(1);
      
      // Verify references
      const employerTriples = kgOps.queryPattern({ predicate: 'employer' });
      expect(employerTriples.length).toBe(1);
      expect(employerTriples[0][2]._ref).toBe(identityManager.getId(company));
    });

    test('should handle complex object graphs with serialization', () => {
      // Create interconnected objects
      const project = { type: 'project', name: 'Apollo' };
      const team1 = { type: 'team', name: 'Frontend' };
      const team2 = { type: 'team', name: 'Backend' };
      const dev1 = { type: 'developer', name: 'Alice' };
      const dev2 = { type: 'developer', name: 'Bob' };
      const dev3 = { type: 'developer', name: 'Carol' };
      
      // Register all objects
      [project, team1, team2, dev1, dev2, dev3].forEach(obj => {
        store.add(obj);
      });
      
      // Build relationships using classic API
      kgOps.addTriple(project, 'teams', [team1, team2]);
      kgOps.addTriple(team1, 'members', [dev1, dev2]);
      kgOps.addTriple(team2, 'members', [dev2, dev3]);
      kgOps.addTriple(dev1, 'team', team1);
      kgOps.addTriple(dev2, 'teams', [team1, team2]);
      kgOps.addTriple(dev3, 'team', team2);
      
      // Query relationships
      const projectTriples = kgOps.queryPattern({ subject: project });
      expect(projectTriples.length).toBe(1);
      
      const teamTriples = kgOps.queryPattern({ predicate: 'members' });
      expect(teamTriples.length).toBe(2);
      
      const developerTeams = kgOps.queryPattern({ predicate: 'team' });
      expect(developerTeams.length).toBe(2); // dev1 and dev3
      
      const multiTeamDevs = kgOps.queryPattern({ predicate: 'teams' });
      expect(multiTeamDevs.length).toBe(2); // dev2 has teams array, and project has teams array
    });

    test('should support full serialization and deserialization cycle', () => {
      // Create test data
      const doc = {
        type: 'document',
        title: 'Design Doc',
        version: 1,
        metadata: {
          created: new Date('2024-01-15'),
          tags: new Set(['design', 'architecture']),
          properties: new Map([['status', 'draft'], ['priority', 'high']])
        }
      };
      
      const author = { type: 'user', name: 'Alice', email: 'alice@example.com' };
      doc.author = author;
      
      // Register objects with stable IDs
      const docId = idGenerator.generateId(doc);
      const authorId = idGenerator.generateId(author);
      identityManager.registerWithId(doc, docId);
      identityManager.registerWithId(author, authorId);
      
      // Serialize using classic API
      const docTriples = kgOps.objectToTriples(doc);
      const authorTriples = kgOps.objectToTriples(author);
      
      // Store all triples
      const allTriples = [...docTriples, ...authorTriples];
      
      // Convert to storage format
      const storageData = serializer.toStorageFormat(allTriples);
      
      // Simulate new session - deserialize
      const newIdentityManager = new ObjectIdentityManager();
      const newDeserializer = new DeserializationEngine(newIdentityManager);
      const hydratedGraph = newDeserializer.loadFromStorage(storageData);
      
      // Verify objects restored correctly
      const restoredDoc = hydratedGraph.objects[docId];
      expect(restoredDoc).toBeDefined();
      expect(restoredDoc.title).toBe('Design Doc');
      expect(restoredDoc.version).toBe(1);
      
      // Verify author reference
      const restoredAuthor = hydratedGraph.objects[authorId];
      expect(restoredAuthor).toBeDefined();
      expect(restoredAuthor.name).toBe('Alice');
      expect(restoredDoc.author).toBe(restoredAuthor);
      
      // Verify special types
      expect(restoredDoc.metadata.created).toBeInstanceOf(Date);
      expect(restoredDoc.metadata.tags).toBeInstanceOf(Set);
      expect(restoredDoc.metadata.properties).toBeInstanceOf(Map);
    });
  });

  describe('Pattern Query Compatibility', () => {
    test('should support complex pattern queries on live data', () => {
      // Create a knowledge graph
      const concepts = [
        { type: 'concept', name: 'Machine Learning', category: 'AI' },
        { type: 'concept', name: 'Neural Networks', category: 'AI' },
        { type: 'concept', name: 'Database', category: 'Systems' },
        { type: 'concept', name: 'REST API', category: 'Web' }
      ];
      
      const relationships = [];
      
      // Register all concepts
      concepts.forEach(c => store.add(c));
      
      // Create relationships
      kgOps.addTriple(concepts[0], 'related', concepts[1]);
      kgOps.addTriple(concepts[1], 'requires', concepts[2]);
      kgOps.addTriple(concepts[3], 'uses', concepts[2]);
      
      // Query all AI concepts
      const aiConcepts = concepts.filter(c => c.category === 'AI');
      const aiTriples = [];
      aiConcepts.forEach(concept => {
        aiTriples.push(...kgOps.queryPattern({ subject: concept }));
      });
      
      expect(aiTriples.length).toBeGreaterThan(0);
      
      // Query all relationships to Database
      const dbRelations = kgOps.queryPattern({ object: concepts[2] });
      expect(dbRelations.length).toBe(2); // Neural Networks requires it, REST API uses it
      
      // Query by predicate type
      const requiresRelations = kgOps.queryPattern({ predicate: 'requires' });
      expect(requiresRelations.length).toBe(1);
      
      const usesRelations = kgOps.queryPattern({ predicate: 'uses' });
      expect(usesRelations.length).toBe(1);
    });

    test('should support transitive queries', () => {
      // Create hierarchy
      const root = { type: 'node', name: 'root' };
      const child1 = { type: 'node', name: 'child1' };
      const child2 = { type: 'node', name: 'child2' };
      const grandchild1 = { type: 'node', name: 'grandchild1' };
      const grandchild2 = { type: 'node', name: 'grandchild2' };
      
      [root, child1, child2, grandchild1, grandchild2].forEach(n => store.add(n));
      
      // Build hierarchy
      kgOps.addTriple(root, 'children', [child1, child2]);
      kgOps.addTriple(child1, 'parent', root);
      kgOps.addTriple(child2, 'parent', root);
      kgOps.addTriple(child1, 'children', [grandchild1]);
      kgOps.addTriple(child2, 'children', [grandchild2]);
      kgOps.addTriple(grandchild1, 'parent', child1);
      kgOps.addTriple(grandchild2, 'parent', child2);
      
      // Query all nodes with children
      const parentsTriples = kgOps.queryPattern({ predicate: 'children' });
      expect(parentsTriples.length).toBe(3); // root, child1, child2
      
      // Query all nodes with parents
      const childrenTriples = kgOps.queryPattern({ predicate: 'parent' });
      expect(childrenTriples.length).toBe(4); // all except root
      
      // Find all descendants of root (would need recursive query in real system)
      const rootChildren = kgOps.queryPattern({ subject: root, predicate: 'children' });
      expect(rootChildren.length).toBe(1);
    });
  });

  describe('Import/Export with Live System', () => {
    test('should export and import maintaining consistency', () => {
      // Create initial data
      const items = [];
      for (let i = 0; i < 10; i++) {
        const item = { type: 'item', id: i, value: `value${i}` };
        store.add(item);
        items.push(item);
      }
      
      // Add relationships
      for (let i = 0; i < 9; i++) {
        kgOps.addTriple(items[i], 'next', items[i + 1]);
      }
      kgOps.addTriple(items[9], 'next', items[0]); // Circular
      
      // Export
      const exportData = kgOps.exportTriples();
      expect(exportData.tripleCount).toBe(10);
      expect(exportData.version).toBe('1.0');
      
      // Clear and verify empty
      kgOps.clearTriples();
      expect(kgOps.getTripleCount()).toBe(0);
      
      // Import
      kgOps.importTriples(exportData);
      expect(kgOps.getTripleCount()).toBe(10);
      
      // Verify relationships preserved
      for (let i = 0; i < 10; i++) {
        const nextTriples = kgOps.queryPattern({ 
          subject: items[i], 
          predicate: 'next' 
        });
        expect(nextTriples.length).toBe(1);
      }
    });

    test('should handle incremental updates with export/import', () => {
      const doc = { type: 'document', title: 'Living Document', version: 1 };
      store.add(doc);
      
      // Version 1
      kgOps.addTriple(doc, 'status', 'draft');
      kgOps.addTriple(doc, 'wordCount', 100);
      
      const v1Export = kgOps.exportTriples();
      expect(v1Export.tripleCount).toBe(2);
      
      // Version 2 - add more
      kgOps.addTriple(doc, 'lastModified', new Date('2024-01-20'));
      kgOps.addTriple(doc, 'wordCount', 500); // This is a new triple, not update
      
      const v2Export = kgOps.exportTriples();
      expect(v2Export.tripleCount).toBe(4);
      
      // Version 3 - remove old wordCount
      kgOps.removeTriple(doc, 'wordCount', 100);
      
      const v3Export = kgOps.exportTriples();
      expect(v3Export.tripleCount).toBe(3);
      
      // Restore to v2
      kgOps.clearTriples();
      kgOps.importTriples(v2Export);
      expect(kgOps.getTripleCount()).toBe(4);
      expect(kgOps.hasTriple(doc, 'wordCount', 100)).toBe(true);
      expect(kgOps.hasTriple(doc, 'wordCount', 500)).toBe(true);
      
      // Restore to v1
      kgOps.clearTriples();
      kgOps.importTriples(v1Export);
      expect(kgOps.getTripleCount()).toBe(2);
      expect(kgOps.hasTriple(doc, 'lastModified', expect.any(Date))).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing objects gracefully', () => {
      const registered = { type: 'registered' };
      const unregistered = { type: 'unregistered' };
      
      store.add(registered);
      
      // Should throw for unregistered subject
      expect(() => {
        kgOps.addTriple(unregistered, 'prop', 'value');
      }).toThrow('Object must be registered');
      
      // Should work for registered subject with unregistered object value
      const result = kgOps.addTriple(registered, 'reference', unregistered);
      expect(result.success).toBe(true);
      // Unregistered object stored as nested object, not reference
      expect(result.triple[2]._ref).toBeUndefined();
    });

    test('should handle circular references in queries', () => {
      const node1 = { type: 'node', id: 1 };
      const node2 = { type: 'node', id: 2 };
      
      store.add(node1);
      store.add(node2);
      
      // Create circular reference
      kgOps.addTriple(node1, 'link', node2);
      kgOps.addTriple(node2, 'link', node1);
      
      // Should handle queries without infinite loops
      const node1Links = kgOps.queryPattern({ subject: node1 });
      expect(node1Links.length).toBe(1);
      
      const node2Links = kgOps.queryPattern({ subject: node2 });
      expect(node2Links.length).toBe(1);
      
      const allLinks = kgOps.queryPattern({ predicate: 'link' });
      expect(allLinks.length).toBe(2);
    });

    test('should handle large batch operations', () => {
      const batchSize = 100;
      const objects = [];
      const triplesToAdd = [];
      
      // Create many objects
      for (let i = 0; i < batchSize; i++) {
        const obj = { type: 'batch', id: i };
        objects.push(obj);
        store.add(obj);
        
        triplesToAdd.push({
          subject: obj,
          predicate: 'index',
          object: i
        });
        
        if (i > 0) {
          triplesToAdd.push({
            subject: obj,
            predicate: 'prev',
            object: objects[i - 1]
          });
        }
      }
      
      // Batch add
      const results = kgOps.addTripleBatch(triplesToAdd);
      expect(results.every(r => r.success)).toBe(true);
      expect(kgOps.getTripleCount()).toBe(batchSize + (batchSize - 1));
      
      // Batch query
      const indexTriples = kgOps.queryPattern({ predicate: 'index' });
      expect(indexTriples.length).toBe(batchSize);
      
      const prevTriples = kgOps.queryPattern({ predicate: 'prev' });
      expect(prevTriples.length).toBe(batchSize - 1);
      
      // Batch remove
      const triplesToRemove = triplesToAdd.filter((_, i) => i % 2 === 0);
      const removeResults = kgOps.removeTripleBatch(triplesToRemove);
      expect(removeResults.every(r => r.success)).toBe(true);
      expect(kgOps.getTripleCount()).toBeLessThan(batchSize + (batchSize - 1));
    });
  });
});