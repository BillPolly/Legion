import { Tool, ToolResult } from '@legion/tools-registry';
import MonitoringSystem from '../MonitoringSystem.js';
import DeploymentManager from '../DeploymentManager.js';
import ResourceManager from '../core/ResourceManager.js';

/**
 * MonitorDeploymentTool - Monitor deployment health, metrics, and logs in real-time
 */
class MonitorDeploymentTool extends Tool {
  constructor() {
    super();
    this.name = 'monitor_deployment';
    this.description = 'Monitor deployment health, metrics, and logs in real-time with configurable alerts and persistence';
    
    // Valid monitoring actions
    this.validActions = ['start', 'stop', 'status', 'metrics', 'logs', 'health'];
    this.validMetricsTypes = ['current', 'historical', 'aggregated'];
  }

  /**
   * Get tool description for function calling
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'monitor_deployment',
        description: 'Monitor deployment health, metrics, and logs with real-time updates',
        parameters: {
          type: 'object',
          properties: {
            deploymentId: {
              type: 'string',
              description: 'ID of the deployment to monitor'
            },
            action: {
              type: 'string',
              enum: ['start', 'stop', 'status', 'metrics', 'logs', 'health'],
              description: 'Monitoring action to perform'
            },
            // Start/configuration options
            interval: {
              type: 'number',
              description: 'Monitoring interval in milliseconds (for start action)',
              minimum: 1000,
              maximum: 300000
            },
            metrics: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['cpu', 'memory', 'network', 'disk', 'http']
              },
              description: 'Metrics to monitor (for start action)'
            },
            persistent: {
              type: 'boolean',
              description: 'Whether to persist monitoring across restarts'
            },
            realtime: {
              type: 'boolean',
              description: 'Enable real-time monitoring updates'
            },
            alertThresholds: {
              type: 'object',
              properties: {
                cpu: { type: 'number', minimum: 0, maximum: 100 },
                memory: { type: 'number', minimum: 0, maximum: 100 },
                responseTime: { type: 'number', minimum: 0 },
                errorRate: { type: 'number', minimum: 0, maximum: 100 }
              },
              description: 'Alert thresholds for various metrics'
            },
            // Metrics-specific options
            metricsType: {
              type: 'string',
              enum: ['current', 'historical', 'aggregated'],
              description: 'Type of metrics to retrieve (for metrics action)'
            },
            timeRange: {
              type: 'string',
              description: 'Time range for historical metrics (e.g., "1h", "24h", "7d")'
            },
            // Logs-specific options
            lines: {
              type: 'number',
              description: 'Number of log lines to retrieve (for logs action)',
              minimum: 1,
              maximum: 10000
            },
            follow: {
              type: 'boolean',
              description: 'Follow logs in real-time (for logs action)'
            },
            level: {
              type: 'string',
              enum: ['error', 'warn', 'info', 'debug'],
              description: 'Minimum log level to include'
            }
          },
          required: ['deploymentId', 'action']
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
                  status: { type: 'string' }
                }
              },
              monitoring: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  interval: { type: 'number' },
                  persistent: { type: 'boolean' },
                  realtime: { type: 'boolean' }
                }
              },
              metrics: { type: 'object' },
              health: { type: 'object' },
              logs: { type: 'array' },
              summary: { type: 'string' },
              nextSteps: { type: 'array', items: { type: 'string' } }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              deploymentId: { type: 'string' },
              action: { type: 'string' },
              suggestions: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    };
  }

  /**
   * Execute monitoring action
   */
  async execute(args) {
    try {
      // If args is a toolCall object, parse it
      if (args.function && args.function.arguments) {
        args = this.parseArguments(args.function.arguments);
      }
      
      // Validate required parameters
      if (!args.deploymentId || !args.action) {
        throw new Error('deploymentId and action are required');
      }
      
      // Validate action
      if (!this.validActions.includes(args.action)) {
        const invalidActionResult = ToolResult.failure(
          `Invalid action: ${args.action}. Must be one of: ${this.validActions.join(', ')}`
        );
        invalidActionResult.deploymentId = args.deploymentId;
        invalidActionResult.action = args.action;
        invalidActionResult.suggestions = ['Use one of the supported actions: start, stop, status, metrics, logs, health'];
        return invalidActionResult;
      }
      
      // Validate action-specific parameters
      const validationResult = this.validateActionParameters(args);
      if (!validationResult.valid) {
        const validationFailureResult = ToolResult.failure(validationResult.error);
        validationFailureResult.deploymentId = args.deploymentId;
        validationFailureResult.action = args.action;
        validationFailureResult.suggestions = validationResult.suggestions;
        return validationFailureResult;
      }
      
      // Get systems
      const { deploymentManager, monitoringSystem } = await this.getSystems();
      if (!deploymentManager || !monitoringSystem) {
        const systemsNotAvailableResult = ToolResult.failure('Deployment or monitoring system not available. Please initialize the system first.');
        systemsNotAvailableResult.deploymentId = args.deploymentId;
        systemsNotAvailableResult.suggestions = ['Initialize the deployment and monitoring systems'];
        return systemsNotAvailableResult;
      }
      
      // Verify deployment exists
      const deployment = await deploymentManager.getDeployment(args.deploymentId);
      if (!deployment) {
        const deploymentNotFoundResult = ToolResult.failure(`Deployment not found: ${args.deploymentId}`);
        deploymentNotFoundResult.deploymentId = args.deploymentId;
        deploymentNotFoundResult.suggestions = [
          'Verify the deployment ID is correct',
          'Use list_deployments to see available deployments'
        ];
        return deploymentNotFoundResult;
      }
      
      this.emitProgress(`Executing ${args.action} monitoring action`, { 
        deploymentId: args.deploymentId,
        action: args.action
      });
      
      // Execute action
      const result = await this.executeAction(args, deployment, monitoringSystem);
      
      if (result.success) {
        this.emitInfo(`Successfully executed ${args.action} for ${args.deploymentId}`, {
          deploymentId: args.deploymentId,
          action: args.action
        });
        
        return ToolResult.success({
          deployment: {
            id: deployment.id,
            name: deployment.name,
            provider: deployment.provider,
            status: deployment.status
          },
          ...result.data,
          summary: result.summary,
          nextSteps: this.getNextSteps(args.action, result.data)
        });
      } else {
        this.emitError(`Failed to execute ${args.action}: ${result.error}`, {
          deploymentId: args.deploymentId,
          action: args.action,
          error: result.error
        });
        
        const actionFailureResult = ToolResult.failure(result.error);
        actionFailureResult.deploymentId = args.deploymentId;
        actionFailureResult.action = args.action;
        actionFailureResult.suggestions = this.getFailureSuggestions(args.action, result);
        return actionFailureResult;
      }
      
    } catch (error) {
      this.emitError(`Monitor deployment tool error: ${error.message}`, { error: error.stack });
      
      const errorResult = ToolResult.failure(
        error.message.includes('JSON') ? `Invalid JSON in arguments: ${error.message}` : `Monitoring failed: ${error.message}`
      );
      errorResult.suggestions = ['Check your parameters and try again'];
      return errorResult;
    }
  }

