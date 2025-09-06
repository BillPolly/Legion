/**
 * TemplateProcessor - Core template parsing and processing engine
 * 
 * Handles template parsing, placeholder extraction, and basic substitution
 * without content-specific intelligence (that's handled by content handlers)
 */

export class TemplateProcessor {
  /**
   * Create a template processor
   * @param {string} template - Template string with placeholders
   */
  constructor(template) {
    if (!template || typeof template !== 'string' || template.trim().length === 0) {
      throw new Error('Template must be a non-empty string');
    }
    
    this.template = template;
    this.placeholders = null; // Lazy loaded
  }

  /**
   * Extract all placeholders from template
   * @returns {string[]} Array of placeholder names
   */
  extractPlaceholders() {
    if (this.placeholders) {
      return this.placeholders;
    }

    const placeholders = new Set();
    
    // Simple placeholders: {{name}}
    const simplePattern = /\{\{([^#\/}][^}]*)\}\}/g;
    let match;
    
    while ((match = simplePattern.exec(this.template)) !== null) {
      const placeholder = match[1].trim();
      const parsed = this.parsePlaceholderOptions(placeholder);
      placeholders.add(parsed.name);
    }
    
    // Conditional sections: {{#section}}...{{/section}}
    const sectionPattern = /\{\{#([^}]+)\}\}/g;
    while ((match = sectionPattern.exec(this.template)) !== null) {
      const sectionName = match[1].trim();
      placeholders.add(sectionName);
    }
    
    this.placeholders = Array.from(placeholders);
    return this.placeholders;
  }

  /**
   * Parse placeholder options (type hints, constraints, etc.)
   * @param {string} placeholderText - Raw placeholder content
   * @returns {Object} Parsed options
   */
  parsePlaceholderOptions(placeholderText) {
    const parts = placeholderText.split('|');
    const name = parts[0].trim();
    
    const options = { name };
    
    // Handle context variables
    if (name.startsWith('@')) {
      const contextMatch = name.match(/@([^:]+):(.+)/);
      if (contextMatch) {
        options.name = '@' + contextMatch[1];
        options.contextKey = contextMatch[2];
        options.isContextVariable = true;
      } else {
        options.isContextVariable = true;
      }
    }
    
    // Parse additional options
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].trim();
      const colonIndex = part.indexOf(':');
      
      if (colonIndex > 0) {
        const key = part.substring(0, colonIndex).trim();
        const value = part.substring(colonIndex + 1).trim();
        options[key] = value;
      }
    }
    
    return options;
  }

  /**
   * Validate template syntax and structure
   * @throws {Error} If template is invalid
   */
  validateTemplate() {
    // Check for unmatched braces
    const openBraces = (this.template.match(/\{\{/g) || []).length;
    const closeBraces = (this.template.match(/\}\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      throw new Error('Unclosed placeholder found - mismatched {{ }}');
    }
    
    // Check for unmatched conditional sections
    const sections = new Map();
    const sectionOpenPattern = /\{\{#([^}]+)\}\}/g;
    const sectionClosePattern = /\{\{\/([^}]+)\}\}/g;
    
    let match;
    
    // Find all opening sections
    while ((match = sectionOpenPattern.exec(this.template)) !== null) {
      const sectionName = match[1].trim();
      sections.set(sectionName, (sections.get(sectionName) || 0) + 1);
    }
    
    // Find all closing sections
    while ((match = sectionClosePattern.exec(this.template)) !== null) {
      const sectionName = match[1].trim();
      sections.set(sectionName, (sections.get(sectionName) || 0) - 1);
    }
    
    // Check for unmatched sections
    for (const [sectionName, count] of sections) {
      if (count !== 0) {
        throw new Error(`Unmatched section: {{#${sectionName}}} has no corresponding {{/${sectionName}}}`);
      }
    }
    
    // Validate context variables
    const contextVarPattern = /\{\{@([^:}]+)(?::([^}]+))?\}\}/g;
    while ((match = contextVarPattern.exec(this.template)) !== null) {
      const varName = match[1];
      const contextKey = match[2];
      
      if (!contextKey || contextKey.trim().length === 0) {
        throw new Error(`Invalid context variable syntax: {{@${varName}}} should be {{@${varName}:contextKey}}`);
      }
    }
  }

  /**
   * Perform basic placeholder substitution (without content handler intelligence)
   * @param {Object} values - Values to substitute
   * @returns {string} Template with basic substitutions
   */
  substituteBasic(values) {
    if (!values || typeof values !== 'object') {
      return this.template;
    }

    let result = this.template;
    
    // Process conditional sections first
    result = this.processConditionalSections(values, result);
    
    // Process simple placeholders
    const placeholderPattern = /\{\{([^#\/}][^}]*)\}\}/g;
    
    result = result.replace(placeholderPattern, (match, placeholder) => {
      const parsed = this.parsePlaceholderOptions(placeholder);
      const value = this.getNestedValue(values, parsed.name);
      
      if (value === undefined || value === null) {
        return match; // Leave placeholder if no value
      }
      
      // Basic value formatting
      if (Array.isArray(value)) {
        return value.join(',');
      } else if (typeof value === 'object') {
        return '[object Object]'; // Will be handled by content handlers
      } else {
        return String(value);
      }
    });
    
    return result;
  }

  /**
   * Process conditional sections in template
   * @param {Object} values - Values for condition checking
   * @param {string} template - Template to process (defaults to this.template)
   * @returns {string} Template with conditional sections processed
   */
  processConditionalSections(values, template = this.template) {
    let result = template;
    let lastResult;
    
    // Keep processing until no more sections are found (handles nesting)
    do {
      lastResult = result;
      const sectionPattern = /\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/;
      
      result = result.replace(sectionPattern, (match, sectionName, sectionContent) => {
        const sectionValue = this.getNestedValue(values, sectionName.trim());
        
        // Include section if value is truthy
        if (sectionValue) {
          // Process section content with simple substitution (avoid deep recursion)
          return this._processSimpleSubstitution(sectionContent, values);
        } else {
          return ''; // Remove section if condition is false
        }
      });
    } while (result !== lastResult && result.includes('{{#'));
    
    return result;
  }

  /**
   * Simple substitution without recursive processing (for conditional sections)
   * @private
   */
  _processSimpleSubstitution(content, values) {
    const placeholderPattern = /\{\{([^#\/}][^}]*)\}\}/g;
    
    return content.replace(placeholderPattern, (match, placeholder) => {
      const parsed = this.parsePlaceholderOptions(placeholder);
      const value = this.getNestedValue(values, parsed.name);
      
      if (value === undefined || value === null) {
        return match;
      }
      
      if (Array.isArray(value)) {
        return value.join(',');
      } else if (typeof value === 'object') {
        return '[object Object]';
      } else {
        return String(value);
      }
    });
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Object to traverse
   * @param {string} path - Dot-separated path (supports array indices)
   * @returns {*} Value at path or undefined
   */
  getNestedValue(obj, path) {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Handle array indices
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/) || part.match(/^(\d+)$/);
      if (arrayMatch) {
        const index = parseInt(arrayMatch[2] || arrayMatch[1]);
        current = Array.isArray(current) ? current[index] : current[part];
      } else {
        current = current[part];
      }
    }
    
    return current;
  }

  /**
   * Estimate template complexity for optimization planning
   * @returns {Object} Complexity analysis
   */
  analyzeComplexity() {
    const placeholders = this.extractPlaceholders();
    const contextVars = placeholders.filter(p => p.startsWith('@'));
    const conditionalSections = (this.template.match(/\{\{#[^}]+\}\}/g) || []).length;
    
    return {
      totalPlaceholders: placeholders.length,
      contextVariables: contextVars.length,
      conditionalSections: conditionalSections,
      templateLength: this.template.length,
      estimatedComplexity: placeholders.length + (conditionalSections * 2) + (contextVars.length * 1.5)
    };
  }
}