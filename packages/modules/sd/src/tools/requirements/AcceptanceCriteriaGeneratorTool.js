/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * AcceptanceCriteriaGeneratorTool - Generates acceptance criteria for user stories
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const acceptanceCriteriaGeneratorToolInputSchema = {
  type: 'object',
  properties: {
    userStories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'User story ID'
          },
          story: {
            type: 'string',
            description: 'User story text'
          }
        },
        required: ['id', 'story']
      },
      description: 'User stories to generate criteria for'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['userStories']
};

// Output schema as plain JSON Schema
const acceptanceCriteriaGeneratorToolOutputSchema = {
  type: 'object',
  properties: {
    acceptanceCriteria: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      description: 'Map of story IDs to acceptance criteria'
    }
  },
  required: ['acceptanceCriteria']
};

export class AcceptanceCriteriaGeneratorTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'generate_acceptance_criteria',
      description: 'Generate acceptance criteria for user stories',
      inputSchema: acceptanceCriteriaGeneratorToolInputSchema,
      outputSchema: acceptanceCriteriaGeneratorToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
  }

  async _execute(args) {
    const { userStories } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Generating acceptance criteria...' });
      
      // Placeholder implementation
      const criteriaMap = {};
      userStories.forEach(story => {
        criteriaMap[story.id] = [
          `Given the user is authenticated`,
          `When they perform the action described in ${story.id}`,
          `Then the expected outcome should occur`
        ];
      });
      
      this.emit('progress', { percentage: 100, status: 'Acceptance criteria generated' });
      
      return { acceptanceCriteria: criteriaMap };
      
    } catch (error) {
      throw new Error(`Failed to generate acceptance criteria: ${error.message}`, {
        cause: {
          errorType: 'operation_error'
        }
      })
    }
  }
}