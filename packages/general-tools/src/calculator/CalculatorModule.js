import { Tool, ToolResult, Module } from '@jsenvoy/module-loader';

/**
 * Calculator tool that evaluates mathematical expressions
 */
class CalculatorTool extends Tool {
  constructor() {
    super();
    this.name = 'calculator';
    this.shortName = 'calc';
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
        },
        output: {
          success: {
            type: 'object',
            properties: {
              result: {
                type: 'number',
                description: 'The calculated result of the expression'
              },
              expression: {
                type: 'string',
                description: 'The original expression that was evaluated'
              }
            },
            required: ['result', 'expression']
          },
          failure: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'The expression that failed to evaluate'
              },
              errorType: {
                type: 'string',
                enum: ['syntax_error', 'forbidden_keyword', 'evaluation_error'],
                description: 'The type of error that occurred'
              },
              details: {
                type: 'string',
                description: 'Additional error details if available'
              }
            },
            required: ['expression', 'errorType']
          }
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
      
      // Return success ToolResult
      return ToolResult.success({
        result: result,
        expression: args.expression
      });
    } catch (error) {
      // Determine error type
      let errorType = 'evaluation_error';
      if (error.message.includes('forbidden keyword')) {
        errorType = 'forbidden_keyword';
      } else if (error.message.includes('SyntaxError') || error.name === 'SyntaxError') {
        errorType = 'syntax_error';
      }
      
      // Return failure ToolResult with partial data
      let expression = 'unknown';
      try {
        if (toolCall.function.arguments) {
          expression = JSON.parse(toolCall.function.arguments).expression || 'unknown';
        }
      } catch (parseError) {
        expression = 'invalid_json';
      }
      
      return ToolResult.failure(
        error.message,
        {
          expression: expression,
          errorType: errorType,
          details: error.stack
        }
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
export default CalculatorModule;

// Also export the tool class for direct usage
export { CalculatorTool, CalculatorModule };