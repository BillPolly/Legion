/**
 * ProxyTypeDetector - Determines which proxy type to create based on query characteristics
 * 
 * Analyzes query specifications and results to determine whether to create:
 * - EntityProxy: Single entity queries
 * - CollectionProxy: Multiple entity queries  
 * - StreamProxy: Attribute value queries
 * - DataStoreProxy: Complex/aggregate queries
 */

export class ProxyTypeDetector {
  constructor(resourceManager) {
    // Validate ResourceManager parameter
    if (!resourceManager || typeof resourceManager.query !== 'function') {
      throw new Error('ResourceManager is required');
    }
    
    this.resourceManager = resourceManager;
    
    // Backward compatibility - expose store if resourceManager has it
    if (resourceManager.dataStore) {
      this.store = resourceManager.dataStore;
    }
  }
  
  /**
   * Detect proxy type based on query specification
   * @param {Object} querySpec - Query specification with find and where clauses
   * @returns {Object} Detection result with type and characteristics
   */
  detectProxyType(querySpec) {
    // Validate query specification
    this._validateQuerySpec(querySpec);
    
    // Analyze query structure
    const isEntityQuery = this.isEntityIdQuery(querySpec);
    const isSingle = this.isSingleResultQuery(querySpec);
    const isAggregate = this.isAggregateQuery(querySpec);
    const isComplex = this._isComplexQuery(querySpec);
    
    // Determine proxy type based on characteristics
    let type;
    let characteristics = {
      isCollection: false,
      isStream: false,
      isAggregate: false,
      isComplex: false
    };
    
    if (isAggregate || isComplex) {
      type = 'DataStoreProxy';
      characteristics.isAggregate = isAggregate;
      characteristics.isComplex = isComplex;
    } else if (isEntityQuery) {
      if (isSingle) {
        type = 'EntityProxy';
      } else {
        type = 'CollectionProxy';
        characteristics.isCollection = true;
      }
    } else {
      type = 'StreamProxy';
      characteristics.isStream = true;
    }
    
    return {
      type,
      ...characteristics
    };
  }
  
  /**
   * Analyze actual query results to refine proxy type detection
   * @param {Object} querySpec - Query specification
   * @param {Array} results - Query execution results
   * @returns {Object} Analysis of results with suggestions
   */
  analyzeQueryResults(querySpec, results) {
    if (!querySpec) {
      throw new Error('Query specification is required');
    }
    
    if (!results) {
      throw new Error('Query results are required');
    }
    
    const resultCount = results.length;
    const isEmpty = resultCount === 0;
    const isSingleResult = resultCount === 1;
    
    // Analyze result structure to detect entity IDs
    let containsEntityIds = false;
    if (resultCount > 0) {
      const firstResult = results[0];
      if (Array.isArray(firstResult)) {
        // Multi-column result - check if first column looks like entity ID
        containsEntityIds = typeof firstResult[0] === 'number' && firstResult[0] > 0;
      } else {
        // Single column result - check if it's an entity ID
        containsEntityIds = typeof firstResult === 'number' && firstResult > 0;
      }
    }
    
    // Determine suggested proxy type based on results
    let suggestedType;
    if (isEmpty) {
      // Empty results - use collection for consistency
      suggestedType = 'CollectionProxy';
    } else if (containsEntityIds) {
      suggestedType = isSingleResult ? 'EntityProxy' : 'CollectionProxy';
    } else {
      suggestedType = 'StreamProxy';
    }
    
    return {
      resultCount,
      isEmpty,
      isSingleResult,
      containsEntityIds,
      suggestedType
    };
  }
  
  /**
   * Check if query returns entity IDs
   * @param {Object} querySpec - Query specification
   * @returns {boolean} True if query returns entity IDs
   */
  isEntityIdQuery(querySpec) {
    const findClause = querySpec.find;
    
    // Check if find clause contains entity variables (typically ?e)
    return findClause.some(variable => {
      if (typeof variable === 'string') {
        // Simple variable - check if it's used as entity in where clause
        return this._isEntityVariable(variable, querySpec.where);
      }
      return false;
    });
  }
  
  /**
   * Check if query is likely to return a single result
   * @param {Object} querySpec - Query specification  
   * @returns {boolean} True if query should return single result
   */
  isSingleResultQuery(querySpec) {
    const whereClause = querySpec.where;
    
    // Look for specific value constraints that would limit to single result
    return whereClause.some(clause => {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        
        // If value is not a variable (doesn't start with ?), it's a specific constraint
        if (typeof value === 'string' && !value.startsWith('?')) {
          // Check if this is a unique attribute by convention
          if (typeof attribute === 'string') {
            return attribute.includes('/email') || attribute.includes('/id') || 
                   attribute.includes('/unique') || 
                   (attribute.includes('/name') && value !== '?name');
          }
        }
      }
      return false;
    });
  }
  
  /**
   * Check if query uses aggregate functions
   * @param {Object} querySpec - Query specification
   * @returns {boolean} True if query uses aggregates
   */
  isAggregateQuery(querySpec) {
    const findClause = querySpec.find;
    
    return findClause.some(expression => {
      if (typeof expression === 'string') {
        // Check for aggregate function patterns like (count ?e), (sum ?age), etc.
        return /^\((?:count|sum|min|max|avg)\s/.test(expression);
      }
      return false;
    });
  }
  
  /**
   * Validate query specification structure
   * @param {Object} querySpec - Query specification to validate
   * @private
   */
  _validateQuerySpec(querySpec) {
    if (!querySpec) {
      throw new Error('Query specification is required');
    }
    
    if (typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    // Validate find clause
    if (!querySpec.find || (Array.isArray(querySpec.find) && querySpec.find.length === 0)) {
      throw new Error('Query must have find clause');
    }
    
    // Validate where clause
    if (!querySpec.where) {
      throw new Error('Query must have where clause');
    }
    
    if (!Array.isArray(querySpec.where)) {
      throw new Error('Where clause must be an array');
    }
  }
  
  /**
   * Check if variable is used as entity in where clauses
   * @param {string} variable - Variable to check (e.g., '?e')
   * @param {Array} whereClause - Where clause patterns
   * @returns {boolean} True if variable appears as entity (first position) in patterns
   * @private
   */
  _isEntityVariable(variable, whereClause) {
    return whereClause.some(pattern => {
      return Array.isArray(pattern) && pattern.length >= 3 && pattern[0] === variable;
    });
  }
  
  /**
   * Check if query is complex (joins multiple entity types, etc.)
   * @param {Object} querySpec - Query specification
   * @returns {boolean} True if query is complex
   * @private
   */
  _isComplexQuery(querySpec) {
    const whereClause = querySpec.where;
    const findClause = querySpec.find;
    
    // Complex if it has multiple different entity variables
    const entityVariables = new Set();
    whereClause.forEach(pattern => {
      if (Array.isArray(pattern) && pattern.length >= 3) {
        const entity = pattern[0];
        if (typeof entity === 'string' && entity.startsWith('?')) {
          entityVariables.add(entity);
        }
      }
    });
    
    // Complex if multiple entity types or complex find expressions
    return entityVariables.size > 1 || 
           findClause.length > 2 || 
           findClause.some(expr => typeof expr === 'string' && expr.includes('('));
  }
}