/**
 * PromptExecutor - Utility to encapsulate all LLM interactions
 * 
 * This utility hides the complexity of llmClient and TemplatedPrompt creation,
 * providing a simple interface for executing prompts with automatic:
 * - LLM client retrieval from context
 * - TemplatedPrompt creation
 * - Response schema validation
 * - Error handling
 * 
 * Usage:
 * const executor = new PromptExecutor(task);
 * const result = await executor.execute('path/to/prompt', { variables }, schema, examples);
 */

import { TemplatedPrompt, PromptRegistry } from '@legion/prompting-manager';
import { ResourceManager } from '@legion/resource-manager';

export class PromptExecutor {
  constructor(taskOrContext) {
    this.context = this._extractContext(taskOrContext);
    this._llmClient = null;
    this._promptRegistry = null;
  }

  /**
   * Extract context from task or use directly if it's already a context
   */
  _extractContext(taskOrContext) {
    // If it has a lookup method, it's a task
    if (taskOrContext?.lookup) {
      return {
        llmClient: taskOrContext.lookup('llmClient'),
        promptRegistry: taskOrContext.lookup('promptRegistry'),
        task: taskOrContext
      };
    }
    
    // If it has context property, extract from there
    if (taskOrContext?.context) {
      return taskOrContext.context;
    }
    
    // Otherwise assume it's already a context object
    return taskOrContext || {};
  }

  /**
   * Get or create the LLM client
   */
  async getLLMClient() {
    if (this._llmClient) {
      return this._llmClient;
    }

    // Try to get from context
    if (this.context.llmClient) {
      this._llmClient = this.context.llmClient;
      return this._llmClient;
    }

    // Try to get from task
    if (this.context.task?.lookup) {
      this._llmClient = this.context.task.lookup('llmClient');
      if (this._llmClient) {
        return this._llmClient;
      }
    }

    // Last resort: get from ResourceManager
    const resourceManager = await ResourceManager.getInstance();
    this._llmClient = await resourceManager.get('llmClient');
    
    if (!this._llmClient) {
      throw new Error('No LLM client available in context or ResourceManager');
    }

    return this._llmClient;
  }

  /**
   * Get or create the prompt registry
   */
  async getPromptRegistry(promptsPath) {
    if (this._promptRegistry) {
      return this._promptRegistry;
    }

    // Try to get from context
    if (this.context.promptRegistry) {
      this._promptRegistry = this.context.promptRegistry;
      return this._promptRegistry;
    }

    // Create new registry if path provided
    if (promptsPath) {
      this._promptRegistry = new PromptRegistry();
      this._promptRegistry.addDirectory(promptsPath);
      return this._promptRegistry;
    }

    throw new Error('No prompt registry available and no path provided to create one');
  }

  /**
   * Execute a prompt with the given parameters
   * 
   * @param {string|Object} promptOrTemplate - Prompt path to load, template string, or template object
   * @param {Object} variables - Variables to substitute in the prompt
   * @param {Object} responseSchema - Expected response schema
   * @param {Array} examples - Example responses for the LLM
   * @param {Object} options - Additional options (maxRetries, etc.)
   * @returns {Promise<Object>} Result with success, data, and errors
   */
  async execute(promptOrTemplate, variables = {}, responseSchema = null, examples = [], options = {}) {
    const llmClient = await this.getLLMClient();
    
    // Determine the prompt template
    let promptTemplate;
    
    if (typeof promptOrTemplate === 'string') {
      // If it contains template variables or is long, treat as template
      if (promptOrTemplate.includes('{{') || promptOrTemplate.length > 100) {
        promptTemplate = promptOrTemplate;
      } else {
        // Otherwise treat as a path to load
        const registry = await this.getPromptRegistry(options.promptsPath);
        const loaded = await registry.load(promptOrTemplate);
        promptTemplate = loaded.content || loaded;
        
        // Use loaded schema and examples if not provided
        if (!responseSchema && loaded.metadata?.schema) {
          responseSchema = loaded.metadata.schema;
        }
        if ((!examples || examples.length === 0) && loaded.metadata?.examples) {
          examples = loaded.metadata.examples;
        }
      }
    } else if (typeof promptOrTemplate === 'object') {
      // Template object with content property
      promptTemplate = promptOrTemplate.content || promptOrTemplate.template;
      
      // Extract schema and examples from object if not provided
      if (!responseSchema && promptOrTemplate.schema) {
        responseSchema = promptOrTemplate.schema;
      }
      if ((!examples || examples.length === 0) && promptOrTemplate.examples) {
        examples = promptOrTemplate.examples;
      }
    } else {
      throw new Error('Invalid prompt or template provided');
    }

    // Default schema if none provided
    if (!responseSchema) {
      responseSchema = { type: 'string' };
    }

    // Default examples if none provided
    if (!examples || examples.length === 0) {
      // Provide a minimal example based on schema type
      if (responseSchema.type === 'string') {
        examples = ['Sample response'];
      } else if (responseSchema.type === 'object') {
        examples = [{}];
      } else if (responseSchema.type === 'array') {
        examples = [[]];
      } else {
        examples = [''];
      }
    }

    // Create and execute TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: promptTemplate,
      responseSchema,
      examples,
      llmClient,
      maxRetries: options.maxRetries || 3,
      ...options
    });

    return await templatedPrompt.execute(variables);
  }

  /**
   * Execute a prompt and return only the data (throws on error)
   */
  async executeOrThrow(promptOrTemplate, variables = {}, responseSchema = null, examples = [], options = {}) {
    const result = await this.execute(promptOrTemplate, variables, responseSchema, examples, options);
    
    if (!result.success) {
      throw new Error(`Prompt execution failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    return result.data;
  }

  /**
   * Create a reusable TemplatedPrompt instance
   */
  async createPrompt(template, responseSchema, examples = [], options = {}) {
    const llmClient = await this.getLLMClient();
    
    return new TemplatedPrompt({
      prompt: template,
      responseSchema,
      examples,
      llmClient,
      ...options
    });
  }

  /**
   * Batch execute multiple prompts
   */
  async executeBatch(prompts) {
    const results = [];
    
    for (const prompt of prompts) {
      const result = await this.execute(
        prompt.template || prompt.prompt,
        prompt.variables || {},
        prompt.schema || prompt.responseSchema,
        prompt.examples || [],
        prompt.options || {}
      );
      
      results.push({
        ...prompt,
        result
      });
    }
    
    return results;
  }
}

/**
 * Factory function to create a PromptExecutor from various sources
 */
export function createPromptExecutor(source) {
  return new PromptExecutor(source);
}

/**
 * Convenience function for one-shot prompt execution
 */
export async function executePrompt(promptOrTemplate, variables = {}, responseSchema = null, examples = [], options = {}) {
  const executor = new PromptExecutor(options.context || {});
  return await executor.execute(promptOrTemplate, variables, responseSchema, examples, options);
}

/**
 * Convenience function that throws on error
 */
export async function executePromptOrThrow(promptOrTemplate, variables = {}, responseSchema = null, examples = [], options = {}) {
  const executor = new PromptExecutor(options.context || {});
  return await executor.executeOrThrow(promptOrTemplate, variables, responseSchema, examples, options);
}