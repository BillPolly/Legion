import { ProofOfThought } from '../../../src/core/ProofOfThought.js';

describe('ProofOfThought', () => {
  describe('Constructor', () => {
    test('should create instance with LLM client', () => {
      const mockLLM = { complete: async () => '{}' };
      const pot = new ProofOfThought(mockLLM);
      expect(pot).toBeInstanceOf(ProofOfThought);
    });

    test('should throw without LLM client', () => {
      expect(() => new ProofOfThought(null)).toThrow('LLM client is required');
    });

    test('should initialize internal components', () => {
      const mockLLM = { complete: async () => '{}' };
      const pot = new ProofOfThought(mockLLM);

      // Verify internal components are created
      expect(pot.generator).toBeDefined();
      expect(pot.solver).toBeDefined();
      expect(pot.verifier).toBeDefined();
    });

    test('should accept custom options', () => {
      const mockLLM = { complete: async () => '{}' };
      const options = {
        maxRetries: 5,
        timeout: 60000
      };
      const pot = new ProofOfThought(mockLLM, options);

      expect(pot.options.maxRetries).toBe(5);
      expect(pot.options.timeout).toBe(60000);
    });

    test('should use default options if not provided', () => {
      const mockLLM = { complete: async () => '{}' };
      const pot = new ProofOfThought(mockLLM);

      expect(pot.options).toBeDefined();
      expect(pot.options.maxRetries).toBe(3);
    });
  });

  describe('Initialization', () => {
    test('should initialize Z3 solver on first query', async () => {
      const mockLLM = {
        complete: async () => JSON.stringify({
          variables: [{ name: 'x', sort: 'Int' }],
          constraints: [{ type: 'gt', args: ['x', 5] }],
          query: { type: 'check-sat' }
        })
      };

      const pot = new ProofOfThought(mockLLM);

      // Solver should not be initialized yet
      expect(pot.solver.initialized).toBe(false);

      // First query should initialize solver
      await pot.query('Is x > 5?');

      expect(pot.solver.initialized).toBe(true);
    });
  });
});
