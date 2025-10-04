/**
 * Z3Solver Integration Tests
 * Tests with REAL Z3 WASM solver - NO MOCKS
 */
import { Z3Solver } from '../../src/solvers/Z3Solver.js';

describe('Z3Solver Integration (Real Z3 WASM)', () => {
  let solver;

  beforeAll(async () => {
    solver = new Z3Solver();
    await solver.initialize();
  }, 15000);

  describe('Int Constraint Solving', () => {
    test('should solve range constraint: 5 < x < 10', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      const x = parseInt(result.model.x);
      expect(x).toBeGreaterThan(5);
      expect(x).toBeLessThan(10);
      expect(result.proof.length).toBeGreaterThan(0);
    }, 10000);

    test('should detect impossible constraint: x > 10 AND x < 5', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 10] },
          { type: 'lt', args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('unsat');
      expect(result.model).toEqual({});
    }, 10000);

    test('should solve exact value: x == 42', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'eq', args: ['x', 42] }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model.x).toBe('42');
    }, 10000);
  });

  describe('Bool Constraint Solving', () => {
    test('should solve: p OR q', async () => {
      const program = {
        variables: [
          { name: 'p', sort: 'Bool' },
          { name: 'q', sort: 'Bool' }
        ],
        constraints: [
          { type: 'or', args: ['p', 'q'] }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model.p === 'true' || result.model.q === 'true').toBe(true);
    }, 10000);

    test('should solve: p AND NOT q', async () => {
      const program = {
        variables: [
          { name: 'p', sort: 'Bool' },
          { name: 'q', sort: 'Bool' }
        ],
        constraints: [
          { type: 'eq', args: ['p', true] },
          { type: 'eq', args: ['q', false] }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model.p).toBe('true');
      expect(result.model.q).toBe('false');
    }, 10000);
  });

  describe('Real Number Constraint Solving', () => {
    test('should solve: 0.5 < r < 1.5', async () => {
      const program = {
        variables: [{ name: 'r', sort: 'Real' }],
        constraints: [
          { type: 'gt', args: ['r', 0.5] },
          { type: 'lt', args: ['r', 1.5] }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model.r).toBeDefined();
    }, 10000);
  });

  describe('Complex Constraint Combinations', () => {
    test('should solve: (x > 0 AND x < 5) OR (x > 5 AND x < 10)', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          {
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
          }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      const x = parseInt(result.model.x);
      const valid = (x > 0 && x < 5) || (x > 5 && x < 10);
      expect(valid).toBe(true);
    }, 10000);

    test('should solve with multiple variables and relationships', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' },
          { name: 'y', sort: 'Int' },
          { name: 'z', sort: 'Int' }
        ],
        constraints: [
          { type: 'gt', args: ['x', 0] },
          { type: 'lt', args: ['y', 100] },
          { type: 'lt', args: ['x', 'y'] },
          { type: 'eq', args: ['z', 'x'] }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      const x = parseInt(result.model.x);
      const y = parseInt(result.model.y);
      const z = parseInt(result.model.z);

      expect(x).toBeGreaterThan(0);
      expect(y).toBeLessThan(100);
      expect(x).toBeLessThan(y);
      expect(z).toBe(x);
    }, 10000);
  });

  describe('Model and Proof Extraction', () => {
    test('should extract model after solving', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' },
          { name: 'y', sort: 'Int' }
        ],
        constraints: [
          { type: 'eq', args: ['x', 10] },
          { type: 'eq', args: ['y', 20] }
        ],
        query: { type: 'check-sat' }
      };

      await solver.solve(program);
      const model = await solver.getModel();

      expect(model).toEqual({ x: '10', y: '20' });
    }, 10000);

    test('should extract proof with constraint descriptions', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      };

      await solver.solve(program);
      const proof = await solver.getProof();

      expect(proof.length).toBe(3); // 2 constraints + 1 conclusion
      expect(proof[0].description).toBe('x > 5');
      expect(proof[1].description).toBe('x < 10');
      expect(proof[2].type).toBe('conclusion');
      expect(proof[2].result).toBe('sat');
    }, 10000);
  });

  describe('Quick Satisfiability Checks', () => {
    test('should quickly check if constraints are satisfiable', async () => {
      const constraints = [
        { type: 'gt', args: ['x', 0] },
        { type: 'lt', args: ['x', 100] }
      ];
      const variables = [{ name: 'x', sort: 'Int' }];

      const result = await solver.checkSat(constraints, variables);

      expect(result).toBe('sat');
    }, 10000);

    test('should quickly detect unsatisfiable constraints', async () => {
      const constraints = [
        { type: 'gt', args: ['x', 100] },
        { type: 'lt', args: ['x', 0] }
      ];
      const variables = [{ name: 'x', sort: 'Int' }];

      const result = await solver.checkSat(constraints, variables);

      expect(result).toBe('unsat');
    }, 10000);
  });

  describe('Edge Cases', () => {
    test('should handle empty program', async () => {
      const program = {
        variables: [],
        constraints: [],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model).toEqual({});
    }, 10000);

    test('should handle program with no constraints', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model.x).toBeDefined();
    }, 10000);
  });
});
