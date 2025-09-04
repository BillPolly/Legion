/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const railwayDeployToolInputSchema = {
  type: 'object',
  properties: {
    projectName: {
      type: 'string',
      description: 'Name for the Railway project'
    },
    source: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['github', 'docker'],
          description: 'Source type for deployment'
        },
        repository: {
          type: 'string',
          description: 'GitHub repository (owner/repo) or Docker image'
        },
        branch: {
          type: 'string',
          default: 'main',
          description: 'Git branch (for GitHub deployments)'
        }
      },
      required: ['type', 'repository'],
      description: 'Deployment source configuration'
    },
    environmentVariables: {
      type: 'object',
      additionalProperties: {
        type: 'string'
      },
      default: {},
      description: 'Environment variables for the deployment'
    },
    serviceName: {
      type: 'string',
      default: 'app',
      description: 'Name for the Railway service'
    }
  },
  required: ['projectName', 'source']
};

// Output schema as plain JSON Schema
const railwayDeployToolOutputSchema = {
  type: 'object',
  properties: {
    deploymentId: {
      type: 'string',
      description: 'Railway deployment ID'
    },
    projectId: {
      type: 'string',
      description: 'Railway project ID'
    },
    serviceId: {
      type: 'string',
      description: 'Railway service ID'
    },
    deploymentUrl: {
      type: 'string',
      description: 'Deployment URL'
    },
    status: {
      type: 'string',
      description: 'Deployment status'
    },
    message: {
      type: 'string',
      description: 'Success message'
    }
  },
  required: ['deploymentId', 'projectId', 'serviceId', 'deploymentUrl', 'status', 'message']
};

class RailwayDeployTool extends Tool {
  constructor(resourceManager) {
    super({
      name: 'railway_deploy',
      description: 'Deploy an application to Railway from GitHub repository or Docker image',
      inputSchema: railwayDeployToolInputSchema,
      outputSchema: railwayDeployToolOutputSchema
    });
    
    this.resourceManager = resourceManager;
  }
  
  async _execute(input) {
    // Get provider from resourceManager
    let provider;
    if (this.resourceManager) {
      if (typeof this.resourceManager.get === 'function') {
        provider = this.resourceManager.get('railwayProvider');
      } else {
        provider = this.resourceManager.railwayProvider;
      }
    }
    
    if (!provider) {
      throw new Error('Railway provider not initialized');
    }

    // Prepare deployment configuration with defaults
    const config = {
      name: input.projectName,
      serviceName: input.serviceName || 'app',
      environment: input.environmentVariables || {}
    };

    // Configure source based on type
    if (input.source.type === 'github') {
      config.source = 'github';
      config.repo = input.source.repository;
      config.branch = input.source.branch;
    } else if (input.source.type === 'docker') {
      config.image = input.source.repository;
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
      message: `Successfully deployed ${input.projectName} to Railway`
    };
  }
}

export default RailwayDeployTool;