  /**
   * Validate action-specific parameters
   */
  validateActionParameters(args) {
    const errors = [];
    
    // Validate metrics type
    if (args.action === 'metrics' && args.metricsType && !this.validMetricsTypes.includes(args.metricsType)) {
      errors.push(`Invalid metrics type: ${args.metricsType}. Must be one of: ${this.validMetricsTypes.join(', ')}`);
    }
    
    // Validate logs parameters
    if (args.action === 'logs') {
      if (args.lines !== undefined && (typeof args.lines !== 'number' || args.lines <= 0)) {
        errors.push('Lines must be a positive number');
      }
    }
    
    // Validate start parameters
    if (args.action === 'start') {
      if (args.interval !== undefined && (args.interval < 1000 || args.interval > 300000)) {
        errors.push('Interval must be between 1000ms and 300000ms');
      }
    }
    
    return {
      valid: errors.length === 0,
      error: errors[0],
      suggestions: errors.length > 0 ? ['Check parameter values and valid ranges'] : []
    };
  }

  /**
   * Execute the monitoring action
   */
  async executeAction(args, deployment, monitoringSystem) {
    switch (args.action) {
      case 'start':
        return await this.startMonitoring(args, deployment, monitoringSystem);
      case 'stop':
        return await this.stopMonitoring(args, deployment, monitoringSystem);
      case 'status':
        return await this.getMonitoringStatus(args, deployment, monitoringSystem);
      case 'metrics':
        return await this.getMetrics(args, deployment, monitoringSystem);
      case 'logs':
        return await this.getLogs(args, deployment, monitoringSystem);
      case 'health':
        return await this.getHealthStatus(args, deployment, monitoringSystem);
      default:
        return {
          success: false,
          error: `Unsupported action: ${args.action}`
        };
    }
  }

  /**
   * Start monitoring a deployment
   */
  async startMonitoring(args, deployment, monitoringSystem) {
    const config = {
      interval: args.interval || 30000,
      metrics: args.metrics || ['cpu', 'memory'],
      persistent: args.persistent || false,
      realtime: args.realtime || false,
      alertThresholds: args.alertThresholds
    };
    
    const result = await monitoringSystem.startMonitoring(deployment.id, config);
    
    if (result.success) {
      return {
        success: true,
        data: {
          monitoring: {
            id: result.monitoringId,
            status: 'active',
            interval: config.interval,
            persistent: config.persistent,
            realtime: config.realtime
          }
        },
        summary: `Started monitoring for "${deployment.name}" with ${config.interval}ms interval${config.persistent ? ' (persistent)' : ''}`
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to start monitoring'
      };
    }
  }

  /**
   * Stop monitoring a deployment
   */
  async stopMonitoring(args, deployment, monitoringSystem) {
    const result = await monitoringSystem.stopMonitoring(deployment.id);
    
    if (result.success) {
      return {
        success: true,
        data: {
          monitoring: {
            status: 'stopped'
          }
        },
        summary: `Stopped monitoring for "${deployment.name}"`
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to stop monitoring'
      };
    }
  }

