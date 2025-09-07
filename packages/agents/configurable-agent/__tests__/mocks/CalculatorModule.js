/**
 * Mock CalculatorModule for testing
 */

export default class CalculatorModule {
  constructor() {
    this.name = 'calculator';
  }

  getTools() {
    return [
      {
        name: 'calculator',
        description: 'Calculator that can evaluate mathematical expressions',
        category: 'math',
        execute: async (params) => {
          try {
            // Simple expression evaluation for testing
            // Support basic operations: +, -, *, /, parentheses
            const expression = params.expression;
            if (!expression) {
              throw new Error('No expression provided');
            }
            
            // For testing, handle the specific expression from test
            if (expression === '(10 + 5) * 2') {
              return { success: true, result: 30 };
            }
            
            // Basic evaluation using eval (safe for testing only)
            const result = Function('"use strict"; return (' + expression + ')')();
            return {
              success: true,
              result: result
            };
          } catch (error) {
            return {
              success: false,
              error: 'Invalid expression'
            };
          }
        }
      },
      {
        name: 'add',
        description: 'Addition operation tool',
        category: 'math',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        },
        execute: async (params) => {
          // Ensure parameters are converted to numbers
          const a = Number(params.a);
          const b = Number(params.b);
          
          if (isNaN(a) || isNaN(b)) {
            return {
              success: false,
              error: 'Invalid numbers provided'
            };
          }
          
          return {
            success: true,
            result: a + b
          };
        }
      },
      {
        name: 'subtract',
        description: 'Subtraction operation tool',
        category: 'math',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        },
        execute: async (params) => {
          const a = Number(params.a);
          const b = Number(params.b);
          
          if (isNaN(a) || isNaN(b)) {
            return {
              success: false,
              error: 'Invalid numbers provided'
            };
          }
          
          return {
            success: true,
            result: a - b
          };
        }
      },
      {
        name: 'multiply',
        description: 'Multiplication operation tool',
        category: 'math',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        },
        execute: async (params) => {
          const a = Number(params.a);
          const b = Number(params.b);
          
          if (isNaN(a) || isNaN(b)) {
            return {
              success: false,
              error: 'Invalid numbers provided'
            };
          }
          
          return {
            success: true,
            result: a * b
          };
        }
      },
      {
        name: 'divide',
        description: 'Division operation tool',
        category: 'math',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        },
        execute: async (params) => {
          const a = Number(params.a);
          const b = Number(params.b);
          
          if (isNaN(a) || isNaN(b)) {
            return {
              success: false,
              error: 'Invalid numbers provided'
            };
          }
          
          if (b === 0) {
            throw new Error('Division by zero');
          }
          
          return {
            success: true,
            result: a / b
          };
        }
      }
    ];
  }
}