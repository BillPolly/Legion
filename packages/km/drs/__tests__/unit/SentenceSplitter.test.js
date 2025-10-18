/**
 * Unit tests for SentenceSplitter
 */
import { SentenceSplitter } from '../../src/utils/SentenceSplitter.js';

describe('SentenceSplitter', () => {
  let splitter;

  beforeEach(() => {
    splitter = new SentenceSplitter();
  });

  describe('simple sentences', () => {
    test('should split single sentence', () => {
      const text = 'The cat sat on the mat.';
      const result = splitter.split(text);

      expect(result).toEqual(['The cat sat on the mat.']);
    });

    test('should split multiple sentences', () => {
      const text = 'Alice reads. Bob writes. Carol thinks.';
      const result = splitter.split(text);

      expect(result).toEqual([
        'Alice reads.',
        'Bob writes.',
        'Carol thinks.'
      ]);
    });

    test('should handle text with multiple spaces', () => {
      const text = 'First sentence.  Second sentence.';
      const result = splitter.split(text);

      expect(result).toEqual([
        'First sentence.',
        'Second sentence.'
      ]);
    });
  });

  describe('complex sentences', () => {
    test('should handle question marks', () => {
      const text = 'Who are you? I am Alice.';
      const result = splitter.split(text);

      expect(result).toEqual([
        'Who are you?',
        'I am Alice.'
      ]);
    });

    test('should handle exclamation marks', () => {
      const text = 'Stop! Go away!';
      const result = splitter.split(text);

      expect(result).toEqual([
        'Stop!',
        'Go away!'
      ]);
    });

    test('should handle multiple abbreviations in sentence', () => {
      // Note: Perfect abbreviation handling requires NLP libraries
      // This test verifies basic functionality with abbreviations mid-sentence
      const text = 'He is from the U.S.A. today. She lives in N.Y. City.';
      const result = splitter.split(text);

      expect(result).toEqual([
        'He is from the U.S.A. today.',
        'She lives in N.Y. City.'
      ]);
    });
  });

  describe('edge cases', () => {
    test('should handle empty string', () => {
      const text = '';
      const result = splitter.split(text);

      expect(result).toEqual([]);
    });

    test('should handle text with only whitespace', () => {
      const text = '   ';
      const result = splitter.split(text);

      expect(result).toEqual([]);
    });

    test('should handle text without sentence terminators', () => {
      const text = 'No terminator here';
      const result = splitter.split(text);

      expect(result).toEqual(['No terminator here']);
    });

    test('should handle newlines', () => {
      const text = 'First line.\nSecond line.';
      const result = splitter.split(text);

      expect(result).toEqual([
        'First line.',
        'Second line.'
      ]);
    });
  });

  describe('multi-sentence text', () => {
    test('should handle longer text', () => {
      const text = 'Alice met Bob. They talked for hours. Then they went home. It was a good day.';
      const result = splitter.split(text);

      expect(result).toEqual([
        'Alice met Bob.',
        'They talked for hours.',
        'Then they went home.',
        'It was a good day.'
      ]);
    });
  });
});
