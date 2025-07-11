const { OpenAITool } = require('../../core');

/**
 * Tool for evaluating mathematical expressions
 */
class CalculatorEvaluateTool extends OpenAITool {
  constructor() {
    super();
    this.name = 'calculator_evaluate';
    this.description = 'Evaluates a mathematical expression and returns the result';
    this.parameters = {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'JavaScript mathematical expression to evaluate (e.g., "784*566", "Math.sqrt(16)", "(10+5)*3/5")'
        }
      },
      required: ['expression']
    };
  }

  /**
   * Execute the calculator tool
   * @param {Object} args - The arguments
   * @param {string} args.expression - The mathematical expression to evaluate
   * @returns {Promise<Object>} The result
   */
  async execute({ expression } = {}) {
    try {
      // Validate expression
      if (expression === undefined || expression === null) {
        throw new Error('Expression is required');
      }
      
      if (typeof expression !== 'string') {
        throw new Error('Expression must be a string');
      }
      
      if (expression.trim() === '') {
        throw new Error('Expression cannot be empty');
      }
      
      // Check for potentially dangerous code
      const dangerous = ['console', 'process', 'require', 'import', 'eval', 'Function', 'setTimeout', 'setInterval'];
      for (const keyword of dangerous) {
        if (expression.includes(keyword)) {
          throw new Error(`Expression contains forbidden keyword: ${keyword}`);
        }
      }
      
      console.log('Evaluating expression:', expression);
      
      // Use Function constructor instead of eval for slightly better security
      // This still evaluates JavaScript, but in a more controlled way
      const result = Function('"use strict"; return (' + expression + ')')();
      
      console.log('Result:', result);
      
      return { result };
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${error.message}`);
    }
  }
}

module.exports = CalculatorEvaluateTool;