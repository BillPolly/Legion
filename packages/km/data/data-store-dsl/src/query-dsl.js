/**
 * Query DSL - Template literal query syntax for data-store
 * 
 * Provides natural language query syntax using template literals.
 */

import { DSLParser } from './parser.js';

/**
 * Tagged template literal function for query definition
 * @param {TemplateStringsArray} strings - Template literal strings
 * @param {...any} expressions - Template literal expressions
 * @returns {Object} DataScript-compatible query object
 */
export function query(strings, ...expressions) {
  // Process template literal
  const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
  
  // Parse query from DSL text
  return DSLParser.queryToDataScript(templateResult.text, templateResult.expressions);
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
   * Convert DSL query to DataScript query object
   * @param {string} queryText - Query DSL text
   * @param {Array} expressions - Template literal expressions
   * @returns {Object} DataScript query object
   */
  queryToDataScript(queryText, expressions = []) {
    // Substitute expressions first
    const processedText = this._substituteExpressions(queryText, expressions);
    
    // Parse query structure
    const parsed = this.parseQueryStructure(processedText);
    
    // Convert to DataScript format
    const dataScriptQuery = {
      find: parsed.find,
      where: parsed.where || []
    };

    // Add namespace prefixes to attributes
    dataScriptQuery.where = dataScriptQuery.where.map(clause => {
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
      // Parse datom pattern: entity attribute value
      const clause = this._parseWherePattern(whereTokens, i);
      if (clause) {
        whereClauses.push(clause.pattern);
        i = clause.endIndex;
      } else {
        i++; // Skip unrecognized tokens
      }
    }

    return whereClauses;
  },

  /**
   * Parse individual where pattern (entity attribute value)
   * @private
   */
  _parseWherePattern(tokens, startIndex) {
    if (startIndex + 2 >= tokens.length) {
      return null; // Not enough tokens for a complete pattern
    }

    const entity = tokens[startIndex];
    const attribute = tokens[startIndex + 1];
    const value = tokens[startIndex + 2];

    // Validate pattern structure
    if (entity.type !== 'variable' && entity.type !== 'identifier') {
      return null;
    }
    
    if (attribute.type !== 'attribute' && attribute.type !== 'identifier') {
      return null;
    }

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
      endIndex: startIndex + 3
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