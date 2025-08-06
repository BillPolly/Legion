/**
 * PromptTemplateLoader - Utility for loading and processing prompt templates
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PromptTemplateLoader {
  constructor(templatesDir = null) {
    // Default to prompts directory relative to this file
    this.templatesDir = templatesDir || path.join(__dirname, '..', 'prompts');
  }

  /**
   * Load a template file and substitute variables
   * @param {string} templateName - Name of the template file (without .md extension)
   * @param {Object} variables - Variables to substitute in the template
   * @returns {Promise<string>} The processed template content
   */
  async loadTemplate(templateName, variables = {}) {
    const templatePath = path.join(this.templatesDir, `${templateName}.md`);
    
    try {
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      return this.processTemplate(templateContent, variables);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Template file not found: ${templatePath}`);
      }
      throw new Error(`Failed to load template: ${error.message}`);
    }
  }

  /**
   * Process template content by substituting variables
   * @param {string} content - Template content
   * @param {Object} variables - Variables to substitute
   * @returns {string} Processed content
   */
  processTemplate(content, variables = {}) {
    let processed = content;

    // Replace {{variable}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const stringValue = this.formatValue(value);
      processed = processed.replaceAll(placeholder, stringValue);
    }

    // Check for any remaining unsubstituted placeholders
    const remainingPlaceholders = processed.match(/{{\s*\w+\s*}}/g);
    if (remainingPlaceholders) {
      console.warn(`Warning: Unsubstituted placeholders found: ${remainingPlaceholders.join(', ')}`);
    }

    return processed;
  }

  /**
   * Format a value for template substitution
   * @param {*} value - Value to format
   * @returns {string} Formatted value
   */
  formatValue(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    if (typeof value === 'object' && value !== null) {
      // For complex objects, try to format nicely
      if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
        return value.toString();
      }
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }

  /**
   * Format allowable actions for template display
   * @param {Array} allowableActions - Array of action definitions
   * @returns {string} Formatted actions list
   */
  formatAllowableActions(allowableActions) {
    return allowableActions.map(action => {
      // Build detailed action description
      let description = `- **${action.type}**: ${action.description || ''}`;
      
      // Add input schema details
      if (action.inputSchema) {
        const inputDetails = [];
        for (const [key, schema] of Object.entries(action.inputSchema.properties || {})) {
          const required = action.inputSchema.required?.includes(key) ? ' (required)' : '';
          inputDetails.push(`    ${key}: ${schema.type || 'string'}${required} - ${schema.description || ''}`);
        }
        if (inputDetails.length > 0) {
          description += '\n  Inputs:\n' + inputDetails.join('\n');
        }
      } else if (action.inputs) {
        description += `\n  Inputs: ${action.inputs.join(', ')}`;
      }

      // Add output schema details  
      if (action.outputSchema) {
        const outputDetails = [];
        for (const [key, schema] of Object.entries(action.outputSchema.properties || {})) {
          outputDetails.push(`    ${key}: ${schema.type || 'string'} - ${schema.description || ''}`);
        }
        if (outputDetails.length > 0) {
          description += '\n  Outputs:\n' + outputDetails.join('\n');
        }
      } else if (action.outputs) {
        description += `\n  Outputs: ${action.outputs.join(', ')}`;
      }

      // Add examples if available
      if (action.examples && action.examples.length > 0) {
        const example = action.examples[0];
        description += `\n  Example: ${example.description || 'Usage'}\n    ${JSON.stringify(example.parameters || example.inputs, null, 4)}`;
      }

      return description;
    }).join('\n\n');
  }

  /**
   * Format validation errors for template display
   * @param {Array} errors - Array of validation error strings
   * @returns {string} Formatted errors list
   */
  formatValidationErrors(errors) {
    return errors.map((error, index) => `${index + 1}. ${error}`).join('\n');
  }

  /**
   * Load the create-plan template with proper formatting
   * @param {Object} params - Template parameters
   * @returns {Promise<string>} Processed template
   */
  async loadCreatePlanTemplate(params) {
    const {
      description,
      inputs = [],
      requiredOutputs = [],
      allowableActions = [],
      maxSteps = 20
    } = params;

    const variables = {
      description,
      inputs: inputs.join(', '),
      requiredOutputs: requiredOutputs.join(', '),
      maxSteps,
      actionsList: this.formatAllowableActions(allowableActions)
    };

    return this.loadTemplate('create-plan', variables);
  }

  /**
   * Load the fix-plan template with proper formatting
   * @param {Object} params - Template parameters  
   * @returns {Promise<string>} Processed template
   */
  async loadFixPlanTemplate(params) {
    const {
      description,
      inputs = [],
      requiredOutputs = [],
      allowableActions = [],
      maxSteps = 20,
      failedPlan,
      validationErrors = []
    } = params;

    const variables = {
      description,
      inputs: inputs.join(', '),
      requiredOutputs: requiredOutputs.join(', '), 
      maxSteps,
      actionsList: this.formatAllowableActions(allowableActions),
      failedPlan: JSON.stringify(failedPlan, null, 2),
      validationErrors: this.formatValidationErrors(validationErrors)
    };

    return this.loadTemplate('fix-plan', variables);
  }
}

export { PromptTemplateLoader };