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
  
  // Parse update to generic format that Handles can interpret
  return DSLParser.updateToHandleFormat(templateResult.text, templateResult.expressions);
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
      return { assignments: [] };
    }

    // Split into lines and filter out empty lines
    const lines = updateText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));
    
    if (lines.length === 0) {
      return { assignments: [] };
    }

    const assignments = [];
    
    for (const line of lines) {
      const assignment = this._parseAssignmentLine(line);
      if (assignment) {
        assignments.push(assignment);
      }
    }

    return { assignments };
  },

  /**
   * Parse single assignment line
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

    // Check for relationship operators
    if (tokens[0].type === 'operator' && (tokens[0].value === '+' || tokens[0].value === '-')) {
      operator = tokens[0].value;
      operationType = operator === '+' ? 'relationship-add' : 'relationship-remove';
      attrIndex = 1;
    }

    // Get attribute
    const attrToken = tokens[attrIndex];
    if (!attrToken || attrToken.type !== 'attribute') {
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
      attribute: attrToken.value,
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
    
    if (parsed.assignments.length === 0) {
      return { type: 'update', assignments: [] };
    }

    // Return generic format - Handles will translate as needed
    return {
      type: 'update',
      assignments: parsed.assignments,
      // Original text for Handles that want to do their own parsing
      originalDSL: processedText
    };
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

    // Separate regular assignments from relationship operations
    const regularAssignments = handleUpdate.assignments.filter(a => a.type === 'assignment');
    const relationshipOps = handleUpdate.assignments.filter(a => 
      a.type === 'relationship-add' || a.type === 'relationship-remove'
    );

    // Convert regular assignments to update data
    const updateData = {};
    regularAssignments.forEach(assignment => {
      const attrKey = ':' + assignment.attribute;
      updateData[attrKey] = assignment.value;
    });

    // Convert relationship operations to transaction format
    const relationships = relationshipOps.map(rel => [
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
    const relationshipOps = parsed.assignments.filter(a => 
      a.type === 'relationship-add' || a.type === 'relationship-remove'
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
    
    // Add relationship transactions
    relationshipOps.forEach(rel => {
      transactions.push([
        rel.operator,
        null, // Entity ID placeholder
        ':' + rel.attribute,
        rel.value
      ]);
    });
    
    return transactions;
  }
});