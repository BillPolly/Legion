/**
 * Prompt - Reusable template loading and substitution
 * 
 * Handles loading templates from files or strings and filling them
 * with provided values. Includes special formatting for common data types.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class Prompt {
  /**
   * Create a prompt handler that loads and fills templates
   */
  constructor() {
    // Load the standard templates on construction
    const promptsDir = join(__dirname, '..', 'prompts');
    this.createPlanTemplate = this._loadFromFile(join(promptsDir, 'create-plan.md'));
    this.fixPlanTemplate = this._loadFromFile(join(promptsDir, 'fix-plan.md'));
  }
  
  /**
   * Get the initial planning prompt
   * @param {string} requirements - Task description
   * @param {Array} tools - Available tools
   * @returns {string} Filled prompt string
   */
  getInitialPrompt(requirements, tools) {
    const values = {
      TASK_DESCRIPTION: requirements,
      TOOLS: tools
    };
    
    return this._fillTemplate(this.createPlanTemplate, values);
  }
  
  /**
   * Get the fix prompt for retry attempts
   * @param {string} requirements - Task description
   * @param {Array} tools - Available tools
   * @param {Object} failedPlan - The plan that failed validation
   * @param {Object} validation - Validation result object with errors array
   * @returns {string} Filled prompt string
   */
  getFixPrompt(requirements, tools, failedPlan, validation) {
    const values = {
      TASK_DESCRIPTION: requirements,
      TOOLS: tools,
      FAILED_PLAN: JSON.stringify(failedPlan, null, 2),
      ERRORS: validation.errors  // Pass the errors array from validation object
    };
    return this._fillTemplate(this.fixPlanTemplate, values);
  }
  
  /**
   * Load template from file
   */
  _loadFromFile(filePath) {
    try {
      return readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to load template from ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Fill a template with values
   */
  _fillTemplate(template, values) {
    let result = template;
    
    // Replace each variable
    for (const [key, value] of Object.entries(values)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      
      if (Array.isArray(value)) {
        // Special handling for arrays
        result = result.replace(pattern, this._formatArray(value, key));
      } else if (typeof value === 'object' && value !== null) {
        // Objects as JSON
        result = result.replace(pattern, JSON.stringify(value, null, 2));
      } else {
        // Simple replacement
        result = result.replace(pattern, String(value));
      }
    }
    
    return result;
  }
  
  /**
   * Format array values based on context
   */
  _formatArray(array, key) {
    // Special formatting for known array types
    switch (key) {
      case 'TOOLS':
        return this._formatTools(array);
      case 'ERRORS':
        return this._formatErrors(array);
      default:
        // Default: JSON array
        return JSON.stringify(array, null, 2);
    }
  }
  
  /**
   * Format tools array for prompt
   */
  _formatTools(tools) {
    return tools.map(tool => {
      // Extract tool information from various formats
      const name = tool.name || tool.type;
      const description = tool.description || '';
      
      // Extract inputs from various formats
      const inputs = this._extractToolInputs(tool);
      const outputs = this._extractToolOutputs(tool);
      
      // Build formatted text
      let text = `### ${name}\n`;
      text += `Description: ${description}\n`;
      
      if (inputs.length > 0) {
        text += `Inputs:\n`;
        inputs.forEach(input => {
          text += `  - ${input.name} (${input.type || 'any'}): ${input.description || ''}\n`;
        });
      } else {
        text += `Inputs: None\n`;
      }
      
      if (outputs.length > 0) {
        text += `Outputs: ${outputs.map(o => o.name).join(', ')}\n`;
      }
      
      return text;
    }).join('\n');
  }
  
  /**
   * Extract inputs from tool definition
   */
  _extractToolInputs(tool) {
    // Direct inputs array
    if (tool.inputs) {
      return tool.inputs;
    }
    
    // From inputSchema
    if (tool.inputSchema?.properties) {
      return Object.entries(tool.inputSchema.properties).map(([name, spec]) => ({
        name,
        type: spec.type || 'any',
        description: spec.description || '',
        required: tool.inputSchema.required?.includes(name) || false
      }));
    }
    
    // From schema (legacy)
    if (tool.schema?.properties) {
      return Object.entries(tool.schema.properties).map(([name, spec]) => ({
        name,
        type: spec.type || 'any',
        description: spec.description || '',
        required: tool.schema.required?.includes(name) || false
      }));
    }
    
    return [];
  }
  
  /**
   * Extract outputs from tool definition - ONLY actual data fields
   */
  _extractToolOutputs(tool) {
    // For specific tools, define their actual data output field names
    const toolOutputMappings = {
      'directory_create': ['dirpath', 'created'],
      'file_write': ['filepath', 'bytesWritten', 'created'],
      'file_writer': ['filepath', 'bytesWritten', 'created'],  // Support both names
      'file_read': ['content', 'filepath', 'size'],
      'file_reader': ['content', 'filepath', 'size']  // Support both names
    };

    // Use specific mappings if available
    if (toolOutputMappings[tool.name]) {
      return toolOutputMappings[tool.name].map(name => ({ name }));
    }
    
    // Direct outputs array
    if (tool.outputs) {
      return tool.outputs;
    }
    
    // From outputSchema - extract SUCCESS format ONLY
    if (tool.outputSchema?.success?.properties) {
      return Object.keys(tool.outputSchema.success.properties).map(name => ({ name }));
    }
    
    // If tool has no specific output schema, don't show outputs
    return [];
  }
  
  /**
   * Format errors array for prompt
   */
  _formatErrors(errors) {
    return errors.map(err => {
      let text = `- **${err.type}** in node \`${err.nodeId || 'unknown'}\`: ${err.message}`;
      if (err.suggestion) {
        text += `\n  💡 Suggestion: ${err.suggestion}`;
      }
      return text;
    }).join('\n');
  }
  
}