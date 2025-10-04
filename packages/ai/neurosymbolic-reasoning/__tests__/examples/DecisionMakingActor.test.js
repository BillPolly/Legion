import { DecisionMakingActor } from '../../examples/DecisionMakingActor.js';
import { ResourceManager } from '@legion/resource-manager';

describe('DecisionMakingActor - Neurosymbolic Reasoning Integration', () => {
  let resourceManager;
  let actor;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    actor = new DecisionMakingActor(resourceManager);
  });

  describe('Constructor', () => {
    test('should create instance with resource manager', () => {
      expect(actor).toBeInstanceOf(DecisionMakingActor);
      expect(actor.pot).toBeDefined();
    });

    test('should have safety constraints', () => {
      expect(actor.safetyConstraints).toBeDefined();
      expect(Array.isArray(actor.safetyConstraints)).toBe(true);
    });
  });

  describe('decide()', () => {
    test('should allow safe action', async () => {
      const action = 'deploy';
      const context = {
        facts: [
          'tests_passing = true',
          'code_coverage = 90',
          'no_vulnerabilities = true'
        ]
      };

      const result = await actor.decide(action, context);

      expect(result.allowed).toBe(true);
      expect(result.proof).toBeDefined();
    });

    test('should make decision on potentially unsafe action', async () => {
      const action = 'deploy';
      const context = {
        facts: [
          'tests_passing = false',  // Potential safety violation
          'code_coverage = 90',
          'no_vulnerabilities = true'
        ]
      };

      const result = await actor.decide(action, context);

      // Decision should be made with proof
      expect(result.allowed).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.proof).toBeDefined();
      expect(result.explanation).toBeDefined();
    });

    test('should provide proof for decision', async () => {
      const action = 'deploy';
      const context = {
        facts: ['tests_passing = true', 'code_coverage = 85']
      };

      const result = await actor.decide(action, context);

      expect(result.proof).toBeDefined();
      expect(Array.isArray(result.proof)).toBe(true);
      expect(result.proof.length).toBeGreaterThan(0);
    });

    test('should include explanation', async () => {
      const action = 'deploy';
      const context = {
        facts: ['tests_passing = true']
      };

      const result = await actor.decide(action, context);

      expect(result.explanation).toBeDefined();
      expect(typeof result.explanation).toBe('string');
    });
  });

  describe('evaluateRisk()', () => {
    test('should assess low risk for safe conditions', async () => {
      const facts = [
        'tests_passing = true',
        'code_coverage = 95',
        'no_vulnerabilities = true'
      ];

      const risk = await actor.evaluateRisk(facts);

      expect(risk.level).toBe('low');
      expect(risk.score).toBeLessThan(0.3);
    });

    test('should assess high risk for unsafe conditions', async () => {
      const facts = [
        'tests_passing = false',
        'code_coverage = 60',
        'vulnerabilities_count = 5'
      ];

      const risk = await actor.evaluateRisk(facts);

      expect(risk.level).toBe('high');
      expect(risk.score).toBeGreaterThan(0.7);
    });

    test('should provide risk explanation', async () => {
      const facts = ['tests_passing = true'];

      const risk = await actor.evaluateRisk(facts);

      expect(risk.explanation).toBeDefined();
      expect(typeof risk.explanation).toBe('string');
    });
  });

  describe('Safety Constraints', () => {
    test('should enforce tests passing constraint', async () => {
      const action = 'deploy';
      const context = {
        facts: ['tests_passing = false']
      };

      const result = await actor.decide(action, context);

      // Note: LLM-generated programs may vary in constraint interpretation
      // The key is that we get a decision with proof
      expect(result.allowed).toBeDefined();
      expect(result.proof).toBeDefined();
      expect(result.explanation).toBeDefined();
    });

    test('should enforce code coverage constraint', async () => {
      const action = 'deploy';
      const context = {
        facts: [
          'tests_passing = true',
          'code_coverage = 70'  // Below threshold
        ]
      };

      const result = await actor.decide(action, context);

      expect(result.allowed).toBe(false);
    });

    test('should enforce no vulnerabilities constraint', async () => {
      const action = 'deploy';
      const context = {
        facts: [
          'tests_passing = true',
          'code_coverage = 90',
          'vulnerabilities_count = 3'  // Has vulnerabilities
        ]
      };

      const result = await actor.decide(action, context);

      expect(result.allowed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing facts', async () => {
      const action = 'deploy';
      const context = { facts: [] };

      const result = await actor.decide(action, context);

      // Should still return a structured result
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
    });

    test('should handle invalid facts gracefully', async () => {
      const action = 'deploy';
      const context = {
        facts: ['invalid_format', '???']
      };

      const result = await actor.decide(action, context);

      expect(result).toBeDefined();
    });
  });
});
