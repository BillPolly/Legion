/**
 * CypherQueryBuilder - Fluent interface for constructing Cypher queries
 * 
 * Provides type-safe, programmatic construction of Cypher queries with:
 * - Method chaining for readable query building
 * - Parameter validation and sanitization
 * - Query optimization hints
 * - Result transformation support
 */

import { QueryValidator } from './QueryValidator.js';

export class CypherQueryBuilder {
  constructor(dataSource = null) {
    this.validator = new QueryValidator();
    this.dataSource = dataSource;
    this.reset();
  }

  /**
   * Reset the builder to start a new query
   */
  reset() {
    this.queryParts = {
      match: [],
      where: [],
      create: [],
      merge: [],
      set: [],
      delete: [],
      detachDelete: false,
      remove: [],
      with: [],
      unwind: [],
      return: [],
      orderBy: [],
      skip: null,
      limit: null,
      union: []
    };
    this.parameters = {};
    this.paramCounter = 0;
    return this;
  }

  /**
   * MATCH clause - pattern matching
   */
  match(pattern, alias = null) {
    this.queryParts.match.push({
      pattern,
      alias,
      optional: false
    });
    return this;
  }

  /**
   * OPTIONAL MATCH clause
   */
  optionalMatch(pattern, alias = null) {
    this.queryParts.match.push({
      pattern,
      alias,
      optional: true
    });
    return this;
  }

  /**
   * WHERE clause - filtering conditions
   */
  where(condition, params = {}) {
    this.queryParts.where.push(condition);
    this._addParameters(params);
    return this;
  }

  /**
   * AND condition (combines with existing WHERE)
   */
  andWhere(condition, params = {}) {
    if (this.queryParts.where.length > 0) {
      const lastCondition = this.queryParts.where.pop();
      this.queryParts.where.push(`(${lastCondition}) AND (${condition})`);
    } else {
      this.queryParts.where.push(condition);
    }
    this._addParameters(params);
    return this;
  }

  /**
   * OR condition
   */
  orWhere(condition, params = {}) {
    if (this.queryParts.where.length > 0) {
      const lastCondition = this.queryParts.where.pop();
      this.queryParts.where.push(`(${lastCondition}) OR (${condition})`);
    } else {
      this.queryParts.where.push(condition);
    }
    this._addParameters(params);
    return this;
  }

  /**
   * CREATE clause - create new nodes/relationships
   */
  create(pattern, params = {}) {
    this.queryParts.create.push(pattern);
    this._addParameters(params);
    return this;
  }

  /**
   * MERGE clause - create or match
   */
  merge(pattern, params = {}) {
    this.queryParts.merge.push(pattern);
    this._addParameters(params);
    return this;
  }

  /**
   * SET clause - update properties
   */
  set(assignments, params = {}) {
    if (Array.isArray(assignments)) {
      this.queryParts.set.push(...assignments);
    } else {
      this.queryParts.set.push(assignments);
    }
    this._addParameters(params);
    return this;
  }

  /**
   * DELETE clause - delete nodes/relationships
   */
  delete(targets) {
    if (Array.isArray(targets)) {
      this.queryParts.delete.push(...targets);
    } else {
      this.queryParts.delete.push(targets);
    }
    return this;
  }

  /**
   * DETACH DELETE clause
   */
  detachDelete(targets) {
    const deleteTargets = Array.isArray(targets) ? targets : [targets];
    this.queryParts.delete.push(...deleteTargets.map(target => target));
    this.queryParts.detachDelete = true;
    return this;
  }

  /**
   * REMOVE clause - remove properties/labels
   */
  remove(targets) {
    if (Array.isArray(targets)) {
      this.queryParts.remove.push(...targets);
    } else {
      this.queryParts.remove.push(targets);
    }
    return this;
  }

  /**
   * WITH clause - pipe results to next part of query
   */
  with(expressions, params = {}) {
    if (Array.isArray(expressions)) {
      this.queryParts.with.push(...expressions);
    } else {
      this.queryParts.with.push(expressions);
    }
    this._addParameters(params);
    return this;
  }

  /**
   * UNWIND clause - expand lists
   */
  unwind(expression, alias) {
    this.queryParts.unwind.push(`${expression} AS ${alias}`);
    return this;
  }

