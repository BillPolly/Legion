/**
 * Unit tests for error classes
 */
import { ValidationError } from '../../src/errors/ValidationError.js';

describe('ValidationError', () => {
  test('should create a ValidationError with stage and errors', () => {
    const errors = [
      { path: 'mentions[0].span.start', message: 'start must be >= 0' },
      { path: 'mentions[0].span.end', message: 'end must be > start' }
    ];

    const error = new ValidationError('Stage1_MentionExtraction', errors);

    expect(error.name).toBe('ValidationError');
    expect(error.stage).toBe('Stage1_MentionExtraction');
    expect(error.errors).toEqual(errors);
    expect(error.message).toBe('Validation failed in Stage1_MentionExtraction');
    expect(error.originalOutput).toBeNull();
  });

  test('should create a ValidationError with original output', () => {
    const errors = [{ path: 'test', message: 'test error' }];
    const originalOutput = { mentions: [] };

    const error = new ValidationError('Stage1', errors, originalOutput);

    expect(error.originalOutput).toEqual(originalOutput);
  });

  test('should be instanceof Error', () => {
    const error = new ValidationError('Stage1', []);
    expect(error instanceof Error).toBe(true);
  });
});
