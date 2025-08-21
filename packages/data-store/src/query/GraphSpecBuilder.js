/**
 * GraphSpec builder for LFTJ kernel integration
 * Per design §3: Query Compiler - converts path queries to kernel GraphSpec
 * 
 * GraphSpecBuilder takes PathQuery ASTs and generates GraphSpec
 * representations that can be executed by the LFTJ kernel.
 */

import { Variable } from './PathQuery.js';

/**
 * GraphSpec represents a query graph for the LFTJ kernel
 * Per design: kernel expects edge patterns and variable bindings
 */
export class GraphSpec {
  constructor() {
    this._queryId = null;
    this._variables = new Map(); // variable name -> variable info
    this._edges = [];            // edge patterns
    this._constraints = [];      // literal constraints
    this._predicates = [];       // computed predicates
    this._operators = [];        // join operators
    this._variableOrder = [];    // variable execution order
    this._returnVariables = [];  // output variables
  }

  /**
   * Set the query ID
   */
  setQueryId(id) {
    this._queryId = id;
    return this;
  }

  /**
   * Add a variable to the spec
   */
  addVariable(name, info = {}) {
    if (!name) {
      throw new Error('Variable name is required');
    }
    if (!name.startsWith('?')) {
      throw new Error('Variable name must start with ?');
    }
    
    this._variables.set(name, {
      name,
      isBound: info.isBound || false,
      value: info.value,
      type: info.type || 'free'
    });
    return this;
  }

  /**
   * Add an edge pattern
   */
  addEdge(edge) {
    if (!edge) {
      throw new Error('Edge specification is required');
    }
    if (!edge.relation) {
      throw new Error('Edge must have a relation');
    }
    if (!edge.source) {
      throw new Error('Edge must have a source variable');
    }
    if (!edge.target) {
      throw new Error('Edge must have a target variable');
    }
    
    this._edges.push({
      type: 'edge',
      relation: edge.relation,
      direction: edge.direction || 'forward',
      source: edge.source,
      target: edge.target
    });
    return this;
  }

  /**
   * Add a constraint
   */
  addConstraint(constraint) {
    if (!constraint) {
      throw new Error('Constraint specification is required');
    }
    if (!constraint.variable) {
      throw new Error('Constraint must have a variable');
    }
    if (!constraint.operator) {
      throw new Error('Constraint must have an operator');
    }
    
    this._constraints.push({
      type: 'constraint',
      operator: constraint.operator,
      variable: constraint.variable,
      value: constraint.value
    });
    return this;
  }

  /**
   * Add a predicate
   */
  addPredicate(predicate) {
    if (!predicate) {
      throw new Error('Predicate specification is required');
    }
    
    this._predicates.push({
      type: predicate.type || 'custom',
      ...predicate
    });
    return this;
  }

  /**
   * Add a join operator
   */
  addOperator(operator) {
    if (!operator) {
      throw new Error('Operator specification is required');
    }
    if (!operator.type) {
      throw new Error('Operator must have a type');
    }
    
    this._operators.push(operator);
    return this;
  }

  /**
   * Set the variable order
   */
  setVariableOrder(order) {
    if (!Array.isArray(order)) {
      throw new Error('Variable order must be an array');
    }
    this._variableOrder = order;
    return this;
  }

  /**
   * Set the return variables
   */
  setReturnVariables(variables) {
    if (!Array.isArray(variables)) {
      throw new Error('Return variables must be an array');
    }
    this._returnVariables = variables;
    return this;
  }

  /**
   * Build the final GraphSpec
   */
  build() {
    return {
      queryId: this._queryId,
      variables: Array.from(this._variables.values()),
      edges: this._edges,
      constraints: this._constraints,
      predicates: this._predicates,
      operators: this._operators,
      variableOrder: this._variableOrder,
      returnVariables: this._returnVariables
    };
  }

