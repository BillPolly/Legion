/**
 * Integration tests for OntologyIndexer with real semantic search
 *
 * Tests Phase 3 ontology indexing with actual SemanticSearchProvider.
 * NO MOCKS - tests real end-to-end indexing and search.
 */

import { OntologyIndexer } from '../../src/phase3/OntologyIndexer.js';
import { ResourceManager } from '@legion/resource-manager';

describe('OntologyIndexer Integration Tests', () => {
  let resourceManager;
  let semanticSearch;
  let indexer;

  beforeAll(async () => {
    // Get real ResourceManager and SemanticSearchProvider
    resourceManager = await ResourceManager.getInstance();
    semanticSearch = await resourceManager.get('semanticSearch');

    if (!semanticSearch) {
      throw new Error('SemanticSearchProvider not available - required for integration tests');
    }

    indexer = new OntologyIndexer(semanticSearch, { collectionName: 'test-ontology' });
    await indexer.initialize();
  }, 120000);

  // Clean up before each test to ensure isolation
  beforeEach(async () => {
    await indexer.clear();
    await indexer.initialize();
  });

  describe('Class Indexing', () => {
    test('should index a class with synonyms', async () => {
      await indexer.indexClass({
        iri: ':Country',
        label: 'Country',
        description: 'A nation or sovereign state',
        synonyms: ['nation', 'state', 'sovereignty'],
        domain: 'geography'
      });

      // Search for the class using synonym
      const results = await semanticSearch.semanticSearch('test-ontology', 'nation', {
        limit: 3,
        filter: { 'metadata.type': 'class' }
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.id).toBe(':Country');
      expect(results[0].document.metadata.type).toBe('class');
      expect(results[0].document.metadata.domain).toBe('geography');
    }, 60000);

    test('should find class by description', async () => {
      await indexer.indexClass({
        iri: ':Company',
        label: 'Company',
        description: 'A business organization or corporation',
        synonyms: ['business', 'corporation', 'firm'],
        domain: 'finance'
      });

      // Search using description terms
      const results = await semanticSearch.semanticSearch('test-ontology', 'business organization', {
        limit: 3,
        filter: { 'metadata.type': 'class' }
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.id).toBe(':Company');
    }, 60000);
  });

  describe('Property Indexing', () => {
    test('should index a property with synonyms', async () => {
      await indexer.indexProperty({
        iri: ':borders',
        label: 'borders',
        description: 'Shares a boundary with',
        synonyms: ['adjacent', 'neighbors', 'boundary'],
        domain: 'geography',
        propertyType: 'spatial'
      });

      // Search for property using synonym
      const results = await semanticSearch.semanticSearch('test-ontology', 'adjacent', {
        limit: 3,
        threshold: 0,  // Accept any similarity score
        filter: { 'metadata.type': 'property' }
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.id).toBe(':borders');
      expect(results[0].document.metadata.propertyType).toBe('spatial');
    }, 60000);
  });

  describe('Individual Indexing', () => {
    test('should index an individual with aliases', async () => {
      await indexer.indexIndividual({
        iri: ':Germany',
        label: 'Germany',
        aliases: ['Deutschland', 'DE', 'Federal Republic of Germany'],
        domain: 'geography',
        instanceOf: ':Country'
      });

      // Search using alias
      const results = await semanticSearch.semanticSearch('test-ontology', 'Deutschland', {
        limit: 3,
        filter: { 'metadata.type': 'individual' }
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.id).toBe(':Germany');
      expect(results[0].document.metadata.instanceOf).toBe(':Country');
    }, 60000);
  });

  describe('Batch Indexing', () => {
    test('should index complete ontology in batch', async () => {
      const ontology = {
        classes: [
          {
            iri: ':Country',
            label: 'Country',
            description: 'A nation or sovereign state',
            synonyms: ['nation', 'state'],
            domain: 'geography'
          },
          {
            iri: ':City',
            label: 'City',
            description: 'A large town',
            synonyms: ['town', 'municipality'],
            domain: 'geography'
          }
        ],
        properties: [
          {
            iri: ':capital',
            label: 'capital',
            description: 'The capital city of a country',
            synonyms: ['capital city'],
            domain: 'geography',
            propertyType: 'spatial'
          }
        ],
        individuals: [
          {
            iri: ':Germany',
            label: 'Germany',
            aliases: ['Deutschland'],
            domain: 'geography',
            instanceOf: ':Country'
          },
          {
            iri: ':Berlin',
            label: 'Berlin',
            aliases: [],
            domain: 'geography',
            instanceOf: ':City'
          }
        ]
      };

      await indexer.indexOntology(ontology);

      // Verify all items were indexed
      const classResults = await semanticSearch.semanticSearch('test-ontology', 'nation', {
        limit: 5,
        filter: { 'metadata.type': 'class' }
      });

      const propertyResults = await semanticSearch.semanticSearch('test-ontology', 'capital city', {
        limit: 5,
        filter: { 'metadata.type': 'property' }
      });

      const individualResults = await semanticSearch.semanticSearch('test-ontology', 'Deutschland', {
        limit: 5,
        filter: { 'metadata.type': 'individual' }
      });

      expect(classResults.length).toBeGreaterThan(0);
      expect(propertyResults.length).toBeGreaterThan(0);
      expect(individualResults.length).toBeGreaterThan(0);

      expect(classResults.some(r => r.document.id === ':Country')).toBe(true);
      expect(propertyResults.some(r => r.document.id === ':capital')).toBe(true);
      expect(individualResults.some(r => r.document.id === ':Germany')).toBe(true);
    }, 60000);
  });
});
