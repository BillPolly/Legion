/**
 * Unit tests for QueryInterpreter
 */

import { QueryInterpreter } from '../QueryInterpreter.js';

describe('QueryInterpreter', () => {
  const mockFacts = {
    ':ups': {
      ':name': 'ups',
      ':performance': {
        '2004': 100,
        '2009': 75.95
      }
    },
    ':sp500': {
      ':name': 'sp500',
      ':performance': {
        '2004': 100,
        '2009': 102.11
      }
    }
  };

  describe('constructor', () => {
    test('should require facts parameter', () => {
      expect(() => new QueryInterpreter()).toThrow('Facts structure is required');
    });

    test('should create interpreter with facts', () => {
      const interpreter = new QueryInterpreter(mockFacts);
      expect(interpreter.facts).toBe(mockFacts);
    });
  });

  describe('interpret - operations', () => {
    test('should interpret operation query with entity extraction', () => {
      const interpreter = new QueryInterpreter(mockFacts);

      const skeleton = {
        operations: [{
          type: 'subtract',
          attribute: 'performance',
          fromYear: '2004',
          toYear: '2009',
          format: 'absolute',
          npMods: [
            ['pp', 'in', {
              Head: 'performance',
              Mods: [
                ['pp', 'of', {
                  Head: { Name: 'United Parcel Service Inc.' },
                  Mods: []
                }]
              ]
            }],
            ['pp', 'from', { Head: '2004', Mods: [] }],
            ['pp', 'to', { Head: '2009', Mods: [] }]
          ]
        }]
      };

      const result = interpreter.interpret(skeleton);

      expect(result.type).toBe('operation');
      expect(result.entity).toBe('ups');
      expect(result.attribute).toBe('performance');
      expect(result.fromYear).toBe('2004');
      expect(result.toYear).toBe('2009');
      expect(result.operationType).toBe('subtract');
      expect(result.format).toBe('absolute');
      expect(result.error).toBeUndefined();
    });

    test('should normalize S&P 500 entity name', () => {
      const interpreter = new QueryInterpreter(mockFacts);

      const skeleton = {
        operations: [{
          type: 'subtract',
          attribute: 'performance',
          fromYear: '2004',
          toYear: '2009',
          npMods: [
            ['pp', 'in', {
              Head: 'performance',
              Mods: [
                ['pp', 'of', {
                  Head: { Name: 'S&P 500 Index' },
                  Mods: []
                }]
              ]
            }]
          ]
        }]
      };

      const result = interpreter.interpret(skeleton);

      expect(result.entity).toBe('sp500');
      expect(result.error).toBeUndefined();
    });

    test('should handle missing entity', () => {
      const interpreter = new QueryInterpreter(mockFacts);

      const skeleton = {
        operations: [{
          type: 'subtract',
          attribute: 'performance',
          fromYear: '2004',
          toYear: '2009',
          npMods: []  // No entity in mods
        }]
      };

      const result = interpreter.interpret(skeleton);

      expect(result.type).toBe('operation');
      expect(result.entity).toBeNull();
      expect(result.error).toContain('Could not extract entity');
    });

    test('should handle unknown entity', () => {
      const interpreter = new QueryInterpreter(mockFacts);

      const skeleton = {
        operations: [{
          type: 'subtract',
          attribute: 'performance',
          fromYear: '2004',
          toYear: '2009',
          npMods: [
            ['pp', 'in', {
              Head: 'performance',
              Mods: [
                ['pp', 'of', {
                  Head: { Name: 'Unknown Company' },
                  Mods: []
                }]
              ]
            }]
          ]
        }]
      };

      const result = interpreter.interpret(skeleton);

      expect(result.type).toBe('operation');
      expect(result.entity).toBe('unknown_company');
      expect(result.error).toContain('not found in facts');
    });

    test('should default attribute to performance if not provided', () => {
      const interpreter = new QueryInterpreter(mockFacts);

      const skeleton = {
        operations: [{
          type: 'subtract',
          fromYear: '2004',
          toYear: '2009',
          npMods: [
            ['pp', 'in', {
              Head: 'performance',
              Mods: [
                ['pp', 'of', {
                  Head: { Name: 'UPS' },
                  Mods: []
                }]
              ]
            }]
          ]
        }]
      };

      const result = interpreter.interpret(skeleton);

      expect(result.attribute).toBe('performance');
    });
  });

  describe('_normalizeEntityName', () => {
    let interpreter;

    beforeEach(() => {
      interpreter = new QueryInterpreter(mockFacts);
    });

    test('should normalize UPS variations', () => {
      expect(interpreter._normalizeEntityName('United Parcel Service Inc.')).toBe('ups');
      expect(interpreter._normalizeEntityName('United Parcel Service')).toBe('ups');
      expect(interpreter._normalizeEntityName('UPS')).toBe('ups');
      expect(interpreter._normalizeEntityName('ups')).toBe('ups');
    });

    test('should normalize S&P 500 variations', () => {
      expect(interpreter._normalizeEntityName('S&P 500 Index')).toBe('sp500');
      expect(interpreter._normalizeEntityName('S&P 500')).toBe('sp500');
      expect(interpreter._normalizeEntityName('SP500')).toBe('sp500');
      expect(interpreter._normalizeEntityName('s&p500')).toBe('sp500');
    });

    test('should normalize Dow Jones Transport', () => {
      expect(interpreter._normalizeEntityName('Dow Jones Transport Average')).toBe('dj_transport');
      expect(interpreter._normalizeEntityName('Dow Jones Transportation Index')).toBe('dj_transport');
    });

    test('should handle generic entity names', () => {
      expect(interpreter._normalizeEntityName('Apple Inc.')).toBe('apple_inc');
      expect(interpreter._normalizeEntityName('Microsoft Corporation')).toBe('microsoft_corporation');
    });
  });
});
