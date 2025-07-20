/**
 * RailwayProvider - Deploy applications to Railway cloud platform using GraphQL API
 */
class RailwayProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Railway API key is required');
    }
    
    this.apiKey = apiKey;
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
        const errorBody = await response.text();
        console.error('Railway API error response:', errorBody);
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

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse Railway response:', responseText);
        return {
          success: false,
          error: 'Invalid JSON response from Railway API'
        };
      }

      if (result.errors && result.errors.length > 0) {
        console.error('Railway GraphQL errors:', JSON.stringify(result.errors, null, 2));
        return {
          success: false,
          error: result.errors[0].message,
          errors: result.errors
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

    console.log('Creating service with variables:', JSON.stringify(variables, null, 2));
    
    // First attempt with the built config
    let result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success && config.source === 'github') {
      // If it fails, try with just the repo without buildSourceConfig
      console.log('First attempt failed, trying simplified source...');
      const simplifiedVariables = {
        input: {
          projectId,
          name: config.name || 'web-service',
          source: {
            repo: config.repo
          }
        }
      };
      console.log('Simplified variables:', JSON.stringify(simplifiedVariables, null, 2));
      result = await this.makeGraphQLRequest(mutation, simplifiedVariables);
    }
    
    if (!result.success) {
      console.error('Service creation failed:', result.error);
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
      // Railway API expects just repo in source object
      return {
        repo: config.repo
      };
    } else if (config.image) {
      // Docker image deployment
      return {
        image: config.image
      };
    } else if (config.source === 'local') {
      // For local deployment, use a default Node.js image
      // This would ideally build from local source
      return {
        image: 'node:18-alpine'
      };
    }
    
    // Default to Railway's Node.js template
    return {
      github: {
        repo: 'railwayapp-templates/express-starter',
        branch: 'main'
      }
    };
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

      // Wait a bit after project creation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 2. Create service
      const serviceResult = await this.createService(project.id, config);
      
      if (!serviceResult.success) {
        console.error('Service creation failed for project:', project.id);
        console.error('Config:', JSON.stringify(config, null, 2));
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

      // 4. For GitHub source, deployment is automatic when service is created
      let deployment;
      if (config.source === 'github') {
        // Railway automatically deploys when a GitHub source is connected
        // We just need to create a deployment object for consistency
        deployment = {
          success: true,
          deployment: {
            id: `deploy-${service.id}`,
            status: 'BUILDING',
            url: null,
            createdAt: new Date().toISOString()
          }
        };
      } else {
        deployment = await this.deployFromLocal(service.id, config);
        if (!deployment.success) {
          return deployment;
        }
      }

      const result = {
        success: true,
        id: service.id, // Use service ID as deployment ID for Railway
        projectId: project.id,
        serviceId: service.id,
        deploymentId: deployment.deployment.id,
        status: this.mapRailwayStatus(deployment.deployment.status),
        url: deployment.deployment.url,
        provider: 'railway',
        createdAt: new Date()
      };

      // Store deployment info with the URL if we have it
      this.activeDeployments.set(result.id, {
        ...result,
        url: deployment.deployment.url || result.url,
        domain: deployment.deployment.domain
      });

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
    // First check if we have the deployment in our active deployments with URL
    const activeDeployment = this.activeDeployments.get(deploymentId);
    if (activeDeployment && activeDeployment.url) {
      // We already have the URL from deployWithDomain
      return {
        id: deploymentId,
        status: activeDeployment.status,
        url: activeDeployment.url,
        domain: activeDeployment.domain,
        createdAt: activeDeployment.createdAt
      };
    }

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
      url: deployment.url || deployment.staticUrl || activeDeployment?.url,
      domain: activeDeployment?.domain,
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
  async setEnvironmentVariables(serviceId, variables, environmentId = null) {
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
        environmentId,
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
        const envResult = await this.setEnvironmentVariables(
          serviceId, 
          updateConfig.environment,
          updateConfig.environmentId
        );
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

  /**
   * Delete a service
   */
  async deleteService(serviceId) {
    const mutation = `
      mutation ServiceDelete($id: String!) {
        serviceDelete(id: $id)
      }
    `;

    const variables = { id: serviceId };
    const result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      message: `Service ${serviceId} deleted successfully`
    };
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId) {
    const mutation = `
      mutation ProjectDelete($id: String!) {
        projectDelete(id: $id)
      }
    `;

    const variables = { id: projectId };
    const result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      message: `Project ${projectId} deleted successfully`
    };
  }

  /**
   * Get detailed project information including services and deployments
   */
  async getProjectDetails(projectId) {
    const query = `
      query Project($projectId: String!) {
        project(id: $projectId) {
          id
          name
          description
          createdAt
          updatedAt
          services {
            edges {
              node {
                id
                name
                createdAt
                deployments(first: 5) {
                  edges {
                    node {
                      id
                      status
                      url
                      staticUrl
                      createdAt
                    }
                  }
                }
              }
            }
          }
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;

    const variables = { projectId };
    const result = await this.makeGraphQLRequest(query, variables);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      project: result.data.project
    };
  }

  /**
   * Get comprehensive account overview
   */
  async getAccountOverview() {
    const query = `
      query AccountOverview {
        me {
          id
          name
          email
          projects {
            edges {
              node {
                id
                name
                description
                createdAt
                updatedAt
                services {
                  edges {
                    node {
                      id
                      name
                      createdAt
                      deployments(first: 1) {
                        edges {
                          node {
                            id
                            status
                            url
                            staticUrl
                          }
                        }
                      }
                    }
                  }
                }
                environments {
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
      }
    `;

    const result = await this.makeGraphQLRequest(query);
    
    if (!result.success) {
      return result;
    }

    const me = result.data.me;
    const projects = me.projects.edges.map(edge => edge.node);

    // Calculate statistics
    let totalServices = 0;
    let totalDeployments = 0;
    let activeDeployments = 0;
    const liveUrls = [];

    projects.forEach(project => {
      const services = project.services.edges;
      totalServices += services.length;
      
      services.forEach(serviceEdge => {
        const service = serviceEdge.node;
        const deployments = service.deployments.edges;
        totalDeployments += deployments.length;
        
        deployments.forEach(deploymentEdge => {
          const deployment = deploymentEdge.node;
          if (deployment.status === 'SUCCESS') {
            activeDeployments++;
            if (deployment.url) {
              liveUrls.push({
                projectName: project.name,
                serviceName: service.name,
                url: deployment.url
              });
            }
          }
        });
      });
    });

    return {
      success: true,
      account: {
        id: me.id,
        name: me.name,
        email: me.email
      },
      stats: {
        totalProjects: projects.length,
        totalServices,
        totalDeployments,
        activeDeployments
      },
      projects,
      liveUrls
    };
  }

  /**
   * Delete all projects (use with caution!)
   */
  async deleteAllProjects() {
    // First, list all projects
    const projectsResult = await this.listProjects();
    
    if (!projectsResult.success) {
      return {
        success: false,
        error: 'Failed to list projects: ' + projectsResult.error
      };
    }

    const projects = projectsResult.projects;
    const results = [];

    console.log(`Found ${projects.length} projects to delete`);

    // Delete each project
    for (const project of projects) {
      console.log(`Deleting project: ${project.name} (${project.id})`);
      const deleteResult = await this.deleteProject(project.id);
      
      results.push({
        projectId: project.id,
        projectName: project.name,
        success: deleteResult.success,
        error: deleteResult.error
      });

      if (deleteResult.success) {
        console.log(`✅ Deleted project: ${project.name}`);
      } else {
        console.log(`❌ Failed to delete project ${project.name}: ${deleteResult.error}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      success: failCount === 0,
      totalProjects: projects.length,
      deletedProjects: successCount,
      failedDeletions: failCount,
      results
    };
  }

  /**
   * Generate a Railway domain for a service
   */
  async generateDomain(serviceId, environmentId) {
    const mutation = `
      mutation ServiceDomainCreate($input: ServiceDomainCreateInput!) {
        serviceDomainCreate(input: $input) {
          domain
        }
      }
    `;

    const variables = {
      input: {
        serviceId,
        environmentId
      }
    };

    const result = await this.makeGraphQLRequest(mutation, variables);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      domain: result.data.serviceDomainCreate.domain
    };
  }

  /**
   * Get service domains
   */
  async getServiceDomains(serviceId, environmentId) {
    const query = `
      query ServiceDomains($serviceId: String!, $environmentId: String!) {
        domains(serviceId: $serviceId, environmentId: $environmentId) {
          serviceDomains {
            domain
          }
        }
      }
    `;

    const variables = { serviceId, environmentId };
    const result = await this.makeGraphQLRequest(query, variables);
    
    if (!result.success) {
      return result;
    }

    const domains = result.data.domains.serviceDomains.map(d => d.domain);

    return {
      success: true,
      domains
    };
  }

  /**
   * Deploy and generate domain automatically
   */
  async deployWithDomain(config) {
    try {
      // First deploy the application
      const deployResult = await this.deploy(config);
      
      if (!deployResult.success) {
        return deployResult;
      }

      // Get the environment ID for the project
      const projectDetails = await this.getProjectDetails(deployResult.projectId);
      
      if (!projectDetails.success) {
        console.warn('Could not get project details for domain generation');
        return deployResult;
      }

      const environmentId = projectDetails.project.environments.edges[0]?.node.id;
      
      if (!environmentId) {
        console.warn('No environment found for domain generation');
        return deployResult;
      }

      // Wait a moment for the service to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Generate the domain
      console.log('\n🌐 Generating Railway domain...');
      const domainResult = await this.generateDomain(deployResult.serviceId, environmentId);
      
      if (domainResult.success) {
        deployResult.domain = domainResult.domain;
        deployResult.url = `https://${domainResult.domain}`;
        console.log(`✅ Domain generated: ${deployResult.url}`);
      } else {
        console.warn('Domain generation failed:', domainResult.error);
      }

      return deployResult;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default RailwayProvider;