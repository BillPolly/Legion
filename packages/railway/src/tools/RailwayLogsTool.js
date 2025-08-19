import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

const inputSchema = z.object({
  deploymentId: z.string().describe('Railway deployment ID'),
  limit: z.number().default(100).describe('Number of log lines to retrieve')
});

const outputSchema = z.object({
  logs: z.array(z.string()),
  count: z.number()
});

class RailwayLogsTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_logs',
      description: 'Retrieve logs from a Railway deployment',
      inputSchema: inputSchema,
      execute: async (input) => {
        const validated = inputSchema.parse(input);
        const provider = this.resourceManager.railwayProvider;
        
        if (!provider) {
          throw new Error('Railway provider not initialized');
        }

        const result = await provider.getLogs(validated.deploymentId, {
          limit: validated.limit
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
        input: inputSchema,
        output: outputSchema
      })
    });
    this.resourceManager = resourceManager;
  }
}

export default RailwayLogsTool;