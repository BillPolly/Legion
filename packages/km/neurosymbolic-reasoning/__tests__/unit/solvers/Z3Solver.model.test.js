import { Z3Solver } from '../../../src/solvers/Z3Solver.js';

describe('Z3Solver - Model Extraction', () => {
  let solver;

  beforeEach(async () => {
    solver = new Z3Solver();
    await solver.initialize();
  }, 10000);

  describe('getModel()', () => {
    test('should return model after successful solve', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'eq', args: ['x', 42] }
        ],
        query: { type: 'check-sat' }
      };

      await solver.solve(program);
      const model = await solver.getModel();

      expect(model).toEqual({ x: '42' });
    }, 10000);

    test('should return empty model for unsat', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'gt', args: ['x', 10] },
          { type: 'lt', args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      };

      await solver.solve(program);
      const model = await solver.getModel();

      expect(model).toEqual({});
    }, 10000);

    test('should return model with multiple variables', async () => {
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

    test('should return model with different types', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' },
          { name: 'p', sort: 'Bool' }
        ],
        constraints: [
          { type: 'eq', args: ['x', 5] },
          { type: 'eq', args: ['p', true] }
        ],
        query: { type: 'check-sat' }
      };

      await solver.solve(program);
      const model = await solver.getModel();

      expect(model.x).toBe('5');
      expect(model.p).toBe('true');
    }, 10000);

    test('should throw if called before solve', async () => {
      await expect(solver.getModel()).rejects.toThrow('No model available');
    });
  });

  describe('checkSat()', () => {
    test('should check satisfiability of simple constraint', async () => {
      const constraints = [
        { type: 'gt', args: ['x', 5] }
      ];

      const variables = [
        { name: 'x', sort: 'Int' }
      ];

      const result = await solver.checkSat(constraints, variables);

      expect(result).toBe('sat');
    }, 10000);

    test('should detect unsatisfiable constraints', async () => {
      const constraints = [
        { type: 'gt', args: ['x', 10] },
        { type: 'lt', args: ['x', 5] }
      ];

      const variables = [
        { name: 'x', sort: 'Int' }
      ];

      const result = await solver.checkSat(constraints, variables);

      expect(result).toBe('unsat');
    }, 10000);

    test('should work with multiple constraints', async () => {
      const constraints = [
        { type: 'gt', args: ['x', 0] },
        { type: 'lt', args: ['x', 100] },
        { type: 'eq', args: ['y', 42] }
      ];

      const variables = [
        { name: 'x', sort: 'Int' },
        { name: 'y', sort: 'Int' }
      ];

      const result = await solver.checkSat(constraints, variables);

      expect(result).toBe('sat');
    }, 10000);
  });
});
