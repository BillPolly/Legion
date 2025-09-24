/**
 * PromptManager - Centralized prompt management for strategies
 * 
 * This utility handles:
 * - Prompt registry initialization
 * - Batch prompt loading with FAIL FAST
 * - Template variable replacement
 * - Response parsing and validation
 * - Schema-based prompt definitions
 */

import { PromptRegistry, TemplatedPrompt } from '@legion/prompting-manager';
import path from 'path';
import { parseJsonResponse } from './StrategyHelpers.js';

/**
 * PromptManager class for managing strategy prompts
 */
export class PromptManager {
  /**
   * Create a new PromptManager
   * 
   * @param {string} basePath - Base directory path for prompts (usually __dirname)
   * @param {Object} options - Additional options
   */
  constructor(basePath, options = {}) {
    // Resolve prompts directory
    this.promptsPath = options.promptsPath || path.resolve(basePath, '../../../prompts');
    
    // Initialize prompt registry
    this.registry = options.registry || new PromptRegistry();
    if (!options.registry) {
      this.registry.addDirectory(this.promptsPath);
    }
    
    // Store loaded prompts
    this.prompts = {};
    
    // Track initialization state
    this.initialized = false;
    this.initError = null;
    this.initPromise = null;
    
    // Default LLM client (can be overridden per prompt)
    this.llmClient = options.llmClient || null;
  }
  
