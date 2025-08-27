/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const railwayLogsToolInputSchema = {
  type: 'object',
  properties: {
    deploymentId: {
      type: 'string',
      description: 'Railway deployment ID'
    },
    limit: {
      type: 'number',
      default: 100,
      description: 'Number of log lines to retrieve'
    }
  },
  required: ['deploymentId']
};

// Output schema as plain JSON Schema
const railwayLogsToolOutputSchema = {
  type: 'object',
  properties: {
    logs: {
      type: 'array',
      items: { type: 'string' },
      description: 'Log lines'
    },
    count: {
      type: 'number',
      description: 'Number of log lines retrieved'
    }
  },
  required: ['logs', 'count']
};

class RailwayLogsTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_logs',
      description: 'Retrieve logs from a Railway deployment',
      inputSchema: railwayLogsToolInputSchema,
      outputSchema: railwayLogsToolOutputSchema,
      execute: async (input) => {
        const provider = this.resourceManager.railwayProvider;
        
        if (!provider) {
          throw new Error('Railway provider not initialized');
        }

        const result = await provider.getLogs(input.deploymentId, {
          limit: input.limit || 100
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to retrieve logs');
        }

        return {
          logs: result.logs,
          count: result.logs.length
        };
      },
      getMetadata: () => ({
        description: 'Retrieve logs from a Railway deployment',
        input: railwayLogsToolInputSchema,
        output: railwayLogsToolOutputSchema
      })
    });
    this.resourceManager = resourceManager;
  }
}

export default RailwayLogsTool;