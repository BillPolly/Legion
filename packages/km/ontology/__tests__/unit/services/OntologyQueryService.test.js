/**
 * OntologyQueryService Unit Tests
 *
 * Tests ontology querying with hierarchy navigation
 * Uses mocks for fast unit tests
 */

import { jest } from '@jest/globals';
import { OntologyQueryService } from '../../../src/services/OntologyQueryService.js';

describe('OntologyQueryService', () => {
  let service;
  let mockTripleStore;
  let mockHierarchyTraversal;
  let mockSemanticSearch;
  let mockLLMClient;

  beforeEach(() => {
    mockTripleStore = {
      query: jest.fn(),
    };

    mockHierarchyTraversal = {
      getAncestors: jest.fn(),
      getHierarchyContext: jest.fn(),
    };

    mockSemanticSearch = {
      semanticSearch: jest.fn(),
    };

    mockLLMClient = {
      request: jest.fn(),
      complete: jest.fn(),
    };

    service = new OntologyQueryService(mockTripleStore, mockHierarchyTraversal, mockSemanticSearch);
  });

  describe('constructor', () => {
    test('should initialize with required dependencies', () => {
      expect(service.tripleStore).toBe(mockTripleStore);
      expect(service.hierarchyTraversal).toBe(mockHierarchyTraversal);
      expect(service.semanticSearch).toBe(mockSemanticSearch);
    });

    test('should throw error if tripleStore is missing', () => {
      expect(() => new OntologyQueryService(null, mockHierarchyTraversal, mockSemanticSearch))
        .toThrow('TripleStore is required');
    });

    test('should throw error if hierarchyTraversal is missing', () => {
      expect(() => new OntologyQueryService(mockTripleStore, null, mockSemanticSearch))
        .toThrow('HierarchyTraversal is required');
    });

    test('should throw error if semanticSearch is missing', () => {
      expect(() => new OntologyQueryService(mockTripleStore, mockHierarchyTraversal, null))
        .toThrow('SemanticSearch is required');
    });
  });

  describe('extractTypeMentions', () => {
    // Note: extractTypeMentions uses TemplatedPrompt which requires file I/O and real LLM
    // Full functionality is tested in integration tests
    // Unit tests focus on other methods that don't require LLM

    test('should be a function', () => {
      expect(typeof service.extractTypeMentions).toBe('function');
    });
  });

  describe('getInheritedProperties', () => {
    test('should return properties from direct class', async () => {
      // Mock: Pump has no ancestors
      mockHierarchyTraversal.getAncestors.mockResolvedValue([]);

      // Mock: Pump has operatingPressure property
      mockTripleStore.query
        .mockReturnValueOnce([['kg:operatingPressure', 'rdfs:domain', 'kg:Pump']]) // Properties in kg:Pump
        .mockReturnValueOnce([['kg:operatingPressure', 'rdf:type', 'owl:DatatypeProperty']]) // Type check
        .mockReturnValueOnce([['kg:operatingPressure', 'rdfs:label', '"operatingPressure"']]) // Label
        .mockReturnValueOnce([['kg:operatingPressure', 'rdfs:range', 'xsd:decimal']]); // Range

      const result = await service.getInheritedProperties('kg:Pump');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        uri: 'kg:operatingPressure',
        label: 'operatingPressure',
        range: 'xsd:decimal',
        definedIn: 'kg:Pump',
        inherited: false,
        inheritanceDistance: 0
      });
    });

    test('should return properties from ancestor classes', async () => {
      // Mock: Pump → Equipment
      mockHierarchyTraversal.getAncestors.mockResolvedValue(['kg:Equipment']);

      // Mock: No properties in Pump, manufacturer in Equipment
      mockTripleStore.query
        .mockReturnValueOnce([]) // No properties in kg:Pump
        .mockReturnValueOnce([['kg:manufacturer', 'rdfs:domain', 'kg:Equipment']]) // Property in Equipment
        .mockReturnValueOnce([['kg:manufacturer', 'rdf:type', 'owl:DatatypeProperty']]) // Type check
        .mockReturnValueOnce([['kg:manufacturer', 'rdfs:label', '"manufacturer"']]) // Label
        .mockReturnValueOnce([['kg:manufacturer', 'rdfs:range', 'xsd:string']]); // Range

      const result = await service.getInheritedProperties('kg:Pump');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        uri: 'kg:manufacturer',
        label: 'manufacturer',
        range: 'xsd:string',
        definedIn: 'kg:Equipment',
        inherited: true,
        inheritanceDistance: 1
      });
    });

    test('should return all properties from entire hierarchy', async () => {
      // Mock: CentrifugalPump → Pump → Equipment
      mockHierarchyTraversal.getAncestors.mockResolvedValue(['kg:Pump', 'kg:Equipment']);

      // Mock properties at each level
      mockTripleStore.query
        .mockReturnValueOnce([]) // No properties in CentrifugalPump
        .mockReturnValueOnce([['kg:operatingPressure', 'rdfs:domain', 'kg:Pump']]) // Pump property
        .mockReturnValueOnce([['kg:operatingPressure', 'rdf:type', 'owl:DatatypeProperty']])
        .mockReturnValueOnce([['kg:operatingPressure', 'rdfs:label', '"operatingPressure"']])
        .mockReturnValueOnce([['kg:operatingPressure', 'rdfs:range', 'xsd:decimal']])
        .mockReturnValueOnce([['kg:manufacturer', 'rdfs:domain', 'kg:Equipment']]) // Equipment property
        .mockReturnValueOnce([['kg:manufacturer', 'rdf:type', 'owl:DatatypeProperty']])
        .mockReturnValueOnce([['kg:manufacturer', 'rdfs:label', '"manufacturer"']])
        .mockReturnValueOnce([['kg:manufacturer', 'rdfs:range', 'xsd:string']]);

      const result = await service.getInheritedProperties('kg:CentrifugalPump');

      expect(result).toHaveLength(2);
      expect(result[0].uri).toBe('kg:operatingPressure');
      expect(result[0].inheritanceDistance).toBe(1);
      expect(result[1].uri).toBe('kg:manufacturer');
      expect(result[1].inheritanceDistance).toBe(2);
    });

    test('should filter out ObjectProperty types (only return DatatypeProperty)', async () => {
      mockHierarchyTraversal.getAncestors.mockResolvedValue([]);

      // Mock: One DatatypeProperty, one ObjectProperty
      mockTripleStore.query
        .mockReturnValueOnce([
          ['kg:manufacturer', 'rdfs:domain', 'kg:Pump'],
          ['kg:connectsTo', 'rdfs:domain', 'kg:Pump']
        ])
        .mockReturnValueOnce([['kg:manufacturer', 'rdf:type', 'owl:DatatypeProperty']]) // DatatypeProperty
        .mockReturnValueOnce([['kg:manufacturer', 'rdfs:label', '"manufacturer"']])
        .mockReturnValueOnce([['kg:manufacturer', 'rdfs:range', 'xsd:string']])
        .mockReturnValueOnce([['kg:connectsTo', 'rdf:type', 'owl:ObjectProperty']]) // ObjectProperty - should skip
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const result = await service.getInheritedProperties('kg:Pump');

      expect(result).toHaveLength(1);
      expect(result[0].uri).toBe('kg:manufacturer');
    });
  });

  describe('getInheritedRelationships', () => {
    test('should return relationships from direct class', async () => {
      mockHierarchyTraversal.getAncestors.mockResolvedValue([]);

      // Mock: Equipment has connectsTo relationship
      mockTripleStore.query
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:domain', 'kg:Equipment']])
        .mockReturnValueOnce([['kg:connectsTo', 'rdf:type', 'owl:ObjectProperty']])
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:label', '"connectsTo"']])
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:range', 'kg:Equipment']]);

      const result = await service.getInheritedRelationships('kg:Equipment');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        uri: 'kg:connectsTo',
        label: 'connectsTo',
        range: 'kg:Equipment',
        definedIn: 'kg:Equipment',
        inherited: false,
        inheritanceDistance: 0
      });
    });

    test('should return relationships from ancestor classes', async () => {
      // Mock: Pump → Equipment
      mockHierarchyTraversal.getAncestors.mockResolvedValue(['kg:Equipment']);

      mockTripleStore.query
        .mockReturnValueOnce([]) // No relationships in Pump
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:domain', 'kg:Equipment']]) // Relationship in Equipment
        .mockReturnValueOnce([['kg:connectsTo', 'rdf:type', 'owl:ObjectProperty']])
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:label', '"connectsTo"']])
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:range', 'kg:Equipment']]);

      const result = await service.getInheritedRelationships('kg:Pump');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        uri: 'kg:connectsTo',
        label: 'connectsTo',
        definedIn: 'kg:Equipment',
        inherited: true,
        inheritanceDistance: 1
      });
    });

    test('should filter out DatatypeProperty types (only return ObjectProperty)', async () => {
      mockHierarchyTraversal.getAncestors.mockResolvedValue([]);

      mockTripleStore.query
        .mockReturnValueOnce([
          ['kg:connectsTo', 'rdfs:domain', 'kg:Equipment'],
          ['kg:manufacturer', 'rdfs:domain', 'kg:Equipment']
        ])
        .mockReturnValueOnce([['kg:connectsTo', 'rdf:type', 'owl:ObjectProperty']]) // ObjectProperty
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:label', '"connectsTo"']])
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:range', 'kg:Equipment']])
        .mockReturnValueOnce([['kg:manufacturer', 'rdf:type', 'owl:DatatypeProperty']]) // DatatypeProperty - should skip
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const result = await service.getInheritedRelationships('kg:Equipment');

      expect(result).toHaveLength(1);
      expect(result[0].uri).toBe('kg:connectsTo');
    });
  });

  describe('findRelevantTypesForSentence', () => {
    // Note: This method uses extractTypeMentions with TemplatedPrompt which requires file I/O and real LLM
    // Full functionality is tested in integration tests
    // Unit tests focus on methods that can be easily mocked

    test('should be a function', () => {
      expect(typeof service.findRelevantTypesForSentence).toBe('function');
    });
  });
});
