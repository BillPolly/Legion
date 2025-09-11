/**
 * QueryTypeDetector Class
 * Part of the unified proxy architecture - Phase 1, Step 1.3
 * 
 * Analyzes DataScript query structures to determine appropriate proxy type:
 * - StreamProxy: Single scalar values, aggregates, empty single-value queries
 * - EntityProxy: Single entity results, entity ID queries
 * - CollectionProxy: Multiple results, multi-variable queries, empty multi-value queries
 * 
 * Uses schema information for type inference and relationship analysis.
 * Provides detailed query analysis for optimization and debugging.
 */

export class QueryTypeDetector {
  constructor(store) {
    if (!store) {
      throw new Error('QueryTypeDetector requires DataStore instance');
    }
    
    if (!store.db || typeof store.db !== 'function') {
      throw new Error('QueryTypeDetector requires valid DataStore instance');
    }
    
    this.store = store;
    this.schema = store.schema || {};
  }

  /**
   * Main entry point: Determine proxy type based on query and results
   */
  detectProxyType(querySpec, results) {
    if (!querySpec) {
      throw new Error('Query spec is required');
    }
    
    if (!querySpec.find) {
      throw new Error('Query spec must have find clause');
    }
    
    if (!Array.isArray(querySpec.find) || querySpec.find.length === 0) {
      throw new Error('Find clause cannot be empty');
    }
    
    if (!querySpec.where) {
      throw new Error('Query spec must have where clause');
    }
    
    if (results === null || results === undefined) {
      throw new Error('Query results are required');
    }
    
    const analysis = this.analyzeQuery(querySpec);
    
    // Decision logic based on query STRUCTURE and SCHEMA, not result count!
    if (analysis.type === 'aggregate') {
      return 'StreamProxy'; // Aggregates always return single values
    }
    
    if (analysis.type === 'entity') {
      // Check if we're querying for an attribute with cardinality 'many'
      // This would mean we're getting multiple entities from a multi-valued reference
      const isQueryingManyRefs = this._isQueryingMultiValuedRefs(querySpec);
      
      if (isQueryingManyRefs) {
        return 'CollectionProxy'; // Always return collection for multi-valued refs
      }
      
      // Check if the query structure implies single entity (e.g., unique attribute lookup)
      const impliesSingleEntity = this._impliesSingleEntity(querySpec);
      
      if (impliesSingleEntity) {
        return 'EntityProxy'; // Query structure guarantees single entity
      }
      
      // For entity queries with result-based decisions:
      if (results.length === 0) {
        // Empty result - always return CollectionProxy for empty collections
        // This ensures consistent behavior and allows for chaining operations on empty collections
        return 'CollectionProxy';
      } else if (results.length === 1) {
        // Single entity result - return EntityProxy for direct entity access
        return 'EntityProxy';
      } else {
        return 'CollectionProxy'; // Multiple entities
      }
    }
    
    if (analysis.type === 'scalar') {
      // Check if the scalar attribute is multi-valued (card: 'many')
      const isMultiValued = this._isMultiValuedAttribute(analysis.scalarAttribute);
      
      if (isMultiValued) {
        return 'CollectionProxy'; // Multi-valued attributes always return collections
      }
      
      // For single-valued scalar attributes
      if (results.length === 0) {
        return 'StreamProxy'; // No value
      } else if (results.length === 1) {
        // Check if query structure could return multiple
        return this._couldReturnMultiple(querySpec) ? 'CollectionProxy' : 'StreamProxy';
      } else {
        return 'CollectionProxy'; // Multiple scalar values
      }
    }
    
    // Multi-variable and mixed queries always return collections
    if (analysis.type === 'multi-variable' || analysis.type === 'mixed') {
      return 'CollectionProxy';
    }
    
    // Default: analyze query potential
    return this._couldReturnMultiple(querySpec) ? 'CollectionProxy' : 'StreamProxy';
  }

