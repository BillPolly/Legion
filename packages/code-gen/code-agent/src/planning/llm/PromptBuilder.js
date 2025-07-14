/**
 * PromptBuilder - Builds prompts from templates and input data
 * 
 * This class handles templating and variable substitution for creating
 * prompts to send to LLM models.
 */

class PromptBuilder {
  constructor(template) {
    this.template = template;
  }

  /**
   * Build a prompt from the template and input data
   * @param {Object} input - Input data to substitute into template
   * @param {Object} context - Additional context for prompt building
   * @returns {string} Built prompt
   */
  build(input, context = {}) {
    try {
      let prompt = this.template;

      // Replace template variables with actual values
      prompt = this.replaceVariables(prompt, input, context);

      // Clean up any remaining template variables
      prompt = this.cleanupTemplate(prompt);

      return prompt;
      
    } catch (error) {
      throw new Error(`Prompt building failed: ${error.message}`);
    }
  }

  /**
   * Replace template variables with actual values
   * @param {string} template - Template string
   * @param {Object} input - Input data
   * @param {Object} context - Additional context
   * @returns {string} Template with variables replaced
   */
  replaceVariables(template, input, context) {
    // Replace {variable} patterns with actual values
    return template.replace(/\{([^}]+)\}/g, (match, varName) => {
      const value = this.getVariableValue(varName, input, context);
      
      if (value === undefined || value === null) {
        return match; // Keep placeholder if no value found
      }
      
      // Handle different value types
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      
      return String(value);
    });
  }

  /**
   * Get variable value from input or context
   * @param {string} varName - Variable name
   * @param {Object} input - Input data
   * @param {Object} context - Additional context
   * @returns {*} Variable value
   */
  getVariableValue(varName, input, context) {
    // Check direct input properties first
    if (input && input[varName] !== undefined) {
      return input[varName];
    }

    // Check context
    if (context && context[varName] !== undefined) {
      return context[varName];
    }

    // Handle nested property access (e.g., "requirements.frontend")
    if (varName.includes('.')) {
      const parts = varName.split('.');
      let value = input;
      
      for (const part of parts) {
        if (value && typeof value === 'object' && value[part] !== undefined) {
          value = value[part];
        } else {
          return undefined;
        }
      }
      
      return value;
    }

    return undefined;
  }

  /**
   * Clean up template by removing empty placeholders
   * @param {string} template - Template to clean
   * @returns {string} Cleaned template
   */
  cleanupTemplate(template) {
    // Remove lines that contain only unreplaced placeholders
    return template
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        // Keep line if it doesn't contain unreplaced placeholders or contains other content
        return !(/^\{[^}]+\}$/.test(trimmed));
      })
      .join('\n')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove multiple empty lines
      .trim();
  }

  /**
   * Get the template this builder uses
   * @returns {string} Template string
   */
  getTemplate() {
    return this.template;
  }

  /**
   * Extract variables from template
   * @returns {Array} Array of variable names
   */
  getVariables() {
    const variables = [];
    const regex = /\{([^}]+)\}/g;
    let match;
    
    while ((match = regex.exec(this.template)) !== null) {
      variables.push(match[1]);
    }
    
    return [...new Set(variables)]; // Remove duplicates
  }
}

export { PromptBuilder };