  /**
   * Convert to kernel-compatible format
   */
  toKernelFormat() {
    // For kernel, we need to structure as operators and relations
    const kernelSpec = {
      queryId: this._queryId,
      relations: new Map(),
      operators: [],
      variableOrder: this._variableOrder,
      outputVariables: this._returnVariables
    };

    // Group edges by relation
    for (const edge of this._edges) {
      if (!kernelSpec.relations.has(edge.relation)) {
        kernelSpec.relations.set(edge.relation, {
          name: edge.relation,
          edges: []
        });
      }
      kernelSpec.relations.get(edge.relation).edges.push({
        direction: edge.direction,
        source: edge.source,
        target: edge.target
      });
    }

    // Create join operators for multi-edge patterns
    if (this._edges.length > 1) {
      kernelSpec.operators.push({
        type: 'join',
        edges: this._edges.map(e => ({
          relation: e.relation,
          direction: e.direction,
          source: e.source,
          target: e.target
        }))
      });
    }

    // Add constraint operators
    for (const constraint of this._constraints) {
      kernelSpec.operators.push({
        type: 'filter',
        constraint: constraint
      });
    }

    // Add predicate operators
    for (const predicate of this._predicates) {
      kernelSpec.operators.push({
        type: 'predicate',
        predicate: predicate
      });
    }

    return kernelSpec;
  }
}

/**
 * Builder for constructing GraphSpec from PathQuery
 */
export class GraphSpecBuilder {
  /**
   * Build GraphSpec from PathQuery
   */
  static fromPathQuery(pathQuery) {
    if (!pathQuery) {
      throw new Error('PathQuery is required');
    }

    const spec = new GraphSpec();
    spec.setQueryId(pathQuery.queryId);

    // Add all variables
    const allVars = pathQuery.getAllVariables();
    for (const variable of allVars) {
      spec.addVariable(variable.name, {
        isBound: variable.isBound,
        value: variable.value,
        type: variable.isBound ? 'bound' : 'free'
      });
    }

    // Convert steps to edges and constraints
    let currentVar = pathQuery.startVariable;
    const steps = pathQuery.steps;
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const nextVarName = `?v${i + 1}`;
      const nextVar = allVars.find(v => v.name === nextVarName);
      
      const variableMap = {
        current: currentVar.name,
        next: nextVar ? nextVar.name : nextVarName
      };
      
      const stepSpec = step.toGraphSpec(variableMap);
      
      if (stepSpec.type === 'edge') {
        spec.addEdge(stepSpec);
      } else if (stepSpec.type === 'constraint') {
        spec.addConstraint(stepSpec);
      }
      
      if (nextVar) {
        currentVar = nextVar;
      }
    }

    // Add predicates
    for (const predicate of pathQuery.predicates) {
      spec.addPredicate(predicate);
    }

    // Set variable order
    const variableOrder = pathQuery.generateVariableOrder();
    spec.setVariableOrder(variableOrder.map(v => v.name));

    // Set return variables
    spec.setReturnVariables(pathQuery.returnVariables.map(v => v.name));

