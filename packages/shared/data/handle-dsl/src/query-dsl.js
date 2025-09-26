/**
 * Query DSL - Template literal query syntax for Handles
 * 
 * Provides natural language query syntax using template literals.
 * Works with any Handle implementation - the Handle itself handles translation.
 */

import { DSLParser } from './parser.js';

/**
 * Tagged template literal function for query definition
 * @param {TemplateStringsArray} strings - Template literal strings
 * @param {...any} expressions - Template literal expressions
 * @returns {Object} Generic query object for Handle.query()
 */
export function query(strings, ...expressions) {
  // Process template literal
  const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
  
  // Parse query to generic format that Handles can interpret
  return DSLParser.queryToHandleFormat(templateResult.text, templateResult.expressions);
}

// Extend DSLParser with query-specific methods
Object.assign(DSLParser, {
  /**
   * Parse query structure from DSL text
   * @param {string} queryText - Query DSL text
   * @returns {Object} Parsed query structure
   */
  parseQueryStructure(queryText) {
    if (!queryText || typeof queryText !== 'string') {
      throw new Error('Query text is required');
    }

    // Tokenize the query text
    const tokens = this.tokenize(queryText);
    
    if (tokens.length === 0) {
      throw new Error('Empty query');
    }

    // Find 'find' keyword
    const findIndex = tokens.findIndex(t => t.type === 'keyword' && t.value === 'find');
    if (findIndex === -1) {
      throw new Error('Query must start with "find" keyword');
    }

    // Find 'where' keyword  
    const whereIndex = tokens.findIndex(t => t.type === 'keyword' && t.value === 'where');
    
    // Parse find clause
    const findClause = this._parseFindClause(tokens, findIndex, whereIndex);
    
    // Parse where clause if present
    const whereClause = whereIndex !== -1 ? 
      this._parseWhereClause(tokens, whereIndex) : null;

    return {
      find: findClause.variables,
      where: whereClause,
      aliases: findClause.aliases || {}
    };
  },

  /**
   * Convert DSL query to generic Handle query format
   * @param {string} queryText - Query DSL text
   * @param {Array} expressions - Template literal expressions
   * @returns {Object} Generic query object that any Handle can interpret
   */
  queryToHandleFormat(queryText, expressions = []) {
    // Substitute expressions first
    const processedText = this._substituteExpressions(queryText, expressions);
    
    // Parse query structure
    const parsed = this.parseQueryStructure(processedText);
    
    // Return generic format - Handles will translate as needed
    return {
      type: 'query',
      find: parsed.find,
      where: parsed.where || [],
      aliases: parsed.aliases || {},
      // Original text for Handles that want to do their own parsing
      originalDSL: processedText
    };
  },

  /**
   * Convert generic Handle query to DataScript format
   * Used by DataStoreHandle to translate generic queries
   * @param {Object} handleQuery - Generic Handle query
   * @returns {Object} DataScript query object
   */
  handleQueryToDataScript(handleQuery) {
    const dataScriptQuery = {
      find: this._processFindClause(handleQuery.find),
      where: handleQuery.where || []
    };

    // Process where clauses
    dataScriptQuery.where = dataScriptQuery.where.map(clause => {
      // Handle comparison clauses (single element array with comparison string)
      if (clause.length === 1 && typeof clause[0] === 'string' && clause[0].startsWith('(')) {
        // This is a comparison clause like "(>= ?age 30)"
        // DataScript expects these as built-in predicates
        const comparisonText = clause[0];
        
        // Parse the comparison string: "(>= ?age 30)"
        const match = comparisonText.match(/^\((\S+)\s+(\?\w+)\s+(\S+)\)$/);
        if (match) {
          const [, operator, variable, value] = match;
          
          // Convert to DataScript built-in predicate format
          // DataScript uses [(built-in-name ?var value)]
          const builtInName = this._getDataScriptBuiltIn(operator);
          if (builtInName) {
            return [builtInName, variable, parseFloat(value) || value];
          }
        }
        
        // Return as-is if we can't parse it
        return clause;
      }
      
      // Handle regular DataScript clauses [entity attribute value]
      return clause.map(term => {
        if (typeof term === 'string' && term.includes('/') && !term.startsWith(':')) {
          return ':' + term;
        }
        return term;
      });
    });

    return dataScriptQuery;
  },

  /**
   * Process find clause to extract and convert aggregation expressions
   * @private
   * @param {Array} findClause - Find clause from Handle query
   * @returns {Array} Processed find clause for DataScript
   */
  _processFindClause(findClause) {
    return findClause.map(item => {
      // If item is an array with aggregation expression, extract it
      if (Array.isArray(item) && item.length === 1 && 
          typeof item[0] === 'string' && item[0].startsWith('(')) {
        const aggString = item[0]; // e.g. "(count ?friend)"
        return this._parseAggregationString(aggString);
      }
      return item; // Return regular variables as-is
    });
  },

  /**
   * Parse aggregation string into DataScript array format
   * @private
   * @param {string} aggString - Aggregation string like "(count ?friend)" or "(count-distinct ?post)"
   * @returns {Array} DataScript aggregation array like ['count', '?friend'] or ['count-distinct', '?post']
   */
  _parseAggregationString(aggString) {
    // Parse "(count ?friend)" to ['count', '?friend']
    // Parse "(count-distinct ?post)" to ['count-distinct', '?post']
    const match = aggString.match(/^\((\w+(?:-\w+)*)\s+(.*?)\)$/);
    if (match) {
      const [, funcName, args] = match;
      
      // Split args on spaces to handle multiple variables
      const argTokens = args.trim().split(/\s+/);
      
      return [funcName, ...argTokens];
    }
    
    // If parsing fails, return as-is (will be handled as literal)
    return aggString;
  },

  /**
   * Convert DSL comparison operators to DataScript built-in names
   * @private
   */
  _getDataScriptBuiltIn(operator) {
    const operatorMap = {
      '>=': '>=',
      '<=': '<=',
      '>': '>',
      '<': '<',
      '=': '=',
      '!=': 'not='
    };
    
    return operatorMap[operator];
  },

  /**
   * Parse find clause from tokens
   * @private
   */
  _parseFindClause(tokens, findIndex, whereIndex) {
    const endIndex = whereIndex !== -1 ? whereIndex : tokens.length;
    const findTokens = tokens.slice(findIndex + 1, endIndex);
    
    if (findTokens.length === 0) {
      throw new Error('Find clause must specify variables to find');
    }

    const variables = [];
    const aliases = {};
    
    let i = 0;
    while (i < findTokens.length) {
      const token = findTokens[i];
      
      if (token.type === 'variable') {
        variables.push(token.value);
        
        // Check for 'as' alias
        if (i + 2 < findTokens.length && 
            findTokens[i + 1].type === 'keyword' && findTokens[i + 1].value === 'as' &&
            findTokens[i + 2].type === 'identifier') {
          aliases[token.value] = findTokens[i + 2].value;
          i += 2; // Skip 'as' and alias name
        }
      }
      // Handle aggregation functions
      else if (token.type === 'punctuation' && token.value === '(') {
        // Parse aggregation function
        const aggregation = this._parseAggregation(findTokens, i);
        if (aggregation) {
          variables.push(aggregation.expression);
          if (aggregation.alias) {
            aliases[aggregation.expression] = aggregation.alias;
          }
          i = aggregation.endIndex;
        }
      }
      
      i++;
    }

    if (variables.length === 0) {
      throw new Error('Find clause must specify at least one variable');
    }

    return { variables, aliases };
  },

  /**
   * Parse where clause from tokens
   * @private
   */
  _parseWhereClause(tokens, whereIndex) {
    const whereTokens = tokens.slice(whereIndex + 1);
    
    if (whereTokens.length === 0) {
      return [];
    }

    const whereClauses = [];
    let i = 0;
    
    while (i < whereTokens.length) {
      // Skip opening bracket
      if (whereTokens[i] && whereTokens[i].type === 'punctuation' && whereTokens[i].value === '[') {
        i++;
      }
      
      // Parse datom pattern: entity attribute value
      const clause = this._parseWherePattern(whereTokens, i);
      if (clause) {
        whereClauses.push(clause.pattern);
        i = clause.endIndex;
        
        // Skip closing bracket
        if (whereTokens[i] && whereTokens[i].type === 'punctuation' && whereTokens[i].value === ']') {
          i++;
        }
      } else {
        i++; // Skip unrecognized tokens
      }
    }

    return whereClauses;
  },

  /**
   * Parse individual where pattern (entity attribute value) or comparison
   * @private
   */
  _parseWherePattern(tokens, startIndex) {
    if (startIndex + 2 >= tokens.length) {
      return null; // Not enough tokens for a complete pattern
    }

    let nextIndex = startIndex;
    const firstToken = tokens[nextIndex++];
    
    // Check if this is a comparison pattern: ?var operator value
    if (firstToken.type === 'variable' && 
        nextIndex < tokens.length && 
        tokens[nextIndex].type === 'operator') {
      
      const variable = firstToken.value;
      const operator = tokens[nextIndex++].value;
      
      if (nextIndex >= tokens.length) {
        return null;
      }
      
      const valueToken = tokens[nextIndex++];
      let value = valueToken.value;
      
      // Convert comparison to DataScript constraint format
      // DataScript uses built-in comparison predicates
      return {
        pattern: [`(${operator} ${variable} ${typeof value === 'string' ? '"' + value + '"' : value})`],
        endIndex: nextIndex
      };
    }

    // Standard DataScript pattern: entity attribute value
    nextIndex = startIndex; // Reset
    let entity, attribute, value;

    // Parse entity
    entity = tokens[nextIndex++];
    if (entity.type !== 'variable' && entity.type !== 'identifier') {
      return null;
    }

    // Parse attribute - handle :attribute format
    if (nextIndex < tokens.length && 
        tokens[nextIndex].type === 'punctuation' && 
        tokens[nextIndex].value === ':' &&
        nextIndex + 1 < tokens.length &&
        (tokens[nextIndex + 1].type === 'identifier' || tokens[nextIndex + 1].type === 'attribute')) {
      // Handle :attribute format (both :identifier and :entity/attribute)
      attribute = {
        type: 'attribute',
        value: ':' + tokens[nextIndex + 1].value
      };
      nextIndex += 2;
    } else {
      // Handle simple attribute
      attribute = tokens[nextIndex++];
      if (attribute.type !== 'attribute' && attribute.type !== 'identifier') {
        return null;
      }
    }

    if (nextIndex >= tokens.length) {
      return null;
    }

    // Parse value
    value = tokens[nextIndex++];

    // Convert tokens to pattern values
    const entityValue = entity.value;
    const attributeValue = attribute.value;
    let valueValue = value.value;

    // Handle different value types
    if (value.type === 'variable') {
      valueValue = value.value;
    } else if (value.type === 'string') {
      valueValue = value.value;
    } else if (value.type === 'number') {
      valueValue = value.value;
    } else if (value.type === 'boolean') {
      valueValue = value.value;
    }

    return {
      pattern: [entityValue, attributeValue, valueValue],
      endIndex: nextIndex
    };
  },

  /**
   * Parse aggregation function from tokens
   * @private
   */
  _parseAggregation(tokens, startIndex) {
    // Look for pattern: ( function ?variable )
    if (tokens[startIndex].value !== '(') {
      return null;
    }

    let i = startIndex + 1;
    let aggregationText = '';
    let parenCount = 1;

    while (i < tokens.length && parenCount > 0) {
      const token = tokens[i];
      
      if (token.value === '(') {
        parenCount++;
      } else if (token.value === ')') {
        parenCount--;
      }
      
      if (parenCount > 0) {
        aggregationText += token.value + ' ';
      }
      
      i++;
    }

    if (parenCount > 0) {
      throw new Error('Unclosed aggregation function');
    }

    // Check for alias after closing parenthesis
    let alias = null;
    if (i + 1 < tokens.length && 
        tokens[i].type === 'keyword' && tokens[i].value === 'as' &&
        tokens[i + 1].type === 'identifier') {
      alias = tokens[i + 1].value;
      i += 2;
    }

    return {
      expression: [`(${aggregationText.trim()})`],
      alias,
      endIndex: i - 1
    };
  },

  /**
   * Extract all variables from query structure
   * @param {Object} parsed - Parsed query structure
   * @returns {Array} Array of all variables
   */
  extractAllVariables(parsed) {
    const variables = new Set();
    
    // Variables from find clause
    if (parsed.find) {
      parsed.find.forEach(item => {
        if (typeof item === 'string' && item.startsWith('?')) {
          variables.add(item);
        } else if (Array.isArray(item)) {
          // Extract variables from aggregation expressions
          const aggText = item[0];
          const varMatches = aggText.match(/\?\w+/g);
          if (varMatches) {
            varMatches.forEach(v => variables.add(v));
          }
        }
      });
    }
    
    // Variables from where clause
    if (parsed.where) {
      parsed.where.forEach(clause => {
        clause.forEach(term => {
          if (typeof term === 'string' && term.startsWith('?')) {
            variables.add(term);
          }
        });
      });
    }

    return Array.from(variables);
  },

  /**
   * Analyze variables for binding status
   * @param {Object} parsed - Parsed query structure
   * @returns {Object} Variable analysis
   */
  analyzeVariables(parsed) {
    const allVariables = this.extractAllVariables(parsed);
    const findVariables = new Set(parsed.find.filter(v => typeof v === 'string' && v.startsWith('?')));
    
    return {
      all: allVariables,
      bound: Array.from(findVariables),
      unbound: allVariables.filter(v => !findVariables.has(v))
    };
  },

  /**
   * Analyze variable usage patterns
   * @param {Object} parsed - Parsed query structure  
   * @returns {Object} Usage counts per variable
   */
  analyzeVariableUsage(parsed) {
    const usage = {};
    
    const countVariable = (variable) => {
      usage[variable] = (usage[variable] || 0) + 1;
    };

    // Count in find clause
    if (parsed.find) {
      parsed.find.forEach(item => {
        if (typeof item === 'string' && item.startsWith('?')) {
          countVariable(item);
        }
      });
    }

    // Count in where clause
    if (parsed.where) {
      parsed.where.forEach(clause => {
        clause.forEach(term => {
          if (typeof term === 'string' && term.startsWith('?')) {
            countVariable(term);
          }
        });
      });
    }

    return usage;
  },

  /**
   * Extract variables from find clause items
   * @param {Array} findClause - Find clause array
   * @returns {Array} Extracted variables
   */
  extractVariables(findClause) {
    const variables = [];
    
    findClause.forEach(item => {
      if (typeof item === 'string' && item.startsWith('?')) {
        variables.push(item);
      } else if (Array.isArray(item)) {
        // Extract from aggregation expressions
        const aggText = item[0];
        const varMatches = aggText.match(/\?\w+/g);
        if (varMatches) {
          variables.push(...varMatches);
        }
      }
    });
    
    return variables;
  }
});