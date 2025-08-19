import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

const inputSchema = z.object({
  deploymentId: z.string().describe('Railway deployment ID')
});

const outputSchema = z.object({
  status: z.string(),
  url: z.string(),
  createdAt: z.string().optional(),
  domains: z.array(z.string()),
  error: z.string().optional()
});

class RailwayStatusTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_status',
      description: 'Get the status and details of a Railway deployment',
      inputSchema: inputSchema,
      execute: async (input) => {
        const validated = inputSchema.parse(input);
        const provider = this.resourceManager.railwayProvider;
        
        if (!provider) {
          throw new Error('Railway provider not initialized');
        }

        const status = await provider.getStatus(validated.deploymentId);
        
        // Get service domains if deployment is running
        let domains = [];
        if (status.status === 'running' && status.serviceId) {
          try {
            const domainsResult = await provider.getServiceDomains(status.serviceId, null);
            if (domainsResult.success) {
              domains = domainsResult.domains;
            }
          } catch (error) {
            // Ignore domain fetch errors
          }
        }

        return {
          status: status.status,
          url: status.url || 'No URL available',
          createdAt: status.createdAt,
          domains: domains,
          error: status.error
        };
      },
      getMetadata: () => ({
        description: 'Get the status and details of a Railway deployment',
        input: inputSchema,
        output: outputSchema
      })
    });
    this.resourceManager = resourceManager;
  }
}

export default RailwayStatusTool;