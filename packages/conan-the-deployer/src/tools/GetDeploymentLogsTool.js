import { Tool, ToolResult } from '@legion/module-loader';
import DeploymentManager from '../DeploymentManager.js';
import ResourceManager from '../core/ResourceManager.js';

/**
 * GetDeploymentLogsTool - Retrieve logs from deployments with filtering and search capabilities
 */
class GetDeploymentLogsTool extends Tool {
  constructor() {
    super();
    this.name = 'get_deployment_logs';
    this.description = 'Retrieve logs from deployments with filtering and search capabilities';
    
    // Valid parameters
    this.validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
    this.validFormats = ['structured', 'raw'];
  }

  /**
   * Get tool description for function calling
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'get_deployment_logs',
        description: 'Retrieve logs from deployments with filtering and search capabilities',
        parameters: {
          type: 'object',
          properties: {
            deploymentId: {
              type: 'string',
              description: 'ID of the deployment to retrieve logs from'
            },
            lines: {
              type: 'number',
              description: 'Number of recent log lines to retrieve',
              minimum: 0,
              maximum: 10000,
              default: 100
            },
            follow: {
              type: 'boolean',
              description: 'Stream live logs (tail -f behavior)',
              default: false
            },
            since: {
              type: 'string',
              description: 'Retrieve logs since this timestamp (ISO 8601 format)'
            },
            until: {
              type: 'string',
              description: 'Retrieve logs until this timestamp (ISO 8601 format)'
            },
            level: {
              type: 'string',
              enum: ['debug', 'info', 'warn', 'error', 'fatal'],
              description: 'Filter logs by level'
            },
            search: {
              type: 'string',
              description: 'Search logs for specific text content'
            },
            source: {
              type: 'string',
              description: 'Filter logs by source (stdout, stderr, app, db, etc.)'
            },
            format: {
              type: 'string',
              enum: ['structured', 'raw'],
              description: 'Output format for logs',
              default: 'structured'
            },
            includeTimestamp: {
              type: 'boolean',
              description: 'Include timestamps in output',
              default: true
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
                  status: { type: 'string' }
                }
              },
              logs: {
                type: 'array',
                description: 'Log entries (structured objects or raw strings depending on format)'
              },
              summary: {
                type: 'object',
                properties: {
                  totalLines: { type: 'number' },
                  truncated: { type: 'boolean' },
                  filtered: { type: 'boolean' },
                  timeRange: { type: 'object' },
                  searchTerm: { type: 'string' },
                  level: { type: 'string' },
                  logSource: { type: 'string' },
                  streaming: { type: 'boolean' },
                  message: { type: 'string' }
                }
              },
              format: { type: 'string' },
              followHandle: { type: 'string' },
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
   * Execute the log retrieval
   */
  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      
      // Validate required parameters
      this.validateRequiredParameters(args, ['deploymentId']);
      
      // Validate lines parameter
      if (args.lines !== undefined && (args.lines < 0 || args.lines > 10000)) {
        const linesValidationResult = ToolResult.failure('Lines must be a positive number between 0 and 10000');
        linesValidationResult.deploymentId = args.deploymentId;
        linesValidationResult.suggestions = ['Use a lines value between 0 and 10000'];
        return linesValidationResult;
      }
      
      // Validate timestamp formats
      if (args.since && !this.isValidTimestamp(args.since)) {
        const sinceValidationResult = ToolResult.failure(`Invalid since timestamp format: ${args.since}. Use ISO 8601 format (e.g., 2024-01-01T10:00:00Z)`);
        sinceValidationResult.deploymentId = args.deploymentId;
        sinceValidationResult.suggestions = ['Use ISO 8601 timestamp format: YYYY-MM-DDTHH:mm:ss.sssZ'];
        return sinceValidationResult;
      }
      
      if (args.until && !this.isValidTimestamp(args.until)) {
        const untilValidationResult = ToolResult.failure(`Invalid until timestamp format: ${args.until}. Use ISO 8601 format`);
        untilValidationResult.deploymentId = args.deploymentId;
        untilValidationResult.suggestions = ['Use ISO 8601 timestamp format: YYYY-MM-DDTHH:mm:ss.sssZ'];
        return untilValidationResult;
      }
      
