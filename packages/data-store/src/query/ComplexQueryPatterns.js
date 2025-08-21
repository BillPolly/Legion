/**
 * Complex Query Patterns implementation
 * Per design §7: Kernel Graph Patterns for Store Queries
 * 
 * This module implements advanced query patterns including:
 * - Simple forward paths
 * - Inverse step handling
 * - Disjunction (OR) and exclusion (NOT)
 * - Predicate subqueries
 * - Pointwise filter placement
 */

import { PathQuery, Variable } from './PathQuery.js';
import { ForwardStep, InverseStep } from './PathStep.js';
import { GraphSpecBuilder } from './GraphSpecBuilder.js';
import { PredicateProvider, OrPredicate, NotPredicate, IsTypePredicate } from './PredicateProvider.js';

/**
 * Complex query pattern builder
 * Per design §7: Implements various query patterns for the kernel
 */
export class ComplexQueryPatterns {
  constructor() {
    this._graphBuilder = new GraphSpecBuilder();
    this._predicateProviders = new Map();
  }

  /**
   * Register a predicate provider
   */
  registerPredicateProvider(name, provider) {
    if (!name) {
      throw new Error('Predicate name is required');
    }
    if (!provider) {
      throw new Error('Predicate provider is required');
    }
    this._predicateProviders.set(name, provider);
    return this;
  }

  /**
   * Build a simple forward path query
   * Per design §7.1: Simple forward path
   * Path: root / A / B / C → {v3}
   */
  buildSimpleForwardPath(attributes, rootValue = null) {
    if (!Array.isArray(attributes) || attributes.length === 0) {
      throw new Error('Attributes array is required');
    }

    const query = new PathQuery({ startVariable: new Variable('?v0') });
    
    // Bind root value if provided
    if (rootValue !== null) {
      query.startVariable.bind(rootValue);
    }
    
    // Build path steps
    attributes.forEach((attr, index) => {
      const step = new ForwardStep(attr);
      query.addStep(step);
    });
    
    // Set return variable to the last one
    const lastVar = new Variable(`?v${attributes.length}`);
    query.setReturnVariables([lastVar]);
    
    return GraphSpecBuilder.fromPathQuery(query);
  }

  /**
   * Build a path with inverse steps
   * Per design §7.2: Path with inverse step
   * Path: root / A / ^B / C → {v3}
   */
  buildPathWithInverse(pathSpec, rootValue = null) {
    if (!Array.isArray(pathSpec) || pathSpec.length === 0) {
      throw new Error('Path specification array is required');
    }

    const query = new PathQuery({ startVariable: new Variable('?v0') });
    
    // Bind root value if provided
    if (rootValue !== null) {
      query.startVariable.bind(rootValue);
    }
    
    // Build path with support for inverse steps
    pathSpec.forEach((spec, index) => {
      
      let step;
      if (typeof spec === 'string') {
        // Check for inverse marker
        if (spec.startsWith('^')) {
          const attr = spec.substring(1);
          step = new InverseStep(attr);
        } else {
          step = new ForwardStep(spec);
        }
      } else if (typeof spec === 'object') {
        // Object spec with explicit direction
        if (spec.direction === 'inverse') {
          step = new InverseStep(spec.attribute);
        } else {
          step = new ForwardStep(spec.attribute);
        }
      } else {
        throw new Error(`Invalid path spec at index ${index}: ${spec}`);
      }
      
      query.addStep(step);
    });
    
    // Set return variable to the last one
    const lastVar = new Variable(`?v${pathSpec.length}`);
    query.setReturnVariables([lastVar]);
    
    return GraphSpecBuilder.fromPathQuery(query);
  }

