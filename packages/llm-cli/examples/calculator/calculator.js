import { LLMCLIFramework } from '../../src/core/framework/LLMCLIFramework.js';
import { LLMIntentRecognizer } from '../../src/processing/intent/recognizer/LLMIntentRecognizer.js';

// Custom context provider for calculator state
class CalculatorContextProvider {
  constructor() {
    this.name = 'calculator_state';
    this.description = 'Provides calculator state and history context';
  }
  
  async getContext(session) {
    const state = session.state.get('calculator_state') || {
      variables: {},
      history: []
    };
    
    const items = [];
    
    if (state.lastResult !== undefined) {
      items.push(`Last result: ${state.lastResult}`);
    }
    
    if (Object.keys(state.variables).length > 0) {
      items.push('Stored variables:');
      for (const [name, value] of Object.entries(state.variables)) {
        items.push(`  ${name} = ${value}`);
      }
    }
    
    if (state.history.length > 0) {
      items.push(`Recent calculations: ${state.history.length}`);
    }
    
    return {
      summary: items.join('\n'),
      details: {
        variableCount: Object.keys(state.variables).length,
        historyCount: state.history.length,
        variables: state.variables,
        lastResult: state.lastResult
      }
    };
  }
}

export class CalculatorCLI {
  constructor(options) {
    this.framework = new LLMCLIFramework({
      llmProvider: options.llmProvider,
      commands: {}, // Commands will be registered separately
      contextProviders: [new CalculatorContextProvider()],
      intentRecognizer: new LLMIntentRecognizer(options.llmProvider),
      promptTemplate: {
        systemTemplate: `You are a helpful calculator assistant. You can:
- Perform arithmetic operations (add, subtract, multiply, divide, power, sqrt, etc.)
- Store and recall variables
- Convert units (length, temperature, currency, etc.)
- Calculate statistics (mean, median, standard deviation)
- Show calculation history

Always show the calculation steps and the final result clearly.
For errors, explain what went wrong and suggest corrections.`
      }
    });

    this.registerCommands();
  }

  registerCommands() {
    // Basic arithmetic
    this.framework.registerCommand('calculate', {
      description: 'Perform arithmetic calculations',
      parameters: [
        {
          name: 'expression',
          type: 'string',
          description: 'Mathematical expression to evaluate',
          required: true
        }
      ],
      examples: [
        { input: '5 + 3', output: '5 + 3 = 8' },
        { input: '(10 + 5) * 2', output: '(10 + 5) * 2 = 30' }
      ],
      handler: async (params, session) => 
        this.calculate(params.expression, session)
    });

    // Memory operations
    this.framework.registerCommand('store', {
      description: 'Store a value in memory',
      parameters: [
        {
          name: 'value',
          type: 'number',
          description: 'Value to store',
          required: true
        },
        {
          name: 'name',
          type: 'string',
          description: 'Variable name',
          required: true
        }
      ],
      examples: [
        { input: 'Store 42 as x', output: 'Stored x = 42' }
      ],
      handler: async (params, session) => this.storeVariable(
        params.name,
        params.value,
        session
      )
    });

    this.framework.registerCommand('recall', {
      description: 'Recall a stored variable',
      parameters: [
        {
          name: 'name',
          type: 'string',
          description: 'Variable name to recall',
          required: true
        }
      ],
      handler: async (params, session) => this.recallVariable(params.name, session)
    });

    this.framework.registerCommand('list_variables', {
      description: 'List all stored variables',
      handler: async (_, session) => this.listVariables(session)
    });

    this.framework.registerCommand('clear_memory', {
      description: 'Clear all stored variables',
      handler: async (_, session) => this.clearMemory(session)
    });

    // Unit conversion
    this.framework.registerCommand('convert', {
      description: 'Convert between units',
      parameters: [
        {
          name: 'value',
          type: 'number',
          description: 'Value to convert',
          required: true
        },
        {
          name: 'from_unit',
          type: 'string',
          description: 'Source unit',
          required: true
        },
        {
          name: 'to_unit',
          type: 'string',
          description: 'Target unit',
          required: true
        }
      ],
      examples: [
        { input: 'Convert 5 km to miles', output: '5 kilometers = 3.11 miles' }
      ],
      handler: async (params, session) => this.convert(
        params.value,
        params.from_unit,
        params.to_unit,
        session
      )
    });

    // Statistics
    this.framework.registerCommand('statistics', {
      description: 'Calculate statistics for a list of numbers',
      parameters: [
        {
          name: 'numbers',
          type: 'array',
          description: 'List of numbers',
          required: true
        },
        {
          name: 'operation',
          type: 'string',
          description: 'Statistical operation (mean, median, stddev)',
          required: true
        }
      ],
      handler: async (params, session) => this.statistics(
        params.numbers,
        params.operation,
        session
      )
    });

    // History
    this.framework.registerCommand('history', {
      description: 'Show calculation history',
      parameters: [
        {
          name: 'limit',
          type: 'number',
          description: 'Number of recent calculations to show',
          required: false,
          default: 10
        }
      ],
      handler: async (params, session) => this.showHistory(params.limit, session)
    });

    // Help
    this.framework.registerCommand('help', {
      description: 'Show help and available commands',
      handler: async () => this.showHelp()
    });
  }

