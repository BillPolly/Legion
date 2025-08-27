/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const railwayStatusToolInputSchema = {
  type: 'object',
  properties: {
    deploymentId: {
      type: 'string',
      description: 'Railway deployment ID'
    }
  },
  required: ['deploymentId']
};

// Output schema as plain JSON Schema
const railwayStatusToolOutputSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      description: 'Deployment status'
    },
    url: {
      type: 'string',
      description: 'Deployment URL'
    },
    createdAt: {
      type: 'string',
      description: 'Creation timestamp'
    },
    domains: {
      type: 'array',
      items: { type: 'string' },
      description: 'Associated domains'
    },
    error: {
      type: 'string',
      description: 'Error message if any'
    }
  },
  required: ['status', 'url', 'domains']
};

class RailwayStatusTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_status',
      description: 'Get the status and details of a Railway deployment',
      inputSchema: railwayStatusToolInputSchema,
      outputSchema: railwayStatusToolOutputSchema,
      execute: async (input) => {
        const provider = this.resourceManager.railwayProvider;
        
        if (!provider) {
          throw new Error('Railway provider not initialized');
        }

        const status = await provider.getStatus(input.deploymentId);
        
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
        input: railwayStatusToolInputSchema,
        output: railwayStatusToolOutputSchema
      })
    });
    this.resourceManager = resourceManager;
  }
}

export default RailwayStatusTool;