import { ProgramGenerator } from '../reasoning/ProgramGenerator.js';
import { Z3Solver } from '../solvers/Z3Solver.js';
import { Verifier } from '../reasoning/Verifier.js';

/**
 * ProofOfThought - Main neurosymbolic reasoning interface
 * Coordinates LLM-based program generation with Z3 theorem proving
 */
export class ProofOfThought {
  /**
   * Create a ProofOfThought instance
   * @param {object} llmClient - LLM client from ResourceManager
   * @param {object} options - Configuration options
   */
  constructor(llmClient, options = {}) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }

    this.llmClient = llmClient;
    this.options = {
      maxRetries: 3,
      timeout: 30000,
      ...options
    };

    // Initialize components
    this.generator = new ProgramGenerator(llmClient);
    this.solver = new Z3Solver();
    this.verifier = new Verifier(this.solver);
  }

  /**
   * Query with natural language question
   * @param {string} question - Natural language question
   * @param {object} context - Additional context (facts, constraints)
   * @returns {Promise<{answer: string, proof: array, confidence: number, explanation: string}>}
   */
  async query(question, context = {}) {
    // Ensure solver is initialized
    if (!this.solver.initialized) {
      await this.solver.initialize();
    }

    // Generate Z3 program from question
    const genResult = await this.generator.generateWithRetry(
      question,
      context,
      this.options.maxRetries
    );

    if (!genResult.success) {
      throw new Error(`Failed to generate program: ${genResult.error}`);
    }

    // Solve the program
    const solveResult = await this.solver.solve(genResult.program);

    // Extract answer based on result
    const answer = solveResult.result === 'sat' ? 'Yes' : 'No';
    const confidence = solveResult.result === 'sat' ? 0.95 : 0.90;

    // Generate explanation
    const explanation = this.verifier.explainProof(solveResult.proof);

    return {
      answer,
      proof: solveResult.proof,
      confidence,
      explanation,
      model: solveResult.model
    };
  }

  /**
   * Verify a claim against facts and constraints
   * @param {string} claim - Claim to verify
   * @param {array} facts - Known facts
   * @param {array} constraints - Constraints to check
   * @returns {Promise<{valid: boolean, proof: array, violations: array}>}
   */
  async verify(claim, facts = [], constraints = []) {
    // Ensure solver is initialized
    if (!this.solver.initialized) {
      await this.solver.initialize();
    }

    // Generate program for verification
    const question = `Verify: ${claim}. Facts: ${facts.join(', ')}. Constraints: ${constraints.join(', ')}`;

    const genResult = await this.generator.generateWithRetry(
      question,
      { facts, constraints },
      this.options.maxRetries
    );

    if (!genResult.success) {
      throw new Error(`Failed to generate verification program: ${genResult.error}`);
    }

    // Solve the program
    const solveResult = await this.solver.solve(genResult.program);

    return {
      valid: solveResult.result === 'sat',
      proof: solveResult.proof,
      violations: solveResult.result === 'unsat' ? ['Constraints not satisfied'] : [],
      model: solveResult.model
    };
  }

  /**
   * Solve for values satisfying constraints
   * @param {string} goal - What to solve for
   * @param {array} constraints - Constraints to satisfy
   * @param {array} facts - Known facts
   * @returns {Promise<{solution: object, satisfiable: boolean, model: object}>}
   */
  async solve(goal, constraints = [], facts = []) {
    // Ensure solver is initialized
    if (!this.solver.initialized) {
      await this.solver.initialize();
    }

    // Generate program for constraint satisfaction
    const question = `Find: ${goal}. Constraints: ${constraints.join(', ')}. Facts: ${facts.join(', ')}`;

    const genResult = await this.generator.generateWithRetry(
      question,
      { facts, constraints },
      this.options.maxRetries
    );

    if (!genResult.success) {
      throw new Error(`Failed to generate solving program: ${genResult.error}`);
    }

    // Solve the program
    const solveResult = await this.solver.solve(genResult.program);

    return {
      solution: solveResult.model,
      satisfiable: solveResult.result === 'sat',
      model: solveResult.model,
      proof: solveResult.proof
    };
  }
}
