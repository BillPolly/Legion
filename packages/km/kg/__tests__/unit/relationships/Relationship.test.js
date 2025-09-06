import { Relationship } from '../../../src/relationships/Relationship.js';
import '../../../src/serialization/ObjectExtensions.js'; // Enable getId() method

describe('Relationship', () => {
  let person1, person2, relationship;

  beforeEach(() => {
    // Create test objects
    person1 = { name: 'John', age: 30 };
    person2 = { name: 'Jane', age: 28 };
    
    // Create basic relationship
    relationship = new Relationship(person1, person2, 'knows');
  });

  describe('Basic Relationship Creation', () => {
    test('should create relationship with required parameters', () => {
      expect(relationship.from).toBe(person1);
      expect(relationship.to).toBe(person2);
      expect(relationship.type).toBe('knows');
    });

    test('should create relationship without optional data', () => {
      expect(relationship.started).toBeUndefined();
      expect(relationship.finished).toBeUndefined();
      expect(relationship.confidence).toBeUndefined();
      expect(relationship.context).toBeUndefined();
      expect(relationship.source).toBeUndefined();
    });

    test('should create relationship with optional metadata', () => {
      const data = {
        started: '2020-01-15',
        finished: '2023-06-30',
        confidence: 0.95,
        context: 'work',
        source: 'linkedin'
      };
      
      const rel = new Relationship(person1, person2, 'knows', data);
      
      expect(rel.started).toBe('2020-01-15');
      expect(rel.finished).toBe('2023-06-30');
      expect(rel.confidence).toBe(0.95);
      expect(rel.context).toBe('work');
      expect(rel.source).toBe('linkedin');
    });
  });

  describe('Triple Generation', () => {
    test('should generate basic relationship triples', () => {
      const triples = relationship.toTriples();
      const relationshipId = relationship.getId();
      
      expect(triples).toContainEqual([person1.getId(), relationshipId, person2.getId()]);
      expect(triples).toContainEqual([relationshipId, 'rdf:type', 'Relationship']);
      expect(triples).toContainEqual([relationshipId, 'kg:from', person1.getId()]);
      expect(triples).toContainEqual([relationshipId, 'kg:to', person2.getId()]);
      expect(triples).toContainEqual([relationshipId, 'kg:relationType', 'knows']);
    });

    test('should include metadata in triples when provided', () => {
      const data = {
        started: '2020-01-15',
        confidence: 0.95,
        context: 'work'
      };
      
      const rel = new Relationship(person1, person2, 'knows', data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2020-01-15']);
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0.95]);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'work']);
    });

    test('should not include undefined metadata in triples', () => {
      const triples = relationship.toTriples();
      const relationshipId = relationship.getId();
      
      // Should not contain triples for undefined properties
      const hasStarted = triples.some(t => t[0] === relationshipId && t[1] === 'kg:started');
      const hasFinished = triples.some(t => t[0] === relationshipId && t[1] === 'kg:finished');
      const hasConfidence = triples.some(t => t[0] === relationshipId && t[1] === 'kg:confidence');
      
      expect(hasStarted).toBe(false);
      expect(hasFinished).toBe(false);
      expect(hasConfidence).toBe(false);
    });

    test('should handle confidence value of 0', () => {
      const rel = new Relationship(person1, person2, 'knows', { confidence: 0 });
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0]);
    });
  });

  describe('ID Generation', () => {
    test('should generate unique IDs for different relationships', () => {
      const rel1 = new Relationship(person1, person2, 'knows');
      const rel2 = new Relationship(person2, person1, 'knows');
      
      expect(rel1.getId()).not.toBe(rel2.getId());
    });

    test('should maintain consistent ID across multiple calls', () => {
      const id1 = relationship.getId();
      const id2 = relationship.getId();
      
      expect(id1).toBe(id2);
    });

    test('should allow manual ID setting', () => {
      const customId = 'custom_relationship_123';
      relationship.setId(customId);
      
      expect(relationship.getId()).toBe(customId);
    });
  });

  describe('Temporal Relationships', () => {
    test('should handle temporal bounds', () => {
      const data = {
        started: '2020-01-15T10:30:00Z',
        finished: '2023-06-30T15:45:00Z'
      };
      
      const rel = new Relationship(person1, person2, 'worked_with', data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2020-01-15T10:30:00Z']);
      expect(triples).toContainEqual([relationshipId, 'kg:finished', '2023-06-30T15:45:00Z']);
    });

    test('should handle ongoing relationships (no finish date)', () => {
      const data = {
        started: '2020-01-15',
        // No finished date - ongoing relationship
      };
      
      const rel = new Relationship(person1, person2, 'works_with', data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2020-01-15']);
      
      const hasFinished = triples.some(t => t[0] === relationshipId && t[1] === 'kg:finished');
      expect(hasFinished).toBe(false);
    });
  });

  describe('Confidence and Source Tracking', () => {
    test('should handle confidence scores', () => {
      const confidenceValues = [0, 0.25, 0.5, 0.75, 1.0];
      
      confidenceValues.forEach(confidence => {
        const rel = new Relationship(person1, person2, 'knows', { confidence });
        const triples = rel.toTriples();
        const relationshipId = rel.getId();
        
        expect(triples).toContainEqual([relationshipId, 'kg:confidence', confidence]);
      });
    });

    test('should handle source attribution', () => {
      const sources = ['manual_entry', 'linkedin', 'facebook', 'email_analysis'];
      
      sources.forEach(source => {
        const rel = new Relationship(person1, person2, 'knows', { source });
        const triples = rel.toTriples();
        const relationshipId = rel.getId();
        
        expect(triples).toContainEqual([relationshipId, 'kg:source', source]);
      });
    });

    test('should handle context information', () => {
      const contexts = ['work', 'personal', 'academic', 'social'];
      
      contexts.forEach(context => {
        const rel = new Relationship(person1, person2, 'knows', { context });
        const triples = rel.toTriples();
        const relationshipId = rel.getId();
        
        expect(triples).toContainEqual([relationshipId, 'kg:context', context]);
      });
    });
  });

  describe('Complex Metadata Combinations', () => {
    test('should handle all metadata fields together', () => {
      const data = {
        started: '2020-01-15',
        finished: '2023-06-30',
        confidence: 0.85,
        context: 'professional',
        source: 'crm_system'
      };
      
      const rel = new Relationship(person1, person2, 'collaborated_with', data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      // Verify all metadata is present
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2020-01-15']);
      expect(triples).toContainEqual([relationshipId, 'kg:finished', '2023-06-30']);
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0.85]);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'professional']);
      expect(triples).toContainEqual([relationshipId, 'kg:source', 'crm_system']);
      expect(triples).toContainEqual([relationshipId, 'kg:relationType', 'collaborated_with']);
    });

    test('should handle partial metadata', () => {
      const data = {
        confidence: 0.7,
        context: 'academic'
        // Missing started, finished, source
      };
      
      const rel = new Relationship(person1, person2, 'studied_with', data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      // Should include provided metadata
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0.7]);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'academic']);
      
      // Should not include missing metadata
      const hasStarted = triples.some(t => t[0] === relationshipId && t[1] === 'kg:started');
      const hasFinished = triples.some(t => t[0] === relationshipId && t[1] === 'kg:finished');
      const hasSource = triples.some(t => t[0] === relationshipId && t[1] === 'kg:source');
      
      expect(hasStarted).toBe(false);
      expect(hasFinished).toBe(false);
      expect(hasSource).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null relationship type', () => {
      const rel = new Relationship(person1, person2, null);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      // Should not include null type
      const hasType = triples.some(t => t[0] === relationshipId && t[1] === 'kg:relationType');
      expect(hasType).toBe(false);
    });

    test('should handle empty string values', () => {
      const data = {
        started: '',
        context: '',
        source: ''
      };
      
      const rel = new Relationship(person1, person2, '', data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      // Empty strings should be included as valid values
      expect(triples).toContainEqual([relationshipId, 'kg:started', '']);
      expect(triples).toContainEqual([relationshipId, 'kg:context', '']);
      expect(triples).toContainEqual([relationshipId, 'kg:source', '']);
      expect(triples).toContainEqual([relationshipId, 'kg:relationType', '']);
    });

    test('should handle special characters in metadata', () => {
      const data = {
        context: 'café & résumé',
        source: 'email@domain.com',
        started: '2020-01-15T10:30:00+05:30'
      };
      
      const rel = new Relationship(person1, person2, 'met_at_café', data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'café & résumé']);
      expect(triples).toContainEqual([relationshipId, 'kg:source', 'email@domain.com']);
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2020-01-15T10:30:00+05:30']);
      expect(triples).toContainEqual([relationshipId, 'kg:relationType', 'met_at_café']);
    });
  });

  describe('Triple Structure Validation', () => {
    test('should generate well-formed triples', () => {
      const rel = new Relationship(person1, person2, 'knows', {
        started: '2020-01-15',
        confidence: 0.9
      });
      
      const triples = rel.toTriples();
      
      // All triples should be arrays of length 3
      triples.forEach(triple => {
        expect(Array.isArray(triple)).toBe(true);
        expect(triple).toHaveLength(3);
        expect(typeof triple[0]).toBe('string'); // subject
        expect(typeof triple[1]).toBe('string'); // predicate
        // object can be string or number
      });
    });

    test('should include core relationship triple first', () => {
      const triples = relationship.toTriples();
      const relationshipId = relationship.getId();
      
      // First triple should be the core relationship
      expect(triples[0]).toEqual([person1.getId(), relationshipId, person2.getId()]);
    });

    test('should include type information', () => {
      const triples = relationship.toTriples();
      const relationshipId = relationship.getId();
      
      // Should include rdf:type
      expect(triples).toContainEqual([relationshipId, 'rdf:type', 'Relationship']);
    });
  });

  describe('Performance', () => {
    test('should handle triple generation efficiently', () => {
      const startTime = performance.now();
      
      // Generate triples for 100 relationships
      for (let i = 0; i < 100; i++) {
        const rel = new Relationship(person1, person2, `type_${i}`, {
          started: `2020-01-${i + 1}`,
          confidence: i / 100,
          context: `context_${i}`
        });
        rel.toTriples();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    test('should handle large metadata objects', () => {
      const largeData = {};
      for (let i = 0; i < 50; i++) {
        largeData[`field_${i}`] = `value_${i}`.repeat(100);
      }
      
      // Add standard fields
      largeData.started = '2020-01-15';
      largeData.confidence = 0.8;
      largeData.context = 'test';
      
      const rel = new Relationship(person1, person2, 'knows', largeData);
      
      expect(() => {
        const triples = rel.toTriples();
        expect(triples.length).toBeGreaterThan(0);
      }).not.toThrow();
    });
  });
});
