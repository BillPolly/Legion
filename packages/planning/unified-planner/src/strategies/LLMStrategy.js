/**
 * LLMStrategy - LLM-based BT generation strategy
 * 
 * Combines the best features from llm-planner and recursive-planner:
 * - Template-based prompting from llm-planner
 * - Robust JSON parsing and error handling
 * - Direct BT structure generation
 * - Retry with failure context
 */

import { PlanningStrategy } from './PlanningStrategy.js';
import JSON5 from 'json5';

export class LLMStrategy extends PlanningStrategy {
  constructor(llmClient, options = {}) {
    super(options);
    
    if (!llmClient) {
      throw new Error('LLMStrategy requires an LLM client');
    }
    
    this.llmClient = llmClient;
    this.templateLoader = options.templateLoader;
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.temperature = options.temperature || 0.3;
    this.maxTokens = options.maxTokens || 2000;
    this.examples = options.examples || [];
  }

  /**
   * Generate BT structure using LLM reasoning
   * @param {PlanningRequest} request - Planning request
   * @param {Object} context - Generation context
   * @returns {Promise<Object>} Generated BT structure
   */
  async generateBT(request, context = {}) {
    this.debug(`Generating BT for: ${request.description.substring(0, 50)}...`);
    
    try {
      // Build prompt for BT generation
      const prompt = await this.buildBTPrompt(request, context);
      
      // Call LLM
      const response = await this.llmClient.complete(prompt, {
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens
      });
      
      if (this.debugMode) {
        this.debug(`LLM response length: ${response.length} characters`);
        this.debug(`Response preview: ${response.substring(0, 200)}...`);
      }
      
      // Parse BT from response
      const bt = this.parseBTResponse(response);
      
      // Apply defaults and return
      return this.applyBTDefaults(bt);
      
    } catch (error) {
      this.debug(`BT generation failed: ${error.message}`);
      throw new Error(`LLM BT generation failed: ${error.message}`);
    }
  }

  /**
   * Generate BT with retry-specific context
   * @param {PlanningRequest} request - Planning request
   * @param {Object} retryContext - Retry context with failure info
   * @returns {Promise<Object>} Generated BT structure
   */
  async generateBTWithRetry(request, retryContext) {
    this.debug(`Generating BT with retry context (attempt ${retryContext.attempt})`);
    
    try {
      // Build prompt with retry information
      const prompt = await this.buildRetryBTPrompt(request, retryContext);
      
      // Call LLM with slightly higher temperature for variation
      const response = await this.llmClient.complete(prompt, {
        model: this.model,
        temperature: Math.min(this.temperature + 0.1, 0.5), // Slight increase for variety
        maxTokens: this.maxTokens
      });
      
      // Parse BT from response
      const bt = this.parseBTResponse(response);
      
      return this.applyBTDefaults(bt);
      
    } catch (error) {
      this.debug(`BT retry generation failed: ${error.message}`);
      throw new Error(`LLM BT retry generation failed: ${error.message}`);
    }
  }

  /**
   * Build prompt for initial BT generation
   * @param {PlanningRequest} request - Planning request
   * @param {Object} context - Generation context
   * @returns {Promise<string>} Generated prompt
   */
  async buildBTPrompt(request, context) {
    if (this.templateLoader) {
      return this.templateLoader.loadCreateBTTemplate({
        description: request.description,
        inputs: request.inputs,
        requiredOutputs: request.requiredOutputs,
        allowableActions: request.allowableActions,
        maxSteps: request.maxSteps
      });
    }
    
    // Fallback: build prompt directly
    return this.buildInlineBTPrompt(request, context);
  }

  /**
   * Build prompt for retry BT generation
   * @param {PlanningRequest} request - Planning request
   * @param {Object} retryContext - Retry context
   * @returns {Promise<string>} Generated prompt
   */
  async buildRetryBTPrompt(request, retryContext) {
    if (this.templateLoader) {
      return this.templateLoader.loadFixBTTemplate({
        description: request.description,
        inputs: request.inputs,
        requiredOutputs: request.requiredOutputs,
        allowableActions: request.allowableActions,
        maxSteps: request.maxSteps,
        failedBT: retryContext.lastFailedBT,
        validationErrors: retryContext.validationErrors.map(e => e.message)
      });
    }
    
    // Fallback: build retry prompt directly
    return this.buildInlineRetryBTPrompt(request, retryContext);
  }

