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
    this.maxTokens = options.maxTokens || 4000; // Increased for complex BT plans
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
      
      // Call LLM with JSON-only instruction
      const systemPrompt = "You are a JSON generator. Return ONLY valid JSON with no additional text, markdown, or explanations.";
      const response = await this.llmClient.complete(prompt, {
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        system: systemPrompt
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
      const systemPrompt = "You are a JSON generator. Return ONLY valid JSON with no additional text, markdown, or explanations.";
      const response = await this.llmClient.complete(prompt, {
        model: this.model,
        temperature: Math.min(this.temperature + 0.1, 0.5), // Slight increase for variety
        maxTokens: this.maxTokens,
        system: systemPrompt
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
- Use sequence for ordered execution (especially for multi-file projects)
- Use selector for fallback strategies
- Use parallel for independent concurrent tasks
- Use retry for unreliable operations
- Use action nodes only with tools from allowable actions list

MULTI-FILE PROJECT GUIDELINES:
- For web projects, create multiple coordinated files (HTML, CSS, JS, README)
- Use directory_create before creating files in subdirectories
- Ensure HTML files properly reference CSS and JS files
- Generate README.md with project description and usage instructions
- Use descriptive filenames that reflect their purpose
- Create proper project structure with organized file layout

CODE QUALITY GUIDELINES:
- Generate high-quality, production-ready code that follows best practices
- Include code quality actions (eslint_check, prettier_format, validate_code) in BT plans
- Use modern JavaScript features (const/let instead of var, arrow functions)
- Avoid security risks (no eval(), proper input validation)
- Include proper error handling and user feedback
- Add meaningful comments for complex logic
- Ensure consistent code formatting and style
- Validate code structure and syntax after generation
- For quality-focused projects, include linting and formatting steps in the BT

TESTING & DOCUMENTATION GUIDELINES:
- For complete projects, generate accompanying test files using test_write action
- Include test_run actions to validate generated tests pass
- Generate comprehensive documentation using doc_generate action
- Add JSDoc comments to functions and classes using jsdoc_add action
- Update README with project information using readme_update action
- Test files should follow naming convention: *.test.js or *.spec.js
- Include unit tests for all major functions and edge cases
- Generate test coverage reports using test_coverage action
- Documentation should include API reference, usage examples, and setup instructions
- For professional projects, include testing and documentation in the BT sequence

IMPORTANT OUTPUT FORMAT:
- Return ONLY a JSON object - no markdown, no code blocks, no explanations
- The JSON must be complete and valid
- Do not include README content or code snippets outside the BT structure
- All file content should be in the "content" field of file_write params

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

CRITICAL: Return ONLY valid JSON. Do not include any markdown, explanations, or additional text.
The response must start with { and end with }

EXAMPLE RESPONSE:
{
  "type": "sequence",
  "id": "example-bt",
  "description": "Example BT structure",
  "children": [
    {
      "type": "action",
      "id": "action-1",
      "tool": "file_write",
      "description": "Write a file",
      "params": {
        "filepath": "example.txt",
        "content": "content here"
      }
    }
  ]
}

Generate a complete, executable BT structure in valid JSON format ONLY.`;
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

Return a corrected JSON BT structure with this exact format:
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

CRITICAL RULES:
1. Use "tool" field for action nodes, not "action"
2. Return ONLY valid JSON - no markdown, no explanations, no code blocks
3. Start with { and end with }
4. Ensure all braces are properly matched
5. Put all file content inside params.content as a string

VALID JSON EXAMPLE:
{
  "type": "sequence",
  "id": "root",
  "description": "Description",
  "children": [...]
}

Return ONLY the corrected JSON BT structure.`;
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
      // Try to parse the response directly first (in case it's already clean JSON)
      let cleanedJson = response.trim();
      
      // If it starts with a code block, extract it
      if (cleanedJson.includes('```')) {
        cleanedJson = this.cleanLLMResponse(response);
      }
      
      // Additional safety: ensure we have valid JSON structure
      if (!cleanedJson.startsWith('{')) {
        // Try to find the first { and extract from there
        const firstBrace = cleanedJson.indexOf('{');
        if (firstBrace !== -1) {
          cleanedJson = cleanedJson.substring(firstBrace);
        }
      }
      
      // Find the proper end of the JSON object
      if (cleanedJson.startsWith('{')) {
        let depth = 0;
        let inString = false;
        let escape = false;
        let endIndex = -1;
        
        for (let i = 0; i < cleanedJson.length; i++) {
          const char = cleanedJson[i];
          
          if (escape) {
            escape = false;
            continue;
          }
          
          if (char === '\\') {
            escape = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
              depth--;
              if (depth === 0) {
                endIndex = i;
                break;
              }
            }
          }
        }
        
        if (endIndex !== -1) {
          cleanedJson = cleanedJson.substring(0, endIndex + 1);
        }
      }
      
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
    
    // STEP 3: Find JSON boundaries more carefully
    // Count braces to find matching closing brace
    const firstBrace = text.indexOf('{');
    if (firstBrace !== -1) {
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      let lastClosingBrace = -1;
      
      for (let i = firstBrace; i < text.length; i++) {
        const char = text[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              lastClosingBrace = i;
              break;
            }
          }
        }
      }
      
      if (lastClosingBrace !== -1) {
        text = text.substring(firstBrace, lastClosingBrace + 1);
      }
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