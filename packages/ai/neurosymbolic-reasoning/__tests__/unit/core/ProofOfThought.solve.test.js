import { ProofOfThought } from '../../../src/core/ProofOfThought.js';

describe('ProofOfThought - solve()', () => {
  test('should find solution satisfying constraints', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.solve('x', ['x > 5', 'x < 10'], []);

    expect(result.satisfiable).toBe(true);
    expect(result.solution).toBeDefined();
    expect(result.model).toBeDefined();
  });

  test('should detect unsatisfiable constraints', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 10] },
          { type: 'lt', args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.solve('x', ['x > 10', 'x < 5'], []);

    expect(result.satisfiable).toBe(false);
  });

  test('should include proof steps', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [{ type: 'eq', args: ['x', 42] }],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.solve('x', ['x = 42'], []);

    expect(result.proof).toBeDefined();
    expect(Array.isArray(result.proof)).toBe(true);
    expect(result.proof.length).toBeGreaterThan(0);
  });

  test('should handle facts in solving', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'x', sort: 'Int' }, { name: 'y', sort: 'Int' }],
        constraints: [
          { type: 'eq', args: ['y', 10] },
          { type: 'lt', args: ['x', 'y'] }
        ],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.solve('x', ['x < y'], ['y = 10']);

    expect(result).toBeDefined();
  });

  test('should return model with variable assignments', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [
          { name: 'x', sort: 'Int' },
          { name: 'y', sort: 'Int' }
        ],
        constraints: [
          { type: 'eq', args: ['x', 5] },
          { type: 'eq', args: ['y', 7] }
        ],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.solve('x and y', ['x = 5', 'y = 7'], []);

    expect(result.model).toBeDefined();
    expect(typeof result.model).toBe('object');
  });

  test('should handle empty constraints', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.solve('x', [], []);

    expect(result.satisfiable).toBe(true);
  });

  test('should throw on program generation failure', async () => {
    const mockLLM = {
      complete: async () => 'not valid json'
    };

    const pot = new ProofOfThought(mockLLM);

    await expect(pot.solve('x', [], [])).rejects.toThrow('Failed to generate solving program');
  });
});
