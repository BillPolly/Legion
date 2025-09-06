import { describe, test, expect, beforeEach } from '@jest/globals';
import { GellishDictionary, EntityRecognizer, GellishQueryParser } from '../../../src/gellish/index.js';

describe('GellishQueryParser', () => {
  let dictionary;
  let entityRecognizer;
  let queryParser;

  beforeEach(() => {
    dictionary = new GellishDictionary();
    entityRecognizer = new EntityRecognizer(dictionary);
    queryParser = new GellishQueryParser(dictionary, entityRecognizer);
  });

  describe('Basic Query Parsing', () => {
    test('should parse simple what query', () => {
      const result = queryParser.parseQuery("What is part of System S200?");
      expect(result).toEqual([null, "gellish:1230", "system_s200"]);
    });

    test('should parse contains query', () => {
      const result = queryParser.parseQuery("What contains Water?");
      expect(result).toEqual([null, "gellish:1331", "water"]);
    });

    test('should parse manufacturing query', () => {
      const result = queryParser.parseQuery("What is manufactured by Siemens?");
      expect(result).toEqual([null, "gellish:1267", "siemens"]);
    });

    test('should parse connection query', () => {
      const result = queryParser.parseQuery("What is connected to Tank T205?");
      expect(result).toEqual([null, "gellish:1456", "tank_t205"]);
    });

    test('should parse ownership query', () => {
      const result = queryParser.parseQuery("What is owned by Company ABC?");
      expect(result).toEqual([null, "gellish:1200", "company_abc"]);
    });
  });

  describe('Inverse Query Patterns', () => {
    test('should parse inverse part-of query', () => {
      const result = queryParser.parseQuery("System S200 consists of what?");
      expect(result).toEqual(["system_s200", "gellish:1230", null]);
    });

    test('should parse inverse contains query', () => {
      const result = queryParser.parseQuery("Tank T205 contains what?");
      expect(result).toEqual(["tank_t205", "gellish:1331", null]);
    });

    test('should parse inverse manufacturing query', () => {
      const result = queryParser.parseQuery("Siemens manufactures what?");
      expect(result).toEqual(["siemens", "gellish:1267", null]);
    });
  });

  describe('Type-Filtered Queries', () => {
    test('should parse which pumps query', () => {
      const result = queryParser.parseTypeFilteredQuery("Which pumps are part of System S200?");
      expect(result).toEqual({
        type: 'type-filtered',
        basePattern: [null, "gellish:1230", "system_s200"],
        entityType: "Pump",
        originalQuery: "Which pumps are part of System S200?"
      });
    });

    test('should parse which tanks query', () => {
      const result = queryParser.parseTypeFilteredQuery("Which tanks contain Water?");
      expect(result).toEqual({
        type: 'type-filtered',
        basePattern: [null, "gellish:1331", "water"],
        entityType: "Tank",
        originalQuery: "Which tanks contain Water?"
      });
    });

    test('should parse which motors query', () => {
      const result = queryParser.parseTypeFilteredQuery("Which motors are manufactured by Siemens?");
      expect(result).toEqual({
        type: 'type-filtered',
        basePattern: [null, "gellish:1267", "siemens"],
        entityType: "Motor",
        originalQuery: "Which motors are manufactured by Siemens?"
      });
    });

    test('should parse which systems query', () => {
      const result = queryParser.parseTypeFilteredQuery("Which systems are operated by John Smith?");
      expect(result).toEqual({
        type: 'type-filtered',
        basePattern: [null, "gellish:1201", "john_smith"],
        entityType: "System",
        originalQuery: "Which systems are operated by John Smith?"
      });
    });
  });

  describe('Who Queries', () => {
    test('should parse who operates query', () => {
      const result = queryParser.parseQuery("Who operates System S200?");
      expect(result).toEqual([null, "gellish:1201", "system_s200"]);
    });

    test('should parse who owns query', () => {
      const result = queryParser.parseQuery("Who owns Equipment E101?");
      expect(result).toEqual([null, "gellish:1200", "equipment_e101"]);
    });

    test('should parse who manufactures query', () => {
      const result = queryParser.parseQuery("Who manufactures Pump P101?");
      expect(result).toEqual([null, "gellish:1267", "pump_p101"]);
    });
  });

  describe('Question Word Recognition', () => {
    test('should recognize what questions', () => {
      const result = queryParser.parseQuery("What is part of System S200?");
      expect(result[0]).toBe(null); // Variable position
      expect(result[1]).toBe("gellish:1230");
      expect(result[2]).toBe("system_s200");
    });

    test('should recognize which questions', () => {
      const result = queryParser.parseTypeFilteredQuery("Which pumps are part of System S200?");
      expect(result.type).toBe('type-filtered');
      expect(result.entityType).toBe("Pump");
    });

    test('should recognize who questions', () => {
      const result = queryParser.parseQuery("Who operates System S200?");
      expect(result[0]).toBe(null); // Variable position
      expect(result[1]).toBe("gellish:1201");
      expect(result[2]).toBe("system_s200");
    });
  });

  describe('Synonym Handling in Queries', () => {
    test('should handle part-of synonyms in queries', () => {
      const result1 = queryParser.parseQuery("What belongs to System S200?");
      expect(result1).toEqual([null, "gellish:1230", "system_s200"]);

      const result2 = queryParser.parseQuery("What is a part of System S200?");
      expect(result2).toEqual([null, "gellish:1230", "system_s200"]);
    });

    test('should handle manufacturing synonyms in queries', () => {
      const result1 = queryParser.parseQuery("What is made by Siemens?");
      expect(result1).toEqual([null, "gellish:1267", "siemens"]);

      const result2 = queryParser.parseQuery("What is produced by Siemens?");
      expect(result2).toEqual([null, "gellish:1267", "siemens"]);
    });

    test('should handle contains synonyms in queries', () => {
      const result1 = queryParser.parseQuery("What holds Water?");
      expect(result1).toEqual([null, "gellish:1331", "water"]);

      const result2 = queryParser.parseQuery("What includes Water?");
      expect(result2).toEqual([null, "gellish:1331", "water"]);
    });
  });

  describe('Case Sensitivity in Queries', () => {
    test('should handle mixed case question words', () => {
      const result = queryParser.parseQuery("WHAT is part of System S200?");
      expect(result).toEqual([null, "gellish:1230", "system_s200"]);
    });

    test('should handle mixed case relations', () => {
      const result = queryParser.parseQuery("What IS PART OF System S200?");
      expect(result).toEqual([null, "gellish:1230", "system_s200"]);
    });

    test('should handle mixed case entities', () => {
      const result = queryParser.parseQuery("What is part of SYSTEM S200?");
      expect(result).toEqual([null, "gellish:1230", "system_s200"]);
    });
  });

  describe('Whitespace Handling in Queries', () => {
    test('should handle extra whitespace', () => {
      const result = queryParser.parseQuery("  What   is  part  of   System  S200  ?  ");
      expect(result).toEqual([null, "gellish:1230", "system_s200"]);
    });

    test('should handle tabs and newlines', () => {
      const result = queryParser.parseQuery("What\tis\npart\tof\nSystem\tS200?");
      expect(result).toEqual([null, "gellish:1230", "system_s200"]);
    });
  });

  describe('Complex Entity Names in Queries', () => {
    test('should handle entities with special characters', () => {
      const result = queryParser.parseQuery("What is connected to System-A/B?");
      expect(result).toEqual([null, "gellish:1456", "system-a/b"]);
    });

    test('should handle long entity names', () => {
      const longName = "Very Long System Name With Many Words S200";
      const result = queryParser.parseQuery(`What is part of ${longName}?`);
      expect(result[2]).toBe("very_long_system_name_with_many_words_s200");
    });
  });

  describe('Error Handling', () => {
    test('should throw error for query with no relation', () => {
      expect(() => {
        queryParser.parseQuery("What something System S200?");
      }).toThrow("Could not parse query");
    });

    test('should throw error for query with no question word', () => {
      expect(() => {
        queryParser.parseQuery("is part of System S200?");
      }).toThrow("Could not parse query");
    });

    test('should throw error for empty query', () => {
      expect(() => {
        queryParser.parseQuery("");
      }).toThrow("Could not parse query");
    });

    test('should throw error for whitespace-only query', () => {
      expect(() => {
        queryParser.parseQuery("   ");
      }).toThrow("Could not parse query");
    });

    test('should throw error for invalid type-filtered query', () => {
      expect(() => {
        queryParser.parseTypeFilteredQuery("What pumps are part of System S200?");
      }).toThrow("Could not parse type-filtered query");
    });
  });

  describe('Edge Cases', () => {
    test('should handle single character entities in queries', () => {
      const result = queryParser.parseQuery("What is part of A?");
      expect(result).toEqual([null, "gellish:1230", "a"]);
    });

    test('should handle queries with multiple relations', () => {
      // Should find the first relation
      const result = queryParser.parseQuery("What contains water and is part of system?");
      expect(result[1]).toBe("gellish:1331"); // Should find "contains" first
    });

    test('should handle queries without question mark', () => {
      const result = queryParser.parseQuery("What is part of System S200");
      expect(result).toEqual([null, "gellish:1230", "system_s200"]);
    });
  });

  describe('Query Pattern Validation', () => {
    test('should validate basic query structure', () => {
      const result = queryParser.parseQuery("What is part of System S200?");
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(null); // Variable
      expect(typeof result[1]).toBe('string'); // Predicate
      expect(typeof result[2]).toBe('string'); // Object
    });

    test('should validate type-filtered query structure', () => {
      const result = queryParser.parseTypeFilteredQuery("Which pumps are part of System S200?");
      expect(result.type).toBe('type-filtered');
      expect(Array.isArray(result.basePattern)).toBe(true);
      expect(typeof result.entityType).toBe('string');
      expect(typeof result.originalQuery).toBe('string');
    });
  });
});
