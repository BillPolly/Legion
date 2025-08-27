/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const railwayRemoveToolInputSchema = {
  type: 'object',
  properties: {
    projectId: {
      type: 'string',
      description: 'Railway project ID to remove'
    }
  },
  required: ['projectId']
};

// Output schema as plain JSON Schema
const railwayRemoveToolOutputSchema = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the removal was successful'
    },
    message: {
      type: 'string',
      description: 'Result message'
    }
  },
  required: ['success', 'message']
};

class RailwayRemoveTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_remove',
      description: 'Remove a deployment or entire project from Railway',
      inputSchema: railwayRemoveToolInputSchema,
      outputSchema: railwayRemoveToolOutputSchema,
      execute: async (input) => {
        const provider = this.resourceManager.railwayProvider;
        
        if (!provider) {
          throw new Error('Railway provider not initialized');
        }

        const result = await provider.deleteProject(input.projectId);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to remove project');
        }

        return {
          success: true,
          message: result.message || `Project ${input.projectId} removed successfully`
        };
      },
      getMetadata: () => ({
        description: 'Remove a deployment or entire project from Railway',
        input: railwayRemoveToolInputSchema,
        output: railwayRemoveToolOutputSchema
      })
    });
    this.resourceManager = resourceManager;
  }
}

export default RailwayRemoveTool;