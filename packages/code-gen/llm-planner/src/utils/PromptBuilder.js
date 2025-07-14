/**
 * PromptBuilder - Utility for building structured prompts for LLM interactions
 */

class PromptBuilder {
  constructor() {
    this.messages = [];
    this.context = {};
    this.metadata = {};
    this.template = null;
    this.maxLength = null;
    this.transformers = [];
    
    // Built-in templates
    this.templates = {
      'code-generation': {
        system: 'You are an expert code generation assistant. You specialize in {language} development. Generate clean, well-structured {type} code following best practices. Use ES6+ features for JavaScript. Ensure code is readable and maintainable.',
        context: ['language', 'type']
      },
      'test-generation': {
        system: 'You are an expert at writing comprehensive tests. Generate {framework} tests that cover edge cases, error scenarios, and happy paths. Ensure high code coverage.',
        context: ['framework']
      },
      'error-fixing': {
        system: 'You are an expert debugger. Analyze the error and provide a corrected version of the code. Explain what was wrong and why your fix works.',
        context: []
      },
      'architecture-planning': {
        system: 'You are a software architect. Design a clean, scalable architecture for the given requirements. Consider maintainability, performance, and best practices.',
        context: []
      },
      'requirement-analysis': {
        system: 'You are a requirements analyst and planning expert. Break down the given requirements into clear, actionable tasks. Identify dependencies and potential challenges.',
        context: []
      }
    };
  }

  /**
   * Add a system message
   * @param {string} content - Message content
   * @returns {PromptBuilder} This instance for chaining
   */
  addSystemMessage(content) {
    return this.addMessage('system', content);
  }

  /**
   * Add a user message
   * @param {string} content - Message content
   * @returns {PromptBuilder} This instance for chaining
   */
  addUserMessage(content) {
    return this.addMessage('user', content);
  }

  /**
   * Add an assistant message
   * @param {string} content - Message content
   * @returns {PromptBuilder} This instance for chaining
   */
  addAssistantMessage(content) {
    return this.addMessage('assistant', content);
  }

  /**
   * Add a message with any role
   * @param {string} role - Message role
   * @param {string} content - Message content
   * @returns {PromptBuilder} This instance for chaining
   */
  addMessage(role, content) {
    const validRoles = ['system', 'user', 'assistant'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }
    
    this.messages.push({ role, content });
    return this;
  }

  /**
   * Add conditional message
   * @param {Function} condition - Condition function
   * @param {string} role - Message role
   * @param {string} content - Message content
   * @returns {PromptBuilder} This instance for chaining
   */
  addConditionalMessage(condition, role, content) {
    if (condition(this.context)) {
      return this.addMessage(role, content);
    }
    return this;
  }

  /**
   * Clear all messages
   * @returns {PromptBuilder} This instance for chaining
   */
  clear() {
    this.messages = [];
    return this;
  }

  /**
   * Use a predefined template
   * @param {string} templateName - Template name
   * @returns {PromptBuilder} This instance for chaining
   */
  useTemplate(templateName) {
    if (!this.templates[templateName]) {
      throw new Error(`Unknown template: ${templateName}`);
    }
    
    this.template = this.templates[templateName];
    return this;
  }

  /**
   * Register a custom template
   * @param {string} name - Template name
   * @param {Object} template - Template definition
   * @returns {PromptBuilder} This instance for chaining
   */
  registerTemplate(name, template) {
    this.templates[name] = template;
    return this;
  }

  /**
   * Add context variables
   * @param {Object} contextVars - Context variables
   * @returns {PromptBuilder} This instance for chaining
   */
  addContext(contextVars) {
    this.context = { ...this.context, ...contextVars };
    return this;
  }

  /**
   * Get current context
   * @returns {Object} Current context
   */
  getContext() {
    return { ...this.context };
  }

  /**
   * Add metadata
   * @param {Object} metadata - Metadata to add
   * @returns {PromptBuilder} This instance for chaining
   */
  addMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Set maximum prompt length
   * @param {number} maxLength - Maximum length
   * @returns {PromptBuilder} This instance for chaining
   */
  setMaxLength(maxLength) {
    this.maxLength = maxLength;
    return this;
  }

  /**
   * Add a message transformer
   * @param {Function} transformer - Transformer function
   * @returns {PromptBuilder} This instance for chaining
   */
  addTransformer(transformer) {
    this.transformers.push(transformer);
    return this;
  }

  /**
   * Compose with another builder
   * @param {PromptBuilder} other - Other builder
   * @returns {PromptBuilder} This instance for chaining
   */
  compose(other) {
    this.messages = [...other.messages, ...this.messages];
    this.context = { ...other.context, ...this.context };
    return this;
  }

