import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

const inputSchema = z.object({
  projectName: z.string().describe('Name for the Railway project'),
  source: z.object({
    type: z.enum(['github', 'docker']).describe('Source type for deployment'),
    repository: z.string().describe('GitHub repository (owner/repo) or Docker image'),
    branch: z.string().default('main').describe('Git branch (for GitHub deployments)')
  }).describe('Deployment source configuration'),
  environmentVariables: z.record(z.string()).default({}).describe('Environment variables for the deployment'),
  serviceName: z.string().default('app').describe('Name for the Railway service')
});

class RailwayDeployTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_deploy',
      description: 'Deploy an application to Railway from GitHub repository or Docker image',
      inputSchema: inputSchema,
      execute: async (input) => {
        const validated = inputSchema.parse(input);
        
        // Get provider from resourceManager or module's provider
        let provider;
        if (this.resourceManager && typeof this.resourceManager.get === 'function') {
          provider = this.resourceManager.railwayProvider;
        }
        
        if (!provider) {
          throw new Error('Railway provider not initialized');
        }

        // Prepare deployment configuration
        const config = {
          name: validated.projectName,
          serviceName: validated.serviceName,
          environment: validated.environmentVariables
        };

        // Configure source based on type
        if (validated.source.type === 'github') {
          config.source = 'github';
          config.repo = validated.source.repository;
          config.branch = validated.source.branch;
        } else if (validated.source.type === 'docker') {
          config.image = validated.source.repository;
        }

        // Deploy with domain generation
        const result = await provider.deployWithDomain(config);
        
        if (!result.success) {
          throw new Error(result.error || 'Deployment failed');
        }

        return {
          deploymentId: result.deploymentId,
          projectId: result.projectId,
          serviceId: result.serviceId,
          deploymentUrl: result.url || `Deployment ${result.deploymentId} created`,
          status: result.status,
          message: `Successfully deployed ${validated.projectName} to Railway`
        };
      },
      getMetadata: () => ({
        description: 'Deploy an application to Railway from GitHub repository or Docker image',
        input: inputSchema,
        output: z.object({
          deploymentId: z.string(),
          projectId: z.string(), 
          serviceId: z.string(),
          deploymentUrl: z.string(),
          status: z.string(),
          message: z.string()
        })
      })
    });
    this.resourceManager = resourceManager;
  }

  // Remove old execute method since it's now in constructor
}

export default RailwayDeployTool;