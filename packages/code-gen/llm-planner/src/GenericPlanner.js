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
      maxSteps = this.maxSteps
    } = request;

    if (!description) {
      throw new Error('Description is required');
    }

    if (!allowableActions || allowableActions.length === 0) {
      throw new Error('Allowable actions are required');
    }

    const prompt = this._buildPrompt(description, inputs, requiredOutputs, allowableActions, maxSteps);
    
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.llmClient.completeWithStructuredResponse(prompt, {
          schema: this._getPlanSchema(),
          expectedFields: ['name', 'description', 'steps'],
          maxTokens: 4000
        });

        console.log('\n🤖 LLM Response:');
        console.log(JSON.stringify(response, null, 2));

        const plan = this._parsePlanResponse(response, allowableActions, inputs, requiredOutputs);
        
        console.log('\n📋 Generated Plan JSON:');
        console.log(JSON.stringify(plan.toJSON(), null, 2));
        
        // Validate the plan
        const validation = this._validatePlan(plan, inputs, requiredOutputs, allowableActions);
        if (!validation.isValid) {
          throw new Error(`Plan validation failed: ${validation.errors.join(', ')}`);
        }

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
    const actionsList = allowableActions.map(action => {
      return `- ${action.type}: inputs=[${action.inputs?.join(', ') || ''}], outputs=[${action.outputs?.join(', ') || ''}]`;
    }).join('\n');

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
  _parsePlanResponse(response, allowableActions, inputs = [], requiredOutputs = []) {
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
  _validatePlan(plan, inputs, requiredOutputs, allowableActions) {
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

    // Validate input/output flow
    const flowValidation = plan.validateInputOutputFlow();
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
}

export { GenericPlanner };