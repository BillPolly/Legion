import { Z3Solver } from '../../../src/solvers/Z3Solver.js';

describe('Z3Solver - Proof Extraction', () => {
  let solver;

  beforeEach(async () => {
    solver = new Z3Solver();
    await solver.initialize();
  }, 10000);

  describe('getProof()', () => {
    test('should return proof after successful solve', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      };

      await solver.solve(program);
      const proof = await solver.getProof();

      expect(Array.isArray(proof)).toBe(true);
      expect(proof.length).toBeGreaterThan(0);
    }, 10000);

    test('should include constraint steps', async () => {
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
      const proof = await solver.getProof();

      expect(proof.length).toBeGreaterThanOrEqual(1);
      expect(proof[0]).toHaveProperty('step');
      expect(proof[0]).toHaveProperty('type');
      expect(proof[0]).toHaveProperty('description');
    }, 10000);

    test('should include result in proof', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'gt', args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      };

      await solver.solve(program);
      const proof = await solver.getProof();

      const conclusionStep = proof[proof.length - 1];
      expect(conclusionStep.type).toBe('conclusion');
      expect(conclusionStep.description).toContain('sat');
    }, 10000);

    test('should show unsat in proof for unsatisfiable', async () => {
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
      const proof = await solver.getProof();

      const conclusionStep = proof[proof.length - 1];
      expect(conclusionStep.type).toBe('conclusion');
      expect(conclusionStep.description).toContain('unsat');
    }, 10000);

    test('should number steps sequentially', async () => {
      const program = {
        variables: [
          { name: 'x', sort: 'Int' }
        ],
        constraints: [
          { type: 'gt', args: ['x', 0] },
          { type: 'lt', args: ['x', 100] }
        ],
        query: { type: 'check-sat' }
      };

      await solver.solve(program);
      const proof = await solver.getProof();

      for (let i = 0; i < proof.length; i++) {
        expect(proof[i].step).toBe(i + 1);
      }
    }, 10000);

    test('should throw if called before solve', async () => {
      await expect(solver.getProof()).rejects.toThrow('No proof available');
    });

    test('should include model in proof for sat result', async () => {
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
      const proof = await solver.getProof();

      const conclusionStep = proof.find(s => s.type === 'conclusion');
      expect(conclusionStep.model).toBeDefined();
      expect(conclusionStep.model.x).toBe('42');
    }, 10000);
  });
});
