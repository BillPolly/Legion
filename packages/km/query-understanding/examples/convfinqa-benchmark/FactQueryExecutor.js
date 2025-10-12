/**
 * FactQueryExecutor - Execute queries against facts and perform operations
 *
 * Pure data lookup and arithmetic execution for ConvFinQA.
 * Receives concrete entity names from QueryInterpreter.
 *
 * Responsibilities:
 * - Lookup values in facts structure
 * - Execute arithmetic operations
 * - NO semantic resolution (done by QueryInterpreter)
 */

import { ArithmeticExecutor } from './ArithmeticExecutor.js';

export class FactQueryExecutor {
  constructor(facts, arithmeticExecutor = null) {
    this.facts = facts; // { entityId: { attribute: { year: value } } }
    this.arithmeticExecutor = arithmeticExecutor || new ArithmeticExecutor();
  }

  /**
   * Execute a query with concrete parameters from QueryInterpreter
   *
   * @param {Object} params - Execution parameters
   * @param {string} params.entity - Concrete entity name (e.g., 'ups')
   * @param {string} params.attribute - Attribute name (e.g., 'performance')
   * @param {string} params.fromYear - Start year
   * @param {string} params.toYear - End year
   * @param {string} params.operationType - Operation type ('subtract', 'divide', etc.)
   * @param {string} params.format - Format ('absolute', 'percentage')
   * @returns {Object} Execution result
   */
  execute(params) {
    if (params.error) {
      // QueryInterpreter encountered an error
      return { answer: null, type: 'error', error: params.error };
    }

    if (params.type === 'lookup') {
      return this._executeLookup(params);
    }

    if (params.type === 'operation') {
      return this._executeOperation(params);
    }

    if (params.type === 'operation_on_value') {
      return this._executeOperationOnValue(params);
    }

    if (params.type === 'coordination_operation') {
      return this._executeCoordinationOperation(params);
    }

    return { answer: null, type: 'error', error: 'Unknown query type' };
  }

  /**
   * Execute simple lookup
   * @private
   */
  _executeLookup(params) {
    const { entity, attribute, year } = params;

    const entityId = `:${entity}`;
    if (!this.facts[entityId]) {
      return { answer: null, type: 'lookup', error: `Entity ${entity} not found` };
    }

    const entityData = this.facts[entityId];
    const attrData = entityData[`:${attribute}`];

    if (!attrData) {
      return { answer: null, type: 'lookup', error: `Attribute ${attribute} not found` };
    }

    // Convert year to integer if it's a string
    const yearInt = typeof year === 'string' ? parseInt(year, 10) : year;
    const value = attrData[yearInt];
    if (value === undefined) {
      return { answer: null, type: 'lookup', error: `No data for year ${year}` };
    }

    return { answer: value, type: 'lookup' };
  }

  /**
   * Execute operation query
   * @private
   */
  _executeOperation(params) {
    const { entity, attribute, fromYear, toYear, operationType, format } = params;

    // Lookup entity
    const entityId = `:${entity}`;
    if (!this.facts[entityId]) {
      return { answer: null, type: 'operation', error: `Entity ${entity} not found` };
    }

    // Get attribute data
    const entityData = this.facts[entityId];
    const attrData = entityData[`:${attribute}`];

    if (!attrData) {
      return { answer: null, type: 'operation', error: `Attribute ${attribute} not found` };
    }

    // Get values (convert years to integers if they're strings)
    const fromYearInt = typeof fromYear === 'string' ? parseInt(fromYear, 10) : fromYear;
    const toYearInt = typeof toYear === 'string' ? parseInt(toYear, 10) : toYear;

    const fromValue = attrData[fromYearInt];
    const toValue = attrData[toYearInt];

    if (fromValue === undefined || toValue === undefined) {
      return {
        answer: null,
        type: 'operation',
        error: `Missing data for years ${fromYear} or ${toYear}`
      };
    }

    // Perform operation
    return this._performOperation(operationType, fromValue, toValue, format);
  }

  /**
   * Execute coordination operation - operation on two entities from history
   *
   * Example: "difference between X and Y"
   * Where value1 and value2 are retrieved from conversation history
   *
   * @private
   */
  _executeCoordinationOperation(params) {
    const { entity1, entity2, value1, value2, operationType, format } = params;

    // Perform operation on the two values
    let program = null;
    let answer = null;

    switch (operationType) {
      case 'subtract':
        // Difference = value1 - value2
        program = `subtract(${value1}, ${value2})`;
        break;

      case 'divide':
      case 'percentage':
        // Ratio or percentage
        if (format === 'percentage') {
          program = `divide(${value1}, ${value2}), multiply(#0, 100)`;
        } else {
          program = `divide(${value1}, ${value2})`;
        }
        break;

      default:
        return {
          answer: null,
          type: 'error',
          error: `Unknown operation: ${operationType}`
        };
    }

    answer = this.arithmeticExecutor.execute(program);

    return {
      answer,
      type: 'computed',
      program,
      operation: operationType,
      format,
      entity1,
      entity2
    };
  }

  /**
   * Execute operation on a previous result value
   * @private
   */
  _executeOperationOnValue(params) {
    const { baseValue, divisor, operationType, format } = params;

    // When format is 'percentage', we always perform division regardless of operationType
    // This handles cases like "fluctuation" (subtract) being asked as percentage
    if (format === 'percentage' || operationType === 'divide' || operationType === 'percentage') {
      if (divisor === null) {
        return { answer: null, type: 'error', error: 'No divisor for percentage calculation' };
      }

      // baseValue is the previous result (e.g., -8.94 = change value)
      // divisor is the base for percentage (e.g., 100 = performance in 2004)
      // Percentage = (changeValue / baseValue)

      let program;
      if (format === 'percentage') {
        // For percentage format, just divide (don't multiply by 100 - the expected answer is already a decimal)
        program = `divide(${baseValue}, ${divisor})`;
      } else {
        program = `divide(${baseValue}, ${divisor})`;
      }

      const answer = this.arithmeticExecutor.execute(program);

      return {
        answer,
        type: 'computed',
        program,
        operation: operationType,
        format
      };
    }

    return { answer: null, type: 'error', error: `Cannot perform ${operationType} on single value` };
  }

  /**
   * Perform arithmetic operation
   *
   * @private
   */
  _performOperation(type, fromValue, toValue, format) {
    let program = null;

    switch (type) {
      case 'subtract':
        // Change from X to Y = Y - X
        program = `subtract(${toValue}, ${fromValue})`;
        break;

      case 'divide':
      case 'percentage':
        // Percentage change = (Y - X) / X * 100
        const diff = toValue - fromValue;
        if (format === 'percentage') {
          program = `subtract(${toValue}, ${fromValue}), divide(#0, ${fromValue}), multiply(#1, 100)`;
        } else {
          program = `subtract(${toValue}, ${fromValue}), divide(#0, ${fromValue})`;
        }
        break;

      default:
        return { answer: null, error: `Unknown operation: ${type}` };
    }

    // Execute arithmetic program
    const answer = this.arithmeticExecutor.execute(program);

    return {
      answer,
      type: 'computed',
      program,
      operation: type,
      format
    };
  }
}
