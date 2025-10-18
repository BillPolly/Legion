/**
 * Unit tests for RelationCategorizer
 *
 * Tests categorization of adverb synsets into relation types.
 * Per TDD approach: Write tests first, then implement minimum code to pass.
 */

import { RelationCategorizer } from '../../src/categorization/RelationCategorizer.js';

describe('RelationCategorizer', () => {
  let categorizer;

  beforeAll(() => {
    categorizer = new RelationCategorizer();
  });

  describe('categorizeRelationType - Spatial relations', () => {
    test('should categorize "in" as spatial', () => {
      const synset = {
        pos: 'r',
        synonyms: ['in', 'inside'],
        definition: 'to or toward the inside of',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('spatial');
    });

    test('should categorize "under" as spatial', () => {
      const synset = {
        pos: 'r',
        synonyms: ['under', 'below'],
        definition: 'in or to a place that is lower',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('spatial');
    });

    test('should categorize "above" as spatial', () => {
      const synset = {
        pos: 'r',
        synonyms: ['above', 'over'],
        definition: 'in or to a place that is higher',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('spatial');
    });

    test('should categorize "near" as spatial', () => {
      const synset = {
        pos: 'r',
        synonyms: ['near', 'close'],
        definition: 'at or within a short distance in space',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('spatial');
    });
  });

  describe('categorizeRelationType - Temporal relations', () => {
    test('should categorize "before" as temporal', () => {
      const synset = {
        pos: 'r',
        synonyms: ['before'],
        definition: 'at or in the front',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('temporal');
    });

    test('should categorize "after" as temporal', () => {
      const synset = {
        pos: 'r',
        synonyms: ['after'],
        definition: 'happening at a time subsequent to a reference time',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('temporal');
    });

    test('should categorize "during" as temporal', () => {
      const synset = {
        pos: 'r',
        synonyms: ['during'],
        definition: 'throughout the course or duration of',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('temporal');
    });

    test('should categorize "when" as temporal', () => {
      const synset = {
        pos: 'r',
        synonyms: ['when'],
        definition: 'at what time',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('temporal');
    });
  });

  describe('categorizeRelationType - Logical relations', () => {
    test('should categorize "because" as logical', () => {
      const synset = {
        pos: 'r',
        synonyms: ['because'],
        definition: 'for the reason that',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('logical');
    });

    test('should categorize "therefore" as logical', () => {
      const synset = {
        pos: 'r',
        synonyms: ['therefore', 'thus'],
        definition: 'as a consequence',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('logical');
    });

    test('should categorize "if" as logical', () => {
      const synset = {
        pos: 'r',
        synonyms: ['if'],
        definition: 'on the condition that',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('logical');
    });

    test('should categorize "unless" as logical', () => {
      const synset = {
        pos: 'r',
        synonyms: ['unless'],
        definition: 'except on the condition that',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('logical');
    });
  });

  describe('categorizeRelationType - Default fallback', () => {
    test('should use logical as fallback for unknown adverbs', () => {
      const synset = {
        pos: 'r',
        synonyms: ['somehow'],
        definition: 'in some unspecified way',
        lexicalFile: 'adv.all'
      };

      const category = categorizer.categorizeRelationType(synset);
      expect(category).toBe('logical');
    });
  });
});
