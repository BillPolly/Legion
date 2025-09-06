import { describe, test, expect, beforeEach } from '@jest/globals';
import { GellishGenerator, GellishDictionary } from '../../../src/gellish/index.js';

describe('GellishGenerator', () => {
  let generator;
  let dictionary;

  beforeEach(() => {
    dictionary = new GellishDictionary();
    generator = new GellishGenerator(dictionary);
  });

  describe('Basic Triple to Expression Generation', () => {
    test('should generate part-of expression', () => {
      const result = generator.generate("pump_p101", "gellish:1230", "system_s200");
      expect(result).toBe("Pump P101 is part of System S200");
    });

    test('should generate contains expression', () => {
      const result = generator.generate("tank_t205", "gellish:1331", "water");
      expect(result).toBe("Tank T205 contains Water");
    });

    test('should generate manufacturing expression', () => {
      const result = generator.generate("motor_m301", "gellish:1267", "siemens");
      expect(result).toBe("Motor M301 is manufactured by Siemens");
    });

    test('should generate connection expression', () => {
      const result = generator.generate("pipe_p205", "gellish:1456", "tank_t205");
      expect(result).toBe("Pipe P205 is connected to Tank T205");
    });

    test('should generate ownership expression', () => {
      const result = generator.generate("equipment_e101", "gellish:1200", "company_abc");
      expect(result).toBe("Equipment E101 is owned by Company Abc");
    });
  });

  describe('Entity Name Formatting', () => {
    test('should format simple entity names', () => {
      const result = generator.formatEntityName("pump_p101");
      expect(result).toBe("Pump P101");
    });

    test('should format entity names with multiple words', () => {
      const result = generator.formatEntityName("centrifugal_pump_p101");
      expect(result).toBe("Centrifugal Pump P101");
    });

    test('should format entity names with numbers', () => {
      const result = generator.formatEntityName("system_s200");
      expect(result).toBe("System S200");
    });

    test('should format single character entities', () => {
      const result = generator.formatEntityName("a");
      expect(result).toBe("A");
    });

    test('should format entity names with special characters', () => {
      const result = generator.formatEntityName("system-a/b");
      expect(result).toBe("System-a/b");
    });

    test('should handle entity names with mixed case', () => {
      const result = generator.formatEntityName("ABC_system_123");
      expect(result).toBe("ABC System 123");
    });
  });

  describe('UID Extraction', () => {
    test('should extract UID from gellish predicate', () => {
      const uid = generator.extractUidFromPredicate("gellish:1230");
      expect(uid).toBe(1230);
    });

    test('should extract UID from different predicates', () => {
      expect(generator.extractUidFromPredicate("gellish:1331")).toBe(1331);
      expect(generator.extractUidFromPredicate("gellish:1267")).toBe(1267);
      expect(generator.extractUidFromPredicate("gellish:1456")).toBe(1456);
    });

    test('should return null for invalid predicate format', () => {
      const uid = generator.extractUidFromPredicate("invalid:predicate");
      expect(uid).toBe(null);
    });

    test('should return null for non-gellish predicate', () => {
      const uid = generator.extractUidFromPredicate("rdf:type");
      expect(uid).toBe(null);
    });
  });

  describe('Query Result Formatting', () => {
    test('should format single query result', () => {
      const results = [["pump_p101", "gellish:1230", "system_s200"]];
      const formatted = generator.generateQueryResults(results, "What is part of System S200?");
      expect(formatted).toBe("Pump P101");
    });

    test('should format multiple query results', () => {
      const results = [
        ["pump_p101", "gellish:1230", "system_s200"],
        ["pump_p102", "gellish:1230", "system_s200"],
        ["tank_t205", "gellish:1230", "system_s200"]
      ];
      const formatted = generator.generateQueryResults(results, "What is part of System S200?");
      expect(formatted).toBe("Pump P101, Pump P102, Tank T205");
    });

    test('should handle empty query results', () => {
      const results = [];
      const formatted = generator.generateQueryResults(results, "What is part of System S200?");
      expect(formatted).toBe("No results found.");
    });

    test('should format results with different entity types', () => {
      const results = [
        ["john_smith", "gellish:1201", "system_s200"],
        ["jane_doe", "gellish:1201", "system_s200"]
      ];
      const formatted = generator.generateQueryResults(results, "Who operates System S200?");
      expect(formatted).toBe("John Smith, Jane Doe");
    });
  });

  describe('Error Handling', () => {
    test('should throw error for unknown relation UID', () => {
      expect(() => {
        generator.generate("pump_p101", "gellish:9999", "system_s200");
      }).toThrow("Unknown relation UID: 9999");
    });

    test('should handle malformed predicate gracefully', () => {
      expect(() => {
        generator.generate("pump_p101", "invalid_predicate", "system_s200");
      }).toThrow();
    });

    test('should handle null or undefined inputs', () => {
      expect(() => {
        generator.generate(null, "gellish:1230", "system_s200");
      }).toThrow();
    });
  });

  describe('Complex Entity Names', () => {
    test('should format complex system names', () => {
      const result = generator.formatEntityName("water_treatment_system_wts_200");
      expect(result).toBe("Water Treatment System Wts 200");
    });

    test('should format person names correctly', () => {
      const result = generator.formatEntityName("john_smith");
      expect(result).toBe("John Smith");
    });

    test('should format company names', () => {
      const result = generator.formatEntityName("acme_corporation");
      expect(result).toBe("Acme Corporation");
    });

    test('should format technical equipment names', () => {
      const result = generator.formatEntityName("centrifugal_pump_cp_101");
      expect(result).toBe("Centrifugal Pump Cp 101");
    });
  });

  describe('Different Relation Types', () => {
    test('should generate specialization expressions', () => {
      const result = generator.generate("centrifugal_pump", "gellish:1225", "pump");
      expect(result).toBe("Centrifugal Pump is a specialization of Pump");
    });

    test('should generate classification expressions', () => {
      const result = generator.generate("pump_p101", "gellish:1146", "centrifugal_pump");
      expect(result).toBe("Pump P101 is classified as Centrifugal Pump");
    });

    test('should generate location expressions', () => {
      const result = generator.generate("pump_p101", "gellish:1260", "building_a");
      expect(result).toBe("Pump P101 is located in Building A");
    });

    test('should generate temporal expressions', () => {
      const result = generator.generate("maintenance", "gellish:1350", "operation");
      expect(result).toBe("Maintenance occurs before Operation");
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long entity names', () => {
      const longName = "very_long_entity_name_with_many_words_and_numbers_123";
      const result = generator.formatEntityName(longName);
      expect(result).toBe("Very Long Entity Name With Many Words And Numbers 123");
    });

    test('should handle entity names with consecutive underscores', () => {
      const result = generator.formatEntityName("pump__p101");
      expect(result).toBe("Pump  P101");
    });

    test('should handle entity names starting with numbers', () => {
      const result = generator.formatEntityName("123_pump");
      expect(result).toBe("123 Pump");
    });

    test('should handle empty entity names', () => {
      const result = generator.formatEntityName("");
      expect(result).toBe("");
    });
  });

  describe('Performance', () => {
    test('should generate expressions quickly', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        generator.generate(`pump_p${i}`, "gellish:1230", `system_s${i}`);
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(50); // Should complete in under 50ms
    });

    test('should format large result sets efficiently', () => {
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push([`pump_p${i}`, "gellish:1230", "system_s200"]);
      }
      
      const startTime = Date.now();
      const formatted = generator.generateQueryResults(results, "What is part of System S200?");
      const endTime = Date.now();
      
      expect(formatted).toContain("Pump P0");
      expect(formatted).toContain("Pump P99");
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Consistency', () => {
    test('should generate consistent output for same input', () => {
      const result1 = generator.generate("pump_p101", "gellish:1230", "system_s200");
      const result2 = generator.generate("pump_p101", "gellish:1230", "system_s200");
      expect(result1).toBe(result2);
    });

    test('should format entity names consistently', () => {
      const result1 = generator.formatEntityName("pump_p101");
      const result2 = generator.formatEntityName("pump_p101");
      expect(result1).toBe(result2);
      expect(result1).toBe("Pump P101");
    });
  });

  describe('Integration with Dictionary', () => {
    test('should use dictionary for relation lookup', () => {
      // Test that generator properly uses the dictionary
      const result = generator.generate("pump_p101", "gellish:1230", "system_s200");
      expect(result).toContain("is part of");
    });

    test('should handle all core relations', () => {
      const coreRelations = [
        { uid: 1230, expected: "is part of" },
        { uid: 1331, expected: "contains" },
        { uid: 1267, expected: "is manufactured by" },
        { uid: 1456, expected: "is connected to" },
        { uid: 1200, expected: "is owned by" }
      ];

      coreRelations.forEach(({ uid, expected }) => {
        const result = generator.generate("entity_a", `gellish:${uid}`, "entity_b");
        expect(result).toContain(expected);
      });
    });
  });
});