      // Validate level filter
      if (args.level && !this.validLevels.includes(args.level)) {
        const levelValidationResult = ToolResult.failure(
          `Invalid log level: ${args.level}. Must be one of: ${this.validLevels.join(', ')}`
        );
        levelValidationResult.deploymentId = args.deploymentId;
        levelValidationResult.suggestions = ['Use one of: debug, info, warn, error, fatal'];
        return levelValidationResult;
      }
      
      // Validate format
      const format = args.format || 'structured';
      if (!this.validFormats.includes(format)) {
        const formatValidationResult = ToolResult.failure(
          `Invalid format: ${format}. Must be one of: ${this.validFormats.join(', ')}`
        );
        formatValidationResult.deploymentId = args.deploymentId;
        formatValidationResult.suggestions = ['Use one of: structured, raw'];
        return formatValidationResult;
      }
      
      // Get deployment manager
      const deploymentManager = await this.getDeploymentManager();
      if (!deploymentManager) {
        const managerNotAvailableResult = ToolResult.failure('Deployment manager not available. Please initialize the system first.');
        managerNotAvailableResult.deploymentId = args.deploymentId;
        managerNotAvailableResult.suggestions = ['Initialize the deployment system before retrieving logs'];
        return managerNotAvailableResult;
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
      
      this.emitProgress(`Retrieving logs for deployment ${args.deploymentId}`, { 
        deploymentId: args.deploymentId,
        provider: deployment.provider,
        follow: args.follow || false,
        lines: args.lines || 100
      });
      
      // Build log options
      const logOptions = this.buildLogOptions(args);
      
      // Retrieve logs
      const result = await deploymentManager.getDeploymentLogs(args.deploymentId, logOptions);
      
      if (result.success) {
        this.emitInfo(`Retrieved ${result.totalLines || result.logs.length} log lines`, {
          deploymentId: args.deploymentId,
          provider: deployment.provider,
          totalLines: result.totalLines || result.logs.length,
          format: format
        });
        
        // Generate summary
        const summary = this.generateSummary(result, deployment, args);
        
        return ToolResult.success({
          deployment: {
            id: deployment.id,
            name: deployment.name,
            provider: deployment.provider,
            status: deployment.status
          },
          logs: result.logs,
          summary: summary,
          format: format,
          streaming: result.streaming || false,
          followHandle: result.followHandle,
          message: this.getDisplayMessage(result, args),
          nextSteps: this.getNextSteps(result, deployment, args)
        });
      } else {
        this.emitError(`Failed to retrieve logs: ${result.error}`, {
          deploymentId: args.deploymentId,
          provider: deployment.provider,
          error: result.error
        });
        
        const logRetrievalFailureResult = ToolResult.failure(result.error || 'Failed to retrieve deployment logs');
        logRetrievalFailureResult.deploymentId = args.deploymentId;
        logRetrievalFailureResult.provider = deployment.provider;
        logRetrievalFailureResult.suggestions = this.getFailureSuggestions(deployment.provider, result);
        return logRetrievalFailureResult;
      }
      
    } catch (error) {
      this.emitError(`Get deployment logs tool error: ${error.message}`, { error: error.stack });
      
      const errorResult = ToolResult.failure(
        error.message.includes('JSON') ? `Invalid JSON in arguments: ${error.message}` : `Log retrieval failed: ${error.message}`
      );
      errorResult.suggestions = ['Check your parameters and try again'];
      return errorResult;
    }
  }

  /**
   * Build log options from arguments
   */
  buildLogOptions(args) {
    return {
      lines: args.lines || 100,
      follow: args.follow || false,
      since: args.since,
      until: args.until,
      level: args.level,
      search: args.search,
      source: args.source,
      includeTimestamp: args.includeTimestamp !== false, // Default true
      format: args.format || 'structured'
    };
  }

  /**
   * Generate summary from log result
   */
  generateSummary(result, deployment, args) {
    const summary = {
      totalLines: result.totalLines || result.logs.length,
      truncated: result.truncated || false,
      filtered: result.filtered || false,
      logSource: result.logSource,
      streaming: result.streaming || false
    };

    // Add provider-specific information
    if (deployment.provider === 'docker' && result.containerId) {
      summary.containerId = result.containerId;
    } else if (deployment.provider === 'railway' && result.serviceId) {
      summary.serviceId = result.serviceId;
    }

    // Add filtering information
    if (args.level) {
      summary.level = args.level;
    }
    
    if (args.search) {
      summary.searchTerm = args.search;
    }
    
    if (args.since || args.until) {
      summary.timeRange = {};
      if (args.since) summary.timeRange.since = args.since;
      if (args.until) summary.timeRange.until = args.until;
    }
    
    if (result.truncated) {
      summary.availableLines = result.availableLines;
    }
    
    if (result.originalLines && result.originalLines !== summary.totalLines) {
      summary.originalLines = result.originalLines;
    }
    
    if (result.historical) {
      summary.historical = result.historical;
    }

    // Generate descriptive message
    summary.message = this.buildSummaryMessage(summary, deployment, args);

    return summary;
  }

  /**
   * Build summary message
   */
  buildSummaryMessage(summary, deployment, args) {
    const appName = deployment.name || deployment.id;
    let message = '';

    if (summary.streaming) {
      message = `Now streaming live logs from "${appName}"`;
    } else if (summary.historical) {
      message = `Retrieved historical logs from "${appName}" (deployment is stopped)`;
    } else {
      message = `Retrieved ${summary.totalLines} log lines from "${appName}"`;
    }

    if (summary.filtered) {
      message += ' (filtered)';
    }

    if (summary.truncated) {
      message += ` - showing latest ${summary.totalLines} of ${summary.availableLines} available lines`;
    }

    return message;
  }

  /**
   * Get display message for empty or special cases
   */
  getDisplayMessage(result, args) {
    if (result.logs.length === 0) {
      if (args.level || args.search || args.source) {
        return 'No logs found matching the specified filters';
      }
      return 'No logs found for this deployment';
    }
    
    return undefined; // No special message needed
  }

  /**
   * Validate timestamp format
   */
  isValidTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      return date instanceof Date && !isNaN(date.getTime());
    } catch (error) {
      return false;
    }
  }

  /**
   * Get deployment manager instance
   */
  async getDeploymentManager() {
    try {
      const resourceManager = new ResourceManager();
      await resourceManager.initialize();
      
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
   * Get next steps based on result
   */
  getNextSteps(result, deployment, args) {
    const steps = [];
    
    if (result.logs.length === 0) {
      steps.push('Check if the deployment is running and generating logs');
      steps.push('Try different filters or time ranges');
      steps.push('Use monitor_deployment to check deployment health');
    } else {
      if (result.truncated) {
        steps.push('Increase --lines parameter to retrieve more logs');
        steps.push('Use --since parameter to get logs from a specific time');
      }
      
      if (!args.follow && deployment.status === 'running') {
        steps.push('Use --follow flag to stream live logs');
      }
      
      if (args.format === 'structured') {
        steps.push('Use --format raw for plain text log output');
      }
      
      steps.push('Filter logs by level with: --level error');
      steps.push('Search log content with: --search "error message"');
    }
    
    steps.push('Monitor deployment status with: monitor_deployment --id ' + deployment.id);
    
    return steps;
  }

  /**
   * Get failure suggestions based on provider and error
   */
  getFailureSuggestions(provider, result) {
    const suggestions = [];
    
    if (result.error && result.error.includes('permission')) {
      suggestions.push('Check if you have permission to access deployment logs');
      suggestions.push('Verify process ownership and access rights');
    }
    
    if (result.error && result.error.includes('not found')) {
      suggestions.push('The deployment may have been removed or stopped');
      suggestions.push('Use list_deployments to check current status');
    }
    
    if (provider === 'local') {
      suggestions.push('Check if the process is still running');
      suggestions.push('Verify log file permissions and locations');
    } else if (provider === 'docker') {
      suggestions.push('Check Docker daemon status');
      suggestions.push('Verify container is running: docker ps');
      suggestions.push('Try accessing logs directly: docker logs <container-id>');
    } else if (provider === 'railway') {
      suggestions.push('Check Railway service status in the dashboard');
      suggestions.push('Verify Railway API connectivity');
      suggestions.push('Check service logs in Railway dashboard');
    }
    
    suggestions.push('Try retrieving logs with different parameters');
    suggestions.push('Check deployment status with: list_deployments');
    
    return suggestions;
  }
}

export default GetDeploymentLogsTool;