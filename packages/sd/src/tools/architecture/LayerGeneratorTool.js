/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * LayerGeneratorTool - Generates clean architecture layers
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const layerGeneratorToolInputSchema = {
  type: 'object',
  properties: {
    boundedContexts: {
      type: 'array',
      items: {},
      description: 'Bounded contexts'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['boundedContexts']
};

// Output schema as plain JSON Schema
const layerGeneratorToolOutputSchema = {
  type: 'object',
  properties: {
    layers: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          dependencies: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      description: 'Architecture layers'
    }
  },
  required: ['layers']
};

export class LayerGeneratorTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'design_layers',
      description: 'Design clean architecture layers',
      inputSchema: layerGeneratorToolInputSchema,
      outputSchema: layerGeneratorToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
  }

  async execute(args) {
    try {
      this.emit('progress', { percentage: 0, status: 'Designing layers...' });
      
      const layers = {
        domain: { name: 'Domain', dependencies: [] },
        application: { name: 'Application', dependencies: ['domain'] },
        infrastructure: { name: 'Infrastructure', dependencies: ['application', 'domain'] },
        presentation: { name: 'Presentation', dependencies: ['application'] }
      };
      
      this.emit('progress', { percentage: 100, status: 'Layers designed' });
      
      return { layers };
    } catch (error) {
      return throw new Error(`Failed to design layers: ${error.message}`, {
        cause: {
          errorType: 'operation_error'
        }
      })
    }
  }
}