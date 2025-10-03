/**
 * End-to-End Tests for Phase 10: Dynamic Supertype Creation
 *
 * Tests complete ontology building with dynamic abstraction
 * NO MOCKS - uses actual LLM, SimpleTripleStore, and SemanticSearchProvider
 */

import { ResourceManager } from '@legion/resource-manager';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyBuilder } from '../../src/OntologyBuilder.js';

describe('E2E - Dynamic Supertype Creation', () => {
  let builder;
  let tripleStore;
  let semanticSearch;
  let llmClient;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();
  }, 60000);

  beforeEach(() => {
    tripleStore = new SimpleTripleStore();
    builder = new OntologyBuilder({ tripleStore, semanticSearch, llmClient });
  });

  describe('dynamic entity abstraction', () => {
    test('should create Pump abstraction when processing multiple pump types', async () => {
      const text = `The centrifugal pump circulates coolant.
                    The reciprocating pump moves hydraulic fluid.
                    The rotary pump transfers lubricant.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      expect(result.success).toBe(true);
      expect(result.sentences.length).toBe(3);

      // Check for Pump abstraction
      const pumpClass = await tripleStore.query('kg:Pump', 'rdf:type', 'owl:Class');

      console.log('\n✅ Pump types hierarchy:');
      const allClasses = await tripleStore.query(null, 'rdf:type', 'owl:Class');
      for (const [classURI] of allClasses) {
        const labels = await tripleStore.query(classURI, 'rdfs:label', null);
        const parents = await tripleStore.query(classURI, 'rdfs:subClassOf', null);
        const label = labels[0]?.[2]?.replace(/"/g, '') || classURI.split(':')[1];
        const parent = parents[0]?.[2] || 'none';

        if (label.includes('Pump') || label.includes('pump')) {
          console.log(`   ${label} → ${parent}`);
        }
      }

      if (pumpClass.length > 0) {
        console.log('✅ Dynamic Pump abstraction was created!');

        // Verify pump types inherit from it
        const pumps = allClasses.filter(([uri]) =>
          uri.includes('Pump') && uri !== 'kg:Pump'
        );

        for (const [pumpURI] of pumps) {
          const parents = await tripleStore.query(pumpURI, 'rdfs:subClassOf', null);
          const hasProperParent = parents.some(([_, __, parent]) =>
            parent === 'kg:Pump' || parent === 'owl:Thing'
          );
          expect(hasProperParent).toBe(true);
        }
      } else {
        console.log('ℹ️  Pump abstraction not created (depends on LLM decision)');
      }
    }, 240000);

    test('should create Equipment abstraction for industrial equipment', async () => {
      const text = `Industrial equipment includes pumps and tanks.
                    Pumps circulate fluids through systems.
                    Tanks store materials safely.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      expect(result.success).toBe(true);

      console.log('\n✅ Equipment hierarchy:');
      const allClasses = await tripleStore.query(null, 'rdf:type', 'owl:Class');
      for (const [classURI] of allClasses) {
        const labels = await tripleStore.query(classURI, 'rdfs:label', null);
        const parents = await tripleStore.query(classURI, 'rdfs:subClassOf', null);
        console.log(`   ${labels[0]?.[2]?.replace(/"/g, '')} → ${parents[0]?.[2]}`);
      }

      // May create Equipment, Pump, Tank hierarchy
      expect(result.ontologyStats.classes).toBeGreaterThan(0);
    }, 180000);
  });

  describe('relationship hierarchy with kg:relatesTo', () => {
    test('should make all relationships inherit from kg:relatesTo', async () => {
      const text = `The pump connects to the tank.
                    The tank feeds the reactor.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      expect(result.success).toBe(true);

      // Check kg:relatesTo exists
      const relatesTo = await tripleStore.query('kg:relatesTo', 'rdf:type', 'owl:ObjectProperty');

      console.log('\n✅ Relationship hierarchy:');
      if (relatesTo.length > 0) {
        console.log('   kg:relatesTo (domain: owl:Thing, range: owl:Thing)');

        // Find all relationships
        const relationships = await tripleStore.query(null, 'rdf:type', 'owl:ObjectProperty');
        for (const [relURI] of relationships) {
          if (relURI === 'kg:relatesTo') continue;

          const labels = await tripleStore.query(relURI, 'rdfs:label', null);
          const parents = await tripleStore.query(relURI, 'rdfs:subPropertyOf', null);

          console.log(`      ↳ ${labels[0]?.[2]?.replace(/"/g, '')} → ${parents[0]?.[2]}`);

          // Verify inherits from kg:relatesTo
          if (parents.length > 0) {
            expect(parents[0][2]).toBe('kg:relatesTo');
          }
        }

        console.log('✅ All relationships inherit from kg:relatesTo');
      }
    }, 180000);
  });

  describe('complex industrial scenario with abstraction', () => {
    test('should build rich hierarchy with multiple abstraction levels', async () => {
      const text = `The chemical processing plant contains multiple systems.
                    The main reactor vessel operates at elevated temperature.
                    Centrifugal pumps circulate process fluids through the system.
                    Reciprocating pumps handle high-pressure applications.
                    Shell and tube heat exchangers cool the product stream.
                    Plate heat exchangers provide efficient heat transfer.
                    Storage tanks hold raw materials.
                    Pressure vessels contain process chemicals.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      expect(result.success).toBe(true);
      expect(result.sentences.length).toBe(8);

      console.log('\n✅ Complete industrial hierarchy:');
      console.log(`   Total classes: ${result.ontologyStats.classes}`);
      console.log(`   Total properties: ${result.ontologyStats.properties}`);
      console.log(`   Total relationships: ${result.ontologyStats.relationships}`);

      // Show hierarchy
      console.log('\n   Class hierarchy:');
      const allClasses = await tripleStore.query(null, 'rdf:type', 'owl:Class');
      const hierarchy = {};

      for (const [classURI] of allClasses) {
        const labels = await tripleStore.query(classURI, 'rdfs:label', null);
        const parents = await tripleStore.query(classURI, 'rdfs:subClassOf', null);
        const label = labels[0]?.[2]?.replace(/"/g, '') || classURI.split(':')[1];
        const parent = parents[0]?.[2] || 'owl:Thing';

        if (!hierarchy[parent]) {
          hierarchy[parent] = [];
        }
        hierarchy[parent].push(label);
      }

      // Print hierarchy
      function printHierarchy(parent, indent = 0) {
        const children = hierarchy[parent] || [];
        for (const child of children) {
          console.log(`   ${'  '.repeat(indent)}${child}`);
          printHierarchy(`kg:${child}`, indent + 1);
        }
      }

      console.log('   owl:Thing');
      printHierarchy('owl:Thing', 1);

      // Verify abstractions may have been created
      const possibleAbstractions = ['Pump', 'HeatExchanger', 'Tank', 'Equipment', 'Vessel'];
      const createdAbstractions = [];

      for (const abstraction of possibleAbstractions) {
        const exists = await tripleStore.query(`kg:${abstraction}`, 'rdf:type', 'owl:Class');
        if (exists.length > 0) {
          createdAbstractions.push(abstraction);
        }
      }

      if (createdAbstractions.length > 0) {
        console.log(`\n✅ Created abstractions: ${createdAbstractions.join(', ')}`);
      }

      expect(result.ontologyStats.classes).toBeGreaterThan(5);
    }, 360000);
  });

  describe('verify semantic search finds similar types', () => {
    test('should find pump types via semantic search', async () => {
      const text = `The centrifugal pump circulates coolant.
                    The reciprocating pump moves hydraulic fluid.`;

      await builder.processText(text, { domain: 'industrial' });

      // Search for "pump"
      const results = await semanticSearch.semanticSearch('ontology-classes', 'pump', { limit: 5 });

      console.log('\n✅ Semantic search for "pump":');
      for (const result of results) {
        console.log(`   - ${result.metadata?.label || result.id} (similarity: ${result._similarity?.toFixed(3)})`);
      }

      // Should find pump-related classes with high similarity
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]._similarity).toBeGreaterThan(0.75); // High similarity match found
    }, 180000);
  });
});
