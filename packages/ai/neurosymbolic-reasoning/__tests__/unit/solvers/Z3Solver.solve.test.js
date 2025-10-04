import { Z3Solver } from '../../../src/solvers/Z3Solver.js';

describe('Z3Solver - Basic Constraint Solving', () => {
  let solver;

  beforeEach(async () => {
    solver = new Z3Solver();
    await solver.initialize();
  }, 10000);

  describe('Simple Int Constraints', () => {
    test('should solve: x > 5 AND x < 10', async () => {
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

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model).toBeDefined();
      expect(result.model.x).toBeDefined();

      const xValue = parseInt(result.model.x);
      expect(xValue).toBeGreaterThan(5);
      expect(xValue).toBeLessThan(10);
    }, 10000);

    test('should detect unsatisfiable: x > 10 AND x < 5', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'gt', args: ['x', 10] },
          { type: 'lt', args: ['x', 5] }
        ],
        query: {
          type: 'check-sat'
        }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('unsat');
    }, 10000);

    test('should solve with equality: x == 42', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'eq', args: ['x', 42] }
        ],
        query: {
          type: 'check-sat'
        }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(parseInt(result.model.x)).toBe(42);
    }, 10000);

    test('should solve with >=: x >= 5', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'ge', args: ['x', 5] },
          { type: 'lt', args: ['x', 6] }
        ],
        query: {
          type: 'check-sat'
        }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(parseInt(result.model.x)).toBe(5);
    }, 10000);

    test('should solve with <=: x <= 5', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'le', args: ['x', 5] },
          { type: 'gt', args: ['x', 4] }
        ],
        query: {
          type: 'check-sat'
        }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(parseInt(result.model.x)).toBe(5);
    }, 10000);
  });

  describe('Bool Constraints', () => {
    test('should solve: p OR q', async () => {
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

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model).toBeDefined();
      // At least one must be true
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
        query: {
          type: 'check-sat'
        }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model.p).toBe('true');
      expect(result.model.q).toBe('false');
    }, 10000);
  });

  describe('Real Constraints', () => {
    test('should solve: r > 0.5 AND r < 1.5', async () => {
      const program = {
        variables: [
          { name: 'r', sort: 'Real' }
        ],
        constraints: [
          { type: 'gt', args: ['r', 0.5] },
          { type: 'lt', args: ['r', 1.5] }
        ],
        query: {
          type: 'check-sat'
        }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model.r).toBeDefined();
    }, 10000);
  });

  describe('Multiple Variables', () => {
    test('should solve with two variables: x > 0 AND y < 10 AND x < y', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' },
          { name: 'y', sort: 'Int' }
        ],
        constraints: [
          { type: 'gt', args: ['x', 0] },
          { type: 'lt', args: ['y', 10] },
          { type: 'lt', args: ['x', 'y'] }
        ],
        query: {
          type: 'check-sat'
        }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      const xValue = parseInt(result.model.x);
      const yValue = parseInt(result.model.y);

      expect(xValue).toBeGreaterThan(0);
      expect(yValue).toBeLessThan(10);
      expect(xValue).toBeLessThan(yValue);
    }, 10000);
  });

  describe('No Variables (Tautology/Contradiction)', () => {
    test('should handle empty program (always sat)', async () => {
      const program = {
        variables: [],
        constraints: [],
        query: {
          type: 'check-sat'
        }
      };

      const result = await solver.solve(program);

      expect(result.result).toBe('sat');
      expect(result.model).toEqual({});
    }, 10000);
  });
});