  getState(session) {
    let state = session.state.get('calculator_state');
    if (!state) {
      state = {
        variables: {},
        history: []
      };
      session.state.set('calculator_state', state);
    }
    return state;
  }

  async calculate(expression, session) {
    const state = this.getState(session);
    
    try {
      // Replace variables with their values
      let processedExpression = expression;
      for (const [name, value] of Object.entries(state.variables)) {
        processedExpression = processedExpression.replace(
          new RegExp(`\\b${name}\\b`, 'g'),
          value.toString()
        );
      }

      // Handle special cases
      if (state.lastResult !== undefined && /^(that|it|result)/i.test(processedExpression)) {
        processedExpression = processedExpression.replace(
          /\b(that|it|result)\b/gi,
          state.lastResult.toString()
        );
      }

      // Evaluate the expression (in a real implementation, use a proper parser)
      const result = this.evaluateExpression(processedExpression);
      
      if (result === Infinity || result === -Infinity) {
        throw new Error('cannot divide by zero');
      }
      
      if (isNaN(result)) {
        throw new Error('Invalid expression');
      }

      // Update state
      state.lastResult = result;
      state.history.push({
        expression: `${expression} = ${result}`,
        result,
        timestamp: new Date()
      });

      return {
        success: true,
        data: { result },
        output: `${expression} = ${result}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Calculation error'
      };
    }
  }

  evaluateExpression(expression) {
    // Simple expression evaluator (in production, use math.js or similar)
    // This is a simplified version for the example
    
    // Handle basic operations
    expression = expression.replace(/\s+/g, '');
    
    // Convert words to operators
    expression = expression
      .replace(/plus/gi, '+')
      .replace(/minus/gi, '-')
      .replace(/times|multiplied\s*by/gi, '*')
      .replace(/divided\s*by|over/gi, '/')
      .replace(/\^|to\s*the\s*power\s*of/gi, '**');

    // Handle sqrt
    expression = expression.replace(/sqrt\(([^)]+)\)/gi, (_, num) => 
      Math.sqrt(parseFloat(num)).toString()
    );

    // Handle percentages
    expression = expression.replace(/(\d+)%\s*of\s*(\d+)/gi, (_, percent, value) => 
      ((parseFloat(percent) / 100) * parseFloat(value)).toString()
    );

    // Safely evaluate (in production, use a proper math parser)
    try {
      // Very basic and unsafe - only for demo purposes
      return Function('"use strict"; return (' + expression + ')')();
    } catch {
      throw new Error('Invalid expression');
    }
  }

  async storeVariable(name, value, session) {
    const state = this.getState(session);
    state.variables[name] = value;
    
    return {
      success: true,
      output: `Stored ${name} = ${value}`
    };
  }

  async recallVariable(name, session) {
    const state = this.getState(session);
    const value = state.variables[name];
    
    if (value === undefined) {
      return {
        success: false,
        error: `Variable '${name}' is not defined`
      };
    }
    
    return {
      success: true,
      data: { value },
      output: `${name} = ${value}`
    };
  }

  async listVariables(session) {
    const state = this.getState(session);
    const entries = Object.entries(state.variables);
    
    if (entries.length === 0) {
      return {
        success: true,
        output: 'No variables stored'
      };
    }
    
    const list = entries.map(([name, value]) => `${name} = ${value}`).join('\n');
    
    return {
      success: true,
      output: `Stored variables:\n${list}`
    };
  }

  async clearMemory(session) {
    const state = this.getState(session);
    const count = Object.keys(state.variables).length;
    
    state.variables = {};
    state.lastResult = undefined;
    
    return {
      success: true,
      output: `Cleared ${count} variable${count !== 1 ? 's' : ''} from memory`
    };
  }

  async convert(value, fromUnit, toUnit, session) {
    // Simple unit conversion (in production, use a proper library)
    const conversions = {
      // Length
      km: { miles: 0.621371, m: 1000, ft: 3280.84 },
      miles: { km: 1.60934, m: 1609.34, ft: 5280 },
      m: { km: 0.001, miles: 0.000621371, ft: 3.28084 },
      ft: { m: 0.3048, km: 0.0003048, miles: 0.000189394 },
      
      // Temperature (special handling needed)
      celsius: { fahrenheit: 1, kelvin: 1 },
      fahrenheit: { celsius: 1, kelvin: 1 },
      
      // Weight
      kg: { lbs: 2.20462, g: 1000 },
      lbs: { kg: 0.453592, g: 453.592 },
      g: { kg: 0.001, lbs: 0.00220462 },
      
      // Currency (mock rates)
      usd: { eur: 0.85, gbp: 0.73, jpy: 110 },
      eur: { usd: 1.18, gbp: 0.86, jpy: 130 },
      gbp: { usd: 1.37, eur: 1.16, jpy: 151 },
      jpy: { usd: 0.009, eur: 0.0077, gbp: 0.0066 }
    };

    // Normalize unit names
    const normalizeUnit = (unit) => {
      const normalized = unit.toLowerCase();
      if (normalized === 'kilometers') return 'km';
      if (normalized === 'metres' || normalized === 'meters') return 'm';
      if (normalized === 'feet') return 'ft';
      if (normalized === 'pounds') return 'lbs';
      if (normalized === 'kilograms') return 'kg';
      if (normalized === 'grams') return 'g';
      return normalized;
    };
    
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);

    // Handle temperature conversions
    if (from === 'celsius' && to === 'fahrenheit') {
      const result = (value * 9/5) + 32;
      return {
        success: true,
        data: { result },
        output: `${value}°C = ${result.toFixed(2)}°F`
      };
    } else if (from === 'fahrenheit' && to === 'celsius') {
      const result = (value - 32) * 5/9;
      return {
        success: true,
        data: { result },
        output: `${value}°F = ${result.toFixed(2)}°C`
      };
    }

    // Handle other conversions
    if (conversions[from] && conversions[from][to]) {
      const result = value * conversions[from][to];
      return {
        success: true,
        data: { result },
        output: `${value} ${fromUnit} = ${result.toFixed(2)} ${toUnit}`
      };
    }

    return {
      success: false,
      error: `Cannot convert from ${fromUnit} to ${toUnit}`
    };
  }

  async statistics(numbers, operation, session) {
    if (numbers.length === 0) {
      return {
        success: false,
        error: 'No numbers provided'
      };
    }

    const op = operation.toLowerCase();
    let result;
    
    switch (op) {
      case 'mean':
      case 'average':
        result = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        break;
        
      case 'median':
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        result = sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
        break;
        
      case 'stddev':
      case 'standard deviation':
        const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        const variance = numbers.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) / numbers.length;
        result = Math.sqrt(variance);
        break;
        
      default:
        return {
          success: false,
          error: `Unknown operation: ${operation}`
        };
    }

    return {
      success: true,
      data: { result },
      output: `${operation} of [${numbers.join(', ')}] = ${result.toFixed(2)}`
    };
  }

  async showHistory(limit, session) {
    const state = this.getState(session);
    const history = state.history.slice(-limit);
    
    if (history.length === 0) {
      return {
        success: true,
        output: 'No calculation history'
      };
    }
    
    const entries = history.map(h => h.expression).join('\n');
    
    return {
      success: true,
      output: `Recent calculations:\n${entries}`
    };
  }

  async showHelp() {
    return {
      success: true,
      output: `Calculator CLI - Available operations:

Basic arithmetic:
  - Addition: "5 + 3", "add 5 and 3"
  - Subtraction: "10 - 4", "subtract 4 from 10"
  - Multiplication: "6 * 7", "6 times 7"
  - Division: "20 / 4", "divide 20 by 4"
  - Power: "2^8", "2 to the power of 8"
  - Square root: "sqrt(16)", "square root of 16"

Memory operations:
  - Store: "store 42 as x"
  - Use variables: "x + 10"
  - List: "show variables"
  - Clear: "clear memory"

Unit conversion:
  - Length: "convert 5 km to miles"
  - Temperature: "convert 100 celsius to fahrenheit"
  - Weight: "convert 10 kg to lbs"

Statistics:
  - Mean: "average of 1, 2, 3, 4, 5"
  - Median: "median of 1, 3, 5, 7, 9"
  - Std Dev: "standard deviation of 2, 4, 6, 8, 10"

Other:
  - History: "show history"
  - Help: "help"`
    };
  }

  async process(input) {
    const result = await this.framework.processInput(input);
    return { response: result.message };
  }
}