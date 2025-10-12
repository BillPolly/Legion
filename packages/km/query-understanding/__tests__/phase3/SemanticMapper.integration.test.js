/**
 * Integration tests for SemanticMapper
 *
 * Tests Phase 3 token → IRI mapping with real semantic search.
 * NO MOCKS - tests real end-to-end mapping.
 */

import { SemanticMapper } from '../../src/phase3/SemanticMapper.js';
import { OntologyIndexer } from '../../src/phase3/OntologyIndexer.js';
import { ResourceManager } from '@legion/resource-manager';

describe('SemanticMapper Integration Tests', () => {
  let resourceManager;
  let semanticSearch;
  let indexer;
  let mapper;

  beforeAll(async () => {
    // Get real ResourceManager and SemanticSearchProvider
    resourceManager = await ResourceManager.getInstance();
    semanticSearch = await resourceManager.get('semanticSearch');

    if (!semanticSearch) {
      throw new Error('SemanticSearchProvider not available - required for integration tests');
    }

    // Create indexer and mapper
    indexer = new OntologyIndexer(semanticSearch, { collectionName: 'test-ontology-mapper' });
    await indexer.initialize();

    mapper = new SemanticMapper(semanticSearch, {
      collectionName: 'test-ontology-mapper',
      confidenceThreshold: 0.7
    });
  }, 120000);

  // Clean up before each test
  beforeEach(async () => {
    await indexer.clear();
    await indexer.initialize();
  });

  describe('Noun Mapping', () => {
    test('should map noun to class IRI', async () => {
      // Index some classes
      await indexer.indexClass({
        iri: ':Country',
        label: 'Country',
        description: 'A nation or sovereign state',
        synonyms: ['nation', 'state', 'sovereignty'],
        domain: 'geography'
      });

      // Map "country" → should find :Country
      const result = await mapper.mapNoun('country');

      expect(result).toBeDefined();

      // Handle both ambiguous and clear matches
      if (result.ambiguous) {
        expect(result.candidates).toBeDefined();
        expect(result.candidates[0].iri).toBe(':Country');
      } else {
        expect(result.iri).toBe(':Country');
        expect(result.score).toBeGreaterThan(0.7);
        expect(result.source).toBe('semantic');
      }
    }, 60000);

    test('should map noun synonym to class IRI', async () => {
      await indexer.indexClass({
        iri: ':Country',
        label: 'Country',
        description: 'A nation or sovereign state',
        synonyms: ['nation', 'state'],
        domain: 'geography'
      });

      // Map "nation" (synonym) → should find :Country
      const result = await mapper.mapNoun('nation');

      expect(result).toBeDefined();

      // Handle ambiguous case
      if (result.ambiguous) {
        expect(result.candidates).toBeDefined();
        expect(result.candidates[0].iri).toBe(':Country');
      } else {
        expect(result.iri).toBe(':Country');
        expect(result.score).toBeGreaterThan(0.5);
      }
    }, 60000);

    test('should return null for unmapped noun', async () => {
      await indexer.indexClass({
        iri: ':Country',
        label: 'Country',
        synonyms: [],
        domain: 'geography'
      });

      // Map unrelated word
      const result = await mapper.mapNoun('xyzunknown');

      expect(result).toBeNull();
    }, 60000);

    test('should return candidates when multiple matches', async () => {
      // Index two similar classes - both with "bank" in their content
      await indexer.indexClass({
        iri: ':FinancialInstitution',
        label: 'Bank',
        description: 'A financial institution that handles money',
        synonyms: ['financial institution', 'bank', 'credit union'],
        domain: 'finance'
      });

      await indexer.indexClass({
        iri: ':RiverBank',
        label: 'River Bank',
        description: 'The land alongside a river or stream bank',
        synonyms: ['riverbank', 'shore', 'bank'],
        domain: 'geography'
      });

      // Map "bank" → should return multiple candidates
      const result = await mapper.mapNoun('bank');

      // Since both classes have "bank" in synonyms, we expect either:
      // 1. A clear winner (one iri)
      // 2. Ambiguous result (candidates array)
      // 3. Or null if below threshold
      if (result === null) {
        // If no results, that's a bug in the test setup
        throw new Error('Expected results but got null - check ontology indexing');
      }

      if (result.ambiguous) {
        expect(result.candidates).toBeDefined();
        expect(result.candidates.length).toBeGreaterThanOrEqual(2);
        expect(result.candidates[0].iri).toBeDefined();
        expect(result.candidates[0].score).toBeDefined();
      } else {
        // Single match is also acceptable - one was clearly better
        expect(result.iri).toBeDefined();
        expect(result.score).toBeDefined();
      }
    }, 60000);
  });

  describe('Verb Mapping', () => {
    test('should map verb to property IRI', async () => {
      await indexer.indexProperty({
        iri: ':borders',
        label: 'borders',
        description: 'Shares a boundary with',
        synonyms: ['adjacent', 'neighbors'],
        domain: 'geography',
        propertyType: 'spatial'
      });

      // Map "borders" → should find :borders property
      const result = await mapper.mapVerb('borders');

      expect(result).toBeDefined();

      // Handle both ambiguous and clear matches
      if (result.ambiguous) {
        expect(result.candidates).toBeDefined();
        expect(result.candidates[0].iri).toBe(':borders');
      } else {
        expect(result.iri).toBe(':borders');
        expect(result.score).toBeGreaterThan(0.7);
      }
    }, 60000);

    test('should map verb synonym to property IRI', async () => {
      await indexer.indexProperty({
        iri: ':borders',
        label: 'borders',
        synonyms: ['adjacent', 'neighbors', 'boundary'],
        domain: 'geography',
        propertyType: 'spatial'
      });

      // Map "neighbors" (synonym) → should find :borders
      const result = await mapper.mapVerb('neighbors', { threshold: 0 });

      expect(result).toBeDefined();

      // Handle both ambiguous and clear matches
      if (result.ambiguous) {
        expect(result.candidates).toBeDefined();
        expect(result.candidates[0].iri).toBe(':borders');
      } else {
        expect(result.iri).toBe(':borders');
      }
    }, 60000);
  });

  describe('Preposition Mapping', () => {
    test('should map preposition to role IRI with temporal context', async () => {
      // Index temporal property
      await indexer.indexProperty({
        iri: ':year',
        label: 'year',
        description: 'The year when something occurred',
        synonyms: ['in year', 'during year'],
        domain: 'temporal',
        propertyType: 'temporal'
      });

      // Map "in" with temporal context (e.g., "in 2008")
      const result = await mapper.mapPreposition('in', { npHead: '2008', type: 'temporal' });

      expect(result).toBeDefined();
      expect(result.iri).toBe(':year');
      expect(result.propertyType).toBe('temporal');
    }, 60000);

    test('should map preposition to role IRI with spatial context', async () => {
      // Index spatial property
      await indexer.indexProperty({
        iri: ':inPlace',
        label: 'in place',
        description: 'Located within a place',
        synonyms: ['located in', 'within'],
        domain: 'geography',
        propertyType: 'spatial'
      });

      // Map "in" with spatial context (e.g., "in Germany")
      const result = await mapper.mapPreposition('in', { npHead: 'Germany', type: 'spatial' });

      expect(result).toBeDefined();
      expect(result.iri).toBe(':inPlace');
      expect(result.propertyType).toBe('spatial');
    }, 60000);
  });

  describe('Context-Aware Mapping', () => {
    test('should boost scores for domain matches', async () => {
      // Index classes in different domains
      await indexer.indexClass({
        iri: ':GeographicRegion',
        label: 'Region',
        description: 'A geographic area',
        synonyms: [],
        domain: 'geography'
      });

      await indexer.indexClass({
        iri: ':BodyRegion',
        label: 'Region',
        description: 'A part of the body',
        synonyms: [],
        domain: 'biology'
      });

      // Map with geography domain hint
      const result = await mapper.mapNoun('region', { domain: 'geography' });

      expect(result).toBeDefined();

      // Should prefer geography domain (either as single match or top candidate)
      if (result.ambiguous) {
        expect(result.candidates).toBeDefined();
        expect(result.candidates[0].iri).toBe(':GeographicRegion');
      } else {
        expect(result.iri).toBe(':GeographicRegion');
      }
    }, 60000);
  });

  describe('Batch Mapping', () => {
    test('should map multiple tokens efficiently', async () => {
      // Index ontology
      await indexer.indexOntology({
        classes: [
          {
            iri: ':Country',
            label: 'Country',
            synonyms: ['nation'],
            domain: 'geography'
          },
          {
            iri: ':City',
            label: 'City',
            synonyms: ['town'],
            domain: 'geography'
          }
        ],
        properties: [
          {
            iri: ':capital',
            label: 'capital',
            synonyms: ['capital city'],
            domain: 'geography',
            propertyType: 'spatial'
          }
        ],
        individuals: []
      });

      // Map multiple nouns
      const results = await mapper.mapNouns(['country', 'city']);

      expect(results).toHaveLength(2);

      // Check each result (may be ambiguous or clear)
      const countryResult = results[0];
      const cityResult = results[1];

      if (countryResult && !countryResult.ambiguous) {
        expect(countryResult.iri).toBe(':Country');
      } else if (countryResult && countryResult.ambiguous) {
        expect(countryResult.candidates[0].iri).toBe(':Country');
      }

      if (cityResult && !cityResult.ambiguous) {
        expect(cityResult.iri).toBe(':City');
      } else if (cityResult && cityResult.ambiguous) {
        expect(cityResult.candidates[0].iri).toBe(':City');
      }
    }, 60000);
  });
});
