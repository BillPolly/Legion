/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * UserStoryGeneratorTool - Generates user stories from parsed requirements
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const userStoryGeneratorToolInputSchema = {
  type: 'object',
  properties: {
    parsedRequirements: {
      type: 'object',
      properties: {
        functional: {
          type: 'array',
          items: {},
          description: 'Functional requirements'
        },
        nonFunctional: {
          type: 'array',
          items: {},
          description: 'Non-functional requirements'
        }
      },
      required: ['functional'],
      description: 'Parsed requirements to convert to user stories'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['parsedRequirements']
};

// Output schema as plain JSON Schema
const userStoryGeneratorToolOutputSchema = {
  type: 'object',
  properties: {
    userStories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          story: { type: 'string' },
          acceptanceCriteria: { type: 'array' },
          priority: { type: 'string' },
          requirementId: { type: 'string' }
        }
      },
      description: 'Generated user stories'
    },
    count: {
      type: 'integer',
      description: 'Number of user stories generated'
    }
  },
  required: ['userStories', 'count']
};

export class UserStoryGeneratorTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'generate_user_stories',
      description: 'Generate user stories from parsed requirements',
      inputSchema: userStoryGeneratorToolInputSchema,
      outputSchema: userStoryGeneratorToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
    this.designDatabase = dependencies.designDatabase;
  }

  async execute(args) {
    const { parsedRequirements, projectId } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Generating user stories...' });
      
      // Placeholder implementation
      const userStories = parsedRequirements.functional.map((req, index) => ({
        id: `US-${String(index + 1).padStart(3, '0')}`,
        title: req.description.substring(0, 50),
        story: `As a user, I want ${req.description.toLowerCase()} so that I can achieve the intended functionality`,
        acceptanceCriteria: req.acceptanceCriteria || [],
        priority: req.priority || 'medium',
        requirementId: req.id
      }));
      
      this.emit('progress', { percentage: 100, status: 'User stories generated' });
      
      return {
        userStories,
        count: userStories.length
      };
      
    } catch (error) {
      return throw new Error(`Failed to generate user stories: ${error.message}`, {
        cause: {
          errorType: 'operation_error'
        }
      })
    }
  }
}