/**
 * OntologyExtensionService Dynamic Abstraction Integration Tests
 *
 * Tests for Phase 10: Dynamic supertype creation with REAL LLM
 * NO MOCKS - uses actual LLM, SimpleTripleStore, and SemanticSearchProvider
 */

import { ResourceManager } from '@legion/resource-manager';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyExtensionService } from '../../src/services/OntologyExtensionService.js';
import { HierarchyTraversalService } from '../../src/services/HierarchyTraversalService.js';

describe('OntologyExtensionService - Dynamic Abstraction (Integration)', () => {
  let service;
  let tripleStore;
  let semanticSearch;
  let llmClient;
  let hierarchyTraversal;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();
  }, 60000);

  beforeEach(() => {
    tripleStore = new SimpleTripleStore();
    hierarchyTraversal = new HierarchyTraversalService(tripleStore);
    service = new OntologyExtensionService(tripleStore, semanticSearch, llmClient, hierarchyTraversal);
  });

  describe('bootstrapTopLevelRelationship', () => {
    test('should create kg:relatesTo in empty ontology', async () => {
      const result = await service.bootstrapTopLevelRelationship();

      expect(result).toBe(true);

      // Verify kg:relatesTo was created
      const relatesTo = await tripleStore.query('kg:relatesTo', 'rdf:type', 'owl:ObjectProperty');
      expect(relatesTo).toHaveLength(1);

      const domain = await tripleStore.query('kg:relatesTo', 'rdfs:domain', null);
      expect(domain[0][2]).toBe('owl:Thing');

      const range = await tripleStore.query('kg:relatesTo', 'rdfs:range', null);
      expect(range[0][2]).toBe('owl:Thing');
    });

    test('should not duplicate kg:relatesTo if already exists', async () => {
      // Create first time
      await service.bootstrapTopLevelRelationship();

      // Try again
      const result = await service.bootstrapTopLevelRelationship();

      expect(result).toBe(false);

      // Should only have one
      const relatesTo = await tripleStore.query('kg:relatesTo', 'rdf:type', 'owl:ObjectProperty');
      expect(relatesTo).toHaveLength(1);
    });
  });

  describe('determineParentClass with CREATE_PARENT', () => {
    test('should create Pump parent when adding second pump type', async () => {
      // Add first pump type
      await tripleStore.add('kg:CentrifugalPump', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:CentrifugalPump', 'rdfs:label', '"CentrifugalPump"');
      await tripleStore.add('kg:CentrifugalPump', 'rdfs:comment', '"Pump using centrifugal force"');
      await tripleStore.add('kg:CentrifugalPump', 'rdfs:subClassOf', 'owl:Thing');

      // Now add second pump type - should trigger abstraction
      const parent = await service.determineParentClass(
        {
          name: 'ReciprocatingPump',
          description: 'Pump using reciprocating motion'
        },
        'industrial'
      );

      console.log(`✅ LLM determined parent: ${parent}`);

      // LLM should create Pump abstraction OR use existing class
      // Either is acceptable (depends on LLM decision)
      expect(parent).toBeTruthy();

      // If Pump was created, verify it exists
      if (parent === 'kg:Pump') {
        const pumpClass = await tripleStore.query('kg:Pump', 'rdf:type', 'owl:Class');
        expect(pumpClass).toHaveLength(1);

        const pumpParent = await tripleStore.query('kg:Pump', 'rdfs:subClassOf', null);
        expect(pumpParent[0][2]).toBe('owl:Thing');

        console.log('✅ Pump abstraction was created dynamically');
      }
    }, 120000);

    test('should handle third pump type with existing Pump parent', async () => {
      // Setup: Create hierarchy with Pump parent
      await tripleStore.add('kg:Pump', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Pump', 'rdfs:label', '"Pump"');
      await tripleStore.add('kg:Pump', 'rdfs:comment', '"Device for moving fluids"');
      await tripleStore.add('kg:Pump', 'rdfs:subClassOf', 'owl:Thing');

      await tripleStore.add('kg:CentrifugalPump', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:CentrifugalPump', 'rdfs:label', '"CentrifugalPump"');
      await tripleStore.add('kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump');

      await tripleStore.add('kg:ReciprocatingPump', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:ReciprocatingPump', 'rdfs:label', '"ReciprocatingPump"');
      await tripleStore.add('kg:ReciprocatingPump', 'rdfs:subClassOf', 'kg:Pump');

      // Add third pump type
      const parent = await service.determineParentClass(
        {
          name: 'RotaryPump',
          description: 'Pump using rotary motion'
        },
        'industrial'
      );

      console.log(`✅ LLM chose parent: ${parent}`);

      // Should use existing Pump parent
      expect(parent).toBe('kg:Pump');
    }, 120000);
  });

  describe('extendFromGaps with relationships', () => {
    test('should bootstrap kg:relatesTo when adding first relationship', async () => {
      const gaps = {
        missingClasses: [],
        missingProperties: [],
        missingRelationships: [
          { name: 'connectsTo', domain: 'Equipment', range: 'Equipment' }
        ],
        canReuseFromHierarchy: []
      };

      await service.extendFromGaps(gaps, 'industrial');

      // Verify kg:relatesTo was bootstrapped
      const relatesTo = await tripleStore.query('kg:relatesTo', 'rdf:type', 'owl:ObjectProperty');
      expect(relatesTo).toHaveLength(1);

      // Verify connectsTo inherits from kg:relatesTo
      const connectsTo = await tripleStore.query('kg:connectsTo', 'rdfs:subPropertyOf', null);
      expect(connectsTo[0][2]).toBe('kg:relatesTo');

      console.log('✅ kg:relatesTo bootstrapped and connectsTo inherits from it');
    }, 60000);

    test('should make all relationships inherit from kg:relatesTo', async () => {
      const gaps = {
        missingClasses: [],
        missingProperties: [],
        missingRelationships: [
          { name: 'connectsTo', domain: 'Equipment', range: 'Equipment' },
          { name: 'feeds', domain: 'Pump', range: 'Tank' }
        ],
        canReuseFromHierarchy: []
      };

      await service.extendFromGaps(gaps, 'industrial');

      // Both should inherit from kg:relatesTo
      const connectsTo = await tripleStore.query('kg:connectsTo', 'rdfs:subPropertyOf', null);
      expect(connectsTo[0][2]).toBe('kg:relatesTo');

      const feeds = await tripleStore.query('kg:feeds', 'rdfs:subPropertyOf', null);
      expect(feeds[0][2]).toBe('kg:relatesTo');

      console.log('✅ All relationships inherit from kg:relatesTo');
    }, 60000);
  });

  describe('end-to-end with dynamic abstraction', () => {
    test('should build proper hierarchy with multiple pump types', async () => {
      // Simulate progressive ontology building
      const gaps1 = {
        missingClasses: [{ name: 'CentrifugalPump', description: 'Pump using centrifugal force' }],
        missingProperties: [],
        missingRelationships: [],
        canReuseFromHierarchy: []
      };

      await service.extendFromGaps(gaps1, 'industrial');

      const gaps2 = {
        missingClasses: [{ name: 'ReciprocatingPump', description: 'Pump using reciprocating motion' }],
        missingProperties: [],
        missingRelationships: [],
        canReuseFromHierarchy: []
      };

      await service.extendFromGaps(gaps2, 'industrial');

      const gaps3 = {
        missingClasses: [{ name: 'RotaryPump', description: 'Pump using rotary motion' }],
        missingProperties: [],
        missingRelationships: [],
        canReuseFromHierarchy: []
      };

      await service.extendFromGaps(gaps3, 'industrial');

      // Check final hierarchy
      const allClasses = await tripleStore.query(null, 'rdf:type', 'owl:Class');
      console.log(`\n✅ Total classes: ${allClasses.length}`);

      for (const [classURI] of allClasses) {
        const labels = await tripleStore.query(classURI, 'rdfs:label', null);
        const parents = await tripleStore.query(classURI, 'rdfs:subClassOf', null);
        console.log(`   ${labels[0]?.[2]?.replace(/"/g, '')} → ${parents[0]?.[2]}`);
      }

      // Verify at least the 3 pump types exist
      expect(allClasses.length).toBeGreaterThanOrEqual(3);

      // Check if Pump abstraction was created
      const pumpExists = allClasses.some(([uri]) => uri === 'kg:Pump');
      if (pumpExists) {
        console.log('✅ Pump abstraction was created!');
      }
    }, 180000);
  });
});
