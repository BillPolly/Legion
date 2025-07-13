/**
 * PromptTemplate provides template variable substitution for agent prompts
 * Supports context injection, environment variables, and function calls
 */
class PromptTemplate {
  constructor(template, options = {}) {
    this.template = template;
    this.options = {
      variablePattern: /\$\{([^}]+)\}/g,
      allowUndefined: false,
      defaultValue: '',
      escapeHtml: false,
      ...options
    };
    
    this.functions = new Map();
    this.staticContext = new Map();
  }

  /**
   * Render the template with provided context
   * @param {Object} context - Context variables for substitution
   * @param {Object} options - Rendering options
   * @returns {string} Rendered template
   */
  render(context = {}, options = {}) {
    const renderOptions = { ...this.options, ...options };
    const fullContext = this.buildFullContext(context);
    
    let result = this.template;
    
    // Perform variable substitution
    result = result.replace(renderOptions.variablePattern, (match, varPath) => {
      return this.resolveVariable(varPath, fullContext, renderOptions);
    });
    
    // Post-process result
    if (renderOptions.escapeHtml) {
      result = this.escapeHtml(result);
    }
    
    return result;
  }

  /**
   * Build full context from static context, provided context, and environment
   * @private
   */
  buildFullContext(providedContext) {
    const fullContext = {
      // Environment variables
      env: process.env,
      
      // Static context
      ...Object.fromEntries(this.staticContext),
      
      // Provided context (highest priority)
      ...providedContext,
      
      // Special variables
      _timestamp: new Date().toISOString(),
      _date: new Date().toISOString().split('T')[0],
      _time: new Date().toTimeString().split(' ')[0],
      _random: Math.random().toString(36).substring(2, 8)
    };
    
    return fullContext;
  }

  /**
   * Resolve a variable path in the context
   * @private
   */
  resolveVariable(varPath, context, options) {
    try {
      // Handle function calls
      if (varPath.includes('(') && varPath.includes(')')) {
        return this.resolveFunction(varPath, context);
      }
      
      // Handle dot notation and array access
      const value = this.getNestedValue(context, varPath);
      
      if (value === undefined || value === null) {
        if (options.allowUndefined) {
          return options.defaultValue;
        } else {
          console.warn(`Template variable '${varPath}' is undefined`);
          return `\${${varPath}}`;
        }
      }
      
      // Convert to string
      return String(value);
      
    } catch (error) {
      console.error(`Error resolving template variable '${varPath}':`, error);
      return options.allowUndefined ? options.defaultValue : `\${${varPath}}`;
    }
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Handle array access like "items[0]"
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        const array = current[arrayKey];
        return Array.isArray(array) ? array[parseInt(index, 10)] : undefined;
      }
      
      return current[key];
    }, obj);
  }

  /**
   * Resolve function calls in templates
   * @private
   */
  resolveFunction(expression, context) {
    // Parse function call: functionName(arg1, arg2, ...)
    const match = expression.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\((.*)\)$/);
    if (!match) {
      throw new Error(`Invalid function call syntax: ${expression}`);
    }
    
    const [, functionName, argsString] = match;
    
    // Get function
    const func = this.functions.get(functionName);
    if (!func) {
      throw new Error(`Unknown function: ${functionName}`);
    }
    
    // Parse arguments
    const args = this.parseArguments(argsString, context);
    
    // Call function
    return func(...args);
  }

  /**
   * Parse function arguments
   * @private
   */
  parseArguments(argsString, context) {
    if (!argsString.trim()) {
      return [];
    }
    
    // Simple argument parsing (doesn't handle complex nested structures)
    const args = argsString.split(',').map(arg => {
      arg = arg.trim();
      
      // Remove quotes for string literals
      if ((arg.startsWith('"') && arg.endsWith('"')) || 
          (arg.startsWith("'") && arg.endsWith("'"))) {
        return arg.slice(1, -1);
      }
      
      // Parse numbers
      if (/^\d+(\.\d+)?$/.test(arg)) {
        return parseFloat(arg);
      }
      
      // Parse booleans
      if (arg === 'true') return true;
      if (arg === 'false') return false;
      if (arg === 'null') return null;
      if (arg === 'undefined') return undefined;
      
      // Resolve as variable
      return this.getNestedValue(context, arg);
    });
    
    return args;
  }

  /**
   * Escape HTML entities
   * @private
   */
  escapeHtml(text) {
    const htmlEntities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    
    return text.replace(/[&<>"']/g, char => htmlEntities[char]);
  }

  /**
   * Add a function that can be called from templates
   * @param {string} name - Function name
   * @param {Function} func - Function implementation
   */
  addFunction(name, func) {
    if (typeof func !== 'function') {
      throw new Error('Function must be a function');
    }
    
    this.functions.set(name, func);
  }

  /**
   * Remove a function
   * @param {string} name - Function name
   */
  removeFunction(name) {
    return this.functions.delete(name);
  }

  /**
   * Add static context that will be available in all renders
   * @param {string} key - Context key
   * @param {*} value - Context value
   */
  addStaticContext(key, value) {
    this.staticContext.set(key, value);
  }

  /**
   * Remove static context
   * @param {string} key - Context key
   */
  removeStaticContext(key) {
    return this.staticContext.delete(key);
  }

  /**
   * Get all available variables in the template
   * @returns {string[]} Array of variable names
   */
  getVariables() {
    const variables = new Set();
    const matches = this.template.matchAll(this.options.variablePattern);
    
    for (const match of matches) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  }

  /**
   * Validate template by checking for undefined variables
   * @param {Object} context - Context to validate against
   * @returns {Object} Validation result
   */
  validate(context = {}) {
    const fullContext = this.buildFullContext(context);
    const variables = this.getVariables();
    const missing = [];
    const errors = [];
    
    for (const varPath of variables) {
      try {
        const value = this.getNestedValue(fullContext, varPath);
        if (value === undefined) {
          missing.push(varPath);
        }
      } catch (error) {
        errors.push({ variable: varPath, error: error.message });
      }
    }
    
    return {
      valid: missing.length === 0 && errors.length === 0,
      missing,
      errors
    };
  }

  /**
   * Create a new template with partial context pre-applied
   * @param {Object} partialContext - Context to pre-apply
   * @returns {PromptTemplate} New template instance
   */
  withContext(partialContext) {
    const newTemplate = new PromptTemplate(this.template, this.options);
    
    // Copy functions and static context
    newTemplate.functions = new Map(this.functions);
    newTemplate.staticContext = new Map([...this.staticContext, ...Object.entries(partialContext)]);
    
    return newTemplate;
  }

  /**
   * Clone the template
   * @returns {PromptTemplate} Cloned template
   */
  clone() {
    const cloned = new PromptTemplate(this.template, this.options);
    cloned.functions = new Map(this.functions);
    cloned.staticContext = new Map(this.staticContext);
    return cloned;
  }

  /**
   * Create a template from a file
   * @param {string} filePath - Path to template file
   * @param {Object} options - Template options
   * @returns {Promise<PromptTemplate>} Template instance
   */
  static async fromFile(filePath, options = {}) {
    const fs = await import('fs/promises');
    const template = await fs.readFile(filePath, 'utf8');
    return new PromptTemplate(template, options);
  }

  /**
   * Create template with common utility functions
   * @param {string} template - Template string
   * @param {Object} options - Template options
   * @returns {PromptTemplate} Template with utility functions
   */
  static withUtilities(template, options = {}) {
    const promptTemplate = new PromptTemplate(template, options);
    
    // Add common utility functions
    promptTemplate.addFunction('upper', (str) => String(str).toUpperCase());
    promptTemplate.addFunction('lower', (str) => String(str).toLowerCase());
    promptTemplate.addFunction('capitalize', (str) => {
      const s = String(str);
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    });
    promptTemplate.addFunction('length', (str) => String(str).length);
    promptTemplate.addFunction('substring', (str, start, end) => String(str).substring(start, end));
    promptTemplate.addFunction('replace', (str, search, replace) => String(str).replace(search, replace));
    promptTemplate.addFunction('split', (str, delimiter) => String(str).split(delimiter));
    promptTemplate.addFunction('join', (array, delimiter = ',') => Array.isArray(array) ? array.join(delimiter) : String(array));
    promptTemplate.addFunction('format_date', (date, locale = 'en-US') => new Date(date).toLocaleDateString(locale));
    promptTemplate.addFunction('format_time', (date, locale = 'en-US') => new Date(date).toLocaleTimeString(locale));
    promptTemplate.addFunction('json', (obj) => JSON.stringify(obj, null, 2));
    promptTemplate.addFunction('default', (value, defaultValue) => value !== undefined && value !== null ? value : defaultValue);
    
    return promptTemplate;
  }
}

export default PromptTemplate;