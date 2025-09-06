import { describe, test, expect, beforeEach } from '@jest/globals';
import { GellishDictionary } from '../../../src/gellish/index.js';

describe('GellishDictionary', () => {
  let dictionary;

  beforeEach(() => {
    dictionary = new GellishDictionary();
  });

  describe('Basic Relation Lookup', () => {
    test('should find relation by phrase', () => {
      const uid = dictionary.findRelation("is part of");
      expect(uid).toBe(1230);
    });

    test('should find relation by inverse phrase', () => {
      const uid = dictionary.findRelation("consists of");
      expect(uid).toBe(1230);
    });

    test('should handle case insensitive lookup', () => {
      const uid = dictionary.findRelation("IS PART OF");
      expect(uid).toBe(1230);
    });

    test('should handle extra whitespace', () => {
      const uid = dictionary.findRelation("  is part of  ");
      expect(uid).toBe(1230);
    });

    test('should return null for unknown relation', () => {
      const uid = dictionary.findRelation("unknown relation");
      expect(uid).toBeNull();
    });
  });

  describe('Relation by UID', () => {
    test('should get relation by UID', () => {
      const relation = dictionary.getRelationByUid(1230);
      expect(relation).toEqual({
        phrase: "is part of",
        inverse: "consists of",
        synonyms: ["is a part of", "belongs to", "are part of"],
        domain: "compositional"
      });
    });

    test('should return null for unknown UID', () => {
      const relation = dictionary.getRelationByUid(9999);
      expect(relation).toBeNull();
    });
  });

  describe('Synonyms Support', () => {
    test('should handle synonyms', () => {
      const uid = dictionary.findRelation("belongs to");
      expect(uid).toBe(1230);
    });

    test('should handle multiple synonyms', () => {
      const uid1 = dictionary.findRelation("is a part of");
      const uid2 = dictionary.findRelation("belongs to");
      expect(uid1).toBe(1230);
      expect(uid2).toBe(1230);
    });
  });

  describe('Core Relations', () => {
    test('should support contains relation', () => {
      const uid = dictionary.findRelation("contains");
      expect(uid).toBe(1331);
      
      const relation = dictionary.getRelationByUid(1331);
      expect(relation.phrase).toBe("contains");
      expect(relation.inverse).toBe("is contained in");
    });

    test('should support is connected to relation', () => {
      const uid = dictionary.findRelation("is connected to");
      expect(uid).toBe(1456);
    });

    test('should support is manufactured by relation', () => {
      const uid = dictionary.findRelation("is manufactured by");
      expect(uid).toBe(1267);
    });

    test('should support is a specialization of relation', () => {
      const uid = dictionary.findRelation("is a specialization of");
      expect(uid).toBe(1225);
    });
  });

  describe('Dictionary Statistics', () => {
    test('should have at least 20 core relations', () => {
      expect(dictionary.relations.size).toBeGreaterThanOrEqual(20);
    });

    test('should have phrase index built', () => {
      expect(dictionary.phraseToUid.size).toBeGreaterThan(0);
    });
  });

  describe('Phrase Normalization', () => {
    test('should normalize phrases consistently', () => {
      const normalized1 = dictionary.normalizePhrase("  IS PART OF  ");
      const normalized2 = dictionary.normalizePhrase("is part of");
      expect(normalized1).toBe(normalized2);
      expect(normalized1).toBe("is part of");
    });

    test('should handle multiple spaces', () => {
      const normalized = dictionary.normalizePhrase("is    part    of");
      expect(normalized).toBe("is part of");
    });
  });
});
