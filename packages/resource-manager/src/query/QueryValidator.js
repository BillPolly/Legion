/**
 * QueryValidator - Validation for Cypher queries and parameters
 * 
 * Provides validation for:
 * - Parameter types and values
 * - Query structure validation
 * - Security checks (injection prevention)
 * - Performance warnings
 */

export class QueryValidator {
  constructor() {
    // Reserved Cypher keywords that should not be used as identifiers
    this.reservedKeywords = new Set([
      'MATCH', 'CREATE', 'DELETE', 'SET', 'REMOVE', 'RETURN', 'WITH', 'WHERE',
      'ORDER', 'BY', 'SKIP', 'LIMIT', 'UNION', 'UNWIND', 'MERGE', 'OPTIONAL',
      'DETACH', 'CALL', 'YIELD', 'FOREACH', 'CASE', 'WHEN', 'THEN', 'ELSE',
      'END', 'AND', 'OR', 'XOR', 'NOT', 'IN', 'STARTS', 'ENDS', 'CONTAINS',
      'IS', 'NULL', 'TRUE', 'FALSE', 'DISTINCT', 'AS', 'ASC', 'DESC'
    ]);
    
    // Dangerous patterns that might indicate injection attempts
    this.dangerousPatterns = [
      /;\s*(DROP|DELETE|CREATE|ALTER)\s+/i,
      /'\s*;\s*/,
      /--/,
      /\/\*/,
      /\*\//,
      /\bEXEC\b/i,
      /\bEVAL\b/i
    ];
  }
  
