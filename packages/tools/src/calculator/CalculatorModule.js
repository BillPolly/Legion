const { Tool, Module } = require('@jsenvoy/modules');

/**
 * Calculator tool that evaluates mathematical expressions
 */
class CalculatorTool extends Tool {
  constructor() {
    super();
    this.name = 'calculator';
    this.description = 'Performs mathematical calculations';
  }

  /**
   * Returns the tool description in standard function calling format
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
      
      // Check for potentially dangerous code
      const dangerous = ['import', 'require', 'process', 'fs', 'child_process', 'exec', 'spawn'];
      for (const keyword of dangerous) {
        if (expression.includes(keyword)) {
          throw new Error(`Expression contains forbidden keyword: ${keyword}`);
        }
      }
      
      // Use Function constructor for safer evaluation
      const result = Function('"use strict"; return (' + expression + ')')();
      console.log('Result:', result);
      return result;
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${error.message}`);
    }
  }
}

/**
 * Calculator module that provides mathematical calculation tools
 * This is a self-contained module with no external dependencies
 */
class CalculatorModule extends Module {
  // No external dependencies needed
  static dependencies = [];

  constructor({} = {}) {
    super();
    this.name = 'calculator';
    
    // Create the calculator tool
    this.tools = [
      new CalculatorTool()
    ];
  }
}

// Export the module as the default
module.exports = CalculatorModule;

// Also export the tool class for direct usage
module.exports.CalculatorTool = CalculatorTool;
module.exports.CalculatorModule = CalculatorModule;