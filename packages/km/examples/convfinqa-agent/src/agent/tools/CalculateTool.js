/**
 * CalculateTool - Tool for performing arithmetic calculations
 *
 * Allows the agent to perform calculations on values retrieved from the KG.
 */

export const CalculateTool = {
  name: 'calculate',

  description: `Perform arithmetic calculations on numerical values.

Use this tool after retrieving values from the knowledge graph to compute answers.

Supported operations:
- add: Sum multiple values
- subtract: Subtract second value from first
- multiply: Multiply values together
- divide: Divide first value by second
- percentage_change: Calculate percentage change from old to new value

Examples:
- calculate({ operation: "subtract", values: [60.94, 25.14] }) → 35.8
- calculate({ operation: "divide", values: [35.8, 25.14] }) → 1.424
- calculate({ operation: "add", values: [10, 20, 30] }) → 60
- calculate({ operation: "percentage_change", values: [100, 120] }) → 20.0`,

  input_schema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide', 'percentage_change'],
        description: 'The arithmetic operation to perform'
      },
      values: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        description: 'The numerical values to operate on (for percentage_change: [old_value, new_value])'
      }
    },
    required: ['operation', 'values']
  },

  async execute(params, context) {
    const { operation } = params;
    const { logger } = context;

    // Accept both 'values' array and 'value1, value2' format for flexibility
    let values;
    if (params.values) {
      values = params.values;
    } else if (params.value1 !== undefined && params.value2 !== undefined) {
      values = [params.value1, params.value2];
    } else {
      return {
        error: 'Must provide either "values" array or "value1" and "value2" parameters'
      };
    }

    logger.debug('calculate', { operation, values });

    try {
      let result;

      switch (operation) {
        case 'add':
          result = values.reduce((sum, val) => sum + val, 0);
          break;

        case 'subtract':
          if (values.length !== 2) {
            return {
              error: 'subtract requires exactly 2 values'
            };
          }
          result = values[0] - values[1];
          break;

        case 'multiply':
          result = values.reduce((product, val) => product * val, 1);
          break;

        case 'divide':
          if (values.length !== 2) {
            return {
              error: 'divide requires exactly 2 values'
            };
          }
          if (values[1] === 0) {
            return {
              error: 'Division by zero'
            };
          }
          result = values[0] / values[1];
          break;

        case 'percentage_change':
          if (values.length !== 2) {
            return {
              error: 'percentage_change requires exactly 2 values [old_value, new_value]'
            };
          }
          if (values[0] === 0) {
            return {
              error: 'Cannot calculate percentage change from zero'
            };
          }
          // Formula: ((new - old) / old) * 100
          result = ((values[1] - values[0]) / values[0]) * 100;
          break;

        default:
          return {
            error: `Unknown operation: ${operation}`
          };
      }

      logger.info('calculate_success', {
        operation,
        values,
        result
      });

      return {
        success: true,
        operation,
        values,
        result
      };

    } catch (error) {
      logger.error('calculate_error', { error: error.message });

      return {
        error: `Calculation failed: ${error.message}`
      };
    }
  }
};
