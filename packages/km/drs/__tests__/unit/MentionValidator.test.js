/**
 * Unit tests for MentionValidator
 */
import { MentionValidator } from '../../src/validators/MentionValidator.js';
import { Mention } from '../../src/types/Mention.js';
import { Span } from '../../src/types/Span.js';

// Helper to create mock synset objects
function createMockSynset(label, synonyms = []) {
  return {
    label,
    synonyms: synonyms.length > 0 ? synonyms : [label.split('.')[0]],
    definition: `Mock definition for ${label}`,
    pos: 'n'
  };
}

describe('MentionValidator', () => {
  const text = 'The cat sat on the mat. Alice read a book.';
  const sentences = ['The cat sat on the mat.', 'Alice read a book.'];

  // Create mock synsets for testing
  const animalSynset = createMockSynset('animal.n.01', ['animal', 'creature']);
  const personSynset = createMockSynset('person.n.01', ['person', 'individual']);
  const thingSynset = createMockSynset('thing.n.01', ['thing', 'object']);

  let validator;

  beforeEach(() => {
    validator = new MentionValidator(text, sentences);
  });

  describe('valid mentions', () => {
    test('should validate correct mentions', () => {
      const mentions = [
        new Mention('m1', new Span(0, 7), 'The cat', 'cat', animalSynset, 0),
        new Mention('m2', new Span(24, 29), 'Alice', 'Alice', personSynset, 1)
      ];

      const result = validator.validate(mentions);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('span validation', () => {
    test('should reject span with start >= end', () => {
      const mentions = [
        new Mention('m1', new Span(5, 5), 'text', 'text', animalSynset, 0)
      ];

      const result = validator.validate(mentions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'mentions[0].span',
          message: expect.stringContaining('end must be > start')
        })
      );
    });

    test('should reject span with start < 0', () => {
      const mentions = [
        new Mention('m1', new Span(-1, 5), 'text', 'text', animalSynset, 0)
      ];

      const result = validator.validate(mentions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'mentions[0].span.start',
          message: expect.stringContaining('start must be >= 0')
        })
      );
    });

    test('should reject span beyond text bounds', () => {
      const mentions = [
        new Mention('m1', new Span(0, 1000), 'invalid', 'invalid', animalSynset, 0)
      ];

      const result = validator.validate(mentions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'mentions[0].span.end',
          message: expect.stringContaining('end must be within text bounds')
        })
      );
    });

    test('should reject span text not matching actual substring', () => {
      const mentions = [
        new Mention('m1', new Span(0, 7), 'Wrong text', 'cat', animalSynset, 0)
      ];

      const result = validator.validate(mentions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'mentions[0].text',
          message: expect.stringContaining('does not match')
        })
      );
    });
  });

  describe('type validation', () => {
    test('should reject type that is not a synset object', () => {
      const mentions = [
        new Mention('m1', new Span(0, 7), 'The cat', 'cat', 'INVALID_STRING', 0)
      ];

      const result = validator.validate(mentions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'mentions[0].coarseType',
          message: expect.stringContaining('must be a WordNet synset object')
        })
      );
    });

    test('should reject type object without synset structure', () => {
      const mentions = [
        new Mention('m1', new Span(0, 7), 'The cat', 'cat', {invalid: 'object'}, 0)
      ];

      const result = validator.validate(mentions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'mentions[0].coarseType',
          message: expect.stringContaining('must have \'label\' or \'synonyms\' property')
        })
      );
    });
  });

  describe('sentence validation', () => {
    test('should reject invalid sentenceId (negative)', () => {
      const mentions = [
        new Mention('m1', new Span(0, 7), 'The cat', 'cat', animalSynset, -1)
      ];

      const result = validator.validate(mentions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'mentions[0].sentenceId',
          message: expect.stringContaining('must be valid')
        })
      );
    });

    test('should reject invalid sentenceId (out of range)', () => {
      const mentions = [
        new Mention('m1', new Span(0, 7), 'The cat', 'cat', animalSynset, 999)
      ];

      const result = validator.validate(mentions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'mentions[0].sentenceId',
          message: expect.stringContaining('must be valid')
        })
      );
    });
  });

  describe('multiple errors', () => {
    test('should return all validation errors', () => {
      const mentions = [
        new Mention('m1', new Span(-1, 5), 'wrong', 'wrong', 'INVALID_STRING', -1),
        new Mention('m2', new Span(0, 7), 'Wrong text', 'cat', animalSynset, 0)
      ];

      const result = validator.validate(mentions);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  describe('empty array', () => {
    test('should validate empty mention array', () => {
      const result = validator.validate([]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
