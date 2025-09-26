/**
 * Update DSL - Template literal update syntax for Handles
 * 
 * Provides intuitive update and relationship management syntax using template literals.
 * Works with any Handle implementation - the Handle itself handles translation.
 */

import { DSLParser } from './parser.js';

/**
 * Tagged template literal function for update operations
 * @param {TemplateStringsArray} strings - Template literal strings
 * @param {...any} expressions - Template literal expressions
 * @returns {Object} Generic update object for Handle.update()
 */
export function update(strings, ...expressions) {
  // Process template literal
  const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
  
  // Substitute expressions to get final text for format detection
  const finalText = DSLParser._substituteExpressions(templateResult.text, templateResult.expressions);
  
  // Detect format: Handle format (has "set" keyword) vs DataStore format (direct assignment)
  if (finalText.trim().toLowerCase().startsWith('set ') || finalText.includes(' set ')) {
    // Handle format - parse with set/where syntax
    return DSLParser.updateToHandleFormat(templateResult.text, templateResult.expressions);
  } else {
    // DataStore format - parse direct assignment syntax
    // Note: Schema validation happens in EntityProxy or DataStore if needed
    return DSLParser.updateToDataStoreFormat(templateResult.text, templateResult.expressions);
  }
}

// Extend DSLParser with update-specific methods
Object.assign(DSLParser, {
  /**
   * Parse update statement from DSL text
   * @param {string} updateText - Update DSL text
   * @returns {Object} Parsed update structure
   */
  parseUpdateStatement(updateText) {
    if (!updateText || typeof updateText !== 'string') {
      return { assignments: [], where: [] };
    }

    // Tokenize the entire update text
    const tokens = this.tokenize(updateText);
    
    if (tokens.length === 0) {
      return { assignments: [], where: [] };
    }

    // Find 'set' keyword
    const setIndex = tokens.findIndex(t => t.type === 'keyword' && t.value === 'set');
    if (setIndex === -1) {
      throw new Error('Update must start with "set" keyword');
    }

    // Find 'where' keyword
    const whereIndex = tokens.findIndex(t => t.type === 'keyword' && t.value === 'where');
    
    // Parse set clause
    const setClause = this._parseSetClause(tokens, setIndex, whereIndex);
    
    // Parse where clause if present
    const whereClause = whereIndex !== -1 ? 
      this._parseUpdateWhereClause(tokens, whereIndex) : [];

    return { assignments: setClause, where: whereClause };
  },

  /**
   * Parse set clause from tokens
   * @private
   */
  _parseSetClause(tokens, setIndex, whereIndex) {
    const endIndex = whereIndex !== -1 ? whereIndex : tokens.length;
    const setTokens = tokens.slice(setIndex + 1, endIndex);
    
    if (setTokens.length === 0) {
      throw new Error('Set clause must specify assignments');
    }

    const assignments = [];
    let i = 0;
    
    while (i < setTokens.length) {
      const assignment = this._parseAssignmentTokens(setTokens, i);
      if (assignment) {
        assignments.push(assignment.assignment);
        i = assignment.endIndex;
        
        // Skip comma separator
        if (i < setTokens.length && setTokens[i].type === 'punctuation' && setTokens[i].value === ',') {
          i++;
        }
      } else {
        i++;
      }
    }
    
    return assignments;
  },

  /**
   * Parse where clause from tokens for updates
   * @private
   */
  _parseUpdateWhereClause(tokens, whereIndex) {
    const whereTokens = tokens.slice(whereIndex + 1);
    
    if (whereTokens.length === 0) {
      return [];
    }

    const conditions = [];
    let i = 0;
    
    while (i < whereTokens.length) {
      const condition = this._parseWhereCondition(whereTokens, i);
      if (condition) {
        conditions.push(condition.condition);
        i = condition.endIndex;
      } else {
        i++;
      }
    }
    
    return conditions;
  },

  /**
   * Parse assignment from tokens
   * @private
   */
  _parseAssignmentTokens(tokens, startIndex) {
    if (startIndex + 2 >= tokens.length) {
      return null; // Not enough tokens for assignment
    }

    let i = startIndex;
    let operator = '=';
    let operationType = 'assignment';

    // Check for multi-valued operators (+/- for adding/removing from multi-valued attributes)
    if (tokens[i].type === 'operator' && (tokens[i].value === '+' || tokens[i].value === '-')) {
      operator = tokens[i].value;
      operationType = operator === '+' ? 'multi-add' : 'multi-remove';
      i++;
    }

    // Get attribute - handle :attribute format and simple identifiers
    let attribute;
    if (i < tokens.length && 
        tokens[i].type === 'punctuation' && 
        tokens[i].value === ':' &&
        i + 1 < tokens.length &&
        tokens[i + 1].type === 'identifier') {
      // Handle :attribute format (split by tokenizer)
      attribute = {
        type: 'attribute',
        value: ':' + tokens[i + 1].value
      };
      i += 2; // Skip ':' and identifier
    } else if (tokens[i] && tokens[i].type === 'attribute') {
      // Handle attribute token (entity/attribute format)
      attribute = tokens[i];
      i++;
    } else if (tokens[i] && tokens[i].type === 'identifier') {
      // Handle simple identifier as attribute
      attribute = {
        type: 'attribute',
        value: tokens[i].value
      };
      i++;
    } else {
      return null;
    }

    // Get equals operator
    if (i >= tokens.length || tokens[i].type !== 'operator' || tokens[i].value !== '=') {
      return null;
    }
    i++; // Skip '='

    // Get value
    if (i >= tokens.length) {
      return null;
    }
    
    const valueToken = tokens[i];
    let value, valueType;

    if (valueToken.type === 'string') {
      value = valueToken.value;
      valueType = 'string';
    } else if (valueToken.type === 'number') {
      value = valueToken.value;
      valueType = 'number';
    } else if (valueToken.type === 'boolean') {
      value = valueToken.value;
      valueType = 'boolean';
    } else if (valueToken.type === 'expression') {
      value = valueToken.placeholder;
      valueType = 'expression';
    } else if (valueToken.type === 'identifier' && 
               typeof valueToken.value === 'string' && 
               valueToken.value.startsWith('__DATE_OBJECT_')) {
      // Handle Date object markers
      const indexMatch = valueToken.value.match(/__DATE_OBJECT_(\d+)__/);
      if (indexMatch) {
        const index = parseInt(indexMatch[1]);
        // We need access to the original expressions array
        // For now, store the marker and handle it later
        value = valueToken.value;
        valueType = 'date-marker';
      }
    } else {
      value = valueToken.value;
      valueType = 'unknown';
    }

    return {
      assignment: {
        attribute: attribute.value,
        operator,
        value,
        type: operationType,
        valueType
      },
      endIndex: i + 1
    };
  },

  /**
   * Parse where condition from tokens
   * @private
   */
  _parseWhereCondition(tokens, startIndex) {
    if (startIndex + 2 >= tokens.length) {
      return null;
    }

    let i = startIndex;

    // Get attribute - handle :attribute format
    let attribute;
    if (i < tokens.length && 
        tokens[i].type === 'punctuation' && 
        tokens[i].value === ':' &&
        i + 1 < tokens.length &&
        tokens[i + 1].type === 'identifier') {
      // Handle :attribute format
      attribute = ':' + tokens[i + 1].value;
      i += 2;
    } else if (tokens[i] && tokens[i].type === 'attribute') {
      attribute = tokens[i].value;
      i++;
    } else {
      return null;
    }

    // Get operator
    if (i >= tokens.length || tokens[i].type !== 'operator') {
      return null;
    }
    const operator = tokens[i].value;
    i++;

    // Get value
    if (i >= tokens.length) {
      return null;
    }
    const value = tokens[i].value;

    return {
      condition: [attribute, operator, value],
      endIndex: i + 1
    };
  },

  /**
   * Parse single assignment line (deprecated - keeping for compatibility)
   * @private
   */
  _parseAssignmentLine(line) {
    // Tokenize the line
    const tokens = this.tokenize(line);
    
    if (tokens.length < 3) {
      throw new Error(`Invalid assignment format: ${line}`);
    }

    // Look for assignment pattern: [+/-]attribute = value
    let attrIndex = 0;
    let operator = '=';
    let operationType = 'assignment';

    // Check for multi-valued operators (+/- for adding/removing from multi-valued attributes)
    if (tokens[0].type === 'operator' && (tokens[0].value === '+' || tokens[0].value === '-')) {
      operator = tokens[0].value;
      operationType = operator === '+' ? 'multi-add' : 'multi-remove';
      attrIndex = 1;
    }

    // Get attribute - handle :attribute format
    let attribute;
    if (attrIndex < tokens.length && 
        tokens[attrIndex].type === 'punctuation' && 
        tokens[attrIndex].value === ':' &&
        attrIndex + 1 < tokens.length &&
        tokens[attrIndex + 1].type === 'identifier') {
      // Handle :attribute format (split by tokenizer)
      attribute = {
        type: 'attribute',
        value: ':' + tokens[attrIndex + 1].value
      };
      attrIndex += 1; // Skip the ':' token, attrIndex now points to identifier
    } else if (tokens[attrIndex] && tokens[attrIndex].type === 'attribute') {
      // Handle simple attribute
      attribute = tokens[attrIndex];
    } else {
      throw new Error(`Missing or invalid attribute in: ${line}`);
    }

    // Get equals operator
    const equalsToken = tokens[attrIndex + 1];
    if (!equalsToken || equalsToken.type !== 'operator' || equalsToken.value !== '=') {
      throw new Error(`Missing '=' operator in: ${line}`);
    }

    // Get value
    const valueToken = tokens[attrIndex + 2];
    if (!valueToken) {
      throw new Error(`Missing value in: ${line}`);
    }

    // Extract value based on type
    let value;
    let valueType;

    if (valueToken.type === 'string') {
      value = valueToken.value;
      valueType = 'string';
    } else if (valueToken.type === 'number') {
      value = valueToken.value;
      valueType = 'number';
    } else if (valueToken.type === 'boolean') {
      value = valueToken.value;
      valueType = 'boolean';
    } else if (valueToken.type === 'expression') {
      value = valueToken.placeholder;
      valueType = 'expression';
      valueToken.expressionIndex = valueToken.index;
    } else {
      // Try to parse as array or other complex type
      value = this._parseComplexValue(tokens.slice(attrIndex + 2));
      valueType = Array.isArray(value) ? 'array' : 'unknown';
    }

    return {
      attribute: attribute.value,
      operator,
      value,
      type: operationType,
      valueType,
      expressionIndex: valueToken.expressionIndex
    };
  },

  /**
   * Parse complex values like arrays
   * @private
   */
  _parseComplexValue(tokens) {
    if (tokens.length === 0) {
      return null;
    }

    const firstToken = tokens[0];
    
    // Handle arrays: ["item1", "item2"]
    if (firstToken.type === 'punctuation' && firstToken.value === '[') {
      const arrayItems = [];
      let i = 1;
      
      while (i < tokens.length && tokens[i].value !== ']') {
        const token = tokens[i];
        
        if (token.type === 'string' || token.type === 'number' || token.type === 'boolean') {
          arrayItems.push(token.value);
        }
        
        i++;
        
        // Skip commas
        if (i < tokens.length && tokens[i].value === ',') {
          i++;
        }
      }
      
      return arrayItems;
    }
    
    // Single value
    return firstToken.value;
  },

  /**
   * Convert update DSL to generic Handle update format
   * @param {string} updateText - Update DSL text
   * @param {Array} expressions - Template literal expressions
   * @returns {Object} Generic update object that any Handle can interpret
   */
  updateToHandleFormat(updateText, expressions = []) {
    // Substitute expressions first
    const processedText = this._substituteExpressions(updateText, expressions);
    
    // Parse update statements
    const parsed = this.parseUpdateStatement(processedText);
    
    // Restore Date objects from markers
    if (parsed.assignments) {
      parsed.assignments.forEach(assignment => {
        if (assignment.valueType === 'date-marker' && 
            typeof assignment.value === 'string' && 
            assignment.value.startsWith('__DATE_OBJECT_')) {
          const indexMatch = assignment.value.match(/__DATE_OBJECT_(\d+)__/);
          if (indexMatch) {
            const index = parseInt(indexMatch[1]);
            if (expressions[index] instanceof Date) {
              assignment.value = expressions[index];
              assignment.valueType = 'date';
            }
          }
        }
      });
    }
    
    if (parsed.assignments.length === 0) {
      return { type: 'update', assignments: [], where: parsed.where || [] };
    }

    // Return generic format - Handles will translate as needed
    return {
      type: 'update',
      assignments: parsed.assignments,
      where: parsed.where || [],
      // Original text for Handles that want to do their own parsing
      originalDSL: processedText
    };
  },

  /**
   * Convert update DSL to DataStore format (direct assignment syntax)
   * @param {string} updateText - Update DSL text
   * @param {Array} expressions - Template literal expressions
   * @param {Object} schema - Optional schema for cardinality validation
   * @returns {Object} DataStore update object
   */
  updateToDataStoreFormat(updateText, expressions = [], schema = null) {
    // Substitute expressions first
    const processedText = this._substituteExpressions(updateText, expressions);
    
    // Parse direct assignment statements (no "set" keyword)
    const parsed = this.parseDirectAssignments(processedText);
    
    if (parsed.assignments.length === 0) {
      return {};
    }

    // Restore Date objects from markers
    parsed.assignments.forEach(assignment => {
      if (typeof assignment.value === 'string' && assignment.value.startsWith('__DATE_OBJECT_')) {
        const indexMatch = assignment.value.match(/__DATE_OBJECT_(\d+)__/);
        if (indexMatch) {
          const index = parseInt(indexMatch[1]);
          if (expressions[index] instanceof Date) {
            assignment.value = expressions[index];
            assignment.valueType = 'date';
          }
        }
      }
    });

    // Validate cardinality for multi-valued operations if schema is provided
    if (schema) {
      parsed.assignments.forEach(assignment => {
        if (assignment.type === 'multi-add' || assignment.type === 'multi-remove') {
          const attrKey = ':' + assignment.attribute;
          const attrSchema = schema[attrKey];
          
          if (attrSchema && attrSchema.card !== 'many') {
            throw new Error(
              `Cannot use ${assignment.operator} operator on attribute '${attrKey}' - ` +
              `it is not defined with 'card: many' in the schema. ` +
              `Use regular assignment (=) for single-valued attributes.`
            );
          }
          
          if (!attrSchema) {
            console.warn(
              `Warning: Using ${assignment.operator} operator on '${attrKey}' ` +
              `but attribute is not defined in schema. Assuming card:many.`
            );
          }
        }
      });
    }

    // Convert assignments to DataStore format
    const updateData = {};
    const relationships = [];
    
    parsed.assignments.forEach(assignment => {
      if (assignment.type === 'multi-add' || assignment.type === 'multi-remove') {
        // Handle multi-valued attribute operations (add/remove from card:many attributes)
        relationships.push([
          assignment.operator, // '+' or '-'
          null, // Entity ID will be filled by caller
          ':' + assignment.attribute,
          assignment.value
        ]);
      } else {
        // Regular assignment - convert to DataScript format
        const attrKey = ':' + assignment.attribute.replace('/', '/');
        updateData[attrKey] = assignment.value;
      }
    });

    // Return appropriate format
    if (relationships.length > 0) {
      return { updateData, relationships };
    } else {
      return updateData;
    }
  },

  /**
   * Convert generic Handle update to DataStore format
   * Used by DataStoreHandle to translate generic updates
   * @param {Object} handleUpdate - Generic Handle update
   * @returns {Object} Data-store compatible update data
   */
  handleUpdateToDataStore(handleUpdate) {
    if (!handleUpdate.assignments || handleUpdate.assignments.length === 0) {
      return {};
    }

    // Separate regular assignments from multi-valued operations
    const regularAssignments = handleUpdate.assignments.filter(a => a.type === 'assignment');
    const multiValueOps = handleUpdate.assignments.filter(a => 
      a.type === 'multi-add' || a.type === 'multi-remove'
    );

    // Convert regular assignments to update data
    const updateData = {};
    regularAssignments.forEach(assignment => {
      const attrKey = ':' + assignment.attribute;
      updateData[attrKey] = assignment.value;
    });

    // Convert multi-valued operations to transaction format
    const relationships = multiValueOps.map(rel => [
      rel.operator, // '+' or '-'
      null, // Entity ID will be filled by caller
      ':' + rel.attribute,
      rel.value
    ]);

    // Return appropriate format
    if (relationships.length > 0) {
      return { updateData, relationships };
    } else {
      return updateData;
    }
  },

  /**
   * Convert update to transaction format
   * @param {string} updateText - Update DSL text
   * @returns {Object} Transaction data
   */
  updateToTransaction(updateText) {
    const parsed = this.parseUpdateStatement(updateText);
    const transaction = {};
    
    parsed.assignments.forEach(assignment => {
      const attrKey = ':' + assignment.attribute;
      transaction[attrKey] = assignment.value;
    });
    
    return transaction;
  },

  /**
   * Convert update to multiple transactions (for relationships)
   * @param {string} updateText - Update DSL text
   * @returns {Array} Array of transaction objects
   */
  updateToTransactions(updateText) {
    const parsed = this.parseUpdateStatement(updateText);
    const transactions = [];
    
    const regularAssignments = parsed.assignments.filter(a => a.type === 'assignment');
    const multiValueOps = parsed.assignments.filter(a => 
      a.type === 'multi-add' || a.type === 'multi-remove'
    );
    
    // Add regular update transaction
    if (regularAssignments.length > 0) {
      const updateTx = {};
      regularAssignments.forEach(assignment => {
        const attrKey = ':' + assignment.attribute;
        updateTx[attrKey] = assignment.value;
      });
      transactions.push(updateTx);
    }
    
    // Add multi-valued operation transactions
    multiValueOps.forEach(rel => {
      transactions.push([
        rel.operator,
        null, // Entity ID placeholder
        ':' + rel.attribute,
        rel.value
      ]);
    });
    
    return transactions;
  },

  /**
   * Parse direct assignment statements (DataStore format without "set" keyword)
   * @param {string} updateText - Update DSL text with direct assignments
   * @returns {Object} Parsed assignments structure
   */
  parseDirectAssignments(updateText) {
    if (!updateText || typeof updateText !== 'string') {
      return { assignments: [], where: [] };
    }

    // Split by newlines and filter out empty lines
    const lines = updateText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const assignments = [];
    
    // Parse each line as a direct assignment
    lines.forEach(line => {
      try {
        const assignment = this._parseDirectAssignmentLine(line);
        if (assignment) {
          assignments.push(assignment);
        }
      } catch (error) {
        // Skip invalid lines - continue parsing others
        console.warn('Skipping invalid assignment line:', line, error.message);
      }
    });

    return { assignments, where: [] };
  },

  /**
   * Parse a single direct assignment line (e.g., "user/name = 'value'")
   * @param {string} line - Assignment line
   * @returns {Object} Parsed assignment
   * @private
   */
  _parseDirectAssignmentLine(line) {
    // Tokenize the line
    const tokens = this.tokenize(line);
    
    if (tokens.length < 3) {
      return null; // Not enough tokens for assignment
    }

    let attrIndex = 0;
    let operator = '=';
    let operationType = 'assignment';

    // Check for multi-valued operators at the beginning
    if (tokens[0].type === 'operator' && (tokens[0].value === '+' || tokens[0].value === '-')) {
      operator = tokens[0].value;
      operationType = operator === '+' ? 'multi-add' : 'multi-remove';
      attrIndex = 1;
    }

    // Get attribute name
    if (attrIndex >= tokens.length) {
      return null;
    }

    let attribute;
    const attrToken = tokens[attrIndex];

    if (attrToken.type === 'identifier' || attrToken.type === 'attribute') {
      // Handle "user/name" or ":user/name" format
      attribute = attrToken.value.startsWith(':') ? attrToken.value.substring(1) : attrToken.value;
    } else {
      return null;
    }

    // Get equals operator
    const equalsIndex = attrIndex + 1;
    if (equalsIndex >= tokens.length || 
        tokens[equalsIndex].type !== 'operator' || 
        tokens[equalsIndex].value !== '=') {
      return null;
    }

    // Get value
    const valueIndex = equalsIndex + 1;
    if (valueIndex >= tokens.length) {
      return null;
    }
    
    const valueToken = tokens[valueIndex];
    let value, valueType;

    if (valueToken.type === 'string') {
      value = valueToken.value;
      valueType = 'string';
    } else if (valueToken.type === 'number') {
      value = valueToken.value;
      valueType = 'number';
    } else if (valueToken.type === 'boolean') {
      value = valueToken.value;
      valueType = 'boolean';
    } else if (valueToken.type === 'expression') {
      value = valueToken.placeholder;
      valueType = 'expression';
    } else if (valueToken.type === 'identifier' && 
               typeof valueToken.value === 'string' && 
               valueToken.value.startsWith('__DATE_OBJECT_')) {
      // Handle Date object markers
      value = valueToken.value;
      valueType = 'date-marker';
    } else {
      // Try to parse as complex value (array, etc)
      value = this._parseComplexValue(tokens.slice(valueIndex));
      valueType = Array.isArray(value) ? 'array' : 'unknown';
    }

    return {
      attribute,
      operator,
      value,
      type: operationType,
      valueType
    };
  }
});