  /**
   * Get monitoring status
   */
  async getMonitoringStatus(args, deployment, monitoringSystem) {
    // This would get the current monitoring status
    return {
      success: true,
      data: {
        monitoring: {
          status: 'active', // This would come from the monitoring system
          interval: 30000,
          persistent: false
        }
      },
      summary: `Monitoring status for "${deployment.name}"`
    };
  }

  /**
   * Get deployment metrics
   */
  async getMetrics(args, deployment, monitoringSystem) {
    const options = {
      type: args.metricsType || 'current',
      timeRange: args.timeRange
    };
    
    const metrics = await monitoringSystem.getMetrics(deployment.id, options);
    
    return {
      success: true,
      data: {
        metrics: metrics
      },
      summary: `Current metrics for "${deployment.name}"`
    };
  }

  /**
   * Get deployment logs
   */
  async getLogs(args, deployment, monitoringSystem) {
    const options = {
      lines: args.lines || 100,
      follow: args.follow || false,
      level: args.level
    };
    
    const result = await monitoringSystem.getLogs(deployment.id, options);
    
    if (result.success) {
      return {
        success: true,
        data: {
          logs: result.logs
        },
        summary: `Retrieved ${result.logs.length} log entries for "${deployment.name}"`
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to retrieve logs'
      };
    }
  }

  /**
   * Get deployment health status
   */
  async getHealthStatus(args, deployment, monitoringSystem) {
    const health = await monitoringSystem.getHealthStatus(deployment.id);
    
    return {
      success: true,
      data: {
        health: health
      },
      summary: `Health status for "${deployment.name}": ${health.status}`
    };
  }

  /**
   * Get monitoring and deployment systems
   */
  async getSystems() {
    try {
      const resourceManager = new ResourceManager();
      await resourceManager.initialize();
      
      let monitoringSystem = resourceManager.monitoring-system;
      let deploymentManager = resourceManager.deployment-manager;
      
      if (!monitoringSystem) {
        monitoringSystem = new MonitoringSystem(resourceManager);
        if (typeof monitoringSystem.initialize === 'function') {
          await monitoringSystem.initialize();
        }
        resourceManager.register('monitoring-system', monitoringSystem);
      }
      
      if (!deploymentManager) {
        const DeploymentManager = (await import('../DeploymentManager.js')).default;
        deploymentManager = new DeploymentManager(resourceManager);
        if (typeof deploymentManager.initialize === 'function') {
          await deploymentManager.initialize();
        }
        resourceManager.register('deployment-manager', deploymentManager);
      }
      
      return { deploymentManager, monitoringSystem };
    } catch (error) {
      console.error('Failed to get systems:', error);
      return { deploymentManager: null, monitoringSystem: null };
    }
  }

  /**
   * Get next steps based on action and result
   */
  getNextSteps(action, data) {
    const steps = [];
    
    switch (action) {
      case 'start':
        steps.push('Check monitoring status with: monitor_deployment --id <deploymentId> --action status');
        steps.push('View current metrics with: monitor_deployment --id <deploymentId> --action metrics');
        if (data.monitoring?.realtime) {
          steps.push('Real-time monitoring is active. Updates will stream automatically.');
        }
        break;
      case 'stop':
        steps.push('Restart monitoring with: monitor_deployment --id <deploymentId> --action start');
        break;
      case 'metrics':
        steps.push('View historical metrics with: monitor_deployment --id <deploymentId> --action metrics --metricsType historical');
        steps.push('Check health status with: monitor_deployment --id <deploymentId> --action health');
        break;
      case 'logs':
        steps.push('Follow logs in real-time with: monitor_deployment --id <deploymentId> --action logs --follow true');
        steps.push('Filter by log level with: monitor_deployment --id <deploymentId> --action logs --level error');
        break;
      case 'health':
        steps.push('View detailed metrics with: monitor_deployment --id <deploymentId> --action metrics');
        if (data.health?.status !== 'healthy') {
          steps.push('Check logs for issues with: monitor_deployment --id <deploymentId> --action logs');
        }
        break;
    }
    
    return steps;
  }

  /**
   * Get failure suggestions based on action and error
   */
  getFailureSuggestions(action, result) {
    const suggestions = [];
    
    if (result.error && result.error.includes('not found')) {
      suggestions.push('Verify the deployment is still running');
      suggestions.push('Check deployment status with: get_deployment_status');
    }
    
    if (result.error && result.error.includes('monitoring')) {
      suggestions.push('Ensure monitoring system is properly initialized');
      suggestions.push('Try restarting the monitoring system');
    }
    
    if (action === 'start') {
      suggestions.push('Check if monitoring is already active for this deployment');
      suggestions.push('Verify system resources are available for monitoring');
    } else if (action === 'logs') {
      suggestions.push('Ensure the deployment is generating logs');
      suggestions.push('Check log file permissions and accessibility');
    } else if (action === 'metrics') {
      suggestions.push('Verify metrics collection is enabled for this provider');
      suggestions.push('Check if the deployment supports the requested metrics');
    }
    
    return suggestions.length > 0 ? suggestions : ['Review the error message and try again'];
  }
}

export default MonitorDeploymentTool;