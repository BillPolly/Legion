/**
 * PromptFactory - Utility for creating TemplatedPrompt objects from data
 * 
 * This factory abstracts TemplatedPrompt creation and enables data-driven
 * strategy design where prompts and response schemas are stored as data
 * rather than embedded in code.
 */

import { TemplatedPrompt } from '@legion/prompting-manager';

export default class PromptFactory {
  /**
   * Create a TemplatedPrompt from prompt data
   * @param {Object} promptData - Data defining the prompt
   * @param {string} promptData.template - The prompt template string
   * @param {Object} promptData.responseSchema - The expected response schema
   * @param {Object} llmClient - The LLM client instance
   * @param {Object} options - Additional options for the prompt
   * @returns {TemplatedPrompt} - Configured TemplatedPrompt instance
   */
  static createPrompt(promptData, llmClient, options = {}) {
    if (!promptData.template) {
      throw new Error('Prompt template is required');
    }
    
    if (!promptData.responseSchema) {
      throw new Error('Response schema is required');
    }
    
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    
    return new TemplatedPrompt({
      prompt: promptData.template,
      responseSchema: promptData.responseSchema,
      llmClient: llmClient,
      maxRetries: options.maxRetries || 3,
      ...options
    });
  }
  
  /**
   * Create multiple prompts from a data structure
   * @param {Object} promptsData - Object containing multiple prompt definitions
   * @param {Object} llmClient - The LLM client instance
   * @param {Object} options - Options to apply to all prompts
   * @returns {Object} - Object with created TemplatedPrompt instances
   */
  static createPrompts(promptsData, llmClient, options = {}) {
    const prompts = {};
    
    for (const [name, data] of Object.entries(promptsData)) {
      prompts[name] = this.createPrompt(data, llmClient, options);
    }
    
    return prompts;
  }
  
  /**
   * Execute a prompt with given parameters
   * @param {TemplatedPrompt} prompt - The prompt to execute
   * @param {Object} parameters - Parameters to fill in the template
   * @returns {Promise<Object>} - Execution result
   */
  static async executePrompt(prompt, parameters) {
    return await prompt.execute(parameters);
  }
  
  /**
   * Helper to create a standard JSON response schema
   * @param {Object} properties - Properties of the JSON object
   * @param {Array} required - Required properties
   * @returns {Object} - JSON schema
   */
  static createJsonSchema(properties, required = []) {
    return {
      type: 'object',
      properties: properties,
      required: required,
      format: 'json'
    };
  }
  
  /**
   * Helper to create a schema with anyOf options
   * @param {Array} options - Array of schema options
   * @returns {Object} - Schema with anyOf
   */
  static createAnyOfSchema(options) {
    return {
      type: 'object',
      anyOf: options,
      format: 'json'
    };
  }
  
  /**
   * Helper to create an enum schema
   * @param {string} propertyName - Name of the enum property
   * @param {Array} values - Allowed values
   * @param {Array} otherProperties - Other properties in the schema
   * @returns {Object} - Schema with enum
   */
  static createEnumSchema(propertyName, values, otherProperties = {}) {
    return {
      type: 'object',
      properties: {
        [propertyName]: {
          type: 'string',
          enum: values
        },
        ...otherProperties
      },
      required: [propertyName],
      format: 'json'
    };
  }
  
  /**
   * Helper to create an array schema
   * @param {Object} itemSchema - Schema for array items
   * @returns {Object} - Array schema
   */
  static createArraySchema(itemSchema) {
    return {
      type: 'array',
      items: itemSchema,
      format: 'json'
    };
  }
  
  /**
   * Validate that prompt data has required structure
   * @param {Object} promptData - Data to validate
   * @returns {boolean} - True if valid
   * @throws {Error} - If invalid
   */
  static validatePromptData(promptData) {
    if (!promptData.template || typeof promptData.template !== 'string') {
      throw new Error('Prompt data must have a string template');
    }
    
    if (!promptData.responseSchema || typeof promptData.responseSchema !== 'object') {
      throw new Error('Prompt data must have an object responseSchema');
    }
    
    // Check for required schema properties
    if (!promptData.responseSchema.type) {
      throw new Error('Response schema must have a type property');
    }
    
    return true;
  }
  
  /**
   * Merge default prompt data with overrides
   * @param {Object} defaultData - Default prompt data
   * @param {Object} overrides - Override values
   * @returns {Object} - Merged prompt data
   */
  static mergePromptData(defaultData, overrides = {}) {
    return {
      template: overrides.template || defaultData.template,
      responseSchema: {
        ...defaultData.responseSchema,
        ...(overrides.responseSchema || {})
      }
    };
  }
  
  /**
   * Create a prompt data structure from components
   * @param {string} template - The prompt template
   * @param {Object} schemaProperties - Properties for the response
   * @param {Array} requiredFields - Required response fields
   * @returns {Object} - Prompt data structure
   */
  static createPromptData(template, schemaProperties, requiredFields = []) {
    return {
      template: template,
      responseSchema: this.createJsonSchema(schemaProperties, requiredFields)
    };
  }
}