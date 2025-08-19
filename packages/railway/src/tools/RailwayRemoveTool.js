import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

const inputSchema = z.object({
  projectId: z.string().describe('Railway project ID to remove')
});

class RailwayRemoveTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_remove',
      description: 'Remove a deployment or entire project from Railway',
      inputSchema: inputSchema,
      execute: async (input) => {
        const validated = inputSchema.parse(input);
        const provider = this.resourceManager.railwayProvider;
        
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
      },
      getMetadata: () => ({
        description: 'Remove a deployment or entire project from Railway',
        input: inputSchema,
        output: z.object({
          success: z.boolean(),
          message: z.string()
        })
      })
    });
    this.resourceManager = resourceManager;
  }
}

export default RailwayRemoveTool;