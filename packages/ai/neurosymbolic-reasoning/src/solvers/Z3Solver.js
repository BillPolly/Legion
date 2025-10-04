import { init } from 'z3-solver';
import { AbstractSolver } from './AbstractSolver.js';

/**
 * Z3 Theorem Prover Solver
 * Wraps the z3-solver npm package with Legion-compatible interface
 */
export class Z3Solver extends AbstractSolver {
  constructor() {
    super();
    this.context = null;
    this.z3 = null;

    // Z3 types
    this.Int = null;
    this.Bool = null;
    this.Real = null;

    // Z3 operators
    this.And = null;
    this.Or = null;
    this.Not = null;
    this.Solver = null;

    // Current solver instance, model, and proof
    this.currentSolver = null;
    this.currentModel = null;
    this.currentProof = null;
  }

  /**
   * Initialize Z3 WASM and create context
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return; // Already initialized
    }

    try {
      await this._initZ3();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Z3 initialization failed: ${error.message}`);
    }
  }

  /**
   * Internal method to initialize Z3 (can be mocked for testing)
   * @private
   */
  async _initZ3() {
    // Initialize z3-solver WASM
    const { Context } = await init();

    // Create context
    const ctx = new Context('main');

    // Extract types and operators
    const { Solver, Int, Bool, Real, And, Or, Not } = ctx;

    // Store references
    this.context = ctx;
    this.Solver = Solver;
    this.Int = Int;
    this.Bool = Bool;
    this.Real = Real;
    this.And = And;
    this.Or = Or;
    this.Not = Not;
  }

  /**
   * Create a fresh Solver instance
   * @returns {object} Z3 Solver instance
   */
  createSolver() {
    if (!this.initialized) {
      throw new Error('Z3Solver not initialized');
    }

    return new this.Solver();
  }

  /**
   * Solve a Z3 program
   * @param {object} program - Z3 program with variables, constraints, query
   * @returns {Promise<{result: string, model: object, proof: array}>}
   */
  async solve(program) {
    if (!this.initialized) {
      throw new Error('Z3Solver not initialized');
    }

    // Create fresh solver for this problem
    const solver = this.createSolver();

    // Create variables
    const variables = {};
    for (const varDef of program.variables) {
      variables[varDef.name] = this._createVariable(varDef.name, varDef.sort);
    }

    // Add constraints
    for (const constraint of program.constraints) {
      const z3Constraint = this._buildConstraint(constraint, variables);
      solver.add(z3Constraint);
    }

    // Check satisfiability
    const result = await solver.check();

    // Extract model if satisfiable
    let model = {};
    if (result === 'sat') {
      const z3Model = solver.model();
      for (const [name, variable] of Object.entries(variables)) {
        const value = z3Model.eval(variable);
        model[name] = value.toString();
      }
    }

    // Build proof
    const proof = this._buildProof(program, result, model);

    // Store for potential getModel/getProof calls
    this.currentSolver = solver;
    this.currentModel = model;
    this.currentProof = proof;

    return {
      result,
      model,
      proof
    };
  }

  /**
   * Create a Z3 variable of the specified sort
   * @private
   */
  _createVariable(name, sort) {
    switch (sort) {
      case 'Int':
        return this.Int.const(name);
      case 'Bool':
        return this.Bool.const(name);
      case 'Real':
        return this.Real.const(name);
      default:
        throw new Error(`Unknown sort: ${sort}`);
    }
  }

