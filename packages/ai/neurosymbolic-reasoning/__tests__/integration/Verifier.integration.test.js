import { Verifier } from '../../src/reasoning/Verifier.js';
import { Z3Solver } from '../../src/solvers/Z3Solver.js';

describe('Verifier Integration (Real Z3)', () => {
  let solver;
  let verifier;

  beforeAll(async () => {
    // Initialize real Z3 solver (NO MOCKS)
    solver = new Z3Solver();
    await solver.initialize();
    verifier = new Verifier(solver);
  });

  describe('Solution Verification', () => {
    test('should verify valid solution for simple constraints', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      };

      const validSolution = { x: 7 };

      const result = await verifier.verify(validSolution, program);

      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.proof).toBeDefined();
      expect(result.proof.length).toBeGreaterThan(0);
    });

    test('should detect invalid solution violating constraints', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      };

      const invalidSolution = { x: 15 };  // Violates x < 10

      const result = await verifier.verify(invalidSolution, program);

      expect(result.valid).toBe(false);
      expect(result.violations).toBeDefined();
      expect(result.violations.length).toBeGreaterThan(0);
    });

    test('should verify solution with boolean constraints', async () => {
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

      const validSolution = { p: true, q: false };

      const result = await verifier.verify(validSolution, program);

      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    test('should verify solution with multiple variables', async () => {
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
        query: { type: 'check-sat' }
      };

      const validSolution = { x: 3, y: 7 };

      const result = await verifier.verify(validSolution, program);

      expect(result.valid).toBe(true);
    });

    test('should handle real number constraints', async () => {
      const program = {
        variables: [{ name: 'r', sort: 'Real' }],
        constraints: [
          { type: 'gt', args: ['r', 0.5] },
          { type: 'lt', args: ['r', 1.5] }
        ],
        query: { type: 'check-sat' }
      };

      const validSolution = { r: 1.0 };

      const result = await verifier.verify(validSolution, program);

      expect(result.valid).toBe(true);
    });
  });

  describe('Proof Extraction', () => {
    test('should extract proof from Z3 solution', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      };

      // First solve to get a proof
      await solver.solve(program);

      // Extract the proof
      const proof = await verifier.extractProof();

      expect(proof).toBeDefined();
      expect(Array.isArray(proof)).toBe(true);
      expect(proof.length).toBeGreaterThan(0);

      // Verify proof structure
      expect(proof[0]).toHaveProperty('step');
      expect(proof[0]).toHaveProperty('description');
    });

    test('should number proof steps sequentially', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] },
          { type: 'ge', args: ['x', 6] }
        ],
        query: { type: 'check-sat' }
      };

      await solver.solve(program);
      const proof = await verifier.extractProof();

      // Verify sequential numbering
      for (let i = 0; i < proof.length; i++) {
        expect(proof[i].step).toBe(i + 1);
      }
    });
  });

  describe('Proof Explanation', () => {
    test('should generate human-readable explanation', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);
      const explanation = verifier.explainProof(result.proof);

      expect(typeof explanation).toBe('string');
      expect(explanation.length).toBeGreaterThan(0);
      expect(explanation).toContain('Step 1');
      expect(explanation).toContain('Step 2');
      expect(explanation).toContain('>');
      expect(explanation).toContain('<');
    });

    test('should include solution in explanation for satisfiable result', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'eq', args: ['x', 42] }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);
      const explanation = verifier.explainProof(result.proof);

      expect(explanation).toContain('Solution');
      expect(explanation).toContain('42');
    });

    test('should indicate unsatisfiable for unsat result', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 10] },
          { type: 'lt', args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      };

      const result = await solver.solve(program);
      const explanation = verifier.explainProof(result.proof);

      expect(explanation).toContain('unsat');
    });
  });

  describe('Constraint Violations', () => {
    test('should detect when solution violates single constraint', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      };

      const invalidSolution = { x: 3 };  // Violates x > 5

      const result = await verifier.verify(invalidSolution, program);

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    test('should detect when solution violates multiple constraints', async () => {
      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] },
          { type: 'ne', args: ['x', 7] }
        ],
        query: { type: 'check-sat' }
      };

      const invalidSolution = { x: 20 };  // Violates x < 10

      const result = await verifier.verify(invalidSolution, program);

      expect(result.valid).toBe(false);
    });
  });
});
