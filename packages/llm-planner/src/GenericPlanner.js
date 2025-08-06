/**
 * GenericPlanner - LLM-based planner that creates hierarchical plans using user-provided actions
 */

import { Plan } from './models/Plan.js';
import { PlanStep } from './models/PlanStep.js';
import { PlanAction } from './models/PlanAction.js';
import { PromptTemplateLoader } from './PromptTemplateLoader.js';
import { ValidatePlanTool } from '@legion/plan-executor-tools';

class GenericPlanner {
  constructor(options = {}) {
    this.llmClient = options.llmClient;
    this.moduleLoader = options.moduleLoader;
    this.maxRetries = options.maxRetries || 3;
    this.maxSteps = options.maxSteps || 20;
    this.templateLoader = new PromptTemplateLoader();
    
    if (!this.llmClient) {
      throw new Error('LLM client is required');
    }
    
    if (!this.moduleLoader) {
      throw new Error('ModuleLoader is required for plan validation');
    }
  }

  /**
   * Create a plan using LLM
   * @param {Object} request - Planning request
   * @returns {Promise<Plan>} Generated plan
   */
  async createPlan(request) {
    const {
      description,
      inputs = [],
      requiredOutputs = [],
      allowableActions = [],
      maxSteps = this.maxSteps,
      initialInputData = {}
    } = request;

    if (!description) {
      throw new Error('Description is required');
    }

    if (!allowableActions || allowableActions.length === 0) {
      throw new Error('Allowable actions are required');
    }

    let lastError;
    let lastFailedPlan = null;
    
    // Main generation and validation loop
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        let prompt;
        
        if (attempt === 1) {
          // First attempt - use create-plan template
          prompt = await this.templateLoader.loadCreatePlanTemplate({
            description,
            inputs,
            requiredOutputs,
            allowableActions,
            maxSteps
          });
        } else {
          // Retry attempt - use fix-plan template with previous failure
          if (!lastFailedPlan) {
            throw new Error('No previous failed plan to fix');
          }
          
          prompt = await this.templateLoader.loadFixPlanTemplate({
            description,
            inputs,
            requiredOutputs,
            allowableActions,
            maxSteps,
            failedPlan: lastFailedPlan,
            validationErrors: lastError.validationErrors || [lastError.message]
          });
        }
        
        console.log(`🔍 [DEBUG] GenericPlanner - Attempt ${attempt} calling LLM`);
        console.log(`🔍 [DEBUG] Prompt type: ${attempt === 1 ? 'create-plan' : 'fix-plan'}`);
        console.log(`🔍 [DEBUG] Prompt length: ${prompt.length} characters`);
        
        const responseText = await this.llmClient.complete(prompt, 'claude-3-5-sonnet-20241022');
        
        console.log(`🔍 [DEBUG] Raw LLM response:`, responseText.substring(0, 500));
        
        // Parse JSON from the response
        const response = this._parseJSONResponse(responseText);

        console.log('\n🤖 LLM Response:');
        console.log(JSON.stringify(response, null, 2));

        const plan = this._parsePlanResponse(response, allowableActions, inputs, requiredOutputs, initialInputData);
        
        console.log('\n📋 Generated Plan JSON:');
        console.log(JSON.stringify(plan.toJSON(), null, 2));
        
        // Validate the plan using plan-executor-tools
        const validationResult = await this._validatePlanWithTools(plan.toJSON());
        
        if (validationResult.valid) {
          console.log('✅ Plan validation successful');
          return plan;
        } else {
          console.log('❌ Plan validation failed:', validationResult.errors);
          lastFailedPlan = plan.toJSON();
          const validationError = new Error(`Plan validation failed: ${validationResult.errors.join(', ')}`);
          validationError.validationErrors = validationResult.errors;
          throw validationError;
        }
      } catch (error) {
        lastError = error;
        console.warn(`Plan generation attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === this.maxRetries) {
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error(`Failed to generate valid plan after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Validate a plan using plan-executor-tools
   * @private
   */
  async _validatePlanWithTools(planJson) {
    try {
      const validator = new ValidatePlanTool(this.moduleLoader);
      
      const result = await validator.execute({
        plan: planJson,
        markAsValidated: false, // Don't modify the plan, just validate
        verbose: true
      });
      
      return {
        valid: result.valid,
        errors: result.errors || []
      };
    } catch (error) {
      console.error('Plan validation error:', error);
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }

  /**
   * Build the LLM prompt for plan generation
   * @private
   */
  _buildPrompt(description, inputs, requiredOutputs, allowableActions, maxSteps) {
    // Build detailed action descriptions with parameter schemas
    const actionsList = allowableActions.map(action => {
      // Get parameter details if available in the action definition
      let paramDetails = '';
      if (action.inputSchema) {
        // Extract parameter info from schema
        const params = [];
        for (const [key, schema] of Object.entries(action.inputSchema)) {
          const required = action.requiredInputs?.includes(key) ? ' (required)' : '';
          params.push(`    ${key}: ${schema.type || 'string'}${required} - ${schema.description || ''}`);
        }
        paramDetails = params.length > 0 ? '\n' + params.join('\n') : '';
      } else if (action.inputs) {
        // Fall back to simple list
        paramDetails = ` [${action.inputs.join(', ')}]`;
      }
      
      // Add examples if available
      let exampleText = '';
      if (action.examples && action.examples.length > 0) {
        const example = action.examples[0];
        exampleText = `\n  Example: ${example.description || 'Usage'}
    Parameters: ${JSON.stringify(example.parameters)}`;
      }
      
      return `- ${action.type}: ${action.description || ''}
  Parameters:${paramDetails || ' ' + (action.inputs?.join(', ') || 'none')}
  Outputs: ${action.outputs?.join(', ') || 'none'}${exampleText}`;
    }).join('\n\n');

    return `Create a structured plan for: ${description}

REQUIREMENTS:
- Available inputs: ${inputs.join(', ')}
- Required outputs: ${requiredOutputs.join(', ')}
- Maximum steps: ${maxSteps}

ALLOWABLE ACTIONS (you MUST only use these exact action types):
${actionsList}

PLAN STRUCTURE:
- Create a hierarchical plan with steps that can contain sub-steps or actions
- Each step should have a name, description, and type (setup, implementation, integration, testing, deployment)
- Steps can have dependencies on other steps (use step IDs)
- At the leaf level, use only the allowable actions listed above
- Each action must use the exact type and input/output signature from the allowable actions
- Ensure the plan produces all required outputs
- Make sure input/output flow is valid (each step's inputs must be available from previous steps or initial inputs)

CRITICAL ACTION FORMAT:
- Each action MUST have a "type" field that exactly matches one of the allowable action types above
- Each action MUST have a "parameters" object with the exact parameter names shown above
- DO NOT add a "tool" field - the type field is sufficient
- DO NOT use action types that are not in the allowable actions list
- DO NOT mix parameters from different actions

CONSTRAINTS:
- You can only use the action types provided in the allowable actions list
- Each action must specify its inputs and outputs exactly as defined
- Steps can be hierarchical (steps containing sub-steps)
- Dependencies must reference actual step IDs
- The plan must be executable in the specified order

Return a JSON object with this structure:
{
  "name": "Plan Name",
  "description": "Plan description",
  "steps": [
    {
      "id": "step-id",
      "name": "Step Name",
      "description": "Step description",
      "type": "setup|implementation|integration|testing|deployment",
      "dependencies": ["dependent-step-id"],
      "steps": [
        // Optional sub-steps (same structure)
      ],
      "actions": [
        {
          "type": "exact-action-type-from-allowable-actions",
          "parameters": {
            // Action-specific parameters
          }
        }
      ]
    }
  ]
}

Generate a complete, executable plan.`;
  }

  /**
   * Get the JSON schema for plan structure
   * @private
   */
  _getPlanSchema() {
    return {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string' },
              dependencies: { type: 'array', items: { type: 'string' } },
              steps: { type: 'array' }, // Recursive
              actions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    parameters: { type: 'object' }
                  },
                  required: ['type']
                }
              }
            },
            required: ['id', 'name', 'type']
          }
        }
      },
      required: ['name', 'description', 'steps']
    };
  }

  /**
   * Parse the LLM response into a Plan object
   * @private
   */
  _parsePlanResponse(response, allowableActions, inputs = [], requiredOutputs = [], initialInputData = {}) {
    let planData;
    
    try {
      // Handle different response formats
      if (typeof response === 'object' && response !== null) {
        // Check if it's a structured response wrapper
        if (response.success && response.data) {
          planData = response.data;
        } else {
          planData = response;
        }
      } else if (typeof response === 'string') {
        // Response is a string, might be wrapped in JSON code blocks
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonText = jsonMatch ? jsonMatch[1] : response;
        planData = JSON.parse(jsonText);
      } else {
        throw new Error(`Unexpected response type: ${typeof response}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error.message}`);
    }

    // Create the plan with allowable actions context and proper inputs/outputs
    const plan = new Plan({
      name: planData.name,
      description: planData.description,
      steps: planData.steps || [],
      inputs: inputs,
      requiredOutputs: requiredOutputs
    }, allowableActions);

    return plan;
  }

  /**
   * Validate the generated plan
   * @private
   */
  _validatePlan(plan, inputs, requiredOutputs, allowableActions, initialInputData = {}) {
    const errors = [];

    // Validate plan structure
    const structureValidation = plan.validate();
    if (!structureValidation.isValid) {
      errors.push(...structureValidation.errors);
    }

    // Validate all actions use allowable action types
    const allActions = this._getAllActionsFromPlan(plan);
    const allowableTypes = allowableActions.map(a => a.type);
    
    for (const action of allActions) {
      if (!allowableTypes.includes(action.type)) {
        errors.push(`Invalid action type: ${action.type}`);
      }
    }

    // Validate input/output flow with initial input data
    const flowValidation = this._validatePlanInputOutputFlow(plan, initialInputData);
    if (!flowValidation.isValid) {
      errors.push(...flowValidation.errors);
    }

    // Check required outputs are produced
    const availableOutputs = flowValidation.availableOutputs || [];
    const missingOutputs = requiredOutputs.filter(output => !availableOutputs.includes(output));
    if (missingOutputs.length > 0) {
      errors.push(`Missing required outputs: ${missingOutputs.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate plan input/output flow with initial input data
   * @private
   */
  _validatePlanInputOutputFlow(plan, initialInputData = {}) {
    const errors = [];
    const warnings = [];
    
    // Track all available outputs (starting with plan inputs + initial input data)
    const availableOutputs = [...plan.inputs, ...Object.keys(initialInputData)];
    
    // Check each step in execution order
    const executionOrder = plan.executionOrder.length > 0 ? plan.executionOrder : plan.generateExecutionOrder();
    
    for (const stepId of executionOrder) {
      const step = plan.getStep(stepId);
      if (!step) continue;
      
      // Validate step inputs
      const stepInputValidation = step.validateInputs(availableOutputs);
      if (!stepInputValidation.isValid) {
        errors.push(`Step '${step.name}' (${stepId}) missing required inputs: ${stepInputValidation.missingInputs.join(', ')}`);
      }
      
      // Add step outputs to available outputs
      const stepOutputs = step.getOutputs();
      for (const output of stepOutputs) {
        if (!availableOutputs.includes(output)) {
          availableOutputs.push(output);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      availableOutputs
    };
  }

  /**
   * Get all actions from the plan recursively
   * @private
   */
  _getAllActionsFromPlan(plan) {
    const allActions = [];
    
    for (const step of plan.steps) {
      allActions.push(...step.getAllActions());
    }
    
    return allActions;
  }

  /**
   * Parse JSON response from LLM
   * @private
   */
  _parseJSONResponse(responseText) {
    // Step 1: Try direct parsing
    try {
      return JSON.parse(responseText);
    } catch (error) {
      // Continue to extraction and cleaning
    }
    
    // Step 2: Extract JSON from various markdown code block formats
    let extractedJson = this._extractJsonFromResponse(responseText);
    
    if (!extractedJson) {
      console.error('🚨 JSON EXTRACTION FAILED 🚨');
      console.error('\n📝 FULL LLM RESPONSE THAT FAILED TO EXTRACT:');
      console.error('='.repeat(60));
      console.error(responseText);
      console.error('='.repeat(60));
      throw new Error(`Could not extract JSON from response. No JSON structure found.\n\nSee console output above for the full LLM response.`);
    }
    
    // Step 3: Clean the extracted JSON
    const cleanedJson = this._cleanJsonString(extractedJson);
    
    // Step 4: Final parsing attempt
    try {
      return JSON.parse(cleanedJson);
    } catch (error) {
      console.error('🚨 JSON PARSING FAILED 🚨');
      console.error('Error:', error.message);
      console.error('\n📝 FULL CLEANED JSON THAT FAILED TO PARSE:');
      console.error('='.repeat(60));
      console.error(cleanedJson);
      console.error('='.repeat(60));
      console.error(`\n📍 Error position: ${error.message.match(/position (\d+)/)?.[1] || 'unknown'}`);
      
      // Show problematic section around error position if available
      const posMatch = error.message.match(/position (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1]);
        const start = Math.max(0, pos - 50);
        const end = Math.min(cleanedJson.length, pos + 50);
        console.error(`\n🎯 PROBLEM AREA (chars ${start}-${end}):`);
        console.error('"' + cleanedJson.substring(start, end) + '"');
        console.error(' '.repeat(pos - start) + '^ ERROR HERE');
      }
      
      throw new Error(`Could not parse cleaned JSON: ${error.message}\n\nSee console output above for the full problematic JSON text.`);
    }
  }

  /**
   * Extract JSON from LLM response text using multiple strategies
   * @private
   */
  _extractJsonFromResponse(responseText) {
    const text = responseText.trim();
    
    // Strategy 1: Extract from ```json code blocks
    const jsonCodeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonCodeBlockMatch) {
      return jsonCodeBlockMatch[1].trim();
    }
    
    // Strategy 2: Extract from generic ``` code blocks
    const genericCodeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
    if (genericCodeBlockMatch) {
      const content = genericCodeBlockMatch[1].trim();
      // Check if it looks like JSON (starts with { or [)
      if (content.startsWith('{') || content.startsWith('[')) {
        return content;
      }
    }
    
    // Strategy 3: Find JSON-like content between first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.substring(firstBrace, lastBrace + 1);
    }
    
    // Strategy 4: Find JSON-like content between first [ and last ]
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return text.substring(firstBracket, lastBracket + 1);
    }
    
    return null;
  }

  /**
   * Clean JSON string by fixing common LLM-generated issues
   * @private
   */
  _cleanJsonString(jsonStr) {
    let cleaned = jsonStr.trim();
    
    // Remove JavaScript comments (before other processing)
    // Remove single-line comments
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Fix undefined values (replace with null)
    cleaned = cleaned.replace(/:\s*undefined\b/g, ': null');
    
    // Fix single quotes around property names (convert to double quotes)
    cleaned = cleaned.replace(/'([^']+)'(\s*:)/g, '"$1"$2');
    
    // Fix single quoted string values (convert to double quotes)
    // Be more careful to avoid conflicts with apostrophes in content
    cleaned = cleaned.replace(/:\s*'([^']*)'(?=\s*[,}\]])/g, ': "$1"');
    
    // CRITICAL: Handle template literals (backticks) which are the main issue
    // Use a more precise regex that handles multiline content correctly
    cleaned = cleaned.replace(/`([^`]*?)`/gs, (match, content) => {
      // Properly escape the content for JSON
      const escaped = content
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/"/g, '\\"')    // Escape double quotes
        .replace(/\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '\\r')   // Escape carriage returns
        .replace(/\t/g, '\\t');  // Escape tabs
      return `"${escaped}"`;
    });
    
    // Fix backticks inside regular double-quoted strings - leave them as literal backticks
    // Backticks are valid in JSON strings and don't need escaping
    
    // Fix unescaped newlines in regular string values
    cleaned = cleaned.replace(/("(?:[^"\\]|\\.)*?")/g, (match) => {
      // Only process if it contains unescaped newlines
      if (match.includes('\n') || match.includes('\r')) {
        // Simple approach: replace all newlines/returns, then fix double-escaped ones
        return match
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\\\\n/g, '\\n')  // Fix double-escaped
          .replace(/\\\\r/g, '\\r'); // Fix double-escaped
      }
      return match;
    });
    
    // Fix trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    // Clean up whitespace around structural elements
    cleaned = cleaned.replace(/,\s*\n\s*}/g, '\n}');
    cleaned = cleaned.replace(/,\s*\n\s*]/g, '\n]');
    
    return cleaned;
  }
}

export { GenericPlanner };