    return spec;
  }

  /**
   * Optimize GraphSpec for kernel execution
   */
  static optimize(graphSpec) {
    // For MVP, no optimization - just validate
    const spec = graphSpec.build();
    
    // Ensure all variables in edges are declared
    const declaredVars = new Set(spec.variables.map(v => v.name));
    
    for (const edge of spec.edges) {
      if (!declaredVars.has(edge.source)) {
        throw new Error(`Undeclared variable in edge: ${edge.source}`);
      }
      if (!declaredVars.has(edge.target)) {
        throw new Error(`Undeclared variable in edge: ${edge.target}`);
      }
    }
    
    for (const constraint of spec.constraints) {
      if (!declaredVars.has(constraint.variable)) {
        throw new Error(`Undeclared variable in constraint: ${constraint.variable}`);
      }
    }
    
    return graphSpec;
  }

  /**
   * Create GraphSpec for a simple path query
   * Helper method for common case
   */
  static createSimplePath(startVar, relationPath, returnVars = []) {
    const spec = new GraphSpec();
    spec.setQueryId(`simple_path_${Date.now()}`);
    
    // Add start variable
    spec.addVariable(startVar, { type: 'free' });
    
    // Build path
    let currentVar = startVar;
    for (let i = 0; i < relationPath.length; i++) {
      const relation = relationPath[i];
      const nextVar = `?v${i + 1}`;
      
      spec.addVariable(nextVar, { type: 'free' });
      
      if (relation.startsWith('^')) {
        // Inverse relation
        spec.addEdge({
          relation: relation.substring(1),
          direction: 'backward',
          source: currentVar,
          target: nextVar
        });
      } else {
        // Forward relation
        spec.addEdge({
          relation: relation,
          direction: 'forward',
          source: currentVar,
          target: nextVar
        });
      }
      
      currentVar = nextVar;
    }
    
    // Set variable order
    const order = [startVar];
    for (let i = 0; i < relationPath.length; i++) {
      order.push(`?v${i + 1}`);
    }
    spec.setVariableOrder(order);
    
    // Set return variables
    spec.setReturnVariables(returnVars.length > 0 ? returnVars : order);
    
    return spec;
  }

  /**
   * Build a Union of multiple GraphSpecs
   * Per design §7.3: Union operator for disjunction
   */
  buildUnion(specs) {
    if (!Array.isArray(specs) || specs.length === 0) {
      throw new Error('At least one spec is required for union');
    }

    const unionSpec = new GraphSpec();
    unionSpec.setQueryId(`union_${Date.now()}`);
    unionSpec._operator = 'union';
    unionSpec._operands = specs;

    // Collect all variables from operand specs
    const allVars = new Set();
    specs.forEach(spec => {
      spec._variables.forEach((info, name) => {
        allVars.add(name);
        if (!unionSpec._variables.has(name)) {
          unionSpec.addVariable(name, info);
        }
      });
    });

    // Union should return the union of all return variables
    const returnVars = new Set();
    specs.forEach(spec => {
      spec._returnVariables.forEach(v => returnVars.add(v));
    });
    unionSpec.setReturnVariables(Array.from(returnVars));

    return unionSpec;
  }

  /**
   * Build a Difference of two GraphSpecs
   * Per design §7.3: Diff operator for exclusion
   */
  buildDifference(includeSpec, excludeSpec) {
    if (!includeSpec) {
      throw new Error('Include spec is required');
    }
    if (!excludeSpec) {
      throw new Error('Exclude spec is required');
    }

    const diffSpec = new GraphSpec();
    diffSpec.setQueryId(`difference_${Date.now()}`);
    diffSpec._operator = 'difference';
    diffSpec._includeOperand = includeSpec;
    diffSpec._excludeOperand = excludeSpec;

    // Use variables from include spec
    includeSpec._variables.forEach((info, name) => {
      diffSpec.addVariable(name, info);
    });

    // Return variables from include spec
    diffSpec.setReturnVariables(includeSpec._returnVariables);

    return diffSpec;
  }
}

/**
 * Variable order optimizer for join ordering
 * Per design: determines optimal variable ordering for LFTJ
 */
export class VariableOrderOptimizer {
  /**
   * Determine optimal variable order for query execution
   * For MVP: use simple heuristics
   */
  static optimize(graphSpec) {
    const spec = graphSpec.build();
    const order = [];
    
    // Start with bound variables
    const boundVars = spec.variables
      .filter(v => v.isBound)
      .map(v => v.name);
    
    // Then add variables in path order
    const unorderedVars = new Set(spec.variables.map(v => v.name));
    boundVars.forEach(v => unorderedVars.delete(v));
    
    // Add bound variables first
    order.push(...boundVars);
    
    // Add remaining variables based on edge connectivity
    while (unorderedVars.size > 0) {
      let added = false;
      
      for (const varName of unorderedVars) {
        // Check if this variable connects to an ordered variable
        const connects = spec.edges.some(edge => {
          return (order.includes(edge.source) && edge.target === varName) ||
                 (order.includes(edge.target) && edge.source === varName);
        });
        
        if (connects) {
          order.push(varName);
          unorderedVars.delete(varName);
          added = true;
          break;
        }
      }
      
      // If no variable connects, just add the first one
      if (!added && unorderedVars.size > 0) {
        const firstVar = unorderedVars.values().next().value;
        order.push(firstVar);
        unorderedVars.delete(firstVar);
      }
    }
    
    return order;
  }

  /**
   * Estimate cost of variable order
   * For MVP: simple heuristic based on bound variables first
   */
  static estimateCost(variableOrder, graphSpec) {
    const spec = graphSpec.build();
    let cost = 0;
    
    // Bound variables early = lower cost
    for (let i = 0; i < variableOrder.length; i++) {
      const varName = variableOrder[i];
      const variable = spec.variables.find(v => v.name === varName);
      
      if (variable && variable.isBound) {
        // Bound variables early reduce search space
        cost += i; // Lower index = better
      } else {
        // Free variables later = higher cost
        cost += (variableOrder.length - i) * 10;
      }
    }
    
    return cost;
  }
}