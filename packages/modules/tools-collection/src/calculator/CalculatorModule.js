import { Tool, Module } from '@legion/tools-registry';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Calculator tool that evaluates mathematical expressions
 * NEW: Pure logic implementation - metadata comes from tools-metadata.json
 */
class CalculatorTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'calc';
  }

  // BACKWARDS COMPATIBILITY: support old pattern during migration
  static createLegacy() {
    return new CalculatorTool({
      name: 'calculator',
      description: 'Evaluates mathematical expressions and performs calculations',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'JavaScript mathematical expression to evaluate'
          }
        },
        required: ['expression']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'number', description: 'The result of the calculation' },
          expression: { type: 'string', description: 'The expression that was evaluated' }
        },
        required: ['result', 'expression']
      }
    });
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
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
 * Calculator module - NEW metadata-driven architecture
 * Metadata comes from tools-metadata.json, tools contain pure logic only
 */
class CalculatorModule extends Module {
  constructor() {
    super();
    this.name = 'calculator';
    this.description = 'Mathematical calculation tools for evaluating expressions and performing computations';
    this.version = '1.0.0';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
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
   * Initialize the module - NEW metadata-driven approach
   */
  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      // Create calculator tool using metadata
      const calculatorTool = this.createToolFromMetadata('calculator', CalculatorTool);
      this.registerTool(calculatorTool.name, calculatorTool);
    } else {
      // FALLBACK: Old approach for backwards compatibility
      const calculatorTool = CalculatorTool.createLegacy();
      this.registerTool(calculatorTool.name, calculatorTool);
    }
  }
}

// Export the module as the default
export default CalculatorModule;

// Also export the tool class for direct usage
