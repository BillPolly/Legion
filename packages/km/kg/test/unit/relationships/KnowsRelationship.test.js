import { KnowsRelationship } from '../../../src/relationships/KnowsRelationship.js';
import '../../../src/serialization/ObjectExtensions.js'; // Enable getId() method

describe('KnowsRelationship', () => {
  let person1, person2, relationship;

  beforeEach(() => {
    // Create test objects
    person1 = { name: 'John', age: 30 };
    person2 = { name: 'Jane', age: 28 };
    
    // Create basic knows relationship
    relationship = new KnowsRelationship(person1, person2);
  });

  describe('Inheritance from Relationship', () => {
    test('should inherit from Relationship class', () => {
      expect(relationship.from).toBe(person1);
      expect(relationship.to).toBe(person2);
      expect(relationship.type).toBe('knows');
    });

    test('should automatically set relationship type to "knows"', () => {
      expect(relationship.type).toBe('knows');
    });

    test('should inherit base relationship metadata', () => {
      const data = {
        started: '2020-01-15',
        confidence: 0.9,
        context: 'work'
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      
      expect(rel.started).toBe('2020-01-15');
      expect(rel.confidence).toBe(0.9);
      expect(rel.context).toBe('work');
    });
  });

  describe('KnowsRelationship Specific Properties', () => {
    test('should create relationship without specific properties', () => {
      expect(relationship.howMet).toBeUndefined();
      expect(relationship.closeness).toBeUndefined();
    });

    test('should create relationship with howMet property', () => {
      const rel = new KnowsRelationship(person1, person2, { howMet: 'work' });
      expect(rel.howMet).toBe('work');
    });

    test('should create relationship with closeness property', () => {
      const rel = new KnowsRelationship(person1, person2, { closeness: 'close' });
      expect(rel.closeness).toBe('close');
    });

    test('should create relationship with both specific properties', () => {
      const data = {
        howMet: 'university',
        closeness: 'best_friend'
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      
      expect(rel.howMet).toBe('university');
      expect(rel.closeness).toBe('best_friend');
    });

    test('should handle combined base and specific properties', () => {
      const data = {
        started: '2018-09-01',
        confidence: 0.95,
        context: 'academic',
        howMet: 'university',
        closeness: 'close'
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      
      // Base properties
      expect(rel.started).toBe('2018-09-01');
      expect(rel.confidence).toBe(0.95);
      expect(rel.context).toBe('academic');
      
      // Specific properties
      expect(rel.howMet).toBe('university');
      expect(rel.closeness).toBe('close');
    });
  });

  describe('Triple Generation', () => {
    test('should generate base relationship triples', () => {
      const triples = relationship.toTriples();
      const relationshipId = relationship.getId();
      
      // Should include base relationship triples
      expect(triples).toContainEqual([person1.getId(), relationshipId, person2.getId()]);
      expect(triples).toContainEqual([relationshipId, 'rdf:type', 'KnowsRelationship']);
      expect(triples).toContainEqual([relationshipId, 'kg:from', person1.getId()]);
      expect(triples).toContainEqual([relationshipId, 'kg:to', person2.getId()]);
      expect(triples).toContainEqual([relationshipId, 'kg:relationType', 'knows']);
    });

    test('should include specific properties in triples when provided', () => {
      const data = {
        howMet: 'conference',
        closeness: 'acquaintance'
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', 'conference']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', 'acquaintance']);
    });

    test('should not include undefined specific properties in triples', () => {
      const triples = relationship.toTriples();
      const relationshipId = relationship.getId();
      
      // Should not contain triples for undefined properties
      const hasHowMet = triples.some(t => t[0] === relationshipId && t[1] === 'kg:howMet');
      const hasCloseness = triples.some(t => t[0] === relationshipId && t[1] === 'kg:closeness');
      
      expect(hasHowMet).toBe(false);
      expect(hasCloseness).toBe(false);
    });

    test('should include all properties when fully specified', () => {
      const data = {
        started: '2019-03-15',
        finished: '2023-12-31',
        confidence: 0.85,
        context: 'professional',
        source: 'linkedin',
        howMet: 'mutual_friend',
        closeness: 'friend'
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      // Base properties
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2019-03-15']);
      expect(triples).toContainEqual([relationshipId, 'kg:finished', '2023-12-31']);
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0.85]);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'professional']);
      expect(triples).toContainEqual([relationshipId, 'kg:source', 'linkedin']);
      
      // Specific properties
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', 'mutual_friend']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', 'friend']);
    });

    test('should handle empty string values for specific properties', () => {
      const data = {
        howMet: '',
        closeness: ''
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      // Empty strings should be included as valid values
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', '']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', '']);
    });

    test('should handle null values for specific properties', () => {
      const data = {
        howMet: null,
        closeness: null
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      // Null values should not be included
      const hasHowMet = triples.some(t => t[0] === relationshipId && t[1] === 'kg:howMet');
      const hasCloseness = triples.some(t => t[0] === relationshipId && t[1] === 'kg:closeness');
      
      expect(hasHowMet).toBe(false);
      expect(hasCloseness).toBe(false);
    });
  });

  describe('Common HowMet Values', () => {
    test('should handle various howMet scenarios', () => {
      const howMetValues = [
        'work',
        'university',
        'school',
        'mutual_friend',
        'online',
        'conference',
        'party',
        'family',
        'neighbor',
        'dating_app'
      ];
      
      howMetValues.forEach(howMet => {
        const rel = new KnowsRelationship(person1, person2, { howMet });
        const triples = rel.toTriples();
        const relationshipId = rel.getId();
        
        expect(triples).toContainEqual([relationshipId, 'kg:howMet', howMet]);
      });
    });
  });

  describe('Common Closeness Values', () => {
    test('should handle various closeness levels', () => {
      const closenessValues = [
        'stranger',
        'acquaintance',
        'colleague',
        'friend',
        'close_friend',
        'best_friend',
        'family',
        'partner',
        'spouse'
      ];
      
      closenessValues.forEach(closeness => {
        const rel = new KnowsRelationship(person1, person2, { closeness });
        const triples = rel.toTriples();
        const relationshipId = rel.getId();
        
        expect(triples).toContainEqual([relationshipId, 'kg:closeness', closeness]);
      });
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle work colleague relationship', () => {
      const data = {
        started: '2020-01-15',
        context: 'work',
        howMet: 'work',
        closeness: 'colleague',
        confidence: 0.9
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2020-01-15']);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'work']);
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', 'work']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', 'colleague']);
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0.9]);
    });

    test('should handle university friend relationship', () => {
      const data = {
        started: '2015-09-01',
        context: 'academic',
        howMet: 'university',
        closeness: 'close_friend',
        confidence: 0.95,
        source: 'facebook'
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2015-09-01']);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'academic']);
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', 'university']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', 'close_friend']);
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0.95]);
      expect(triples).toContainEqual([relationshipId, 'kg:source', 'facebook']);
    });

    test('should handle online acquaintance relationship', () => {
      const data = {
        started: '2022-06-10',
        context: 'social',
        howMet: 'online',
        closeness: 'acquaintance',
        confidence: 0.7
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2022-06-10']);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'social']);
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', 'online']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', 'acquaintance']);
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0.7]);
    });
  });

  describe('Edge Cases', () => {
    test('should handle special characters in howMet and closeness', () => {
      const data = {
        howMet: 'café & bar',
        closeness: 'très proche'
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', 'café & bar']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', 'très proche']);
    });

    test('should handle very long descriptions', () => {
      const longDescription = 'Met at a very long conference name that goes on and on'.repeat(10);
      
      const data = {
        howMet: longDescription,
        closeness: 'professional_acquaintance'
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      
      expect(() => {
        const triples = rel.toTriples();
        expect(triples.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    test('should handle numeric-like strings', () => {
      const data = {
        howMet: '2020',
        closeness: '5'
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', '2020']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', '5']);
    });
  });

  describe('Type Information', () => {
    test('should have correct class name in type triple', () => {
      const triples = relationship.toTriples();
      const relationshipId = relationship.getId();
      
      expect(triples).toContainEqual([relationshipId, 'rdf:type', 'KnowsRelationship']);
    });

    test('should maintain knows type regardless of data', () => {
      const data = {
        howMet: 'work',
        closeness: 'colleague'
      };
      
      const rel = new KnowsRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:relationType', 'knows']);
      expect(triples).toContainEqual([relationshipId, 'rdf:type', 'KnowsRelationship']);
    });
  });

  describe('Performance', () => {
    test('should handle triple generation efficiently', () => {
      const startTime = performance.now();
      
      // Generate triples for 100 knows relationships
      for (let i = 0; i < 100; i++) {
        const rel = new KnowsRelationship(person1, person2, {
          howMet: `method_${i}`,
          closeness: `level_${i}`,
          started: `2020-01-${i + 1}`,
          confidence: i / 100
        });
        rel.toTriples();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});
