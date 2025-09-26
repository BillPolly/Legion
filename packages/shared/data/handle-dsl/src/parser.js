/**
 * DSLParser - Core template literal processing for data-store DSL
 * 
 * Provides foundational template literal parsing capabilities for schema, query, and update DSL.
 */

export class DSLParser {
  /**
   * Process template literal strings and expressions into structured format
   * @param {Array<string>} strings - Template literal string parts
   * @param {Array<any>} expressions - Template literal interpolated expressions
   * @returns {Object} Processed template literal result
   */
  static processTemplateLiteral(strings, expressions) {
    // Validate inputs
    this.validateTemplateLiteralParams(strings, expressions);
    
    // Reconstruct the template with expression placeholders
    let text = '';
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < expressions.length) {
        text += `\${${i}}`;
      }
    }
    
    return {
      text,
      expressions: [...expressions], // Copy to avoid mutation
      originalStrings: [...strings], // Copy to preserve original
      type: 'template-literal'
    };
  }

  /**
   * Separate template components for further processing
   * @param {Object} templateResult - Result from processTemplateLiteral
   * @returns {Object} Separated components with metadata
   */
  static separateTemplateComponents(templateResult) {
    const { text, expressions } = templateResult;
    
    // Find expression positions in the text
    const expressionPositions = [];
    const expressionRegex = /\$\{(\d+)\}/g;
    let match;
    
    while ((match = expressionRegex.exec(text)) !== null) {
      expressionPositions.push({
        start: match.index,
        end: match.index + match[0].length,
        expressionIndex: parseInt(match[1]),
        placeholder: match[0]
      });
    }
    
    return {
      staticText: text,
      expressions,
      expressionCount: expressions.length,
      hasExpressions: expressions.length > 0,
      expressionPositions,
      staticLength: text.replace(/\$\{\d+\}/g, '').length
    };
  }

  /**
   * Validate template literal function parameters
   * @param {Array<string>} strings - Template literal strings
   * @param {Array<any>} expressions - Template literal expressions
   */
  static validateTemplateLiteralParams(strings, expressions) {
    if (!strings) {
      throw new Error('Template strings are required');
    }
    
    if (!expressions) {
      throw new Error('Expressions array is required');
    }
    
    if (!Array.isArray(strings)) {
      throw new Error('Template strings must be an array');
    }
    
    if (!Array.isArray(expressions)) {
      throw new Error('Expressions must be an array');
    }
    
    // Validate template literal structure: strings.length = expressions.length + 1
    if (strings.length !== expressions.length + 1) {
      throw new Error(
        `Template literal structure invalid: expected ${expressions.length + 1} strings for ${expressions.length} expressions, got ${strings.length} strings`
      );
    }
  }

  /**
   * Create template literal context with metadata
   * @param {Array<string>} strings - Template literal strings
   * @param {Array<any>} expressions - Template literal expressions
   * @returns {Object} Template literal context object
   */
  static createTemplateLiteralContext(strings, expressions) {
    const processed = this.processTemplateLiteral(strings, expressions);
    const separated = this.separateTemplateComponents(processed);
    
    return {
      type: 'template-literal',
      text: processed.text,
      expressions: processed.expressions,
      originalStrings: processed.originalStrings,
      metadata: {
        expressionCount: separated.expressionCount,
        hasExpressions: separated.hasExpressions,
        staticLength: separated.staticLength,
        complexity: this._calculateComplexity(separated),
        createdAt: Date.now()
      }
    };
  }

  /**
   * Tokenize DSL text into structured tokens
   * @param {string} dslText - DSL text to tokenize
   * @returns {Array} Array of token objects
   */
  static tokenize(dslText) {
    if (!dslText || typeof dslText !== 'string') {
      return [];
    }

    const tokens = [];
    let position = 0;
    
    // Skip whitespace
    const skipWhitespace = () => {
      while (position < dslText.length && /\s/.test(dslText[position])) {
        position++;
      }
    };

    while (position < dslText.length) {
      skipWhitespace();
      
      if (position >= dslText.length) break;
      
      const char = dslText[position];
      const remaining = dslText.slice(position);
      
      // Expression placeholders: ${0}, ${1}, etc.
      if (remaining.startsWith('${')) {
        const match = remaining.match(/^\$\{(\d+)\}/);
        if (match) {
          tokens.push({
            type: 'expression',
            index: parseInt(match[1]),
            placeholder: match[0],
            start: position,
            end: position + match[0].length
          });
          position += match[0].length;
          continue;
        }
      }
      
      // Variables: ?name, ?age, etc.
      if (char === '?') {
        const match = remaining.match(/^\?[\w-]+/);
        if (match) {
          tokens.push({
            type: 'variable',
            value: match[0],
            start: position,
            end: position + match[0].length
          });
          position += match[0].length;
          continue;
        }
      }
      
      // String literals: "text" or 'text'
      if (char === '"' || char === "'") {
        const quote = char;
        let endPos = position + 1;
        let escaped = false;
        
        while (endPos < dslText.length) {
          if (escaped) {
            escaped = false;
          } else if (dslText[endPos] === '\\') {
            escaped = true;
          } else if (dslText[endPos] === quote) {
            break;
          }
          endPos++;
        }
        
        if (endPos < dslText.length) {
          const fullLiteral = dslText.slice(position, endPos + 1);
          const content = fullLiteral.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
          
          tokens.push({
            type: 'string',
            value: content,
            start: position,
            end: endPos + 1
          });
          position = endPos + 1;
          continue;
        }
      }
      
      // Numbers (including negative): -10, 3.14, 42
      // Parse numbers BEFORE operators to handle negative numbers correctly
      const numberMatch = remaining.match(/^-?\d+(\.\d+)?/);
      if (numberMatch) {
        const number = numberMatch[0];
        tokens.push({
          type: 'number',
          value: parseFloat(number),
          start: position,
          end: position + number.length
        });
        position += number.length;
        continue;
      }
      
      // Operators: >=, <=, !=, =, >, <, +, -, etc.
      const operatorPatterns = ['>=', '<=', '!=', '=', '>', '<', '+', '-'];
      let operatorFound = false;
      
      for (const op of operatorPatterns) {
        if (remaining.startsWith(op)) {
          tokens.push({
            type: 'operator',
            value: op,
            start: position,
            end: position + op.length
          });
          position += op.length;
          operatorFound = true;
          break;
        }
      }
      
      if (operatorFound) continue;
      
      // Identifiers: keywords, attributes, etc.
      const identifierMatch = remaining.match(/^[\w/-]+/);
      if (identifierMatch) {
        const identifier = identifierMatch[0];
        
        // Check if it's a keyword
        if (this._isKeyword(identifier)) {
          tokens.push({
            type: 'keyword',
            value: identifier,
            start: position,
            end: position + identifier.length
          });
        }
        // Check if it's an attribute (entity/attribute format)
        else if (identifier.includes('/')) {
          const [entity, attribute] = identifier.split('/');
          tokens.push({
            type: 'attribute',
            value: identifier,
            entity,
            attribute,
            start: position,
            end: position + identifier.length
          });
        }
        // Check if it's a boolean
        else if (identifier === 'true' || identifier === 'false') {
          tokens.push({
            type: 'boolean',
            value: identifier === 'true',
            start: position,
            end: position + identifier.length
          });
        }
        // Otherwise, it's an identifier
        else {
          tokens.push({
            type: 'identifier',
            value: identifier,
            start: position,
            end: position + identifier.length
          });
        }
        
        position += identifier.length;
        continue;
      }
      
      // Special characters
      const specialChars = ['(', ')', '[', ']', '{', '}', ':', ','];
      if (specialChars.includes(char)) {
        tokens.push({
          type: 'punctuation',
          value: char,
          start: position,
          end: position + 1
        });
        position++;
        continue;
      }
      
      // Unknown character - skip it
      position++;
    }
    
    return tokens;
  }

  /**
   * Analyze tokenized DSL for patterns and complexity
   * @param {Array} tokens - Array of token objects
   * @param {Object} context - Template literal context
   * @returns {Object} Analysis result
   */
  static analyzeTokens(tokens, context) {
    const analysis = {
      tokenCount: tokens.length,
      hasVariables: tokens.some(t => t.type === 'variable'),
      hasExpressions: tokens.some(t => t.type === 'expression'),
      hasKeywords: tokens.some(t => t.type === 'keyword'),
      hasAttributes: tokens.some(t => t.type === 'attribute'),
      complexity: 0
    };
    
    // Calculate complexity based on token diversity
    const tokenTypes = new Set(tokens.map(t => t.type));
    analysis.complexity = tokenTypes.size * 2 + tokens.length;
    
    if (context && context.metadata) {
      analysis.complexity += context.metadata.complexity;
    }
    
    return analysis;
  }

  /**
   * Check if identifier is a DSL keyword
   * @private
   */
  static _isKeyword(identifier) {
    const keywords = new Set([
      // Query keywords
      'find', 'where', 'orderBy', 'groupBy', 'as',
      // Schema keywords  
      'unique', 'value', 'identity', 'many', 'component',
      // Type keywords
      'string', 'number', 'boolean', 'ref', 'instant',
      // Update keywords
      'update', 'set',
      // Logical keywords
      'and', 'or', 'not', 'exists', 'in'
    ]);
    
    return keywords.has(identifier);
  }

  /**
   * Create detailed error object with position and context information
   * @param {string} message - Error message
   * @param {string} dslText - Full DSL text
   * @param {number} start - Error start position
   * @param {number} end - Error end position
   * @param {Object} metadata - Additional error metadata
   * @returns {Error} Enhanced error object
   */
  static createError(message, dslText, start, end, metadata = {}) {
    const error = new Error(message);
    
    // Position information
    error.dslText = dslText;
    error.start = start;
    error.end = end;
    
    // Calculate line and column
    const lines = dslText.slice(0, start).split('\n');
    error.line = lines.length;
    error.column = lines[lines.length - 1].length + 1;
    
    // Get context line
    const allLines = dslText.split('\n');
    error.contextLine = allLines[error.line - 1] || '';
    
    // Create visual pointer
    const pointerSpaces = ' '.repeat(Math.max(0, error.column - 1));
    const pointerLength = Math.max(1, end - start);
    error.pointer = pointerSpaces + '^'.repeat(pointerLength);
    
    // Add surrounding context
    error.beforeContext = allLines.slice(Math.max(0, error.line - 2), error.line - 1);
    error.afterContext = allLines.slice(error.line, Math.min(allLines.length, error.line + 2));
    
    // Add metadata
    Object.assign(error, metadata);
    
    return error;
  }

  /**
   * Parse with error recovery to collect multiple errors
   * @param {string} dslText - DSL text to parse
   * @param {string} dslType - Type of DSL (query, schema, update)
   * @returns {Object} Parse result with errors and partial tokens
   */
  static parseWithErrorRecovery(dslText, dslType) {
    const errors = [];
    const partialTokens = [];
    const recoveryPoints = [];
    
    try {
      const tokens = this.tokenize(dslText);
      const validation = this.validateTokenSequence(tokens, dslType);
      
      return {
        errors: validation.errors,
        partialTokens: tokens,
        recoverable: true,
        recoveryPoints: this._findRecoveryPoints(tokens),
        dslType
      };
    } catch (error) {
      return {
        errors: [error],
        partialTokens: [],
        recoverable: false,
        recoveryPoints: [],
        dslType
      };
    }
  }

  /**
   * Validate token sequence for specific DSL type
   * @param {Array} tokens - Array of tokens
   * @param {string} dslType - Type of DSL (query, schema, update, mixed)
   * @returns {Object} Validation result
   */
  static validateTokenSequence(tokens, dslType) {
    const errors = [];
    
    if (dslType === 'query') {
      // Query must have 'find' keyword
      if (!tokens.some(t => t.type === 'keyword' && t.value === 'find')) {
        errors.push({
          message: 'Query must start with "find" keyword',
          type: 'syntax',
          category: 'syntax',
          start: 0,
          end: 4
        });
      }
      
      // Query should have 'where' keyword (unless it's a simple find)
      const hasFindVars = tokens.some(t => t.type === 'variable');
      const hasWhere = tokens.some(t => t.type === 'keyword' && t.value === 'where');
      
      if (hasFindVars && !hasWhere) {
        errors.push({
          message: 'Query with variables must have "where" clause',
          type: 'syntax', 
          category: 'syntax',
          start: tokens[tokens.length - 1]?.end || 0,
          end: tokens[tokens.length - 1]?.end + 5 || 5
        });
      }
    }
    
    if (dslType === 'schema') {
      // Schema should have attribute definitions
      const hasAttributes = tokens.some(t => t.type === 'attribute');
      if (!hasAttributes) {
        errors.push({
          message: 'Schema must define at least one attribute',
          type: 'semantic',
          category: 'semantic',
          start: 0,
          end: 5
        });
      }
    }
    
    if (dslType === 'update') {
      // Update should have assignments
      const hasEquals = tokens.some(t => t.type === 'operator' && t.value === '=');
      if (!hasEquals) {
        errors.push({
          message: 'Update must have at least one assignment (=)',
          type: 'syntax',
          category: 'syntax', 
          start: 0,
          end: 5
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      tokenCount: tokens.length,
      dslType
    };
  }

  /**
   * Get suggestions for common errors
   * @param {Array} errors - Array of error objects
   * @returns {Array} Array of suggestion strings
   */
  static getSuggestions(errors) {
    const suggestions = [];
    
    errors.forEach(error => {
      if (error.message.includes('where')) {
        suggestions.push('Add "where" keyword after find clause');
      }
      
      if (error.message.includes('find')) {
        suggestions.push('Start query with "find" keyword');
      }
      
      if (error.message.includes('unknown') || error.message.includes('invalid')) {
        suggestions.push('Check spelling and available attributes/keywords');
      }
      
      if (error.message.includes('assignment')) {
        suggestions.push('Use "=" for attribute assignment');
      }
    });
    
    return suggestions;
  }

  /**
   * Format error for display with context
   * @param {Error} error - Error object with position information
   * @returns {string} Formatted error message
   */
  static formatError(error) {
    let formatted = `Error: ${error.message}\n`;
    
    if (error.line && error.column) {
      formatted += `  at line ${error.line}, column ${error.column}\n`;
    }
    
    if (error.contextLine) {
      formatted += `\n  ${error.contextLine}\n`;
      if (error.pointer) {
        formatted += `  ${error.pointer}\n`;
      }
    }
    
    if (error.suggestion) {
      formatted += `\n  Suggestion: ${error.suggestion}\n`;
    }
    
    return formatted;
  }

  /**
   * Find recovery points in token stream for error recovery
   * @private
   */
  static _findRecoveryPoints(tokens) {
    const recoveryPoints = [];
    
    // Recovery points are typically at keyword boundaries
    tokens.forEach((token, index) => {
      if (token.type === 'keyword') {
        recoveryPoints.push({
          index,
          keyword: token.value,
          position: token.start
        });
      }
    });
    
    return recoveryPoints;
  }

  /**
   * Calculate complexity score for template literal
   * @private
   */
  static _calculateComplexity(separated) {
    let complexity = 0;
    
    // Add complexity for expressions
    complexity += separated.expressionCount * 2;
    
    // Add complexity for text length
    complexity += Math.floor(separated.staticLength / 10);
    
    // Add complexity for special characters
    const specialChars = (separated.staticText.match(/[{}()\[\]<>=!]/g) || []).length;
    complexity += specialChars;
    
    return complexity;
  }

  /**
   * Parse multi-line schema text into DataScript format
   * @param {string} schemaText - Multi-line schema DSL text
   * @returns {Object} DataScript schema object
   */
  static parseSchema(schemaText) {
    if (!schemaText || typeof schemaText !== 'string') {
      return {};
    }

    const schema = {};
    const duplicateAttributes = new Set();
    
    // Split into lines and process each line
    const lines = schemaText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));

    for (const line of lines) {
      try {
        // Use the schema processing methods that are added to DSLParser
        const parsed = this.parseSchemaLine(line);
        const fullAttribute = `:${parsed.entity}/${parsed.attribute}`;
        
        // Check for duplicates
        if (schema[fullAttribute]) {
          if (!duplicateAttributes.has(fullAttribute)) {
            duplicateAttributes.add(fullAttribute);
          }
        }
        
        const dataScriptDef = this.toDataScriptSchema(parsed);
        Object.assign(schema, dataScriptDef);
      } catch (error) {
        // Continue processing other lines, but collect errors
        console.warn(`Skipping invalid schema line: ${line} - ${error.message}`);
      }
    }

    // Throw error if duplicates found
    if (duplicateAttributes.size > 0) {
      throw new Error(`Duplicate attribute definitions found: ${Array.from(duplicateAttributes).join(', ')}`);
    }

    return schema;
  }

  /**
   * Substitute expression placeholders with actual values
   * @param {string} text - Text with placeholders
   * @param {Array} expressions - Expression values
   * @returns {string} Text with substituted values
   */
  static _substituteExpressions(text, expressions) {
    if (!expressions || expressions.length === 0) {
      return text;
    }

    let result = text;
    expressions.forEach((expr, index) => {
      const placeholder = `\${${index}}`;
      let substitution;

      if (typeof expr === 'string') {
        // Don't add quotes - template literal should already have them
        substitution = expr;
      } else if (typeof expr === 'number') {
        substitution = String(expr);
      } else if (typeof expr === 'boolean') {
        substitution = String(expr);
      } else if (expr === null || expr === undefined) {
        substitution = 'null';
      } else if (expr instanceof Date) {
        // Preserve Date objects as-is by using a special marker
        substitution = `__DATE_OBJECT_${index}__`;
      } else {
        // For other objects and arrays, convert to string representation
        substitution = JSON.stringify(expr);
      }

      result = result.replace(placeholder, substitution);
    });

    return result;
  }
}