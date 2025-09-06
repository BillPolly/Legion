import { describe, test, expect, beforeEach } from '@jest/globals';
import { KGEngine } from '../../../src/core/KGEngine.js';
import { InMemoryTripleStore } from '../../../src/storage/InMemoryTripleStore.js';
import { PatternQuery, LogicalQuery } from '../../../src/query/index.js';
import { GellishSystem, GellishQueryParser, GellishDictionary, EntityRecognizer } from '../../../src/gellish/index.js';

describe('Gellish Query Integration', () => {
  let kg;
  let gellish;
  let queryParser;

  beforeEach(() => {
    const store = new InMemoryTripleStore();
    kg = new KGEngine(store);
    gellish = new GellishSystem(kg);
    
    const dictionary = new GellishDictionary();
    const entityRecognizer = new EntityRecognizer(dictionary);
    queryParser = new GellishQueryParser(dictionary, entityRecognizer);

    // Set up test data
    gellish.assert("Pump P101 is part of System S200");
    gellish.assert("Pump P102 is part of System S200");
    gellish.assert("Tank T205 is part of System S200");
    gellish.assert("Motor M301 is part of Pump P101");
    gellish.assert("Pump P101 is manufactured by Siemens");
    gellish.assert("Pump P102 is manufactured by ABB");
    gellish.assert("Tank T205 contains Water");
    gellish.assert("System S200 is operated by John Smith");
  });

  // Helper function to convert Gellish patterns to PatternQuery patterns
  function convertPattern(pattern) {
    return [
      pattern[0] === null ? '?subject' : pattern[0],
      pattern[1],
      pattern[2] === null ? '?object' : pattern[2]
    ];
  }

  describe('PatternQuery Integration', () => {
    test('should integrate with existing PatternQuery system', async () => {
      // Parse Gellish query to pattern
      const pattern = queryParser.parseQuery("What is part of System S200?");
      // pattern should be [null, "gellish:1230", "system_s200"]
      
      // Use existing PatternQuery - convert null to variable
      const patternQuery = new PatternQuery()
        .pattern('?subject', pattern[1], pattern[2]);
      
      const result = await patternQuery.execute(kg);
      
      expect(result.bindings).toHaveLength(3);
      const entities = result.bindings.map(binding => binding.get('subject'));
      expect(entities).toContain('pump_p101');
      expect(entities).toContain('pump_p102');
      expect(entities).toContain('tank_t205');
    });

    test('should handle inverse queries with PatternQuery', async () => {
      const pattern = queryParser.parseQuery("System S200 consists of what?");
      const [s, p, o] = convertPattern(pattern);
      
      const patternQuery = new PatternQuery()
        .pattern(s, p, o);
      
      const result = await patternQuery.execute(kg);
      
      expect(result.bindings).toHaveLength(3);
      const entities = result.bindings.map(binding => binding.get('object'));
      expect(entities).toContain('pump_p101');
      expect(entities).toContain('pump_p102');
      expect(entities).toContain('tank_t205');
    });

    test('should handle manufacturing queries', async () => {
      const pattern = queryParser.parseQuery("What is manufactured by Siemens?");
      const [s, p, o] = convertPattern(pattern);
      
      const patternQuery = new PatternQuery()
        .pattern(s, p, o);
      
      const result = await patternQuery.execute(kg);
      
      expect(result.bindings).toHaveLength(1);
      expect(result.bindings[0].get('subject')).toBe('pump_p101');
    });

    test('should handle contains queries', async () => {
      const pattern = queryParser.parseQuery("What contains Water?");
      const [s, p, o] = convertPattern(pattern);
      
      const patternQuery = new PatternQuery()
        .pattern(s, p, o);
      
      const result = await patternQuery.execute(kg);
      
      expect(result.bindings).toHaveLength(1);
      expect(result.bindings[0].get('subject')).toBe('tank_t205');
    });
  });

  describe('Type-Filtered Query Integration', () => {
    test('should integrate type-filtered queries with LogicalQuery', async () => {
      // Add type information
      kg.addTriple('pump_p101', 'rdf:type', 'Pump');
      kg.addTriple('pump_p102', 'rdf:type', 'Pump');
      kg.addTriple('tank_t205', 'rdf:type', 'Tank');

      const typeQuery = queryParser.parseTypeFilteredQuery("Which pumps are part of System S200?");
      
      // Create base pattern query
      const [s1, p1, o1] = convertPattern(typeQuery.basePattern);
      const basePattern = new PatternQuery()
        .pattern(s1, p1, o1);
      
      // Create type filter query
      const typePattern = new PatternQuery()
        .pattern('?subject', 'rdf:type', typeQuery.entityType);
      
      // Combine with LogicalQuery
      const combinedQuery = new LogicalQuery('AND')
        .leftOperand(basePattern)
        .rightOperand(typePattern);
      
      const result = await combinedQuery.execute(kg);
      
      expect(result.bindings).toHaveLength(2);
      const entities = result.bindings.map(binding => binding.get('subject'));
      expect(entities).toContain('pump_p101');
      expect(entities).toContain('pump_p102');
      expect(entities).not.toContain('tank_t205');
    });

    test('should handle which tanks queries', async () => {
      kg.addTriple('pump_p101', 'rdf:type', 'Pump');
      kg.addTriple('pump_p102', 'rdf:type', 'Pump');
      kg.addTriple('tank_t205', 'rdf:type', 'Tank');

      const typeQuery = queryParser.parseTypeFilteredQuery("Which tanks are part of System S200?");
      
      const [s2, p2, o2] = convertPattern(typeQuery.basePattern);
      const basePattern = new PatternQuery()
        .pattern(s2, p2, o2);
      
      const typePattern = new PatternQuery()
        .pattern('?subject', 'rdf:type', typeQuery.entityType);
      
      const combinedQuery = new LogicalQuery('AND')
        .leftOperand(basePattern)
        .rightOperand(typePattern);
      
      const result = await combinedQuery.execute(kg);
      
      expect(result.bindings).toHaveLength(1);
      expect(result.bindings[0].get('subject')).toBe('tank_t205');
    });
  });

  describe('Complex Query Composition', () => {
    test('should compose multiple Gellish queries with LogicalQuery', async () => {
      // "What is part of System S200 AND manufactured by Siemens?"
      const partOfPattern = queryParser.parseQuery("What is part of System S200?");
      const manufacturedPattern = queryParser.parseQuery("What is manufactured by Siemens?");
      
      const [s3, p3, o3] = convertPattern(partOfPattern);
      const [s4, p4, o4] = convertPattern(manufacturedPattern);
      
      const partOfQuery = new PatternQuery()
        .pattern(s3, p3, o3);
      
      const manufacturedQuery = new PatternQuery()
        .pattern(s4, p4, o4);
      
      const combinedQuery = new LogicalQuery('AND')
        .leftOperand(partOfQuery)
        .rightOperand(manufacturedQuery);
      
      const result = await combinedQuery.execute(kg);
      
      expect(result.bindings).toHaveLength(1);
      expect(result.bindings[0].get('subject')).toBe('pump_p101');
    });

    test('should compose OR queries', async () => {
      // "What is manufactured by Siemens OR ABB?"
      const siemensPattern = queryParser.parseQuery("What is manufactured by Siemens?");
      const abbPattern = queryParser.parseQuery("What is manufactured by ABB?");
      
      const [s5, p5, o5] = convertPattern(siemensPattern);
      const [s6, p6, o6] = convertPattern(abbPattern);
      
      const siemensQuery = new PatternQuery()
        .pattern(s5, p5, o5);
      
      const abbQuery = new PatternQuery()
        .pattern(s6, p6, o6);
      
      const combinedQuery = new LogicalQuery('OR')
        .leftOperand(siemensQuery)
        .rightOperand(abbQuery);
      
      const result = await combinedQuery.execute(kg);
      
      expect(result.bindings).toHaveLength(2);
      const entities = result.bindings.map(binding => binding.get('subject'));
      expect(entities).toContain('pump_p101');
      expect(entities).toContain('pump_p102');
    });
  });

  describe('Performance Integration', () => {
    test('should handle large datasets efficiently', async () => {
      // Add many facts
      for (let i = 1; i <= 100; i++) {
        gellish.assert(`Component C${i} is part of System S200`);
        if (i % 2 === 0) {
          gellish.assert(`Component C${i} is manufactured by Siemens`);
        }
      }
      
      const startTime = Date.now();
      
      const pattern = queryParser.parseQuery("What is part of System S200?");
      const [s7, p7, o7] = convertPattern(pattern);
      const patternQuery = new PatternQuery()
        .pattern(s7, p7, o7);
      
      const result = await patternQuery.execute(kg);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(result.bindings.length).toBeGreaterThan(100);
      expect(executionTime).toBeLessThan(100); // Should execute in under 100ms
    });

    test('should handle complex query composition efficiently', async () => {
      // Add test data
      for (let i = 1; i <= 50; i++) {
        gellish.assert(`Pump P${i} is part of System S200`);
        kg.addTriple(`pump_p${i}`, 'rdf:type', 'Pump');
        if (i % 3 === 0) {
          gellish.assert(`Pump P${i} is manufactured by Siemens`);
        }
      }
      
      const startTime = Date.now();
      
      // Complex type-filtered query
      const typeQuery = queryParser.parseTypeFilteredQuery("Which pumps are manufactured by Siemens?");
      
      const [s8, p8, o8] = convertPattern(typeQuery.basePattern);
      const basePattern = new PatternQuery()
        .pattern(s8, p8, o8);
      
      const typePattern = new PatternQuery()
        .pattern('?subject', 'rdf:type', typeQuery.entityType);
      
      const combinedQuery = new LogicalQuery('AND')
        .leftOperand(basePattern)
        .rightOperand(typePattern);
      
      const result = await combinedQuery.execute(kg);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(result.bindings.length).toBeGreaterThan(15);
      expect(executionTime).toBeLessThan(50); // Should execute efficiently
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle invalid query patterns gracefully', () => {
      expect(() => {
        const pattern = queryParser.parseQuery("Invalid query structure");
      }).toThrow();
    });

    test('should handle empty results gracefully', async () => {
      const pattern = queryParser.parseQuery("What is manufactured by NonExistentCompany?");
      
      const [s9, p9, o9] = convertPattern(pattern);
      const patternQuery = new PatternQuery()
        .pattern(s9, p9, o9);
      
      const result = await patternQuery.execute(kg);
      
      expect(result.bindings).toHaveLength(0);
    });

    test('should handle malformed type-filtered queries', () => {
      expect(() => {
        const typeQuery = queryParser.parseTypeFilteredQuery("What pumps are part of System S200?");
      }).toThrow();
    });
  });

  describe('Variable Binding Integration', () => {
    test('should handle variable bindings correctly', async () => {
      const pattern = queryParser.parseQuery("What is part of System S200?");
      
      const [s10, p10, o10] = convertPattern(pattern);
      const patternQuery = new PatternQuery()
        .pattern(s10, p10, o10);
      
      const result = await patternQuery.execute(kg);
      
      result.bindings.forEach(binding => {
        expect(binding.has('subject')).toBe(true);
        expect(typeof binding.get('subject')).toBe('string');
      });
    });

    test('should handle inverse query variable bindings', async () => {
      const pattern = queryParser.parseQuery("System S200 consists of what?");
      
      const [s11, p11, o11] = convertPattern(pattern);
      const patternQuery = new PatternQuery()
        .pattern(s11, p11, o11);
      
      const result = await patternQuery.execute(kg);
      
      result.bindings.forEach(binding => {
        expect(binding.has('object')).toBe(true);
        expect(typeof binding.get('object')).toBe('string');
      });
    });
  });
});
