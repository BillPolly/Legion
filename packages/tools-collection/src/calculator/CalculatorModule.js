import { Tool, Module } from '@legion/tools-registry';
import { z } from 'zod';

/**
 * Calculator tool that evaluates mathematical expressions
 */
class CalculatorTool extends Tool {
  constructor() {
    super({
      name: 'calculator',
      description: 'Performs mathematical calculations',
      inputSchema: z.object({
        expression: z.union([z.string(), z.number()]).transform(val => String(val)).describe('JavaScript mathematical expression to evaluate (e.g., "784*566", "Math.sqrt(16)", "(10+5)*3/5")')
      })
    });
    this.shortName = 'calc';
    
    // Override _execute instead of execute to use base class error handling
    this._execute = async (params) => this._executeCalculation(params);
  }

  /**
   * Execute the calculator with validated parameters
   */
  async _executeCalculation(params) {
    const { expression } = params;
    
    // Validate expression before using it
    if (!expression) {
      throw new Error('Expression is required');
    }
    
    // Emit progress event
    this.progress(`Evaluating expression: ${expression}`, 0);
    
    // Execute the calculation
    const result = await this.evaluate(expression);
    
    // Emit completion
    this.info(`Calculation completed: ${expression} = ${result}`);
    
    // Return result
    return {
      result: result,
      expression: expression
    };
  }

  /**
   * Evaluates a mathematical expression
   */
  async evaluate(expression) {
    try {
      // Validate expression exists and is a string
      if (!expression) {
        throw new Error('Expression is required');
      }
      if (typeof expression !== 'string') {
        throw new Error('Expression must be a string');
      }
      
      // Check for potentially dangerous code
      const dangerous = ['import', 'require', 'process', 'fs', 'child_process', 'exec', 'spawn'];
      for (const keyword of dangerous) {
        if (expression.includes(keyword)) {
          this.warning(`Expression contains forbidden keyword: ${keyword}`, {
            expression: expression,
            keyword: keyword
          });
          throw new Error(`Expression contains forbidden keyword: ${keyword}`);
        }
      }
      
      // Use Function constructor for safer evaluation
      const result = Function('"use strict"; return (' + expression + ')')();
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
    this.description = 'Mathematical calculation tools for evaluating expressions and performing computations';
    
    // Create and register the calculator tool
    this.tools = {};
    const calculatorTool = new CalculatorTool();
    this.registerTool(calculatorTool.name, calculatorTool);
  }
}

// Export the module as the default
export default CalculatorModule;

// Also export the tool class for direct usage
export { CalculatorTool, CalculatorModule };