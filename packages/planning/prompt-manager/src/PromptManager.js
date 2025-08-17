/**
 * PromptManager - Template-based prompt management for LLM interactions
 */

import fs from 'fs/promises';
import path from 'path';

export class PromptManager {
  constructor(templatesDir = undefined) {
    if (templatesDir === '') {
      throw new Error('Templates directory is required');
    }
    
    if (templatesDir === null || (templatesDir !== undefined && typeof templatesDir !== 'string')) {
      throw new Error('Templates directory is required');
    }
    
    this.templatesDir = templatesDir || path.join(process.cwd(), 'templates');
    this.templateCache = new Map();
    this.builtInTemplates = new Map();
  }

  /**
   * Load a template from file
   * @param {string} templateName - Name of the template (with or without .md extension)
   * @returns {Promise<string>} Template content
   */
  async loadTemplate(templateName) {
    // Remove .md extension if present
    const baseName = templateName.endsWith('.md') 
      ? templateName.slice(0, -3) 
      : templateName;
    
    // Check cache first
    if (this.templateCache.has(baseName)) {
      return this.templateCache.get(baseName);
    }
    
    // Try to load from file first (files take precedence over built-in)
    const templatePath = path.join(this.templatesDir, `${baseName}.md`);
    
    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      this.templateCache.set(baseName, content);
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Check built-in templates as fallback
        if (this.builtInTemplates.has(baseName)) {
          const template = this.builtInTemplates.get(baseName);
          this.templateCache.set(baseName, template);
          return template;
        }
        throw new Error(`Template not found: ${baseName}`);
      }
      throw new Error(`Failed to load template ${baseName}: ${error.message}`);
    }
  }

  /**
   * Render a template with parameters
   * @param {string} templateName - Name of the template
   * @param {Object} parameters - Parameters to fill placeholders
   * @returns {Promise<string>} Rendered template
   */
  async render(templateName, parameters = {}) {
    if (parameters === null || parameters === undefined) {
      parameters = {};
    }
    
    if (typeof parameters !== 'object' || Array.isArray(parameters)) {
      throw new Error('Parameters must be an object');
    }
    
    const template = await this.loadTemplate(templateName);
    return this.renderTemplate(template, parameters);
  }

  /**
   * Render a template string with parameters
   * @private
   */
  renderTemplate(template, parameters) {
    let result = template;
    
    // Handle helper functions
    result = this.applyHelpers(result, parameters);
    
    // Handle array/conditional sections {{#array}}...{{/array}}
    result = this.handleSections(result, parameters);
    
    // Handle nested object access (e.g., {{user.name}})
    result = this.handleNestedAccess(result, parameters);
    
    // Handle simple placeholders {{name}}
    result = this.handleSimplePlaceholders(result, parameters);
    
    return result;
  }

  /**
   * Apply helper functions like {{json data}}, {{upper name}}
   * @private
   */
  applyHelpers(template, parameters) {
    let result = template;
    
    // JSON helper
    result = result.replace(/\{\{json\s+([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(parameters, key.trim());
      return value !== undefined ? JSON.stringify(value) : '';
    });
    
    // Uppercase helper
    result = result.replace(/\{\{upper\s+([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(parameters, key.trim());
      return value !== undefined ? String(value).toUpperCase() : '';
    });
    
    // Lowercase helper
    result = result.replace(/\{\{lower\s+([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(parameters, key.trim());
      return value !== undefined ? String(value).toLowerCase() : '';
    });
    
    // Join helper
    result = result.replace(/\{\{join\s+([^,\s]+)\s*,?\s*"([^"]*)"\}\}/g, (match, key, separator) => {
      const value = this.getNestedValue(parameters, key.trim());
      if (Array.isArray(value)) {
        return value.join(separator || ', ');
      }
      return '';
    });
    
    return result;
  }

  /**
   * Handle array/conditional sections
   * @private
   */
  handleSections(template, parameters) {
    let result = template;
    
    // Match sections like {{#items}}...{{/items}}
    const sectionRegex = /\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    
    result = result.replace(sectionRegex, (match, key, content) => {
      const value = this.getNestedValue(parameters, key.trim());
      
      // If value is falsy, remove the section
      if (!value) {
        return '';
      }
      
      // If value is true (boolean), just include the content
      if (value === true) {
        return this.renderTemplate(content, parameters);
      }
      
      // If value is an array, iterate and render each item
      if (Array.isArray(value)) {
        return value.map(item => {
          // Create context with item and parent parameters
          const context = { ...parameters };
          
          // If item is an object, merge it with context
          if (typeof item === 'object' && item !== null) {
            Object.assign(context, item);
          } else {
            // For primitive values, make it available as {{.}}
            context['.'] = item;
          }
          
          return this.renderTemplate(content, context);
        }).join('');
      }
      
      // For other truthy values, just include the content
      return this.renderTemplate(content, parameters);
    });
    
    return result;
  }

  /**
   * Handle nested object access
   * @private
   */
  handleNestedAccess(template, parameters) {
    // Match {{path.to.value}} but not helpers or sections
    const nestedRegex = /\{\{([^#\/][^}]*\.[^}]+)\}\}/g;
    
    return template.replace(nestedRegex, (match, path) => {
      const value = this.getNestedValue(parameters, path.trim());
      return value !== undefined ? String(value) : '';
    });
  }

  /**
   * Handle simple placeholders
   * @private
   */
  handleSimplePlaceholders(template, parameters) {
    // Match simple {{key}} placeholders
    const simpleRegex = /\{\{([^#\/}][^}.]*)\}\}/g;
    
    return template.replace(simpleRegex, (match, key) => {
      const trimmedKey = key.trim();
      
      // Skip if it's a helper (contains space) or already processed
      if (trimmedKey.includes(' ')) {
        return match;
      }
      
      const value = this.getNestedValue(parameters, trimmedKey);
      return value !== undefined ? String(value) : '';
    });
  }

  /**
   * Get nested value from object
   * @private
   */
  getNestedValue(obj, path) {
    if (path === '.') {
      return obj['.'];
    }
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Validate template syntax
   * @param {string} templateName - Name of the template
   * @returns {Promise<boolean>} True if valid
   */
  async validateTemplate(templateName) {
    const template = await this.loadTemplate(templateName);
    
    // Check for unclosed placeholders
    const openCount = (template.match(/\{\{/g) || []).length;
    const closeCount = (template.match(/\}\}/g) || []).length;
    
    if (openCount !== closeCount) {
      throw new Error('Invalid template syntax: mismatched brackets');
    }
    
    // Check for unclosed sections
    const sectionMatches = template.matchAll(/\{\{#([^}]+)\}\}/g);
    for (const match of sectionMatches) {
      const sectionName = match[1];
      const endTag = `{{/${sectionName}}}`;
      if (!template.includes(endTag)) {
        throw new Error(`Invalid template syntax: unclosed section {{#${sectionName}}}`);
      }
    }
    
    return true;
  }

  /**
   * Extract placeholder names from template
   * @param {string} templateName - Name of the template
   * @returns {Promise<Array<string>>} List of placeholder names
   */
  async extractPlaceholders(templateName) {
    const template = await this.loadTemplate(templateName);
    const placeholders = new Set();
    
    // Extract simple placeholders
    const simpleRegex = /\{\{([^#\/}][^}]*)\}\}/g;
    let match;
    while ((match = simpleRegex.exec(template)) !== null) {
      const placeholder = match[1].trim();
      
      // Skip helpers
      if (!placeholder.includes(' ')) {
        placeholders.add(placeholder);
      } else {
        // For helpers, extract the parameter
        const parts = placeholder.split(/\s+/);
        if (parts.length > 1) {
          placeholders.add(parts[1]);
        }
      }
    }
    
    // Extract section names
    const sectionRegex = /\{\{#([^}]+)\}\}/g;
    while ((match = sectionRegex.exec(template)) !== null) {
      placeholders.add(match[1].trim());
    }
    
    return Array.from(placeholders);
  }

  /**
   * Register a built-in template
   * @param {string} name - Template name
   * @param {string} content - Template content
   */
  registerBuiltInTemplate(name, content) {
    this.builtInTemplates.set(name, content);
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.templateCache.clear();
  }
}