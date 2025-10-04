/**
 * DecisionMakingActor - Example actor using neurosymbolic reasoning
 *
 * Demonstrates how to integrate ProofOfThought into Legion actors
 * for safety-critical decision making with formal proofs.
 */

import { ProofOfThought } from '../src/index.js';

export class DecisionMakingActor {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.pot = null;

    // Safety constraints for deployment decisions
    this.safetyConstraints = [
      'tests_passing == true',
      'code_coverage > 80',
      'vulnerabilities_count == 0'
    ];
  }

  /**
   * Initialize ProofOfThought
   * @private
   */
  async _initialize() {
    if (!this.pot) {
      const llmClient = await this.resourceManager.get('llmClient');
      this.pot = new ProofOfThought(llmClient);
    }
  }

  /**
   * Decide whether an action is safe to perform
   * @param {string} action - Action to evaluate
   * @param {object} context - Context with facts about current state
   * @returns {Promise<{allowed: boolean, proof: array, violations: array, explanation: string}>}
   */
  async decide(action, context) {
    await this._initialize();

    const claim = `Action '${action}' is safe`;
    const facts = context.facts || [];

    // Verify action against safety constraints
    const result = await this.pot.verify(claim, facts, this.safetyConstraints);

    return {
      allowed: result.valid,
      proof: result.proof,
      violations: result.violations,
      explanation: this._explainDecision(result)
    };
  }

  /**
   * Evaluate risk level based on current facts
   * @param {array} facts - Current system facts
   * @returns {Promise<{level: string, score: number, explanation: string}>}
   */
  async evaluateRisk(facts) {
    await this._initialize();

    // Count how many safety constraints are violated
    let violationCount = 0;
    const results = [];

    for (const constraint of this.safetyConstraints) {
      const result = await this.pot.verify(
        'Constraint satisfied',
        facts,
        [constraint]
      );

      if (!result.valid) {
        violationCount++;
      }

      results.push({ constraint, valid: result.valid });
    }

    // Calculate risk score (0-1)
    const score = violationCount / this.safetyConstraints.length;

    // Determine risk level
    let level;
    if (score < 0.3) {
      level = 'low';
    } else if (score < 0.7) {
      level = 'medium';
    } else {
      level = 'high';
    }

    return {
      level,
      score,
      explanation: this._explainRisk(results, score)
    };
  }

  /**
   * Generate human-readable decision explanation
   * @param {object} result - Verification result
   * @returns {string} Explanation
   * @private
   */
  _explainDecision(result) {
    if (result.valid) {
      return 'Action approved: All safety constraints satisfied.';
    } else {
      const violations = result.violations
        .map(v => `  - ${v}`)
        .join('\n');
      return `Action blocked due to safety constraint violations:\n${violations}`;
    }
  }

  /**
   * Generate risk assessment explanation
   * @param {array} results - Constraint check results
   * @param {number} score - Risk score
   * @returns {string} Explanation
   * @private
   */
  _explainRisk(results, score) {
    const violated = results
      .filter(r => !r.valid)
      .map(r => r.constraint);

    if (violated.length === 0) {
      return 'Risk level: LOW. All safety constraints are satisfied.';
    }

    const violationList = violated
      .map(c => `  - ${c}`)
      .join('\n');

    return `Risk score: ${(score * 100).toFixed(0)}%\n\nViolated constraints:\n${violationList}`;
  }
}
