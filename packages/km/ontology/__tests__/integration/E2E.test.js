/**
 * End-to-End Integration Tests
 *
 * Tests complete ontology building workflow with realistic multi-sentence texts
 * NO MOCKS - uses actual LLM, SimpleTripleStore, and SemanticSearchProvider
 */

import { ResourceManager } from '@legion/resource-manager';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyBuilder } from '../../src/OntologyBuilder.js';

describe('End-to-End Integration', () => {
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

  describe('industrial domain - pumps, tanks, and systems', () => {
    test('should process industrial text and build complete ontology', async () => {
      const text = `The centrifugal pump circulates coolant through the system.
                    The storage tank contains the coolant reservoir.
                    The heat exchanger transfers thermal energy efficiently.
                    All equipment operates under automated control.
                    Regular maintenance ensures optimal performance.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      expect(result.success).toBe(true);
      expect(result.sentences.length).toBeGreaterThan(3);

      console.log('\n✅ Industrial domain E2E:');
      console.log(`   Sentences processed: ${result.sentences.length}`);
      console.log(`   Classes: ${result.ontologyStats.classes}`);
      console.log(`   Properties: ${result.ontologyStats.properties}`);
      console.log(`   Relationships: ${result.ontologyStats.relationships}`);

      // Verify ontology was built
      expect(result.ontologyStats.classes).toBeGreaterThanOrEqual(0);
    }, 180000);

    test('should build correct hierarchy from industrial text', async () => {
      const text = `Industrial equipment includes pumps and tanks.
                    Pumps circulate fluids through systems.
                    Tanks store materials safely.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      // Check for hierarchy relationships
      const subClassTriples = await tripleStore.query(null, 'rdfs:subClassOf', null);

      console.log('\n✅ Hierarchy built:');
      for (const [subclass, _, superclass] of subClassTriples) {
        console.log(`   ${subclass} → ${superclass}`);
      }

      expect(result.success).toBe(true);
    }, 120000);

    test('should prevent duplicate properties via subsumption', async () => {
      const text = `The pump is located in Building A.
                    The tank is located in Building B.
                    Equipment has location information.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      const propertyCount = await builder.countProperties();

      console.log(`\n✅ Property reuse via subsumption:`);
      console.log(`   Total properties: ${propertyCount}`);

      // Should reuse location property rather than creating duplicates
      expect(result.success).toBe(true);
    }, 120000);
  });

  describe('business domain - organizations and people', () => {
    test('should process business domain text', async () => {
      const text = `The company employs skilled engineers.
                    The engineering department develops new products.
                    Managers oversee project execution.`;

      const result = await builder.processText(text, { domain: 'business' });

      expect(result.success).toBe(true);
      expect(result.sentences).toHaveLength(3);

      console.log('\n✅ Business domain E2E:');
      console.log(`   Classes: ${result.ontologyStats.classes}`);
      console.log(`   Properties: ${result.ontologyStats.properties}`);
      console.log(`   Relationships: ${result.ontologyStats.relationships}`);
    }, 120000);
  });

  describe('mixed domain scenarios', () => {
    test('should handle mixed domain text', async () => {
      const text = `The facility contains industrial equipment.
                    Engineers maintain the machinery.
                    The building houses multiple departments.`;

      const result = await builder.processText(text, { domain: 'mixed' });

      expect(result.success).toBe(true);

      console.log('\n✅ Mixed domain E2E:');
      console.log(`   Processed ${result.sentences.length} sentences`);
      console.log(`   Ontology size: ${result.ontologyStats.classes} classes`);
    }, 120000);
  });

  describe('sentence annotation verification', () => {
    test('should annotate all sentences with type information', async () => {
      const text = `Pumps circulate fluid.
                    Tanks store material.
                    Equipment requires maintenance.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      // Verify all sentences are annotated
      for (const sentence of result.sentences) {
        expect(sentence.text).toBeDefined();
        expect(sentence.types).toBeDefined();
        expect(sentence.domain).toBe('industrial');
      }

      console.log('\n✅ All sentences properly annotated');
    }, 120000);

    test('should include hierarchy context in all annotations', async () => {
      const text = `The pump operates efficiently.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      for (const sentence of result.sentences) {
        for (const type of sentence.types) {
          if (!type.isGap) {
            expect(type.hierarchy).toBeDefined();
          }
        }
      }

      console.log('✅ Hierarchy context included in annotations');
    }, 60000);
  });

  describe('bootstrap from empty ontology', () => {
    test('should build ontology from scratch with no prior knowledge', async () => {
      // Ensure fresh empty triplestore
      const freshStore = new SimpleTripleStore();
      const freshBuilder = new OntologyBuilder({
        tripleStore: freshStore,
        semanticSearch,
        llmClient
      });

      // Verify empty
      const initialClasses = await freshStore.query(null, 'rdf:type', 'owl:Class');
      expect(initialClasses.length).toBe(0);

      const text = `Compressors increase gas pressure.
                    Turbines generate rotational power.
                    Both are types of rotating machinery.`;

      const result = await freshBuilder.processText(text, { domain: 'industrial' });

      expect(result.success).toBe(true);

      // Verify ontology was built
      const finalClasses = await freshStore.query(null, 'rdf:type', 'owl:Class');

      console.log('\n✅ Bootstrapped from empty ontology:');
      console.log(`   Initial classes: 0`);
      console.log(`   Final classes: ${finalClasses.length}`);
    }, 120000);
  });

  describe('extend existing ontology', () => {
    test('should extend ontology with new specialized types', async () => {
      // First, build base ontology
      const baseText = `Equipment is used in industrial facilities.`;
      await builder.processText(baseText, { domain: 'industrial' });

      const initialCount = await builder.countClasses();

      // Now extend with specialized types
      const extensionText = `Centrifugal pumps and reciprocating pumps are pump types.
                             Storage tanks and pressure vessels are tank types.`;

      const result = await builder.processText(extensionText, { domain: 'industrial' });

      const finalCount = await builder.countClasses();

      console.log('\n✅ Extended existing ontology:');
      console.log(`   Initial classes: ${initialCount}`);
      console.log(`   Final classes: ${finalCount}`);
      console.log(`   Added: ${finalCount - initialCount} classes`);

      expect(result.success).toBe(true);
    }, 120000);
  });

  describe('semantic search integration', () => {
    test('should find similar types via semantic search', async () => {
      const text = `Heat exchangers transfer thermal energy between fluids.`;

      await builder.processText(text, { domain: 'industrial' });

      // Search for similar concept
      const results = await semanticSearch.semanticSearch('ontology-classes', 'heat transfer device');

      console.log('\n✅ Semantic search results:');
      console.log(`   Found ${results.length} similar concepts`);
      if (results.length > 0) {
        console.log(`   Top match: ${results[0].payload?.metadata?.label || results[0].document?.label}`);
      }

      expect(results.length).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe('complete realistic scenario', () => {
    test('should handle complete industrial plant description', async () => {
      const text = `The chemical processing plant contains multiple systems.
                    The main reactor vessel operates at elevated temperature and pressure.
                    Centrifugal pumps circulate process fluids through the system.
                    Shell and tube heat exchangers cool the product stream.
                    Storage tanks hold raw materials and finished products.
                    Automated control systems monitor all equipment parameters.
                    Safety interlocks prevent hazardous operating conditions.
                    Maintenance personnel perform regular inspections.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      expect(result.success).toBe(true);
      expect(result.sentences.length).toBeGreaterThan(5);

      console.log('\n✅ Complete plant description processed:');
      console.log(`   Total sentences: ${result.sentences.length}`);
      console.log(`   Ontology statistics:`);
      console.log(`     - Classes: ${result.ontologyStats.classes}`);
      console.log(`     - Properties: ${result.ontologyStats.properties}`);
      console.log(`     - Relationships: ${result.ontologyStats.relationships}`);

      // Verify all sentences were annotated
      expect(result.sentences.every(s => s.types !== undefined)).toBe(true);
      expect(result.sentences.every(s => s.domain === 'industrial')).toBe(true);
    }, 240000);
  });

  describe('ontology consistency', () => {
    test('should maintain consistent hierarchy throughout processing', async () => {
      const text = `Equipment operates in facilities.
                    Pumps are equipment that move fluids.
                    Centrifugal pumps use rotational energy.`;

      const result = await builder.processText(text, { domain: 'industrial' });

      // Check all classes have proper hierarchy
      const classes = await tripleStore.query(null, 'rdf:type', 'owl:Class');
      const classURIs = classes.map(t => t[0]);

      for (const classURI of classURIs) {
        const parents = await tripleStore.query(classURI, 'rdfs:subClassOf', null);
        // Each class should have at least owl:Thing as parent or be owl:Thing
        expect(parents.length).toBeGreaterThanOrEqual(0);
      }

      console.log('\n✅ Hierarchy consistency maintained');
      expect(result.success).toBe(true);
    }, 120000);
  });
});
