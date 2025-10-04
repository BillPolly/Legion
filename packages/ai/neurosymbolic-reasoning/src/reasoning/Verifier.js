/**
 * Verifier - Solution verification and proof extraction
 * Verifies solutions against constraints and extracts human-readable proofs
 */
export class Verifier {
  /**
   * Create a verifier
   * @param {object} solver - Z3Solver instance
   */
  constructor(solver) {
    if (!solver) {
      throw new Error('Solver is required');
    }
    this.solver = solver;
  }

  /**
   * Verify a solution against constraints
   * @param {object} solution - Proposed solution (variable assignments)
   * @param {object} program - Z3 program with constraints
   * @returns {Promise<{valid: boolean, violations: array, proof: array}>}
   */
  async verify(solution, program) {
    // Create a new program with the solution values as equality constraints
    const verificationProgram = {
      variables: program.variables,
      constraints: [
        ...program.constraints,
        // Add solution as constraints to verify
        ...Object.entries(solution).map(([varName, value]) => ({
          type: 'eq',
          args: [varName, value]
        }))
      ],
      query: program.query
    };

    // Solve with the solution constraints added
    const result = await this.solver.solve(verificationProgram);

    // If sat, the solution satisfies all constraints
    if (result.result === 'sat') {
      return {
        valid: true,
        violations: [],
        proof: result.proof
      };
    }

    // If unsat, the solution violates some constraint
    const violations = this._identifyViolations(solution, program.constraints);

    return {
      valid: false,
      violations,
      proof: result.proof
    };
  }

  /**
   * Identify which constraints are violated by a solution
   * @param {object} solution - Proposed solution
   * @param {array} constraints - List of constraints
   * @returns {array} List of violated constraints
   * @private
   */
  _identifyViolations(solution, constraints) {
    // For MVP, we return a generic violation
    // A full implementation would test each constraint individually
    return [{
      type: 'constraint_violation',
      description: 'Solution does not satisfy all constraints',
      solution
    }];
  }

  /**
   * Extract proof from solver
   * @returns {Promise<array>} Proof steps
   */
  async extractProof() {
    return await this.solver.getProof();
  }

  /**
   * Convert proof to human-readable explanation
   * @param {array} proof - Proof steps from solver
   * @returns {string} Human-readable explanation
   */
  explainProof(proof) {
    if (!proof || proof.length === 0) {
      return '';
    }

    const lines = [];

    for (const step of proof) {
      let line = `Step ${step.step}: ${step.description}`;

      // Add satisfaction status for constraint steps
      if (step.type === 'constraint' && step.satisfied !== undefined) {
        line += step.satisfied ? ' ✓' : ' ✗';
      }

      // Add model for conclusion steps
      if (step.type === 'conclusion') {
        if (step.result === 'sat' && step.model) {
          line += '\n  Solution: ' + Object.entries(step.model)
            .map(([k, v]) => `${k} = ${v}`)
            .join(', ');
        } else if (step.result === 'unsat') {
          line += ' (unsatisfiable)';
        }
      }

      lines.push(line);
    }

    return lines.join('\n');
  }
}
