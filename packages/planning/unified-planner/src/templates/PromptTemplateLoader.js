/**
 * PromptTemplateLoader - Template system for LLM prompts
 * 
 * Adapted from llm-planner with BT focus.
 * Loads and processes prompt templates for BT generation.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PromptTemplateLoader {
  constructor(templatesDir = null) {
    // Default to prompts directory relative to this file
    this.templatesDir = templatesDir || path.join(__dirname, 'prompts');
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
   * Format allowable actions for BT template display
   * @param {Array} allowableActions - Array of action definitions
   * @returns {string} Formatted actions list
   */
  formatAllowableActions(allowableActions) {
    return allowableActions.map(action => {
      // Build detailed action description for BT context
      let description = `- **${action.type || action.toolName || action.name}**: ${action.description || ''}`;
      
      // Add input schema details
      if (action.inputSchema && action.inputSchema.properties) {
        const inputDetails = [];
        for (const [key, schema] of Object.entries(action.inputSchema.properties)) {
          const required = action.inputSchema.required?.includes(key) ? ' (required)' : '';
          inputDetails.push(`    ${key}: ${schema.type || 'string'}${required} - ${schema.description || ''}`);
        }
        if (inputDetails.length > 0) {
          description += '\\n  Parameters:\\n' + inputDetails.join('\\n');
        }
      } else if (action.inputs) {
        description += `\\n  Parameters: ${action.inputs.join(', ')}`;
      }

      // Add output schema details  
      if (action.outputSchema && action.outputSchema.properties) {
        const outputDetails = [];
        for (const [key, schema] of Object.entries(action.outputSchema.properties)) {
          outputDetails.push(`    ${key}: ${schema.type || 'string'} - ${schema.description || ''}`);
        }
        if (outputDetails.length > 0) {
          description += '\\n  Returns:\\n' + outputDetails.join('\\n');
        }
      } else if (action.outputs) {
        description += `\\n  Returns: ${action.outputs.join(', ')}`;
      }

      // Add examples if available
      if (action.examples && action.examples.length > 0) {
        const example = action.examples[0];
        description += `\\n  Example: ${example.description || 'Usage'}\\n    ${JSON.stringify(example.parameters || example.inputs, null, 4)}`;
      }

      return description;
    }).join('\\n\\n');
  }

  /**
   * Format validation errors for template display
   * @param {Array} errors - Array of validation error strings or objects
   * @returns {string} Formatted errors list
   */
  formatValidationErrors(errors) {
    return errors.map((error, index) => {
      const message = typeof error === 'string' ? error : error.message;
      return `${index + 1}. ${message}`;
    }).join('\\n');
  }

  /**
   * Load the create-bt-plan template with proper formatting
   * @param {Object} params - Template parameters
   * @returns {Promise<string>} Processed template
   */
  async loadCreateBTTemplate(params) {
    const {
      description,
      inputs = [],
      requiredOutputs = [],
      allowableActions = [],
      maxSteps = 20
    } = params;

    const variables = {
      description,
      inputs: inputs.join(', ') || 'none',
      requiredOutputs: requiredOutputs.join(', ') || 'none',
      maxSteps,
      actionsList: this.formatAllowableActions(allowableActions)
    };

    return this.loadTemplate('create-bt-plan', variables);
  }

  /**
   * Load the fix-bt-plan template with proper formatting
   * @param {Object} params - Template parameters  
   * @returns {Promise<string>} Processed template
   */
  async loadFixBTTemplate(params) {
    const {
      description,
      inputs = [],
      requiredOutputs = [],
      allowableActions = [],
      maxSteps = 20,
      failedBT,
      validationErrors = []
    } = params;

    const variables = {
      description,
      inputs: inputs.join(', ') || 'none',
      requiredOutputs: requiredOutputs.join(', ') || 'none', 
      maxSteps,
      actionsList: this.formatAllowableActions(allowableActions),
      failedBT: JSON.stringify(failedBT, null, 2),
      validationErrors: this.formatValidationErrors(validationErrors)
    };

    return this.loadTemplate('fix-bt-plan', variables);
  }

  /**
   * Create default template directory and files
   * @returns {Promise<void>}
   */
  async createDefaultTemplates() {
    try {
      // Ensure templates directory exists
      await fs.mkdir(this.templatesDir, { recursive: true });
      
      // Create create-bt-plan template
      const createBTTemplate = await this.getDefaultCreateBTTemplate();
      await fs.writeFile(
        path.join(this.templatesDir, 'create-bt-plan.md'),
        createBTTemplate
      );
      
      // Create fix-bt-plan template
      const fixBTTemplate = await this.getDefaultFixBTTemplate();
      await fs.writeFile(
        path.join(this.templatesDir, 'fix-bt-plan.md'),
        fixBTTemplate
      );
      
      console.log(`Created default templates in: ${this.templatesDir}`);
      
    } catch (error) {
      throw new Error(`Failed to create default templates: ${error.message}`);
    }
  }

  /**
   * Get default create-bt-plan template
   * @returns {string} Template content
   */
  async getDefaultCreateBTTemplate() {
    return `Create a Behavior Tree (BT) structure for: {{description}}

REQUIREMENTS:
- Available inputs: {{inputs}}
- Required outputs: {{requiredOutputs}}
- Maximum steps: {{maxSteps}}

ALLOWABLE ACTIONS (you MUST only use these exact action types):
{{actionsList}}

BT STRUCTURE:
Create a hierarchical Behavior Tree with these node types:
- **sequence**: Execute children in order, stop on first failure
- **selector**: Execute children until first success (fallback)
- **parallel**: Execute children concurrently  
- **action**: Execute a tool with parameters
- **retry**: Retry child node on failure

Each node must have:
- type: One of the above node types
- id: Unique identifier (use descriptive names)
- description: Human-readable description
- For composite nodes: children array
- For action nodes: tool (exact match from allowable actions) and params object
- For retry nodes: child object and maxRetries number

BT DESIGN PRINCIPLES:
- Use sequence for ordered execution that must succeed
- Use selector for fallback strategies when primary approach might fail
- Use parallel for independent concurrent tasks
- Use retry for unreliable operations that might need multiple attempts
- Use action nodes only with tools from allowable actions list
- Make node IDs descriptive: "fetch_user_data", "validate_input", etc.
- Ensure proper parameter flow between actions

CRITICAL REQUIREMENTS:
- Each action MUST use a tool name that exactly matches the allowable actions
- Parameter names must match the tool's expected input schema
- The BT must be executable without missing dependencies
- All required outputs must be produced by the BT execution

Return a JSON object with this structure:
{
  "type": "sequence|selector|parallel|retry",
  "id": "descriptive-root-id",
  "description": "What this BT accomplishes",
  "children": [
    {
      "type": "action",
      "id": "descriptive-action-id", 
      "tool": "exact-tool-name-from-allowable-actions",
      "description": "What this action does",
      "params": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ]
}

Generate a complete, executable BT structure that achieves the goal using only the allowable actions.`;
  }

  /**
   * Get default fix-bt-plan template
   * @returns {string} Template content
   */
  async getDefaultFixBTTemplate() {
    return `RETRY: Create a corrected Behavior Tree structure for: {{description}}

The previous BT generation failed with these validation errors:
{{validationErrors}}

FAILED BT:
{{failedBT}}

REQUIREMENTS:
- Available inputs: {{inputs}}
- Required outputs: {{requiredOutputs}}
- Maximum steps: {{maxSteps}}

ALLOWABLE ACTIONS (you MUST only use these exact action types):
{{actionsList}}

CORRECTIONS NEEDED:
Please analyze the validation errors above and create a corrected BT that:

1. **Fixes all validation errors** - Address each specific error mentioned
2. **Uses only allowable actions** - Every tool name must exactly match the list above
3. **Has proper BT structure** - Valid node types with required fields
4. **Includes all required fields** - Every node needs id, type, description
5. **Uses correct parameter formats** - Match the expected input schemas
6. **Maintains the goal** - Still achieves the original objective

COMMON FIXES:
- If "tool not found": Use exact tool names from allowable actions list
- If "missing required field": Add id, type, or description fields
- If "invalid node type": Use sequence, selector, parallel, action, or retry
- If "parameter validation failed": Check parameter names and types against tool schemas
- If "duplicate node ID": Make all node IDs unique and descriptive

Return a corrected JSON BT structure following the same format as the original request.
Focus on fixing the specific validation errors while maintaining the overall goal and approach.

The corrected BT structure:`;
  }
}