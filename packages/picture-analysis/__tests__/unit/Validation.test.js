import { describe, test, expect } from '@jest/globals';
import { 
  InputSchema,
  validateInputParameters,
  validateFilePath,
  validatePrompt
} from '../../src/utils/validation.js';

describe('Input Validation', () => {
  describe('InputSchema (Zod)', () => {
    test('accepts valid input parameters', () => {
      const validInput = {
        file_path: '/path/to/image.png',
        prompt: 'Describe what you see in this image'
      };
      
      const result = InputSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    test('rejects missing file_path', () => {
      const invalidInput = {
        prompt: 'Describe what you see in this image'
      };
      
      expect(() => InputSchema.parse(invalidInput)).toThrow();
    });

    test('rejects missing prompt', () => {
      const invalidInput = {
        file_path: '/path/to/image.png'
      };
      
      expect(() => InputSchema.parse(invalidInput)).toThrow();
    });

    test('rejects empty file_path', () => {
      const invalidInput = {
        file_path: '',
        prompt: 'Describe what you see in this image'
      };
      
      expect(() => InputSchema.parse(invalidInput)).toThrow();
    });

    test('rejects short prompt (less than 10 characters)', () => {
      const invalidInput = {
        file_path: '/path/to/image.png',
        prompt: 'short'
      };
      
      expect(() => InputSchema.parse(invalidInput)).toThrow();
    });

    test('rejects long prompt (more than 2000 characters)', () => {
      const longPrompt = 'a'.repeat(2001);
      const invalidInput = {
        file_path: '/path/to/image.png',
        prompt: longPrompt
      };
      
      expect(() => InputSchema.parse(invalidInput)).toThrow();
    });

    test('accepts prompt at minimum length (10 characters)', () => {
      const validInput = {
        file_path: '/path/to/image.png',
        prompt: '1234567890' // exactly 10 characters
      };
      
      const result = InputSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    test('accepts prompt at maximum length (2000 characters)', () => {
      const maxPrompt = 'a'.repeat(2000);
      const validInput = {
        file_path: '/path/to/image.png',
        prompt: maxPrompt
      };
      
      const result = InputSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });
  });

  describe('validateInputParameters', () => {
    test('validates correct input parameters', () => {
      const input = {
        file_path: '/path/to/image.png',
        prompt: 'Describe what you see in this image'
      };
      
      expect(() => validateInputParameters(input)).not.toThrow();
    });

    test('throws error for invalid input', () => {
      const input = {
        file_path: '',
        prompt: 'short'
      };
      
      expect(() => validateInputParameters(input)).toThrow();
    });

    test('returns parsed and validated input', () => {
      const input = {
        file_path: '/path/to/image.png',
        prompt: 'Describe what you see in this image'
      };
      
      const result = validateInputParameters(input);
      expect(result).toEqual(input);
    });
  });

  describe('validateFilePath', () => {
    test('accepts non-empty file paths', () => {
      expect(() => validateFilePath('/path/to/image.png')).not.toThrow();
      expect(() => validateFilePath('relative/path.jpg')).not.toThrow();
      expect(() => validateFilePath('image.gif')).not.toThrow();
    });

    test('rejects empty file paths', () => {
      expect(() => validateFilePath('')).toThrow('File path is required');
    });

    test('rejects null or undefined file paths', () => {
      expect(() => validateFilePath(null)).toThrow();
      expect(() => validateFilePath(undefined)).toThrow();
    });

    test('rejects non-string file paths', () => {
      expect(() => validateFilePath(123)).toThrow();
      expect(() => validateFilePath({})).toThrow();
      expect(() => validateFilePath([])).toThrow();
    });
  });

  describe('validatePrompt', () => {
    test('accepts valid prompts', () => {
      expect(() => validatePrompt('Describe this image in detail')).not.toThrow();
      expect(() => validatePrompt('What do you see?')).not.toThrow();
    });

    test('rejects short prompts', () => {
      expect(() => validatePrompt('short')).toThrow('Prompt must be at least 10 characters');
      expect(() => validatePrompt('123456789')).toThrow('Prompt must be at least 10 characters');
    });

    test('rejects long prompts', () => {
      const longPrompt = 'a'.repeat(2001);
      expect(() => validatePrompt(longPrompt)).toThrow('Prompt must not exceed 2000 characters');
    });

    test('rejects empty prompts', () => {
      expect(() => validatePrompt('')).toThrow('Prompt must be at least 10 characters');
    });

    test('rejects null or undefined prompts', () => {
      expect(() => validatePrompt(null)).toThrow();
      expect(() => validatePrompt(undefined)).toThrow();
    });

    test('accepts boundary values', () => {
      const minPrompt = '1234567890'; // exactly 10 chars
      const maxPrompt = 'a'.repeat(2000); // exactly 2000 chars
      
      expect(() => validatePrompt(minPrompt)).not.toThrow();
      expect(() => validatePrompt(maxPrompt)).not.toThrow();
    });
  });
});