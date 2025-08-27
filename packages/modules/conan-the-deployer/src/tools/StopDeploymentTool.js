import { Tool } from '@legion/tools-registry';
import DeploymentManager from '../DeploymentManager.js';
import { ResourceManager } from '@legion/resource-manager';

/**
 * StopDeploymentTool - Stop running deployments with graceful shutdown options
 */
class StopDeploymentTool extends Tool {
  constructor() {
    super();
    this.name = 'stop_deployment';
    this.description = 'Stop running deployments with graceful shutdown options and cleanup capabilities';
    
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
        name: 'stop_deployment',
        description: 'Stop running deployments with graceful shutdown and cleanup options',
        parameters: {
          type: 'object',
          properties: {
            deploymentId: {
              type: 'string',
              description: 'ID of the deployment to stop (or "all" to stop all deployments)'
            },
            provider: {
              type: 'string',
              enum: ['local', 'docker', 'railway'],
              description: 'Provider filter when stopping all deployments'
            },
            graceful: {
              type: 'boolean',
              description: 'Attempt graceful shutdown before forcing',
              default: true
            },
            timeout: {
              type: 'number',
              description: 'Timeout for graceful shutdown in milliseconds',
              minimum: 1000,
              maximum: 300000,
              default: 30000
            },
            force: {
              type: 'boolean',
              description: 'Force immediate shutdown without graceful period',
              default: false
            },
            cleanup: {
              type: 'boolean',
              description: 'Perform cleanup after stopping (remove containers, networks, etc.)',
              default: false
            },
            removeVolumes: {
              type: 'boolean',
              description: 'Remove associated volumes during cleanup',
              default: false
            },
            signal: {
              type: 'string',
              enum: ['SIGTERM', 'SIGINT', 'SIGKILL'],
              description: 'Signal to send for graceful shutdown (local deployments)',
              default: 'SIGTERM'
            },
            drainConnections: {
              type: 'boolean',
              description: 'Wait for existing connections to complete',
              default: true
            },
            notifyUsers: {
              type: 'boolean',
              description: 'Notify users before stopping (if applicable)',
              default: false
            }
          },
          required: ['deploymentId']
        },
        output: {
          success: {
            type: 'object',
            properties: {
              deployment: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  provider: { type: 'string' },
                  previousStatus: { type: 'string' }
                }
              },
              stop: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  graceful: { type: 'boolean' },
                  forced: { type: 'boolean' },
                  timedOut: { type: 'boolean' },
                  shutdownTime: { type: 'number' },
                  stoppedAt: { type: 'string' },
                  signal: { type: 'string' },
                  cleanup: { type: 'object' }
                }
              },
              summary: { type: 'string' },
              nextSteps: { type: 'array', items: { type: 'string' } }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              deploymentId: { type: 'string' },
              provider: { type: 'string' },
              suggestions: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    };
  }

  /**
   * Execute the stop operation
   */
  async execute(args) {
    try {
      // If args is a toolCall object, parse it
      if (args.function && args.function.arguments) {
        args = this.parseArguments(args.function.arguments);
      }
      
      // Validate required parameters
      if (!args.deploymentId) {
        throw new Error('deploymentId is required');
      }
      
      // Validate timeout
      if (args.timeout !== undefined && (args.timeout < 1000 || args.timeout > 300000)) {
        throw new Error('Timeout must be a positive number between 1000ms and 300000ms', {
      cause: {
        errorType: 'operation_error',
        deploymentId: args.deploymentId,
        suggestions: ['Use a timeout between 1 second and 5 minutes']
      }
    });
      }
      
      // Validate provider (when stopping all)
      if (args.deploymentId === 'all' && args.provider && !this.validProviders.includes(args.provider)) {
        throw new Error(`Invalid provider: ${args.provider}. Must be one of: ${this.validProviders.join(', ')}`, {
        cause: {
          errorType: 'operation_error',
          deploymentId: args.deploymentId,
          suggestions: ['Use one of: local, docker, railway']
        }
      });
      }
      
      // Get deployment manager
      const deploymentManager = await this.getDeploymentManager();
      if (!deploymentManager) {
        throw new Error('Deployment manager not available. Please initialize the system first.', {
      cause: {
        errorType: 'operation_error',
        deploymentId: args.deploymentId,
        suggestions: ['Initialize the deployment system before stopping deployments']
      }
    });
      }
      
      // Handle "stop all" case
      if (args.deploymentId === 'all') {
        return await this.stopAllDeployments(args, deploymentManager);
      }
      
      // Verify deployment exists and is running
      const deployment = await deploymentManager.getDeployment(args.deploymentId);
      if (!deployment) {
        throw new Error(`Deployment not found: ${args.deploymentId}`, {
      cause: {
        errorType: 'operation_error',
        deploymentId: args.deploymentId,
        suggestions: [
          'Verify the deployment ID is correct',
          'Use list_deployments to see available deployments'
        ]
      }
    });
      }
      
      // Check if deployment is already stopped
      if (deployment.status === 'stopped' || deployment.status === 'failed') {
        throw new Error(`Deployment ${args.deploymentId} is already stopped (status: ${deployment.status})`, {
      cause: {
        errorType: 'operation_error',
        deploymentId: args.deploymentId,
        provider: deployment.provider,
        suggestions: [
          'Use list_deployments to see current deployment statuses',
          'Start the deployment again if needed with deploy_application'
        ]
      }
    });
      }
      
      // this.emitProgress(`Stopping deployment ${args.deploymentId}`, { 
      //   deploymentId: args.deploymentId,
      //   provider: deployment.provider,
      //   graceful: args.graceful !== false
      // });
      
      // Build stop options
      const stopOptions = this.buildStopOptions(args);
      
      // Execute stop
      const result = await deploymentManager.stopDeployment(args.deploymentId, stopOptions);
      
      if (result.success) {
        // this.emitInfo(`Successfully stopped ${args.deploymentId}`, {
        //   deploymentId: args.deploymentId,
        //   provider: deployment.provider,
        //   graceful: result.graceful,
        //   shutdownTime: result.shutdownTime
        // });
        
        return {
          deployment: {
            id: deployment.id,
            name: deployment.name,
            provider: deployment.provider,
            previousStatus: deployment.status
          },
          stop: {
            status: result.status,
            graceful: result.graceful,
            forced: result.forced,
            timedOut: result.timedOut,
            shutdownTime: result.shutdownTime,
            stoppedAt: result.stoppedAt,
            signal: result.signal,
            containerStopped: result.containerStopped,
            serviceScaledDown: result.serviceScaledDown,
            cleanup: result.cleanup
          },
          summary: this.buildSummary(result, deployment),
          nextSteps: this.getNextSteps(deployment.provider, result)
        };
      } else {
        // this.emitError(`Failed to stop deployment: ${result.error}`, {
        //   deploymentId: args.deploymentId,
        //   provider: deployment.provider,
        //   error: result.error
        // });
        
        throw new Error(result.error || 'Failed to stop deployment', {
      cause: {
        errorType: 'operation_error',
        deploymentId: args.deploymentId,
        provider: deployment.provider,
        suggestions: this.getFailureSuggestions(deployment.provider, result)
      }
    });
      }
      
    } catch (error) {
      // this.emitError(`Stop deployment tool error: ${error.message}`, { error: error.stack });
      
      throw new Error(error.message.includes('JSON') ? `Invalid JSON in arguments: ${error.message}` : `Stop failed: ${error.message}`, {
        cause: {
          errorType: 'operation_error',
          suggestions: ['Check your parameters and try again']
        }
      });
    }
  }

  /**
   * Stop all deployments
   */
  async stopAllDeployments(args, deploymentManager) {
    try {
      const filterOptions = args.provider ? { provider: args.provider } : {};
      const stopOptions = this.buildStopOptions(args);
      
      const result = await deploymentManager.stopDeployment('all', { ...stopOptions, ...filterOptions });
      
      if (result.success) {
        return {
          stop: {
            totalStopped: result.totalStopped || result.stopped?.length || 0,
            stopped: result.stopped,
            failed: result.failed
          },
          summary: `Stopped ${result.totalStopped || 0} deployments${args.provider ? ` for ${args.provider} provider` : ''}`,
          nextSteps: [
            'Use list_deployments to verify all deployments are stopped',
            'Deploy new applications as needed with deploy_application'
          ]
        };
      } else {
        throw new Error(result.error || 'Failed to stop deployments', {
      cause: {
        errorType: 'operation_error',
        suggestions: ['Try stopping deployments individually', 'Check system status and logs']
      }
    });
      }
    } catch (error) {
      throw new Error(`Failed to stop all deployments: ${error.message}`, {
      cause: {
        errorType: 'operation_error',
        suggestions: ['Try stopping deployments individually']
      }
    });
    }
  }

  /**
   * Build stop options from arguments
   */
  buildStopOptions(args) {
    return {
      graceful: args.graceful !== false, // Default true
      timeout: args.timeout || 30000,
      force: args.force || false,
      cleanup: args.cleanup || false,
      removeVolumes: args.removeVolumes || false,
      signal: args.signal || 'SIGTERM',
      drainConnections: args.drainConnections !== false, // Default true
      notifyUsers: args.notifyUsers || false
    };
  }

  /**
   * Build summary message based on stop result
   */
  buildSummary(result, deployment) {
    const appName = deployment.name || deployment.id;
    const provider = deployment.provider;
    
    let summary = '';
    
    if (provider === 'local') {
      summary = `Local process stopped for "${appName}"`;
    } else if (provider === 'docker') {
      summary = `Docker container stopped for "${appName}"`;
    } else if (provider === 'railway') {
      summary = `Railway service stopped for "${appName}"`;
    } else {
      summary = `Deployment stopped for "${appName}"`;
    }
    
    if (result.graceful) {
      summary += ' (gracefully stopped';
      if (result.shutdownTime) {
        summary += ` in ${result.shutdownTime}ms`;
      }
      summary += ')';
    } else if (result.forced) {
      summary += ' (forcefully stopped)';
    } else if (result.timedOut) {
      summary += ' (graceful shutdown timed out, then forced)';
    }
    
    if (result.cleanup?.performed) {
      summary += ', cleanup completed';
      if (result.cleanup.preservedVolumes) {
        summary += `, ${result.cleanup.preservedVolumes} volumes preserved`;
      }
    }
    
    return summary;
  }

  /**
   * Get deployment manager instance
   */
  async getDeploymentManager() {
    try {
      const resourceManager = await ResourceManager.getInstance();
      
      let deploymentManager = resourceManager.get('deployment-manager');
      
      if (!deploymentManager) {
        deploymentManager = new DeploymentManager(resourceManager);
        if (typeof deploymentManager.initialize === 'function') {
          await deploymentManager.initialize();
        }
        resourceManager.register('deployment-manager', deploymentManager);
      }
      
      return deploymentManager;
    } catch (error) {
      console.error('Failed to get deployment manager:', error);
      return null;
    }
  }

  /**
   * Get next steps based on provider and result
   */
  getNextSteps(provider, result) {
    const steps = [];
    
    if (result.timedOut) {
      steps.push('Consider increasing timeout for future stops of this deployment');
      steps.push('Investigate why the application took so long to shut down gracefully');
    }
    
    steps.push('Verify the deployment is fully stopped with: list_deployments');
    
    if (result.cleanup?.performed) {
      steps.push('Cleanup was performed - resources have been freed');
    } else {
      steps.push('Run cleanup manually if needed to free resources');
    }
    
    if (provider === 'docker') {
      steps.push('Check Docker containers with: docker ps -a');
      if (!result.cleanup?.performed) {
        steps.push('Remove container manually with: docker rm <container-id>');
      }
    }
    
    steps.push('Restart the deployment when ready with: deploy_application');
    steps.push('Monitor system resources after stopping');
    
    return steps;
  }

  /**
   * Get failure suggestions based on provider and error
   */
  getFailureSuggestions(provider, result) {
    const suggestions = [];
    
    if (result.error && result.error.includes('permission')) {
      suggestions.push('Check if you have permission to stop this deployment');
      suggestions.push('Verify process ownership and access rights');
    }
    
    if (result.error && result.error.includes('not found')) {
      suggestions.push('The deployment may have already been stopped or removed');
      suggestions.push('Use list_deployments to check current status');
    }
    
    if (provider === 'local') {
      suggestions.push('Check if the process is still running with: ps aux | grep <app>');
      suggestions.push('Try force stop with --force flag');
    } else if (provider === 'docker') {
      suggestions.push('Check Docker daemon status');
      suggestions.push('Try stopping the container directly: docker stop <container-id>');
      suggestions.push('Use --force flag for immediate termination');
    } else if (provider === 'railway') {
      suggestions.push('Check Railway service status in the dashboard');
      suggestions.push('Verify Railway API connectivity');
    }
    
    suggestions.push('Check deployment logs for shutdown issues');
    suggestions.push('Try graceful stop with longer timeout');
    
    return suggestions;
  }
}

export default StopDeploymentTool;