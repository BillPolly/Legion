/**
 * Tool Factory - Utilities for creating tools from various patterns
 */

import { Tool } from '../modules/Tool.js';

/**
 * Create a tool from a bound method
 * @param {string} name - Tool name
 * @param {Function} method - Bound method
 * @param {Object} metadata - Tool metadata
 * @returns {Tool} Created tool
 */
export function createToolFromMethod(name, method, metadata) {
  return new Tool({
    name,
    execute: async (input) => {
      return await method(input);
    },
    getMetadata: () => metadata
  });
}

/**
 * Create a tool from a standalone function
 * @param {string} name - Tool name
 * @param {Function} func - Function to wrap
 * @param {Object} metadata - Tool metadata
 * @returns {Tool} Created tool
 */
export function createToolFromFunction(name, func, metadata) {
  return new Tool({
    name,
    execute: async (input) => {
      return await func(input);
    },
    getMetadata: () => metadata
  });
}

/**
 * Generate metadata from configuration
 * @param {Object} config - Configuration object
 * @returns {Object} Generated metadata
 */
export function generateMetadataFromConfig(config) {
  const metadata = {
    description: config.description || 'No description provided',
    input: config.input || {},
    output: config.output || {}
  };

  if (config.examples) {
    metadata.examples = config.examples;
  }

  if (config.tags) {
    metadata.tags = config.tags;
  }

  return metadata;
}

/**
 * ToolFactory class for creating multiple tools from objects and configurations
 */
export class ToolFactory {
  constructor(sourceObject) {
    this.sourceObject = sourceObject;
  }

  /**
   * Create tools from configuration
   * @param {Object} toolConfig - Configuration mapping tool names to their configs
   * @returns {Object} Map of tool names to Tool instances
   */
  createFromConfig(toolConfig) {
    const tools = {};

    for (const [toolName, config] of Object.entries(toolConfig)) {
      if (!this.sourceObject[toolName] || typeof this.sourceObject[toolName] !== 'function') {
        continue; // Skip if method doesn't exist
      }

      const method = this.sourceObject[toolName].bind(this.sourceObject);
      const metadata = generateMetadataFromConfig(config);

      tools[toolName] = new Tool({
        name: toolName,
        execute: async (input) => {
          let processedInput = input;
          
          // Apply parameter mapping if provided
          if (config.parameterMapping && typeof config.parameterMapping === 'function') {
            const args = config.parameterMapping(input);
            processedInput = await method(...args);
          } else {
            processedInput = await method(input);
          }

          // Apply output transformation if provided
          if (config.outputTransform && typeof config.outputTransform === 'function') {
            return config.outputTransform(processedInput);
          }

          return processedInput;
        },
        getMetadata: () => metadata
      });
    }

    return tools;
  }

  /**
   * Create tools from all methods of the source object
   * @param {Object} defaultMetadata - Default metadata for all tools
   * @returns {Object} Map of tool names to Tool instances
   */
  createFromAllMethods(defaultMetadata = {}) {
    const tools = {};
    
    // Get all method names from the object
    const methodNames = Object.getOwnPropertyNames(this.sourceObject)
      .filter(name => typeof this.sourceObject[name] === 'function' && name !== 'constructor');

    for (const methodName of methodNames) {
      const method = this.sourceObject[methodName].bind(this.sourceObject);
      
      const metadata = {
        description: `Auto-generated tool for ${methodName}`,
        input: {},
        output: {},
        ...defaultMetadata
      };

      tools[methodName] = new Tool({
        name: methodName,
        execute: async (input) => {
          return await method(input);
        },
        getMetadata: () => metadata
      });
    }

    return tools;
  }
}