/**
 * Unit tests for DRSToText utility
 *
 * Tests deterministic DRS-to-Text conversion.
 * NO LLM - purely template-based rendering.
 */
import { DRSToText } from '../../src/utils/DRSToText.js';
import { ClausalDRS } from '../../src/types/ClausalDRS.js';

describe('DRSToText', () => {
  let converter;

  beforeAll(() => {
    converter = new DRSToText();
  });

  test('should convert simple entity and event', () => {
    const drs = new ClausalDRS(
      ['x1', 'e1'],
      [
        { pred: 'person', args: ['x1'] },
        { pred: 'read', args: ['e1'] },
        { rel: 'Agent', args: ['e1', 'x1'] }
      ]
    );

    const result = converter.generateParaphrase(drs);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.toLowerCase()).toContain('person');
    expect(result.toLowerCase()).toContain('read');
  });

  test('should convert entity with type and event with roles', () => {
    const drs = new ClausalDRS(
      ['x1', 'x2', 'e1'],
      [
        { pred: 'student', args: ['x1'] },
        { pred: 'book', args: ['x2'] },
        { pred: 'read', args: ['e1'] },
        { rel: 'Agent', args: ['e1', 'x1'] },
        { rel: 'Theme', args: ['e1', 'x2'] }
      ]
    );

    const result = converter.generateParaphrase(drs);

    expect(result).toBeTruthy();
    expect(result.toLowerCase()).toContain('student');
    expect(result.toLowerCase()).toContain('book');
    expect(result.toLowerCase()).toContain('read');
  });

  test('should convert universal quantifier', () => {
    const drs = new ClausalDRS(
      ['x1', 'x2', 'e1'],
      [
        { rel: 'Every', args: ['x1', 'S1', 'S2'] },
        { pred: 'student', args: ['x1'] },
        { pred: 'book', args: ['x2'] },
        { pred: 'read', args: ['e1'] },
        { rel: 'Agent', args: ['e1', 'x1'] },
        { rel: 'Theme', args: ['e1', 'x2'] }
      ]
    );

    const result = converter.generateParaphrase(drs);

    expect(result).toBeTruthy();
    expect(result.toLowerCase()).toContain('every');
    expect(result.toLowerCase()).toContain('student');
  });

  test('should convert existential quantifier', () => {
    const drs = new ClausalDRS(
      ['x1', 'e1'],
      [
        { rel: 'Some', args: ['x1', 'S1'] },
        { pred: 'book', args: ['x1'] },
        { pred: 'read', args: ['e1'] },
        { rel: 'Theme', args: ['e1', 'x1'] }
      ]
    );

    const result = converter.generateParaphrase(drs);

    expect(result).toBeTruthy();
    expect(result.toLowerCase()).toMatch(/a|some/);
    expect(result.toLowerCase()).toContain('book');
  });

  test('should convert negation', () => {
    const drs = new ClausalDRS(
      ['x1', 'e1'],
      [
        { pred: 'person', args: ['x1'] },
        { rel: 'Not', args: ['S1'] },
        { pred: 'run', args: ['e1'] },
        { rel: 'Agent', args: ['e1', 'x1'] }
      ]
    );

    const result = converter.generateParaphrase(drs);

    expect(result).toBeTruthy();
    expect(result.toLowerCase()).toMatch(/not|does not|doesn't/);
    expect(result.toLowerCase()).toContain('run');
  });

  test('should convert conditional (implication)', () => {
    const drs = new ClausalDRS(
      ['x1', 'x2', 'e1', 'e2'],
      [
        { rel: 'Imp', args: ['S1', 'S2'] },
        { pred: 'person', args: ['x1'] },
        { pred: 'run', args: ['e1'] },
        { rel: 'Agent', args: ['e1', 'x1'] },
        { pred: 'person', args: ['x2'] },
        { pred: 'read', args: ['e2'] },
        { rel: 'Agent', args: ['e2', 'x2'] }
      ]
    );

    const result = converter.generateParaphrase(drs);

    expect(result).toBeTruthy();
    expect(result.toLowerCase()).toMatch(/if|then/);
  });

  test('should convert disjunction (or)', () => {
    const drs = new ClausalDRS(
      ['x1', 'e1', 'e2'],
      [
        { pred: 'person', args: ['x1'] },
        { rel: 'Or', args: ['S1', 'S2'] },
        { pred: 'run', args: ['e1'] },
        { rel: 'Agent', args: ['e1', 'x1'] },
        { pred: 'walk', args: ['e2'] },
        { rel: 'Agent', args: ['e2', 'x1'] }
      ]
    );

    const result = converter.generateParaphrase(drs);

    expect(result).toBeTruthy();
    expect(result.toLowerCase()).toContain('or');
  });

  test('should handle empty DRS', () => {
    const drs = new ClausalDRS([], []);

    const result = converter.generateParaphrase(drs);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  test('should handle unary facts (attributes)', () => {
    const drs = new ClausalDRS(
      ['x1'],
      [
        { pred: 'person', args: ['x1'] },
        { pred: 'tall', args: ['x1'] },
        { pred: 'happy', args: ['x1'] }
      ]
    );

    const result = converter.generateParaphrase(drs);

    expect(result).toBeTruthy();
    expect(result.toLowerCase()).toContain('person');
  });

  test('should handle binary relations', () => {
    const drs = new ClausalDRS(
      ['x1', 'x2'],
      [
        { pred: 'person', args: ['x1'] },
        { pred: 'person', args: ['x2'] },
        { rel: 'knows', args: ['x1', 'x2'] }
      ]
    );

    const result = converter.generateParaphrase(drs);

    expect(result).toBeTruthy();
    expect(result.toLowerCase()).toContain('person');
  });
});