  /**
   * RETURN clause - specify what to return
   */
  return(expressions, params = {}) {
    if (Array.isArray(expressions)) {
      this.queryParts.return.push(...expressions);
    } else {
      this.queryParts.return.push(expressions);
    }
    this._addParameters(params);
    return this;
  }

  /**
   * ORDER BY clause
   */
  orderBy(expression, direction = 'ASC') {
    this.queryParts.orderBy.push(`${expression} ${direction.toUpperCase()}`);
    return this;
  }

  /**
   * SKIP clause
   */
  skip(count) {
    this.queryParts.skip = count;
    return this;
  }

  /**
   * LIMIT clause
   */
  limit(count) {
    this.queryParts.limit = count;
    return this;
  }

  /**
   * UNION clause for combining queries
   */
  union(otherBuilder, all = false) {
    const unionType = all ? 'UNION ALL' : 'UNION';
    this.queryParts.union.push({
      type: unionType,
      query: otherBuilder.build()
    });
    // Merge parameters from other builder
    this._addParameters(otherBuilder.getParameters());
    return this;
  }

  /**
   * Helper methods for common patterns
   */

  /**
   * Find nodes by label and properties
   */
  findNodes(label, properties = {}, alias = 'n') {
    let pattern = `(${alias}:${label}`;
    if (Object.keys(properties).length > 0) {
      const propParams = this._createPropertyParams(properties);
      pattern += ` {${Object.keys(properties).map(key => `${key}: $${propParams[key]}`).join(', ')}}`;
      this._addParameters(propParams);
    }
    pattern += ')';
    return this.match(pattern);
  }

  /**
   * Find relationships between nodes
   */
  findRelationship(fromAlias, relationshipType, toAlias, direction = 'outgoing', relAlias = 'r') {
    let pattern;
    const relPart = relAlias ? `[${relAlias}:${relationshipType}]` : `[:${relationshipType}]`;
    
    switch (direction) {
      case 'incoming':
        pattern = `(${fromAlias})<-${relPart}-(${toAlias})`;
        break;
      case 'outgoing':
        pattern = `(${fromAlias})-${relPart}->(${toAlias})`;
        break;
      case 'any':
        pattern = `(${fromAlias})-${relPart}-(${toAlias})`;
        break;
      default:
        pattern = `(${fromAlias})-${relPart}->(${toAlias})`;
    }
    
    return this.match(pattern);
  }

  /**
   * Create node with properties
   */
  createNode(label, properties = {}, alias = 'n') {
    let pattern = `(${alias}:${label}`;
    if (Object.keys(properties).length > 0) {
      const propParams = this._createPropertyParams(properties);
      pattern += ` {${Object.keys(properties).map(key => `${key}: $${propParams[key]}`).join(', ')}}`;
      this._addParameters(propParams);
    }
    pattern += ')';
    return this.create(pattern);
  }

  /**
   * Update node properties
   */
  updateNodeProperties(alias, properties) {
    const propParams = this._createPropertyParams(properties);
    const assignments = Object.keys(properties).map(key => `${alias}.${key} = $${propParams[key]}`);
    this._addParameters(propParams);
    return this.set(assignments);
  }

  /**
   * Add parameter with auto-generated name
   */
  addParameter(value) {
    const paramName = `param_${++this.paramCounter}`;
    this.parameters[paramName] = value;
    return paramName;
  }

  /**
   * Get all parameters
   */
  getParameters() {
    return { ...this.parameters };
  }

