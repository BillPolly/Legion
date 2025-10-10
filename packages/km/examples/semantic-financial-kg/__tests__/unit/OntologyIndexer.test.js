/**
 * Unit tests for OntologyIndexer
 *
 * Tests indexing POC ontology in SemanticSearchProvider
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { OntologyIndexer } from '../../src/ontology/OntologyIndexer.js';
import { OntologyLoader } from '../../src/ontology/OntologyLoader.js';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const POC_ONTOLOGY_PATH = join(__dirname, '../../data/poc-ontology.ttl');

describe('OntologyIndexer', () => {
  let resourceManager;
  let semanticSearch;

  beforeAll(async () => {
    // Get ResourceManager singleton with real components (NO MOCKS!)
    resourceManager = await ResourceManager.getInstance();

    // Create SemanticSearchProvider
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();
  }, 60000);

  afterAll(async () => {
    // Cleanup: delete test collection
    if (semanticSearch) {
      try {
        await semanticSearch.deleteCollection('poc-ontology-test');
      } catch (error) {
        // Ignore errors if collection doesn't exist
      }
    }
  });

  test('should load and index POC ontology', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    const indexer = new OntologyIndexer(semanticSearch);
    const result = await indexer.index(ontology, 'poc-ontology-test');

    expect(result).toBeDefined();
    expect(result.classesIndexed).toBe(3);
    expect(result.propertiesIndexed).toBe(3);
    expect(result.totalIndexed).toBe(6);
  });

  test('should generate natural language descriptions for classes', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    const indexer = new OntologyIndexer(semanticSearch);
    const descriptions = indexer.generateDescriptions(ontology);

    expect(descriptions.length).toBe(6); // 3 classes + 3 properties

    // Find Company class description
    const companyDesc = descriptions.find(d => d.uri === 'poc:Company');
    expect(companyDesc).toBeDefined();
    expect(companyDesc.description).toContain('Company');
    expect(companyDesc.description).toContain('business organization');
    expect(companyDesc.type).toBe('class');
  });

  test('should generate natural language descriptions for properties', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    const indexer = new OntologyIndexer(semanticSearch);
    const descriptions = indexer.generateDescriptions(ontology);

    // Find hasReserve property description
    const hasReserveDesc = descriptions.find(d => d.uri === 'poc:hasReserve');
    expect(hasReserveDesc).toBeDefined();
    expect(hasReserveDesc.description).toContain('has reserve');
    expect(hasReserveDesc.description).toContain('Company');
    expect(hasReserveDesc.description).toContain('Reserve');
    expect(hasReserveDesc.type).toBe('property');
  });

  test('should verify semantic search works after indexing', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    const indexer = new OntologyIndexer(semanticSearch);
    await indexer.index(ontology, 'poc-ontology-test');

    // Query for "company" - should return poc:Company with high similarity
    // Use threshold 0.5 since semantic similarity may vary
    const results = await semanticSearch.semanticSearch(
      'poc-ontology-test',
      'company business organization',
      { limit: 3, threshold: 0.5 }
    );

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);

    const companyResult = results.find(r => r.payload.uri === 'poc:Company');
    expect(companyResult).toBeDefined();
    expect(companyResult.score).toBeGreaterThan(0.5);
  });

  test('should verify semantic search finds relevant properties', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    const indexer = new OntologyIndexer(semanticSearch);
    await indexer.index(ontology, 'poc-ontology-test');

    // Query for "has reserve relationship" - should return poc:hasReserve
    // Use threshold 0.5 since semantic similarity may vary
    const results = await semanticSearch.semanticSearch(
      'poc-ontology-test',
      'company has financial reserves',
      { limit: 3, threshold: 0.5 }
    );

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);

    // Should find hasReserve property
    const hasReserveResult = results.find(r => r.payload.uri === 'poc:hasReserve');
    expect(hasReserveResult).toBeDefined();
  });
});
