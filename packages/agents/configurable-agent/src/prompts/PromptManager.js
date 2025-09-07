/**
 * PromptManager - Manages prompt templates and formatting
 */

/**
 * Manages prompt templates, variable replacement, and response formatting
 */
export class PromptManager {
  constructor(config = {}) {
    this.templates = config.templates || {};
    this.responseFormat = config.responseFormat || 'text';
    this.variables = config.variables || {};
    this.enableHistory = config.enableHistory || false;
    this.maxHistorySize = config.maxHistorySize || 100;
    this.history = [];
    this.systemPrompt = config.systemPrompt;
  }

  /**
   * Initialize the prompt manager
   */
  async initialize() {
    // Load any default templates or configurations
    // This can be extended in the future
    return true;
  }

  /**
   * Get the system prompt
   */
  getSystemPrompt() {
    // Check for system template first, then use systemPrompt, then default
    if (this.templates?.system) {
      return this.templates.system;
    }
    if (this.systemPrompt) {
      return this.systemPrompt;
    }
    return 'You are a helpful AI assistant.';
  }

  /**
   * Process a template with variables
   */
  processTemplate(templateName, variables = {}) {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }
    return this.renderTemplate(template, variables);
  }

  /**
   * Load a single template
   */
  loadTemplate(name, template) {
    this.templates[name] = template;
  }

  /**
   * Load multiple templates
   */
  loadTemplates(templates) {
    Object.assign(this.templates, templates);
  }

  /**
   * Get a template by name
   */
  getTemplate(name) {
    return this.templates[name] || null;
  }

  /**
   * Set a single variable
   */
  setVariable(name, value) {
    this.variables[name] = value;
  }

  /**
   * Set multiple variables
   */
  setVariables(variables) {
    Object.assign(this.variables, variables);
  }

  /**
   * Get a variable value
   */
  getVariable(name) {
    return this.variables[name];
  }

  /**
   * Clear all variables
   */
  clearVariables() {
    this.variables = {};
  }

  /**
   * Render a template with variable replacement
   */
  renderTemplate(template, variables = {}) {
    // Merge provided variables with global variables
    const allVariables = { ...this.variables, ...variables };
    
    // Replace variables in template
    let rendered = template;
    for (const [key, value] of Object.entries(allVariables)) {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(pattern, value);
    }
    
    return rendered;
  }

  /**
   * Construct system prompt
   */
  constructSystemPrompt(variables = {}) {
    const template = this.templates.system;
    if (!template) {
      throw new Error('System template not defined');
    }
    
    return this.renderTemplate(template, variables);
  }

  /**
   * Construct user prompt
   */
  constructUserPrompt(message) {
    const template = this.templates.user;
    if (!template) {
      return message; // Return raw message if no template
    }
    
    return this.renderTemplate(template, { message });
  }

  /**
   * Construct full conversation prompt
   */
  constructConversationPrompt(messages) {
    const parts = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        parts.push(message.content);
      } else if (message.role === 'user') {
        const template = this.templates.user;
        if (template) {
          parts.push(this.renderTemplate(template, { message: message.content }));
        } else {
          parts.push(message.content);
        }
      } else if (message.role === 'assistant') {
        const template = this.templates.assistant;
        if (template) {
          parts.push(this.renderTemplate(template, { response: message.content }));
        } else {
          parts.push(message.content);
        }
      }
    }
    
    return parts.join('\n');
  }

  /**
   * Format messages for LLM
   */
  formatForLLM(messages, options = {}) {
    return {
      messages: messages,
      ...options
    };
  }

  /**
   * Format response based on format type
   */
  formatResponse(response) {
    switch (this.responseFormat) {
      case 'json':
        if (typeof response === 'string') {
          return JSON.stringify(response);
        }
        return JSON.stringify(response, null, 2);
        
      case 'markdown':
        if (typeof response === 'object') {
          let markdown = '';
          if (response.title) {
            markdown += `# ${response.title}\n\n`;
          }
          if (response.content) {
            markdown += `${response.content}\n\n`;
          }
          if (response.list && Array.isArray(response.list)) {
            for (const item of response.list) {
              markdown += `- ${item}\n`;
            }
          }
          return markdown;
        }
        return response;
        
      case 'text':
      default:
        return response;
    }
  }

  /**
   * Parse response based on format
   */
  parseResponse(response) {
    if (this.responseFormat === 'json') {
      try {
        return JSON.parse(response);
      } catch (error) {
        // Return as-is if parsing fails
        return response;
      }
    }
    
    return response;
  }

  /**
   * Validate template syntax
   */
  validateTemplate(template) {
    // Check for proper bracket pairing
    let depth = 0;
    let i = 0;
    
    while (i < template.length) {
      if (template[i] === '{' && template[i + 1] === '{') {
        depth++;
        i += 2;
      } else if (template[i] === '}' && template[i + 1] === '}') {
        depth--;
        if (depth < 0) {
          // Found a close without a matching open
          return false;
        }
        i += 2;
      } else if (template[i] === '{' || template[i] === '}') {
        // Found a single bracket that's not part of a pair
        // Check if it's a single } after we've consumed all pairs
        if (template[i] === '}' && depth === 0) {
          // Extra closing brace
          return false;
        }
        i++;
      } else {
        i++;
      }
    }
    
    // All brackets should be matched (depth should be 0)
    return depth === 0;
  }

  /**
   * Extract variable names from template
   */
  extractVariables(template) {
    const regex = /{{(\w+(?:\.\w+)*)}}/g;
    const variables = new Set();
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  }

  /**
   * Create a prompt chain
   */
  createPromptChain(steps) {
    const chain = [];
    let previousOutput = null;
    
    for (const step of steps) {
      let variables = step.variables || {};
      
      // Add previous output if requested
      if (step.useOutput && previousOutput !== null) {
        variables[step.useOutput] = previousOutput;
      }
      
      const template = this.templates[step.template];
      if (!template) {
        throw new Error(`Template not found: ${step.template}`);
      }
      
      const prompt = this.renderTemplate(template, variables);
      chain.push(prompt);
      
      // Simulate output for next step (in real use, this would be from LLM)
      previousOutput = prompt;
    }
    
    return chain;
  }

  /**
   * Execute a prompt chain
   */
  async executePromptChain(steps, executor) {
    let previousOutput = null;
    let lastResult = null;
    
    for (const step of steps) {
      let variables = step.variables || {};
      
      // Add previous output if requested
      if (step.useOutput && previousOutput !== null) {
        variables[step.useOutput] = previousOutput;
      }
      
      const template = this.templates[step.template];
      if (!template) {
        throw new Error(`Template not found: ${step.template}`);
      }
      
      const prompt = this.renderTemplate(template, variables);
      
      // Execute with provided executor
      lastResult = await executor(prompt);
      previousOutput = lastResult;
    }
    
    return lastResult;
  }

  /**
   * Add to prompt history
   */
  addToHistory(prompt, response) {
    if (!this.enableHistory) {
      return;
    }
    
    this.history.push({
      prompt: prompt,
      response: response,
      timestamp: new Date().toISOString()
    });
    
    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get prompt history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Clear prompt history
   */
  clearHistory() {
    this.history = [];
  }
}