import { Tool } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';
import DeploymentManager from '../DeploymentManager.js';

/**
 * DeployApplicationTool - Deploy applications to various providers (local, Docker, Railway)
 */
class DeployApplicationTool extends Tool {
  constructor() {
    super();
    this.name = 'deploy_application';
    this.description = 'Deploy applications to various providers including local processes, Docker containers, and Railway cloud platform';
    
    // Valid providers
    this.validProviders = ['local', 'docker', 'railway'];
  }

  /**
   * Get tool description for function calling
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'deploy_application',
        description: 'Deploy applications to various providers (local, Docker, Railway)',
        parameters: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['local', 'docker', 'railway'],
              description: 'Deployment provider to use'
            },
            config: {
              type: 'object',
              description: 'Deployment configuration specific to the provider',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the application deployment'
                },
                // Local provider specific
                command: {
                  type: 'string',
                  description: 'Command to run (for local provider)'
                },
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory'
                },
                port: {
                  type: 'number',
                  description: 'Port number for the application'
                },
                // Docker provider specific
                image: {
                  type: 'string',
                  description: 'Docker image name (for docker provider)'
                },
                dockerfile: {
                  type: 'string',
                  description: 'Path to Dockerfile (for docker provider)'
                },
                volumes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Volume mounts (for docker provider)'
                },
                // Railway provider specific
                source: {
                  type: 'string',
                  enum: ['github', 'local'],
                  description: 'Source type (for railway provider)'
                },
                repo: {
                  type: 'string',
                  description: 'GitHub repository (for railway provider with github source)'
                },
                branch: {
                  type: 'string',
                  description: 'Git branch (for railway provider with github source)'
                },
                // Common
                environment: {
                  type: 'object',
                  description: 'Environment variables'
                },
                description: {
                  type: 'string',
                  description: 'Description of the deployment'
                }
              },
              required: ['name']
            }
          },
          required: ['provider', 'config']
        },
        output: {
          success: {
            type: 'object',
            properties: {
              deployment: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Deployment ID' },
                  provider: { type: 'string', description: 'Provider used' },
                  status: { type: 'string', description: 'Current deployment status' },
                  url: { type: 'string', description: 'Application URL if available' },
                  createdAt: { type: 'string', description: 'Creation timestamp' }
                }
              },
              summary: {
                type: 'string',
                description: 'Human-readable deployment summary'
              },
              nextSteps: {
                type: 'array',
                items: { type: 'string' },
                description: 'Suggested next steps'
              }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Error message' },
              provider: { type: 'string', description: 'Provider that failed' },
              suggestions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Suggestions to fix the issue'
              },
              examples: {
                type: 'object',
                description: 'Configuration examples for each provider'
              }
            }
          }
        }
      }
    };
  }

  /**
   * Execute the deployment
   */
  async execute(args) {
    try {
      // If args is a toolCall object, parse it
      if (args.function && args.function.arguments) {
        args = this.parseArguments(args.function.arguments);
      }
      
      // Validate required parameters
      if (!args.provider || !args.config) {
        throw new Error('provider and config are required');
      }
      
      // Validate provider
      if (!this.validProviders.includes(args.provider)) {
        throw new Error(`Invalid provider: ${args.provider}. Must be one of: ${this.validProviders.join(', ')}`, {
          cause: {
            provider: args.provider,
            errorType: 'validation_error',
            suggestions: ['Use one of the supported providers: local, docker, railway'],
            examples: this.getConfigurationExamples()
          }
        });
      }
      
      // Validate config is object
      if (typeof args.config !== 'object' || args.config === null) {
        throw new Error('Config must be an object', {
          cause: {
            provider: args.provider,
            errorType: 'validation_error',
            suggestions: ['Provide configuration as a JSON object'],
            examples: this.getConfigurationExamples()
          }
        });
      }
      
      // Validate config has required name field
      if (!args.config.name) {
        throw new Error('Missing required parameter: config.name', {
          cause: {
            provider: args.provider,
            errorType: 'validation_error',
            suggestions: ['Add a name field to your config object'],
            examples: this.getConfigurationExamples()
          }
        });
      }
      
      // Get deployment manager
      const deploymentManager = await this.getDeploymentManager();
      if (!deploymentManager) {
        throw new Error('Deployment manager not available. Please initialize the system first.', {
          cause: {
            provider: args.provider,
            errorType: 'initialization_error',
            suggestions: ['Initialize the deployment system before deploying applications']
          }
        });
      }
      
      // this.emitProgress(`Starting deployment to ${args.provider}`, { 
      //   provider: args.provider, 
      //   appName: args.config.name 
      // });
      
      // Transform config to match DeploymentConfig schema
      const deploymentConfig = {
        provider: args.provider,
        name: args.config.name,
        env: args.config.environment,
        source: args.config.source,
        branch: args.config.branch,
        projectPath: args.config.projectPath,
        port: args.config.port,
        startCommand: args.config.command,
        railway: args.config.railway,
        docker: args.config.docker
      };
      
      // Execute deployment
      const result = await deploymentManager.deploy(deploymentConfig);
      
      if (result.success) {
        // this.emitInfo(`Successfully deployed ${args.config.name} to ${args.provider}`, {
        //   deploymentId: result.id,
        //   provider: args.provider,
        //   url: result.url
        // });
        
        return {
          deployment: {
            id: result.id,
            provider: result.provider,
            status: result.status,
            url: result.url,
            createdAt: result.createdAt
          },
          summary: `Successfully deployed "${args.config.name}" to ${args.provider} provider. ${result.url ? `Available at: ${result.url}` : 'No URL available yet.'}`,
          nextSteps: this.getNextSteps(args.provider, result)
        };
      } else {
        // this.emitError(`Deployment failed: ${result.error}`, {
        //   provider: args.provider,
        //   error: result.error
        // });
        
        throw new Error(result.error || 'Deployment failed', {
          cause: {
            provider: args.provider,
            errorType: 'deployment_error',
            suggestions: this.getFailureSuggestions(args.provider, result),
            examples: this.getConfigurationExamples()
          }
        });
      }
      
    } catch (error) {
      // this.emitError(`Deployment tool error: ${error.message}`, { error: error.stack });
      
      // Re-throw if already has proper structure
      if (error.cause && error.cause.errorType) {
        throw error;
      }
      
      // Wrap other errors
      throw new Error(
        error.message.includes('JSON') ? `Invalid JSON in arguments: ${error.message}` : `Deployment failed: ${error.message}`,
        {
          cause: {
            errorType: error.message.includes('JSON') ? 'validation_error' : 'deployment_error',
            suggestions: ['Check your configuration and try again'],
            examples: this.getConfigurationExamples()
          }
        }
      );
    }
  }

