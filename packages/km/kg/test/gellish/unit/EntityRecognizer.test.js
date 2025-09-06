import { describe, test, expect, beforeEach } from '@jest/globals';
import { GellishDictionary, EntityRecognizer } from '../../../src/gellish/index.js';

describe('EntityRecognizer', () => {
  let dictionary;
  let recognizer;

  beforeEach(() => {
    dictionary = new GellishDictionary();
    recognizer = new EntityRecognizer(dictionary);
  });

  describe('Basic Expression Recognition', () => {
    test('should recognize simple part-of expression', () => {
      const result = recognizer.recognize("Pump P101 is part of System S200");
      
      expect(result.leftObject).toEqual({
        text: "Pump P101",
        type: "individual",
        id: "pump_p101"
      });
      
      expect(result.relation).toEqual({
        text: "is part of",
        uid: 1230,
        startIndex: 2,
        endIndex: 5
      });
      
      expect(result.rightObject).toEqual({
        text: "System S200",
        type: "individual", 
        id: "system_s200"
      });
    });

    test('should recognize contains expression', () => {
      const result = recognizer.recognize("Tank T205 contains Water");
      
      expect(result.leftObject.text).toBe("Tank T205");
      expect(result.leftObject.type).toBe("individual");
      expect(result.leftObject.id).toBe("tank_t205");
      
      expect(result.relation.text).toBe("contains");
      expect(result.relation.uid).toBe(1331);
      
      expect(result.rightObject.text).toBe("Water");
      expect(result.rightObject.type).toBe("concept");
      expect(result.rightObject.id).toBe("water");
    });

    test('should recognize manufacturing expression', () => {
      const result = recognizer.recognize("Motor M301 is manufactured by Siemens");
      
      expect(result.leftObject.text).toBe("Motor M301");
      expect(result.relation.text).toBe("is manufactured by");
      expect(result.relation.uid).toBe(1267);
      expect(result.rightObject.text).toBe("Siemens");
      expect(result.rightObject.type).toBe("concept");
    });
  });

  describe('Entity Classification', () => {
    test('should classify individual objects correctly', () => {
      const entity1 = recognizer.extractEntity(["Pump", "P101"]);
      expect(entity1.type).toBe("individual");
      expect(entity1.id).toBe("pump_p101");
      
      const entity2 = recognizer.extractEntity(["System", "S200"]);
      expect(entity2.type).toBe("individual");
      expect(entity2.id).toBe("system_s200");
    });

    test('should classify person names correctly', () => {
      const entity = recognizer.extractEntity(["John", "Smith"]);
      expect(entity.type).toBe("person");
      expect(entity.id).toBe("john_smith");
    });

    test('should classify concepts correctly', () => {
      const entity1 = recognizer.extractEntity(["Water"]);
      expect(entity1.type).toBe("concept");
      expect(entity1.id).toBe("water");
      
      const entity2 = recognizer.extractEntity(["Siemens"]);
      expect(entity2.type).toBe("concept");
      expect(entity2.id).toBe("siemens");
    });
  });

  describe('Relation Phrase Detection', () => {
    test('should find single word relations', () => {
      const tokens = ["Tank", "contains", "Water"];
      const relation = recognizer.findRelationPhrase(tokens);
      
      expect(relation).toEqual({
        text: "contains",
        uid: 1331,
        startIndex: 1,
        endIndex: 2
      });
    });

    test('should find multi-word relations', () => {
      const tokens = ["Pump", "is", "part", "of", "System"];
      const relation = recognizer.findRelationPhrase(tokens);
      
      expect(relation).toEqual({
        text: "is part of",
        uid: 1230,
        startIndex: 1,
        endIndex: 4
      });
    });

    test('should find relations with synonyms', () => {
      const tokens = ["Component", "belongs", "to", "Assembly"];
      const relation = recognizer.findRelationPhrase(tokens);
      
      expect(relation.text).toBe("belongs to");
      expect(relation.uid).toBe(1230);
    });

    test('should return null for no relation found', () => {
      const tokens = ["This", "has", "no", "valid", "relation"];
      const relation = recognizer.findRelationPhrase(tokens);
      expect(relation).toBeNull();
    });
  });

  describe('Query Recognition', () => {
    test('should recognize basic what query', () => {
      const result = recognizer.recognizeQuery("What is part of System S200?");
      
      expect(result.questionWord).toEqual({
        text: "What",
        type: "variable"
      });
      
      expect(result.relation).toEqual({
        text: "is part of",
        uid: 1230,
        startIndex: 1,
        endIndex: 4
      });
      
      expect(result.object).toEqual({
        text: "System S200",
        type: "individual",
        id: "system_s200"
      });
    });

    test('should recognize which queries', () => {
      const result = recognizer.recognizeQuery("Which pumps are manufactured by Siemens?");
      
      expect(result.questionWord.text).toBe("Which pumps");
      expect(result.relation.text).toBe("are manufactured by");
      expect(result.object.text).toBe("Siemens");
    });

    test('should recognize who queries', () => {
      const result = recognizer.recognizeQuery("Who operates Motor M301?");
      
      expect(result.questionWord.text).toBe("Who");
      expect(result.relation.text).toBe("operates");
      expect(result.object.text).toBe("Motor M301");
    });

    test('should handle queries with no relation', () => {
      const result = recognizer.recognizeQuery("What is this thing?");
      expect(result.relation).toBeNull();
    });
  });

  describe('Tokenization', () => {
    test('should tokenize simple expressions', () => {
      const tokens = recognizer.tokenize("Pump P101 is part of System S200");
      expect(tokens).toEqual(["Pump", "P101", "is", "part", "of", "System", "S200"]);
    });

    test('should handle extra whitespace', () => {
      const tokens = recognizer.tokenize("  Pump   P101    is  part  of   System  S200  ");
      expect(tokens).toEqual(["Pump", "P101", "is", "part", "of", "System", "S200"]);
    });

    test('should handle empty strings', () => {
      const tokens = recognizer.tokenize("");
      expect(tokens).toEqual([]);
    });
  });

  describe('Entity ID Generation', () => {
    test('should generate consistent IDs', () => {
      const id1 = recognizer.generateEntityId("Pump P101");
      const id2 = recognizer.generateEntityId("Pump P101");
      expect(id1).toBe(id2);
      expect(id1).toBe("pump_p101");
    });

    test('should handle special characters', () => {
      const id = recognizer.generateEntityId("System-A/B");
      expect(id).toBe("system-a/b");
    });

    test('should handle multiple spaces', () => {
      const id = recognizer.generateEntityId("Big   System   Name");
      expect(id).toBe("big_system_name");
    });
  });

  describe('Edge Cases', () => {
    test('should handle expressions with no entities', () => {
      const result = recognizer.recognize("is part of");
      expect(result.leftObject).toBeNull();
      expect(result.rightObject).toBeNull();
    });

    test('should handle expressions with only one entity', () => {
      const result = recognizer.recognize("Pump P101 is part of");
      expect(result.leftObject).not.toBeNull();
      expect(result.rightObject).toBeNull();
    });

    test('should handle empty expressions', () => {
      const result = recognizer.recognize("");
      expect(result.leftObject).toBeNull();
      expect(result.relation).toBeNull();
      expect(result.rightObject).toBeNull();
    });

    test('should handle expressions with multiple relations', () => {
      // Should find the first valid relation
      const result = recognizer.recognize("Pump contains water and is part of system");
      expect(result.relation.text).toBe("contains");
    });
  });
});
