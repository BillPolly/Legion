import { Tool } from '@legion/tools-registry';
import DeploymentManager from '../DeploymentManager.js';
import ResourceManager from '../core/ResourceManager.js';

/**
 * ListDeploymentsTool - List and filter deployments across all providers
 */
class ListDeploymentsTool extends Tool {
  constructor() {
    super();
    this.name = 'list_deployments';
    this.description = 'List and filter deployments across all providers with flexible formatting and sorting options';
    
    // Valid providers and statuses
    this.validProviders = ['local', 'docker', 'railway'];
    this.validStatuses = ['running', 'stopped', 'building', 'failed', 'pending'];
    this.validFormats = ['table', 'json', 'summary'];
    this.validSortFields = ['name', 'provider', 'status', 'createdAt', 'updatedAt'];
  }

  /**
   * Get tool description for function calling
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'list_deployments',
        description: 'List and filter deployments across all providers',
        parameters: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['local', 'docker', 'railway'],
              description: 'Filter by deployment provider'
            },
            status: {
              type: 'string',
              enum: ['running', 'stopped', 'building', 'failed', 'pending'],
              description: 'Filter by deployment status'
            },
            search: {
              type: 'string',
              description: 'Search deployments by name or ID'
            },
            format: {
              type: 'string',
              enum: ['table', 'json', 'summary'],
              description: 'Output format',
              default: 'table'
            },
            sortBy: {
              type: 'string',
              enum: ['name', 'provider', 'status', 'createdAt', 'updatedAt'],
              description: 'Field to sort by',
              default: 'createdAt'
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort order',
              default: 'desc'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of deployments to return',
              minimum: 1,
              maximum: 1000,
              default: 50
            },
            offset: {
              type: 'number',
              description: 'Number of deployments to skip (for pagination)',
              minimum: 0,
              default: 0
            },
            includeMetrics: {
              type: 'boolean',
              description: 'Include performance metrics in the output',
              default: false
            },
            includeUrls: {
              type: 'boolean',
              description: 'Include deployment URLs in the output',
              default: true
            }
          },
          required: []
        },
        output: {
          success: {
            type: 'object',
            properties: {
              deployments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    provider: { type: 'string' },
                    status: { type: 'string' },
                    url: { type: 'string' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' }
                  }
                }
              },
              summary: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  byProvider: { type: 'object' },
                  byStatus: { type: 'object' }
                }
              },
              format: { type: 'string' },
              table: { type: 'object' },
              pagination: { type: 'object' },
              nextSteps: { type: 'array', items: { type: 'string' } }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              suggestions: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    };
  }

  /**
   * Execute the listing
   */
  async execute(args) {
    try {
      // If args is a toolCall object, parse it
      if (args.function && args.function.arguments) {
        args = this.parseArguments(args.function.arguments);
      }
      
      // Validate provider filter
      if (args.provider && !this.validProviders.includes(args.provider)) {
        throw new Error(`Invalid provider: ${args.provider}. Must be one of: ${this.validProviders.join(', ')}`, {
          cause: {
            errorType: 'validation_error',
            suggestions: ['Use one of: local, docker, railway']
          }
        });
      }
      
      // Validate status filter
      if (args.status && !this.validStatuses.includes(args.status)) {
        throw new Error(`Invalid status: ${args.status}. Must be one of: ${this.validStatuses.join(', ')}`, {
          cause: {
            errorType: 'validation_error',
            suggestions: ['Use one of: running, stopped, building, failed, pending']
          }
        });
      }
      
      // Validate format
      const format = args.format || 'table';
      if (!this.validFormats.includes(format)) {
        throw new Error(`Invalid format: ${format}. Must be one of: ${this.validFormats.join(', ')}`, {
          cause: {
            errorType: 'validation_error',
            suggestions: ['Use one of: table, json, summary']
          }
        });
      }
      
      // Get deployment manager
      const deploymentManager = await this.getDeploymentManager();
      if (!deploymentManager) {
        throw new Error('Deployment manager not available. Please initialize the system first.', {
      cause: {
        errorType: 'operation_error',
        suggestions: ['Initialize the deployment system before listing deployments']
      }
    });
      }
      
      // this.emitProgress('Retrieving deployments', { 
      //   provider: args.provider || 'all',
      //   status: args.status || 'all'
      // });
      
      // Build filter options
      const filterOptions = this.buildFilterOptions(args);
      
      // Get deployments
      const result = await deploymentManager.listDeployments(filterOptions);
      
      if (result.success) {
        let deployments = result.deployments;
        
        // Apply client-side filtering if needed
        deployments = this.applyFilters(deployments, args);
        
        // Apply sorting
        deployments = this.applySorting(deployments, args.sortBy || 'createdAt', args.sortOrder || 'desc');
        
        // Apply pagination
        const { paginatedDeployments, pagination } = this.applyPagination(deployments, args.limit || 50, args.offset || 0);
        
        // Generate summary
        const summary = this.generateSummary(deployments);
        
        // this.emitInfo(`Retrieved ${deployments.length} deployments`, {
        //   total: deployments.length,
        //   providers: Object.keys(summary.byProvider),
        //   statuses: Object.keys(summary.byStatus)
        // });
        
        // Format output
        const formattedData = this.formatOutput(paginatedDeployments, format, summary, pagination, args);
        
        return {
          deployments: paginatedDeployments,
          summary: summary,
          format: format,
          pagination: pagination,
          table: formattedData.table,
          message: deployments.length === 0 ? 'No deployments found matching the specified criteria' : undefined,
          nextSteps: this.getNextSteps(deployments.length, format)
        };
      } else {
        // this.emitError(`Failed to list deployments: ${result.error}`, {
        //   error: result.error
        // });
        
        throw new Error(result.error || 'Failed to list deployments', {
      cause: {
        errorType: 'operation_error',
        suggestions: this.getFailureSuggestions(result)
      }
    });
      }
      
    } catch (error) {
      // this.emitError(`List deployments tool error: ${error.message}`, { error: error.stack });
      
      // Re-throw if already has proper structure
      if (error.cause && error.cause.errorType) {
        throw error;
      }
      
      // Wrap other errors
      throw new Error(
        error.message.includes('JSON') ? `Invalid JSON in arguments: ${error.message}` : `Failed to list deployments: ${error.message}`,
        {
          cause: {
            errorType: error.message.includes('JSON') ? 'validation_error' : 'operation_error',
            suggestions: ['Check your filter parameters and try again']
          }
        }
      );
    }
  }

