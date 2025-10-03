/**
 * OntologyBuilder Unit Tests
 *
 * Tests orchestrator logic with mocked dependencies
 */

import { jest } from '@jest/globals';
import { OntologyBuilder } from '../../src/OntologyBuilder.js';

describe('OntologyBuilder', () => {
  let builder;
  let mockTripleStore;
  let mockSemanticSearch;
  let mockLLMClient;

  beforeEach(() => {
    mockTripleStore = {
      add: jest.fn(),
      query: jest.fn(),
    };

    mockSemanticSearch = {
      insert: jest.fn(),
      semanticSearch: jest.fn(),
    };

    mockLLMClient = {
      request: jest.fn(),
      complete: jest.fn(),
    };

    builder = new OntologyBuilder({
      tripleStore: mockTripleStore,
      semanticSearch: mockSemanticSearch,
      llmClient: mockLLMClient
    });
  });

  describe('constructor', () => {
    test('should initialize with tripleStore, semanticSearch, and llmClient', () => {
      expect(builder.tripleStore).toBe(mockTripleStore);
      expect(builder.semanticSearch).toBe(mockSemanticSearch);
      expect(builder.llmClient).toBe(mockLLMClient);
    });

    test('should initialize all service dependencies', () => {
      expect(builder.hierarchyTraversal).toBeDefined();
      expect(builder.subsumptionChecker).toBeDefined();
      expect(builder.ontologyQuery).toBeDefined();
      expect(builder.gapAnalysis).toBeDefined();
      expect(builder.specializationDecision).toBeDefined();
      expect(builder.ontologyExtension).toBeDefined();
      expect(builder.sentenceAnnotator).toBeDefined();
    });

    test('should throw error if tripleStore is missing', () => {
      expect(() => new OntologyBuilder({
        semanticSearch: mockSemanticSearch,
        llmClient: mockLLMClient
      })).toThrow('Triple store is required');
    });

    test('should throw error if semanticSearch is missing', () => {
      expect(() => new OntologyBuilder({
        tripleStore: mockTripleStore,
        llmClient: mockLLMClient
      })).toThrow('Semantic search is required');
    });

    test('should throw error if llmClient is missing', () => {
      expect(() => new OntologyBuilder({
        tripleStore: mockTripleStore,
        semanticSearch: mockSemanticSearch
      })).toThrow('LLM client is required');
    });
  });

  describe('segmentSentences', () => {
    test('should split text into sentences', () => {
      const text = 'The pump operates. The tank stores liquid. Equipment connects together.';
      const sentences = builder.segmentSentences(text);

      expect(sentences).toEqual([
        'The pump operates.',
        'The tank stores liquid.',
        'Equipment connects together.'
      ]);
    });

    test('should handle single sentence', () => {
      const text = 'The pump operates at 150 psi.';
      const sentences = builder.segmentSentences(text);

      expect(sentences).toEqual(['The pump operates at 150 psi.']);
    });

    test('should handle multiple punctuation marks', () => {
      const text = 'What is a pump? It moves fluids! Very important.';
      const sentences = builder.segmentSentences(text);

      expect(sentences.length).toBeGreaterThan(0);
      expect(sentences).toContain('What is a pump?');
    });

    test('should filter empty sentences', () => {
      const text = 'Hello.  \n\n  World.';
      const sentences = builder.segmentSentences(text);

      expect(sentences).toEqual(['Hello.', 'World.']);
    });

    test('should trim whitespace from sentences', () => {
      const text = '  The pump operates.   The tank stores.  ';
      const sentences = builder.segmentSentences(text);

      expect(sentences[0]).toBe('The pump operates.');
      expect(sentences[1]).toBe('The tank stores.');
    });
  });

  describe('countClasses', () => {
    test('should query triplestore for owl:Class count', async () => {
      mockTripleStore.query.mockResolvedValue([
        ['kg:Pump', 'rdf:type', 'owl:Class'],
        ['kg:Tank', 'rdf:type', 'owl:Class']
      ]);

      const count = await builder.countClasses();

      expect(mockTripleStore.query).toHaveBeenCalledWith(null, 'rdf:type', 'owl:Class');
      expect(count).toBe(2);
    });

    test('should return 0 for empty ontology', async () => {
      mockTripleStore.query.mockResolvedValue([]);

      const count = await builder.countClasses();

      expect(count).toBe(0);
    });
  });

  describe('countProperties', () => {
    test('should query triplestore for owl:DatatypeProperty count', async () => {
      mockTripleStore.query.mockResolvedValue([
        ['kg:operatingPressure', 'rdf:type', 'owl:DatatypeProperty'],
        ['kg:capacity', 'rdf:type', 'owl:DatatypeProperty']
      ]);

      const count = await builder.countProperties();

      expect(mockTripleStore.query).toHaveBeenCalledWith(null, 'rdf:type', 'owl:DatatypeProperty');
      expect(count).toBe(2);
    });

    test('should return 0 when no properties exist', async () => {
      mockTripleStore.query.mockResolvedValue([]);

      const count = await builder.countProperties();

      expect(count).toBe(0);
    });
  });

  describe('countRelationships', () => {
    test('should query triplestore for owl:ObjectProperty count', async () => {
      mockTripleStore.query.mockResolvedValue([
        ['kg:connectsTo', 'rdf:type', 'owl:ObjectProperty']
      ]);

      const count = await builder.countRelationships();

      expect(mockTripleStore.query).toHaveBeenCalledWith(null, 'rdf:type', 'owl:ObjectProperty');
      expect(count).toBe(1);
    });

    test('should return 0 when no relationships exist', async () => {
      mockTripleStore.query.mockResolvedValue([]);

      const count = await builder.countRelationships();

      expect(count).toBe(0);
    });
  });

  describe('processText', () => {
    // Note: processText() orchestrates all services which use TemplatedPrompt and real LLM
    // Full functionality tested in integration tests

    test('should be a function', () => {
      expect(typeof builder.processText).toBe('function');
    });

    test('should be async', () => {
      const result = builder.processText('Test sentence.');
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
