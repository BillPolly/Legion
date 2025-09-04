/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * UseCaseGeneratorTool - Generates use cases from requirements
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const useCaseGeneratorToolInputSchema = {
  type: 'object',
  properties: {
    userStories: {
      type: 'array',
      items: {},
      description: 'User stories'
    },
    entities: {
      type: 'array',
      items: {},
      description: 'Domain entities'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['userStories', 'entities']
};

// Output schema as plain JSON Schema
const useCaseGeneratorToolOutputSchema = {
  type: 'object',
  properties: {
    useCases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          input: { type: 'object' },
          output: { type: 'object' },
          steps: { type: 'array' },
          layer: { type: 'string' }
        }
      },
      description: 'Generated use cases'
    }
  },
  required: ['useCases']
};

export class UseCaseGeneratorTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'generate_use_cases',
      description: 'Generate use cases from user stories and entities',
      inputSchema: useCaseGeneratorToolInputSchema,
      outputSchema: useCaseGeneratorToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
  }

  async _execute(args) {
    try {
      this.emit('progress', { percentage: 0, status: 'Generating use cases...' });
      
      const useCases = [{
        id: 'uc-1',
        name: 'CreateEntity',
        input: {},
        output: {},
        steps: [],
        layer: 'application'
      }];
      
      this.emit('progress', { percentage: 100, status: 'Use cases generated' });
      
      return { useCases };
    } catch (error) {
      throw new Error(`Failed to generate use cases: ${error.message}`, {
        cause: {
          errorType: 'operation_error'
        }
      })
    }
  }
}