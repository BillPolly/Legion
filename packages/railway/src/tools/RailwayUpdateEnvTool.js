import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

const inputSchema = z.object({
  serviceId: z.string().describe('Railway service ID'),
  environmentId: z.string().optional().describe('Railway environment ID'),
  variables: z.record(z.string()).describe('Environment variables to set or update')
});

const outputSchema = z.object({
  success: z.boolean(),
  updatedVariables: z.record(z.string()),
  redeploymentId: z.string().nullable(),
  message: z.string()
});

class RailwayUpdateEnvTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_update_env',
      description: 'Update environment variables for a Railway service',
      inputSchema: inputSchema,
      execute: async (input) => {
        const validated = inputSchema.parse(input);
        const provider = this.resourceManager.railwayProvider;
        
        if (!provider) {
          throw new Error('Railway provider not initialized');
        }

        const result = await provider.setEnvironmentVariables(
          validated.serviceId,
          validated.variables,
          validated.environmentId
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to update environment variables');
        }

        // Trigger redeploy to apply changes
        const redeployResult = await provider.redeploy(validated.serviceId);
        
        return {
          success: true,
          updatedVariables: validated.variables,
          redeploymentId: redeployResult.success ? redeployResult.deploymentId : null,
          message: `Environment variables updated for service ${validated.serviceId}`
        };
      },
      getMetadata: () => ({
        description: 'Update environment variables for a Railway service',
        input: inputSchema,
        output: outputSchema
      })
    });
    this.resourceManager = resourceManager;
  }
}

export default RailwayUpdateEnvTool;