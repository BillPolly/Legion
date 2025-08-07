/**
 * PromptBuilder - Template-based prompt generation with placeholder replacement
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PlanningError } from '../../../../foundation/types/errors/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Simple template engine for processing Handlebars-like syntax
 */
class TemplateEngine {
  constructor() {
    this.helpers = {
      json: (obj) => JSON.stringify(obj, null, 2),
      join: (array, separator = ', ') => Array.isArray(array) ? array.join(separator) : '',
      if: (condition, options) => condition ? options.fn(this) : options.inverse ? options.inverse(this) : '',
      each: (array, options) => {
        if (!Array.isArray(array) && typeof array !== 'object') return '';
        let result = '';
        if (Array.isArray(array)) {
          for (let i = 0; i < array.length; i++) {
            result += options.fn({ ...array[i], '@index': i });
          }
        } else {
          for (const [key, value] of Object.entries(array)) {
            result += options.fn({ ...value, '@key': key });
          }
        }
        return result;
      }
    };
  }

  /**
   * Compile and render a template with data
   * @param {string} template - Template string
   * @param {Object} data - Data to inject into template
   * @returns {string} Rendered template
   */
  render(template, data = {}) {
    let result = template;

    // Process {{#each}} blocks recursively (handle nested loops)
    while (result.includes('{{#each')) {
      const oldResult = result;
      result = result.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, 
        (match, arrayPath, innerTemplate) => {
          const array = this.getNestedValue(data, arrayPath.trim());
          if (!array) return '';

          let output = '';
          if (Array.isArray(array)) {
            for (let i = 0; i < array.length; i++) {
              const itemData = { ...data, ...array[i], '@index': i };
              // For arrays, the item context ('this') is the array item itself
              if (arrayPath.trim() === 'this') {
                itemData['this'] = array[i];
              }
              output += this.render(innerTemplate, itemData);
            }
          } else if (typeof array === 'object') {
            for (const [key, value] of Object.entries(array)) {
              const itemData = { ...data };
              if (Array.isArray(value)) {
                // If the value is an array, set 'this' to point to it for nested each
                itemData['this'] = value;
                itemData['@key'] = key;
              } else if (typeof value === 'object') {
                Object.assign(itemData, value);
                itemData['@key'] = key;
              } else {
                itemData['this'] = value;
                itemData['@key'] = key;
              }
              output += this.render(innerTemplate, itemData);
            }
          }
          return output;
        }
      );
      // Prevent infinite loops
      if (result === oldResult) break;
    }

