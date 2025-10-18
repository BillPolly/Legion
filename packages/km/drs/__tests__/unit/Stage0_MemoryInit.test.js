/**
 * Unit tests for Stage0_MemoryInit
 */
import { Stage0_MemoryInit } from '../../src/stages/Stage0_MemoryInit.js';
import { DiscourseMemory } from '../../src/types/DiscourseMemory.js';

describe('Stage0_MemoryInit', () => {
  let stage;

  beforeEach(() => {
    stage = new Stage0_MemoryInit();
  });

  describe('process', () => {
    test('should create DiscourseMemory from simple text', () => {
      const text = 'The cat sat on the mat.';
      const result = stage.process(text);

      expect(result).toBeInstanceOf(DiscourseMemory);
      expect(result.text).toBe(text);
      expect(result.sentences).toEqual(['The cat sat on the mat.']);
      expect(result.mentions).toEqual([]);
      expect(result.entities).toEqual([]);
      expect(result.events).toEqual([]);
      expect(result.unaryFacts).toEqual([]);
      expect(result.binaryFacts).toEqual([]);
    });

    test('should handle multiple sentences', () => {
      const text = 'Alice reads. Bob writes. Carol thinks.';
      const result = stage.process(text);

      expect(result.text).toBe(text);
      expect(result.sentences).toEqual([
        'Alice reads.',
        'Bob writes.',
        'Carol thinks.'
      ]);
      expect(result.mentions).toEqual([]);
      expect(result.entities).toEqual([]);
      expect(result.events).toEqual([]);
    });

    test('should handle empty text', () => {
      const text = '';
      const result = stage.process(text);

      expect(result.text).toBe('');
      expect(result.sentences).toEqual([]);
    });

    test('should handle text with only whitespace', () => {
      const text = '   ';
      const result = stage.process(text);

      expect(result.text).toBe(text);
      expect(result.sentences).toEqual([]);
    });

    test('should preserve original text', () => {
      const text = 'Alice met Bob.  They talked.';
      const result = stage.process(text);

      expect(result.text).toBe(text);
      expect(result.sentences).toEqual([
        'Alice met Bob.',
        'They talked.'
      ]);
    });

    test('should handle longer discourse', () => {
      const text = 'Alice met Bob. They talked for hours. Then they went home. It was a good day.';
      const result = stage.process(text);

      expect(result.text).toBe(text);
      expect(result.sentences).toHaveLength(4);
      expect(result.sentences[0]).toBe('Alice met Bob.');
      expect(result.sentences[3]).toBe('It was a good day.');
    });
  });

  describe('returns empty arrays', () => {
    test('should initialize with empty mention array', () => {
      const text = 'Test sentence.';
      const result = stage.process(text);

      expect(Array.isArray(result.mentions)).toBe(true);
      expect(result.mentions.length).toBe(0);
    });

    test('should initialize with empty entity array', () => {
      const text = 'Test sentence.';
      const result = stage.process(text);

      expect(Array.isArray(result.entities)).toBe(true);
      expect(result.entities.length).toBe(0);
    });

    test('should initialize with empty events array', () => {
      const text = 'Test sentence.';
      const result = stage.process(text);

      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBe(0);
    });

    test('should initialize with empty facts arrays', () => {
      const text = 'Test sentence.';
      const result = stage.process(text);

      expect(Array.isArray(result.unaryFacts)).toBe(true);
      expect(result.unaryFacts.length).toBe(0);
      expect(Array.isArray(result.binaryFacts)).toBe(true);
      expect(result.binaryFacts.length).toBe(0);
    });
  });
});
