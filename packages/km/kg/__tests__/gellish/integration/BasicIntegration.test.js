import { describe, test, expect, beforeEach } from '@jest/globals';
import { KGEngine } from '../../../src/core/KGEngine.js';
import { GellishDictionary, EntityRecognizer, GellishParser } from '@legion/gellish';

describe('Gellish KG Integration', () => {
  let kg;
  let dictionary;
  let entityRecognizer;
  let parser;

  beforeEach(() => {
    kg = new KGEngine();
    dictionary = new GellishDictionary();
    entityRecognizer = new EntityRecognizer(dictionary);
    parser = new GellishParser(dictionary, entityRecognizer);
  });

  describe('Basic Fact Storage and Retrieval', () => {
    test('should store and retrieve simple part-of fact', async () => {
      // Parse Gellish expression to triple
      const triple = parser.parse("Pump P101 is part of System S200");
      
      // Store in KG
      const added = kg.addTriple(triple[0], triple[1], triple[2]);
      expect(added).toBe(true);
      
      // Verify storage
      const size = await kg.size();
      expect(size).toBe(1);
      
      // Retrieve the fact
      const results = kg.query(triple[0], triple[1], triple[2]);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(triple);
    });

    test('should store and retrieve contains fact', () => {
      const triple = parser.parse("Tank T205 contains Water");
      
      kg.addTriple(triple[0], triple[1], triple[2]);
      
      const results = kg.query("tank_t205", "gellish:1331", "water");
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(["tank_t205", "gellish:1331", "water"]);
    });

    test('should store and retrieve manufacturing fact', () => {
      const triple = parser.parse("Motor M301 is manufactured by Siemens");
      
      kg.addTriple(triple[0], triple[1], triple[2]);
      
      const results = kg.query("motor_m301", "gellish:1267", "siemens");
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(["motor_m301", "gellish:1267", "siemens"]);
    });
  });

  describe('Multiple Facts Storage', () => {
    test('should store multiple related facts', async () => {
      const expressions = [
        "Pump P101 is part of System S200",
        "Tank T205 is part of System S200", 
        "Motor M301 is part of Pump P101",
        "System S200 contains Water"
      ];

      // Parse and store all expressions
      expressions.forEach(expr => {
        const triple = parser.parse(expr);
        kg.addTriple(triple[0], triple[1], triple[2]);
      });

      // Verify all facts are stored
      expect(await kg.size()).toBe(4);

      // Query for parts of System S200
      const systemParts = kg.query(null, "gellish:1230", "system_s200");
      expect(systemParts).toHaveLength(2);
      
      const partIds = systemParts.map(triple => triple[0]);
      expect(partIds).toContain("pump_p101");
      expect(partIds).toContain("tank_t205");
    });

    test('should handle batch processing', () => {
      const expressions = [
        "Equipment E101 is owned by Company ABC",
        "Equipment E102 is owned by Company ABC",
        "Equipment E103 is owned by Company XYZ"
      ];

      // Parse multiple expressions
      const triples = parser.parseMultiple(expressions);
      expect(triples).toHaveLength(3);

      // Store all triples
      triples.forEach(triple => {
        kg.addTriple(triple[0], triple[1], triple[2]);
      });

      // Query for equipment owned by Company ABC
      const abcEquipment = kg.query(null, "gellish:1200", "company_abc");
      expect(abcEquipment).toHaveLength(2);
    });
  });

  describe('Pattern Queries', () => {
    beforeEach(() => {
      // Set up test data
      const testFacts = [
        "Pump P101 is part of System S200",
        "Pump P102 is part of System S200",
        "Tank T205 is part of System S200",
        "Motor M301 is part of Pump P101",
        "Motor M302 is part of Pump P102",
        "System S200 contains Water",
        "Tank T205 contains Water"
      ];

      testFacts.forEach(expr => {
        const triple = parser.parse(expr);
        kg.addTriple(triple[0], triple[1], triple[2]);
      });
    });

    test('should query by subject pattern', () => {
      // Find all facts about Pump P101
      const pumpFacts = kg.query("pump_p101", null, null);
      expect(pumpFacts).toHaveLength(1);
      expect(pumpFacts[0]).toEqual(["pump_p101", "gellish:1230", "system_s200"]);
    });

    test('should query by predicate pattern', () => {
      // Find all part-of relationships
      const partOfFacts = kg.query(null, "gellish:1230", null);
      expect(partOfFacts).toHaveLength(5);
      
      // Should include pumps, tank, and motors
      const subjects = partOfFacts.map(triple => triple[0]);
      expect(subjects).toContain("pump_p101");
      expect(subjects).toContain("pump_p102");
      expect(subjects).toContain("tank_t205");
      expect(subjects).toContain("motor_m301");
      expect(subjects).toContain("motor_m302");
    });

    test('should query by object pattern', () => {
      // Find everything that is part of System S200
      const systemParts = kg.query(null, null, "system_s200");
      expect(systemParts).toHaveLength(3);
      
      const subjects = systemParts.map(triple => triple[0]);
      expect(subjects).toContain("pump_p101");
      expect(subjects).toContain("pump_p102");
      expect(subjects).toContain("tank_t205");
    });

    test('should query contains relationships', () => {
      // Find all contains relationships
      const containsFacts = kg.query(null, "gellish:1331", null);
      expect(containsFacts).toHaveLength(2);
      
      const subjects = containsFacts.map(triple => triple[0]);
      expect(subjects).toContain("system_s200");
      expect(subjects).toContain("tank_t205");
    });
  });

  describe('Entity Type Handling', () => {
    test('should handle different entity types correctly', () => {
      const expressions = [
        "John Smith operates Equipment E101",  // person -> individual
        "Tank T205 contains Water",            // individual -> concept
        "Pump P101 is manufactured by Siemens" // individual -> concept
      ];

      expressions.forEach(expr => {
        const triple = parser.parse(expr);
        kg.addTriple(triple[0], triple[1], triple[2]);
      });

      // Verify person entity
      const johnFacts = kg.query("john_smith", null, null);
      expect(johnFacts).toHaveLength(1);
      expect(johnFacts[0][2]).toBe("equipment_e101");

      // Verify concept entities
      const waterFacts = kg.query(null, null, "water");
      expect(waterFacts).toHaveLength(1);
      
      const siemensFacts = kg.query(null, null, "siemens");
      expect(siemensFacts).toHaveLength(1);
    });
  });

  describe('Synonym Handling in Storage', () => {
    test('should store synonymous expressions with same predicate', () => {
      const expressions = [
        "Component C101 is part of Assembly A200",
        "Component C102 belongs to Assembly A200",
        "Component C103 is a part of Assembly A200"
      ];

      expressions.forEach(expr => {
        const triple = parser.parse(expr);
        kg.addTriple(triple[0], triple[1], triple[2]);
      });

      // All should use the same predicate (gellish:1230)
      const assemblyParts = kg.query(null, "gellish:1230", "assembly_a200");
      expect(assemblyParts).toHaveLength(3);
      
      const components = assemblyParts.map(triple => triple[0]);
      expect(components).toContain("component_c101");
      expect(components).toContain("component_c102");
      expect(components).toContain("component_c103");
    });
  });

  describe('Error Handling in Integration', () => {
    test('should handle invalid expressions gracefully', async () => {
      expect(() => {
        parser.parse("Invalid expression with no relation");
      }).toThrow("Could not parse expression");
      
      // KG should remain unchanged
      expect(await kg.size()).toBe(0);
    });

    test('should handle duplicate facts correctly', async () => {
      const expression = "Pump P101 is part of System S200";
      const triple = parser.parse(expression);
      
      // Add the same fact twice
      const added1 = kg.addTriple(triple[0], triple[1], triple[2]);
      const added2 = kg.addTriple(triple[0], triple[1], triple[2]);
      
      expect(added1).toBe(true);
      expect(added2).toBe(false); // Duplicate not added
      expect(await kg.size()).toBe(1);
    });
  });

  describe('Round-trip Verification', () => {
    test('should maintain fact integrity through parse-store-retrieve cycle', () => {
      const originalExpression = "Pump P101 is part of System S200";
      
      // Parse to triple
      const triple = parser.parse(originalExpression);
      expect(triple).toEqual(["pump_p101", "gellish:1230", "system_s200"]);
      
      // Store in KG
      kg.addTriple(triple[0], triple[1], triple[2]);
      
      // Retrieve and verify
      const retrieved = kg.query(triple[0], triple[1], triple[2]);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(triple);
      
      // Verify individual components
      expect(retrieved[0][0]).toBe("pump_p101");
      expect(retrieved[0][1]).toBe("gellish:1230");
      expect(retrieved[0][2]).toBe("system_s200");
    });

    test('should handle complex entity names correctly', () => {
      const expression = "System-A/B-Complex_Name is connected to Unit-C/D-Other_Name";
      const triple = parser.parse(expression);
      
      kg.addTriple(triple[0], triple[1], triple[2]);
      
      const retrieved = kg.query(triple[0], triple[1], triple[2]);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(triple);
    });
  });

  describe('Performance with Multiple Facts', () => {
    test('should handle 100 facts efficiently', async () => {
      const startTime = Date.now();
      
      // Generate 100 facts
      for (let i = 1; i <= 100; i++) {
        const expression = `Equipment E${i.toString().padStart(3, '0')} is part of System S200`;
        const triple = parser.parse(expression);
        kg.addTriple(triple[0], triple[1], triple[2]);
      }
      
      const parseAndStoreTime = Date.now() - startTime;
      expect(parseAndStoreTime).toBeLessThan(1000); // Should take less than 1 second
      
      // Verify all facts are stored
      expect(await kg.size()).toBe(100);
      
      // Query performance
      const queryStart = Date.now();
      const systemParts = kg.query(null, "gellish:1230", "system_s200");
      const queryTime = Date.now() - queryStart;
      
      expect(queryTime).toBeLessThan(100); // Should take less than 100ms
      expect(systemParts).toHaveLength(100);
    });
  });
});
