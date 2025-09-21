/**
 * PromptFactory - Utility for creating TemplatedPrompt objects from data
 * 
 * This factory abstracts TemplatedPrompt creation and enables data-driven
 * strategy design where prompts and response schemas are stored as data
 * rather than embedded in code.
 * 
 * EXAMPLE DATA REQUIREMENT:
 * ⚠️ EXAMPLE DATA IS MANDATORY! All prompts MUST include example data that:
 * 1. Matches the response schema exactly
 * 2. Shows the LLM the desired output format and quality
 * 3. Is validated against the schema before use
 * 
 * Without good examples, LLMs produce poor quality responses!
 * 
 * Example:
 * {
 *   responseSchema: { ... },
 *   examples: [
 *     {
 *       code: 'function add(a, b) { return a + b; }',
 *       explanation: 'A function that adds two numbers'
 *     }
 *   ]
 * }
 * 
 * OUTPUT FORMAT SPECIFICATION:
 * The output format (how the LLM structures its response) is specified in the schema:
 * 
 * 1. Use 'x-output-format' in the schema to specify the format:
 *    - 'json' (default): LLM returns valid JSON
 *    - 'delimited': LLM returns sections like ---FIELD---content---END-FIELD---
 *    - 'xml': LLM returns XML structure
 *    - 'tagged': LLM returns <FIELD>content</FIELD> tags
 *    - 'markdown': LLM returns structured markdown
 *    - 'yaml': LLM returns YAML format
 * 
 * 2. If 'x-output-format' is not specified, defaults to 'json'
 * 
 * 3. The ResponseValidator auto-detects the actual format used by the LLM
 *    and always returns parsed data as JSON to your code
 * 
 * Example for code generation (use delimited format):
 * {
 *   responseSchema: {
 *     type: 'object',
 *     'x-output-format': 'delimited',  // LLM will output delimited sections
 *     properties: {
 *       code: { type: 'string' },
 *       explanation: { type: 'string' }
 *     }
 *   },
 *   examples: [  // REQUIRED!
 *     {
 *       code: 'console.log("Hello");',
 *       explanation: 'Prints greeting to console'
 *     }
 *   ]
 * }
 * 
 * The LLM outputs:
 * ---CODE---
 * function hello() { return "Hello"; }
 * ---END-CODE---
 * 
 * Your code receives:
 * { code: 'function hello() { return "Hello"; }', explanation: '...' }
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { ResponseValidator } from '@legion/output-schema';

export default class PromptFactory {
  /**
   * Create a TemplatedPrompt from prompt data
   * @param {Object} promptData - Data defining the prompt
   * @param {string} promptData.template - The prompt template string
   * @param {Object} promptData.responseSchema - The expected response schema
   * @param {Array} promptData.examples - REQUIRED: Example outputs that match the schema
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
    
    // EXAMPLES ARE MANDATORY!
    if (!promptData.examples || !Array.isArray(promptData.examples)) {
      throw new Error(
        'Examples are REQUIRED! Must provide an array of example outputs that match the response schema. ' +
        'Good examples are crucial for LLM response quality!'
      );
    }
    
    if (promptData.examples.length === 0) {
      throw new Error('Examples array cannot be empty! At least one example is required.');
    }
    
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    
    // Validate examples against schema
    this.validateExamples(promptData.examples, promptData.responseSchema);
    
    return new TemplatedPrompt({
      prompt: promptData.template,
      responseSchema: promptData.responseSchema,
      examples: promptData.examples,  // Pass the validated examples
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
   * @param {string} outputFormat - Optional output format ('json', 'delimited', 'xml', etc.)
   * @returns {Object} - JSON schema
   */
  static createJsonSchema(properties, required = [], outputFormat = null) {
    const schema = {
      type: 'object',
      properties: properties,
      required: required
    };
    
    // Only add x-output-format if explicitly specified
    if (outputFormat) {
      schema['x-output-format'] = outputFormat;
    }
    
    return schema;
  }
  
  /**
   * Helper to create a schema with anyOf options
   * @param {Array} options - Array of schema options
   * @param {string} outputFormat - Optional output format
   * @returns {Object} - Schema with anyOf
   */
  static createAnyOfSchema(options, outputFormat = null) {
    const schema = {
      type: 'object',
      anyOf: options
    };
    
    if (outputFormat) {
      schema['x-output-format'] = outputFormat;
    }
    
    return schema;
  }
  
  /**
   * Helper to create an enum schema
   * @param {string} propertyName - Name of the enum property
   * @param {Array} values - Allowed values
   * @param {Array} otherProperties - Other properties in the schema
   * @param {string} outputFormat - Optional output format
   * @returns {Object} - Schema with enum
   */
  static createEnumSchema(propertyName, values, otherProperties = {}, outputFormat = null) {
    const schema = {
      type: 'object',
      properties: {
        [propertyName]: {
          type: 'string',
          enum: values
        },
        ...otherProperties
      },
      required: [propertyName]
    };
    
    if (outputFormat) {
      schema['x-output-format'] = outputFormat;
    }
    
    return schema;
  }
  
  /**
   * Helper to create an array schema
   * @param {Object} itemSchema - Schema for array items
   * @param {string} outputFormat - Optional output format
   * @returns {Object} - Array schema
   */
  static createArraySchema(itemSchema, outputFormat = null) {
    const schema = {
      type: 'array',
      items: itemSchema
    };
    
    if (outputFormat) {
      schema['x-output-format'] = outputFormat;
    }
    
    return schema;
  }
  
  /**
   * Validate examples against the response schema
   * @param {Array} examples - Array of example data
   * @param {Object} responseSchema - The schema to validate against
   * @throws {Error} - If any example doesn't match the schema
   */
  static validateExamples(examples, responseSchema) {
    const validator = new ResponseValidator(responseSchema);
    
    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      const validationResult = validator.validateExample(example);
      
      if (!validationResult.success) {
        const errors = validationResult.errors.map(e => 
          `  - ${e.field || 'general'}: ${e.message}`
        ).join('\n');
        
        throw new Error(
          `Example ${i + 1} does not match the response schema!\n` +
          `Example data: ${JSON.stringify(example, null, 2)}\n` +
          `Validation errors:\n${errors}\n\n` +
          `Examples MUST match the schema exactly to teach the LLM the correct format!`
        );
      }
    }
    
    return true;
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
    
    // Check for examples
    if (!promptData.examples || !Array.isArray(promptData.examples) || promptData.examples.length === 0) {
      throw new Error('Prompt data must have a non-empty examples array');
    }
    
    // Validate examples against schema
    this.validateExamples(promptData.examples, promptData.responseSchema);
    
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
   * @param {Array} examples - REQUIRED: Example outputs that match the schema
   * @param {string} outputFormat - Optional output format ('json', 'delimited', etc.)
   * @returns {Object} - Prompt data structure
   */
  static createPromptData(template, schemaProperties, requiredFields = [], examples = [], outputFormat = null) {
    if (!examples || examples.length === 0) {
      throw new Error(
        'Examples are REQUIRED when creating prompt data! ' +
        'Provide at least one example that matches your schema.'
      );
    }
    
    return {
      template: template,
      responseSchema: this.createJsonSchema(schemaProperties, requiredFields, outputFormat),
      examples: examples
    };
  }
}