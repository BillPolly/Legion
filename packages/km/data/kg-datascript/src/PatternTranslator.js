/**
 * PatternTranslator - Converts pattern queries to DataScript Datalog format
 * Supports both legacy KG triple patterns and object-based patterns
 * Provides backward compatibility with existing KG query APIs
 */
export class PatternTranslator {
  constructor() {
    // No dependencies needed for translation
  }

  /**
   * Translate patterns to DataScript query format
   * @param {Object|Array|Array<Object|Array>} patterns - Pattern(s) to translate
   * @returns {Object} DataScript query object with find and where clauses
   */
  translate(patterns) {
    if (patterns === null || patterns === undefined) {
      throw new Error('Pattern cannot be null or undefined');
    }

    // Handle empty patterns
    if (Array.isArray(patterns) && patterns.length === 0) {
      return {
        find: [],
        where: []
      };
    }

    // Normalize input to array of patterns
    const patternArray = this._normalizePatterns(patterns);
    
    // Extract all where clauses and variables
    const whereClauses = [];
    const variableList = [];
    const variableSet = new Set();

    for (const pattern of patternArray) {
      const { where, variables } = this._processSinglePattern(pattern);
      whereClauses.push(...where);
      variables.forEach(variable => {
        if (!variableSet.has(variable)) {
          variableSet.add(variable);
          variableList.push(variable);
        }
      });
    }

    return {
      find: variableList,
      where: whereClauses
    };
  }

  /**
   * Translate a single pattern (legacy method for backward compatibility)
   * @param {Object|Array} pattern - Single pattern to translate
   * @returns {Object} DataScript query object
   */
  translatePattern(pattern) {
    return this.translate(pattern);
  }

  /**
   * Extract all variables from patterns
   * @param {Array<Object|Array>} patterns - Array of patterns
   * @returns {Array<string>} Array of unique variables
   */
  extractVariables(patterns) {
    const variables = new Set();
    
    const patternArray = this._normalizePatterns(patterns);
    
    for (const pattern of patternArray) {
      const patternVars = this._extractVariablesFromPattern(pattern);
      patternVars.forEach(variable => variables.add(variable));
    }
    
    return Array.from(variables);
  }

  /**
   * Process predicate to DataScript format
   * @param {string} predicate - Predicate to process
   * @returns {string} Processed predicate with proper namespace formatting
   */
  processPredicate(predicate) {
    if (typeof predicate !== 'string') {
      return predicate;
    }

    // Already has colon prefix
    if (predicate.startsWith(':')) {
      return predicate;
    }

    // Handle namespace notation (ns:name -> :ns/name)
    if (predicate.includes(':')) {
      const parts = predicate.split(':');
      if (parts.length === 2) {
        return `:${parts[0]}/${parts[1]}`;
      } else if (parts.length > 2) {
        // Multiple colons - only convert first one to slash
        const [first, ...rest] = parts;
        return `:${first}/${rest.join(':')}`;
      }
    }

    // Simple predicate - add colon prefix
    return `:${predicate}`;
  }

  // Private helper methods

  /**
   * Normalize various input formats to array of patterns
   */
  _normalizePatterns(patterns) {
    // Single object pattern
    if (!Array.isArray(patterns)) {
      return [patterns];
    }

    // Array of patterns OR single array pattern
    if (Array.isArray(patterns)) {
      // Check if this is a single triple pattern [subject, predicate, object]
      if (patterns.length === 3 && 
          !Array.isArray(patterns[0]) && 
          typeof patterns[1] === 'string') {
        return [patterns];
      }
      
      // Array of patterns
      return patterns;
    }

    return [patterns];
  }

  /**
   * Process a single pattern and return where clauses and variables
   */
  _processSinglePattern(pattern) {
    if (Array.isArray(pattern)) {
      return this._processArrayPattern(pattern);
    } else if (typeof pattern === 'object' && pattern !== null) {
      return this._processObjectPattern(pattern);
    } else {
      throw new Error('Invalid pattern format');
    }
  }

  /**
   * Process array-format pattern [subject, predicate, object]
   */
  _processArrayPattern(pattern) {
    if (pattern.length !== 3) {
      throw new Error('Array pattern must have exactly 3 elements [subject, predicate, object]');
    }

    const [subject, predicate, object] = pattern;
    const processedPredicate = this.processPredicate(predicate);

    const variables = [];
    if (this._isVariable(subject)) variables.push(subject);
    if (this._isVariable(object)) variables.push(object);

    return {
      where: [[subject, processedPredicate, object]],
      variables
    };
  }

  /**
   * Process object-format pattern {subject, predicate, object} or simple filter {prop: value}
   */
  _processObjectPattern(pattern) {
    const { subject, predicate, object } = pattern;

    // Check if this is a triple pattern format
    if (subject !== undefined || predicate !== undefined || object !== undefined) {
      if (predicate === undefined || object === undefined) {
        throw new Error('Invalid pattern: missing predicate or object');
      }

      const processedPredicate = this.processPredicate(predicate);

      const variables = [];
      if (this._isVariable(subject)) variables.push(subject);
      if (this._isVariable(object)) variables.push(object);

      return {
        where: [[subject, processedPredicate, object]],
        variables
      };
    }
    
    // Otherwise, treat as a simple filter pattern {prop: value, ...}
    // Convert to where clauses for each property
    const whereClauses = [];
    const entityVar = '?e';
    const variables = [entityVar];
    
    for (const [key, value] of Object.entries(pattern)) {
      // Convert property name to DataScript attribute
      let attribute = key;
      
      // Special handling for common properties
      if (key === 'type') {
        attribute = ':entity/type';
      } else if (key === 'id') {
        attribute = ':entity/id';
      } else if (!key.startsWith(':')) {
        // Convert to namespaced attribute
        attribute = `:entity/${key}`;
      }
      
      // Add where clause
      whereClauses.push([entityVar, attribute, value]);
    }
    
    return {
      where: whereClauses,
      variables
    };
  }

  /**
   * Extract variables from a single pattern
   */
  _extractVariablesFromPattern(pattern) {
    const variables = [];

    if (Array.isArray(pattern)) {
      const [subject, predicate, object] = pattern;
      if (this._isVariable(subject)) variables.push(subject);
      if (this._isVariable(object)) variables.push(object);
    } else if (typeof pattern === 'object' && pattern !== null) {
      const { subject, object } = pattern;
      if (this._isVariable(subject)) variables.push(subject);
      if (this._isVariable(object)) variables.push(object);
    }

    return variables;
  }

  /**
   * Check if a value is a variable (starts with ?)
   */
  _isVariable(value) {
    return typeof value === 'string' && value.startsWith('?');
  }
}