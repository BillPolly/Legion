import { Z3Solver } from './Z3Solver.js';

/**
 * Z3 Description Logic Solver
 * Extends Z3Solver with support for description logic constructs:
 * - Uninterpreted functions (concepts, relationships)
 * - Quantifiers (forall, exists)
 * - Uninterpreted sorts (entity domains)
 *
 * Used for ontology reasoning and OWL axiom verification.
 */
export class Z3DescriptionLogicSolver extends Z3Solver {
  constructor() {
    super();

    // Additional Z3 constructs for DL
    this.Function = null;
    this.Sort = null;
    this.Const = null;
    this.ForAll = null;
    this.Exists = null;

    // Declared sorts (entity types)
    this.sorts = new Map(); // name -> Z3 Sort

    // Declared functions (concepts, relationships)
    this.functions = new Map(); // name -> Z3 Function
  }

  /**
   * Initialize Z3 with description logic support
   * @override
   */
  async _initZ3() {
    await super._initZ3();

    // Extract additional Z3 constructs from context
    // Note: These are direct references from the Z3 context object
    this.Sort = this.context.Sort;
    this.Function = this.context.Function;
    this.Const = this.context.Const;
    this.ForAll = this.context.ForAll;
    this.Exists = this.context.Exists;
  }

  /**
   * Declare an uninterpreted sort (entity domain)
   * @param {string} name - Sort name (e.g., "Entity", "Person")
   * @returns {object} Z3 Sort
   */
  declareSort(name) {
    if (this.sorts.has(name)) {
      return this.sorts.get(name);
    }

    const sort = this.Sort.declare(name);
    this.sorts.set(name, sort);
    return sort;
  }

  /**
   * Declare an uninterpreted function (concept or relationship)
   * @param {string} name - Function name
   * @param {array} domain - Domain sorts (argument types)
   * @param {object} range - Range sort (return type)
   * @returns {Function} Callable wrapper around Z3 FuncDecl
   */
  declareFunction(name, domain, range) {
    if (this.functions.has(name)) {
      return this.functions.get(name);
    }

    const funcDecl = this.Function.declare(name, ...domain, range);

    // Create callable wrapper
    // Z3 FuncDecl uses .call() method, but we want direct invocation
    const wrapper = (...args) => funcDecl.call(...args);
    wrapper._z3FuncDecl = funcDecl; // Store for introspection

    this.functions.set(name, wrapper);
    return wrapper;
  }

  /**
   * Declare a concept (unary predicate: Entity -> Bool)
   * @param {string} name - Concept name (e.g., "Pump", "Continuant")
   * @param {object} entitySort - Entity sort
   * @returns {Function} Callable Z3 function
   */
  declareConcept(name, entitySort) {
    return this.declareFunction(name, [entitySort], this.Bool.sort());
  }

  /**
   * Declare a relationship (binary predicate: Entity x Entity -> Bool)
   * @param {string} name - Relationship name (e.g., "transforms")
   * @param {object} domainSort - Domain sort
   * @param {object} rangeSort - Range sort
   * @returns {Function} Callable Z3 function
   */
  declareRelationship(name, domainSort, rangeSort) {
    return this.declareFunction(name, [domainSort, rangeSort], this.Bool.sort());
  }

  /**
   * Create a constant of the given sort (for quantifier binding)
   * @param {string} name - Constant name
   * @param {object} sort - Z3 Sort
   * @returns {object} Z3 Const
   */
  createConst(name, sort) {
    return this.Const(name, sort);
  }

  /**
   * Create a forall quantifier
   * @param {array} boundVars - Array of bound variables
   * @param {object} body - Z3 formula
   * @returns {object} Z3 ForAll expression
   */
  forall(boundVars, body) {
    return this.ForAll(boundVars, body);
  }

  /**
   * Create an exists quantifier
   * @param {array} boundVars - Array of bound variables
   * @param {object} body - Z3 formula
   * @returns {object} Z3 Exists expression
   */
  exists(boundVars, body) {
    return this.Exists(boundVars, body);
  }

  /**
   * Build Z3 constraint from JSON (extended for DL constructs)
   * @override
   */
  _buildConstraint(constraint, variables) {
    // Handle quantifiers
    if (constraint.type === 'forall' || constraint.type === 'exists') {
      return this._buildQuantifier(constraint, variables);
    }

    // Handle function applications
    if (constraint.type === 'apply') {
      return this._buildFunctionApplication(constraint, variables);
    }

    // Delegate to parent for basic constraints
    return super._buildConstraint(constraint, variables);
  }

  /**
   * Build a quantified formula
   * @private
   */
  _buildQuantifier(constraint, variables) {
    const { quantifier, boundVars, body } = constraint;

    // Create bound variables
    const z3BoundVars = boundVars.map(v => {
      const sort = this.sorts.get(v.sort) || this.declareSort(v.sort);
      return this.createConst(v.name, sort);
    });

    // Extend variable scope with bound variables
    const extendedVars = { ...variables };
    boundVars.forEach((v, i) => {
      extendedVars[v.name] = z3BoundVars[i];
    });

    // Build body with extended scope
    const z3Body = this._buildConstraint(body, extendedVars);

    // Apply quantifier
    if (quantifier === 'forall') {
      return this.forall(z3BoundVars, z3Body);
    } else if (quantifier === 'exists') {
      return this.exists(z3BoundVars, z3Body);
    } else {
      throw new Error(`Unknown quantifier: ${quantifier}`);
    }
  }

  /**
   * Build a function application
   * @private
   */
  _buildFunctionApplication(constraint, variables) {
    const { function: funcName, args } = constraint;

    // Get or declare the function
    const func = this.functions.get(funcName);
    if (!func) {
      throw new Error(`Undeclared function: ${funcName}`);
    }

    // Resolve arguments
    const z3Args = args.map(arg => {
      if (typeof arg === 'string' && variables[arg]) {
        return variables[arg];
      }
      if (arg && typeof arg === 'object' && arg.type) {
        return this._buildConstraint(arg, variables);
      }
      return arg;
    });

    // Apply function
    return func(...z3Args);
  }

  /**
   * Clear all declared sorts and functions
   */
  reset() {
    this.sorts.clear();
    this.functions.clear();
    this.currentSolver = null;
    this.currentModel = null;
    this.currentProof = null;
  }
}
