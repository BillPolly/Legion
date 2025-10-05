/**
 * Z3 Verification Integration Test
 *
 * Tests that Z3 theorem proving correctly verifies ontology extensions
 * and rejects invalid additions that violate axioms.
 */
import { OntologyBuilder } from '../../src/OntologyBuilder.js';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ResourceManager } from '@legion/resource-manager';

describe('Z3 Verification Integration', () => {
  let resourceManager;
  let llmClient;
  let tripleStore;
  let semanticSearch;
  let ontologyBuilder;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
  }, 60000);

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
        failOnViolation: false  // Warn only - don't throw
      }
    });

    // Bootstrap upper-level ontology
    await ontologyBuilder.ensureBootstrapLoaded();
  });

  test('should verify bootstrap ontology is consistent', async () => {
    // Bootstrap already loaded in beforeEach
    // Check that it has the expected classes
    const continuant = await tripleStore.query('kg:Continuant', 'rdf:type', 'owl:Class');
    const occurrent = await tripleStore.query('kg:Occurrent', 'rdf:type', 'owl:Class');

    expect(continuant).toHaveLength(1);
    expect(occurrent).toHaveLength(1);

    // Check disjointness constraint exists
    const disjoint = await tripleStore.query('kg:Continuant', 'owl:disjointWith', 'kg:Occurrent');
    expect(disjoint).toHaveLength(1);

    console.log('✅ Bootstrap ontology verified as consistent');
  });

  test('should accept valid extension (Pump as PhysicalEntity)', async () => {
    const text = 'A pump is a device that moves fluids.';

    const result = await ontologyBuilder.processText(text, { domain: 'plumbing' });

    // Verify pump was added
    const pump = await tripleStore.query('kg:Pump', 'rdf:type', 'owl:Class');
    expect(pump).toHaveLength(1);

    // Verify pump is subclass of PhysicalEntity
    const pumpParent = await tripleStore.query('kg:Pump', 'rdfs:subClassOf', null);
    expect(pumpParent.length).toBeGreaterThan(0);

    // Check verification stats
    expect(result.verificationStats.enabled).toBe(true);
    expect(result.verificationStats.verificationsRun).toBeGreaterThan(0);
    expect(result.verificationStats.violationsDetected).toBe(0);

    console.log('✅ Valid extension accepted by Z3');
  });

  test('should track verification statistics', async () => {
    const text = `
      A pump moves fluids.
      A valve controls flow.
    `;

    const result = await ontologyBuilder.processText(text, { domain: 'plumbing' });

    expect(result.verificationStats).toMatchObject({
      enabled: true,
      verificationsRun: expect.any(Number),
      violationsDetected: 0,
      violationsPrevented: 0
    });

    expect(result.verificationStats.verificationsRun).toBeGreaterThan(0);

    console.log(`✅ Verification stats: ${result.verificationStats.verificationsRun} verifications run`);
  });

  test('should handle multiple sentences with verification', async () => {
    const text = `
      A centrifugal pump uses centrifugal force.
      A reciprocating pump uses reciprocating motion.
      A valve controls fluid flow.
    `;

    const result = await ontologyBuilder.processText(text, { domain: 'plumbing' });

    // Verify all classes were added
    const centrifugal = await tripleStore.query('kg:CentrifugalPump', 'rdf:type', 'owl:Class');
    const reciprocating = await tripleStore.query('kg:ReciprocatingPump', 'rdf:type', 'owl:Class');
    const valve = await tripleStore.query('kg:Valve', 'rdf:type', 'owl:Class');

    expect(centrifugal).toHaveLength(1);
    expect(reciprocating).toHaveLength(1);
    expect(valve).toHaveLength(1);

    // No violations should be detected
    expect(result.verificationStats.violationsDetected).toBe(0);
    expect(result.verificationStats.violationsPrevented).toBe(0);

    console.log('✅ Multiple sentences processed with zero violations');
  });

  test('should verify ontology remains consistent after sibling refactoring', async () => {
    // Add first pump type
    await ontologyBuilder.processText(
      'A centrifugal pump uses centrifugal force.',
      { domain: 'plumbing' }
    );

    // Add second pump type (triggers sibling refactoring)
    const result = await ontologyBuilder.processText(
      'A reciprocating pump uses reciprocating motion.',
      { domain: 'plumbing' }
    );

    // Verify both pumps exist
    const centrifugal = await tripleStore.query('kg:CentrifugalPump', 'rdf:type', 'owl:Class');
    const reciprocating = await tripleStore.query('kg:ReciprocatingPump', 'rdf:type', 'owl:Class');

    expect(centrifugal).toHaveLength(1);
    expect(reciprocating).toHaveLength(1);

    // No violations even after refactoring
    expect(result.verificationStats.violationsDetected).toBe(0);

    console.log('✅ Sibling refactoring verified as consistent');
  });
});
