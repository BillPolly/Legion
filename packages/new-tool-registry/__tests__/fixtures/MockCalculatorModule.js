/**
 * Mock Calculator Module for Testing
 * 
 * A simple Legion module that follows the expected interface
 * for testing the ModuleLoader and other components.
 */

export default class MockCalculatorModule {
  constructor() {
    this.name = 'MockCalculator';
    this.version = '1.0.0';
    this.description = 'A simple calculator module for testing';
  }

  getName() {
    return this.name;
  }

  getVersion() {
    return this.version;
  }

  getDescription() {
    return this.description;
  }

  getTools() {
    return [
      {
        name: 'add',
        description: 'Add two numbers together',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'number', description: 'Sum of a and b' }
          }
        },
        execute: async (params) => {
          const { a, b } = params;
          
          if (typeof a !== 'number' || typeof b !== 'number') {
            throw new Error('Both parameters must be numbers');
          }
          
          return {
            success: true,
            result: a + b
          };
        }
      },
      
      {
        name: 'subtract',
        description: 'Subtract second number from first number',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'number', description: 'Difference of a and b' }
          }
        },
        execute: async (params) => {
          const { a, b } = params;
          
          if (typeof a !== 'number' || typeof b !== 'number') {
            throw new Error('Both parameters must be numbers');
          }
          
          return {
            success: true,
            result: a - b
          };
        }
      },
      
      {
        name: 'multiply',
        description: 'Multiply two numbers together',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'number', description: 'Product of a and b' }
          }
        },
        execute: async (params) => {
          const { a, b } = params;
          
          if (typeof a !== 'number' || typeof b !== 'number') {
            throw new Error('Both parameters must be numbers');
          }
          
          return {
            success: true,
            result: a * b
          };
        }
      },
      
      {
        name: 'divide',
        description: 'Divide first number by second number',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'Dividend' },
            b: { type: 'number', description: 'Divisor' }
          },
          required: ['a', 'b']
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'number', description: 'Quotient of a divided by b' }
          }
        },
        execute: async (params) => {
          const { a, b } = params;
          
          if (typeof a !== 'number' || typeof b !== 'number') {
            throw new Error('Both parameters must be numbers');
          }
          
          if (b === 0) {
            throw new Error('Division by zero is not allowed');
          }
          
          return {
            success: true,
            result: a / b
          };
        }
      }
    ];
  }

  // Optional: Module metadata for advanced use cases
  getMetadata() {
    return {
      category: 'Mathematics',
      tags: ['calculator', 'arithmetic', 'math'],
      author: 'Test Suite',
      license: 'MIT',
      dependencies: [],
      capabilities: ['add', 'subtract', 'multiply', 'divide']
    };
  }
}