/**
 * Unit tests for SemanticRetriever
 *
 * Tests semantic retrieval of ontology candidates for simple sentences
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { SemanticRetriever } from '../../src/retrieval/SemanticRetriever.js';
import { OntologyIndexer } from '../../src/ontology/OntologyIndexer.js';
import { OntologyLoader } from '../../src/ontology/OntologyLoader.js';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const POC_ONTOLOGY_PATH = join(__dirname, '../../data/poc-ontology.ttl');

describe('SemanticRetriever', () => {
  let resourceManager;
  let semanticSearch;
  let retriever;

  beforeAll(async () => {
    // Get ResourceManager singleton with real components (NO MOCKS!)
    resourceManager = await ResourceManager.getInstance();

    // Create SemanticSearchProvider
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();

    // Load and index POC ontology
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);
    const indexer = new OntologyIndexer(semanticSearch);
    await indexer.index(ontology, 'retriever-test');

    // Create retriever
    retriever = new SemanticRetriever(semanticSearch, ontology, 'retriever-test');
  }, 60000);

  afterAll(async () => {
    // Cleanup: delete test collection
    if (semanticSearch) {
      try {
        await semanticSearch.vectorStore.deleteCollection('retriever-test');
      } catch (error) {
        // Ignore errors if collection doesn't exist
      }
    }
  });

  test('should retrieve ontology candidates for company sentence', async () => {
    const sentence = "Acme Corp has reserves.";

    const result = await retriever.retrieve(sentence);

    // Verify structure
    expect(result).toBeDefined();
    expect(result.candidates).toBeDefined();
    expect(Array.isArray(result.candidates)).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);

    // Each candidate should have required fields
    result.candidates.forEach(candidate => {
      expect(candidate.uri).toBeDefined();
      expect(candidate.type).toBeDefined();
      expect(candidate.score).toBeDefined();
      expect(typeof candidate.score).toBe('number');
    });

    // Should find Company class
    const companyCandidate = result.candidates.find(c =>
      c.uri === 'poc:Company'
    );
    expect(companyCandidate).toBeDefined();
  });

  test('should retrieve ontology candidates for reserve sentence', async () => {
    const sentence = "The reserves are for 2023.";

    const result = await retriever.retrieve(sentence);

    expect(result.candidates).toBeDefined();
    expect(result.candidates.length).toBeGreaterThan(0);

    // Should find Reserve class or year property
    const reserveOrYearCandidate = result.candidates.find(c =>
      c.uri === 'poc:Reserve' || c.uri === 'poc:year'
    );
    expect(reserveOrYearCandidate).toBeDefined();
  });

  test('should retrieve ontology candidates for relationship sentence', async () => {
    const sentence = "The company has financial reserves.";

    const result = await retriever.retrieve(sentence);

    expect(result.candidates).toBeDefined();
    expect(result.candidates.length).toBeGreaterThan(0);

    // Should find hasReserve property or Company/Reserve classes
    const relevantCandidate = result.candidates.find(c =>
      c.uri === 'poc:hasReserve' ||
      c.uri === 'poc:Company' ||
      c.uri === 'poc:Reserve'
    );
    expect(relevantCandidate).toBeDefined();
  });

  test('should respect topK limit', async () => {
    const sentence = "Acme Corp has reserves.";

    const result = await retriever.retrieve(sentence, { topK: 3 });

    expect(result.candidates).toBeDefined();
    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  test('should include ontology definitions in candidates', async () => {
    const sentence = "Acme Corp has reserves.";

    const result = await retriever.retrieve(sentence);

    // At least one candidate should have full definition
    const candidatesWithDef = result.candidates.filter(c =>
      c.label || c.comment
    );
    expect(candidatesWithDef.length).toBeGreaterThan(0);
  });
});