  /**
   * Build a disjunction query (OR)
   * Per design §7.3: Disjunction and exclusion
   * ( /A/B OR /D ) AND NOT (/E)
   */
  buildDisjunctionQuery(branches, exclusions = [], rootValue = null) {
    if (!Array.isArray(branches) || branches.length === 0) {
      throw new Error('At least one branch is required for disjunction');
    }

    // Build individual branch queries
    const branchQueries = branches.map((branch, branchIndex) => {
      const query = new PathQuery();
      
      // Create root variable
      const rootVar = new Variable(`?root_${branchIndex}`);
      if (rootValue !== null) {
        rootVar.bind(rootValue);
      }
      
      // Build path for this branch
      let currentVar = rootVar;
      if (Array.isArray(branch)) {
        // Branch is a path of attributes
        branch.forEach((attr, stepIndex) => {
          const nextVar = new Variable(`?v_${branchIndex}_${stepIndex + 1}`);
          const step = new ForwardStep(attr);
          query.addStep(step);
          currentVar = nextVar;
        });
      } else if (typeof branch === 'string') {
        // Single attribute branch
        const nextVar = new Variable(`?v_${branchIndex}_1`);
        const step = new ForwardStep(branch);
        query.addStep(step);
        currentVar = nextVar;
      } else {
        throw new Error(`Invalid branch at index ${branchIndex}`);
      }
      
      query.setReturnVariables([currentVar]);
      return query;
    });

    // Create OR predicate for branches
    const orPredicate = new OrPredicate(
      branchQueries.map(q => this._createPredicateFromQuery(q))
    );

    // Build main query with disjunction
    const mainQuery = new PathQuery();
    mainQuery.addPredicate(orPredicate);

    // Add exclusions (NOT predicates)
    exclusions.forEach((exclusion, index) => {
      const excludeQuery = this._buildExclusionQuery(exclusion, index, rootValue);
      const notPredicate = new NotPredicate(
        this._createPredicateFromQuery(excludeQuery)
      );
      mainQuery.addPredicate(notPredicate);
    });

    // Set return variables based on branches
    const returnVars = branchQueries[0].returnVariables;
    mainQuery.setReturnVariables(returnVars);

    return GraphSpecBuilder.fromPathQuery(mainQuery);
  }

  /**
   * Build a query with predicate subqueries
   * Per design §7.4: Predicates as subqueries
   * /A/ (exists subpath Q(x))
   */
  buildPredicateSubquery(mainPath, subqueries, rootValue = null) {
    if (!Array.isArray(mainPath) || mainPath.length === 0) {
      throw new Error('Main path is required');
    }
    if (!Array.isArray(subqueries) || subqueries.length === 0) {
      throw new Error('At least one subquery is required');
    }

    const query = new PathQuery();
    
    // Build main path
    const rootVar = new Variable('?v0');
    if (rootValue !== null) {
      rootVar.bind(rootValue);
    }
    
    let currentVar = rootVar;
    const pathVars = [rootVar];
    
    mainPath.forEach((attr, index) => {
      const nextVar = new Variable(`?v${index + 1}`);
      const step = new ForwardStep(attr);
      query.addStep(step);
      pathVars.push(nextVar);
      currentVar = nextVar;
    });

    // Add subqueries as predicates
    subqueries.forEach((subquery, index) => {
      const predicate = this._buildSubqueryPredicate(
        subquery,
        pathVars,
        index
      );
      query.addPredicate(predicate);
    });

    // Set return variables
    query.setReturnVariables([currentVar]);
    
    return GraphSpecBuilder.fromPathQuery(query);
  }

  /**
   * Build a query with pointwise filters
   * Per design §7.5: Pointwise filters
   * /A/B where Score(a,b) > threshold
   */
  buildPointwiseFilterQuery(path, filters, rootValue = null) {
    if (!Array.isArray(path) || path.length === 0) {
      throw new Error('Path is required');
    }
    if (!Array.isArray(filters) || filters.length === 0) {
      throw new Error('At least one filter is required');
    }

    const query = new PathQuery();
    
    // Build path
    const rootVar = new Variable('?v0');
    if (rootValue !== null) {
      rootVar.bind(rootValue);
    }
    
    let currentVar = rootVar;
    const pathVars = [rootVar];
    
    path.forEach((attr, index) => {
      const nextVar = new Variable(`?v${index + 1}`);
      const step = new ForwardStep(attr);
      query.addStep(step);
      pathVars.push(nextVar);
      currentVar = nextVar;
    });

    // Add pointwise filters as predicates
    filters.forEach((filter) => {
      const filterPredicate = this._createPointwiseFilter(
        filter,
        pathVars
      );
      query.addPredicate(filterPredicate);
    });

    // Set return variables
    query.setReturnVariables([currentVar]);
    
    return GraphSpecBuilder.fromPathQuery(query);
  }

