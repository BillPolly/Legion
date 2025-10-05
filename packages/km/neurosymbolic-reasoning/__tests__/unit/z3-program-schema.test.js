import { z3ProgramSchema, validateZ3Program } from '../../src/schemas/z3-program-schema.js';

describe('Z3 Program Schema', () => {
  describe('Valid Programs', () => {
    test('should validate a simple valid program', () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: {
          type: 'check-sat'
        }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(program);
    });

    test('should validate program with Bool variables', () => {
      const program = {
        variables: [
          { name: 'p', sort: 'Bool' },
          { name: 'q', sort: 'Bool' }
        ],
        constraints: [
          { type: 'or', args: ['p', 'q'] }
        ],
        query: {
          type: 'check-sat'
        }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(true);
    });

    test('should validate program with Real variables', () => {
      const program = {
        variables: [
          { name: 'r', sort: 'Real' }
        ],
        constraints: [
          { type: 'gt', args: ['r', 0.5] }
        ],
        query: {
          type: 'check-sat'
        }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(true);
    });

    test('should validate program with nested constraints', () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' },
          { name: 'y', sort: 'Int' }
        ],
        constraints: [
          {
            type: 'and',
            args: [
              { type: 'gt', args: ['x', 0] },
              { type: 'lt', args: ['y', 10] }
            ]
          }
        ],
        query: {
          type: 'check-sat'
        }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(true);
    });

    test('should validate program with optional assertions', () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'gt', args: ['x', 0] }
        ],
        assertions: [
          { expression: { type: 'lt', args: ['x', 100] } }
        ],
        query: {
          type: 'check-sat',
          goal: 'find value of x'
        }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(true);
    });

    test('should validate minimal program', () => {
      const program = {
        variables: [],
        constraints: [],
        query: {
          type: 'check-sat'
        }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Programs', () => {
    test('should reject program without variables', () => {
      const program = {
        constraints: [],
        query: { type: 'check-sat' }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject program without constraints', () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        query: { type: 'check-sat' }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(false);
    });

    test('should reject program without query', () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: []
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(false);
    });

    test('should reject variable with invalid sort', () => {
      const program = {
        variables: [
          { name: 'x', sort: 'InvalidSort' }
        ],
        constraints: [],
        query: { type: 'check-sat' }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(false);
    });

    test('should reject variable without name', () => {
      const program = {
        variables: [
          { sort: 'Int' }
        ],
        constraints: [],
        query: { type: 'check-sat' }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(false);
    });

    test('should reject constraint without type', () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(false);
    });

    test('should reject constraint without args', () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt' }
        ],
        query: { type: 'check-sat' }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(false);
    });

    test('should reject query without type', () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [],
        query: {}
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(false);
    });

    test('should reject non-object program', () => {
      const program = "not an object";

      const result = validateZ3Program(program);
      expect(result.success).toBe(false);
    });

    test('should reject null program', () => {
      const result = validateZ3Program(null);
      expect(result.success).toBe(false);
    });

    test('should reject array instead of object', () => {
      const result = validateZ3Program([]);
      expect(result.success).toBe(false);
    });
  });

  describe('Constraint Types', () => {
    const validConstraintTypes = [
      'gt', 'lt', 'ge', 'le', 'eq', 'ne',
      'and', 'or', 'not', 'implies',
      'add', 'sub', 'mul', 'div'
    ];

    validConstraintTypes.forEach(type => {
      test(`should accept constraint type: ${type}`, () => {
        const program = {
          variables: [{ name: 'x', sort: 'Int' }],
          constraints: [
            { type, args: ['x', 5] }
          ],
          query: { type: 'check-sat' }
        };

        const result = validateZ3Program(program);
        expect(result.success).toBe(true);
      });
    });

    test('should reject unknown constraint type', () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'unknown_operator', args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      };

      const result = validateZ3Program(program);
      expect(result.success).toBe(false);
    });
  });
});
