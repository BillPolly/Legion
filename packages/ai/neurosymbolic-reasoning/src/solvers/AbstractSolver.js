/**
 * Abstract base class for theorem provers
 * Defines the interface that all solver implementations must follow
 */
export class AbstractSolver {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the solver
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Check if solver is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Solve a Z3 program
   * @param {object} program - Z3 program to solve
   * @returns {Promise<{result: string, model: object, proof: array}>}
   */
  async solve(program) {
    throw new Error('solve() must be implemented by subclass');
  }

  /**
   * Quick satisfiability check
   * @param {array} constraints - Constraints to check
   * @returns {Promise<string>} 'sat', 'unsat', or 'unknown'
   */
  async checkSat(constraints) {
    throw new Error('checkSat() must be implemented by subclass');
  }

  /**
   * Extract model (variable assignments)
   * @returns {Promise<object>} Model with variable assignments
   */
  async getModel() {
    throw new Error('getModel() must be implemented by subclass');
  }

  /**
   * Extract proof
   * @returns {Promise<array>} Proof steps
   */
  async getProof() {
    throw new Error('getProof() must be implemented by subclass');
  }
}
