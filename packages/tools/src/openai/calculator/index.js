const OpenAICompatibleTool = require('../../base/openai-compatible-tool');

class CalculatorOpenAI extends OpenAICompatibleTool {
  constructor() {
    super();
    this.name = 'calculator';
    this.description = 'Performs mathematical calculations';
  }

  /**
   * Returns the tool description in OpenAI function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'calculator_evaluate',
        description: 'Evaluates a mathematical expression and returns the result',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'JavaScript mathematical expression to evaluate (e.g., "784*566", "Math.sqrt(16)", "(10+5)*3/5")'
            }
          },
          required: ['expression']
        }
      }
    };
  }

  /**
   * Invokes the calculator with the given tool call
   */
  async invoke(toolCall) {
    try {
      // Parse the arguments
      const args = this.parseArguments(toolCall.function.arguments);
      
      // Validate required parameters
      this.validateRequiredParameters(args, ['expression']);
      
      // Execute the calculation
      const result = await this.evaluate(args.expression);
      
      // Return success response
      return this.createSuccessResponse(
        toolCall.id,
        toolCall.function.name,
        { result }
      );
    } catch (error) {
      // Return error response
      return this.createErrorResponse(
        toolCall.id,
        toolCall.function.name,
        error
      );
    }
  }

  /**
   * Evaluates a mathematical expression
   */
  async evaluate(expression) {
    try {
      console.log('Evaluating expression:', expression);
      const result = eval(expression);
      console.log('Result:', result);
      return result;
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${error.message}`);
    }
  }
}

module.exports = CalculatorOpenAI;