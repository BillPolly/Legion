/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const railwayUpdateEnvToolInputSchema = {
  type: 'object',
  properties: {
    serviceId: {
      type: 'string',
      description: 'Railway service ID'
    },
    environmentId: {
      type: 'string',
      description: 'Railway environment ID'
    },
    variables: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Environment variables to set or update'
    }
  },
  required: ['serviceId', 'variables']
};

// Output schema as plain JSON Schema
const railwayUpdateEnvToolOutputSchema = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the update was successful'
    },
    updatedVariables: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Variables that were updated'
    },
    redeploymentId: {
      type: ['string', 'null'],
      description: 'ID of the redeployment'
    },
    message: {
      type: 'string',
      description: 'Result message'
    }
  },
  required: ['success', 'updatedVariables', 'message']
};

class RailwayUpdateEnvTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_update_env',
      description: 'Update environment variables for a Railway service',
      inputSchema: railwayUpdateEnvToolInputSchema,
      outputSchema: railwayUpdateEnvToolOutputSchema,
      execute: async (input) => {
        const provider = this.resourceManager.railwayProvider;
        
        if (!provider) {
          throw new Error('Railway provider not initialized');
        }

        const result = await provider.setEnvironmentVariables(
          input.serviceId,
          input.variables,
          input.environmentId
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to update environment variables');
        }

        // Trigger redeploy to apply changes
        const redeployResult = await provider.redeploy(input.serviceId);
        
        return {
          success: true,
          updatedVariables: input.variables,
          redeploymentId: redeployResult.success ? redeployResult.deploymentId : null,
          message: `Environment variables updated for service ${input.serviceId}`
        };
      },
      getMetadata: () => ({
        description: 'Update environment variables for a Railway service',
        input: railwayUpdateEnvToolInputSchema,
        output: railwayUpdateEnvToolOutputSchema
      })
    });
    this.resourceManager = resourceManager;
  }
}

export default RailwayUpdateEnvTool;