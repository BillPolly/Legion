/**
 * OntologyExtensionService Unit Tests
 *
 * Tests ontology extension logic with mocked dependencies
 */

import { jest } from '@jest/globals';
import { OntologyExtensionService } from '../../../src/services/OntologyExtensionService.js';

describe('OntologyExtensionService', () => {
  let service;
  let mockTripleStore;
  let mockSemanticSearch;
  let mockLLMClient;
  let mockHierarchyTraversal;

  beforeEach(() => {
    mockTripleStore = {
      add: jest.fn(),
      query: jest.fn(),
    };

    mockSemanticSearch = {
      insert: jest.fn(),
    };

    mockLLMClient = {
      request: jest.fn(),
      complete: jest.fn(),
    };

    mockHierarchyTraversal = {
      getAncestors: jest.fn().mockReturnValue([]),
    };

    service = new OntologyExtensionService(mockTripleStore, mockSemanticSearch, mockLLMClient, mockHierarchyTraversal);
  });

  describe('constructor', () => {
    test('should initialize with tripleStore, semanticSearch, llmClient, and hierarchyTraversal', () => {
      expect(service.tripleStore).toBe(mockTripleStore);
      expect(service.semanticSearch).toBe(mockSemanticSearch);
      expect(service.llmClient).toBe(mockLLMClient);
      expect(service.hierarchyTraversal).toBe(mockHierarchyTraversal);
    });

    test('should throw error if tripleStore is missing', () => {
      expect(() => new OntologyExtensionService(null, mockSemanticSearch, mockLLMClient, mockHierarchyTraversal))
        .toThrow('Triple store is required');
    });

    test('should throw error if semanticSearch is missing', () => {
      expect(() => new OntologyExtensionService(mockTripleStore, null, mockLLMClient, mockHierarchyTraversal))
        .toThrow('Semantic search is required');
    });

    test('should throw error if llmClient is missing', () => {
      expect(() => new OntologyExtensionService(mockTripleStore, mockSemanticSearch, null, mockHierarchyTraversal))
        .toThrow('LLM client is required');
    });

    test('should throw error if hierarchyTraversal is missing', () => {
      expect(() => new OntologyExtensionService(mockTripleStore, mockSemanticSearch, mockLLMClient, null))
        .toThrow('Hierarchy traversal is required');
    });
  });

  describe('mapToXSDType', () => {
    test('should map string to xsd:string', () => {
      expect(service.mapToXSDType('string')).toBe('xsd:string');
    });

    test('should map number to xsd:decimal', () => {
      expect(service.mapToXSDType('number')).toBe('xsd:decimal');
    });

    test('should map integer to xsd:integer', () => {
      expect(service.mapToXSDType('integer')).toBe('xsd:integer');
    });

    test('should map boolean to xsd:boolean', () => {
      expect(service.mapToXSDType('boolean')).toBe('xsd:boolean');
    });

    test('should map date to xsd:date', () => {
      expect(service.mapToXSDType('date')).toBe('xsd:date');
    });

    test('should default to xsd:string for unknown types', () => {
      expect(service.mapToXSDType('unknown')).toBe('xsd:string');
    });
  });

  describe('determineParentClass', () => {
    // Note: determineParentClass() uses TemplatedPrompt which requires file I/O and real LLM
    // Full functionality tested in integration tests

    test('should be a function', () => {
      expect(typeof service.determineParentClass).toBe('function');
    });

    test('should be async', () => {
      mockTripleStore.query.mockResolvedValue([]);
      const result = service.determineParentClass({ name: 'Test', description: 'test' }, 'general');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('extendFromGaps', () => {
    // Note: extendFromGaps() uses TemplatedPrompt which requires file I/O and real LLM
    // Full functionality tested in integration tests

    test('should be a function', () => {
      expect(typeof service.extendFromGaps).toBe('function');
    });

    test('should be async', () => {
      const gaps = { missingClasses: [], missingProperties: [], missingRelationships: [], canReuseFromHierarchy: [] };
      const result = service.extendFromGaps(gaps, 'general');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('indexNewClasses', () => {
    test('should be a function', () => {
      expect(typeof service.indexNewClasses).toBe('function');
    });

    test('should be async', () => {
      const result = service.indexNewClasses([]);
      expect(result).toBeInstanceOf(Promise);
    });

    test('should insert classes into semantic search', async () => {
      const additions = [
        ['kg:Pump', 'rdf:type', 'owl:Class'],
        ['kg:Pump', 'rdfs:label', '"Pump"'],
        ['kg:Pump', 'rdfs:comment', '"A device for moving fluids"'],
      ];

      await service.indexNewClasses(additions);

      expect(mockSemanticSearch.insert).toHaveBeenCalledWith('ontology-classes', {
        text: 'Pump: A device for moving fluids',
        metadata: {
          classURI: 'kg:Pump',
          label: 'Pump'
        }
      });
    });

    test('should handle multiple classes', async () => {
      const additions = [
        ['kg:Pump', 'rdf:type', 'owl:Class'],
        ['kg:Pump', 'rdfs:label', '"Pump"'],
        ['kg:Tank', 'rdf:type', 'owl:Class'],
        ['kg:Tank', 'rdfs:label', '"Tank"'],
      ];

      await service.indexNewClasses(additions);

      expect(mockSemanticSearch.insert).toHaveBeenCalledTimes(2);
    });

    test('should not index non-class entities', async () => {
      const additions = [
        ['kg:operatingPressure', 'rdf:type', 'owl:DatatypeProperty'],
        ['kg:operatingPressure', 'rdfs:label', '"operatingPressure"'],
      ];

      await service.indexNewClasses(additions);

      expect(mockSemanticSearch.insert).not.toHaveBeenCalled();
    });
  });
});
