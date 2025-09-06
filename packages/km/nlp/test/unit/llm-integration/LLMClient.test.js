import { LLMClient } from '../../../src/llm-integration/LLMClient.js';
import { MockLLMClient } from '../../../src/llm-integration/MockLLMClient.js';

describe('LLMClient Interface', () => {
  describe('LLMClient base class', () => {
    test('should throw error for unimplemented methods', async () => {
      const client = new LLMClient();
      
      await expect(client.extractEntities('text', {}, {}))
        .rejects.toThrow('extractEntities must be implemented');
      
      await expect(client.extractRelationships('text', [], []))
        .rejects.toThrow('extractRelationships must be implemented');
      
      await expect(client.assessQuality('original', [], 'paraphrase'))
        .rejects.toThrow('assessQuality must be implemented');
      
      await expect(client.compareSemantics('text1', 'text2'))
        .rejects.toThrow('compareSemantics must be implemented');
      
      await expect(client.disambiguate('entity', {}, []))
        .rejects.toThrow('disambiguate must be implemented');
    });
  });
});

describe('MockLLMClient', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockLLMClient();
  });

  describe('constructor', () => {
    test('should create instance with default options', () => {
      expect(mockClient).toBeInstanceOf(MockLLMClient);
      expect(mockClient).toBeInstanceOf(LLMClient);
      expect(mockClient.options).toBeDefined();
    });

    test('should accept custom options', () => {
      const customOptions = {
        responseDelay: 100,
        confidenceRange: [0.7, 0.9]
      };
      const customClient = new MockLLMClient(customOptions);
      expect(customClient.options.responseDelay).toBe(100);
      expect(customClient.options.confidenceRange).toEqual([0.7, 0.9]);
    });
  });

  describe('extractEntities', () => {
    test('should extract entities from text', async () => {
      const text = 'Pump P101 is part of System S200.';
      const schema = {
        entityTypes: ['Pump', 'System'],
        properties: ['identifier', 'name']
      };
      const context = { domain: 'technical' };

      const result = await mockClient.extractEntities(text, schema, context);

      expect(result.entities).toBeDefined();
      expect(Array.isArray(result.entities)).toBe(true);
      expect(result.entities.length).toBeGreaterThan(0);
      
      const entity = result.entities[0];
      expect(entity.text).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(entity.confidence).toBeGreaterThan(0);
      expect(entity.confidence).toBeLessThanOrEqual(1);
      expect(entity.textSpan).toBeDefined();
      expect(entity.textSpan.start).toBeGreaterThanOrEqual(0);
      expect(entity.textSpan.end).toBeGreaterThan(entity.textSpan.start);
    });

    test('should return empty entities for empty text', async () => {
      const result = await mockClient.extractEntities('', {}, {});
      expect(result.entities).toEqual([]);
    });

    test('should include confidence scores within range', async () => {
      const text = 'Test entity extraction.';
      const result = await mockClient.extractEntities(text, {}, {});
      
      result.entities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThanOrEqual(0.5);
        expect(entity.confidence).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('extractRelationships', () => {
    test('should extract relationships between entities', async () => {
      const text = 'Pump P101 is part of System S200.';
      const entities = [
        { id: 'pump_p101', text: 'Pump P101', type: 'Pump' },
        { id: 'system_s200', text: 'System S200', type: 'System' }
      ];
      const relationshipTypes = ['is_part_of', 'contains', 'connected_to'];

      const result = await mockClient.extractRelationships(text, entities, relationshipTypes);

      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
      
      if (result.relationships.length > 0) {
        const relationship = result.relationships[0];
        expect(relationship.subject).toBeDefined();
        expect(relationship.predicate).toBeDefined();
        expect(relationship.object).toBeDefined();
        expect(relationship.confidence).toBeGreaterThan(0);
        expect(relationship.confidence).toBeLessThanOrEqual(1);
        expect(relationship.evidence).toBeDefined();
        expect(relationship.textSpan).toBeDefined();
      }
    });

    test('should return empty relationships when no entities provided', async () => {
      const result = await mockClient.extractRelationships('text', [], []);
      expect(result.relationships).toEqual([]);
    });

    test('should handle single entity gracefully', async () => {
      const entities = [{ id: 'entity1', text: 'Entity', type: 'Type' }];
      const result = await mockClient.extractRelationships('text', entities, []);
      expect(result.relationships).toEqual([]);
    });
  });

  describe('assessQuality', () => {
    test('should assess extraction quality', async () => {
      const original = 'Pump P101 is part of System S200.';
      const extracted = [
        ['pump_p101', 'rdf:type', 'Pump'],
        ['pump_p101', 'is_part_of', 'system_s200']
      ];
      const paraphrase = 'Pump P101 belongs to System S200.';

      const result = await mockClient.assessQuality(original, extracted, paraphrase);

      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.completeness).toBeDefined();
      expect(result.metrics.accuracy).toBeDefined();
      expect(result.metrics.consistency).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
    });

    test('should handle empty inputs', async () => {
      const result = await mockClient.assessQuality('', [], '');
      expect(result.overallScore).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.issues).toBeDefined();
    });
  });

  describe('compareSemantics', () => {
    test('should compare semantic similarity', async () => {
      const text1 = 'Pump P101 is part of System S200.';
      const text2 = 'Pump P101 belongs to System S200.';

      const result = await mockClient.compareSemantics(text1, text2);

      expect(result.similarityScore).toBeGreaterThan(0);
      expect(result.similarityScore).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.commonConcepts).toBeDefined();
      expect(result.analysis.differences).toBeDefined();
    });

    test('should handle identical texts', async () => {
      const text = 'Same text for both inputs.';
      const result = await mockClient.compareSemantics(text, text);
      expect(result.similarityScore).toBeGreaterThan(0.9);
    });

    test('should handle empty texts', async () => {
      const result = await mockClient.compareSemantics('', '');
      expect(result.similarityScore).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe('disambiguate', () => {
    test('should disambiguate entity references', async () => {
      const entity = 'P101';
      const context = { 
        text: 'Pump P101 operates in the facility.',
        domain: 'industrial'
      };
      const candidates = [
        { id: 'pump_p101', type: 'Pump', name: 'Pump P101' },
        { id: 'pipe_p101', type: 'Pipe', name: 'Pipe P101' }
      ];

      const result = await mockClient.disambiguate(entity, context, candidates);

      expect(result.selectedCandidate).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.reasoning).toBeDefined();
      expect(result.alternativeCandidates).toBeDefined();
      expect(Array.isArray(result.alternativeCandidates)).toBe(true);
    });

    test('should handle no candidates', async () => {
      const result = await mockClient.disambiguate('entity', {}, []);
      expect(result.selectedCandidate).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.alternativeCandidates).toEqual([]);
    });

    test('should handle single candidate', async () => {
      const candidates = [{ id: 'entity1', type: 'Type', name: 'Entity 1' }];
      const result = await mockClient.disambiguate('entity', {}, candidates);
      expect(result.selectedCandidate).toEqual(candidates[0]);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('response delay simulation', () => {
    test('should simulate processing delay', async () => {
      const clientWithDelay = new MockLLMClient({ responseDelay: 50 });
      const startTime = Date.now();
      
      await clientWithDelay.extractEntities('test', {}, {});
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });

    test('should work with zero delay', async () => {
      const clientNoDelay = new MockLLMClient({ responseDelay: 0 });
      const startTime = Date.now();
      
      await clientNoDelay.extractEntities('test', {}, {});
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});