  /**
   * Build Z3 constraint from JSON constraint definition
   * @private
   */
  _buildConstraint(constraint, variables) {
    const args = constraint.args.map(arg => {
      // If arg is a string, it's a variable name
      if (typeof arg === 'string') {
        if (variables[arg]) {
          return variables[arg];
        }
        throw new Error(`Unknown variable: ${arg}`);
      }

      // If arg is a constraint object, recurse
      if (arg && typeof arg === 'object' && arg.type) {
        return this._buildConstraint(arg, variables);
      }

      // It's a literal value
      return arg;
    });

    // Apply the operator
    switch (constraint.type) {
      // Comparison operators
      case 'gt':
        return args[0].gt(args[1]);
      case 'lt':
        return args[0].lt(args[1]);
      case 'ge':
        return args[0].ge(args[1]);
      case 'le':
        return args[0].le(args[1]);
      case 'eq':
        return args[0].eq(args[1]);
      case 'ne':
        return args[0].neq(args[1]);

      // Logical operators
      case 'and':
        return this.And(...args);
      case 'or':
        return this.Or(...args);
      case 'not':
        return this.Not(args[0]);
      case 'implies':
        // p → q is equivalent to ¬p ∨ q
        return this.Or(this.Not(args[0]), args[1]);

      // Arithmetic operators
      case 'add':
        return args[0].add(args[1]);
      case 'sub':
        return args[0].sub(args[1]);
      case 'mul':
        return args[0].mul(args[1]);
      case 'div':
        return args[0].div(args[1]);

      default:
        throw new Error(`Unknown constraint type: ${constraint.type}`);
    }
  }

  /**
   * Quick satisfiability check
   * @param {array} constraints - Array of constraint objects
   * @param {array} variables - Array of variable definitions
   * @returns {Promise<string>} 'sat', 'unsat', or 'unknown'
   */
  async checkSat(constraints, variables = []) {
    if (!this.initialized) {
      throw new Error('Z3Solver not initialized');
    }

    // Create a minimal program and solve it
    const program = {
      variables,
      constraints,
      query: { type: 'check-sat' }
    };

    const result = await this.solve(program);
    return result.result;
  }

  /**
   * Extract model (variable assignments) from last solve
   * @returns {Promise<object>} Model with variable assignments
   */
  async getModel() {
    if (!this.initialized) {
      throw new Error('Z3Solver not initialized');
    }

    if (!this.currentModel) {
      throw new Error('No model available - call solve() first');
    }

    return this.currentModel;
  }

  /**
   * Extract proof from last solve
   * @returns {Promise<array>} Proof steps
   */
  async getProof() {
    if (!this.initialized) {
      throw new Error('Z3Solver not initialized');
    }

    if (!this.currentProof) {
      throw new Error('No proof available - call solve() first');
    }

    return this.currentProof;
  }

  /**
   * Build a basic proof from program and result
   * @private
   */
  _buildProof(program, result, model) {
    const proof = [];
    let step = 1;

    // Add constraint steps
    for (const constraint of program.constraints) {
      proof.push({
        step: step++,
        type: 'constraint',
        description: this._describeConstraint(constraint),
        satisfied: result === 'sat' // Simplification - in full system would check individual constraints
      });
    }

    // Add conclusion
    proof.push({
      step: step++,
      type: 'conclusion',
      description: `Result: ${result}`,
      result,
      model: result === 'sat' ? model : undefined
    });

    return proof;
  }

  /**
   * Generate human-readable description of a constraint
   * @private
   */
  _describeConstraint(constraint) {
    const operatorMap = {
      'gt': '>',
      'lt': '<',
      'ge': '>=',
      'le': '<=',
      'eq': '==',
      'ne': '!=',
      'and': 'AND',
      'or': 'OR',
      'not': 'NOT',
      'implies': '=>',
      'add': '+',
      'sub': '-',
      'mul': '*',
      'div': '/'
    };

    const operator = operatorMap[constraint.type] || constraint.type;

    // Format args
    const formatArg = (arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      if (arg && typeof arg === 'object' && arg.type) {
        return `(${this._describeConstraint(arg)})`;
      }
      return String(arg);
    };

    const args = constraint.args.map(formatArg);

    // Handle unary operators
    if (constraint.type === 'not') {
      return `NOT ${args[0]}`;
    }

    // Handle binary operators
    if (args.length === 2) {
      return `${args[0]} ${operator} ${args[1]}`;
    }

    // Handle n-ary operators
    return `${operator}(${args.join(', ')})`;
  }
}
