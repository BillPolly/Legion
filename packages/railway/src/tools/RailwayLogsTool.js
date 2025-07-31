import { Tool } from '@legion/module-loader';
import { z } from 'zod';

const inputSchema = z.object({
  deploymentId: z.string().describe('Railway deployment ID'),
  limit: z.number().default(100).describe('Number of log lines to retrieve')
});

class RailwayLogsTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_logs',
      description: 'Retrieve logs from a Railway deployment',
      inputSchema: inputSchema
    });
    this.resourceManager = resourceManager;
  }

  async execute(input) {
    try {
      const validated = this.inputSchema.parse(input);
      const provider = this.resourceManager.get('railwayProvider');
      
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

    } catch (error) {
      if (error.name === 'ZodError') {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
}

export default RailwayLogsTool;