  /**
   * Build the final prompt
   * @returns {Object} Built prompt
   */
  build() {
    let messages = [...this.messages];
    
    // Apply template if set
    if (this.template) {
      const systemMessage = this._interpolate(this.template.system, this.context);
      messages.unshift({ role: 'system', content: systemMessage });
    }
    
    // Interpolate context in all messages
    messages = messages.map(msg => ({
      ...msg,
      content: this._interpolate(msg.content, this.context)
    }));
    
    // Apply transformers
    for (const transformer of this.transformers) {
      messages = messages.map(transformer);
    }
    
    // Apply length limit
    if (this.maxLength) {
      messages = messages.map(msg => ({
        ...msg,
        content: this._truncate(msg.content, this.maxLength)
      }));
    }
    
    return {
      messages,
      system: messages.find(m => m.role === 'system')?.content || '',
      user: messages.filter(m => m.role === 'user').pop()?.content || '',
      context: this.context,
      metadata: this.metadata
    };
  }

  /**
   * Format the prompt in different ways
   * @param {string} format - Format type
   * @returns {*} Formatted prompt
   */
  format(format = 'object') {
    const built = this.build();
    
    switch (format) {
      case 'string':
        return built.messages
          .map(msg => `${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}:\n${msg.content}`)
          .join('\n\n');
        
      case 'messages':
        return built.messages;
        
      case 'openai':
        return {
          model: 'gpt-4',
          messages: built.messages,
          temperature: 0.7
        };
        
      default:
        return built;
    }
  }

  /**
   * Export builder state
   * @returns {Object} Exported state
   */
  export() {
    return {
      messages: [...this.messages],
      context: { ...this.context },
      metadata: { ...this.metadata },
      template: this.template,
      maxLength: this.maxLength
    };
  }

  /**
   * Import builder state
   * @param {Object} state - State to import
   * @returns {PromptBuilder} This instance for chaining
   */
  import(state) {
    this.messages = [...state.messages];
    this.context = { ...state.context };
    this.metadata = { ...state.metadata };
    this.template = state.template;
    this.maxLength = state.maxLength;
    return this;
  }

  /**
   * Interpolate variables in text
   * @private
   */
  _interpolate(text, context) {
    let result = text;
    
    // Handle simple variables
    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{${key}}`;
      if (result.includes(placeholder)) {
        let replacement = value;
        
        // Handle objects and arrays
        if (typeof value === 'object') {
          try {
            replacement = JSON.stringify(value, null, 2);
          } catch (e) {
            replacement = '[Complex Object]';
          }
        }
        
        // Sanitize HTML
        if (typeof replacement === 'string') {
          replacement = this._sanitize(replacement);
        }
        
        result = result.replace(new RegExp(placeholder, 'g'), replacement);
      }
    }
    
    return result;
  }

  /**
   * Sanitize HTML content
   * @private
   */
  _sanitize(text) {
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Truncate text to max length
   * @private
   */
  _truncate(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  // Static factory methods

  /**
   * Create a new builder instance
   * @static
   */
  static create() {
    return new PromptBuilder();
  }

  /**
   * Create from template with context
   * @static
   */
  static fromTemplate(templateName, context) {
    const builder = new PromptBuilder();
    builder.useTemplate(templateName);
    builder.addContext(context);
    
    if (context.task) {
      builder.addUserMessage(context.task);
    }
    
    return builder.build();
  }

  /**
   * Create code planning prompt
   * @static
   */
  static createCodePlanningPrompt(params) {
    return new PromptBuilder()
      .useTemplate('requirement-analysis')
      .addContext(params)
      .addUserMessage(`Create a detailed plan for the following task:
Task: ${params.task}
Requirements: ${JSON.stringify(params.requirements, null, 2)}
Constraints: ${JSON.stringify(params.constraints, null, 2)}

Break this down into specific implementation steps, file structure, and technical approach.`)
      .build();
  }

  /**
   * Create test generation prompt
   * @static
   */
  static createTestGenerationPrompt(params) {
    return new PromptBuilder()
      .useTemplate('test-generation')
      .addContext(params)
      .addUserMessage(`Generate comprehensive ${params.framework} tests for the following code:

${params.code}

Include ${params.coverage} tests with edge cases and error scenarios.`)
      .build();
  }

  /**
   * Create error fixing prompt
   * @static
   */
  static createErrorFixingPrompt(params) {
    return new PromptBuilder()
      .useTemplate('error-fixing')
      .addContext(params)
      .addUserMessage(`Fix the following error in the code:

Code:
${params.code}

Error:
${params.error}

Context:
${params.context}

Provide the corrected code and explain the fix.`)
      .build();
  }

  /**
   * Create architecture prompt
   * @static
   */
  static createArchitecturePrompt(params) {
    return new PromptBuilder()
      .useTemplate('architecture-planning')
      .addContext(params)
      .addUserMessage(`Design a ${params.scale} scale ${params.projectType} architecture for the following requirements:

${params.requirements.map(r => `- ${r}`).join('\n')}

Consider scalability, maintainability, and best practices.`)
      .build();
  }
}

export { PromptBuilder };