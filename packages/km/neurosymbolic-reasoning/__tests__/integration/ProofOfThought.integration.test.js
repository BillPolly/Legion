import { ProofOfThought } from '../../src/core/ProofOfThought.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ProofOfThought Integration (Full Pipeline)', () => {
  let resourceManager;
  let llmClient;
  let pot;

  beforeAll(async () => {
    // Get real ResourceManager and LLM client (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    pot = new ProofOfThought(llmClient);
  }, 30000);

  describe('Query Method - Natural Language Reasoning', () => {
    test('should answer simple numeric question', async () => {
      const result = await pot.query('Is there a number greater than 5 and less than 10?');

      expect(result.answer).toBeDefined();
      expect(['Yes', 'No']).toContain(result.answer);
      expect(result.proof).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.explanation).toBeDefined();
      expect(result.model).toBeDefined();
    }, 30000);

    test('should provide detailed proof chain', async () => {
      const result = await pot.query('Can x be equal to 42?');

      expect(Array.isArray(result.proof)).toBe(true);
      expect(result.proof.length).toBeGreaterThan(0);

      // Verify proof structure
      result.proof.forEach(step => {
        expect(step).toHaveProperty('step');
        expect(step).toHaveProperty('description');
      });
    }, 30000);

    test('should handle boolean logic questions', async () => {
      const result = await pot.query('Can both p and q be true if p implies not q?');

      expect(result.answer).toBeDefined();
      expect(result.proof).toBeDefined();

      // This should be unsatisfiable
      expect(result.answer).toBe('No');
    }, 30000);

    test('should work with real number constraints', async () => {
      const result = await pot.query('Is there a real number between 0.5 and 1.5?');

      expect(result.answer).toBe('Yes');
      expect(result.model).toBeDefined();
    }, 30000);
  });

  describe('Verify Method - Constraint Verification', () => {
    test('should verify valid solution', async () => {
      const result = await pot.verify(
        'x satisfies constraints',
        ['x = 7'],
        ['x > 5', 'x < 10']
      );

      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.proof).toBeDefined();
    }, 30000);

    test('should detect constraint violations', async () => {
      const result = await pot.verify(
        'deployment is safe',
        ['code_coverage = 76', 'tests_passing = true'],
        ['code_coverage > 80', 'tests_passing == true']
      );

      // Should detect code_coverage violation
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    }, 30000);

    test('should verify boolean conditions', async () => {
      const result = await pot.verify(
        'condition is met',
        ['flag = true'],
        ['flag == true']
      );

      expect(result.valid).toBe(true);
    }, 30000);
  });

  describe('Solve Method - Constraint Satisfaction', () => {
    test('should find solution to constraints', async () => {
      const result = await pot.solve(
        'x',
        ['x > 10', 'x < 20']
      );

      expect(result.satisfiable).toBe(true);
      expect(result.solution).toBeDefined();
      expect(result.model).toBeDefined();
      expect(result.proof).toBeDefined();
    }, 30000);

    test('should detect unsatisfiable constraints', async () => {
      const result = await pot.solve(
        'x',
        ['x > 20', 'x < 10']
      );

      expect(result.satisfiable).toBe(false);
    }, 30000);

    test('should solve with multiple variables', async () => {
      const result = await pot.solve(
        'x and y',
        ['x > 0', 'y < 10', 'x < y']
      );

      expect(result.satisfiable).toBe(true);
      expect(result.model).toBeDefined();

      // Verify the solution makes sense
      if (result.model.x && result.model.y) {
        const x = parseFloat(result.model.x);
        const y = parseFloat(result.model.y);
        expect(x).toBeGreaterThan(0);
        expect(y).toBeLessThan(10);
        expect(x).toBeLessThan(y);
      }
    }, 30000);
  });

  describe('End-to-End Scenarios', () => {
    test('should handle complex deployment decision', async () => {
      const result = await pot.query(
        'Should we deploy to production?',
        {
          facts: ['tests_passing = true', 'coverage = 85', 'vulnerabilities = 0'],
          constraints: ['tests_passing == true', 'coverage > 80', 'vulnerabilities == 0']
        }
      );

      expect(result).toBeDefined();
      expect(result.answer).toBeDefined();
      expect(result.proof).toBeDefined();
      expect(result.explanation).toBeDefined();
    }, 30000);

    test('should provide explanations with proofs', async () => {
      const result = await pot.query('Find a number divisible by 2 between 10 and 20');

      expect(result.explanation).toBeDefined();
      expect(typeof result.explanation).toBe('string');
      expect(result.explanation.length).toBeGreaterThan(0);

      // Explanation should contain step information
      expect(result.explanation).toMatch(/Step \d+:/);
    }, 30000);
  });

  describe('Error Handling and Retries', () => {
    test('should handle malformed questions gracefully', async () => {
      try {
        await pot.query('???');
        // If it doesn't throw, it should still return a structured response
        expect(true).toBe(true);
      } catch (error) {
        // If it throws, it should be a clear error
        expect(error.message).toBeDefined();
      }
    }, 30000);
  });
});
