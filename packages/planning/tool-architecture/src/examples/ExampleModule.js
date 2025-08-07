/**
 * Example module implementation
 * Demonstrates how to create concrete ModuleDefinition and ModuleInstance classes
 */

import { ModuleDefinition } from '../modules/ModuleDefinition.js';
import { ModuleInstance } from '../modules/ModuleInstance.js';
import { Tool } from '../modules/Tool.js';
import { validateConfiguration, ValidationError } from '../utils/Validation.js';

/**
 * Example ModuleDefinition implementation
 */
export class ExampleModuleDefinition extends ModuleDefinition {
  static async create(config) {
    // Validate configuration
    const schema = {
      name: { required: true, type: 'string' },
      enabled: { required: false, type: 'boolean', default: true },
      timeout: { required: false, type: 'number', default: 5000 }
    };

    let validatedConfig;
    try {
      validatedConfig = validateConfiguration(config, schema);
    } catch (error) {
      throw new ValidationError(`Configuration validation failed: ${error.message}`);
    }
    
    // Create the module instance
    const instance = new ExampleModuleInstance(this, validatedConfig);
    
    // Async initialization if needed
    await instance.initialize();
    
    return instance;
  }
  
  static getMetadata() {
    return {
      name: 'ExampleModule',
      description: 'Example module for testing',
      version: '1.0.0',
      tools: {
        exampleTool: {
          description: 'An example tool',
          input: { message: 'string' },
          output: { result: 'string' }
        }
      }
    };
  }
}

/**
 * Example ModuleInstance implementation
 */
export class ExampleModuleInstance extends ModuleInstance {
  constructor(moduleDefinition, config) {
    super(moduleDefinition, config);
    this.initialized = false;
  }
  
  async initialize() {
    // Perform async initialization
    this.initialized = true;
    this.createTools();
  }
  
  createTools() {
    this.tools.exampleTool = new Tool({
      name: 'exampleTool',
      execute: async (input) => {
        const { message } = input;
        if (!message) {
          throw new Error('Message parameter is required');
        }
        return { result: `Echo: ${message}` };
      },
      getMetadata: () => ({
        description: 'An example tool that echoes messages',
        input: { message: { type: 'string', required: true } },
        output: { result: 'string' }
      })
    });
  }
  
  async cleanup() {
    // Clean up resources
    this.initialized = false;
  }
}