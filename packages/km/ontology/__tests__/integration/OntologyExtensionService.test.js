/**
 * OntologyExtensionService Integration Tests
 *
 * Tests ontology extension with REAL dependencies
 * NO MOCKS - uses actual LLM, SimpleTripleStore, and SemanticSearchProvider
 */

import { ResourceManager } from '@legion/resource-manager';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyExtensionService } from '../../src/services/OntologyExtensionService.js';
import { HierarchyTraversalService } from '../../src/services/HierarchyTraversalService.js';

describe('OntologyExtensionService Integration', () => {
  let service;
  let tripleStore;
  let semanticSearch;
  let llmClient;
  let hierarchyTraversal;
  let resourceManager;

  beforeAll(async () => {
    // Get real dependencies from ResourceManager
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    // Create semantic search
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();
  });

  beforeEach(() => {
    // Fresh triplestore for each test
    tripleStore = new SimpleTripleStore();
    hierarchyTraversal = new HierarchyTraversalService(tripleStore);
    service = new OntologyExtensionService(tripleStore, semanticSearch, llmClient, hierarchyTraversal);
  });

  describe('determineParentClass with real LLM', () => {
    test('should return owl:Thing for empty ontology', async () => {
      const newClass = { name: 'Equipment', description: 'Industrial equipment' };
      const parent = await service.determineParentClass(newClass, 'industrial');

      expect(parent).toBe('owl:Thing');
    });

    test('should determine Equipment as parent for Pump', async () => {
      // Add Equipment class
      await tripleStore.add('kg:Equipment', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Equipment', 'rdfs:label', '"Equipment"');

      const newClass = { name: 'Pump', description: 'Device for moving fluids' };
      const parent = await service.determineParentClass(newClass, 'industrial');

      expect(parent).toBe('kg:Equipment');
      console.log('✅ LLM correctly determined Pump should be subclass of Equipment');
    });

    test('should determine Pump as parent for CentrifugalPump', async () => {
      // Add Equipment and Pump classes
      await tripleStore.add('kg:Equipment', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Pump', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Pump', 'rdfs:subClassOf', 'kg:Equipment');

      const newClass = { name: 'CentrifugalPump', description: 'Pump using centrifugal force' };
      const parent = await service.determineParentClass(newClass, 'industrial');

      expect(parent).toBe('kg:Pump');
      console.log('✅ LLM correctly determined CentrifugalPump should be subclass of Pump');
    });
  });

  describe('extendFromGaps', () => {
    test('should add missing class to empty ontology', async () => {
      const gaps = {
        missingClasses: [
          { name: 'Equipment', description: 'Industrial equipment' }
        ],
        missingProperties: [],
        missingRelationships: [],
        canReuseFromHierarchy: []
      };

      const stats = await service.extendFromGaps(gaps, 'industrial');

      expect(stats.addedClasses).toBe(1);

      // Verify class was added
      const classTriples = await tripleStore.query('kg:Equipment', 'rdf:type', 'owl:Class');
      expect(classTriples.length).toBe(1);

      // Verify parent is owl:Thing (bootstrap)
      const parentTriples = await tripleStore.query('kg:Equipment', 'rdfs:subClassOf', null);
      expect(parentTriples[0][2]).toBe('owl:Thing');

      console.log('✅ Successfully bootstrapped empty ontology with Equipment class');
    });

    test('should add class with LLM-determined parent', async () => {
      // Add Equipment first
      await tripleStore.add('kg:Equipment', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Equipment', 'rdfs:subClassOf', 'owl:Thing');

      const gaps = {
        missingClasses: [
          { name: 'Pump', description: 'Device for moving fluids' }
        ],
        missingProperties: [],
        missingRelationships: [],
        canReuseFromHierarchy: []
      };

      const stats = await service.extendFromGaps(gaps, 'industrial');

      expect(stats.addedClasses).toBe(1);

      // Verify Pump was added
      const classTriples = await tripleStore.query('kg:Pump', 'rdf:type', 'owl:Class');
      expect(classTriples.length).toBe(1);

      // Verify parent is Equipment
      const parentTriples = await tripleStore.query('kg:Pump', 'rdfs:subClassOf', null);
      expect(parentTriples[0][2]).toBe('kg:Equipment');

      console.log('✅ LLM correctly placed Pump under Equipment in hierarchy');
    });

    test('should add missing property', async () => {
      const gaps = {
        missingClasses: [],
        missingProperties: [
          { name: 'operatingPressure', domain: 'Pump', type: 'number' }
        ],
        missingRelationships: [],
        canReuseFromHierarchy: []
      };

      const stats = await service.extendFromGaps(gaps, 'industrial');

      expect(stats.addedProperties).toBe(1);

      // Verify property was added
      const propTriples = await tripleStore.query('kg:operatingPressure', 'rdf:type', 'owl:DatatypeProperty');
      expect(propTriples.length).toBe(1);

      // Verify domain
      const domainTriples = await tripleStore.query('kg:operatingPressure', 'rdfs:domain', null);
      expect(domainTriples[0][2]).toBe('kg:Pump');

      // Verify range
      const rangeTriples = await tripleStore.query('kg:operatingPressure', 'rdfs:range', null);
      expect(rangeTriples[0][2]).toBe('xsd:decimal');
    });

    test('should add missing relationship', async () => {
      const gaps = {
        missingClasses: [],
        missingProperties: [],
        missingRelationships: [
          { name: 'connectsTo', domain: 'Pump', range: 'Tank' }
        ],
        canReuseFromHierarchy: []
      };

      const stats = await service.extendFromGaps(gaps, 'industrial');

      expect(stats.addedRelationships).toBe(1);

      // Verify relationship was added
      const relTriples = await tripleStore.query('kg:connectsTo', 'rdf:type', 'owl:ObjectProperty');
      expect(relTriples.length).toBe(1);

      // Verify domain
      const domainTriples = await tripleStore.query('kg:connectsTo', 'rdfs:domain', null);
      expect(domainTriples[0][2]).toBe('kg:Pump');

      // Verify range
      const rangeTriples = await tripleStore.query('kg:connectsTo', 'rdfs:range', null);
      expect(rangeTriples[0][2]).toBe('kg:Tank');
    });

    test('should handle SPECIALIZE decision for property', async () => {
      const gaps = {
        missingClasses: [],
        missingProperties: [],
        missingRelationships: [],
        canReuseFromHierarchy: [
          {
            type: 'property',
            implied: { name: 'installationLocation', domain: 'Pump', type: 'string' },
            existing: { property: 'kg:locatedIn', definedIn: 'kg:PhysicalObject' },
            decision: { action: 'SPECIALIZE', reasoning: 'Installation location has specific safety requirements' }
          }
        ]
      };

      const stats = await service.extendFromGaps(gaps, 'industrial');

      expect(stats.specialized).toBe(1);

      // Verify specialized property was added
      const propTriples = await tripleStore.query('kg:installationLocation', 'rdf:type', 'owl:DatatypeProperty');
      expect(propTriples.length).toBe(1);

      // Verify subPropertyOf
      const subPropTriples = await tripleStore.query('kg:installationLocation', 'rdfs:subPropertyOf', null);
      expect(subPropTriples[0][2]).toBe('kg:locatedIn');

      console.log('✅ Successfully specialized locatedIn → installationLocation');
    });

    test('should handle REUSE decision (no action)', async () => {
      const gaps = {
        missingClasses: [],
        missingProperties: [],
        missingRelationships: [],
        canReuseFromHierarchy: [
          {
            type: 'property',
            implied: { name: 'location', domain: 'Pump' },
            existing: { property: 'kg:locatedIn', definedIn: 'kg:PhysicalObject' },
            decision: { action: 'REUSE', reasoning: 'Generic location property is sufficient' }
          }
        ]
      };

      const stats = await service.extendFromGaps(gaps, 'industrial');

      expect(stats.reusedFromHierarchy).toBe(1);
      expect(stats.specialized).toBe(0);

      // Verify no new property was added
      const propTriples = await tripleStore.query('kg:location', 'rdf:type', null);
      expect(propTriples.length).toBe(0);

      console.log('✅ Correctly reused inherited property without creating duplicate');
    });

    test('should index new classes in semantic search', async () => {
      const gaps = {
        missingClasses: [
          { name: 'HeatExchanger', description: 'Device for heat transfer between fluids' }
        ],
        missingProperties: [],
        missingRelationships: [],
        canReuseFromHierarchy: []
      };

      await service.extendFromGaps(gaps, 'industrial');

      // Verify class was indexed
      const results = await semanticSearch.semanticSearch('ontology-classes', 'heat exchanger');
      expect(results.length).toBeGreaterThan(0);

      // Note: metadata is nested in payload (payload.metadata)
      const match = results.find(r => r.payload?.metadata?.classURI === 'kg:HeatExchanger');
      expect(match).toBeDefined();
      expect(match.payload.metadata.label).toBe('HeatExchanger');

      console.log('✅ New class successfully indexed in semantic search');
    });

    test('should handle complete workflow with multiple additions', async () => {
      const gaps = {
        missingClasses: [
          { name: 'Compressor', description: 'Machine for increasing fluid pressure' }
        ],
        missingProperties: [
          { name: 'maxPressure', domain: 'Compressor', type: 'number' }
        ],
        missingRelationships: [
          { name: 'feedsInto', domain: 'Compressor', range: 'Tank' }
        ],
        canReuseFromHierarchy: [
          {
            type: 'relationship',
            implied: { name: 'connectsTo', domain: 'Compressor', range: 'Tank' },
            existing: { relationship: 'kg:connectedTo', definedIn: 'kg:Equipment' },
            decision: { action: 'REUSE', reasoning: 'Generic connection is sufficient' }
          }
        ]
      };

      const stats = await service.extendFromGaps(gaps, 'industrial');

      expect(stats.addedClasses).toBe(1);
      expect(stats.addedProperties).toBe(1);
      expect(stats.addedRelationships).toBe(1);
      expect(stats.reusedFromHierarchy).toBe(1);

      // Verify all were added correctly
      const classTriples = await tripleStore.query('kg:Compressor', 'rdf:type', 'owl:Class');
      expect(classTriples.length).toBe(1);

      const propTriples = await tripleStore.query('kg:maxPressure', 'rdf:type', 'owl:DatatypeProperty');
      expect(propTriples.length).toBe(1);

      const relTriples = await tripleStore.query('kg:feedsInto', 'rdf:type', 'owl:ObjectProperty');
      expect(relTriples.length).toBe(1);

      console.log('✅ Complete workflow: added 1 class, 1 property, 1 relationship, reused 1 inherited concept');
    });
  });
});
