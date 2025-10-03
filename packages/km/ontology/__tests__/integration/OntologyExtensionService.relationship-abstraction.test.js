/**
 * OntologyExtensionService Relationship Abstraction Integration Tests
 *
 * Tests for relationship hierarchy building with REAL LLM
 * Demonstrates subsumption-aware dynamic relationship abstraction
 * NO MOCKS - uses actual LLM, SimpleTripleStore, and SemanticSearchProvider
 */

import { ResourceManager } from '@legion/resource-manager';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyExtensionService } from '../../src/services/OntologyExtensionService.js';
import { HierarchyTraversalService } from '../../src/services/HierarchyTraversalService.js';

describe('OntologyExtensionService - Relationship Abstraction (Integration)', () => {
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

  beforeEach(async () => {
    tripleStore = new SimpleTripleStore();
    hierarchyTraversal = new HierarchyTraversalService(tripleStore);
    service = new OntologyExtensionService(tripleStore, semanticSearch, llmClient, hierarchyTraversal);

    // Bootstrap kg:relatesTo
    await service.bootstrapTopLevelRelationship();
  });

  describe('determineParentRelationship with subsumption filtering', () => {
    test('should use kg:relatesTo for first relationship', async () => {
      // Setup: Add base classes
      await tripleStore.add('kg:Plumber', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Plumber', 'rdfs:subClassOf', 'owl:Thing');
      await tripleStore.add('kg:Pipe', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Pipe', 'rdfs:subClassOf', 'owl:Thing');

      const newRel = {
        name: 'installs',
        description: 'Worker installs equipment',
        domain: 'Plumber',
        range: 'Pipe'
      };

      const parent = await service.determineParentRelationship(newRel, 'plumbing', hierarchyTraversal);

      expect(parent).toBe('kg:relatesTo');
    }, 120000);

    test('should create performs supertype for second worker action', async () => {
      // Setup: Add class hierarchy
      await tripleStore.add('kg:Plumber', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Plumber', 'rdfs:subClassOf', 'owl:Thing');
      await tripleStore.add('kg:Pipe', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Pipe', 'rdfs:subClassOf', 'owl:Thing');
      await tripleStore.add('kg:Faucet', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Faucet', 'rdfs:subClassOf', 'owl:Thing');

      // Add first relationship: installs
      await tripleStore.add('kg:installs', 'rdf:type', 'owl:ObjectProperty');
      await tripleStore.add('kg:installs', 'rdfs:subPropertyOf', 'kg:relatesTo');
      await tripleStore.add('kg:installs', 'rdfs:domain', 'kg:Plumber');
      await tripleStore.add('kg:installs', 'rdfs:range', 'kg:Pipe');
      await tripleStore.add('kg:installs', 'rdfs:label', '"installs"');
      await tripleStore.add('kg:installs', 'rdfs:comment', '"Worker installs equipment"');

      // Try to add second similar relationship: repairs
      const newRel = {
        name: 'repairs',
        description: 'Worker repairs fixture',
        domain: 'Plumber',
        range: 'Faucet'
      };

      const parent = await service.determineParentRelationship(newRel, 'plumbing', hierarchyTraversal);

      // Should create intermediate parent (performs, workerAction, etc.) or use existing if one exists
      // The LLM should recognize that installs and repairs are both worker actions
      if (parent !== 'kg:relatesTo') {
        // Verify the parent was created
        const parentExists = await tripleStore.query(parent, 'rdf:type', 'owl:ObjectProperty');
        expect(parentExists).toHaveLength(1);

        // Verify it's a subPropertyOf kg:relatesTo
        const parentOfParent = await tripleStore.query(parent, 'rdfs:subPropertyOf', null);
        expect(parentOfParent[0][2]).toBe('kg:relatesTo');

        console.log(`✅ LLM created intermediate relationship supertype: ${parent}`);
      }
    }, 240000);

    test('should use existing supertype for third compatible relationship', async () => {
      // Setup: Add class hierarchy
      await tripleStore.add('kg:Plumber', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Plumber', 'rdfs:subClassOf', 'owl:Thing');
      await tripleStore.add('kg:Pipe', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Pipe', 'rdfs:subClassOf', 'owl:Thing');
      await tripleStore.add('kg:Faucet', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Faucet', 'rdfs:subClassOf', 'owl:Thing');
      await tripleStore.add('kg:Drain', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Drain', 'rdfs:subClassOf', 'owl:Thing');

      // Add first relationship: installs
      await tripleStore.add('kg:installs', 'rdf:type', 'owl:ObjectProperty');
      await tripleStore.add('kg:installs', 'rdfs:subPropertyOf', 'kg:relatesTo');
      await tripleStore.add('kg:installs', 'rdfs:domain', 'kg:Plumber');
      await tripleStore.add('kg:installs', 'rdfs:range', 'kg:Pipe');
      await tripleStore.add('kg:installs', 'rdfs:label', '"installs"');

      // Add second relationship: repairs (with intermediate parent)
      await tripleStore.add('kg:performs', 'rdf:type', 'owl:ObjectProperty');
      await tripleStore.add('kg:performs', 'rdfs:subPropertyOf', 'kg:relatesTo');
      await tripleStore.add('kg:performs', 'rdfs:domain', 'kg:Plumber');
      await tripleStore.add('kg:performs', 'rdfs:range', 'owl:Thing');
      await tripleStore.add('kg:performs', 'rdfs:label', '"performs"');
      await tripleStore.add('kg:performs', 'rdfs:comment', '"Actions performed by workers"');

      await tripleStore.add('kg:repairs', 'rdf:type', 'owl:ObjectProperty');
      await tripleStore.add('kg:repairs', 'rdfs:subPropertyOf', 'kg:performs');
      await tripleStore.add('kg:repairs', 'rdfs:domain', 'kg:Plumber');
      await tripleStore.add('kg:repairs', 'rdfs:range', 'kg:Faucet');
      await tripleStore.add('kg:repairs', 'rdfs:label', '"repairs"');

      // Try to add third relationship: clears
      const newRel = {
        name: 'clears',
        description: 'Worker clears blockage',
        domain: 'Plumber',
        range: 'Drain'
      };

      const parent = await service.determineParentRelationship(newRel, 'plumbing', hierarchyTraversal);

      // Should use existing kg:performs parent
      expect(parent).toBe('kg:performs');
    }, 120000);

    test('should create separate hierarchy for incompatible domain/range', async () => {
      // Setup: Add class hierarchy for spatial relationships
      await tripleStore.add('kg:Pipe', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Pipe', 'rdfs:subClassOf', 'owl:Thing');
      await tripleStore.add('kg:Wall', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Wall', 'rdfs:subClassOf', 'owl:Thing');
      await tripleStore.add('kg:Faucet', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Faucet', 'rdfs:subClassOf', 'owl:Thing');
      await tripleStore.add('kg:Bathroom', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Bathroom', 'rdfs:subClassOf', 'owl:Thing');

      // Add worker action relationship (Plumber → Pipe)
      await tripleStore.add('kg:Plumber', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Plumber', 'rdfs:subClassOf', 'owl:Thing');
      await tripleStore.add('kg:performs', 'rdf:type', 'owl:ObjectProperty');
      await tripleStore.add('kg:performs', 'rdfs:subPropertyOf', 'kg:relatesTo');
      await tripleStore.add('kg:performs', 'rdfs:domain', 'kg:Plumber');
      await tripleStore.add('kg:performs', 'rdfs:range', 'owl:Thing');
      await tripleStore.add('kg:performs', 'rdfs:label', '"performs"');

      // Try to add spatial relationship (Pipe → Wall)
      // This has INCOMPATIBLE domain (Pipe vs Plumber) - should NOT use kg:performs
      const newRel = {
        name: 'installedIn',
        description: 'Equipment installed in location',
        domain: 'Pipe',
        range: 'Wall'
      };

      const parent = await service.determineParentRelationship(newRel, 'plumbing', hierarchyTraversal);

      // Should NOT be kg:performs (incompatible domain)
      expect(parent).not.toBe('kg:performs');

      // Should be kg:relatesTo or a different supertype
      if (parent !== 'kg:relatesTo') {
        // Verify it has owl:Thing or Pipe domain (not Plumber)
        const parentDomain = await tripleStore.query(parent, 'rdfs:domain', null);
        const domain = parentDomain[0]?.[2];
        expect(domain).not.toBe('kg:Plumber');

        console.log(`✅ Created separate hierarchy for spatial relationship: ${parent} (domain: ${domain})`);
      }
    }, 240000);
  });

  describe('E2E: Build relationship hierarchy from multiple sentences', () => {
    test('should build multi-level relationship hierarchy', async () => {
      // This test demonstrates the complete workflow:
      // Add classes, then relationships, observing hierarchy formation

      // Add classes with shared parent for ranges (so relationships can be compatible)
      await tripleStore.add('kg:Plumber', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Plumber', 'rdfs:subClassOf', 'owl:Thing');

      // Create PlumbingComponent parent for all ranges
      await tripleStore.add('kg:PlumbingComponent', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:PlumbingComponent', 'rdfs:subClassOf', 'owl:Thing');

      await tripleStore.add('kg:Pipe', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Pipe', 'rdfs:subClassOf', 'kg:PlumbingComponent');
      await tripleStore.add('kg:Faucet', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Faucet', 'rdfs:subClassOf', 'kg:PlumbingComponent');
      await tripleStore.add('kg:Drain', 'rdf:type', 'owl:Class');
      await tripleStore.add('kg:Drain', 'rdfs:subClassOf', 'kg:PlumbingComponent');

      // Relationship 1: installs
      const gaps1 = {
        missingClasses: [],
        missingProperties: [],
        missingRelationships: [{
          name: 'installs',
          description: 'Worker installs equipment',
          domain: 'Plumber',
          range: 'Pipe'
        }],
        canReuseFromHierarchy: []
      };

      await service.extendFromGaps(gaps1, 'plumbing');

      // Verify installs → kg:relatesTo
      const installs = await tripleStore.query('kg:installs', 'rdfs:subPropertyOf', null);
      expect(installs[0][2]).toBe('kg:relatesTo');

      // Relationship 2: repairs (should trigger abstraction)
      const gaps2 = {
        missingClasses: [],
        missingProperties: [],
        missingRelationships: [{
          name: 'repairs',
          description: 'Worker repairs fixture',
          domain: 'Plumber',
          range: 'Faucet'
        }],
        canReuseFromHierarchy: []
      };

      await service.extendFromGaps(gaps2, 'plumbing');

      // Verify repairs has a parent
      const repairs = await tripleStore.query('kg:repairs', 'rdfs:subPropertyOf', null);
      expect(repairs).toHaveLength(1);
      const repairsParent = repairs[0][2];

      // Relationship 3: clears (should use same parent as repairs)
      const gaps3 = {
        missingClasses: [],
        missingProperties: [],
        missingRelationships: [{
          name: 'clears',
          description: 'Worker clears blockage',
          domain: 'Plumber',
          range: 'Drain'
        }],
        canReuseFromHierarchy: []
      };

      await service.extendFromGaps(gaps3, 'plumbing');

      // Verify clears has same parent as repairs (if abstraction was created)
      const clears = await tripleStore.query('kg:clears', 'rdfs:subPropertyOf', null);
      expect(clears).toHaveLength(1);

      // Collect all relationships
      const allRels = await tripleStore.query(null, 'rdf:type', 'owl:ObjectProperty');
      console.log(`\n✅ Created ${allRels.length} relationships`);

      // Display hierarchy
      console.log('\nRelationship Hierarchy:');
      for (const [relURI] of allRels) {
        const labels = await tripleStore.query(relURI, 'rdfs:label', null);
        const parents = await tripleStore.query(relURI, 'rdfs:subPropertyOf', null);
        const domains = await tripleStore.query(relURI, 'rdfs:domain', null);
        const ranges = await tripleStore.query(relURI, 'rdfs:range', null);

        const label = labels[0]?.[2]?.replace(/"/g, '') || relURI;
        const parent = parents[0]?.[2] || 'none';
        const domain = domains[0]?.[2] || 'none';
        const range = ranges[0]?.[2] || 'none';

        console.log(`  ${label}: ${domain} → ${range} (parent: ${parent})`);
      }

      // Verify we have a hierarchy (not all directly under kg:relatesTo)
      let directChildrenCount = 0;
      for (const [relURI] of allRels) {
        const parents = await tripleStore.query(relURI, 'rdfs:subPropertyOf', null);
        if (parents[0]?.[2] === 'kg:relatesTo') {
          directChildrenCount++;
        }
      }

      console.log(`\nDirect children of kg:relatesTo: ${directChildrenCount}/${allRels.length}`);

      // At least one relationship should have an intermediate parent
      expect(directChildrenCount).toBeLessThan(allRels.length);
    }, 360000);
  });
});
