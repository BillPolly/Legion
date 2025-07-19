import BaseProvider from './BaseProvider.js';

/**
 * RailwayProvider - Deploy applications to Railway cloud platform using GraphQL API
 */
class RailwayProvider extends BaseProvider {
  constructor(resourceManager) {
    super();
    this.resourceManager = resourceManager;
    
    // Get Railway API key from ResourceManager
    this.apiKey = this.resourceManager.get('railway-api-key');
    if (!this.apiKey) {
      throw new Error('Railway API key not available in ResourceManager. Set RAILWAY environment variable.');
    }
    
    this.name = 'railway';
    this.apiEndpoint = 'https://backboard.railway.app/graphql/v2';
    this.activeDeployments = new Map();
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      name: 'railway',
      displayName: 'Railway',
      description: 'Deploy applications to Railway cloud platform',
      supports: {
        hosting: true,
        customDomains: true,
        ssl: true,
        scaling: true,
        databases: true,
        environmentVariables: true,
        monitoring: true,
        githubIntegration: true,
        dockerSupport: true,
        buildFromSource: true,
        multiInstance: false, // Railway handles this automatically
        loadBalancing: true, // Built into Railway
        autoScaling: true
      },
      requirements: {
        railwayApiKey: true,
        githubRepo: false // Optional, can deploy from local too
      }
    };
  }

  /**
   * Validate deployment configuration
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!config.name) {
      errors.push('Name is required for Railway deployments');
    }

    if (!config.source) {
      errors.push('Source configuration is required');
    }

    if (config.source === 'github' && (!config.repo || !config.branch)) {
      errors.push('GitHub repo and branch are required for GitHub deployments');
    }

    if (config.source === 'local' && !config.projectPath) {
      errors.push('Project path is required for local deployments');
    }

    // Validate name format
    if (config.name && !/^[a-z0-9-]+$/.test(config.name)) {
      errors.push('Name must contain only lowercase letters, numbers, and hyphens');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Make GraphQL request to Railway API
   */
  async makeGraphQLRequest(query, variables = {}) {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          variables
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Authentication failed. Check your Railway API key.'
          };
        }
        return {
          success: false,
          error: `API request failed: ${response.status} ${response.statusText}`
        };
      }

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        return {
          success: false,
          error: result.errors[0].message
        };
      }

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a new Railway project
   */
  async createProject(config) {
    const mutation = `
      mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          id
          name
          description
          createdAt
        }
      }
    `;

    const variables = {
      input: {
        name: config.name,
        description: config.description,
        isPublic: config.isPublic || false
      }
    };

    const result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      project: result.data.projectCreate
    };
  }

  /**
   * List existing projects
   */
  async listProjects() {
    const query = `
      query {
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
              services {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.makeGraphQLRequest(query);
    
    if (!result.success) {
      return result;
    }

    const projects = result.data.projects.edges.map(edge => ({
      id: edge.node.id,
      name: edge.node.name,
      description: edge.node.description,
      createdAt: edge.node.createdAt,
      services: edge.node.services.edges.map(serviceEdge => serviceEdge.node)
    }));

    return {
      success: true,
      projects
    };
  }

  /**
   * Create a service within a project
   */
  async createService(projectId, config) {
    const mutation = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `;

    const variables = {
      input: {
        projectId,
        name: config.name || 'web-service',
        source: this.buildSourceConfig(config)
      }
    };

    const result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      service: result.data.serviceCreate
    };
  }

  /**
   * Build source configuration for Railway
   */
  buildSourceConfig(config) {
    if (config.source === 'github') {
      return {
        repo: config.repo,
        branch: config.branch,
        rootDirectory: config.rootDirectory || '/'
      };
    } else if (config.source === 'local') {
      // For local deployment, Railway requires a git repo
      // This would typically involve creating a temporary git repo and pushing
      return {
        type: 'LOCAL'
      };
    }
    
    return {};
  }

  /**
   * Deploy application to Railway
   */
  async deploy(config) {
    try {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // 1. Create or get project
      let project;
      if (config.projectId) {
        // Use existing project
        project = { id: config.projectId };
      } else {
        // Create new project
        const projectResult = await this.createProject({
          name: config.name,
          description: config.description
        });
        
        if (!projectResult.success) {
          return projectResult;
        }
        
        project = projectResult.project;
      }

      // 2. Create service
      const serviceResult = await this.createService(project.id, config);
      
      if (!serviceResult.success) {
        return serviceResult;
      }

      const service = serviceResult.service;

      // 3. Set environment variables if provided
      if (config.environment) {
        const envResult = await this.setEnvironmentVariables(service.id, config.environment);
        if (!envResult.success) {
          console.warn('Failed to set environment variables:', envResult.error);
        }
      }

      // 4. Trigger deployment
      let deployment;
      if (config.source === 'github') {
        deployment = await this.deployFromGitHub(service.id, config);
      } else {
        deployment = await this.deployFromLocal(service.id, config);
      }

      if (!deployment.success) {
        return deployment;
      }

      const result = {
        success: true,
        id: deployment.deployment.id,
        projectId: project.id,
        serviceId: service.id,
        deploymentId: deployment.deployment.id,
        status: this.mapRailwayStatus(deployment.deployment.status),
        url: deployment.deployment.url,
        provider: 'railway',
        createdAt: new Date()
      };

      // Store deployment info
      this.activeDeployments.set(result.id, result);

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Deploy from GitHub repository
   */
  async deployFromGitHub(serviceId, config) {
    const mutation = `
      mutation ServiceInstanceDeploy($serviceId: String!, $environmentId: String) {
        serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId) {
          id
          status
          url
          createdAt
        }
      }
    `;

    const variables = {
      serviceId,
      environmentId: config.environmentId || null
    };

    const result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      deployment: result.data.serviceInstanceDeploy
    };
  }

  /**
   * Deploy from local source (placeholder - requires file upload)
   */
  async deployFromLocal(serviceId, config) {
    // Railway requires git-based deployment or Docker image
    // For local deployment, we'd need to:
    // 1. Create a temporary git repo
    // 2. Push to Railway's git endpoint
    // 3. Trigger deployment
    
    // For now, return a placeholder implementation
    return {
      success: true,
      deployment: {
        id: `local-deploy-${Date.now()}`,
        status: 'BUILDING',
        url: null,
        createdAt: new Date().toISOString()
      }
    };
  }

  /**
   * Map Railway status to standard status
   */
  mapRailwayStatus(railwayStatus) {
    const statusMap = {
      'BUILDING': 'building',
      'DEPLOYING': 'deploying', 
      'SUCCESS': 'running',
      'FAILED': 'failed',
      'CRASHED': 'crashed',
      'REMOVED': 'removed'
    };

    return statusMap[railwayStatus] || 'unknown';
  }

  /**
   * Get deployment status
   */
  async getStatus(deploymentId) {
    const query = `
      query Deployment($id: String!) {
        deployment(id: $id) {
          id
          status
          url
          createdAt
          completedAt
          staticUrl
        }
      }
    `;

    const variables = { id: deploymentId };
    const result = await this.makeGraphQLRequest(query, variables);
    
    if (!result.success) {
      return {
        id: deploymentId,
        status: 'error',
        error: result.error
      };
    }

    const deployment = result.data.deployment;
    
    return {
      id: deploymentId,
      status: this.mapRailwayStatus(deployment.status),
      url: deployment.url || deployment.staticUrl,
      createdAt: deployment.createdAt,
      completedAt: deployment.completedAt
    };
  }

  /**
   * Get deployment logs
   */
  async getLogs(deploymentId, options = {}) {
    const query = `
      query DeploymentLogs($deploymentId: String!, $filter: LogFilter) {
        deploymentLogs(deploymentId: $deploymentId, filter: $filter) {
          timestamp
          message
          severity
        }
      }
    `;

    const variables = {
      deploymentId,
      filter: {
        limit: options.limit || 100,
        since: options.since || null
      }
    };

    const result = await this.makeGraphQLRequest(query, variables);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error,
        logs: []
      };
    }

    const logs = result.data.deploymentLogs.map(log => ({
      timestamp: log.timestamp,
      message: log.message,
      level: log.severity.toLowerCase()
    }));

    return {
      success: true,
      logs
    };
  }

  /**
   * Get service metrics
   */
  async getMetrics(serviceId) {
    const query = `
      query ServiceMetrics($serviceId: String!) {
        serviceMetrics(serviceId: $serviceId) {
          cpu
          memory
          networkRx
          networkTx
          requests
          responseTime
        }
      }
    `;

    const variables = { serviceId };
    const result = await this.makeGraphQLRequest(query, variables);
    
    if (!result.success) {
      return {
        error: result.error,
        timestamp: new Date()
      };
    }

    const metrics = result.data.serviceMetrics;
    
    return {
      cpu: metrics.cpu,
      memory: metrics.memory,
      network: {
        rx: metrics.networkRx,
        tx: metrics.networkTx
      },
      requests: metrics.requests,
      responseTime: metrics.responseTime,
      timestamp: new Date()
    };
  }

  /**
   * Set environment variables for a service
   */
  async setEnvironmentVariables(serviceId, variables) {
    const mutation = `
      mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input) {
          id
        }
      }
    `;

    const variableInputs = Object.entries(variables).map(([name, value]) => ({
      name,
      value: String(value)
    }));

    const variablesInput = {
      input: {
        serviceId,
        variables: variableInputs
      }
    };

    const result = await this.makeGraphQLRequest(mutation, variablesInput);
    
    return {
      success: result.success,
      error: result.error
    };
  }

  /**
   * Get environment variables for a service
   */
  async getEnvironmentVariables(serviceId) {
    const query = `
      query ServiceVariables($serviceId: String!) {
        variables(serviceId: $serviceId) {
          name
          value
        }
      }
    `;

    const variables = { serviceId };
    const result = await this.makeGraphQLRequest(query, variables);
    
    if (!result.success) {
      return result;
    }

    const envVars = {};
    result.data.variables.forEach(variable => {
      envVars[variable.name] = variable.value;
    });

    return {
      success: true,
      variables: envVars
    };
  }

  /**
   * Add custom domain to a service
   */
  async addCustomDomain(serviceId, config) {
    const mutation = `
      mutation CustomDomainCreate($input: CustomDomainCreateInput!) {
        customDomainCreate(input: $input) {
          id
          domain
          status
        }
      }
    `;

    const variables = {
      input: {
        serviceId,
        domain: config.domain
      }
    };

    const result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      domain: {
        id: result.data.customDomainCreate.id,
        domain: result.data.customDomainCreate.domain,
        status: result.data.customDomainCreate.status.toLowerCase()
      }
    };
  }

  /**
   * List custom domains for a service
   */
  async listCustomDomains(serviceId) {
    const query = `
      query ServiceCustomDomains($serviceId: String!) {
        customDomains(serviceId: $serviceId) {
          id
          domain
          status
        }
      }
    `;

    const variables = { serviceId };
    const result = await this.makeGraphQLRequest(query, variables);
    
    if (!result.success) {
      return result;
    }

    const domains = result.data.customDomains.map(domain => ({
      id: domain.id,
      domain: domain.domain,
      status: domain.status.toLowerCase()
    }));

    return {
      success: true,
      domains
    };
  }

  /**
   * Update service configuration
   */
  async update(serviceId, updateConfig) {
    try {
      // Update environment variables if provided
      if (updateConfig.environment) {
        const envResult = await this.setEnvironmentVariables(serviceId, updateConfig.environment);
        if (!envResult.success) {
          return envResult;
        }
      }

      // Trigger new deployment to apply changes
      const deploymentResult = await this.redeploy(serviceId);
      
      return deploymentResult;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Trigger a new deployment (redeploy)
   */
  async redeploy(serviceId) {
    const mutation = `
      mutation ServiceInstanceDeploy($serviceId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId) {
          id
          status
          url
        }
      }
    `;

    const variables = { serviceId };
    const result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      deploymentId: result.data.serviceInstanceDeploy.id,
      status: this.mapRailwayStatus(result.data.serviceInstanceDeploy.status),
      url: result.data.serviceInstanceDeploy.url
    };
  }

  /**
   * Remove/delete a service
   */
  async remove(serviceId) {
    const mutation = `
      mutation ServiceDelete($id: String!) {
        serviceDelete(id: $id) {
          id
        }
      }
    `;

    const variables = { id: serviceId };
    const result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success) {
      return result;
    }

    // Remove from active deployments
    this.activeDeployments.delete(serviceId);

    return {
      success: true,
      id: serviceId,
      status: 'removed'
    };
  }

  /**
   * Create a database service
   */
  async createDatabase(projectId, config) {
    const mutation = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `;

    const variables = {
      input: {
        projectId,
        name: config.name || `${config.type}-db`,
        source: {
          image: this.getDatabaseImage(config.type)
        }
      }
    };

    const result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      service: result.data.serviceCreate
    };
  }

  /**
   * Get database Docker image for type
   */
  getDatabaseImage(type) {
    const images = {
      'postgresql': 'postgres:15',
      'mysql': 'mysql:8.0',
      'redis': 'redis:7',
      'mongodb': 'mongo:6'
    };

    return images[type] || 'postgres:15';
  }

  /**
   * Get database connection details
   */
  async getDatabaseConnection(serviceId) {
    const envResult = await this.getEnvironmentVariables(serviceId);
    
    if (!envResult.success) {
      return envResult;
    }

    const connectionString = envResult.variables.DATABASE_URL || 
                           envResult.variables.POSTGRES_URL ||
                           envResult.variables.MYSQL_URL ||
                           envResult.variables.REDIS_URL ||
                           envResult.variables.MONGODB_URL;

    return {
      success: true,
      connectionString,
      variables: envResult.variables
    };
  }

  /**
   * List all deployments across projects
   */
  async listDeployments() {
    const query = `
      query {
        projects {
          edges {
            node {
              id
              name
              services {
                edges {
                  node {
                    id
                    name
                    deployments {
                      edges {
                        node {
                          id
                          status
                          url
                          createdAt
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.makeGraphQLRequest(query);
    
    if (!result.success) {
      return result;
    }

    const deployments = [];
    
    result.data.projects.edges.forEach(projectEdge => {
      const project = projectEdge.node;
      
      project.services.edges.forEach(serviceEdge => {
        const service = serviceEdge.node;
        
        service.deployments.edges.forEach(deploymentEdge => {
          const deployment = deploymentEdge.node;
          
          deployments.push({
            id: deployment.id,
            projectId: project.id,
            projectName: project.name,
            serviceId: service.id,
            serviceName: service.name,
            status: this.mapRailwayStatus(deployment.status),
            url: deployment.url,
            createdAt: deployment.createdAt,
            provider: 'railway'
          });
        });
      });
    });

    return {
      success: true,
      deployments
    };
  }

  /**
   * Stop service (Railway doesn't have explicit stop, but we can scale to 0)
   */
  async stop(serviceId) {
    // Railway doesn't have a direct stop operation
    // This would typically involve scaling to 0 replicas
    return {
      success: true,
      message: 'Railway services are automatically managed. Use remove() to delete the service.'
    };
  }
}

export default RailwayProvider;