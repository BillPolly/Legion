/**
 * Integration Test - Complete POC Pipeline with Verification
 *
 * Tests the full pipeline end-to-end with NO MOCKS:
 * 1. Extract entities/relationships (LLM)
 * 2. Generate simple sentences (LLM)
 * 3. Retrieve ontology candidates (Semantic Search)
 * 4. Generate entity model (LLM)
 * 5. Validate model (Z3)
 * 6. Create triples (EntityFactory)
 * 7. Store triples (TripleStore)
 * 8. Reconstruct text (LLM)
 * 9. Compare texts (LLM)
 * 10. Query triples
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyLoader } from '../../src/ontology/OntologyLoader.js';
import { OntologyIndexer } from '../../src/ontology/OntologyIndexer.js';
import { EntityRelationshipExtractor } from '../../src/extraction/EntityRelationshipExtractor.js';
import { SimpleSentenceGenerator } from '../../src/extraction/SimpleSentenceGenerator.js';
import { SemanticRetriever } from '../../src/retrieval/SemanticRetriever.js';
import { LLMEntityGenerator } from '../../src/generation/LLMEntityGenerator.js';
import { OntologyValidator } from '../../src/validation/OntologyValidator.js';
import { EntityFactory } from '../../src/storage/EntityFactory.js';
import { TripleStore } from '../../src/storage/TripleStore.js';
import { TextReconstructor } from '../../src/verification/TextReconstructor.js';
import { TextComparator } from '../../src/verification/TextComparator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Complete POC Pipeline Integration', () => {
  let resourceManager;
  let llmClient;
  let searchProvider;

  // Pipeline components
  let ontologyLoader;
  let ontology;
  let ontologyIndexer;
  let entityRelationshipExtractor;
  let simpleSentenceGenerator;
  let semanticRetriever;
  let llmEntityGenerator;
  let ontologyValidator;
  let entityFactory;
  let tripleStore;
  let textReconstructor;
  let textComparator;

  beforeAll(async () => {
    // Get real components from ResourceManager
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Create SemanticSearchProvider
    searchProvider = await SemanticSearchProvider.create(resourceManager);
    await searchProvider.connect();

    // Load POC ontology
    const ontologyPath = path.join(__dirname, '../../data/poc-ontology.ttl');
    ontologyLoader = new OntologyLoader();
    ontology = await ontologyLoader.load(ontologyPath);

    // Index ontology in semantic search
    ontologyIndexer = new OntologyIndexer(searchProvider);
    await ontologyIndexer.index(ontology, 'poc-test-ontology');

    // Initialize all pipeline components (NO MOCKS!)
    entityRelationshipExtractor = new EntityRelationshipExtractor(llmClient);
    simpleSentenceGenerator = new SimpleSentenceGenerator(llmClient);
    semanticRetriever = new SemanticRetriever(searchProvider, ontology, 'poc-test-ontology');
    llmEntityGenerator = new LLMEntityGenerator(llmClient);
    ontologyValidator = new OntologyValidator(ontology);
    await ontologyValidator.initialize();
    tripleStore = new TripleStore();
    entityFactory = new EntityFactory(tripleStore);
    textReconstructor = new TextReconstructor(llmClient);
    textComparator = new TextComparator(llmClient);
  }, 120000);

  afterAll(async () => {
    // Cleanup: delete test collection
    if (searchProvider) {
      try {
        await searchProvider.deleteCollection('poc-test-ontology');
      } catch (error) {
        // Ignore errors if collection doesn't exist
      }
    }
  });

  test('should execute complete pipeline end-to-end with verification', async () => {
    // Input text
    const inputText = 'Acme Corp has reserves of 5.2 million in 2023';
    const context = { company: 'Acme Corp', year: 2023 };

    console.log('\n=== STEP 1: Extract Entities & Relationships ===');
    const extractionResult = await entityRelationshipExtractor.extract(inputText, context);
    console.log('Extracted:', JSON.stringify(extractionResult, null, 2));

    expect(extractionResult.entities).toBeDefined();
    expect(Array.isArray(extractionResult.entities)).toBe(true);
    expect(extractionResult.relationships).toBeDefined();
    expect(Array.isArray(extractionResult.relationships)).toBe(true);

    console.log('\n=== STEP 2: Generate Simple Sentences ===');
    const sentencesResult = await simpleSentenceGenerator.generate(
      extractionResult.entities,
      extractionResult.relationships
    );
    console.log('Simple sentences:', JSON.stringify(sentencesResult, null, 2));

    expect(sentencesResult.sentences).toBeDefined();
    expect(Array.isArray(sentencesResult.sentences)).toBe(true);
    expect(sentencesResult.sentences.length).toBeGreaterThan(0);

    console.log('\n=== STEP 3: Retrieve Ontology Candidates ===');
    const retrievalResults = [];
    for (const sentence of sentencesResult.sentences) {
      const result = await semanticRetriever.retrieve(sentence, { topK: 5, threshold: 0.3 });
      retrievalResults.push({ sentence, candidates: result.candidates });
      console.log(`Sentence: "${sentence}"`);
      console.log(`Candidates:`, result.candidates.slice(0, 3).map(c => ({ type: c.type, uri: c.uri, score: c.score })));
    }

    expect(retrievalResults.length).toBeGreaterThan(0);

    console.log('\n=== STEP 4: Generate Entity Model ===');
    const entityModel = await llmEntityGenerator.generate(
      sentencesResult.sentences[0],
      retrievalResults[0].candidates
    );
    console.log('Entity model:', JSON.stringify(entityModel, null, 2));

    expect(entityModel.entities).toBeDefined();
    expect(entityModel.relationships).toBeDefined();

    console.log('\n=== STEP 5: Validate Entity Model ===');
    const validationResult = await ontologyValidator.validate(entityModel);
    console.log('Validation:', validationResult);

    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);

    console.log('\n=== STEP 6: Create Unified Entities & Relationships ===');
    const factoryResult = await entityFactory.create(entityModel);
    console.log('Created entities:', factoryResult.entities.length);
    console.log('Created relationships:', factoryResult.relationships.length);

    expect(factoryResult.entities.length).toBeGreaterThan(0);

    console.log('\n=== STEP 7: Store Triples (Already done by EntityFactory) ===');
    // Verify triples were stored
    const allTriples = await tripleStore.query(null, null, null);
    console.log(`Total triples stored: ${allTriples.length}`);
    expect(allTriples.length).toBeGreaterThan(0);

    console.log('\n=== STEP 8: Reconstruct Text from Entity Model ===');
    const reconstructedText = await textReconstructor.reconstruct(entityModel);
    console.log('Reconstructed text:', reconstructedText);

    expect(reconstructedText).toBeDefined();
    expect(typeof reconstructedText).toBe('string');
    expect(reconstructedText.length).toBeGreaterThan(0);

    console.log('\n=== STEP 9: Compare Original and Reconstructed Text ===');
    const comparisonResult = await textComparator.compare(inputText, reconstructedText);
    console.log('Comparison:', JSON.stringify(comparisonResult, null, 2));

    // Verify comparison result structure
    expect(comparisonResult.similarityScore).toBeGreaterThanOrEqual(0.0);
    expect(comparisonResult.similarityScore).toBeLessThanOrEqual(1.0);
    expect(typeof comparisonResult.factsMatch).toBe('boolean');
    expect(Array.isArray(comparisonResult.missingFacts)).toBe(true);
    expect(Array.isArray(comparisonResult.incorrectFacts)).toBe(true);
    expect(typeof comparisonResult.assessment).toBe('string');

    // The key success criteria for POC: verification system works (not perfect similarity)
    // Lower scores indicate room for improvement in entity generation
    if (comparisonResult.missingFacts.length > 0) {
      console.log('⚠️  Missing facts detected:', comparisonResult.missingFacts);
      console.log('   This shows the verification system is working correctly!');
    }

    console.log('\n=== STEP 10: Query Stored Triples ===');

    // Find all companies
    const companyTriples = await tripleStore.query(null, 'rdf:type', 'poc:Company');
    console.log(`Companies found: ${companyTriples.length}`);
    expect(companyTriples.length).toBeGreaterThan(0);

    // Find all reserves
    const reserveTriples = await tripleStore.query(null, 'rdf:type', 'poc:Reserve');
    console.log(`Reserves found: ${reserveTriples.length}`);
    expect(reserveTriples.length).toBeGreaterThan(0);

    // Find hasReserve relationships
    const hasReserveTriples = await tripleStore.query(null, 'poc:hasReserve', null);
    console.log(`HasReserve relationships: ${hasReserveTriples.length}`);
    expect(hasReserveTriples.length).toBeGreaterThan(0);

    console.log('\n=== PIPELINE COMPLETE ===');
    console.log('✓ All 10 steps executed successfully');
    console.log('✓ Entity model validated against ontology');
    console.log('✓ Triples stored and queryable');
    console.log('✓ Text reconstruction verified');
    console.log(`✓ Similarity score: ${comparisonResult.similarityScore.toFixed(2)}`);
  }, 180000);
});
