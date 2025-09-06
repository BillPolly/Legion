import { TripleGenerator } from '../../../src/kg-constructor/TripleGenerator.js';

describe('TripleGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new TripleGenerator();
  });

  describe('constructor', () => {
    test('should create instance with default options', () => {
      expect(generator).toBeInstanceOf(TripleGenerator);
      expect(generator.options.namespace).toBe('kg');
      expect(generator.options.entityPrefix).toBe('entity');
      expect(generator.entityIdCounter).toBe(1);
      expect(generator.entityIdMap).toBeInstanceOf(Map);
    });

    test('should accept custom options', () => {
      const customGenerator = new TripleGenerator({
        namespace: 'custom',
        entityPrefix: 'item',
        generateMetadata: false
      });
      
      expect(customGenerator.options.namespace).toBe('custom');
      expect(customGenerator.options.entityPrefix).toBe('item');
      expect(customGenerator.options.generateMetadata).toBe(false);
    });
  });

  describe('generateTriples', () => {
    test('should generate triples from extractions', () => {
      const extractions = {
        entities: [
          {
            id: 'entity_1',
            text: 'Pump P101',
            type: 'Pump',
            confidence: 0.95,
            properties: {
              name: 'Pump P101',
              identifier: 'P101',
              manufacturer: 'Siemens'
            }
          }
        ],
        relationships: []
      };

      const context = {
        extractionId: 'test_extraction',
        domain: 'industrial'
      };

      const triples = generator.generateTriples(extractions, context);
      
      expect(triples.length).toBeGreaterThan(0);
      expect(triples[0]).toHaveLength(3); // [subject, predicate, object]
    });

    test('should generate entity type triples', () => {
      const extractions = {
        entities: [
          {
            id: 'entity_1',
            text: 'Pump P101',
            type: 'Pump',
            confidence: 0.95,
            properties: { name: 'Pump P101' }
          }
        ],
        relationships: []
      };

      const triples = generator.generateTriples(extractions, {});
      
      const typeTriple = triples.find(t => t[1] === 'rdf:type');
      expect(typeTriple).toBeDefined();
      expect(typeTriple[2]).toBe('kg:Pump');
    });

    test('should generate property triples', () => {
      const extractions = {
        entities: [
          {
            id: 'entity_1',
            text: 'Pump P101',
            type: 'Pump',
            confidence: 0.95,
            properties: {
              name: 'Pump P101',
              manufacturer: 'Siemens'
            }
          }
        ],
        relationships: []
      };

      const triples = generator.generateTriples(extractions, {});
      
      const nameTriple = triples.find(t => t[1] === 'kg:name');
      expect(nameTriple).toBeDefined();
      expect(nameTriple[2]).toBe('"Pump P101"');

      const manufacturerTriple = triples.find(t => t[1] === 'kg:manufacturer');
      expect(manufacturerTriple).toBeDefined();
      expect(manufacturerTriple[2]).toBe('"Siemens"');
    });

    test('should generate relationship triples', () => {
      const extractions = {
        entities: [
          {
            id: 'entity_1',
            text: 'Pump P101',
            type: 'Pump',
            confidence: 0.95,
            properties: { name: 'Pump P101' }
          },
          {
            id: 'entity_2',
            text: 'System S300',
            type: 'System',
            confidence: 0.90,
            properties: { name: 'System S300' }
          }
        ],
        relationships: [
          {
            subject: 'entity_1',
            predicate: 'is_part_of',
            object: 'entity_2',
            confidence: 0.88
          }
        ]
      };

      const triples = generator.generateTriples(extractions, {});
      
      const relationshipTriple = triples.find(t => t[1] === 'gellish:1230');
      expect(relationshipTriple).toBeDefined();
    });
  });

  describe('getOrCreateEntityId', () => {
    test('should create consistent entity IDs', () => {
      const entity1 = {
        text: 'Pump P101',
        type: 'Pump',
        properties: { identifier: 'P101' }
      };

      const id1 = generator.getOrCreateEntityId(entity1);
      const id2 = generator.getOrCreateEntityId(entity1);
      
      expect(id1).toBe(id2);
      expect(id1).toBe('kg:pump_p101');
    });

    test('should use identifier when available', () => {
      const entity = {
        text: 'Pump P101',
        type: 'Pump',
        properties: { identifier: 'P101' }
      };

      const id = generator.getOrCreateEntityId(entity);
      expect(id).toBe('kg:pump_p101');
    });

    test('should generate sequential IDs when no identifier', () => {
      const entity = {
        text: 'Some Entity',
        type: 'Entity',
        properties: {}
      };

      const id = generator.getOrCreateEntityId(entity);
      expect(id).toBe('kg:entity_1');
    });
  });

  describe('mapEntityTypeToOntology', () => {
    test('should map known entity types', () => {
      expect(generator.mapEntityTypeToOntology('Pump')).toBe('kg:Pump');
      expect(generator.mapEntityTypeToOntology('Tank')).toBe('kg:Tank');
      expect(generator.mapEntityTypeToOntology('System')).toBe('kg:System');
    });

    test('should handle unknown entity types', () => {
      expect(generator.mapEntityTypeToOntology('UnknownType')).toBe('kg:UnknownType');
    });
  });

  describe('mapRelationshipToOntology', () => {
    test('should map known relationships', () => {
      expect(generator.mapRelationshipToOntology('is_part_of')).toBe('gellish:1230');
      expect(generator.mapRelationshipToOntology('contains')).toBe('gellish:1331');
      expect(generator.mapRelationshipToOntology('manufactured_by')).toBe('kg:manufacturedBy');
    });

    test('should handle unknown relationships', () => {
      expect(generator.mapRelationshipToOntology('unknown_relation')).toBe('kg:unknown_relation');
    });
  });

  describe('getInverseRelationship', () => {
    test('should return inverse relationships', () => {
      expect(generator.getInverseRelationship('is_part_of')).toBe('kg:consistsOf'); // consists_of mapped
      expect(generator.getInverseRelationship('contains')).toBe('kg:isContainedIn'); // is_contained_in mapped
    });

    test('should handle symmetric relationships', () => {
      expect(generator.getInverseRelationship('connected_to')).toBe('gellish:1456'); // connected_to mapped (symmetric)
    });

    test('should return null for unknown relationships', () => {
      expect(generator.getInverseRelationship('unknown_relation')).toBeNull();
    });
  });

  describe('formatPropertyValue', () => {
    test('should format string values', () => {
      expect(generator.formatPropertyValue('test string')).toBe('"test string"');
    });

    test('should format numeric values', () => {
      expect(generator.formatPropertyValue(42)).toBe('42');
      expect(generator.formatPropertyValue(3.14)).toBe('3.14');
    });

    test('should format boolean values', () => {
      expect(generator.formatPropertyValue(true)).toBe('true');
      expect(generator.formatPropertyValue(false)).toBe('false');
    });

    test('should handle values with units', () => {
      expect(generator.formatPropertyValue('150 psi')).toBe('"150 psi"');
      expect(generator.formatPropertyValue('100 gpm')).toBe('"100 gpm"');
    });
  });

  describe('getStatistics', () => {
    test('should return statistics about generated triples', () => {
      const extractions = {
        entities: [
          {
            id: 'entity_1',
            text: 'Pump P101',
            type: 'Pump',
            confidence: 0.95,
            properties: { name: 'Pump P101' }
          }
        ],
        relationships: []
      };

      generator.generateTriples(extractions, {});
      const stats = generator.getStatistics();
      
      expect(stats.totalTriples).toBeGreaterThan(0);
      expect(stats.entityTriples).toBeGreaterThan(0);
      expect(stats.uniqueEntities).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });
  });

  describe('exportTriples', () => {
    test('should export triples in array format', () => {
      const extractions = {
        entities: [
          {
            id: 'entity_1',
            text: 'Pump P101',
            type: 'Pump',
            confidence: 0.95,
            properties: { name: 'Pump P101' }
          }
        ],
        relationships: []
      };

      generator.generateTriples(extractions, {});
      const exported = generator.exportTriples('array');
      
      expect(Array.isArray(exported)).toBe(true);
      expect(exported[0]).toHaveLength(3);
    });

    test('should export triples in N-Triples format', () => {
      const extractions = {
        entities: [
          {
            id: 'entity_1',
            text: 'Pump P101',
            type: 'Pump',
            confidence: 0.95,
            properties: { name: 'Pump P101' }
          }
        ],
        relationships: []
      };

      generator.generateTriples(extractions, {});
      const exported = generator.exportTriples('ntriples');
      
      expect(typeof exported).toBe('string');
      expect(exported).toContain('<');
      expect(exported).toContain('>');
      expect(exported).toContain(' .');
    });
  });

  describe('reset', () => {
    test('should reset generator state', () => {
      const extractions = {
        entities: [
          {
            id: 'entity_1',
            text: 'Pump P101',
            type: 'Pump',
            confidence: 0.95,
            properties: { name: 'Pump P101' }
          }
        ],
        relationships: []
      };

      generator.generateTriples(extractions, {});
      expect(generator.generatedTriples.length).toBeGreaterThan(0);
      expect(generator.entityIdMap.size).toBeGreaterThan(0);
      
      generator.reset();
      expect(generator.generatedTriples.length).toBe(0);
      expect(generator.entityIdMap.size).toBe(0);
      expect(generator.entityIdCounter).toBe(1);
    });
  });

  describe('cleanIdentifier', () => {
    test('should clean identifiers for URI use', () => {
      expect(generator.cleanIdentifier('P-101')).toBe('p_101');
      expect(generator.cleanIdentifier('System/S300')).toBe('system_s300');
      expect(generator.cleanIdentifier('Tank_T200')).toBe('tank_t200');
    });
  });

  describe('escapeString', () => {
    test('should escape strings for literals', () => {
      expect(generator.escapeString('test "quote"')).toBe('test \\"quote\\"');
      expect(generator.escapeString('line\nbreak')).toBe('line\\nbreak');
      expect(generator.escapeString('tab\there')).toBe('tab\\there');
    });
  });
});
