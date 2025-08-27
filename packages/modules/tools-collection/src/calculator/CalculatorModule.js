import { Tool, Module } from '@legion/tools-registry';

/**
 * Calculator tool that evaluates mathematical expressions
 */
class CalculatorTool extends Tool {
  constructor() {
    super({
      name: 'calculator',
      description: 'Evaluates mathematical expressions and performs calculations',
      schema: {
        input: {
          type: 'object',
          properties: {
            expression: {
              type: ['string', 'number'],
              description: 'JavaScript mathematical expression to evaluate (e.g., "784*566", "Math.sqrt(16)", "(10+5)*3/5")'
            }
          },
          required: ['expression']
        },
        output: {
          type: 'object',
          properties: {
            result: {
              type: 'number',
              description: 'The result of the calculation'
            },
            expression: {
              type: 'string',
              description: 'The expression that was evaluated'
            }
          },
          required: ['result', 'expression']
        }
      }
    });
    this.shortName = 'calc';
    
    // Override _execute instead of execute to use base class error handling
    this._execute = async (params) => this._executeCalculation(params);
  }

  /**
   * Get tool metadata - required for compliance
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      shortName: this.shortName,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      version: '1.0.0',
      category: 'mathematical',
      tags: ['math', 'calculation', 'evaluation'],
      security: {
        dangerousKeywords: ['import', 'require', 'process', 'fs', 'child_process', 'exec', 'spawn'],
        evaluation: 'safe'
      }
    };
  }

  /**
   * Validate input parameters - required for compliance
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result
   */
  validate(params) {
    const errors = [];
    const warnings = [];
    
    // Check required fields
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (!params.expression) {
      errors.push('Expression is required');
    }
    
    if (params.expression && typeof params.expression !== 'string' && typeof params.expression !== 'number') {
      errors.push('Expression must be a string or number');
    }
    
    // Check for dangerous keywords
    if (params.expression && typeof params.expression === 'string') {
      const dangerous = ['import', 'require', 'process', 'fs', 'child_process', 'exec', 'spawn'];
      for (const keyword of dangerous) {
        if (params.expression.includes(keyword)) {
          errors.push(`Expression contains forbidden keyword: ${keyword}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Execute the calculator - no validation, just execution
   */
  async _executeCalculation(params) {
    // Convert expression to string if it's a number
    let { expression } = params;
    if (typeof expression === 'number') {
      expression = String(expression);
    }
    
    // Basic check - let execution fail if invalid
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
  constructor() {
    super();
    this.name = 'calculator';
    this.description = 'Mathematical calculation tools for evaluating expressions and performing computations';
    this.version = '1.0.0';
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new CalculatorModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Create and register the calculator tool
    const calculatorTool = new CalculatorTool();
    this.registerTool(calculatorTool.name, calculatorTool);
  }
}

// Export the module as the default
export default CalculatorModule;

// Also export the tool class for direct usage
