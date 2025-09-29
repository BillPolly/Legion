/**
 * PromptLoader - Unified utility for loading declarative prompt files
 * and creating TemplatedPrompt instances with complete configuration
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { TemplatedPrompt } from '@legion/prompting-manager';

export class PromptLoader {
  constructor(basePath = null) {
    this.basePath = basePath || path.join(process.cwd(), 'prompts');
    this.loadedPrompts = new Map();
  }

  /**
   * Load a prompt file and create a TemplatedPrompt instance
   * @param {string} promptPath - Relative path to prompt file (without .md extension)
   * @param {Object} context - Context containing llmClient and other dependencies
   * @returns {Promise<TemplatedPrompt>}
   */
  async loadPrompt(promptPath, context) {
    const cacheKey = promptPath;
    
    if (this.loadedPrompts.has(cacheKey)) {
      const config = this.loadedPrompts.get(cacheKey);
      return this.createTemplatedPrompt(config, context);
    }

    const promptFile = await this.readPromptFile(promptPath);
    const config = this.parsePromptFile(promptFile);
    
    // Cache the parsed configuration
    this.loadedPrompts.set(cacheKey, config);
    
    return this.createTemplatedPrompt(config, context);
  }

  /**
   * Read prompt file from disk
   * @param {string} promptPath - Path to prompt file
   * @returns {Promise<string>}
   */
  async readPromptFile(promptPath) {
    let fullPath;
    
    if (path.isAbsolute(promptPath)) {
      fullPath = promptPath + '.md';
    } else {
      // Try the base path first
      fullPath = path.join(this.basePath, promptPath + '.md');
      
      // If that doesn't exist, try relative to src directory within the base path
      if (!await this.fileExists(fullPath)) {
        const srcBasePath = path.join(this.basePath, 'src');
        fullPath = path.join(srcBasePath, promptPath + '.md');
      }
    }
    
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read prompt file ${fullPath}: ${error.message}`);
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse prompt file with YAML frontmatter and content
   * @param {string} fileContent - Raw file content
   * @returns {Object} Parsed configuration
   */
  parsePromptFile(fileContent) {
    // Split frontmatter from content
    const parts = fileContent.split('---');
    if (parts.length < 3) {
      throw new Error('Prompt file must have YAML frontmatter delimited by ---');
    }

    const frontmatter = parts[1].trim();
    const content = parts.slice(2).join('---').trim();

    let metadata;
    try {
      metadata = yaml.load(frontmatter);
    } catch (error) {
      throw new Error(`Failed to parse YAML frontmatter: ${error.message}`);
    }

    // Validate required fields
    this.validatePromptConfig(metadata);

    return {
      ...metadata,
      template: content
    };
  }

  /**
   * Validate prompt configuration has required fields
   * @param {Object} config - Parsed configuration
   */
  validatePromptConfig(config) {
    const required = ['name', 'description', 'responseSchema'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Prompt configuration missing required fields: ${missing.join(', ')}`);
    }

    if (!config.responseProcessor) {
      config.responseProcessor = {
        type: 'json',
        validation: 'strict',
        retries: 3
      };
    }

    if (!config.outputPrompt) {
      config.outputPrompt = this.generateOutputPrompt(config.responseSchema);
    }

    // Validate querySpec if present
    if (config.querySpec) {
      this.validateQuerySpec(config.querySpec);
    }
  }

  /**
   * Validate querySpec configuration
   * @param {Object} querySpec - Query specification to validate
   */
  validateQuerySpec(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('QuerySpec must be an object');
    }

    if (!querySpec.bindings && !querySpec.contextVariables) {
      throw new Error('QuerySpec must have bindings or contextVariables');
    }

    // Validate bindings
    if (querySpec.bindings) {
      for (const [name, binding] of Object.entries(querySpec.bindings)) {
        if (!name || typeof name !== 'string') {
          throw new Error('Binding name must be a non-empty string');
        }

        if (!binding || typeof binding !== 'object') {
          throw new Error(`Binding ${name} must be an object`);
        }

        if (!binding.path && binding.value === undefined && !binding.aggregate) {
          throw new Error(`Binding ${name} must have path, value, or aggregate`);
        }

        if (binding.path && typeof binding.path !== 'string') {
          throw new Error(`Path must be a string for binding ${name}`);
        }
      }
    }

    // Validate context variables
    if (querySpec.contextVariables) {
      for (const [name, varDef] of Object.entries(querySpec.contextVariables)) {
        if (!name || typeof name !== 'string') {
          throw new Error('Context variable name must be a non-empty string');
        }

        if (!varDef || typeof varDef !== 'object') {
          throw new Error(`Context variable ${name} must be an object`);
        }

        if (!varDef.path && varDef.value === undefined) {
          throw new Error(`Context variable ${name} must have path or value`);
        }
      }
    }
  }

  /**
   * Generate output prompt from response schema
   * @param {Object} schema - JSON schema for response format
   * @returns {string} Generated output prompt with format instructions
   */
  generateOutputPrompt(schema) {
    if (!schema) {
      return 'Respond according to the specified format and schema.';
    }

    const formatInstructions = [];
    formatInstructions.push('**Response Format:**');
    formatInstructions.push('Respond with valid JSON that matches this structure:');
    formatInstructions.push('');
    
    // Generate JSON example from schema
    const exampleJson = this.generateExampleFromSchema(schema);
    formatInstructions.push('```json');
    formatInstructions.push(JSON.stringify(exampleJson, null, 2));
    formatInstructions.push('```');
    formatInstructions.push('');
    
    // Add requirements based on schema
    formatInstructions.push('**Requirements:**');
    formatInstructions.push('- Return ONLY valid JSON, no additional text');
    
    if (schema.required && schema.required.length > 0) {
      formatInstructions.push(`- Required fields: ${schema.required.join(', ')}`);
    }
    
    // Add specific field constraints
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([field, fieldSchema]) => {
        if (fieldSchema.enum) {
          formatInstructions.push(`- ${field} must be one of: ${fieldSchema.enum.join(', ')}`);
        }
        if (fieldSchema.type === 'number' && (fieldSchema.minimum !== undefined || fieldSchema.maximum !== undefined)) {
          const min = fieldSchema.minimum !== undefined ? fieldSchema.minimum : 'no minimum';
          const max = fieldSchema.maximum !== undefined ? fieldSchema.maximum : 'no maximum';
          formatInstructions.push(`- ${field} must be a number (min: ${min}, max: ${max})`);
        }
      });
    }
    
    return formatInstructions.join('\n');
  }

  /**
   * Generate example JSON object from schema
   * @param {Object} schema - JSON schema
   * @returns {Object} Example object
   */
  generateExampleFromSchema(schema) {
    if (schema.type !== 'object' || !schema.properties) {
      return {};
    }
    
    const example = {};
    
    Object.entries(schema.properties).forEach(([field, fieldSchema]) => {
      if (fieldSchema.enum && fieldSchema.enum.length > 0) {
        example[field] = fieldSchema.enum[0];
      } else if (fieldSchema.type === 'string') {
        example[field] = `example ${field}`;
      } else if (fieldSchema.type === 'number') {
        if (fieldSchema.minimum !== undefined) {
          example[field] = fieldSchema.minimum;
        } else if (fieldSchema.maximum !== undefined) {
          example[field] = Math.max(0, fieldSchema.maximum / 2);
        } else {
          example[field] = 42;
        }
      } else if (fieldSchema.type === 'array') {
        example[field] = [`example ${field} item`];
      } else if (fieldSchema.type === 'boolean') {
        example[field] = true;
      } else {
        example[field] = `example ${field}`;
      }
    });
    
    return example;
  }

  /**
   * Load prompt configuration without creating TemplatedPrompt
   * @param {string} promptPath - Path to prompt file (relative to basePath)
   * @returns {Promise<Object>} Parsed prompt configuration
   */
  async loadPromptConfig(promptPath) {
    const cacheKey = promptPath;
    
    // Return cached configuration if available
    if (this.loadedPrompts.has(cacheKey)) {
      return this.loadedPrompts.get(cacheKey);
    }

    const promptFile = await this.readPromptFile(promptPath);
    const config = this.parsePromptFile(promptFile);
    
    // Cache the parsed configuration
    this.loadedPrompts.set(cacheKey, config);
    
    return config;
  }

  /**
   * Create TemplatedPrompt instance from configuration
   * @param {Object} config - Parsed prompt configuration
   * @param {Object} context - Context with llmClient
   * @returns {TemplatedPrompt}
   */
  createTemplatedPrompt(config, context) {
    if (!context.llmClient) {
      throw new Error('Context must contain llmClient for TemplatedPrompt creation');
    }

    // Validate that we have the template content
    if (!config.template || config.template.trim() === '') {
      throw new Error('Prompt template content is empty or missing');
    }

    // Build complete prompt template with output instruction
    const fullTemplate = `${config.template}\n\n${config.outputPrompt}`;

    // Create TemplatedPrompt with all configuration
    const templatedPrompt = new TemplatedPrompt({
      prompt: fullTemplate,
      responseSchema: config.responseSchema,
      llmClient: context.llmClient,
      examples: config.examples || [],
      maxRetries: config.responseProcessor.retries || 3,
      querySpec: config.querySpec || null
    });

    // Add metadata for debugging/logging
    templatedPrompt.metadata = {
      name: config.name,
      description: config.description,
      category: config.category,
      subcategory: config.subcategory,
      variables: config.variables || []
    };

    return templatedPrompt;
  }

  /**
   * Create a PromptLoader instance with a specific base path
   * @param {string} basePath - Base directory for prompt files
   * @returns {PromptLoader}
   */
  static withBasePath(basePath) {
    return new PromptLoader(basePath);
  }

  /**
   * Clear the prompt cache
   */
  clearCache() {
    this.loadedPrompts.clear();
  }

  /**
   * Get metadata for all cached prompts
   * @returns {Array} Array of prompt metadata
   */
  getCachedPromptMetadata() {
    return Array.from(this.loadedPrompts.entries()).map(([path, config]) => ({
      path,
      name: config.name,
      description: config.description,
      category: config.category,
      subcategory: config.subcategory
    }));
  }
}

export default PromptLoader;