import { describe, test, expect, beforeEach } from '@jest/globals';
import { GellishDictionary, EntityRecognizer, GellishParser } from '@legion/gellish';

describe('GellishParser', () => {
  let dictionary;
  let entityRecognizer;
  let parser;

  beforeEach(() => {
    dictionary = new GellishDictionary();
    entityRecognizer = new EntityRecognizer(dictionary);
    parser = new GellishParser(dictionary, entityRecognizer);
  });

  describe('Basic Expression Parsing', () => {
    test('should parse simple part-of expression', () => {
      const result = parser.parse("Pump P101 is part of System S200");
      expect(result).toEqual(["pump_p101", "gellish:1230", "system_s200"]);
    });

    test('should parse contains expression', () => {
      const result = parser.parse("Tank T205 contains Water");
      expect(result).toEqual(["tank_t205", "gellish:1331", "water"]);
    });

    test('should parse manufacturing expression', () => {
      const result = parser.parse("Motor M301 is manufactured by Siemens");
      expect(result).toEqual(["motor_m301", "gellish:1267", "siemens"]);
    });

    test('should parse connection expression', () => {
      const result = parser.parse("Pipe P205 is connected to Tank T205");
      expect(result).toEqual(["pipe_p205", "gellish:1456", "tank_t205"]);
    });

    test('should parse ownership expression', () => {
      const result = parser.parse("Equipment E101 is owned by Company ABC");
      expect(result).toEqual(["equipment_e101", "gellish:1200", "company_abc"]);
    });
  });

  describe('Synonym Handling', () => {
    test('should handle part-of synonyms', () => {
      const result1 = parser.parse("Component C101 belongs to Assembly A200");
      expect(result1).toEqual(["component_c101", "gellish:1230", "assembly_a200"]);

      const result2 = parser.parse("Part P101 is a part of Machine M200");
      expect(result2).toEqual(["part_p101", "gellish:1230", "machine_m200"]);
    });

    test('should handle manufacturing synonyms', () => {
      const result1 = parser.parse("Product P101 is made by Factory F200");
      expect(result1).toEqual(["product_p101", "gellish:1267", "factory_f200"]);

      const result2 = parser.parse("Item I101 is produced by Manufacturer M200");
      expect(result2).toEqual(["item_i101", "gellish:1267", "manufacturer_m200"]);
    });

    test('should handle contains synonyms', () => {
      const result1 = parser.parse("Container C101 holds Material M200");
      expect(result1).toEqual(["container_c101", "gellish:1331", "material_m200"]);

      const result2 = parser.parse("Vessel V101 includes Substance S200");
      expect(result2).toEqual(["vessel_v101", "gellish:1331", "substance_s200"]);
    });
  });

  describe('Entity Type Handling', () => {
    test('should handle individual entities', () => {
      const result = parser.parse("Pump P101 is part of System S200");
      expect(result[0]).toBe("pump_p101");
      expect(result[2]).toBe("system_s200");
    });

    test('should handle person entities', () => {
      const result = parser.parse("John Smith operates Equipment E101");
      expect(result[0]).toBe("john_smith");
      expect(result[2]).toBe("equipment_e101");
    });

    test('should handle concept entities', () => {
      const result = parser.parse("Tank T205 contains Water");
      expect(result[0]).toBe("tank_t205");
      expect(result[2]).toBe("water");
    });

    test('should handle mixed entity types', () => {
      const result = parser.parse("John Smith owns Pump P101");
      expect(result[0]).toBe("john_smith");
      expect(result[2]).toBe("pump_p101");
    });
  });

  describe('Predicate Format', () => {
    test('should format predicates with gellish prefix', () => {
      const result = parser.parse("Pump P101 is part of System S200");
      expect(result[1]).toBe("gellish:1230");
    });

    test('should use correct UIDs for different relations', () => {
      const result1 = parser.parse("Tank contains Water");
      expect(result1[1]).toBe("gellish:1331");

      const result2 = parser.parse("Motor is manufactured by Siemens");
      expect(result2[1]).toBe("gellish:1267");

      const result3 = parser.parse("Pipe is connected to Tank");
      expect(result3[1]).toBe("gellish:1456");
    });
  });

  describe('Multiple Expression Parsing', () => {
    test('should parse multiple expressions', () => {
      const expressions = [
        "Pump P101 is part of System S200",
        "Tank T205 contains Water",
        "Motor M301 is manufactured by Siemens"
      ];

      const results = parser.parseMultiple(expressions);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(["pump_p101", "gellish:1230", "system_s200"]);
      expect(results[1]).toEqual(["tank_t205", "gellish:1331", "water"]);
      expect(results[2]).toEqual(["motor_m301", "gellish:1267", "siemens"]);
    });

    test('should handle empty array', () => {
      const results = parser.parseMultiple([]);
      expect(results).toEqual([]);
    });

    test('should handle single expression in array', () => {
      const results = parser.parseMultiple(["Pump P101 is part of System S200"]);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(["pump_p101", "gellish:1230", "system_s200"]);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for expression with no relation', () => {
      expect(() => {
        parser.parse("Pump P101 something System S200");
      }).toThrow("Could not parse expression");
    });

    test('should throw error for expression with no entities', () => {
      expect(() => {
        parser.parse("is part of");
      }).toThrow("Could not parse expression");
    });

    test('should throw error for expression with only left entity', () => {
      expect(() => {
        parser.parse("Pump P101 is part of");
      }).toThrow("Could not parse expression");
    });

    test('should throw error for expression with only right entity', () => {
      expect(() => {
        parser.parse("is part of System S200");
      }).toThrow("Could not parse expression");
    });

    test('should throw error for empty expression', () => {
      expect(() => {
        parser.parse("");
      }).toThrow("Could not parse expression");
    });

    test('should throw error for whitespace-only expression', () => {
      expect(() => {
        parser.parse("   ");
      }).toThrow("Could not parse expression");
    });
  });

  describe('Case Sensitivity', () => {
    test('should handle mixed case relations', () => {
      const result = parser.parse("Pump P101 IS PART OF System S200");
      expect(result).toEqual(["pump_p101", "gellish:1230", "system_s200"]);
    });

    test('should handle mixed case entities', () => {
      const result = parser.parse("pump p101 is part of system s200");
      expect(result).toEqual(["pump_p101", "gellish:1230", "system_s200"]);
    });
  });

  describe('Whitespace Handling', () => {
    test('should handle extra whitespace', () => {
      const result = parser.parse("  Pump   P101    is  part  of   System  S200  ");
      expect(result).toEqual(["pump_p101", "gellish:1230", "system_s200"]);
    });

    test('should handle tabs and newlines', () => {
      const result = parser.parse("Pump\tP101\nis\tpart\tof\nSystem\tS200");
      expect(result).toEqual(["pump_p101", "gellish:1230", "system_s200"]);
    });
  });

  describe('Special Characters', () => {
    test('should handle entities with special characters', () => {
      const result = parser.parse("System-A/B is connected to Unit-C/D");
      expect(result[0]).toBe("system-a/b");
      expect(result[2]).toBe("unit-c/d");
    });

    test('should handle entities with numbers and letters', () => {
      const result = parser.parse("Equipment E101A is part of System S200B");
      expect(result[0]).toBe("equipment_e101a");
      expect(result[2]).toBe("system_s200b");
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long entity names', () => {
      const longName = "Very Long Equipment Name With Many Words E101";
      const result = parser.parse(`${longName} is part of System S200`);
      expect(result[0]).toBe("very_long_equipment_name_with_many_words_e101");
    });

    test('should handle single character entities', () => {
      const result = parser.parse("A is part of B");
      expect(result).toEqual(["a", "gellish:1230", "b"]);
    });

    test('should prefer first relation when multiple exist', () => {
      const result = parser.parse("Pump contains water and is part of system");
      expect(result[1]).toBe("gellish:1331"); // Should find "contains" first
    });
  });
});
