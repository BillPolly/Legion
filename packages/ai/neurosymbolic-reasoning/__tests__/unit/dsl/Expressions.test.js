import {
  ExpressionType,
  isValidExpressionType,
  parseExpression,
  validateExpression
} from '../../../src/dsl/Expressions.js';

describe('Expressions', () => {
  describe('ExpressionType', () => {
    test('should define comparison operators', () => {
      expect(ExpressionType.GT).toBe('gt');
      expect(ExpressionType.LT).toBe('lt');
      expect(ExpressionType.GE).toBe('ge');
      expect(ExpressionType.LE).toBe('le');
      expect(ExpressionType.EQ).toBe('eq');
      expect(ExpressionType.NE).toBe('ne');
    });

    test('should define logical operators', () => {
      expect(ExpressionType.AND).toBe('and');
      expect(ExpressionType.OR).toBe('or');
      expect(ExpressionType.NOT).toBe('not');
      expect(ExpressionType.IMPLIES).toBe('implies');
    });

    test('should define arithmetic operators', () => {
      expect(ExpressionType.ADD).toBe('add');
      expect(ExpressionType.SUB).toBe('sub');
      expect(ExpressionType.MUL).toBe('mul');
      expect(ExpressionType.DIV).toBe('div');
    });
  });

  describe('isValidExpressionType', () => {
    const validTypes = [
      'gt', 'lt', 'ge', 'le', 'eq', 'ne',
      'and', 'or', 'not', 'implies',
      'add', 'sub', 'mul', 'div'
    ];

    validTypes.forEach(type => {
      test(`should validate ${type}`, () => {
        expect(isValidExpressionType(type)).toBe(true);
      });
    });

    test('should reject invalid type', () => {
      expect(isValidExpressionType('invalid')).toBe(false);
    });

    test('should reject null', () => {
      expect(isValidExpressionType(null)).toBe(false);
    });

    test('should reject undefined', () => {
      expect(isValidExpressionType(undefined)).toBe(false);
    });
  });

  describe('validateExpression', () => {
    test('should validate simple comparison expression', () => {
      const expr = {
        type: 'gt',
        args: ['x', 5]
      };

      expect(validateExpression(expr)).toBe(true);
    });

    test('should validate logical expression', () => {
      const expr = {
        type: 'and',
        args: [
          { type: 'gt', args: ['x', 0] },
          { type: 'lt', args: ['x', 10] }
        ]
      };

      expect(validateExpression(expr)).toBe(true);
    });

    test('should validate nested expressions', () => {
      const expr = {
        type: 'or',
        args: [
          {
            type: 'and',
            args: [
              { type: 'gt', args: ['x', 0] },
              { type: 'lt', args: ['x', 5] }
            ]
          },
          {
            type: 'and',
            args: [
              { type: 'gt', args: ['x', 5] },
              { type: 'lt', args: ['x', 10] }
            ]
          }
        ]
      };

      expect(validateExpression(expr)).toBe(true);
    });

    test('should reject expression without type', () => {
      const expr = {
        args: ['x', 5]
      };

      expect(validateExpression(expr)).toBe(false);
    });

    test('should reject expression without args', () => {
      const expr = {
        type: 'gt'
      };

      expect(validateExpression(expr)).toBe(false);
    });

    test('should reject expression with invalid type', () => {
      const expr = {
        type: 'invalid',
        args: ['x', 5]
      };

      expect(validateExpression(expr)).toBe(false);
    });

    test('should reject expression with empty args', () => {
      const expr = {
        type: 'gt',
        args: []
      };

      expect(validateExpression(expr)).toBe(false);
    });

    test('should reject null', () => {
      expect(validateExpression(null)).toBe(false);
    });

    test('should reject non-object', () => {
      expect(validateExpression('not an object')).toBe(false);
    });
  });

  describe('parseExpression', () => {
    test('should parse simple comparison', () => {
      const expr = {
        type: 'gt',
        args: ['x', 5]
      };

      const parsed = parseExpression(expr);

      expect(parsed).toEqual({
        type: 'gt',
        operator: '>',
        args: ['x', 5]
      });
    });

    test('should parse all comparison operators', () => {
      const operators = {
        'gt': '>',
        'lt': '<',
        'ge': '>=',
        'le': '<=',
        'eq': '==',
        'ne': '!='
      };

      Object.entries(operators).forEach(([type, operator]) => {
        const expr = { type, args: ['x', 5] };
        const parsed = parseExpression(expr);
        expect(parsed.operator).toBe(operator);
      });
    });

    test('should parse logical operators', () => {
      const operators = {
        'and': 'AND',
        'or': 'OR',
        'not': 'NOT',
        'implies': '=>'
      };

      Object.entries(operators).forEach(([type, operator]) => {
        const expr = { type, args: ['p', 'q'] };
        const parsed = parseExpression(expr);
        expect(parsed.operator).toBe(operator);
      });
    });

    test('should parse arithmetic operators', () => {
      const operators = {
        'add': '+',
        'sub': '-',
        'mul': '*',
        'div': '/'
      };

      Object.entries(operators).forEach(([type, operator]) => {
        const expr = { type, args: ['x', 5] };
        const parsed = parseExpression(expr);
        expect(parsed.operator).toBe(operator);
      });
    });

    test('should parse nested expressions', () => {
      const expr = {
        type: 'and',
        args: [
          { type: 'gt', args: ['x', 0] },
          { type: 'lt', args: ['x', 10] }
        ]
      };

      const parsed = parseExpression(expr);

      expect(parsed.type).toBe('and');
      expect(parsed.operator).toBe('AND');
      expect(parsed.args).toHaveLength(2);
      expect(parsed.args[0].type).toBe('gt');
      expect(parsed.args[1].type).toBe('lt');
    });

    test('should throw on invalid expression', () => {
      const expr = { type: 'invalid', args: ['x', 5] };

      expect(() => parseExpression(expr)).toThrow('Invalid expression type');
    });

    test('should throw on missing args', () => {
      const expr = { type: 'gt' };

      expect(() => parseExpression(expr)).toThrow();
    });
  });
});