  /**
   * Create a union of multiple queries
   * Per design: Union operator for combining results
   */
  buildUnionQuery(queries) {
    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error('At least one query is required for union');
    }

    // Build GraphSpecs for each query
    const specs = queries.map(q => {
      if (q instanceof PathQuery) {
        return GraphSpecBuilder.fromPathQuery(q);
      } else {
        // Assume it's already a GraphSpec
        return q;
      }
    });

    // Create union GraphSpec
    const builder = new GraphSpecBuilder();
    const unionSpec = builder.buildUnion(specs);
    return unionSpec;
  }

  /**
   * Create a difference query (set exclusion)
   * Per design: Diff operator for exclusion
   */
  buildDifferenceQuery(includeQuery, excludeQuery) {
    if (!includeQuery) {
      throw new Error('Include query is required');
    }
    if (!excludeQuery) {
      throw new Error('Exclude query is required');
    }

    const includeSpec = includeQuery instanceof PathQuery
      ? GraphSpecBuilder.fromPathQuery(includeQuery)
      : includeQuery;
      
    const excludeSpec = excludeQuery instanceof PathQuery
      ? GraphSpecBuilder.fromPathQuery(excludeQuery)
      : excludeQuery;

    // Create difference GraphSpec
    const builder = new GraphSpecBuilder();
    const diffSpec = builder.buildDifference(
      includeSpec,
      excludeSpec
    );
    return diffSpec;
  }

  // === PRIVATE METHODS ===

  /**
   * Build an exclusion query for NOT predicates
   */
  _buildExclusionQuery(exclusion, index, rootValue) {
    const query = new PathQuery();
    
    const rootVar = new Variable(`?excl_root_${index}`);
    if (rootValue !== null) {
      rootVar.bind(rootValue);
    }
    
    let currentVar = rootVar;
    
    if (Array.isArray(exclusion)) {
      // Exclusion is a path
      exclusion.forEach((attr, stepIndex) => {
        const nextVar = new Variable(`?excl_${index}_${stepIndex + 1}`);
        const step = new ForwardStep(attr);
        query.addStep(step);
        currentVar = nextVar;
      });
    } else if (typeof exclusion === 'string') {
      // Single attribute exclusion
      const nextVar = new Variable(`?excl_${index}_1`);
      const step = new ForwardStep(exclusion);
      query.addStep(step);
      currentVar = nextVar;
    }
    
    query.setReturnVariables([currentVar]);
    return query;
  }

  /**
   * Create a predicate from a query
   */
  _createPredicateFromQuery(query) {
    // Create a custom predicate that evaluates based on query results
    return new QueryPredicate(query, this._graphBuilder);
  }

  /**
   * Build a subquery predicate
   */
  _buildSubqueryPredicate(subquery, pathVars, index) {
    const { path, bindTo, exists = true } = subquery;
    
    if (!path || !Array.isArray(path)) {
      throw new Error(`Invalid subquery path at index ${index}`);
    }
    if (typeof bindTo !== 'number' || bindTo >= pathVars.length) {
      throw new Error(`Invalid bindTo index in subquery ${index}`);
    }

    // Build subquery starting from the bound variable
    const query = new PathQuery();
    const startVar = pathVars[bindTo];
    
    let currentVar = startVar;
    path.forEach((attr, stepIndex) => {
      const nextVar = new Variable(`?sub_${index}_${stepIndex + 1}`);
      const step = new ForwardStep(attr);
      query.addStep(step);
      currentVar = nextVar;
    });
    
    query.setReturnVariables([currentVar]);
    
    // Create exists or not-exists predicate
    const queryPredicate = this._createPredicateFromQuery(query);
    return exists ? queryPredicate : new NotPredicate(queryPredicate);
  }

  /**
   * Create a pointwise filter predicate
   */
  _createPointwiseFilter(filter, pathVars) {
    const { function: fnName, variables, operator, threshold } = filter;
    
    if (!fnName) {
      throw new Error('Filter function name is required');
    }
    if (!Array.isArray(variables) || variables.length === 0) {
      throw new Error('Filter variables are required');
    }
    if (!operator) {
      throw new Error('Filter operator is required');
    }
    
    // Map variable indices to actual variables
    const filterVars = variables.map(index => {
      if (typeof index !== 'number' || index >= pathVars.length) {
        throw new Error(`Invalid variable index ${index} in filter`);
      }
      return pathVars[index];
    });
    
    // Create pointwise predicate
    return new PointwiseFilterPredicate(
      fnName,
      filterVars,
      operator,
      threshold
    );
  }

  /**
   * Get registered predicate providers
   */
  getPredicateProviders() {
    return Array.from(this._predicateProviders.entries());
  }

  /**
   * Clear all predicate providers
   */
  clearPredicateProviders() {
    this._predicateProviders.clear();
  }
}