  /**
   * Validate a complete query with parameters
   */
  validateQuery(querySpec) {
    const errors = [];
    const warnings = [];
    
    if (!querySpec) {
      errors.push('Query specification is required');
      return { valid: false, errors, warnings };
    }
    
    // Validate query type
    if (!querySpec.type) {
      errors.push('Query type is required');
    } else if (!this._isValidQueryType(querySpec.type)) {
      errors.push(`Invalid query type: ${querySpec.type}`);
    }
    
    // Validate Cypher query structure
    if (querySpec.type === 'cypher') {
      const cypherValidation = this.validateCypher(querySpec.query, querySpec.params);
      errors.push(...cypherValidation.errors);
      warnings.push(...cypherValidation.warnings);
    }
    
    // Validate parameters
    if (querySpec.params) {
      const paramValidation = this.validateParameters(querySpec.params);
      errors.push(...paramValidation.errors);
      warnings.push(...paramValidation.warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate Cypher query string
   */
  validateCypher(query, params = {}) {
    const errors = [];
    const warnings = [];
    
    if (!query || typeof query !== 'string') {
      errors.push('Cypher query must be a non-empty string');
      return { errors, warnings };
    }
    
    // Security checks
    const securityIssues = this._checkSecurity(query);
    errors.push(...securityIssues);
    
    // Parameter usage validation
    const paramIssues = this._checkParameterUsage(query, params);
    errors.push(...paramIssues.errors);
    warnings.push(...paramIssues.warnings);
    
    // Performance warnings
    const performanceWarnings = this._checkPerformance(query);
    warnings.push(...performanceWarnings);
    
    // Syntax warnings (basic checks)
    const syntaxWarnings = this._checkSyntax(query);
    warnings.push(...syntaxWarnings);
    
    return { errors, warnings };
  }
  
  /**
   * Validate parameters object
   */
  validateParameters(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      return { errors: ['Parameters must be an object'], warnings };
    }
    
    for (const [key, value] of Object.entries(params)) {
      // Validate parameter name
      if (!this._isValidParameterName(key)) {
        errors.push(`Invalid parameter name: ${key}`);
      }
      
      // Validate parameter value
      const valueValidation = this._validateParameterValue(key, value);
      errors.push(...valueValidation.errors);
      warnings.push(...valueValidation.warnings);
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate a single parameter value
   */
  validateParameterValue(name, value) {
    return this._validateParameterValue(name, value);
  }
  
  /**
   * Check if a query is safe to execute (ignoring parameter usage validation)
   */
  isQuerySafe(query) {
    if (!query || typeof query !== 'string') {
      return false;
    }
    
    // Only check security issues, not parameter usage
    const securityIssues = this._checkSecurity(query);
    return securityIssues.length === 0;
  }
  
  /**
   * Get recommendations for query optimization
   */
  getOptimizationRecommendations(query) {
    const recommendations = [];
    
    if (!query || typeof query !== 'string') {
      return recommendations;
    }
    
    const upperQuery = query.toUpperCase();
    
    // Check for missing indexes
    if (upperQuery.includes('WHERE') && !upperQuery.includes('INDEX')) {
      recommendations.push('Consider adding indexes on frequently filtered properties');
    }
    
    // Check for cartesian products
    if ((upperQuery.match(/MATCH/g) || []).length > 1 && !upperQuery.includes('WHERE')) {
      recommendations.push('Multiple MATCH clauses without WHERE may create cartesian products');
    }
    
    // Check for OPTIONAL MATCH usage
    if (upperQuery.includes('OPTIONAL MATCH') && !upperQuery.includes('WITH')) {
      recommendations.push('OPTIONAL MATCH with WITH clause can improve performance');
    }
    
    // Check for inefficient patterns
    if (upperQuery.includes('()-[]-()')) {
      recommendations.push('Use specific relationship types instead of generic patterns');
    }
    
    return recommendations;
  }
  
  /**
   * Private validation methods
   */
  
  _isValidQueryType(type) {
    const validTypes = ['cypher', 'node', 'relationship', 'schema'];
    return validTypes.includes(type);
  }
  
  _checkSecurity(query) {
    const errors = [];
    
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(query)) {
        errors.push(`Potentially dangerous pattern detected in query: ${pattern.source}`);
      }
    }
    
    // Check for unparameterized strings that might be injection
    const stringLiterals = query.match(/'[^']*'/g) || [];
    if (stringLiterals.length > 3) {
      errors.push('Too many string literals - consider using parameters');
    }
    
    return errors;
  }
  
  _checkParameterUsage(query, params) {
    const errors = [];
    const warnings = [];
    
    // Find all parameter references in query
    const paramRefs = query.match(/\$\w+/g) || [];
    const referencedParams = new Set(paramRefs.map(ref => ref.substring(1)));
    
    // Check for undefined parameters
    for (const paramName of referencedParams) {
      if (!(paramName in params)) {
        errors.push(`Parameter $${paramName} is referenced in query but not provided`);
      }
    }
    
    // Check for unused parameters
    for (const paramName of Object.keys(params)) {
      if (!referencedParams.has(paramName)) {
        warnings.push(`Parameter ${paramName} is provided but not used in query`);
      }
    }
    
    return { errors, warnings };
  }
  
  _checkPerformance(query) {
    const warnings = [];
    const upperQuery = query.toUpperCase();
    
    // Check for missing LIMIT on potentially large result sets
    if ((upperQuery.includes('MATCH') || upperQuery.includes('RETURN')) && 
        !upperQuery.includes('LIMIT') && !upperQuery.includes('COUNT')) {
      warnings.push('Consider adding LIMIT to prevent large result sets');
    }
    
    // Check for complex WHERE conditions
    const whereMatch = query.match(/WHERE\s+(.+?)(?:RETURN|ORDER|LIMIT|$)/i);
    if (whereMatch && whereMatch[1].length > 200) {
      warnings.push('Complex WHERE clause may impact performance');
    }
    
    // Check for nested queries without optimization
    if (upperQuery.includes('WITH') && upperQuery.includes('COLLECT')) {
      warnings.push('Nested aggregations with COLLECT may be memory intensive');
    }
    
    return warnings;
  }
  
  _checkSyntax(query) {
    const warnings = [];
    
    // Check for potential syntax issues
    if (query.includes('()()')) {
      warnings.push('Empty node patterns may indicate syntax error');
    }
    
    if (query.includes('[][]')) {
      warnings.push('Empty relationship patterns may indicate syntax error');
    }
    
    // Check parentheses balance
    const openParens = (query.match(/\(/g) || []).length;
    const closeParens = (query.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      warnings.push('Unbalanced parentheses detected');
    }
    
    // Check brackets balance
    const openBrackets = (query.match(/\[/g) || []).length;
    const closeBrackets = (query.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      warnings.push('Unbalanced brackets detected');
    }
    
    return warnings;
  }
  
  _isValidParameterName(name) {
    // Parameter names should be alphanumeric and underscore
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && 
           !this.reservedKeywords.has(name.toUpperCase());
  }
  
  _validateParameterValue(name, value) {
    const errors = [];
    const warnings = [];
    
    // Check for null/undefined
    if (value === undefined) {
      errors.push(`Parameter ${name} is undefined`);
    }
    
    // Check for complex objects that might not serialize well
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        // Check array elements
        if (value.length > 1000) {
          warnings.push(`Parameter ${name} array is very large (${value.length} elements)`);
        }
        
        // Check for mixed types in array
        const types = new Set(value.map(v => typeof v));
        if (types.size > 1) {
          warnings.push(`Parameter ${name} array contains mixed types`);
        }
      } else {
        // Check object depth
        try {
          const jsonStr = JSON.stringify(value);
          if (jsonStr.length > 10000) {
            warnings.push(`Parameter ${name} object is very large`);
          }
        } catch (error) {
          errors.push(`Parameter ${name} is not JSON serializable`);
        }
      }
    }
    
    // Check string length
    if (typeof value === 'string' && value.length > 10000) {
      warnings.push(`Parameter ${name} string is very long (${value.length} characters)`);
    }
    
    // Check number ranges
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        errors.push(`Parameter ${name} is not a finite number`);
      }
      if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
        warnings.push(`Parameter ${name} exceeds safe integer range`);
      }
    }
    
    return { errors, warnings };
  }
}

/**
 * Static utility methods
 */
QueryValidator.validate = function(querySpec) {
  const validator = new QueryValidator();
  return validator.validateQuery(querySpec);
};

QueryValidator.validateCypher = function(query, params) {
  const validator = new QueryValidator();
  return validator.validateCypher(query, params);
};

QueryValidator.isQuerySafe = function(query) {
  const validator = new QueryValidator();
  return validator.isQuerySafe(query);
};