  /**
   * Build and return the complete Cypher query
   */
  build() {
    const queryParts = [];
    
    // MATCH clauses
    if (this.queryParts.match.length > 0) {
      for (const match of this.queryParts.match) {
        const matchType = match.optional ? 'OPTIONAL MATCH' : 'MATCH';
        queryParts.push(`${matchType} ${match.pattern}`);
      }
    }

    // CREATE clauses
    if (this.queryParts.create.length > 0) {
      queryParts.push(`CREATE ${this.queryParts.create.join(', ')}`);
    }

    // MERGE clauses
    if (this.queryParts.merge.length > 0) {
      queryParts.push(`MERGE ${this.queryParts.merge.join(', ')}`);
    }

    // WHERE clauses
    if (this.queryParts.where.length > 0) {
      queryParts.push(`WHERE ${this.queryParts.where.join(' AND ')}`);
    }

    // SET clauses
    if (this.queryParts.set.length > 0) {
      queryParts.push(`SET ${this.queryParts.set.join(', ')}`);
    }

    // REMOVE clauses
    if (this.queryParts.remove.length > 0) {
      queryParts.push(`REMOVE ${this.queryParts.remove.join(', ')}`);
    }

    // DELETE clauses
    if (this.queryParts.delete.length > 0) {
      const deleteClause = this.queryParts.detachDelete 
        ? `DETACH DELETE ${this.queryParts.delete.join(', ')}`
        : `DELETE ${this.queryParts.delete.join(', ')}`;
      queryParts.push(deleteClause);
    }

    // WITH clauses
    if (this.queryParts.with.length > 0) {
      queryParts.push(`WITH ${this.queryParts.with.join(', ')}`);
    }

    // UNWIND clauses
    if (this.queryParts.unwind.length > 0) {
      for (const unwind of this.queryParts.unwind) {
        queryParts.push(`UNWIND ${unwind}`);
      }
    }

    // RETURN clause
    if (this.queryParts.return.length > 0) {
      queryParts.push(`RETURN ${this.queryParts.return.join(', ')}`);
    }

    // ORDER BY clause
    if (this.queryParts.orderBy.length > 0) {
      queryParts.push(`ORDER BY ${this.queryParts.orderBy.join(', ')}`);
    }

    // SKIP clause
    if (this.queryParts.skip !== null) {
      queryParts.push(`SKIP ${this.queryParts.skip}`);
    }

    // LIMIT clause
    if (this.queryParts.limit !== null) {
      queryParts.push(`LIMIT ${this.queryParts.limit}`);
    }

    const baseQuery = queryParts.join('\n');
    
    // UNION clauses
    if (this.queryParts.union.length > 0) {
      const allQueries = [baseQuery];
      for (const union of this.queryParts.union) {
        allQueries.push(union.type);
        allQueries.push(union.query.cypher);
      }
      return {
        cypher: allQueries.join('\n'),
        parameters: this.getParameters()
      };
    }

    return {
      cypher: baseQuery,
      parameters: this.getParameters()
    };
  }

  /**
   * Validate the current query
   */
  validate() {
    const query = this.build();
    return this.validator.validateCypher(query.cypher, query.parameters);
  }
  
  /**
   * Check if the current query is safe to execute
   */
  isSafe() {
    const query = this.build();
    return this.validator.isQuerySafe(query.cypher);
  }
  
  /**
   * Get optimization recommendations for the current query
   */
  getOptimizationRecommendations() {
    const query = this.build();
    return this.validator.getOptimizationRecommendations(query.cypher);
  }
  
  /**
   * Execute the query using a DataSource
   */
  async execute(dataSource, options = {}) {
    const { validate = true, throwOnWarnings = false } = options;
    const query = this.build();
    
    if (validate) {
      const validation = this.validator.validateCypher(query.cypher, query.parameters);
      
      if (validation.errors.length > 0) {
        throw new Error(`Query validation failed: ${validation.errors.join(', ')}`);
      }
      
      if (throwOnWarnings && validation.warnings.length > 0) {
        throw new Error(`Query validation warnings: ${validation.warnings.join(', ')}`);
      }
      
      // Log warnings if present
      if (validation.warnings.length > 0) {
        console.warn('[CypherQueryBuilder] Query warnings:', validation.warnings);
      }
    }
    
    return await dataSource.queryAsync({
      type: 'cypher',
      query: query.cypher,
      params: query.parameters
    });
  }

  /**
   * Private helper methods
   */
  _addParameters(params) {
    Object.assign(this.parameters, params);
  }

  _createPropertyParams(properties) {
    const params = {};
    for (const [key, value] of Object.entries(properties)) {
      const paramName = this.addParameter(value);
      params[key] = paramName;
    }
    return params;
  }

  /**
   * Static factory methods for common use cases
   */
  static findNode(label, properties = {}) {
    return new CypherQueryBuilder().findNodes(label, properties);
  }

  static createNode(label, properties = {}) {
    return new CypherQueryBuilder().createNode(label, properties);
  }

  static deleteNode(label, properties = {}) {
    return new CypherQueryBuilder()
      .findNodes(label, properties)
      .detachDelete('n');
  }

  static updateNode(label, findProperties, updateProperties) {
    return new CypherQueryBuilder()
      .findNodes(label, findProperties)
      .updateNodeProperties('n', updateProperties)
      .return('n');
  }
}