import { Tool } from '@legion/tool-system';
import { z } from 'zod';

const inputSchema = z.object({
  deploymentId: z.string().describe('Railway deployment ID')
});

class RailwayStatusTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_status',
      description: 'Get the status and details of a Railway deployment',
      inputSchema: inputSchema
    });
    this.resourceManager = resourceManager;
  }

  async execute(input) {
    try {
      const validated = this.inputSchema.parse(input);
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

    } catch (error) {
      if (error.name === 'ZodError') {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
}

export default RailwayStatusTool;