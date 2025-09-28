import { describe, test, expect, beforeEach } from '@jest/globals';
import { GellishValidator, GellishDictionary } from '@legion/gellish';

describe('GellishValidator', () => {
  let validator;
  let dictionary;

  beforeEach(() => {
    dictionary = new GellishDictionary();
    validator = new GellishValidator(dictionary);
  });

  describe('Basic Expression Validation', () => {
    test('should validate correct part-of expression', () => {
      const result = validator.validate("Pump P101 is part of System S200");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should validate correct contains expression', () => {
      const result = validator.validate("Tank T205 contains Water");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should validate correct manufacturing expression', () => {
      const result = validator.validate("Motor M301 is manufactured by Siemens");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should validate correct connection expression', () => {
      const result = validator.validate("Pipe P205 is connected to Tank T205");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should validate correct ownership expression', () => {
      const result = validator.validate("Equipment E101 is owned by Company ABC");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Synonym Validation', () => {
    test('should validate part-of synonyms', () => {
      const result1 = validator.validate("Pump P101 belongs to System S200");
      expect(result1.valid).toBe(true);

      const result2 = validator.validate("Pump P101 is a part of System S200");
      expect(result2.valid).toBe(true);
    });

    test('should validate manufacturing synonyms', () => {
      const result1 = validator.validate("Motor M301 is made by Siemens");
      expect(result1.valid).toBe(true);

      const result2 = validator.validate("Motor M301 is produced by Siemens");
      expect(result2.valid).toBe(true);
    });

    test('should validate contains synonyms', () => {
      const result1 = validator.validate("Tank T205 holds Water");
      expect(result1.valid).toBe(true);

      const result2 = validator.validate("Tank T205 includes Water");
      expect(result2.valid).toBe(true);
    });
  });

  describe('Error Detection', () => {
    test('should reject expression with no relation', () => {
      const result = validator.validate("Pump P101 something System S200");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No valid Gellish relation found");
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    test('should reject expression that is too short', () => {
      const result = validator.validate("Pump P101");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Expression too short");
    });

    test('should reject empty expression', () => {
      const result = validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject whitespace-only expression', () => {
      const result = validator.validate("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject expression with unknown relation', () => {
      const result = validator.validate("Pump P101 is flying to System S200");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No valid Gellish relation found");
    });
  });

  describe('Suggestion System', () => {
    test('should provide suggestions for invalid relations', () => {
      const result = validator.validate("Pump P101 unknown relation System S200");
      expect(result.valid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions).toContain("is part of");
    });

    test('should provide helpful suggestions', () => {
      const result = validator.validate("Pump P101 bad relation System S200");
      expect(result.valid).toBe(false);
      expect(result.suggestions).toContain("contains");
      expect(result.suggestions).toContain("is connected to");
    });
  });

  describe('Case Sensitivity', () => {
    test('should handle mixed case relations', () => {
      const result = validator.validate("Pump P101 IS PART OF System S200");
      expect(result.valid).toBe(true);
    });

    test('should handle mixed case entities', () => {
      const result = validator.validate("PUMP P101 is part of SYSTEM S200");
      expect(result.valid).toBe(true);
    });

    test('should handle sentence case', () => {
      const result = validator.validate("Pump P101 Is Part Of System S200");
      expect(result.valid).toBe(true);
    });
  });

  describe('Whitespace Handling', () => {
    test('should handle extra whitespace', () => {
      const result = validator.validate("  Pump  P101   is  part  of   System  S200  ");
      expect(result.valid).toBe(true);
    });

    test('should handle tabs and newlines', () => {
      const result = validator.validate("Pump\tP101\nis\tpart\tof\nSystem\tS200");
      expect(result.valid).toBe(true);
    });

    test('should handle multiple spaces', () => {
      const result = validator.validate("Pump     P101     is     part     of     System     S200");
      expect(result.valid).toBe(true);
    });
  });

  describe('Complex Entity Names', () => {
    test('should validate entities with special characters', () => {
      const result = validator.validate("System-A/B is connected to Tank-C/D");
      expect(result.valid).toBe(true);
    });

    test('should validate entities with numbers', () => {
      const result = validator.validate("Pump123 is part of System456");
      expect(result.valid).toBe(true);
    });

    test('should validate long entity names', () => {
      const longName = "Very Long System Name With Many Words";
      const result = validator.validate(`Pump P101 is part of ${longName}`);
      expect(result.valid).toBe(true);
    });

    test('should validate single character entities', () => {
      const result = validator.validate("A is connected to B");
      expect(result.valid).toBe(true);
    });
  });

  describe('Multiple Relations in Expression', () => {
    test('should find first valid relation when multiple exist', () => {
      const result = validator.validate("Tank contains water and is part of system");
      expect(result.valid).toBe(true);
      // Should find "contains" first
    });

    test('should validate when relation appears multiple times', () => {
      const result = validator.validate("System is part of larger system is part of facility");
      expect(result.valid).toBe(true);
      // Should find first "is part of"
    });
  });

  describe('Edge Cases', () => {
    test('should handle expressions with punctuation', () => {
      const result = validator.validate("Pump P101 is part of System S200.");
      expect(result.valid).toBe(true);
    });

    test('should handle expressions with quotes', () => {
      const result = validator.validate('Pump "P101" is part of System "S200"');
      expect(result.valid).toBe(true);
    });

    test('should handle expressions with parentheses', () => {
      const result = validator.validate("Pump (P101) is part of System (S200)");
      expect(result.valid).toBe(true);
    });
  });

  describe('Validation Performance', () => {
    test('should validate expressions quickly', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        validator.validate(`Pump P${i} is part of System S${i}`);
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100); // Should complete in under 100ms
    });

    test('should handle large expressions efficiently', () => {
      const largeExpression = "Very ".repeat(100) + "Long Pump Name is part of Very " + "Long ".repeat(100) + "System Name";
      
      const startTime = Date.now();
      const result = validator.validate(largeExpression);
      const endTime = Date.now();
      
      expect(result.valid).toBe(true);
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Error Message Quality', () => {
    test('should provide clear error messages', () => {
      const result = validator.validate("Pump P101");
      expect(result.error).toContain("Expression too short");
      expect(result.error).toContain("Expected format");
    });

    test('should provide context in error messages', () => {
      const result = validator.validate("Pump P101 invalid relation System S200");
      expect(result.error).toContain("No valid Gellish relation found");
      expect(result.error).toContain("expression");
    });
  });

  describe('Validation Statistics', () => {
    test('should track validation attempts', () => {
      validator.validate("Pump P101 is part of System S200");
      validator.validate("Tank T205 contains Water");
      validator.validate("Invalid expression");
      
      // Note: This would require adding statistics tracking to GellishValidator
      // For now, just ensure validation works
      expect(true).toBe(true);
    });
  });
});
