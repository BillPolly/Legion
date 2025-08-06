/**
 * GenericPlanner - LLM-based planner that creates hierarchical plans using user-provided actions
 */

// Not using these anymore - they mangle the LLM output!
// import { Plan } from './models/Plan.js';
// import { PlanStep } from './models/PlanStep.js';
// import { PlanAction } from './models/PlanAction.js';
import { PromptTemplateLoader } from './PromptTemplateLoader.js';
import { ValidatePlanTool } from '@legion/plan-executor-tools';
import JSON5 from 'json5';

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
        console.log(JSON.stringify(plan, null, 2));
        
        // Validate the plan using plan-executor-tools
        const validationResult = await this._validatePlanWithTools(plan);
        
        if (validationResult.valid) {
          console.log('✅ Plan validation successful');
          return plan;
        } else {
          console.log('❌ Plan validation failed:', validationResult.errors);
          lastFailedPlan = plan;
          // If there are no specific errors but validation failed, add a generic message
          const errorMessages = validationResult.errors && validationResult.errors.length > 0 
            ? validationResult.errors 
            : ['Plan validation failed (check warnings or tool availability)'];
          const validationError = new Error(`Plan validation failed: ${errorMessages.join(', ')}`);
          validationError.validationErrors = errorMessages;
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
        valid: result.errors?.length === 0, // Valid if no errors, regardless of result.valid flag
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
      
      return `- ${action.toolName || action.type}: ${action.description || ''}
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

    // Don't use Plan class - it mangles the data!
    // Just return the LLM's plan with some defaults
    const plan = {
      ...planData,
      id: planData.id || `plan-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`,
      inputs: planData.inputs || inputs.map(name => ({
        name: name.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        type: 'string',
        required: true
      })),
      requiredOutputs: planData.requiredOutputs || requiredOutputs,
      status: planData.status || 'draft',
      version: planData.version || '1.0.0',
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: 'GenericPlanner',
        complexity: 'medium',
        ...planData.metadata
      }
    };

    return plan;
  }

  // All validation is now done by ValidatePlanTool - no need for these methods

  /**
   * Parse JSON response from LLM
   * @private
   */
  _parseJSONResponse(responseText) {
    // Step 1: Clean up the response - remove markdown blocks and extra text
    const cleaned = this._cleanLLMResponse(responseText);
    
    // Log the full cleaned response with chevrons (no truncation)
    console.log('\n>>>>' + cleaned + '<<<<\n');
    
    // Step 2: Try parsing with JSON5 (handles most edge cases)
    try {
      return JSON5.parse(cleaned);
    } catch (error) {
      console.log(`❌ JSON5 parse failed: ${error.message}`);
      
      // Try with original text as fallback
      try {
        return JSON5.parse(responseText);
      } catch (fallbackError) {
        console.log(`❌ JSON5 fallback parse failed: ${fallbackError.message}`);
      }
    }
    
    // If all fails, show what we tried to parse
    console.error('🚨 JSON PARSING FAILED 🚨');
    console.error('\n📝 CLEANED TEXT THAT FAILED TO PARSE:');
    console.error('='.repeat(60));
    console.error(cleaned.substring(0, 1000) + (cleaned.length > 1000 ? '...' : ''));
    console.error('='.repeat(60));
    
    throw new Error(`Could not parse JSON response: ${cleaned.substring(0, 100)}...`);
  }
  
  /**
   * Clean LLM response by removing markdown and extra text
   * @private
   */
  _cleanLLMResponse(responseText) {
    let text = responseText.trim();
    
    // STEP 1: Strip from the beginning - remove everything up to and including ```json or ```
    const codeBlockStart = text.match(/```(?:json|JSON|Json)?\s*\n?/);
    if (codeBlockStart) {
      const startIndex = text.indexOf(codeBlockStart[0]) + codeBlockStart[0].length;
      text = text.substring(startIndex);
    }
    
    // STEP 2: Strip from the end - remove ``` and everything after
    const lastTripleBacktick = text.lastIndexOf('```');
    if (lastTripleBacktick !== -1) {
      text = text.substring(0, lastTripleBacktick);
    }
    
    // STEP 3: Find the JSON boundaries (first { or [ and last } or ])
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    
    // Determine the start position
    let startPos = 0;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startPos = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startPos = firstBrace;
    } else if (firstBracket !== -1) {
      startPos = firstBracket;
    }
    
    // Determine the end position
    let endPos = text.length;
    if (lastBrace !== -1 && lastBracket !== -1) {
      endPos = Math.max(lastBrace, lastBracket) + 1;
    } else if (lastBrace !== -1) {
      endPos = lastBrace + 1;
    } else if (lastBracket !== -1) {
      endPos = lastBracket + 1;
    }
    
    // Extract the JSON part
    if (startPos < endPos) {
      text = text.substring(startPos, endPos);
    }
    
    return text.trim();
  }


}

export { GenericPlanner };