  /**
   * Build filter options for deployment manager
   */
  buildFilterOptions(args) {
    const options = {};
    
    if (args.provider) options.provider = args.provider;
    if (args.status) options.status = args.status;
    if (args.search) options.search = args.search;
    
    return options;
  }

  /**
   * Apply client-side filters
   */
  applyFilters(deployments, args) {
    let filtered = deployments;
    
    // Search filter (if not handled by deployment manager)
    if (args.search) {
      const searchTerm = args.search.toLowerCase();
      filtered = filtered.filter(deployment => 
        deployment.name?.toLowerCase().includes(searchTerm) ||
        deployment.id?.toLowerCase().includes(searchTerm)
      );
    }
    
    return filtered;
  }

  /**
   * Apply sorting to deployments
   */
  applySorting(deployments, sortBy, sortOrder) {
    return deployments.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      // Handle date fields
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      // Handle string fields
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      let comparison = 0;
      if (aVal > bVal) comparison = 1;
      if (aVal < bVal) comparison = -1;
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Apply pagination to deployments
   */
  applyPagination(deployments, limit, offset) {
    const total = deployments.length;
    const paginatedDeployments = deployments.slice(offset, offset + limit);
    
    const pagination = {
      total: total,
      limit: limit,
      offset: offset,
      hasMore: offset + limit < total,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
    
    return { paginatedDeployments, pagination };
  }

  /**
   * Generate summary statistics
   */
  generateSummary(deployments) {
    const summary = {
      total: deployments.length,
      byProvider: {},
      byStatus: {}
    };
    
    deployments.forEach(deployment => {
      // Count by provider
      const provider = deployment.provider;
      summary.byProvider[provider] = (summary.byProvider[provider] || 0) + 1;
      
      // Count by status
      const status = deployment.status;
      summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    });
    
    return summary;
  }

  /**
   * Format output based on requested format
   */
  formatOutput(deployments, format, summary, pagination, args) {
    const data = { table: null };
    
    if (format === 'table') {
      data.table = this.formatAsTable(deployments, args);
    }
    
    return data;
  }

  /**
   * Format deployments as table
   */
  formatAsTable(deployments, args) {
    const headers = ['ID', 'Name', 'Provider', 'Status'];
    
    if (args.includeUrls !== false) {
      headers.push('URL');
    }
    
    headers.push('Created');
    
    if (args.includeMetrics) {
      headers.push('CPU', 'Memory');
    }
    
    const rows = deployments.map(deployment => {
      const row = [
        deployment.id.substring(0, 12) + '...',
        deployment.name || '-',
        deployment.provider,
        deployment.status
      ];
      
      if (args.includeUrls !== false) {
        row.push(deployment.url || '-');
      }
      
      row.push(this.formatDate(deployment.createdAt));
      
      if (args.includeMetrics) {
        row.push(deployment.metrics?.cpu || '-');
        row.push(deployment.metrics?.memory || '-');
      }
      
      return row;
    });
    
    return { headers, rows };
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
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
   * Get next steps based on result
   */
  getNextSteps(deploymentCount, format) {
    const steps = [];
    
    if (deploymentCount === 0) {
      steps.push('Deploy a new application with: deploy_application');
      steps.push('Check system status and available providers');
    } else {
      steps.push('Monitor specific deployments with: monitor_deployment --id <deploymentId>');
      steps.push('Update deployments with: update_deployment --id <deploymentId>');
      steps.push('Get detailed logs with: get_deployment_logs --id <deploymentId>');
      
      if (format === 'summary') {
        steps.push('Use --format table or --format json for detailed view');
      }
    }
    
    return steps;
  }

  /**
   * Get failure suggestions based on error
   */
  getFailureSuggestions(result) {
    const suggestions = [];
    
    if (result.error && result.error.includes('connection')) {
      suggestions.push('Check database and system connectivity');
      suggestions.push('Ensure deployment system is properly initialized');
    }
    
    if (result.error && result.error.includes('permission')) {
      suggestions.push('Verify you have permission to access deployment information');
      suggestions.push('Check authentication credentials');
    }
    
    suggestions.push('Try listing deployments from a specific provider');
    suggestions.push('Check system logs for more detailed error information');
    
    return suggestions;
  }
}

export default ListDeploymentsTool;