    // Then process {{#if}} blocks  
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g, 
      (match, condition, trueBranch, falseBranch = '') => {
        const value = this.getNestedValue(data, condition.trim());
        return value ? trueBranch : falseBranch;
      }
    );

    // Finally process simple {{variable}} replacements including helpers
    result = result.replace(/\{\{([^#\/][^}]*)\}\}/g, (match, expression) => {
      const trimmed = expression.trim();
      
      // Handle negation with !
      if (trimmed.startsWith('!')) {
        const key = trimmed.substring(1);
        const value = this.getNestedValue(data, key);
        return !value ? 'true' : '';
      }
      
      // Handle helper functions like {{json obj}} or {{join array ", "}}
      const helperMatch = trimmed.match(/^(\w+)\s+(.+)$/);
      if (helperMatch) {
        const [, helperName, args] = helperMatch;
        if (this.helpers[helperName]) {
          // Parse arguments - simple implementation for json and join
          if (helperName === 'json') {
            const value = this.getNestedValue(data, args);
            return this.helpers.json(value);
          } else if (helperName === 'join') {
            const parts = args.split(' ');
            const arrayPath = parts[0];
            const separator = parts.slice(1).join(' ').replace(/['"]/g, ''); // Remove quotes
            const array = this.getNestedValue(data, arrayPath);
            return this.helpers.join(array, separator);
          }
        }
      }
      
      const value = this.getNestedValue(data, trimmed);
      return value !== undefined && value !== null ? String(value) : '';
    });

    return result;
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Source object
   * @param {string} path - Dot-separated path
   * @returns {any} Value or undefined
   */
  getNestedValue(obj, path) {
    if (path === 'this') {
      return obj['this'] || obj;
    }
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : '';
    }, obj);
  }
}

/**
 * Template-based prompt builder
 */
export class PromptBuilder {
  constructor(options = {}) {
    this.templateEngine = new TemplateEngine();
    this.templatesDir = options.templatesDir || join(__dirname, 'templates');
    this.cache = new Map();
    this.debugMode = options.debugMode || false;
  }

  /**
   * Build planning prompt using template
   * @param {string} goal - Goal to achieve
   * @param {Array} tools - Available tools
   * @param {Object} context - Additional context
   * @returns {string} Rendered prompt
   */
  buildPlanningPrompt(goal, tools, context = {}) {
    const templateData = {
      goal,
      toolDescriptions: this.formatToolDescriptions(tools),
      context: this.formatContext(context),
      examples: context.examples ? this.formatExamples(context.examples) : null,
      validationFeedback: context.validationErrors ? this.formatValidationFeedback(context.validationErrors, tools) : null
    };

    return this.renderTemplate('planning.md', templateData);
  }

  /**
   * Build fix plan prompt using template
   * @param {string} goal - Original goal
   * @param {Array} invalidPlan - Invalid plan
   * @param {Array} validationErrors - Validation errors
   * @param {Array} tools - Available tools
   * @param {Object} context - Original planning context
   * @returns {string} Rendered prompt
   */
  buildFixPrompt(goal, invalidPlan, validationErrors, tools, context = {}) {
    const errorsByStep = this.groupErrorsByStep(validationErrors);
    const toolsWithMetadata = this.getToolsWithMetadata(tools);

    const templateData = {
      goal,
      invalidPlan: JSON.stringify(invalidPlan, null, 2),
      errorsByStep,
      tools: toolsWithMetadata,
      context: this.formatContext(context)
    };

    return this.renderTemplate('fix-plan.md', templateData);
  }

  /**
   * Build replanning prompt using template
   * @param {Array} currentPlan - Current plan
   * @param {Object} failedStep - Failed step
   * @param {Object} context - Planning context
   * @returns {string} Rendered prompt
   */
  buildReplanningPrompt(currentPlan, failedStep, context) {
    const completedSteps = currentPlan.filter(s => s.status === 'done');
    const remainingSteps = currentPlan.filter(s => s.status === 'pending');

    const templateData = {
      goal: context.goal,
      tools: context.tools,
      completedSteps,
      failedStep,
      remainingSteps
    };

    return this.renderTemplate('replanning.md', templateData);
  }

  /**
   * Render a template with data
   * @param {string} templateName - Template filename
   * @param {Object} data - Data to inject
   * @returns {string} Rendered template
   */
  renderTemplate(templateName, data) {
    try {
      const template = this.loadTemplate(templateName);
      const rendered = this.templateEngine.render(template, data);
      
      if (this.debugMode) {
        console.log(`[PromptBuilder] Rendered template ${templateName} with data keys: ${Object.keys(data).join(', ')}`);
      }
      
      return rendered;
    } catch (error) {
      throw new PlanningError(`Failed to render template ${templateName}: ${error.message}`);
    }
  }

  /**
   * Load template from file system with caching
   * @param {string} templateName - Template filename
   * @returns {string} Template content
   */
  loadTemplate(templateName) {
    if (this.cache.has(templateName)) {
      return this.cache.get(templateName);
    }

    try {
      const templatePath = join(this.templatesDir, templateName);
      const content = readFileSync(templatePath, 'utf-8');
      this.cache.set(templateName, content);
      return content;
    } catch (error) {
      throw new PlanningError(`Failed to load template ${templateName}: ${error.message}`);
    }
  }

  /**
   * Format tool descriptions for template
   * @param {Array} tools - Available tools
   * @returns {string} Formatted tool descriptions
   */
  formatToolDescriptions(tools) {
    return tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
  }

  /**
   * Format context for template
   * @param {Object} context - Context object
   * @returns {string} Formatted context
   */
  formatContext(context) {
    // Filter out template-specific fields
    const filteredContext = { ...context };
    delete filteredContext.examples;
    delete filteredContext.validationErrors;
    delete filteredContext.fixPrompt;
    delete filteredContext.isFixing;
    delete filteredContext.invalidPlan;

    return JSON.stringify(filteredContext, null, 2);
  }

  /**
   * Format examples for template
   * @param {Array} examples - Planning examples
   * @returns {string} Formatted examples
   */
  formatExamples(examples) {
    if (!examples || examples.length === 0) return '';
    
    let exampleSection = '';
    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      exampleSection += `\nExample ${i + 1}:\nGoal: ${example.goal}\nPlan: ${JSON.stringify(example.plan, null, 2)}\n`;
    }
    
    return exampleSection;
  }

  /**
   * Format validation feedback for template
   * @param {Array} validationErrors - Validation errors
   * @param {Array} tools - Available tools
   * @returns {string} Formatted validation feedback
   */
  formatValidationFeedback(validationErrors, tools) {
    let feedback = '';
    
    // Group errors by type
    const errorsByType = {};
    for (const error of validationErrors) {
      if (!errorsByType[error.type]) {
        errorsByType[error.type] = [];
      }
      errorsByType[error.type].push(error);
    }
    
    // Format errors by type
    for (const [errorType, errors] of Object.entries(errorsByType)) {
      feedback += `### ${this.formatErrorType(errorType)}\n`;
      
      for (const error of errors.slice(0, 5)) { // Limit to 5 per type
        feedback += `- Step "${error.stepId}": ${error.message}\n`;
        
        if (error.details) {
          if (error.details.availableTools) {
            feedback += `  Available tools: ${error.details.availableTools.join(', ')}\n`;
          }
          if (error.details.availableArtifacts) {
            feedback += `  Available artifacts: ${error.details.availableArtifacts.map(a => '@' + a).join(', ')}\n`;
          }
          if (error.details.parameter) {
            feedback += `  Problem parameter: ${error.details.parameter}\n`;
          }
          if (error.details.expectedType) {
            feedback += `  Expected type: ${error.details.expectedType}\n`;
          }
        }
      }
      feedback += '\n';
    }

    // Add tool reference if there were tool-related errors
    if (errorsByType['TOOL_NOT_FOUND'] || errorsByType['MISSING_PARAMETER'] || errorsByType['INVALID_OUTPUT_FIELD']) {
      feedback += '### Tool Reference\n';
      feedback += 'Here are the correct tool specifications:\n\n';
      
      for (const tool of tools.slice(0, 10)) {
        const metadata = this.getToolMetadata(tool);
        feedback += `**${metadata.name}**: ${metadata.description}\n`;
        if (metadata.input) {
          feedback += `  Input: ${JSON.stringify(metadata.input, null, 2)}\n`;
        }
        if (metadata.output) {
          feedback += `  Output: ${JSON.stringify(metadata.output, null, 2)}\n`;
        }
      }
    }
    
    return feedback;
  }

  /**
   * Group validation errors by step
   * @param {Array} validationErrors - Validation errors
   * @returns {Object} Errors grouped by step ID
   */
  groupErrorsByStep(validationErrors) {
    const errorsByStep = {};
    for (const error of validationErrors) {
      const stepId = error.stepId || 'general';
      if (!errorsByStep[stepId]) {
        errorsByStep[stepId] = [];
      }
      errorsByStep[stepId].push(error);
    }
    return errorsByStep;
  }

  /**
   * Get tools with metadata for templates
   * @param {Array} tools - Available tools
   * @returns {Array} Tools with metadata
   */
  getToolsWithMetadata(tools) {
    return tools.slice(0, 10).map(tool => this.getToolMetadata(tool));
  }

  /**
   * Get tool metadata safely
   * @param {Object} tool - Tool object
   * @returns {Object} Tool metadata
   */
  getToolMetadata(tool) {
    let metadata = { name: tool.name, description: tool.description };
    
    if (tool.getMetadata && typeof tool.getMetadata === 'function') {
      try {
        metadata = tool.getMetadata();
      } catch (e) {
        // Use basic metadata if getMetadata fails
      }
    }
    
    return metadata;
  }

  /**
   * Format error type for display
   * @param {string} errorType - Error type constant
   * @returns {string} Formatted error type
   */
  formatErrorType(errorType) {
    const typeMap = {
      'TOOL_NOT_FOUND': 'Tool Not Found',
      'ARTIFACT_NOT_FOUND': 'Artifact Reference Error',
      'MISSING_PARAMETER': 'Missing Required Parameters',
      'INVALID_OUTPUT_FIELD': 'Invalid Output Field for Saving',
      'INVALID_DEPENDENCY': 'Invalid Step Dependencies',
      'DUPLICATE_ARTIFACT_NAME': 'Duplicate Artifact Names',
      'TYPE_MISMATCH': 'Parameter Type Mismatch',
      'CIRCULAR_DEPENDENCY': 'Circular Dependencies',
      'INVALID_STEP_STRUCTURE': 'Invalid Step Structure'
    };
    
    return typeMap[errorType] || errorType;
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Set debug mode
   * @param {boolean} enabled - Enable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }
}