  /**
   * Load multiple prompts with their schemas
   * FAIL FAST if any prompt is missing
   * 
   * @param {Array<Object>} definitions - Array of prompt definitions
   * @returns {Promise<void>}
   */
  async loadPrompts(definitions) {
    if (this.initialized) return;
    
    this.initPromise = this._loadPromptsInternal(definitions);
    
    try {
      await this.initPromise;
      this.initialized = true;
      console.log(`✅ PromptManager: Loaded ${definitions.length} prompts successfully`);
    } catch (error) {
      this.initError = error;
      console.error(`❌ FAIL FAST: Failed to load prompts: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Internal method to load prompts
   */
  async _loadPromptsInternal(definitions) {
    const loadPromises = definitions.map(async (def) => {
      // Handle both string paths and definition objects
      const path = typeof def === 'string' ? def : def.path;
      const schema = typeof def === 'object' ? def.schema : null;
      
      // Load the prompt template
      const promptTemplate = await this.registry.load(path);
      
      if (!promptTemplate) {
        const error = new Error(`Required prompt missing: ${path} - FAIL FAST, no fallbacks!`);
        console.error(`❌ FAIL FAST: Failed to load required prompt: ${path}`);
        throw error;
      }
      
      // Create TemplatedPrompt if schema provided, otherwise store raw template
      if (schema) {
        this.prompts[path] = new TemplatedPrompt({
          prompt: promptTemplate,
          responseSchema: schema,
          llmClient: this.llmClient,
          maxRetries: 3
        });
      } else {
        this.prompts[path] = promptTemplate;
      }
      
      return this.prompts[path];
    });
    
    return Promise.all(loadPromises);
  }
  
  /**
   * Get a loaded prompt by path
   * 
   * @param {string} path - Prompt path
   * @returns {Object} The prompt template or TemplatedPrompt instance
   */
  getPrompt(path) {
    if (this.initError) {
      throw new Error(`PromptManager initialization failed: ${this.initError.message}`);
    }
    
    const prompt = this.prompts[path];
    if (!prompt) {
      throw new Error(`Prompt not loaded: ${path} - FAIL FAST!`);
    }
    
    return prompt;
  }
  
  /**
   * Execute a prompt with variables
   * Handles both raw templates and TemplatedPrompt instances
   * 
   * @param {string} path - Prompt path
   * @param {Object} variables - Variables to replace in template
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executePrompt(path, variables = {}, options = {}) {
    const prompt = this.getPrompt(path);
    
    // If it's a TemplatedPrompt, use its execute method
    if (prompt.execute) {
      return await prompt.execute(variables);
    }
    
    // Otherwise, upgrade raw template to a TemplatedPrompt on demand
    const llmClient = options.llmClient || this.llmClient;
    if (!llmClient) {
      throw new Error('LLM client required for prompt execution');
    }

    const schema = options.responseSchema || {
      type: 'string'
    };

    const templatedPrompt = new TemplatedPrompt({
      prompt: prompt.content || prompt,
      responseSchema: schema,
      examples: options.examples || [],
      llmClient,
      maxRetries: options.maxRetries || 3
    });

    // Cache the upgraded prompt for future calls
    this.prompts[path] = templatedPrompt;

    const result = await templatedPrompt.execute(variables);

    if (options.parseJson !== false && typeof result.data === 'string') {
      const parsed = parseJsonResponse(result.data);
      if (parsed !== null) {
        result.data = parsed;
      }
    }

    return {
      success: result.success,
      data: result.data,
      raw: result.data,
      errors: result.errors
    };
  }
  
  /**
   * Replace template variables with values
   * 
   * @param {string} template - Template string with {{variable}} placeholders
   * @param {Object} variables - Variable values
   * @returns {string} Template with variables replaced
   */
  replaceVariables(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      
      if (value === undefined) {
        console.warn(`Template variable not provided: ${key}`);
        return match;
      }
      
      // Convert objects/arrays to JSON
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      
      return value;
    });
  }
  
  /**
   * Ensure prompts are initialized
   * 
   * @returns {Promise<void>}
   */
  async ensureInitialized() {
    if (this.initError) {
      throw this.initError;
    }
    
    if (this.initPromise) {
      await this.initPromise;
    }
    
    if (!this.initialized) {
      throw new Error('PromptManager not initialized - call loadPrompts first');
    }
  }
  
  /**
   * Create a standard set of prompt definitions for a domain
   * 
   * @param {string} domain - Domain name (e.g., 'requirements-analysis')
   * @param {Array<Object>} specs - Prompt specifications
   * @returns {Array<Object>} Prompt definitions
   */
  static createPromptDefinitions(domain, specs) {
    return specs.map(spec => ({
      path: `${domain}/${spec.name}`,
      schema: spec.schema || {
        type: 'object',
        format: 'json'
      }
    }));
  }
  
  /**
   * Create a PromptManager with common analysis prompts
   * 
   * @param {string} basePath - Base directory path
   * @param {Object} llmClient - LLM client instance
   * @returns {PromptManager} Configured PromptManager
   */
  static async createForAnalysis(basePath, llmClient) {
    const manager = new PromptManager(basePath, { llmClient });
    
    await manager.loadPrompts([
      {
        path: 'requirements-analysis/functional-requirements',
        schema: {
          type: 'object',
          properties: {
            requirements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  description: { type: 'string' },
                  priority: { type: 'string' },
                  acceptance_criteria: { type: 'array' }
                }
              }
            }
          },
          format: 'json'
        }
      },
      {
        path: 'requirements-analysis/technical-requirements',
        schema: {
          type: 'object',
          properties: {
            requirements: { type: 'array' }
          },
          format: 'json'
        }
      },
      {
        path: 'requirements-analysis/component-architecture',
        schema: {
          type: 'object',
          properties: {
            components: { type: 'array' }
          },
          format: 'json'
        }
      }
    ]);
    
    return manager;
  }
  
  /**
   * Create a PromptManager with common planning prompts
   * 
   * @param {string} basePath - Base directory path
   * @param {Object} llmClient - LLM client instance
   * @returns {PromptManager} Configured PromptManager
   */
  static async createForPlanning(basePath, llmClient) {
    const manager = new PromptManager(basePath, { llmClient });
    
    await manager.loadPrompts([
      {
        path: 'project-planning/project-structure',
        schema: {
          type: 'object',
          properties: {
            structure: { type: 'object' },
            phases: { type: 'array' }
          },
          format: 'json'
        }
      },
      {
        path: 'project-planning/task-breakdown',
        schema: {
          type: 'object',
          properties: {
            tasks: { type: 'array' }
          },
          format: 'json'
        }
      }
    ]);
    
    return manager;
  }
}

export default PromptManager;
