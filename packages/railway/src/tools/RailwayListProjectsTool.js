import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

const inputSchema = z.object({});

const outputSchema = z.object({
  projects: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.string(),
    serviceCount: z.number(),
    services: z.array(z.object({
      id: z.string(),
      name: z.string()
    }))
  })),
  count: z.number()
});

class RailwayListProjectsTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_list_projects',
      description: 'List all Railway projects in the account',
      inputSchema: inputSchema,
      execute: async (input) => {
        const provider = this.resourceManager.railwayProvider;
        
        if (!provider) {
          throw new Error('Railway provider not initialized');
        }

        const result = await provider.listProjects();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to list projects');
        }

        // Format projects for output
        const projects = result.projects.map(project => ({
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          serviceCount: project.services.length,
          services: project.services.map(s => ({
            id: s.id,
            name: s.name
          }))
        }));

        return {
          projects: projects,
          count: projects.length
        };
      },
      getMetadata: () => ({
        description: 'List all Railway projects in the account',
        input: inputSchema,
        output: outputSchema
      })
    });
    this.resourceManager = resourceManager;
  }
}

export default RailwayListProjectsTool;