/**
 * PathQuery AST with variable binding
 * Per design §3: Query Compiler - path+predicate → GraphSpec compilation
 * 
 * PathQuery represents a complete path query with variables,
 * steps, predicates, and support for compilation to GraphSpec.
 */

import { PathStepFactory } from './PathStep.js';

/**
 * Variable binding in a path query
 */
export class Variable {
  constructor(name) {
    if (!name) {
      throw new Error('Variable name is required');
    }
    if (typeof name !== 'string') {
      throw new Error('Variable name must be a string');
    }
    if (!name.startsWith('?')) {
      throw new Error('Variable name must start with ?');
    }
    this._name = name;
    this._isBound = false;
    this._bindingValue = undefined;
  }

  get name() {
    return this._name;
  }

  get isBound() {
    return this._isBound;
  }

  get value() {
    return this._bindingValue;
  }

  /**
   * Bind variable to a value
   */
  bind(value) {
    this._isBound = true;
    this._bindingValue = value;
  }

  /**
   * Unbind variable
   */
  unbind() {
    this._isBound = false;
    this._bindingValue = undefined;
  }

  toString() {
    return this._isBound ? `${this._name}=${this._bindingValue}` : this._name;
  }

  equals(other) {
    return other instanceof Variable && other._name === this._name;
  }
}

/**
 * Path query AST representing a complete query
 */
export class PathQuery {
  constructor(options = {}) {
    this._startVariable = options.startVariable || new Variable('?start');
    this._steps = options.steps || [];
    this._predicates = options.predicates || [];
    this._returnVariables = options.returnVariables || [];
    this._queryId = options.queryId || this._generateQueryId();
  }

  /**
   * Get the starting variable
   */
  get startVariable() {
    return this._startVariable;
  }

  /**
   * Get the path steps
   */
  get steps() {
    return [...this._steps];
  }

  /**
   * Get the predicates
   */
  get predicates() {
    return [...this._predicates];
  }

  /**
   * Get the return variables
   */
  get returnVariables() {
    return [...this._returnVariables];
  }

  /**
   * Get the query ID
   */
  get queryId() {
    return this._queryId;
  }

  /**
   * Add a step to the path
   */
  addStep(step) {
    if (!step) {
      throw new Error('Step is required');
    }
    this._steps.push(step);
    return this;
  }

  /**
   * Add multiple steps
   */
  addSteps(steps) {
    if (!Array.isArray(steps)) {
      throw new Error('Steps must be an array');
    }
    steps.forEach(step => this.addStep(step));
    return this;
  }

  /**
   * Add a predicate
   */
  addPredicate(predicate) {
    if (!predicate) {
      throw new Error('Predicate is required');
    }
    this._predicates.push(predicate);
    return this;
  }

  /**
   * Set return variables
   */
  setReturnVariables(variables) {
    if (!Array.isArray(variables)) {
      throw new Error('Return variables must be an array');
    }
    this._returnVariables = variables.map(v => {
      if (typeof v === 'string') {
        return new Variable(v);
      }
      return v;
    });
    return this;
  }

  /**
   * Get all variables in the query
   */
  getAllVariables() {
    const variables = new Map();
    
    // Add start variable
    variables.set(this._startVariable.name, this._startVariable);
    
    // Generate intermediate variables for each step
    for (let i = 0; i < this._steps.length; i++) {
      const varName = `?v${i + 1}`;
      if (!variables.has(varName)) {
        variables.set(varName, new Variable(varName));
      }
    }
    
    // Add return variables
    this._returnVariables.forEach(v => {
      if (!variables.has(v.name)) {
        variables.set(v.name, v);
      }
    });
    
    return Array.from(variables.values());
  }

  /**
   * Generate variable order for query execution
   * Per design: Variable order determines join order for LFTJ
   */
  generateVariableOrder() {
    const order = [];
    const variables = this.getAllVariables();
    
    // Always start with the start variable
    order.push(this._startVariable);
    
    // Add variables in path order
    for (let i = 0; i < this._steps.length; i++) {
      const nextVarName = `?v${i + 1}`;
      const nextVar = variables.find(v => v.name === nextVarName);
      if (nextVar && !order.includes(nextVar)) {
        order.push(nextVar);
      }
    }
    
    // Add any remaining variables
    variables.forEach(v => {
      if (!order.includes(v)) {
        order.push(v);
      }
    });
    
    return order;
  }

