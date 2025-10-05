/**
 * Integration Test: Sibling Refactoring with Intermediate Parent Creation
 *
 * Tests that when the LLM identifies siblings, it:
 * 1. Creates an intermediate parent class
 * 2. Refactors existing siblings to point to the new parent
 * 3. Results in a correct hierarchy
 */

import { OntologyBuilder } from '../../src/OntologyBuilder.js';
import { SimpleTripleStore } from '@legion/rdf';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';

describe('Sibling Refactoring Integration', () => {
  let tripleStore;
  let ontologyBuilder;
  let semanticSearch;
  let llmClient;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
  });

  beforeEach(async () => {
    tripleStore = new SimpleTripleStore();
    semanticSearch = await SemanticSearchProvider.create(resourceManager);

    ontologyBuilder = new OntologyBuilder({
      tripleStore,
      semanticSearch,
      llmClient,
      verification: {
        enabled: true,
        verifyBootstrap: true,
        verifyBeforeExtension: true,
        verifyAfterExtension: true,
        failOnViolation: false  // Warn only for testing
      }
    });

    // Bootstrap
    await ontologyBuilder.ensureBootstrapLoaded();
  });

  test('should create intermediate parent and use it for subsequent siblings', async () => {
    // Step 1: Add first pump type (CentrifugalPump)
    // LLM is smart enough to recognize "CentrifugalPump" implies a "Pump" parent
    const text1 = 'A centrifugal pump uses centrifugal force to move fluids.';
    await ontologyBuilder.processText(text1, { domain: 'plumbing' });

    // Verify CentrifugalPump exists
    const centrifugalPumpBefore = tripleStore.query('kg:CentrifugalPump', 'rdfs:subClassOf', null);
    expect(centrifugalPumpBefore).toHaveLength(1);
    const initialParent = centrifugalPumpBefore[0][2];

    console.log(`CentrifugalPump initial parent: ${initialParent}`);

    // Step 2: Add second pump type (ReciprocatingPump)
    // Should use the existing Pump parent (no refactoring needed if Pump already exists)
    const text2 = 'A reciprocating pump uses reciprocating motion to move fluids.';
    await ontologyBuilder.processText(text2, { domain: 'plumbing' });

    // Step 3: Verify Pump class exists
    const pumpClass = tripleStore.query('kg:Pump', 'rdf:type', 'owl:Class');
    expect(pumpClass.length).toBeGreaterThanOrEqual(1);

    // Step 4: Verify Pump has a reasonable parent
    const pumpParent = tripleStore.query('kg:Pump', 'rdfs:subClassOf', null);
    expect(pumpParent).toHaveLength(1);
    console.log(`Pump parent: ${pumpParent[0][2]}`);

    // Step 5: Verify both pumps are children of Pump
    const centrifugalPumpAfter = tripleStore.query('kg:CentrifugalPump', 'rdfs:subClassOf', null);
    expect(centrifugalPumpAfter).toHaveLength(1);
    expect(centrifugalPumpAfter[0][2]).toBe('kg:Pump');

    const reciprocatingPump = tripleStore.query('kg:ReciprocatingPump', 'rdfs:subClassOf', null);
    expect(reciprocatingPump).toHaveLength(1);
    expect(reciprocatingPump[0][2]).toBe('kg:Pump');

    console.log('✅ Hierarchy creation successful:');
    console.log(`  ${pumpParent[0][2]}`);
    console.log(`    └─ kg:Pump`);
    console.log(`       ├─ kg:CentrifugalPump`);
    console.log(`       └─ kg:ReciprocatingPump`);
  });

  test('should handle third sibling and refactor multiple existing classes', async () => {
    // Step 1: Add CentrifugalPump
    await ontologyBuilder.processText(
      'A centrifugal pump uses centrifugal force.',
      { domain: 'plumbing' }
    );

    // Step 2: Add ReciprocatingPump (creates Pump parent, refactors CentrifugalPump)
    await ontologyBuilder.processText(
      'A reciprocating pump uses reciprocating motion.',
      { domain: 'plumbing' }
    );

    // Step 3: Add RotaryPump (should use existing Pump parent)
    await ontologyBuilder.processText(
      'A rotary pump uses rotary motion to move fluids.',
      { domain: 'plumbing' }
    );

    // Verify all three pumps are children of Pump
    const pumps = tripleStore.query(null, 'rdfs:subClassOf', 'kg:Pump');
    expect(pumps.length).toBeGreaterThanOrEqual(3);

    const pumpTypes = pumps.map(t => t[0]);
    expect(pumpTypes).toContain('kg:CentrifugalPump');
    expect(pumpTypes).toContain('kg:ReciprocatingPump');
    expect(pumpTypes).toContain('kg:RotaryPump');

    console.log('✅ Multiple siblings correctly under Pump parent:');
    pumps.forEach(([child]) => {
      console.log(`  kg:Pump ← ${child}`);
    });
  });

  test('should preserve other properties during refactoring', async () => {
    // Step 1: Add CentrifugalPump with properties
    await ontologyBuilder.processText(
      'A centrifugal pump has high flow rate.',
      { domain: 'plumbing' }
    );

    // Verify CentrifugalPump has label
    const labelBefore = tripleStore.query('kg:CentrifugalPump', 'rdfs:label', null);
    expect(labelBefore.length).toBeGreaterThan(0);

    // Step 2: Add ReciprocatingPump (triggers refactoring)
    await ontologyBuilder.processText(
      'A reciprocating pump has high pressure.',
      { domain: 'plumbing' }
    );

    // Verify CentrifugalPump still has its label after refactoring
    const labelAfter = tripleStore.query('kg:CentrifugalPump', 'rdfs:label', null);
    expect(labelAfter).toEqual(labelBefore);

    // Verify CentrifugalPump was refactored
    const parent = tripleStore.query('kg:CentrifugalPump', 'rdfs:subClassOf', null);
    expect(parent[0][2]).toBe('kg:Pump');

    console.log('✅ Properties preserved during refactoring');
  });

  test('should not refactor if parent already exists', async () => {
    // Step 1: Manually create Pump parent first
    tripleStore.add('kg:Pump', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:Pump', 'rdfs:label', '"Pump"');
    tripleStore.add('kg:Pump', 'rdfs:subClassOf', 'kg:PhysicalEntity');

    // Index Pump in semantic search
    await semanticSearch.insert('ontology-classes', {
      text: 'Pump: Device for moving fluids',
      metadata: {
        classURI: 'kg:Pump',
        label: 'Pump'
      }
    });

    // Step 2: Add CentrifugalPump - should use existing Pump parent
    await ontologyBuilder.processText(
      'A centrifugal pump uses centrifugal force.',
      { domain: 'plumbing' }
    );

    // Verify CentrifugalPump is child of Pump
    const parent = tripleStore.query('kg:CentrifugalPump', 'rdfs:subClassOf', null);
    expect(parent[0][2]).toBe('kg:Pump');

    // Verify only one Pump class exists (no duplicate created)
    const pumpClasses = tripleStore.query('kg:Pump', 'rdf:type', 'owl:Class');
    expect(pumpClasses).toHaveLength(1);

    console.log('✅ Used existing parent, no refactoring needed');
  });
});