  /**
   * Get deployment manager instance
   */
  async getDeploymentManager() {
    try {
      // Try to get from resource manager first
      const resourceManager = await ResourceManager.getInstance();
      
      let deploymentManager;
      
      if (resourceManager.get('deployment-manager')) {
        deploymentManager = resourceManager.get('deployment-manager');
      } else {
        // Create new deployment manager if not available
        deploymentManager = new DeploymentManager({ resourceManager });
        if (typeof deploymentManager.initialize === 'function') {
          await deploymentManager.initialize();
        }
        resourceManager.register('deployment-manager', deploymentManager);
      }
      
      return deploymentManager;
    } catch (error) {
      console.error('Failed to get deployment manager:', error);
      // Failed to get deployment manager - return null to trigger mock fallback
      return null;
    }
  }

  /**
   * Get next steps based on deployment result
   */
  getNextSteps(provider, result) {
    const steps = [];
    
    if (result.url) {
      steps.push(`Visit your application at: ${result.url}`);
    }
    
    steps.push(`Check deployment status with: monitor_deployment --id ${result.id}`);
    
    if (provider === 'local') {
      steps.push('View logs with: get_deployment_logs --id ' + result.id);
      steps.push('Stop deployment with: stop_deployment --id ' + result.id);
    } else if (provider === 'docker') {
      steps.push('Scale deployment with: update_deployment --id ' + result.id + ' --replicas 2');
      steps.push('View container logs with: get_deployment_logs --id ' + result.id);
    } else if (provider === 'railway') {
      steps.push('Add custom domain with: add_custom_domain --id ' + result.id + ' --domain your-domain.com');
      steps.push('Set environment variables with: update_deployment --id ' + result.id + ' --env');
    }
    
    return steps;
  }

  /**
   * Get failure suggestions based on provider and error
   */
  getFailureSuggestions(provider, result) {
    const suggestions = [];
    
    if (result.error && result.error.includes('port')) {
      suggestions.push('Try using a different port number');
      suggestions.push('Check if the port is already in use');
    }
    
    if (result.error && result.error.includes('Docker')) {
      suggestions.push('Ensure Docker is installed and running');
      suggestions.push('Check Docker daemon status');
    }
    
    if (result.error && result.error.includes('Railway')) {
      suggestions.push('Verify your Railway API key is set correctly');
      suggestions.push('Check your repository permissions');
    }
    
    if (result.error && result.error.includes('custom domain')) {
      suggestions.push('Use Docker or Railway provider for custom domain support');
    }
    
    if (provider === 'local') {
      suggestions.push('Ensure your project has a valid start command');
      suggestions.push('Check that all dependencies are installed');
    } else if (provider === 'docker') {
      suggestions.push('Verify your Docker image exists or Dockerfile is valid');
      suggestions.push('Check that exposed ports match your configuration');
    } else if (provider === 'railway') {
      suggestions.push('Ensure your GitHub repository is accessible');
      suggestions.push('Check that your branch exists and has commits');
    }
    
    return suggestions.length > 0 ? suggestions : ['Review your configuration and try again'];
  }

  /**
   * Get configuration examples for all providers
   */
  getConfigurationExamples() {
    return {
      local: {
        name: 'my-node-app',
        command: 'npm start',
        projectPath: './my-app',
        port: 3000,
        environment: {
          NODE_ENV: 'development',
          PORT: '3000'
        }
      },
      docker: {
        name: 'my-container',
        image: 'node:18',
        port: 8080,
        environment: {
          NODE_ENV: 'production'
        },
        volumes: [
          '/host/data:/app/data'
        ]
      },
      railway: {
        name: 'my-railway-app',
        source: 'github',
        repo: 'username/my-repo',
        branch: 'main',
        environment: {
          NODE_ENV: 'production',
          API_KEY: 'your-api-key'
        }
      }
    };
  }
}

export default DeployApplicationTool;