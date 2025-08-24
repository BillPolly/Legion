/**
 * Mock Calculator Module for Testing
 * 
 * A simple Legion module that follows the standard interface
 * for testing the ModuleLoader and other components.
 */

import { Module } from '../../src/core/Module.js';

export default class MockCalculatorModule extends Module {
  constructor() {
    super();
    this.name = 'MockCalculator';
    this.version = '1.0.0';
    this.description = 'A simple calculator module for testing';
  }

  /**
   * Static async factory method following the standard interface
   * @param {ResourceManager} resourceManager - The resource manager for dependency injection
   * @returns {Promise<MockCalculatorModule>} Initialized module instance
   */
  static async create(resourceManager) {
    const module = new MockCalculatorModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Register all calculator tools
    const tools = [
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
    
    // Register each tool with the module
    for (const tool of tools) {
      this.registerTool(tool.name, tool);
    }
  }
}