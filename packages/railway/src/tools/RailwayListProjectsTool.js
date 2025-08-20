/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const railwayListProjectsToolInputSchema = {
  type: 'object',
  properties: {},
  required: []
};

// Output schema as plain JSON Schema
const railwayListProjectsToolOutputSchema = {
  type: 'object',
  properties: {
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          createdAt: { type: 'string' },
          serviceCount: { type: 'number' },
          services: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            }
          }
        }
      },
      description: 'List of Railway projects'
    },
    count: {
      type: 'number',
      description: 'Total number of projects'
    }
  },
  required: ['projects', 'count']
};

class RailwayListProjectsTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_list_projects',
      description: 'List all Railway projects in the account',
      inputSchema: railwayListProjectsToolInputSchema,
      outputSchema: railwayListProjectsToolOutputSchema,
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
        input: railwayListProjectsToolInputSchema,
        output: railwayListProjectsToolOutputSchema
      })
    });
    this.resourceManager = resourceManager;
  }
}

export default RailwayListProjectsTool;