/**
 * ReasonCommand - Neurosymbolic reasoning with formal proofs
 * Usage: /reason "question" [--constraint "expr"] [--fact "expr"]
 */

import { BaseCommand } from './BaseCommand.js';
import { ProofOfThought } from '@legion/neurosymbolic-reasoning';

export class ReasonCommand extends BaseCommand {
  constructor(resourceManager) {
    super(
      'reason',
      'Perform neurosymbolic reasoning with formal proofs',
      'reason "question" [--constraint "expr"] [--fact "expr"]'
    );

    this.resourceManager = resourceManager;
    this.pot = null;
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
   * Parse command arguments
   * @param {Array} args - Command arguments
   * @returns {Object} Parsed arguments
   * @private
   */
  _parseArgs(args) {
    const parsed = {
      question: '',
      constraints: [],
      facts: []
    };

    if (!args || args.length === 0) {
      return parsed;
    }

    // First argument is the question
    parsed.question = args[0];

    // Parse flags
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--constraint' && i + 1 < args.length) {
        parsed.constraints.push(args[i + 1]);
        i++; // Skip next arg
      } else if (args[i] === '--fact' && i + 1 < args.length) {
        parsed.facts.push(args[i + 1]);
        i++; // Skip next arg
      }
    }

    return parsed;
  }

  /**
   * Format result as human-readable message
   * @param {Object} result - ProofOfThought result
   * @returns {string} Formatted message
   * @private
   */
  _formatResult(result) {
    let message = `Answer: ${result.answer}\n`;
    message += `Confidence: ${(result.confidence * 100).toFixed(0)}%\n\n`;
    message += `Proof:\n`;
    message += result.explanation || 'No detailed explanation available';

    if (result.model && Object.keys(result.model).length > 0) {
      message += `\n\nSolution:\n`;
      for (const [key, value] of Object.entries(result.model)) {
        message += `  ${key} = ${value}\n`;
      }
    }

    return message;
  }

  /**
   * Execute the reason command
   * @param {Array} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async execute(args) {
    try {
      // Parse arguments
      const parsed = this._parseArgs(args);

      // Validate question
      if (!parsed.question || parsed.question.trim() === '') {
        throw new Error('Question is required');
      }

      // Initialize ProofOfThought
      await this._initialize();

      // Execute reasoning
      const result = await this.pot.query(parsed.question, {
        facts: parsed.facts,
        constraints: parsed.constraints
      });

      // Format output
      const message = this._formatResult(result);

      return {
        success: true,
        data: result,
        message
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Get command help text
   * @returns {string} Help text
   */
  getHelp() {
    return `
/reason - Perform neurosymbolic reasoning with formal proofs

Usage:
  /reason "question" [--constraint "expr"] [--fact "expr"]

Arguments:
  question           Natural language question to reason about (required)
  --constraint       Add a constraint that must be satisfied (optional, multiple allowed)
  --fact            Add a known fact (optional, multiple allowed)

Examples:
  /reason "Is there a number greater than 5 and less than 10?"

  /reason "Should we deploy?" \\
    --fact "tests_passing = true" \\
    --fact "coverage = 85" \\
    --constraint "tests_passing == true" \\
    --constraint "coverage > 80"

  /reason "Can x be 7?" \\
    --constraint "x > 5" \\
    --constraint "x < 10"

Output:
  - Answer (Yes/No)
  - Confidence score
  - Step-by-step proof
  - Solution (variable assignments if applicable)
`;
  }
}

export default ReasonCommand;
