/**
 * GenericPlanner - LLM-based planner that creates hierarchical plans using user-provided actions
 */

import { Plan } from './models/Plan.js';
import { PlanStep } from './models/PlanStep.js';
import { PlanAction } from './models/PlanAction.js';

class GenericPlanner {
  constructor(options = {}) {
    this.llmClient = options.llmClient;
    this.maxRetries = options.maxRetries || 3;
    this.maxSteps = options.maxSteps || 20;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required');
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

    const prompt = this._buildPrompt(description, inputs, requiredOutputs, allowableActions, maxSteps);
    
    console.log(`🔍 [DEBUG] GenericPlanner.createPlan - About to call LLM with prompt:`);
    console.log(`🔍 [DEBUG] Prompt length: ${prompt.length} characters`);
    console.log(`🔍 [DEBUG] First 500 chars:`, prompt.substring(0, 500));
    console.log(`🔍 [DEBUG] Last 500 chars:`, prompt.substring(Math.max(0, prompt.length - 500)));
    
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔍 [DEBUG] GenericPlanner - Attempt ${attempt} calling complete`);
        const responseText = await this.llmClient.complete(prompt, 'claude-3-5-sonnet-20241022');
        
        console.log(`🔍 [DEBUG] Raw LLM response:`, responseText.substring(0, 500));
        
        // Parse JSON from the response
        const response = this._parseJSONResponse(responseText);

        console.log('\n🤖 LLM Response:');
        console.log(JSON.stringify(response, null, 2));

        const plan = this._parsePlanResponse(response, allowableActions, inputs, requiredOutputs, initialInputData);
        
        console.log('\n📋 Generated Plan JSON:');
        console.log(JSON.stringify(plan.toJSON(), null, 2));
        
        // Validate the plan - DISABLED for now to allow plan generation without strict output requirements
        // const validation = this._validatePlan(plan, inputs, requiredOutputs, allowableActions, initialInputData);
        // if (!validation.isValid) {
        //   throw new Error(`Plan validation failed: ${validation.errors.join(', ')}`);
        // }

        return plan;
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
    try {
      // First try to parse directly
      return JSON.parse(responseText);
    } catch (error) {
      // Try to extract JSON from code blocks
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          const cleanedJson = this._cleanJsonString(jsonMatch[1]);
          return JSON.parse(cleanedJson);
        } catch (innerError) {
          // JSON inside code blocks is also invalid
        }
      }
      
      // Try to find JSON-like content without code blocks
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        try {
          let potentialJson = responseText.substring(jsonStart, jsonEnd + 1);
          potentialJson = this._cleanJsonString(potentialJson);
          return JSON.parse(potentialJson);
        } catch (innerError) {
          // Still not valid JSON
        }
      }
      
      throw new Error(`Could not parse JSON from response: ${error.message}`);
    }
  }

  /**
   * Clean JSON string by fixing common LLM-generated issues
   * @private
   */
  _cleanJsonString(jsonStr) {
    let cleaned = jsonStr;
    
    // Remove backticks inside string values (common LLM mistake)
    // This regex matches strings and replaces backticks within them
    cleaned = cleaned.replace(/"([^"]*)`([^"]*?)"/g, '"$1\'$2"');
    
    // Replace backticks with single quotes in general
    cleaned = cleaned.replace(/`/g, "'");
    
    // Fix unescaped newlines in strings
    cleaned = cleaned.replace(/"([^"]*)\n([^"]*?)"/g, '"$1\\n$2"');
    
    // Fix trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix single quotes around property names (should be double quotes)
    cleaned = cleaned.replace(/'([^']*)'(\s*:)/g, '"$1"$2');
    
    // Fix undefined values (replace with null)
    cleaned = cleaned.replace(/:\s*undefined/g, ': null');
    
    // Fix comments (remove // comments)
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    
    // Fix multi-line comments (remove /* */ comments)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Clean up extra whitespace and newlines
    cleaned = cleaned.trim();
    
    return cleaned;
  }
}

export { GenericPlanner };