/**
 * Query-based predicate
 * Evaluates based on query results
 */
class QueryPredicate extends PredicateProvider {
  constructor(query, graphBuilder) {
    super(`QueryPredicate_${Date.now()}`);
    this._query = query;
    this._graphBuilder = graphBuilder;
    this._results = new Set();
  }

  get type() {
    return 'enumerable';
  }

  getName() {
    return `QueryPredicate_${this._query.toString()}`;
  }

  async enumerate() {
    // Build and execute query to get results
    const spec = GraphSpecBuilder.fromPathQuery(this._query);
    // In real implementation, this would execute against the kernel
    // For now, return empty set
    return Array.from(this._results);
  }

  async evaluate(tuple) {
    const results = await this.enumerate();
    return results.some(r => this._tuplesMatch(r, tuple));
  }

  _tuplesMatch(t1, t2) {
    if (t1.length !== t2.length) return false;
    return t1.every((v, i) => v === t2[i]);
  }
}

/**
 * Pointwise filter predicate
 * Evaluates a function on bound variables
 */
class PointwiseFilterPredicate extends PredicateProvider {
  constructor(functionName, variables, operator, threshold) {
    super(`PointwiseFilter_${functionName}_${Date.now()}`);
    this._functionName = functionName;
    this._variables = variables;
    this._operator = operator;
    this._threshold = threshold;
    this._evaluator = null;
  }

  get type() {
    return 'pointwise';
  }

  getName() {
    return `PointwiseFilter_${this._functionName}`;
  }

  setEvaluator(fn) {
    this._evaluator = fn;
    return this;
  }

  async evaluate(bindings) {
    if (!this._evaluator) {
      throw new Error(`No evaluator set for ${this._functionName}`);
    }

    // Extract variable values from bindings
    const values = this._variables.map(v => {
      const value = bindings.get(v.name);
      if (value === undefined) {
        throw new Error(`Variable ${v.name} not bound`);
      }
      return value;
    });

    // Evaluate function
    const result = await this._evaluator(...values);

    // Apply operator
    switch (this._operator) {
      case '>':
        return result > this._threshold;
      case '<':
        return result < this._threshold;
      case '>=':
        return result >= this._threshold;
      case '<=':
        return result <= this._threshold;
      case '==':
      case '=':
        return result === this._threshold;
      case '!=':
        return result !== this._threshold;
      default:
        throw new Error(`Unknown operator: ${this._operator}`);
    }
  }

  isPointwise() {
    return true;
  }
}

// Export factory function
export function createComplexQueryPatterns() {
  return new ComplexQueryPatterns();
}