/**
 * LLMPlannerModule - Module wrapper for LLM-based planning functionality
 * 
 * This module integrates with the jsEnvoy ResourceManager system to provide
 * dependency injection and proper resource management for the LLM planner.
 */

import { Module, Tool, ToolResult } from '@jsenvoy/module-loader';
import { GenericPlanner } from './GenericPlanner.js';
import { FlowValidator } from './FlowValidator.js';
import { Plan } from './models/Plan.js';
import { PlanStep } from './models/PlanStep.js';
import { PlanAction } from './models/PlanAction.js';

/**
 * Tool for creating plans using LLM
 */
class CreatePlanTool extends Tool {
  constructor(llmClient) {
    super();
    this.llmClient = llmClient;
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'create-plan',
        description: 'Create a structured plan using LLM for task decomposition',
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Description of what needs to be planned'
            },
            inputs: {
              type: 'array',
              items: { type: 'string' },
              description: 'Available inputs for the plan'
            },
            requiredOutputs: {
              type: 'array',
              items: { type: 'string' },
              description: 'Required outputs that must be produced'
            },
            allowableActions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  inputs: { type: 'array', items: { type: 'string' } },
                  outputs: { type: 'array', items: { type: 'string' } }
                },
                required: ['type']
              },
              description: 'Actions that can be used in the plan'
            },
            maxSteps: {
              type: 'number',
              description: 'Maximum number of steps allowed',
              default: 20
            }
          },
          required: ['description', 'allowableActions']
        }
      }
    };
  }

  async invoke(toolCall) {
    const params = toolCall.function.arguments;
    
    try {
      const planner = new GenericPlanner({
        llmClient: this.llmClient,
        maxSteps: params.maxSteps || 20
      });
      
      const plan = await planner.createPlan(params);
      
      return ToolResult.success({
        plan: plan.toJSON()
      });
    } catch (error) {
      return ToolResult.failure(error.message);
    }
  }
}

/**
 * Tool for validating plans
 */
class ValidatePlanTool extends Tool {
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'validate-plan',
        description: 'Validate a plan structure and input/output flow',
        parameters: {
          type: 'object',
          properties: {
            plan: {
              type: 'object',
              description: 'The plan object to validate'
            },
            strictMode: {
              type: 'boolean',
              description: 'Whether to use strict validation mode',
              default: false
            }
          },
          required: ['plan']
        }
      }
    };
  }

  async invoke(toolCall) {
    const params = toolCall.function.arguments;
    
    try {
      const validator = new FlowValidator({ strictMode: params.strictMode });
      
      // Create plan from JSON, which properly creates PlanStep instances
      const plan = Plan.fromJSON(params.plan);
      
      const validation = validator.validate(plan);
      const report = validator.generateFlowReport(plan);
      
      return ToolResult.success({
        validation,
        report
      });
    } catch (error) {
      return ToolResult.failure(error.message);
    }
  }
}

/**
 * LLMPlannerModule - Module for LLM-based planning
 */
class LLMPlannerModule extends Module {
  // Declare dependencies required by this module
  static dependencies = ['llmClient'];
  
  constructor(dependencies = {}) {
    super();
    this.name = 'llm-planner';
    this.description = 'LLM-based planning component for intelligent task decomposition';
    
    // Get the LLM client from dependencies
    const llmClient = dependencies.llmClient;
    
    // Create and register tools
    this.tools = [
      new CreatePlanTool(llmClient),
      new ValidatePlanTool()
    ];
  }
}

// Export the module class
export { LLMPlannerModule };
export default LLMPlannerModule;