  /**
   * Comprehensive query analysis
   */
  analyzeQuery(querySpec) {
    const findClause = querySpec.find;
    const whereClause = querySpec.where || [];
    
    const analysis = {
      findClause,
      whereClause,
      clauseCount: whereClause.length,
      variables: [],
      variableCount: 0,
      hasAggregates: false,
      hasVariables: false,
      hasJoins: false,
      hasFilters: false,
      joinDepth: 0,
      filterCount: 0,
      complexity: 'simple'
    };
    
    // Analyze find clause structure
    this._analyzeFindClause(findClause, analysis);
    
    // Analyze where clause for patterns
    this._analyzeWhereClause(whereClause, analysis);
    
    // Determine overall query type
    analysis.type = this._determineQueryType(analysis);
    
    // Calculate complexity
    analysis.complexity = this._calculateComplexity(analysis);
    
    return analysis;
  }

  /**
   * Check if query contains aggregate functions
   */
  isAggregateQuery(querySpec) {
    const findClause = querySpec.find;
    
    return findClause.some(item => {
      if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
        const expr = item[0];
        return this._isAggregateExpression(expr);
      }
      return false;
    });
  }

  /**
   * Check if query returns entity IDs
   */
  isEntityQuery(querySpec) {
    const findClause = querySpec.find;
    
    // Must be single variable
    if (findClause.length !== 1) {
      return false;
    }
    
    const variable = findClause[0];
    
    // Must be a variable (not aggregate)
    if (Array.isArray(variable)) {
      return false;
    }
    
    // Check if variable represents entity ID in where clause
    // Entity variables can appear as the first element (entity position) OR 
    // as the third element (value position) in entity-attribute-value clauses
    return this._isEntityVariable(variable, querySpec.where || []);
  }

  /**
   * Check if query returns scalar attributes
   */
  isScalarQuery(querySpec) {
    const findClause = querySpec.find;
    
    // Must be single variable
    if (findClause.length !== 1) {
      return false;
    }
    
    const variable = findClause[0];
    
    // Must be a variable (not aggregate)
    if (Array.isArray(variable)) {
      return false;
    }
    
    // Check if variable represents scalar attribute in where clause
    const attribute = this._getAttributeForVariable(variable, querySpec.where || []);
    if (attribute) {
      const attrAnalysis = this._analyzeAttribute(attribute);
      return !attrAnalysis.isReference;
    }
    
    return false;
  }

  /**
   * Analyze find clause structure
   * @private
   */
  _analyzeFindClause(findClause, analysis) {
    findClause.forEach(item => {
      if (Array.isArray(item)) {
        // Check if this is actually an aggregate function
        // Handle both old string format item[0] = '(count ?e)' and new array format item = ['count'] or ['sum', '?var']
        if (this._isAggregateExpression(item)) {
          analysis.hasAggregates = true;
          analysis.aggregateFunction = this._extractAggregateFunction(item);
        } else if (typeof item[0] === 'string' && this._isAggregateExpression(item[0])) {
          // Old string format where item[0] is '(count ?e)'
          analysis.hasAggregates = true;
          analysis.aggregateFunction = this._extractAggregateFunction(item[0]);
        }
        // If it's an array but not an aggregate, treat it as a complex expression (not implemented yet)
      } else if (typeof item === 'string') {
        // Variable
        analysis.hasVariables = true;
        analysis.variables.push(item);
      } else if (typeof item === 'number') {
        // Entity ID directly in find clause
        analysis.hasEntityId = true;
        analysis.entityId = item;
      }
    });
    
    analysis.variableCount = analysis.variables.length;
  }

  /**
   * Analyze where clause patterns
   * @private
   */
  _analyzeWhereClause(whereClause, analysis) {
    const entityVariables = new Set();
    const attributeMap = new Map(); // variable -> attribute
    const entityUsageCount = new Map(); // entity -> count of clauses using it
    let filterCount = 0;
    
    whereClause.forEach(clause => {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        
        // Track entity variables and their usage
        if (typeof entity === 'string' && entity.startsWith('?')) {
          entityVariables.add(entity);
          entityUsageCount.set(entity, (entityUsageCount.get(entity) || 0) + 1);
        }
        
        // Track attribute mappings
        if (typeof value === 'string' && value.startsWith('?')) {
          attributeMap.set(value, attribute);
        }
        
        // Detect filters (literal values)
        if (typeof value !== 'string' || !value.startsWith('?')) {
          filterCount++;
        }
      }
    });
    
    // Calculate join metrics more accurately
    let totalJoinPairs = 0;
    let joinEntities = 0;
    
    for (const [entity, usageCount] of entityUsageCount) {
      if (usageCount > 1) {
        totalJoinPairs += usageCount - 1; // Each additional usage beyond first creates a join
        joinEntities++; // Count entities participating in joins
      }
    }
    
    // Additional complexity from relationship traversal depth
    // Count the number of relationship traversals (entity -> ref attribute -> entity patterns)
    let relationshipTraversals = 0;
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        // A relationship traversal is when we go from entity to another entity via ref attribute
        if (typeof entity === 'string' && entity.startsWith('?') && 
            typeof value === 'string' && value.startsWith('?')) {
          // Check if this is actually a reference attribute (entity->entity relationship)
          const attrInfo = this._analyzeAttribute(attribute);
          if (attrInfo.isReference) {
            relationshipTraversals++;
          }
        }
      }
    }
    
    // Join depth should represent the conceptual depth of relationship traversals
    // A simple join like "post -> author -> name" has depth 2 (2 traversal steps)
    // Count the number of traversal steps by building entity dependency chains
    const traversalDepth = this._calculateTraversalDepth(whereClause);
    
    analysis.hasJoins = totalJoinPairs > 0 || relationshipTraversals > 0;
    analysis.joinDepth = Math.max(traversalDepth, totalJoinPairs);
    analysis.hasFilters = filterCount > 0;
    analysis.filterCount = filterCount;
    
    // Store attribute mappings for later use
    analysis.attributeMap = attributeMap;
    
    // Analyze specific patterns for entity and scalar detection
    if (analysis.variables.length === 1) {
      const variable = analysis.variables[0];
      
      // Check if variable appears as entity (first position in clauses)
      if (entityVariables.has(variable)) {
        analysis.entityVariable = variable;
      } else {
        // Check if variable appears as value in reference attributes (entity relationships)
        let isEntityReference = false;
        for (const clause of whereClause) {
          if (Array.isArray(clause) && clause.length === 3) {
            const [entity, attr, value] = clause;
            if (value === variable) {
              const attrInfo = this._analyzeAttribute(attr);
              if (attrInfo.isReference) {
                analysis.entityVariable = variable;
                isEntityReference = true;
                break;
              }
            }
          }
        }
        
        // Only set as scalar if it's not an entity reference
        if (!isEntityReference) {
          const attribute = attributeMap.get(variable);
          if (attribute) {
            analysis.scalarVariable = variable;
            analysis.scalarAttribute = attribute;
          }
        }
      }
    }
  }

  /**
   * Determine overall query type
   * @private
   */
  _determineQueryType(analysis) {
    if (analysis.hasAggregates && analysis.hasVariables) {
      return 'mixed';
    }
    
    if (analysis.hasAggregates) {
      return 'aggregate';
    }
    
    // Check if we have an entity ID directly in the find clause
    // This happens when EntityProxy replaces ?this with the entity ID
    if (analysis.hasEntityId) {
      return 'entity';
    }
    
    if (analysis.variableCount === 0) {
      return 'empty';
    }
    
    if (analysis.variableCount === 1) {
      if (analysis.entityVariable) {
        return 'entity';
      }
      if (analysis.scalarVariable) {
        return 'scalar';
      }
      
      // For single variable with empty where clause, assume entity query
      // This is a reasonable default since entity queries often have minimal constraints
      if (analysis.clauseCount === 0) {
        return 'entity';
      }
      
      // Default to scalar for single variable with constraints
      return 'scalar';
    }
    
    return 'multi-variable';
  }

  /**
   * Calculate query complexity
   * @private
   */
  _calculateComplexity(analysis) {
    let score = 0;
    
    // Base complexity from structure
    score += analysis.clauseCount * 0.5; // Each clause adds some complexity but not too much
    score += analysis.variableCount; // Each variable adds complexity
    score += analysis.joinDepth * 1.5; // Joins add significant complexity
    score += analysis.filterCount * 0.5; // Filters add some complexity
    
    // Special patterns add complexity
    if (analysis.hasAggregates) score += 2;
    if (analysis.type === 'mixed') score += 3;
    
    // Thresholds adjusted for more accurate classification
    if (score <= 1.5) return 'simple';
    if (score <= 5) return 'moderate';
    return 'complex';
  }

  /**
   * Check if expression is an aggregate function
   * @private
   */
  _isAggregateExpression(expr) {
    // Handle both old string format '(count ?e)' and new array format ['count'] or ['sum', '?var']
    if (typeof expr === 'string') {
      const aggregates = [
        'count', 'sum', 'avg', 'min', 'max',
        'count-distinct', 'sum-distinct', 'avg-distinct'
      ];
      
      // Old format: match strings like '(count ?e)'
      const match = expr.match(/^\(([a-z-]+)/);
      if (!match) return false;
      
      const functionName = match[1];
      return aggregates.includes(functionName);
    }
    
    // New format: array like ['count'] or ['sum', '?var']
    if (Array.isArray(expr) && expr.length >= 1) {
      const aggregates = ['count', 'sum', 'avg', 'min', 'max', 'count-distinct', 'sum-distinct', 'avg-distinct'];
      const functionName = expr[0];
      return typeof functionName === 'string' && aggregates.includes(functionName);
    }
    
    return false;
  }

  /**
   * Extract aggregate function name from expression
   * @private
   */
  _extractAggregateFunction(expr) {
    // Handle both old string format and new array format
    if (typeof expr === 'string') {
      const match = expr.match(/\(([a-z-]+)/);
      return match ? match[1] : 'unknown';
    }
    
    // New array format: ['count'] or ['sum', '?var']
    if (Array.isArray(expr) && expr.length >= 1) {
      return expr[0];
    }
    
    return 'unknown';
  }

  /**
   * Check if variable represents an entity ID
   * @private
   */
  _isEntityVariable(variable, whereClause) {
    // Variable is entity if it appears as first element (entity position) in where clauses
    const appearsAsEntity = whereClause.some(clause => 
      Array.isArray(clause) && 
      clause.length >= 3 && 
      clause[0] === variable
    );
    
    if (appearsAsEntity) {
      return true;
    }
    
    // Variable is also entity if it appears as value in reference attributes
    // Check if variable appears as value and the attribute is a reference type
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        if (value === variable) {
          const attrInfo = this._analyzeAttribute(attribute);
          if (attrInfo.isReference) {
            return true; // This variable represents an entity reference
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Get attribute associated with a variable
   * @private
   */
  _getAttributeForVariable(variable, whereClause) {
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        if (value === variable) {
          return attribute;
        }
      }
    }
    return null;
  }

  /**
   * Calculate traversal depth - the number of steps in entity-to-entity navigation
   * @private
   */
  _calculateTraversalDepth(whereClause) {
    // Build entity dependency graph (entity -> entities it connects to)
    const dependencies = new Map();
    const entityClauses = new Map(); // entity -> clauses where it appears
    
    whereClause.forEach(clause => {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        
        // Track which clauses each entity appears in
        if (typeof entity === 'string' && entity.startsWith('?')) {
          if (!entityClauses.has(entity)) entityClauses.set(entity, []);
          entityClauses.get(entity).push(clause);
        }
        
        // For entity-to-entity connections via reference attributes
        if (typeof entity === 'string' && entity.startsWith('?') && 
            typeof value === 'string' && value.startsWith('?')) {
          const attrInfo = this._analyzeAttribute(attribute);
          if (attrInfo.isReference) {
            if (!dependencies.has(entity)) dependencies.set(entity, new Set());
            dependencies.get(entity).add(value);
          }
        }
      }
    });
    
    // Count the maximum depth of any path through the dependencies
    // Simple heuristic: entities involved in multiple clauses create joins
    let maxDepth = 0;
    
    for (const [entity, clauses] of entityClauses) {
      if (clauses.length > 1) {
        // This entity appears in multiple clauses - it's a join point
        // Count connected entities
        const connected = dependencies.get(entity) || new Set();
        maxDepth = Math.max(maxDepth, connected.size + clauses.length - 1);
      }
    }
    
    // For reference connections, add the connection count
    const referenceConnections = Array.from(dependencies.values())
      .reduce((total, connections) => total + connections.size, 0);
    
    return Math.max(maxDepth, referenceConnections);
  }

  /**
   * Check if an attribute is multi-valued (cardinality many)
   * @private
   */
  _isMultiValuedAttribute(attribute) {
    if (!attribute) return false;
    
    const schemaInfo = this.schema[attribute];
    if (!schemaInfo) return false;
    
    return schemaInfo.card === 'many';
  }

  /**
   * Analyze attribute using schema information
   * @private
   */
  _analyzeAttribute(attribute) {
    const schemaInfo = this.schema[attribute];
    
    if (!schemaInfo) {
      return {
        valueType: 'unknown',
        isReference: false,
        isMany: false,
        isUnique: false,
        uniqueType: null
      };
    }
    
    return {
      valueType: schemaInfo.valueType || 'string',
      isReference: schemaInfo.valueType === 'ref',
      isMany: schemaInfo.card === 'many',
      isUnique: Boolean(schemaInfo.unique),
      uniqueType: schemaInfo.unique || null,
      isComponent: Boolean(schemaInfo.component)
    };
  }

  /**
   * Check if query is for multi-valued reference attributes
   * @private
   */
  _isQueryingMultiValuedRefs(querySpec) {
    const whereClause = querySpec.where || [];
    const findVars = querySpec.find;
    
    // Check each where clause to see if we're selecting from a multi-valued ref
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        
        // Check if the value matches a find variable and the attribute is multi-valued
        if (findVars.includes(value)) {
          const attrInfo = this._analyzeAttribute(attribute);
          if (attrInfo.isReference && attrInfo.isMany) {
            return true; // Querying multi-valued reference
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Check if query structure implies a single entity result
   * @private
   */
  _impliesSingleEntity(querySpec) {
    const whereClause = querySpec.where || [];
    const findClause = querySpec.find || [];
    
    // Only check if we're finding a single entity variable
    if (findClause.length !== 1 || typeof findClause[0] !== 'string' || !findClause[0].startsWith('?')) {
      return false;
    }
    
    const entityVariable = findClause[0];
    
    // Check for unique attribute constraints on the entity we're finding
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        
        // Only check clauses that constrain our entity variable
        if (entity === entityVariable) {
          // If filtering by a unique attribute with a literal value, we get at most one entity
          if (typeof value !== 'string' || !value.startsWith('?')) {
            const attrInfo = this._analyzeAttribute(attribute);
            if (attrInfo.isUnique) {
              return true; // Unique attribute constraint guarantees single entity
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Determine if a query could potentially return multiple results
   * based on its structure and the schema
   * @private
   */
  _couldReturnMultipleEntities(querySpec) {
    // Special version for entity queries - check if query structure allows multiple entities
    const whereClause = querySpec.where || [];
    const findClause = querySpec.find || [];
    
    // Check if we have a unique constraint
    if (this._impliesSingleEntity(querySpec)) {
      return false;
    }
    
    // For single entity variable queries with specific value constraints,
    // we typically expect single entity or no entity (not a collection)
    if (findClause.length === 1 && typeof findClause[0] === 'string' && findClause[0].startsWith('?')) {
      const entityVar = findClause[0];
      
      // Check if all clauses for this entity variable have specific values (not variables)
      let hasSpecificValueConstraint = false;
      for (const clause of whereClause) {
        if (Array.isArray(clause) && clause.length === 3) {
          const [entity, attribute, value] = clause;
          
          // If this clause is about our entity variable
          if (entity === entityVar) {
            // If the value is not a variable (specific value constraint)
            if (typeof value !== 'string' || !value.startsWith('?')) {
              hasSpecificValueConstraint = true;
              
              // If querying by unique attribute with specific value
              const attrInfo = this._analyzeAttribute(attribute);
              if (attrInfo.isUnique) {
                return false; // Unique attribute guarantees single or no entity
              }
            }
          }
        }
      }
      
      // If we have specific value constraints (not joining with other entities),
      // default to single entity expectation (might be 0 or 1 result)
      if (hasSpecificValueConstraint) {
        return false;
      }
    }
    
    // Check if we're querying a specific entity by ID
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity] = clause;
        
        // If querying specific entity ID
        if (typeof entity === 'number') {
          return false;
        }
      }
    }
    
    // By default, entity queries without specific constraints could return multiple
    return true;
  }

  _couldReturnMultiple(querySpec) {
    const whereClause = querySpec.where || [];
    const findVars = querySpec.find;
    
    // If querying for multiple variables, it could return multiple
    if (findVars.length > 1) {
      return true;
    }
    
    const findVar = findVars[0];
    
    // Check if we're selecting from a multi-valued attribute
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        
        // If the find variable comes from a multi-valued attribute
        if (value === findVar) {
          const attrInfo = this._analyzeAttribute(attribute);
          if (attrInfo.isMany) {
            return true; // Multi-valued attribute can return multiple values
          }
        }
      }
    }
    
    // Check if we have constraints that would limit to single result
    // For scalar queries, check if we're constraining the entities that provide the scalar
    const entityVariables = new Set();
    const uniqueEntityConstraints = new Set();
    
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        
        // Track entity variables
        if (typeof entity === 'string' && entity.startsWith('?')) {
          entityVariables.add(entity);
        }
        
        // Check for unique constraints on any entity variable
        if (entityVariables.has(entity) && (typeof value !== 'string' || !value.startsWith('?'))) {
          const attrInfo = this._analyzeAttribute(attribute);
          if (attrInfo.isUnique) {
            uniqueEntityConstraints.add(entity);
          }
        }
      }
    }
    
    // If all entity variables involved have unique constraints, we get single result
    if (uniqueEntityConstraints.size > 0 && uniqueEntityConstraints.size === entityVariables.size) {
      return false;
    }
    
    // By default, queries without unique constraints could return multiple
    // unless they're querying a single-valued attribute of a specific entity
    const hasSpecificEntityBinding = whereClause.some(clause => {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity] = clause;
        // If entity is '?this' or a specific number, we're querying a specific entity
        return entity === '?this' || typeof entity === 'number';
      }
      return false;
    });
    
    // If querying specific entity's single-valued attribute, won't return multiple
    if (hasSpecificEntityBinding) {
      // But still check if we're getting a multi-valued attribute
      for (const clause of whereClause) {
        if (Array.isArray(clause) && clause.length === 3) {
          const [entity, attribute, value] = clause;
          if ((entity === '?this' || typeof entity === 'number') && value === findVar) {
            const attrInfo = this._analyzeAttribute(attribute);
            return attrInfo.isMany; // Only return multiple if attribute is many
          }
        }
      }
      return false; // Single-valued attribute of specific entity
    }
    
    // General queries without constraints could return multiple
    return true;
  }
}