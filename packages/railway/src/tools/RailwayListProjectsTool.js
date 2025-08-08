import { Tool } from '@legion/tools';
import { z } from 'zod';

const inputSchema = z.object({});

class RailwayListProjectsTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_list_projects',
      description: 'List all Railway projects in the account',
      inputSchema: inputSchema
    });
    this.resourceManager = resourceManager;
  }

  async execute(input) {
    try {
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

    } catch (error) {
      if (error.name === 'ZodError') {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
}

export default RailwayListProjectsTool;