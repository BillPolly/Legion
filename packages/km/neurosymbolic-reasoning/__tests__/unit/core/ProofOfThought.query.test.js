import { ProofOfThought } from '../../../src/core/ProofOfThought.js';

describe('ProofOfThought - query()', () => {
  test('should answer simple question', async () => {
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
    const result = await pot.query('Is there a number between 5 and 10?');

    expect(result.answer).toBeDefined();
    expect(['Yes', 'No']).toContain(result.answer);
    expect(result.proof).toBeDefined();
    expect(result.confidence).toBeDefined();
    expect(result.explanation).toBeDefined();
  });

  test('should include proof steps', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [{ type: 'gt', args: ['x', 5] }],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.query('Is x > 5?');

    expect(Array.isArray(result.proof)).toBe(true);
    expect(result.proof.length).toBeGreaterThan(0);
    expect(result.proof[0]).toHaveProperty('step');
    expect(result.proof[0]).toHaveProperty('description');
  });

  test('should provide confidence score', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'p', sort: 'Bool' }],
        constraints: [{ type: 'eq', args: ['p', true] }],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.query('Is p true?');

    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('should include human-readable explanation', async () => {
    const mockLLM = {
      complete: async () => JSON.stringify({
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [{ type: 'eq', args: ['x', 42] }],
        query: { type: 'check-sat' }
      })
    };

    const pot = new ProofOfThought(mockLLM);
    const result = await pot.query('What is x?');

    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  test('should handle unsatisfiable constraints', async () => {
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
    const result = await pot.query('Can x be > 10 and < 5?');

    expect(result.answer).toBe('No');
    expect(result.proof).toBeDefined();
  });

  test('should pass context to generator', async () => {
    let capturedContext;
    const mockLLM = {
      complete: async (prompt) => {
        capturedContext = prompt;
        return JSON.stringify({
          variables: [{ name: 'x', sort: 'Int' }],
          constraints: [],
          query: { type: 'check-sat' }
        });
      }
    };

    const pot = new ProofOfThought(mockLLM);
    await pot.query('Test question', { customData: 'test' });

    expect(capturedContext).toBeDefined();
  });

  test('should throw on program generation failure', async () => {
    const mockLLM = {
      complete: async () => '{ invalid json'
    };

    const pot = new ProofOfThought(mockLLM);

    await expect(pot.query('Test')).rejects.toThrow('Failed to generate program');
  });

  test('should retry on failure', async () => {
    let attempt = 0;
    const mockLLM = {
      complete: async () => {
        attempt++;
        if (attempt === 1) {
          return '{ invalid }';
        }
        return JSON.stringify({
          variables: [],
          constraints: [],
          query: { type: 'check-sat' }
        });
      }
    };

    const pot = new ProofOfThought(mockLLM, { maxRetries: 3 });
    const result = await pot.query('Test');

    expect(result).toBeDefined();
    expect(attempt).toBe(2);
  });
});