  /**
   * Compile query to GraphSpec
   * Per design: Convert path query to kernel GraphSpec representation
   */
  toGraphSpec() {
    const spec = {
      queryId: this._queryId,
      variables: [],
      edges: [],
      constraints: [],
      predicates: [],
      returnVariables: []
    };
    
    // Add variables
    const allVars = this.getAllVariables();
    spec.variables = allVars.map(v => ({
      name: v.name,
      isBound: v.isBound,
      value: v.value
    }));
    
    // Convert steps to edges and constraints
    let currentVar = this._startVariable;
    for (let i = 0; i < this._steps.length; i++) {
      const step = this._steps[i];
      const nextVar = allVars.find(v => v.name === `?v${i + 1}`);
      
      const variableMap = {
        current: currentVar.name,
        next: nextVar ? nextVar.name : `?v${i + 1}`
      };
      
      const stepSpec = step.toGraphSpec(variableMap);
      
      if (stepSpec.type === 'edge') {
        spec.edges.push(stepSpec);
      } else if (stepSpec.type === 'constraint') {
        spec.constraints.push(stepSpec);
      }
      
      if (nextVar) {
        currentVar = nextVar;
      }
    }
    
    // Add predicates
    spec.predicates = this._predicates.map(p => ({
      type: p.type || 'custom',
      ...p
    }));
    
    // Set return variables
    spec.returnVariables = this._returnVariables.map(v => v.name);
    
    // Add variable order hint
    spec.variableOrder = this.generateVariableOrder().map(v => v.name);
    
    return spec;
  }

  /**
   * Create a copy of this query
   */
  clone() {
    return new PathQuery({
      startVariable: new Variable(this._startVariable.name),
      steps: [...this._steps],
      predicates: [...this._predicates],
      returnVariables: this._returnVariables.map(v => new Variable(v.name)),
      queryId: this._queryId
    });
  }

  /**
   * Generate a unique query ID
   */
  _generateQueryId() {
    return `query_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * String representation for debugging
   */
  toString() {
    const stepStr = this._steps.map(s => s.toString()).join(' -> ');
    const returnStr = this._returnVariables.map(v => v.name).join(', ');
    return `PathQuery(${this._startVariable.name} -> ${stepStr}) return ${returnStr || 'all'}`;
  }
}

/**
 * Builder for constructing path queries fluently
 */
export class PathQueryBuilder {
  constructor() {
    this._query = new PathQuery();
  }

  /**
   * Set the starting variable
   */
  from(variable) {
    if (typeof variable === 'string') {
      this._query._startVariable = new Variable(variable);
    } else {
      this._query._startVariable = variable;
    }
    return this;
  }

  /**
   * Add a forward step
   */
  forward(relationName) {
    const step = PathStepFactory.fromString(relationName);
    this._query.addStep(step);
    return this;
  }

  /**
   * Add an inverse step
   */
  inverse(relationName) {
    const step = PathStepFactory.fromString(`^${relationName}`);
    this._query.addStep(step);
    return this;
  }

  /**
   * Add a literal match
   */
  literal(value) {
    const step = PathStepFactory.fromString(`=${JSON.stringify(value)}`);
    this._query.addStep(step);
    return this;
  }

  /**
   * Add a path from string notation
   * Example: "worksAt.^livesIn.manages"
   */
  path(pathString) {
    if (!pathString) {
      throw new Error('Path string is required');
    }
    
    const stepStrings = pathString.split('.');
    const steps = PathStepFactory.fromArray(stepStrings);
    this._query.addSteps(steps);
    return this;
  }

  /**
   * Add a predicate
   */
  where(predicate) {
    this._query.addPredicate(predicate);
    return this;
  }

  /**
   * Set return variables
   */
  returning(...variables) {
    this._query.setReturnVariables(variables);
    return this;
  }

  /**
   * Bind starting variable to a value
   */
  bind(variable, value) {
    if (typeof variable === 'string') {
      if (variable === this._query._startVariable.name) {
        this._query._startVariable.bind(value);
      }
    }
    return this;
  }

  /**
   * Build the final query
   */
  build() {
    return this._query;
  }
}

/**
 * Factory for creating path queries from different representations
 */
export class PathQueryFactory {
  /**
   * Create a path query from a simple path string
   * Example: "?x.worksAt.^livesIn.manages"
   */
  static fromPathString(pathString) {
    if (!pathString) {
      throw new Error('Path string is required');
    }
    
    const parts = pathString.split('.');
    if (parts.length === 0) {
      throw new Error('Path string must contain at least one element');
    }
    
    const builder = new PathQueryBuilder();
    
    // First part might be a variable
    const first = parts[0];
    if (first.startsWith('?')) {
      builder.from(first);
      parts.shift();
    }
    
    // Add remaining steps
    if (parts.length > 0) {
      builder.path(parts.join('.'));
    }
    
    return builder.build();
  }

  /**
   * Create a path query from an object specification
   */
  static fromObject(spec) {
    if (!spec || typeof spec !== 'object') {
      throw new Error('Query specification is required');
    }
    
    const query = new PathQuery({
      queryId: spec.queryId
    });
    
    if (spec.startVariable) {
      query._startVariable = new Variable(spec.startVariable);
    }
    
    if (spec.steps) {
      const steps = spec.steps.map(s => {
        if (typeof s === 'string') {
          return PathStepFactory.fromString(s);
        }
        return PathStepFactory.fromObject(s);
      });
      query.addSteps(steps);
    }
    
    if (spec.predicates) {
      spec.predicates.forEach(p => query.addPredicate(p));
    }
    
    if (spec.returnVariables) {
      query.setReturnVariables(spec.returnVariables);
    }
    
    return query;
  }
}