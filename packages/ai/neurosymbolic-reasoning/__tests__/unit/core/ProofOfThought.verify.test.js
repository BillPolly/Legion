import { ProofOfThought } from '../../../src/core/ProofOfThought.js';

describe('ProofOfThought - verify()', () => {
  test('should verify valid claim', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'eq', args: ['x', 10] },
          { type: 'gt', args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.verify(
      'x is valid',
      ['x = 10'],
      ['x > 5']
    );

    expect(result.valid).toBe(true);
    expect(result.proof).toBeDefined();
    expect(result.violations).toEqual([]);
  });

  test('should detect invalid claim', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'eq', args: ['x', 3] },
          { type: 'gt', args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.verify(
      'x satisfies constraint',
      ['x = 3'],
      ['x > 5']
    );

    expect(result.valid).toBe(false);
    expect(result.violations).toBeDefined();
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('should include proof for verification', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'p', sort: 'Bool' }],
        constraints: [{ type: 'eq', args: ['p', true] }],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.verify('p is true', ['p = true'], []);

    expect(result.proof).toBeDefined();
    expect(Array.isArray(result.proof)).toBe(true);
  });

  test('should handle empty facts and constraints', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [],
        constraints: [],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.verify('always true', [], []);

    expect(result).toBeDefined();
    expect(result.valid).toBeDefined();
  });

  test('should return model when valid', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [{ type: 'eq', args: ['x', 7] }],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.verify('x = 7', [], []);

    expect(result.model).toBeDefined();
  });

  test('should throw on program generation failure', async () => {
    const mockLLM = {
      complete: async () => '{ invalid }'
    };

    const pot = new ProofOfThought(mockLLM);

    await expect(pot.verify('claim', [], [])).rejects.toThrow('Failed to generate verification program');
  });
});
