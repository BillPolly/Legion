/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * InterfaceDesignTool - Designs interfaces for boundaries
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const interfaceDesignToolInputSchema = {
  type: 'object',
  properties: {
    useCases: {
      type: 'array',
      items: {},
      description: 'Use cases'
    },
    layers: {
      description: 'Architecture layers'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['useCases', 'layers']
};

// Output schema as plain JSON Schema
const interfaceDesignToolOutputSchema = {
  type: 'object',
  properties: {
    interfaces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          methods: { type: 'array' },
          layer: { type: 'string' }
        }
      },
      description: 'Designed interfaces'
    }
  },
  required: ['interfaces']
};

export class InterfaceDesignTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'design_interfaces',
      description: 'Design interfaces for clean architecture boundaries',
      inputSchema: interfaceDesignToolInputSchema,
      outputSchema: interfaceDesignToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
  }

  async execute(args) {
    try {
      this.emit('progress', { percentage: 0, status: 'Designing interfaces...' });
      
      const interfaces = [{
        id: 'int-1',
        name: 'IEntityRepository',
        methods: [],
        layer: 'application'
      }];
      
      this.emit('progress', { percentage: 100, status: 'Interfaces designed' });
      
      return { interfaces };
    } catch (error) {
      throw new Error(`Failed to design interfaces: ${error.message}`, {
        cause: {
          errorType: 'operation_error'
        }
      })
    }
  }
}