  /**
   * Build BT generation prompt inline
   * @param {PlanningRequest} request - Planning request
   * @param {Object} context - Context
   * @returns {string} Generated prompt
   */
  buildInlineBTPrompt(request, context) {
    const actionsList = this.formatAllowableActions(request.allowableActions);
    
    return `Create a Behavior Tree (BT) structure for: ${request.description}

REQUIREMENTS:
- Available inputs: ${request.inputs.join(', ') || 'none'}
- Required outputs: ${request.requiredOutputs.join(', ') || 'none'}
- Maximum steps: ${request.maxSteps}

ALLOWABLE ACTIONS (you MUST only use these exact action types):
${actionsList}

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
- Use sequence for ordered execution
- Use selector for fallback strategies
- Use parallel for independent concurrent tasks
- Use retry for unreliable operations
- Use action nodes only with tools from allowable actions list

Return a JSON object with this structure:
{
  "type": "sequence|selector|parallel|action|retry",
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
   * Build retry BT generation prompt inline
   * @param {PlanningRequest} request - Planning request
   * @param {Object} retryContext - Retry context
   * @returns {string} Generated prompt
   */
  buildInlineRetryBTPrompt(request, retryContext) {
    const actionsList = this.formatAllowableActions(request.allowableActions);
    const failedBTStr = JSON.stringify(retryContext.lastFailedBT, null, 2);
    const errorsStr = retryContext.validationErrors.join('\n- ');
    
    return `RETRY: Create a corrected Behavior Tree structure for: ${request.description}

The previous BT generation failed with these errors:
- ${errorsStr}

FAILED BT:
${failedBTStr}

REQUIREMENTS:
- Available inputs: ${request.inputs.join(', ') || 'none'}
- Required outputs: ${request.requiredOutputs.join(', ') || 'none'}
- Maximum steps: ${request.maxSteps}

ALLOWABLE ACTIONS (you MUST only use these exact action types):
${actionsList}

CORRECTIONS NEEDED:
Please analyze the validation errors and create a corrected BT that:
1. Fixes all validation errors
2. Uses only allowable actions
3. Has proper BT structure with valid node types
4. Includes all required fields (id, type, description)
5. Uses correct parameter formats

Return a corrected JSON BT structure following the same format as before.
Focus on fixing the specific errors while maintaining the overall goal.`;
  }

  /**
   * Format allowable actions for prompt
   * @param {Array} allowableActions - Actions list
   * @returns {string} Formatted actions
   */
  formatAllowableActions(allowableActions) {
    return allowableActions.map(action => {
      let description = `- **${action.type || action.toolName || action.name}**: ${action.description || 'No description'}`;
      
      // Add input schema details
      if (action.inputSchema && action.inputSchema.properties) {
        const inputDetails = Object.entries(action.inputSchema.properties).map(([key, schema]) => {
          const required = action.inputSchema.required?.includes(key) ? ' (required)' : '';
          return `    ${key}: ${schema.type || 'string'}${required} - ${schema.description || ''}`;
        });
        if (inputDetails.length > 0) {
          description += '\n  Parameters:\n' + inputDetails.join('\n');
        }
      } else if (action.inputs) {
        description += `\n  Parameters: ${action.inputs.join(', ')}`;
      }
      
      // Add examples
      if (action.examples && action.examples.length > 0) {
        const example = action.examples[0];
        description += `\n  Example: ${JSON.stringify(example.parameters || example.inputs || {})}`;
      }
      
      return description;
    }).join('\n\n');
  }

  /**
   * Parse BT structure from LLM response
   * @param {string} response - LLM response text
   * @returns {Object} Parsed BT structure
   */
  parseBTResponse(response) {
    try {
      // Clean the response using robust JSON extraction
      const cleanedJson = this.cleanLLMResponse(response);
      
      if (this.debugMode) {
        this.debug(`Cleaned JSON length: ${cleanedJson.length}`);
        this.debug(`Cleaned JSON preview: ${cleanedJson.substring(0, 300)}...`);
      }
      
      // Parse with JSON5 for better error tolerance
      const bt = JSON5.parse(cleanedJson);
      
      if (!bt || typeof bt !== 'object') {
        throw new Error('Parsed BT is not an object');
      }
      
      // Basic structure validation
      if (!bt.type) {
        throw new Error('BT missing type field');
      }
      
      return bt;
      
    } catch (error) {
      this.debug(`BT parsing failed: ${error.message}`);
      this.debug(`Raw response: ${response.substring(0, 500)}...`);
      throw new Error(`Failed to parse BT from LLM response: ${error.message}`);
    }
  }

  /**
   * Clean LLM response to extract JSON (from llm-planner)
   * @param {string} responseText - Raw LLM response
   * @returns {string} Cleaned JSON string
   */
  cleanLLMResponse(responseText) {
    let text = responseText.trim();
    
    // STEP 1: Strip markdown code blocks
    const codeBlockStart = text.match(/```(?:json|JSON|Json)?\s*\n?/);
    if (codeBlockStart) {
      const startIndex = text.indexOf(codeBlockStart[0]) + codeBlockStart[0].length;
      text = text.substring(startIndex);
    }
    
    // STEP 2: Strip ending markdown
    const lastTripleBacktick = text.lastIndexOf('```');
    if (lastTripleBacktick !== -1) {
      text = text.substring(0, lastTripleBacktick);
    }
    
    // STEP 3: Find JSON boundaries
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }
    
    return text.trim();
  }

  /**
   * Get strategy metadata
   * @returns {Object} Strategy metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      name: this.name || 'LLMStrategy',
      type: 'llm',
      description: 'LLM-powered BT generation with retry support',
      capabilities: ['bt-generation', 'retry-aware', 'template-support'],
      model: this.model,
      temperature: this.temperature,
      hasTemplateLoader: !!this.templateLoader
    };
  }

  /**
   * Check if strategy can handle request
   * @param {PlanningRequest} request - Planning request
   * @returns {boolean} True if can handle
   */
  canHandle(request) {
    return true; // LLM can attempt any request
  }
}