import { BaseTool } from '@jsenvoy/module-loader';
import { z } from 'zod';

const inputSchema = z.object({
  projectId: z.string().describe('Railway project ID to remove')
});

class RailwayRemoveTool extends BaseTool {
  constructor(resourceManager) {
    super();
    this.name = 'railway_remove';
    this.description = 'Remove a deployment or entire project from Railway';
    this.inputSchema = inputSchema;
    this.resourceManager = resourceManager;
  }

  async execute(input) {
    try {
      const validated = this.inputSchema.parse(input);
      const provider = this.resourceManager.get('railwayProvider');
      
      if (!provider) {
        throw new Error('Railway provider not initialized');
      }

      const result = await provider.deleteProject(validated.projectId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove project');
      }

      return {
        success: true,
        message: result.message || `Project ${validated.projectId} removed successfully`
      };

    } catch (error) {
      if (error.name === 'ZodError') {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
}

export default RailwayRemoveTool;